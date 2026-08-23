// Unstripped-source-regex family instrument (DEC-374 wave-39, task w39-f).
//
// WHY THIS EXISTS: this exact defect -- a scan-shaped file reads source off
// disk and applies a content match to it WITHOUT ever stripping comments
// first, so a comment merely QUOTING a pattern is graded as though it were
// live code -- has now silently disabled three separate guards, each fixed
// at its own site with no instrument ever enumerating the FAMILY:
//   1. A CSS comment quoting a frame literal was graded as a violation
//      (comment-blind-css-assertion-scan's own origin story, DEC-374).
//   2. Frame prose quoting product copy was matched as product copy.
//   3. test/test-tiers.test.ts's `importedModules()` applied
//      IMPORT_SPECIFIER_RE to raw, un-stripped source -- so
//      test/render-sweep-public-gate.test.ts's own header sentence ("must
//      never import playwright") read as a real import, and the DEC-727
//      tier predicate had been enforcing nothing for an unknown number of
//      waves. REPAIRED by v12m-w38-c (landed): test/test-tiers.test.ts now
//      strips comments with `stripTsComments` before matching, and this
//      row's own pin below was retired to its inverse (DEC-808 wave-45,
//      task w45-c) to keep asserting a live fact about the tree rather than
//      a stale one.
//
// POPULATION (walked, never hand-listed): every `.ts`/`.tsx` file under
// test/** and app/src/** (readdirSync recursive, this file excludes only
// itself) that:
//   (a) READS SOURCE OFF DISK -- calls `readFileSync(` or `readdirSync(`,
//       from which this scan derives every source-holding
//       variable/property name via `const X = readFileSync(...)`,
//       `let X = readFileSync(...)` or the `{ ..., X: readFileSync(...) }`
//       object-literal-field idiom (the SourceFile{content} shape several
//       existing scans in this tree already use);
//   (b) APPLIES A CONTENT MATCH to that SAME variable -- `X.test(`,
//       `X.exec(`, `X.match(`, `X.replace(`, `X.includes(` or `X.indexOf(`
//       -- new RegExp(...) constructed then applied the same way is the
//       same shape (the regex object itself carries no comment-stripping
//       obligation independent of the text it is run against);
//   (c) with NO comment-stripping step anywhere in the file: a named
//       `strip[A-Za-z]*[Cc]omments?(` call (matches
//       comment-blind-css-assertion-scan's own STRIP_CALL_RE), an import
//       from test/helpers/strip-css-comments.ts, OR an inline
//       comment-shaped `.replace(/\/\*[\s\S]*?\*\//...)` /
//       `.replace(/\/\/[^\n]*/...)` regex -- this codebase's own
//       real, on-tree, naive-but-genuine local-stripper idiom (e.g.
//       app/src/pages/agenda/agenda-card-geometry.test.ts's
//       `CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '')`) --
//       a `.replace(` call using ONE of those two comment-shaped regexes
//       does not itself count as a risky content-match call: it is the
//       stripping step, not a thing being stripped.
//
// A file satisfying (a)+(b) but not (c) is an OFFENDER.
//
// This mirrors comment-blind-css-assertion-scan's own hard-won discipline
// (identifier-linked matching, not "file merely contains both a read and a
// match somewhere unrelated") but generalises across the whole family --
// not just CSS `toMatch` assertions -- because instance 3 above is neither
// CSS nor a vitest `toMatch` call.
//
// NEGATIVE CONTROLS IN BOTH DIRECTIONS (DEC-967: this scan's whole value is
// that it cannot be satisfied vacuously): a synthetic scan-shaped fixture
// that strips before matching passes; one that matches raw source is
// reported; and a synthetic fixture whose COMMENT (not its code) contains
// the offending literal is proven to flip a real detector's verdict.
//
// OUT_OF_CAMPAIGN_SCOPE (scripts/exit-predicate/campaign-scope.ts): see
// app/src/unstripped-source-regex-scan/ceiling.ts's header for the reason.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { UNSTRIPPED_SOURCE_REGEX_CEILING } from "../app/src/unstripped-source-regex-scan/ceiling";

const REPO_ROOT = join(__dirname, "..");
const TEST_DIR = join(REPO_ROOT, "test");
const APP_SRC_DIR = join(REPO_ROOT, "app", "src");
const SELF = __filename;

// ---------------------------------------------------------------------------
// Walk (readdirSync recursive, DEC-808 idiom -- no manifest).
// ---------------------------------------------------------------------------

interface SourceFile {
  readonly abs: string;
  readonly rel: string;
  readonly content: string;
}

function walkTsFiles(root: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    const abs = join(entry.parentPath, entry.name);
    if (abs === SELF) continue;
    out.push({ abs, rel: relative(REPO_ROOT, abs), content: readFileSync(abs, "utf8") });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detection -- the detector under test, exercised directly by both the
// population walk below AND the non-vacuity fixtures.
// ---------------------------------------------------------------------------

const READS_SOURCE_RE = /readFileSync\(|readdirSync\(/;
const NAMED_STRIP_CALL_RE = /\bstrip[A-Za-z]*[Cc]omments?\s*\(/;
const SHARED_STRIPPER_IMPORT_RE = /from\s+['"][^'"]*strip-css-comments['"]/;

// The two comment-shaped regex bodies this codebase's own naive local
// strippers use, as they appear LITERALLY in source text (a regex literal's
// characters, not a JS string escape sequence).
const BLOCK_COMMENT_REGEX_SHAPE = "\\/\\*[\\s\\S]*?\\*\\/";
const LINE_COMMENT_REGEX_SHAPE = "\\/\\/[^\\n]*";

const VAR_FROM_READFILESYNC_RE = /(?:const|let)\s+(\w+)\s*=\s*(?:[\w.]+\()*\s*readFileSync\(/g;
const PROP_FROM_READFILESYNC_RE = /(\w+)\s*:\s*(?:[\w.]+\()*\s*readFileSync\(/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every variable/property name this file assigns straight from
 * `readFileSync(...)` -- the set of identifiers that hold raw source text. */
export function collectSourceVarNames(content: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const varRe = new RegExp(VAR_FROM_READFILESYNC_RE.source, "g");
  while ((m = varRe.exec(content))) names.add(m[1] as string);
  const propRe = new RegExp(PROP_FROM_READFILESYNC_RE.source, "g");
  while ((m = propRe.exec(content))) names.add(m[1] as string);
  return [...names];
}

/** Does `content` apply a risky content-match method (`.test(`/`.exec(`/
 * `.match(`/`.replace(`/`.includes(`/`.indexOf(`) directly to variable
 * `varName`? A `.replace(` call whose regex argument is itself one of the
 * two comment-shaped patterns is a STRIPPING step, not a risky match, and
 * is excluded. */
export function appliesRiskyMatch(content: string, varName: string): boolean {
  const escaped = escapeRegExp(varName);
  const callRe = new RegExp(`\\b${escaped}\\s*\\.\\s*(test|exec|match|replace|includes|indexOf)\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(content))) {
    const method = m[1];
    if (method === "replace") {
      const windowText = content.slice(m.index, m.index + 200);
      if (windowText.includes(BLOCK_COMMENT_REGEX_SHAPE) || windowText.includes(LINE_COMMENT_REGEX_SHAPE)) {
        continue; // this IS the stripping step, not a risky match
      }
    }
    return true;
  }
  // Reversed calling convention: `SOME_REGEX.test(varName)` /
  // `SOME_REGEX.exec(varName)` -- a regex object applied TO the source
  // variable, rather than a method called ON it (test-tiers.test.ts's own
  // `IMPORT_SPECIFIER_RE.exec(source)` shape, instance 3's exact offense).
  const reversedRe = new RegExp(`\\.(test|exec)\\s*\\(\\s*${escaped}\\s*\\)`, "g");
  return reversedRe.test(content);
}

/** Does `content` obtain source off disk AND apply a risky match to that
 * same source, anywhere in the file? */
export function isUnstrippedSourceRegexCandidate(content: string): boolean {
  if (!READS_SOURCE_RE.test(content)) return false;
  for (const varName of collectSourceVarNames(content)) {
    if (appliesRiskyMatch(content, varName)) return true;
  }
  return false;
}

/** Does `content` carry a named strip call, the shared stripper import, or
 * an inline comment-shaped `.replace(` step, ANYWHERE in the file (the same
 * file-wide coarseness comment-blind-css-assertion-scan's own
 * hasStrippingStep uses)? */
export function hasStrippingStep(content: string): boolean {
  return (
    NAMED_STRIP_CALL_RE.test(content) ||
    SHARED_STRIPPER_IMPORT_RE.test(content) ||
    content.includes(BLOCK_COMMENT_REGEX_SHAPE) ||
    content.includes(LINE_COMMENT_REGEX_SHAPE)
  );
}

export function isUnstrippedSourceRegexOffender(content: string): boolean {
  return isUnstrippedSourceRegexCandidate(content) && !hasStrippingStep(content);
}

interface Offender {
  readonly rel: string;
  readonly vars: string[];
}

function findOffenders(files: readonly SourceFile[]): Offender[] {
  const offenders: Offender[] = [];
  for (const f of files) {
    if (!isUnstrippedSourceRegexOffender(f.content)) continue;
    const vars = collectSourceVarNames(f.content).filter((v) => appliesRiskyMatch(f.content, v));
    offenders.push({ rel: f.rel, vars });
  }
  return offenders.sort((a, b) => a.rel.localeCompare(b.rel));
}

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

describe("unstripped-source-regex family (DEC-374 wave-39, task w39-f)", () => {
  const files = [...walkTsFiles(TEST_DIR), ...walkTsFiles(APP_SRC_DIR)];
  const offenders = findOffenders(files);

  it("the walk finds a non-trivial number of source files (guards against a bad root leaving zero files scanned)", () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it("test/test-tiers.test.ts is NO LONGER an offender (v12m-w38-c landed its repair; this row must not silently regress)", () => {
    // FLIPPED (wave-44 thunderdome), exactly as this file's header and the
    // ceiling module's seeding note both said it would be: "this instrument
    // COUNTS that offense honestly (so w38-c's landing flips this row)".
    // w38-c has landed -- test/test-tiers.test.ts now calls stripTsComments
    // before applying IMPORT_SPECIFIER_RE, so the DEC-727 tier predicate is
    // no longer comment-blind. Keeping the old assertion (that it IS an
    // offender) would have re-broken the gate to protect a stale pin. The
    // assertion is inverted rather than deleted so the repair cannot silently
    // regress: instance 3 of this family's own origin story stays pinned.
    const testTiers = files.find((f) => f.rel === "test/test-tiers.test.ts");
    expect(testTiers, "test/test-tiers.test.ts not found by the walk").toBeTruthy();
    expect(isUnstrippedSourceRegexOffender(testTiers!.content)).toBe(false);
    expect(offenders.some((o) => o.rel === "test/test-tiers.test.ts")).toBe(false);
  });

  // v12m-w44-i (DEC-374 wave-44, task w44-i): this control used to name
  // test/test-tiers.test.ts specifically ("v12m-w38-c owns its repair").
  // That branch merged and repaired the file (it now imports and calls
  // test/helpers/strip-ts-comments.ts's stripTsComments before matching),
  // so it correctly dropped OUT of the live roster -- and the control,
  // written as a claim about a BRANCH rather than a property of the
  // instrument, started failing the moment the branch it named landed. A
  // control naming a branch expires the moment that branch merges (field
  // guide, waves 38-41). Re-pointed at a file this scan's own population
  // walk still finds live (an ordinary component-style scan whose
  // `.includes`/`.test` calls run against raw, un-stripped source with no
  // repair lane currently in flight), and reworded as a PROPERTY: any file
  // that reads source off disk and content-matches it without a
  // comment-stripping step IS counted, regardless of which specific file
  // that happens to be on any given tree.
  it("a file that content-matches un-stripped source it read off disk IS counted, regardless of which file that currently is", () => {
    const liveOffender = files.find((f) => f.rel === "test/audit-claims.test.ts");
    expect(liveOffender, "test/audit-claims.test.ts not found by the walk").toBeTruthy();
    expect(isUnstrippedSourceRegexOffender(liveOffender!.content)).toBe(true);
    expect(offenders.some((o) => o.rel === "test/audit-claims.test.ts")).toBe(true);
  });

  it("no more than UNSTRIPPED_SOURCE_REGEX_CEILING files apply a content match to un-stripped source they read off disk (may only fall)", () => {
    if (offenders.length > UNSTRIPPED_SOURCE_REGEX_CEILING) {
      throw new Error(
        `${offenders.length} unstripped-source-regex offender(s) found, over the ceiling of ` +
          `${UNSTRIPPED_SOURCE_REGEX_CEILING}:\n` +
          offenders.map((o) => `  ${o.rel} (var: ${o.vars.join(", ")})`).join("\n"),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(UNSTRIPPED_SOURCE_REGEX_CEILING);
  });

  it("the ceiling is not stale (two-sided companion, DEC-808): fails loudly if the measured count drops without the ceiling being lowered to match", () => {
    if (offenders.length < UNSTRIPPED_SOURCE_REGEX_CEILING) {
      throw new Error(
        `measured ${offenders.length} offenders, below the ceiling of ${UNSTRIPPED_SOURCE_REGEX_CEILING} -- ` +
          `lower it to match: export const UNSTRIPPED_SOURCE_REGEX_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(UNSTRIPPED_SOURCE_REGEX_CEILING);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967): synthetic fixtures, exercised through the SAME
// detector functions the population walk above uses.
// ---------------------------------------------------------------------------

describe("non-vacuity: the detector discriminates stripped from un-stripped fixtures", () => {
  it("negative control: a synthetic scan that matches RAW source (no stripping step) IS reported", () => {
    const raw = [
      "import { readFileSync } from 'node:fs';",
      "const source = readFileSync('x.ts', 'utf8');",
      "const FORBIDDEN = /banned-token/;",
      "if (FORBIDDEN.test(source)) { throw new Error('found it'); }",
      "export function check() { return source.includes('banned-token'); }",
    ].join("\n");
    expect(isUnstrippedSourceRegexCandidate(raw)).toBe(true);
    expect(hasStrippingStep(raw)).toBe(false);
    expect(isUnstrippedSourceRegexOffender(raw)).toBe(true);
  });

  it("positive control: a synthetic scan that strips comments BEFORE matching passes (NOT reported)", () => {
    const stripped = [
      "import { readFileSync } from 'node:fs';",
      "function stripComments(s) { return s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\/\\/[^\\n]*/g, ''); }",
      "let source = readFileSync('x.ts', 'utf8');",
      "source = stripComments(source);",
      "export function check() { return source.includes('banned-token'); }",
    ].join("\n");
    expect(hasStrippingStep(stripped)).toBe(true);
    expect(isUnstrippedSourceRegexOffender(stripped)).toBe(false);
  });

  it("an inline comment-shaped `.replace(` (this codebase's own naive local-stripper idiom) is NOT itself a risky match, and DOES count as a stripping step", () => {
    const inlineStrip = [
      "import { readFileSync } from 'node:fs';",
      "const css = readFileSync('x.css', 'utf8');",
      "const cssNoComments = css.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');",
      "export function check() { return cssNoComments.includes('.chq-foo'); }",
    ].join("\n");
    expect(appliesRiskyMatch(inlineStrip, "css")).toBe(false);
    expect(hasStrippingStep(inlineStrip)).toBe(true);
    expect(isUnstrippedSourceRegexOffender(inlineStrip)).toBe(false);
  });

  it("THE CORE PROOF: a synthetic source fixture whose COMMENT contains the offending literal, while its CODE does not, flips a real scan's verdict when un-stripped vs. stripped", () => {
    // Mirrors instance 3 exactly: a header comment quoting an import-like
    // line, matched by a raw (un-stripped) regex.
    const fixtureSource = [
      "// This module must never import 'playwright' -- see DEC-727.",
      "export const REAL_CODE = 1;",
    ].join("\n");

    const IMPORT_LIKE_RE = /['"]playwright['"]/;

    // Un-stripped: the regex is fooled by the comment (false positive --
    // exactly the shape that silently disabled the DEC-727 tier guard).
    expect(IMPORT_LIKE_RE.test(fixtureSource)).toBe(true);

    // Stripped: the same regex, run against the same fixture with comments
    // removed first, correctly finds no import.
    function stripComments(s: string): string {
      return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    }
    expect(IMPORT_LIKE_RE.test(stripComments(fixtureSource))).toBe(false);

    // And the family detector itself: a synthetic scan-shaped file built
    // from this exact fixture, with no stripping step, IS an offender.
    const scanShapedFile = [
      "import { readFileSync } from 'node:fs';",
      "const source = readFileSync('fixture.ts', 'utf8');",
      "const IMPORT_LIKE_RE = /['\"]playwright['\"]/;",
      "export function isSlow() { return IMPORT_LIKE_RE.test(source); }",
    ].join("\n");
    expect(isUnstrippedSourceRegexOffender(scanShapedFile)).toBe(true);
  });

  it("a file that reads source but never matches it is NOT a candidate (guards the (a)-without-(b) case)", () => {
    const readOnly = [
      "import { readFileSync } from 'node:fs';",
      "const source = readFileSync('x.ts', 'utf8');",
      "export function length() { return source.length; }",
    ].join("\n");
    expect(isUnstrippedSourceRegexCandidate(readOnly)).toBe(false);
  });

  it("a file that matches a variable NOT derived from readFileSync/readdirSync is NOT a candidate (guards the (b)-without-(a) case)", () => {
    const noRead = [
      "const source = 'plain string literal, not read off disk';",
      "export function check() { return /x/.test(source); }",
    ].join("\n");
    expect(isUnstrippedSourceRegexCandidate(noRead)).toBe(false);
  });
});
