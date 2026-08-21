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
// POPULATION (DEC-180): every `*.test.ts` / `*.test.tsx` file under test/
// and app/src/, discovered by readdirSync -- never a hand-listed file list.
// This scan file excludes only itself (a file cannot meaningfully judge its
// own source against a detector built to describe OTHER files' patterns;
// every other candidate, including its sibling helper's own unit-test file,
// is measured for real).

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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

const CANDIDATE_FILES = [...findTestFiles(TEST_DIR), ...findTestFiles(APP_SRC_DIR)].sort();

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

const LOCAL_STRIPPER_OFFENDERS: Offender[] = candidateContents
  .filter((f) => isLocalStripperOffender(f.content))
  .map((f) => ({ file: f.path }));

describe("comment-blind CSS assertion instrument (DEC-374 amendment)", () => {
  it("parsed a non-trivial population of *.test.ts(x) files (walk floor sanity)", () => {
    expect(CANDIDATE_FILES.length).toBeGreaterThanOrEqual(300);
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
});
