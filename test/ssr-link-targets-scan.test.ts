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
const ROUTES_DIR = join(REPO_ROOT, "src", "routes");
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

const sourceFiles = glob(ROUTES_DIR, [".tsx"]).filter((f) => !f.includes(".test."));

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

/** Does some registered route pattern's path start with exactly these
 * literal segments and then continue with at least one more segment (to be
 * filled by the interpolation this href's static prefix stopped short of)? */
function someRegisteredPatternStartsWith(completeSegs: string[]): boolean {
  return registeredPatterns.some((p) => {
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
