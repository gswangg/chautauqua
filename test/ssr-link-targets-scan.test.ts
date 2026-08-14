// DEC-914 (Amendment, wave 16): "a link is the route it LANDS on" already
// gets a source-text guard for react-router targets in app/src
// (test/link-targets-scan.test.ts, DEC-837). Nothing guards the SSR
// surfaces: src/routes/public/**, src/routes/portal/**, auth.tsx,
// account.tsx, root.tsx, docs.tsx, not-found.tsx build hrefs as plain
// string/template literals in server-rendered HTML. A dead link here costs
// more than an SPA one -- an anonymous visitor hitting a bad href has no
// client-side nav memory to fall back on, just a 404 (field guide:
// "GUESSABLE URL 404 IS DEAD END").
//
// DEC-914 (Amendment, wave 17): the wave-16 scan's root was src/routes/**
// only -- that left src/server/not-found.tsx (which owns
// ORGANIZER_NOT_FOUND_LINKS, the exact hrefs this guard exists to police)
// and src/views/form-render.tsx OUTSIDE the guard entirely, and it read
// only `href`, leaving every `action`/`formaction` on a <form> unchecked
// even though a dead form action loses typed data, not just a click. This
// wave widens both: the root is now a walk of ALL of src/**/*.tsx (dropping
// *.test.tsx), and action/formaction attributes are collected and matched
// against the registered route table for the enclosing <form>'s OWN method
// (GET vs POST), not always the GET table.
//
// Route table: rather than hand-listing every sub-app's mount prefix (which
// has drifted from src/index.ts before -- see field guide w27-29 and
// test/docs-route-coverage.test.ts's DEC-518 rationale), this reuses that
// same technique: parse every literal `app.route("<prefix>", <identifier>)`
// call out of src/index.ts's own source, resolve each identifier through
// that file's own imports, dynamically import the real sub-app module, and
// mount it into a throwaway Hono app at the exact prefix src/index.ts uses.
// That app's own `app.routes` ({method, path}[]) is the ACTUAL registered
// route table -- including the SURFACES for-loop in src/routes/public/index.tsx
// (each surface is registered as a concrete `.get()` call at import time, so
// it shows up in app.routes with no special-casing needed) and the admin
// SPA's `/admin` + `/admin/*` shell mounts (src/routes/root.tsx).
//
// href collection: every literal `href="..."`, `href='...'`, and
// `href={\`...\`}` across src/routes/**/*.tsx (SSR only -- app/src is
// DEC-837's job). For a template literal, only the static prefix before the
// first `${` is a real literal; that's still enough to resolve the leading
// path segments (and if the whole href is one interpolation with no static
// prefix, e.g. href={`${basePath}...`}, there is nothing to check -- it
// isn't an internal-literal hit at all since it doesn't start with "/").
//
// Matching: an internal href (starts with "/") has its query string and
// hash fragment stripped, then is compared segment-by-segment against every
// registered GET route path with the same segment count, where a `:name`
// segment matches any non-empty literal segment and a trailing `*` segment
// matches one or more trailing segments.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import { describe, expect, it, beforeAll } from "vitest";
import type { AppEnv } from "../src/server/env";

const REPO_ROOT = join(__dirname, "..");
const SOURCE_DIR = join(REPO_ROOT, "src");
const INDEX_PATH = resolve(fileURLToPath(import.meta.url), "../../src/index.ts");
const INDEX_DIR = dirname(INDEX_PATH);

// ---------------------------------------------------------------------------
// Registered route patterns, derived from src/index.ts (DEC-518 technique)
// ---------------------------------------------------------------------------

interface ImportBinding {
  exportedName: string;
  modulePath: string;
}

function parseImportBindings(source: string): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source))) {
    const namesGroup = m[1];
    const modulePath = m[2];
    if (namesGroup === undefined || modulePath === undefined) continue;
    const names = namesGroup
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const raw of names) {
      const parts = raw.split(/\s+as\s+/).map((s) => s.trim());
      const exportedName = parts[0];
      if (!exportedName) continue;
      const localName = parts[1] ?? exportedName;
      bindings.set(localName, { exportedName, modulePath });
    }
  }
  return bindings;
}

interface RouteCall {
  prefix: string;
  identifier: string;
}

function parseRouteCalls(source: string): RouteCall[] {
  const calls: RouteCall[] = [];
  const routeCallRegex = /app\.route\(\s*(["'])((?:(?!\1).)*)\1\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = routeCallRegex.exec(source))) {
    const prefix = m[2];
    const identifier = m[3];
    if (prefix === undefined || identifier === undefined) continue;
    calls.push({ prefix, identifier });
  }
  return calls;
}

/** Normalizes Hono's `:name{regex}` param syntax to bare `:name` and splits
 * into segments (dropping empty segments from a leading/trailing slash). */
function segmentsOf(path: string): string[] {
  const normalized = path.replace(/:([a-zA-Z0-9_]+)(\{[^}]*\})?/g, ":$1");
  return normalized.split("/").filter((s) => s.length > 0);
}

function patternMatches(patternSegs: string[], hrefSegs: string[]): boolean {
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i]!;
    if (p === "*") {
      // A trailing wildcard matches one or more remaining segments.
      return hrefSegs.length > i;
    }
    if (i >= hrefSegs.length) return false;
    if (p.startsWith(":")) continue;
    if (p !== hrefSegs[i]) return false;
  }
  return patternSegs.length === hrefSegs.length;
}

let registeredPatterns: string[] = [];
let registeredPostPatterns: string[] = [];

beforeAll(async () => {
  const source = readFileSync(INDEX_PATH, "utf-8");
  const bindings = parseImportBindings(source);
  const routeCalls = parseRouteCalls(source);
  expect(routeCalls.length).toBeGreaterThan(0);

  const moduleCache = new Map<string, Record<string, unknown>>();
  async function loadModule(modulePath: string): Promise<Record<string, unknown>> {
    let mod = moduleCache.get(modulePath);
    if (!mod) {
      const resolved = resolve(INDEX_DIR, modulePath);
      mod = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
      moduleCache.set(modulePath, mod);
    }
    return mod;
  }

  const app = new Hono<AppEnv>();
  for (const { prefix, identifier } of routeCalls) {
    const binding = bindings.get(identifier);
    if (!binding) {
      throw new Error(
        `src/index.ts calls app.route("${prefix}", ${identifier}) but ${identifier} is not bound by any ` +
          `import statement in that file -- this scan can't resolve it and refuses to silently skip it (DEC-518).`,
      );
    }
    const mod = await loadModule(binding.modulePath);
    const subApp = mod[binding.exportedName];
    if (!subApp) {
      throw new Error(
        `src/index.ts imports ${identifier} (as ${binding.exportedName}) from "${binding.modulePath}", but that ` +
          `module has no such export.`,
      );
    }
    app.route(prefix, subApp as Hono<AppEnv>);
  }

  // Meta endpoints defined inline in createBaseApp() (src/server/app.ts),
  // not sub-app mounts, but real GET surfaces -- included so a literal href
  // pointing at one of them isn't a false positive.
  app.get("/health", (c) => c.text("ok"));
  app.get("/api/v1", (c) => c.text("ok"));

  registeredPatterns = [
    ...new Set(
      app.routes.filter((r) => r.method === "GET" || r.method === "ALL").map((r) => r.path),
    ),
  ];
  registeredPostPatterns = [
    ...new Set(
      app.routes.filter((r) => r.method === "POST" || r.method === "ALL").map((r) => r.path),
    ),
  ];
});

// ---------------------------------------------------------------------------
// Literal hrefs, collected from src/routes/**/*.tsx (SSR surfaces only)
// ---------------------------------------------------------------------------

function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

// Every server-rendered .tsx in src/** (not just src/routes/**) -- see the
// wave-17 amendment header comment above: src/server/not-found.tsx (owner of
// ORGANIZER_NOT_FOUND_LINKS) and src/views/form-render.tsx are both outside
// src/routes and were previously unscanned.
const sourceFiles = glob(SOURCE_DIR, [".tsx"]).filter((f) => !f.endsWith(".test.tsx"));

interface HrefHit {
  file: string;
  line: number;
  raw: string;
  /** The known-literal path text (query string / hash / dynamic remainder stripped). */
  pathPart: string;
  /**
   * True when `pathPart` is an incomplete PATH segment (there's more path text
   * coming from an interpolation, e.g. `/e/${slug}/sessions` -> pathPart "/e/",
   * partial=true) as opposed to a fully-known path with only its query string
   * or hash left dynamic (e.g. `/dev/mailbox?page=${p}` -> pathPart
   * "/dev/mailbox", partial=false).
   */
  partial: boolean;
}

function findLine(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** True if `index` within `text` falls after a `//` on its own line (a
 * source comment, not real markup) -- a plain text scan has no AST, so this
 * is a best-effort heuristic, but it's what the sibling app/src scan
 * (test/link-targets-scan.test.ts) also relies on implicitly by excluding
 * test files rather than parsing comments; here the one known case is a
 * whole comment line, which this catches precisely. */
function isInsideLineComment(text: string, index: number): boolean {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const line = text.slice(lineStart, index);
  return line.includes("//");
}

const HREF_RE = /href="([^"]*)"|href='([^']*)'|href=\{`([^`]*)`\}/g;

function collectHrefs(file: string, text: string): HrefHit[] {
  const hits: HrefHit[] = [];
  let m: RegExpExecArray | null;
  HREF_RE.lastIndex = 0;
  while ((m = HREF_RE.exec(text))) {
    if (isInsideLineComment(text, m.index)) continue;
    const isTemplate = m[3] !== undefined;
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    const line = findLine(text, m.index);
    if (!isTemplate) {
      // href="..." / href='...' can never contain a real JS interpolation --
      // it's always the complete literal. Still split off a query/hash if
      // one happens to be present, matching the template-literal case below.
      const pathPart = raw.split(/[?#]/)[0]!;
      hits.push({ file, line, raw, pathPart, partial: false });
      continue;
    }
    // href={`...`}: only the text before the first `${` is a real literal.
    const dollarIdx = raw.indexOf("${");
    const staticPrefix = dollarIdx === -1 ? raw : raw.slice(0, dollarIdx);
    const qIdx = staticPrefix.search(/[?#]/);
    if (qIdx !== -1) {
      // The interpolation (if any) falls inside the query string / hash, not
      // the path itself -- the path portion is fully known.
      hits.push({ file, line, raw, pathPart: staticPrefix.slice(0, qIdx), partial: false });
    } else {
      // No query/hash boundary reached before the first interpolation (or
      // there was no interpolation at all): the path is complete only if
      // there was no interpolation in the whole href.
      hits.push({ file, line, raw, pathPart: staticPrefix, partial: dollarIdx !== -1 });
    }
  }
  return hits;
}

const allHrefs: HrefHit[] = sourceFiles.flatMap((f) => collectHrefs(f, readFileSync(f, "utf-8")));

// ---------------------------------------------------------------------------
// Literal action/formaction, method-aware (wave 17 amendment): a <form>'s
// action is a route too, and a dead one loses typed data, not just a click.
// ---------------------------------------------------------------------------

interface ActionHit extends HrefHit {
  method: "GET" | "POST";
  attr: "action" | "formaction";
}

/** Finds the nearest preceding `<form` opening tag before `index` and reads
 * its `method` attribute (absent or "get" -> GET, "post" -> POST,
 * case-insensitive). A `formaction` on a submit button inherits its
 * enclosing form's method the same way -- the backward scan for `<form`
 * lands on the right tag regardless of which attribute (`action` or
 * `formaction`) triggered the search, since a `formaction` only ever
 * appears nested inside a `<form>`. Fails loudly (rather than defaulting)
 * if no enclosing `<form` is found at all -- an action/formaction attribute
 * outside any form is a scan bug, not a valid case to silently skip. */
function resolveEnclosingFormMethod(file: string, text: string, index: number): "GET" | "POST" {
  const formIdx = text.lastIndexOf("<form", index);
  if (formIdx === -1) {
    throw new Error(
      `${relative(REPO_ROOT, file)}: found an action/formaction attribute with no enclosing <form -- the scan's ` +
        "backward search assumption is broken for this file.",
    );
  }
  // The first '>' after `<form` is that opening tag's own close -- for a
  // plain `action` on the <form> itself, `index` falls BEFORE it (the
  // attribute is inside the tag); for a `formaction` on a nested <button>,
  // `index` falls AFTER it (the button comes later, once the form's
  // opening tag has already closed). Both orderings are legitimate; only
  // "no '>' at all" is a broken assumption.
  const tagEnd = text.indexOf(">", formIdx);
  if (tagEnd === -1) {
    throw new Error(
      `${relative(REPO_ROOT, file)}: could not find the closing '>' of the <form tag starting at index ${formIdx}.`,
    );
  }
  const tagText = text.slice(formIdx, tagEnd);
  const methodMatch = /\bmethod\s*=\s*"([^"]*)"|\bmethod\s*=\s*'([^']*)'/i.exec(tagText);
  const methodVal = (methodMatch ? (methodMatch[1] ?? methodMatch[2] ?? "") : "get").trim().toLowerCase();
  return methodVal === "post" ? "POST" : "GET";
}

// Matches `action="..."` / `action='...'` / `action={\`...\`}` and their
// `formaction` twin, using a negative lookbehind on a preceding letter so
// "formaction=" is never also double-counted as a bare "action=" hit (the
// latter is a literal substring of the former).
const ACTION_RE =
  /(?<![A-Za-z])(form)?action="([^"]*)"|(?<![A-Za-z])(form)?action='([^']*)'|(?<![A-Za-z])(form)?action=\{`([^`]*)`\}/g;

function collectActions(file: string, text: string): ActionHit[] {
  const hits: ActionHit[] = [];
  let m: RegExpExecArray | null;
  ACTION_RE.lastIndex = 0;
  while ((m = ACTION_RE.exec(text))) {
    if (isInsideLineComment(text, m.index)) continue;
    const isFormAttr = m[1] !== undefined || m[3] !== undefined || m[5] !== undefined;
    const isTemplate = m[6] !== undefined;
    const raw = m[2] ?? m[4] ?? m[6] ?? "";
    const line = findLine(text, m.index);
    const attr: "action" | "formaction" = isFormAttr ? "formaction" : "action";
    const method = resolveEnclosingFormMethod(file, text, m.index);
    if (!isTemplate) {
      const pathPart = raw.split(/[?#]/)[0]!;
      hits.push({ file, line, raw, pathPart, partial: false, method, attr });
      continue;
    }
    const dollarIdx = raw.indexOf("${");
    const staticPrefix = dollarIdx === -1 ? raw : raw.slice(0, dollarIdx);
    const qIdx = staticPrefix.search(/[?#]/);
    if (qIdx !== -1) {
      hits.push({ file, line, raw, pathPart: staticPrefix.slice(0, qIdx), partial: false, method, attr });
    } else {
      hits.push({ file, line, raw, pathPart: staticPrefix, partial: dollarIdx !== -1, method, attr });
    }
  }
  return hits;
}

const allActions: ActionHit[] = sourceFiles.flatMap((f) => collectActions(f, readFileSync(f, "utf-8")));

// ---------------------------------------------------------------------------
// Allowlist: legitimate non-route targets, each with a reason.
// ---------------------------------------------------------------------------

interface AllowRule {
  test: (literal: string) => boolean;
  reason: string;
}

const ALLOW_RULES: AllowRule[] = [
  {
    test: (l) => /^https?:\/\//.test(l),
    reason: "External URL -- not a route this app serves.",
  },
  {
    test: (l) => l.startsWith("mailto:"),
    reason: "mailto: link -- opens the visitor's mail client, not a route.",
  },
  {
    test: (l) => l.startsWith("#"),
    reason: "In-page anchor (same-document scroll target), not a navigable route.",
  },
  {
    test: (l) => l === "",
    reason:
      "Whole href is a single interpolation with no static prefix (e.g. href={`${basePath}...`}) -- there is no " +
      "literal text left to check once the leading `${...}` is stripped.",
  },
  {
    test: (l) => /^\$\{[^}]*\}$/.test(l),
    reason:
      'Whole href value is one JS interpolation expression written with a plain HTML `href="..."` attribute ' +
      "quote nested INSIDE an outer JS template literal (e.g. src/routes/public/submit.tsx's mailer HTML body: " +
      "`<a href=\"${safeClaimUrl}\">` -- this is hand-built HTML text, not JSX, so the double-quote regex sees it " +
      'as a plain string and captures the raw "${safeClaimUrl}" token). safeClaimUrl there is an already-built ' +
      "absolute claim URL (origin + claimPath), not a route pattern this scan can resolve statically.",
  },
];

function isAllowlisted(literal: string): AllowRule | undefined {
  return ALLOW_RULES.find((rule) => rule.test(literal));
}

/** Does some pattern in `patterns` start with exactly these literal segments
 * and then continue with at least one more segment (to be filled by the
 * interpolation this href/action's static prefix stopped short of)? */
function someRegisteredPatternStartsWith(completeSegs: string[], patterns: string[] = registeredPatterns): boolean {
  return patterns.some((p) => {
    const patternSegs = segmentsOf(p);
    if (patternSegs.length <= completeSegs.length) return false;
    for (let i = 0; i < completeSegs.length; i++) {
      if (patternSegs[i] !== completeSegs[i]) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe("server-rendered hrefs land on a registered route (DEC-914 amendment, wave 16)", () => {
  it("parsed at least the expected floor of hrefs and route patterns (else the scan silently passed vacuously)", () => {
    expect(allHrefs.length).toBeGreaterThanOrEqual(40);
    expect(registeredPatterns.length).toBeGreaterThanOrEqual(30);
  });

  it("every literal internal href resolves to a registered route pattern (or is allowlisted with a reason)", () => {
    const failures: string[] = [];
    for (const hit of allHrefs) {
      if (!hit.pathPart.startsWith("/")) {
        if (!isAllowlisted(hit.pathPart) && hit.pathPart !== "") {
          // Non-"/" internal-looking literal that isn't external/mailto/anchor/empty
          // (shouldn't happen given ALLOW_RULES above, but fail loudly rather than
          // silently skip an href this scan doesn't understand).
          failures.push(
            `${relative(REPO_ROOT, hit.file)}:${hit.line}: href literal "${hit.raw}" is neither an internal ` +
              `path nor allowlisted -- extend ALLOW_RULES with a reason or fix the href.`,
          );
        }
        continue;
      }
      const matched = hit.partial
        ? someRegisteredPatternStartsWith(segmentsOf(hit.pathPart))
        : registeredPatterns.some((p) => patternMatches(segmentsOf(p), segmentsOf(hit.pathPart)));
      if (!matched) {
        failures.push(
          `${relative(REPO_ROOT, hit.file)}:${hit.line}: href="${hit.raw}" (path "${hit.pathPart}"` +
            `${hit.partial ? ", partial -- more path text follows an interpolation" : ""}) does not resolve to ` +
            `any registered route pattern.`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `${failures.length} server-rendered href(s) don't resolve to a registered route -- a visitor following ` +
          `one gets a 404 with no nav memory to recover with:\n${failures.join("\n")}`,
      );
    }
  });
});

describe("server-rendered form actions land on a registered route for their own method (DEC-914 amendment, wave 17)", () => {
  it("parsed at least the expected floor of action/formaction attributes and POST route patterns", () => {
    expect(allActions.length).toBeGreaterThanOrEqual(15);
    expect(registeredPostPatterns.length).toBeGreaterThanOrEqual(5);
  });

  it("every literal internal action/formaction resolves to a registered route pattern for its form's method (or is allowlisted)", () => {
    const failures: string[] = [];
    for (const hit of allActions) {
      if (!hit.pathPart.startsWith("/")) {
        if (!isAllowlisted(hit.pathPart) && hit.pathPart !== "") {
          failures.push(
            `${relative(REPO_ROOT, hit.file)}:${hit.line}: ${hit.attr}="${hit.raw}" (method ${hit.method}) is ` +
              `neither an internal path nor allowlisted -- extend ALLOW_RULES with a reason or fix the ${hit.attr}.`,
          );
        }
        continue;
      }
      const patterns = hit.method === "POST" ? registeredPostPatterns : registeredPatterns;
      const matched = hit.partial
        ? someRegisteredPatternStartsWith(segmentsOf(hit.pathPart), patterns)
        : patterns.some((p) => patternMatches(segmentsOf(p), segmentsOf(hit.pathPart)));
      if (!matched) {
        failures.push(
          `${relative(REPO_ROOT, hit.file)}:${hit.line}: ${hit.attr}="${hit.raw}" (path "${hit.pathPart}", method ` +
            `${hit.method}${hit.partial ? ", partial -- more path text follows an interpolation" : ""}) does not ` +
            `resolve to any registered ${hit.method} route pattern.`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `${failures.length} server-rendered action/formaction(s) don't resolve to a registered route for their ` +
          `form's method -- a visitor submitting one loses the data they typed:\n${failures.join("\n")}`,
      );
    }
  });
});
