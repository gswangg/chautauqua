// Comment-blind CSS-assertion instrument (DEC-374 amendment, wave v12m-w8
// task w8-ef).
//
// WHY THIS EXISTS: four gates on main read their own explanatory comments as
// product -- a raw `.not.toMatch(...)` (or equivalent regex) applied
// directly to an un-stripped CSS source constant treats a comment MENTIONING
// a forbidden token as if the token were live product, and turns a passing
// negative assertion red for a defect that does not exist in the tree. The
// mirror failure -- a comment QUOTING a required declaration making a
// POSITIVE assertion pass VACUOUSLY -- is the same bug in the dangerous
// direction, and no red run will ever surface it on its own; the only fix
// is to strip comments before matching, every time.
//
// THIS INSTRUMENT does not repair a single offender -- it COUNTS them, in
// two offender classes, as a two-sided ratchet (DEC-808): the ceiling may
// only fall, and a companion assertion fails loudly if the measured count
// drops without the ceiling being lowered to match (a stale ceiling
// licenses stagnation).
//
//   Class 1 (COMMENT_BLIND_CSS_ASSERTION_CEILING): a test file that (a)
//   obtains a CSS source -- reads a `.css` file, or imports/derives a
//   `*_CSS` / `*_BLOCK` constant -- and (b) applies `toMatch` / `.match(` /
//   `.exec(` to that source, with (c) no comment-stripping call anywhere in
//   the file.
//
//   Class 2 (LOCAL_CSS_COMMENT_STRIPPER_CEILING, DEC-613): a test file that
//   declares its own local `stripComments`-shaped function instead of
//   importing the shared, string-aware ./helpers/strip-css-comments.ts.
//
// POPULATION (DEC-180, widened wave v12m-w29 task w29-h, DEC-613): a suffix
// is not a population. The original population was every `*.test.ts` /
// `*.test.tsx` file under test/ and app/src/, discovered by readdirSync --
// but a private comment-stripper hiding in a NON-test module a test file
// imports (app/src/test-utils/phoneBlock.ts's own local `stripCssComments`,
// caught this wave) was structurally invisible to that population no matter
// how many files it was imported by: its filename lacks `.test.`, full stop.
// The population is now the TEST-FILE set (unchanged, found by the same
// readdirSync walk) UNION every module under test/** or app/src/** that is
// reachable, by following static relative `import`/`export...from` specifiers
// (never a bare/external specifier, and never a specifier resolving outside
// those two roots), from any test file -- transitively, so a helper that
// itself imports another helper still pulls the second one in. This mirrors
// test/module-reachability.scan.test.ts's own walker (DEC-518), pointed the
// other direction: that scan walks FROM shipped entry points to prove every
// module is reachable; this one walks FROM every test file to prove every
// module a test can reach is graded, not just the ones spelled with `.test.`
// in their name. This scan file excludes only itself (a file cannot
// meaningfully judge its own source against a detector built to describe
// OTHER files' patterns; every other candidate, including its sibling
// helper's own unit-test file, is measured for real).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMENT_BLIND_CSS_ASSERTION_CEILING } from "../app/src/comment-blind-css-assertion-scan/ceiling";
import { LOCAL_CSS_COMMENT_STRIPPER_CEILING } from "../app/src/comment-blind-css-assertion-scan/local-stripper-ceiling";

const REPO_ROOT = join(__dirname, "..");
const TEST_DIR = join(REPO_ROOT, "test");
const APP_SRC_DIR = join(REPO_ROOT, "app", "src");
const SELF = __filename;

function findTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.test\.tsx?$/.test(entry.name)) continue;
    const abs = join(entry.parentPath, entry.name);
    if (abs === SELF) continue;
    out.push(abs);
  }
  return out;
}

const TEST_FILES = [...findTestFiles(TEST_DIR), ...findTestFiles(APP_SRC_DIR)].sort();

// ---------------------------------------------------------------------------
// Widened half: every test/** / app/src/** module reachable, by static
// relative import, from any test file -- test/module-reachability.scan.
// test.ts's walker shape, pointed from test files as roots instead of
// shipped entry points.
// ---------------------------------------------------------------------------

const IMPORT_RESOLVE_SUFFIXES = [".ts", ".tsx"];

function resolveRelativeSpecifier(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined; // bare/external specifier -- not a repo module
  const base = resolve(dirname(fromFile), spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const suffix of IMPORT_RESOLVE_SUFFIXES) {
    if (existsSync(base + suffix)) return base + suffix;
  }
  for (const suffix of IMPORT_RESOLVE_SUFFIXES) {
    const indexPath = join(base, `index${suffix}`);
    if (existsSync(indexPath)) return indexPath;
  }
  return undefined;
}

// `import type`/`export type` erases at build time and confers no real
// import-graph reachability -- same exclusion module-reachability.scan.test.ts
// applies, for the same reason (a module reached only that way carries no
// runtime code to be comment-blind about).
function stripTypeOnlyImportExport(source: string): string {
  return source
    .replace(/import\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/import\s+type\s+[A-Za-z_$][\w$]*\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/export\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "");
}

const IMPORT_FROM_RE = /import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const EXPORT_FROM_RE = /export\s+[^;]*?from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

function extractRelativeSpecifiers(source: string): string[] {
  const valueOnly = stripTypeOnlyImportExport(source);
  const specs: string[] = [];
  for (const re of [IMPORT_FROM_RE, EXPORT_FROM_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(valueOnly))) {
      if (m[1]) specs.push(m[1]);
    }
  }
  return specs;
}

function underTestOrAppSrc(abs: string): boolean {
  return abs.startsWith(TEST_DIR + "/") || abs.startsWith(APP_SRC_DIR + "/");
}

/** Every test/** / app/src/** module reachable by static relative import from
 * any test file, transitively, excluding the test files themselves (already
 * in TEST_FILES) and anything outside test/ or app/src/ (e.g. src/**, which
 * this instrument's population has never covered and this task doesn't
 * widen it to). */
function walkImportedModules(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf-8");
    for (const spec of extractRelativeSpecifiers(source)) {
      const resolved = resolveRelativeSpecifier(file, spec);
      if (!resolved || !underTestOrAppSrc(resolved)) continue;
      stack.push(resolved);
    }
  }
  return seen;
}

const REACHED_FROM_TESTS = walkImportedModules(TEST_FILES);
const TEST_FILE_SET = new Set(TEST_FILES);
const IMPORTED_MODULES = [...REACHED_FROM_TESTS]
  .filter((abs) => !TEST_FILE_SET.has(abs) && abs !== SELF)
  .sort();

const CANDIDATE_FILES = [...TEST_FILES, ...IMPORTED_MODULES];

// ---------------------------------------------------------------------------
// Class 1 detection: a CSS-source-holding IDENTIFIER (a `*_CSS` / `*_PHONE_
// BLOCK` constant, or a variable directly assigned from `readFileSync(...
// '.css')`) that is fed DIRECTLY into a `toMatch`/`not.toMatch` assertion in
// the SAME file, with no comment-stripping call anywhere in that file.
//
// Deliberately identifier-linked rather than "file merely CONTAINS both a
// `_CSS` name and a `toMatch(` call somewhere" -- a first pass at that
// coarser shape produced 100+ hits by picking up files where the two
// features are unrelated (a `_CSS` constant used only for a class-list
// assertion, a `toMatch` applied to page copy in a file that also happens
// to declare an unrelated `*_BLOCK` constant). Requiring `expect(<name>...)`
// to flow into `toMatch(` within the same expression is what actually
// isolates "this test matches raw CSS text", matching this task's own
// measured neighbourhood (31 offenders) far more closely than the coarser
// shape did (115).
// ---------------------------------------------------------------------------

const CSS_SOURCE_IDENTIFIER_RE = /\b([A-Z][A-Z0-9_]*(?:_CSS|_PHONE_BLOCK))\b/g;
const CSS_FILE_VAR_RE = /(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*readFileSync\([^)]*\.css['"`]/g;
const STRIP_CALL_RE = /\bstrip[A-Za-z]*[Cc]omments?\(/;

function cssSourceIdentifiers(content: string): Set<string> {
  const names = new Set<string>();
  for (const m of content.matchAll(CSS_SOURCE_IDENTIFIER_RE)) names.add(m[1] as string);
  for (const m of content.matchAll(CSS_FILE_VAR_RE)) names.add(m[1] as string);
  return names;
}

/** Does `expect(<name> ...)` flow into a `.toMatch(`/`.not.toMatch(` call
 * within a short window (the same expect-chain), for the given identifier? */
function matchesDirectly(content: string, name: string): boolean {
  const re = new RegExp(`expect\\(\\s*${name}\\b[^)]*\\)[\\s\\S]{0,120}?\\.(?:not\\.)?toMatch\\(`);
  return re.test(content);
}

export function obtainsCssSource(content: string): boolean {
  return cssSourceIdentifiers(content).size > 0;
}

export function appliesMatchAssertion(content: string): boolean {
  const names = cssSourceIdentifiers(content);
  for (const name of names) {
    if (matchesDirectly(content, name)) return true;
  }
  return false;
}

export function hasStrippingStep(content: string): boolean {
  return STRIP_CALL_RE.test(content);
}

export function isCommentBlindCssAssertionCandidate(content: string): boolean {
  return appliesMatchAssertion(content);
}

export function isCommentBlindCssAssertionOffender(content: string): boolean {
  return isCommentBlindCssAssertionCandidate(content) && !hasStrippingStep(content);
}

// ---------------------------------------------------------------------------
// Class 2 detection (DEC-613): declares its own local `strip[Css]Comments`
// -shaped function instead of importing the shared, string-aware
// test/helpers/strip-css-comments.ts. Deliberately NOT restricted to files
// that also touch CSS specifically -- the four copies this task's own
// description names include test/served-content-type-single-source.
// scan.test.ts, which strips TS-route-file comments, not CSS; the trap
// DEC-613 names is the VOCABULARY (a hand-derived comment-stripping
// algorithm) being re-implemented per file, independent of which source
// language each copy happens to be pointed at.
// ---------------------------------------------------------------------------

const LOCAL_STRIPPER_DECL_RE = /(?:export\s+)?(?:function|const)\s+strip(?:Css|CSS)?Comments?\s*[=(]/;
const SHARED_IMPORT_RE = /from\s+['"][^'"]*strip-css-comments['"]/;

export function declaresLocalStripper(content: string): boolean {
  return LOCAL_STRIPPER_DECL_RE.test(content);
}

export function importsSharedStripper(content: string): boolean {
  return SHARED_IMPORT_RE.test(content);
}

export function isLocalStripperOffender(content: string): boolean {
  return declaresLocalStripper(content) && !importsSharedStripper(content);
}

// ---------------------------------------------------------------------------
// Local-stripper CARVE-OUTS (DEC-613 wave-29, task w29-h): the population
// widening above surfaced non-test modules that declare their own local
// `strip[Css]Comments`-shaped function for a real reason -- each entry's
// `reason` names the CAPABILITY the shared test/helpers/strip-css-comments.ts
// genuinely lacks, never a branch/wave/schedule (DEC-099, checked by
// test/exemption-reason-is-a-principle.scan.test.ts). A carved-out file is
// EXCLUDED from LOCAL_STRIPPER_OFFENDERS below, not merely narrated in a
// history comment, so the ceiling reflects only genuinely un-migrated copies.
// ---------------------------------------------------------------------------

const LOCAL_STRIPPER_CARVE_OUTS: Record<string, { reason: string }> = {
  "app/src/phone-tap-target-scan/core.ts": {
    reason:
      "stripTsxComments recognises `//` line comments over TSX source, a capability the shared, CSS-only " +
      "test/helpers/strip-css-comments.ts does not have (it strips only `/* */` block comments); the sibling " +
      "stripComments is the block-comment-only building block stripTsxComments composes over, not an " +
      "independent copy of the shared CSS vocabulary.",
  },
  "test/frame-source-corpus.ts": {
    reason:
      "recognises `//` line comments over general TypeScript source in addition to `/* */` block comments, a " +
      "capability the shared, CSS-only test/helpers/strip-css-comments.ts does not have.",
  },
  "test/frame-caption-ledger/match.ts": {
    reason:
      "recognises `//` line comments over general TypeScript source in addition to `/* */` block comments, a " +
      "capability the shared, CSS-only test/helpers/strip-css-comments.ts does not have; its own header notes it " +
      "shares this exact scanning shape with test/frame-source-corpus.ts's stripComments deliberately, as two " +
      "sites needing the same non-CSS capability, not two accidental copies.",
  },
};

// test/source-comments.ts (recognises TS `//` line comments, a real
// capability the shared CSS-only stripper lacks) and test/helpers/
// strip-template-literals.ts (also blanks template-literal bodies) both
// declare functions named `stripSourceComments` / `stripCommentsAndTemplate
// Literals` -- neither matches LOCAL_STRIPPER_DECL_RE's `strip(?:Css|CSS)?
// Comments?` naming shape (the detector is name-based, DEC-374's original
// design), so neither is a live offender under this instrument and neither
// needs a carve-out entry: there is nothing here for LOCAL_STRIPPER_OFFENDERS
// to exclude. Named for completeness against this task's own brief, which
// listed both as modules "the widening will surface" -- verified NOT
// surfaced, by direct regex test, rather than assumed.

// ---------------------------------------------------------------------------
// Real-tree measurement
// ---------------------------------------------------------------------------

interface Offender {
  file: string;
}

const candidateContents = CANDIDATE_FILES.map((abs) => ({
  path: relative(REPO_ROOT, abs),
  content: readFileSync(abs, "utf-8"),
}));

const CANDIDATES: Offender[] = candidateContents
  .filter((f) => isCommentBlindCssAssertionCandidate(f.content))
  .map((f) => ({ file: f.path }));

const COMMENT_BLIND_OFFENDERS: Offender[] = candidateContents
  .filter((f) => isCommentBlindCssAssertionOffender(f.content))
  .map((f) => ({ file: f.path }));

// The shared, canonical stripper itself (test/helpers/strip-css-comments.ts)
// necessarily "declares a local stripComments-shaped function" -- it IS the
// declaration everyone else is supposed to import -- and by definition it
// never imports itself. This is the CANONICAL implementation, not a copy of
// it, so it is excluded from judgment here the same way this scan file
// excludes itself above; a stale/removed exclusion would surface loudly as
// a sudden, obviously-wrong self-offense the moment someone deletes it.
const SHARED_STRIPPER_REL = "test/helpers/strip-css-comments.ts";

const LOCAL_STRIPPER_OFFENDERS: Offender[] = candidateContents
  .filter(
    (f) =>
      f.path !== SHARED_STRIPPER_REL &&
      isLocalStripperOffender(f.content) &&
      !(f.path in LOCAL_STRIPPER_CARVE_OUTS),
  )
  .map((f) => ({ file: f.path }));

describe("comment-blind CSS assertion instrument (DEC-374 amendment)", () => {
  it("parsed a non-trivial population of *.test.ts(x) files (walk floor sanity)", () => {
    expect(TEST_FILES.length).toBeGreaterThanOrEqual(300);
  });

  // VACUOUS-POPULATION TRIPWIRE, widened half (DEC-613 wave-29, task
  // w29-h): the import-graph walk that discovers non-test modules imported
  // by test files must not have silently narrowed to matching nothing --
  // measured at this wave's landing (forced re-derivation, offender list
  // read back), the widened half sits comfortably in the hundreds. A count
  // near zero means the resolver has stopped following real edges, not that
  // test files have stopped importing helper modules.
  it("VACUOUS-POPULATION TRIPWIRE: the widened (imported-module) half of the population is in the neighbourhood measured at this wave's landing, never near zero", () => {
    expect(
      IMPORTED_MODULES.length,
      `Only ${IMPORTED_MODULES.length} non-test module(s) were found reachable by import from a test file -- ` +
        `this walker has likely narrowed to matching nothing (a resolver regression, a suffix restriction that's ` +
        `too tight, or a root boundary drawn too small). This wave's landing measured well over 100; re-derive ` +
        `the walk, don't trust a clean scan.`,
    ).toBeGreaterThanOrEqual(100);
  });

  // VACUOUS-POPULATION TRIPWIRE: a detector that has silently narrowed to
  // matching nothing must fail loudly, not report a suspiciously clean
  // zero. Wave w8-ef measured 31 files applying `.not.toMatch` (or
  // equivalent) directly to a raw CSS source constant -- this asserts the
  // CANDIDATE population (obtains-CSS-source AND applies-a-match-assertion,
  // before the stripping-step filter that separates offenders from
  // compliant files) stays in that neighbourhood.
  it("VACUOUS-POPULATION TRIPWIRE: the candidate population (CSS source + match assertion) is in the neighbourhood measured at DEC-374's landing, never near zero", () => {
    expect(
      CANDIDATES.length,
      `Only ${CANDIDATES.length} candidate file(s) obtain a CSS source and apply a match ` +
        `assertion to it -- this detector has likely narrowed to matching nothing. DEC-374's ` +
        `landing measured 31 offenders out of a comparable-or-larger candidate population; a ` +
        `count this low means re-derive the detection regexes, don't trust a clean scan.`,
    ).toBeGreaterThanOrEqual(15);
  });

  // Fabricated positive/negative controls through the FULL pipeline (both
  // offender classes), never just the standalone regex.
  it("positive control: a raw-match file with no stripping step is a class-1 offender", () => {
    const fixture = [
      "import { readFileSync } from 'node:fs';",
      "import { describe, expect, it } from 'vitest';",
      "const WIDGET_CSS = readFileSync('widget.css', 'utf-8');",
      "describe('widget', () => {",
      "  it('never declares !important', () => {",
      "    expect(WIDGET_CSS).not.toMatch(/!important/);",
      "  });",
      "});",
    ].join("\n");
    expect(isCommentBlindCssAssertionOffender(fixture)).toBe(true);
  });

  it("negative control: the same shape, but with a stripping call present, is NOT a class-1 offender", () => {
    const fixture = [
      "import { readFileSync } from 'node:fs';",
      "import { describe, expect, it } from 'vitest';",
      "import { stripCssComments } from './helpers/strip-css-comments';",
      "const WIDGET_CSS = stripCssComments(readFileSync('widget.css', 'utf-8'));",
      "describe('widget', () => {",
      "  it('never declares !important', () => {",
      "    expect(WIDGET_CSS).not.toMatch(/!important/);",
      "  });",
      "});",
    ].join("\n");
    expect(isCommentBlindCssAssertionOffender(fixture)).toBe(false);
    // it IS still a candidate (obtains a source and matches it) -- the
    // stripping step is what moves it out of the OFFENDER class, not out
    // of the candidate population.
    expect(isCommentBlindCssAssertionCandidate(fixture)).toBe(true);
  });

  it("negative control: a file that never applies a match assertion to its CSS source is not a candidate at all", () => {
    const fixture = [
      "const WIDGET_CSS = 'irrelevant';",
      "describe('widget', () => { it('exists', () => { expect(WIDGET_CSS.length).toBeGreaterThan(0); }); });",
    ].join("\n");
    expect(isCommentBlindCssAssertionCandidate(fixture)).toBe(false);
    expect(isCommentBlindCssAssertionOffender(fixture)).toBe(false);
  });

  it("positive control: a file declaring its own stripComments function without importing the shared helper is a class-2 offender", () => {
    const fixture = [
      "function stripComments(text) { return text.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''); }",
      "export const x = stripComments('abc');",
    ].join("\n");
    expect(isLocalStripperOffender(fixture)).toBe(true);
  });

  it("negative control: a file importing the shared stripper (even if it also happens to name a local variable similarly) is not a class-2 offender", () => {
    const fixture = [
      "import { stripCssComments } from './helpers/strip-css-comments';",
      "export const x = stripCssComments('abc');",
    ].join("\n");
    expect(isLocalStripperOffender(fixture)).toBe(false);
  });

  // -- Class 1 two-sided ratchet (DEC-808) ---------------------------------

  it(`comment-blind CSS-assertion offenders (${COMMENT_BLIND_OFFENDERS.length}) never exceed COMMENT_BLIND_CSS_ASSERTION_CEILING (${COMMENT_BLIND_CSS_ASSERTION_CEILING})`, () => {
    const detail = COMMENT_BLIND_OFFENDERS.map((o) => `  - ${o.file}`).join("\n");
    expect(
      COMMENT_BLIND_OFFENDERS.length,
      `comment-blind CSS-assertion offenders (${COMMENT_BLIND_OFFENDERS.length}) exceed ` +
        `COMMENT_BLIND_CSS_ASSERTION_CEILING (${COMMENT_BLIND_CSS_ASSERTION_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(COMMENT_BLIND_CSS_ASSERTION_CEILING);
  });

  it(`never falls below COMMENT_BLIND_CSS_ASSERTION_CEILING (${COMMENT_BLIND_CSS_ASSERTION_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (COMMENT_BLIND_OFFENDERS.length < COMMENT_BLIND_CSS_ASSERTION_CEILING) {
      throw new Error(
        `comment-blind CSS-assertion offenders (${COMMENT_BLIND_OFFENDERS.length}) fell below ` +
          `COMMENT_BLIND_CSS_ASSERTION_CEILING of ${COMMENT_BLIND_CSS_ASSERTION_CEILING}. This is the ` +
          `ratchet working: lower the ceiling in app/src/comment-blind-css-assertion-scan/ceiling.ts to match, ` +
          `replacing the line:\n` +
          `export const COMMENT_BLIND_CSS_ASSERTION_CEILING = ${COMMENT_BLIND_OFFENDERS.length};`,
      );
    }
    expect(COMMENT_BLIND_OFFENDERS.length).toBeGreaterThanOrEqual(COMMENT_BLIND_CSS_ASSERTION_CEILING);
  });

  // -- Class 2 two-sided ratchet (DEC-808/DEC-613) -------------------------

  it(`local CSS-comment-stripper offenders (${LOCAL_STRIPPER_OFFENDERS.length}) never exceed LOCAL_CSS_COMMENT_STRIPPER_CEILING (${LOCAL_CSS_COMMENT_STRIPPER_CEILING})`, () => {
    const detail = LOCAL_STRIPPER_OFFENDERS.map((o) => `  - ${o.file}`).join("\n");
    expect(
      LOCAL_STRIPPER_OFFENDERS.length,
      `local CSS-comment-stripper offenders (${LOCAL_STRIPPER_OFFENDERS.length}) exceed ` +
        `LOCAL_CSS_COMMENT_STRIPPER_CEILING (${LOCAL_CSS_COMMENT_STRIPPER_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(LOCAL_CSS_COMMENT_STRIPPER_CEILING);
  });

  it(`never falls below LOCAL_CSS_COMMENT_STRIPPER_CEILING (${LOCAL_CSS_COMMENT_STRIPPER_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (LOCAL_STRIPPER_OFFENDERS.length < LOCAL_CSS_COMMENT_STRIPPER_CEILING) {
      throw new Error(
        `local CSS-comment-stripper offenders (${LOCAL_STRIPPER_OFFENDERS.length}) fell below ` +
          `LOCAL_CSS_COMMENT_STRIPPER_CEILING of ${LOCAL_CSS_COMMENT_STRIPPER_CEILING}. This is the ratchet ` +
          `working: lower the ceiling in app/src/comment-blind-css-assertion-scan/local-stripper-ceiling.ts to ` +
          `match, replacing the line:\n` +
          `export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = ${LOCAL_STRIPPER_OFFENDERS.length};`,
      );
    }
    expect(LOCAL_STRIPPER_OFFENDERS.length).toBeGreaterThanOrEqual(LOCAL_CSS_COMMENT_STRIPPER_CEILING);
  });

  // -- Carve-out ledger exactness (DEC-613 wave-29, task w29-h) -----------
  // Every carve-out must genuinely be a local-stripper-shaped file (else
  // it's a stale/unnecessary entry hiding a real offender's exclusion), and
  // must actually be in the walked population (else it's exempting nothing
  // and can't be trusted to mean what it says).

  it("every LOCAL_STRIPPER_CARVE_OUTS entry is a real, currently-in-population, local-stripper-shaped file", () => {
    const candidateByPath = new Map(candidateContents.map((f) => [f.path, f.content]));
    for (const [path, { reason }] of Object.entries(LOCAL_STRIPPER_CARVE_OUTS)) {
      const content = candidateByPath.get(path);
      expect(content, `LOCAL_STRIPPER_CARVE_OUTS names ${path}, which is not in the walked population`).toBeDefined();
      expect(
        declaresLocalStripper(content as string),
        `LOCAL_STRIPPER_CARVE_OUTS names ${path}, which no longer declares a local strip[Css]Comments-shaped ` +
          `function -- this carve-out is stale, remove it`,
      ).toBe(true);
      expect(reason.length, `LOCAL_STRIPPER_CARVE_OUTS entry for ${path} has an empty reason`).toBeGreaterThan(0);
    }
  });
});
