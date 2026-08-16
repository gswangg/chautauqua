// DEC-817 (wave-53 amendment) closes the declared-target hole on the
// server-rendered surfaces (public CFP, speaker portal, auth/account) the
// same way task-w53-a closes it for the admin SPA. Nothing enumerated this
// half before: test/ssr-form-csrf.scan.test.ts owns the CSRF-token half of
// every rendered form only, and test/security-invariants.test.ts owns the
// route-registration half only -- neither checks that a rendered
// action/formaction/href actually resolves to a registered route.
//
// Two populations, each resolved against test/helpers/registered-routes.ts's
// resolveRegisteredRoute (the ONE resolver shared with task-w53-a/-d, per
// DEC-817's wave-53 amendment -- never re-implemented here):
//
// 1. MUTATION TARGETS: every `<form method="post">` `action=` and every
//    `formaction=` attribute in src/**/*.tsx, checked as POST.
// 2. NAVIGATION TARGETS: every internal `href` string/template literal
//    starting with "/" in src/routes/**/*.tsx, checked as GET. Targets that
//    are legitimately not Hono GET registrations are named in
//    EXEMPT_TARGETS with a file:line + reason -- enumerate and exempt, never
//    silently skip.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRegisteredRoute } from "./helpers/registered-routes";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SRC_DIR = join(REPO_ROOT, "src");
const ROUTES_DIR = join(SRC_DIR, "routes");

/** Recursively lists every .tsx file under `dir`, excluding *.test.tsx. */
function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** Turns a template literal `${...}` interpolation span into a resolvable
 * ":param" placeholder, matching resolveRegisteredRoute's own normalization
 * (kept here too so a raw target can be shown in failure messages before
 * resolution). */
function normalizeTarget(raw: string): string {
  return raw.replace(/\$\{[^}]*\}/g, ":param");
}

// ---------------------------------------------------------------------------
// Population 1: MUTATION TARGETS (<form method="post"> action, formaction)
// ---------------------------------------------------------------------------

interface MutationTarget {
  file: string;
  line: number;
  target: string;
}

/** Finds every `<form ...>` opening tag in `text` (reuses the tag-finding
 * shape of test/ssr-form-csrf.scan.test.ts:57-60 -- that file is never
 * edited here). */
function findFormOpenTags(text: string): { tagText: string; startIndex: number }[] {
  const tags: { tagText: string; startIndex: number }[] = [];
  const re = /<form\b[\s\S]*?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tags.push({ tagText: m[0], startIndex: m.index });
  }
  return tags;
}

function extractAttr(tagText: string, attr: string): string | null {
  const literal = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, "i").exec(tagText);
  if (literal) return literal[1]!;
  const template = new RegExp(`\\b${attr}\\s*=\\s*\\{\\s*\`([^\`]*)\``, "i").exec(tagText);
  if (template) return template[1]!;
  return null;
}

function collectMutationTargets(): MutationTarget[] {
  const targets: MutationTarget[] = [];
  for (const file of listTsxFiles(SRC_DIR)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(REPO_ROOT, file);

    for (const tag of findFormOpenTags(text)) {
      const method = extractAttr(tag.tagText, "method");
      if (method?.toLowerCase() !== "post") continue;
      const action = extractAttr(tag.tagText, "action");
      if (action === null) continue; // no action attribute: posts to current URL, no static target to check
      targets.push({ file: rel, line: lineOf(text, tag.startIndex), target: normalizeTarget(action) });
    }

    // formaction=... on any element (e.g. a submit button overriding its
    // owning form's action), anywhere in the file.
    const formactionRe = /\bformaction\s*=\s*(?:["']([^"']*)["']|\{\s*`([^`]*)`)/g;
    let m: RegExpExecArray | null;
    while ((m = formactionRe.exec(text)) !== null) {
      const value = m[1] ?? m[2]!;
      targets.push({ file: rel, line: lineOf(text, m.index), target: normalizeTarget(value) });
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Population 2: NAVIGATION TARGETS (internal href in src/routes/**/*.tsx)
// ---------------------------------------------------------------------------

interface NavTarget {
  file: string;
  line: number;
  target: string;
}

function collectNavTargets(): NavTarget[] {
  const targets: NavTarget[] = [];
  for (const file of listTsxFiles(ROUTES_DIR)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(REPO_ROOT, file);
    const hrefRe = /href\s*=\s*(?:"(\/[^"]*)"|`(\/[^`]*)`)/g;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(text)) !== null) {
      const value = (m[1] ?? m[2])!;
      targets.push({ file: rel, line: lineOf(text, m.index), target: normalizeTarget(value) });
    }
  }
  return targets;
}

/** Every entry names the exact file:line it exempts and a written reason --
 * enumerate and exempt, never silently skip. Checked at runtime against the
 * live scan below so a stale entry (fixed, removed, or moved) is caught. */
const EXEMPT_TARGETS: Array<{ file: string; line: number; reason: string }> = [];

describe("ssr-declared-target.scan: every rendered POST form/formaction target resolves to a registered route", () => {
  const targets = collectMutationTargets();

  it("population is non-trivial (tripwire against a scan regression)", () => {
    expect(targets.length).toBeGreaterThanOrEqual(10);
  });

  it("negative control: a synthetic bogus path does not resolve", () => {
    expect(resolveRegisteredRoute("POST", "/this/path/does/not/exist/anywhere")).toBeUndefined();
  });

  for (const t of targets) {
    it(`${t.file}:${t.line} POST ${t.target} resolves to a registered route`, () => {
      const resolved = resolveRegisteredRoute("POST", t.target);
      expect(
        resolved,
        `${t.file}:${t.line} declares a POST target "${t.target}" that no registered route serves -- ` +
          `either fix the form/formaction, or the route needs to be built.`,
      ).toBeDefined();
    });
  }
});

describe("ssr-declared-target.scan: every internal href in src/routes/**/*.tsx resolves to a registered GET route", () => {
  const targets = collectNavTargets();

  it("population is non-trivial (tripwire against a scan regression)", () => {
    expect(targets.length).toBeGreaterThanOrEqual(20);
  });

  it("every EXEMPT_TARGETS entry states a reason and matches a real target", () => {
    for (const entry of EXEMPT_TARGETS) {
      expect(entry.reason.length).toBeGreaterThan(20);
      const stillPresent = targets.some((t) => t.file === entry.file && t.line === entry.line);
      expect(
        stillPresent,
        `${entry.file}:${entry.line} is listed in EXEMPT_TARGETS but no matching href was found -- ` +
          `stale entry, delete this line.`,
      ).toBe(true);
    }
  });

  for (const t of targets) {
    const exempt = EXEMPT_TARGETS.find((e) => e.file === t.file && e.line === t.line);
    if (exempt) {
      it(`${t.file}:${t.line} href ${t.target} is exempt: ${exempt.reason}`, () => {
        expect(exempt.reason.length).toBeGreaterThan(0);
      });
      continue;
    }
    it(`${t.file}:${t.line} GET ${t.target} resolves to a registered route`, () => {
      const resolved = resolveRegisteredRoute("GET", t.target);
      expect(
        resolved,
        `${t.file}:${t.line} links to "${t.target}" which no registered GET route serves -- ` +
          `either fix the href, or add a reasoned EXEMPT_TARGETS entry in ` +
          `test/ssr-declared-target.scan.test.ts if this is legitimately not a Hono GET registration.`,
      ).toBeDefined();
    });
  }
});
