// One derived terminal-phone-block contract (DEC-385 amendment, wave 98;
// task w1-d).
//
// Two per-sheet hand-written pins used to encode OPPOSITE rules for this
// same DEC-385 invariant and both sat red on main at once:
// test/portal-phone-frames.test.ts:220-223 demanded exactly ONE
// `@media (max-width: 700px)` block in portal.css.ts (measured 2, two
// unmerged branches independently pushing it to 3), while
// app/src/pages/settings/settings-phone-floor.test.ts:148 demanded at
// LEAST five phone blocks in settings.css (measured 1 after a consolidation
// landed). Neither file's assertion was wrong on its own terms; they were
// two different people's guesses at one shared rule, guessing in opposite
// directions. This scan replaces both guesses with one derived contract:
//
//   DEC-385 is single-direction responsive (narrow overrides wide via
//   max-width media queries ONLY) and CSS resolves an equal-specificity tie
//   by SOURCE ORDER. A phone override block that is not the sheet's LAST
//   top-level construct can be silently shadowed by any later desktop rule
//   touching the same (selector, property) pair -- a desktop-freeze hazard,
//   not just a phone one (see app/src/phone-cascade-order.scan.test.ts,
//   which finds the shadows this rule exists to prevent in the first
//   place). The rule is therefore, for every sheet that has at least one
//   phone block: exactly ONE such block, and it must be textually terminal.
//
//   POPULATION (DEC-808, enumerated every run, never a hand-listed
//   manifest -- three earlier probes each missed part of this same
//   population by globbing `src/**/*.css.ts` or rooting at `src/routes`,
//   which is how src/views/theme.ts's own 44px floor rule went unswept for
//   five waves, field guide w96):
//     (a) every `*.css` file under app/src, readdirSync recursion.
//     (b) every module under src/ (any file extension) whose text matches
//         `export const [A-Z0-9_]+_CSS\s*=`, readdirSync recursion over
//         src/ filtered by content, never a curated list of "the CSS
//         modules" -- this is the definition that finally catches
//         src/views/theme.ts, which exports THEME_CSS from a file that is
//         not itself named *.css.ts and does not live under src/routes.
//
//   For a *.css.ts (or otherwise non-.css) module, only the bytes INSIDE
//   the exported template literal are parsed as CSS -- not the whole file,
//   which also carries an `import { ... }` statement (itself a balanced,
//   spurious `{ }` pair at depth 0) and a trailing "`;" after the literal
//   closes. Extracting the literal first means "top-level construct" means
//   what it says: a top-level construct of the CSS text, not of the JS
//   module wrapping it.
//
//   METHOD: brace-match the (comment-stripped) CSS text top to bottom,
//   recording every `{...}` node's header, depth, and byte range. A "phone
//   block" is a depth-0 node whose header (trimmed) is exactly
//   `@media (max-width: 700px)`. A sheet with zero phone blocks is not a
//   member of this invariant (DEC-385 does not require every sheet to have
//   a phone override). A sheet with >=1 phone block must have EXACTLY ONE,
//   and that one block's closing brace must be followed by nothing but
//   whitespace and/or comments through the end of the parsed CSS text.
//
//   The brace matcher indexes the SAME string its offsets are computed on
//   (stripComments preserves length -- every non-newline character inside
//   a comment becomes a space, newlines survive -- so an index into the
//   comment-stripped text is always a valid index into the raw text too).
//   This is the field-guide w94 bug (phone-cascade-order.scan.test.ts used
//   to slice the RAW text at offsets computed on a comment-STRIPPED string
//   of a *different* length) and this scan does not repeat it.
//
// SHIP-WITH-GUARDS (not a ratchet -- DEC-385 wave-98 explicitly forbids
// weakening this into a ceiling that licenses new sheets going non-
// terminal): a vacuous-population tripwire, a positive control (an inline
// fixture with two phone blocks must fail), and two negative controls (a
// single terminal block passes; a single block followed only by a trailing
// comment still passes).
//
// EXPECTED STATE ON THIS BRANCH: portal.css.ts (this task's owned file) is
// conformant -- one block, terminal, the earlier w5-a block's rules were
// moved (not duplicated) into the w8-h block at the sheet's true end. Every
// OTHER non-conformant sheet this scan discovers is NOT fixed here (out of
// this task's scope) and is instead named, one row per sheet with its
// owning cluster, in docs/design/audit/terminal-phone-block-v12.md -- an
// audit that names no owner never shrinks. This scan is therefore expected
// to be RED on this branch until those other sheets are fixed by later
// waves; that redness is the honest replacement for the two contradictory
// green-on-nothing pins it retires.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const APP_SRC_ROOT = join(REPO_ROOT, "app", "src");
const SRC_ROOT = join(REPO_ROOT, "src");

const PHONE_HEADER = "@media (max-width: 700px)";
const CSS_EXPORT_RE = /export const [A-Z0-9_]+_CSS\s*=/;

// -- Population -----------------------------------------------------------

interface Sheet {
  /** repo-relative path, for reporting */
  relPath: string;
  /** absolute path, for reading */
  absPath: string;
  /** the parsed CSS text (whole file for *.css; the extracted template
   * literal body for everything else) */
  cssText: string;
  /** byte offset, in the ORIGINAL file, of cssText[0] -- 0 for *.css files */
  fileOffset: number;
}

function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Extracts the bytes strictly between the backticks of
 * `export const SOME_CSS = \`...\`;`, honouring backslash-escaped
 * backticks inside the literal (this codebase's frame-citation comments
 * embed escaped backticks, e.g. \`width:390px\`). Throws on a malformed
 * export -- a *_CSS module with no parseable literal should fail loudly,
 * not be silently skipped from the population. */
function extractCssLiteral(text: string): { body: string; startOffset: number } {
  const m = CSS_EXPORT_RE.exec(text);
  if (!m) throw new Error("expected an `export const X_CSS = \\`...\\`` declaration");
  let i = text.indexOf("`", m.index + m[0].length);
  if (i === -1) throw new Error("no opening backtick found after *_CSS export");
  i += 1;
  const start = i;
  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === "`") {
      return { body: text.slice(start, i), startOffset: start };
    }
    i += 1;
  }
  throw new Error("unterminated *_CSS template literal");
}

function loadCssSheets(): Sheet[] {
  const sheets: Sheet[] = [];

  for (const abs of walk(APP_SRC_ROOT)) {
    if (!abs.endsWith(".css")) continue;
    const text = readFileSync(abs, "utf-8");
    sheets.push({ relPath: relative(REPO_ROOT, abs), absPath: abs, cssText: text, fileOffset: 0 });
  }

  for (const abs of walk(SRC_ROOT)) {
    const text = readFileSync(abs, "utf-8");
    if (!CSS_EXPORT_RE.test(text)) continue;
    const { body, startOffset } = extractCssLiteral(text);
    sheets.push({ relPath: relative(REPO_ROOT, abs), absPath: abs, cssText: body, fileOffset: startOffset });
  }

  return sheets;
}

const SHEETS = loadCssSheets();

// -- Brace-matching parser (mirrors app/src/phone-cascade-order.scan.test.ts) --

interface BlockNode {
  header: string;
  depth: number;
  openIdx: number;
  closeIdx: number;
  startLine: number;
  closeLine: number;
}

/** Blanks out /* ... *\/ comments in place, preserving length and newlines,
 * so offsets computed on the result stay valid indices into the raw text. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function indexToLine(lineStarts: number[], idx: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Walks comment-stripped `clean` and returns every `{...}` block,
 * brace-matched top to bottom. Throws on unbalanced braces. */
function parseBlocks(clean: string): BlockNode[] {
  const nodes: BlockNode[] = [];
  const stack: BlockNode[] = [];
  let bufStart = 0;
  const lineStarts = buildLineStarts(clean);

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === "{") {
      const header = clean.slice(bufStart, i);
      const node: BlockNode = {
        header,
        depth: stack.length,
        openIdx: i,
        closeIdx: -1,
        startLine: indexToLine(lineStarts, i),
        closeLine: -1,
      };
      nodes.push(node);
      stack.push(node);
      bufStart = i + 1;
    } else if (c === "}") {
      const node = stack.pop();
      if (!node) throw new Error("unbalanced braces (unmatched '}')");
      node.closeIdx = i;
      node.closeLine = indexToLine(lineStarts, i);
      bufStart = i + 1;
    }
  }
  if (stack.length) throw new Error("unbalanced braces at EOF (unmatched '{')");
  return nodes;
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, " ");
}

interface SheetResult {
  relPath: string;
  phoneBlocks: BlockNode[];
  trailingText: string | null; // non-null (and non-empty after strip) => violation
  trailingOffset: number | null; // offset in cssText of first trailing byte
}

function evaluateSheet(sheet: Sheet): SheetResult {
  const clean = stripComments(sheet.cssText);
  const nodes = parseBlocks(clean);
  const phoneBlocks = nodes.filter((n) => n.depth === 0 && normalizeHeader(n.header) === PHONE_HEADER);

  let trailingText: string | null = null;
  let trailingOffset: number | null = null;
  if (phoneBlocks.length === 1) {
    const last = phoneBlocks[0]!;
    const after = clean.slice(last.closeIdx + 1);
    if (after.trim().length > 0) {
      // Find the first non-whitespace byte's offset in the ORIGINAL (raw)
      // cssText -- stripComments preserves length, so this index is valid
      // in the un-stripped string too.
      const localOffset = after.search(/\S/);
      trailingOffset = last.closeIdx + 1 + localOffset;
      trailingText = sheet.cssText.slice(trailingOffset, trailingOffset + 60);
    }
  }

  return { relPath: sheet.relPath, phoneBlocks, trailingText, trailingOffset };
}

const RESULTS: SheetResult[] = SHEETS.map(evaluateSheet);

/** Members of the invariant: sheets with >=1 phone block. Sheets with zero
 * are simply not subject to this rule (DEC-385 does not require every
 * sheet to carry a phone override). */
const MEMBERS = RESULTS.filter((r) => r.phoneBlocks.length > 0);

interface Violation {
  relPath: string;
  reason: string;
}

function computeViolations(results: SheetResult[]): Violation[] {
  const out: Violation[] = [];
  for (const r of results) {
    if (r.phoneBlocks.length === 0) continue;
    if (r.phoneBlocks.length !== 1) {
      out.push({
        relPath: r.relPath,
        reason: `has ${r.phoneBlocks.length} \`${PHONE_HEADER}\` blocks (must be exactly 1) at lines ${r.phoneBlocks
          .map((b) => b.startLine)
          .join(", ")}`,
      });
      continue;
    }
    if (r.trailingText !== null) {
      out.push({
        relPath: r.relPath,
        reason: `the single phone block is not the sheet's last top-level construct -- byte offset ${r.trailingOffset} carries trailing content: ${JSON.stringify(
          r.trailingText
        )}`,
      });
    }
  }
  return out;
}

const VIOLATIONS = computeViolations(RESULTS);

// -- Tests ------------------------------------------------------------------

describe("one derived terminal-phone-block contract (DEC-385 amendment wave 98)", () => {
  it("enumerates a non-empty population including at least one app/src sheet, one src/routes *.css.ts sheet, and src/views/theme.ts by name (vacuous-population guard)", () => {
    // Measured floor on this branch: 25 app/src *.css files + 16 src/*
    // *_CSS-exporting modules = 41 sheets total. A floor, not a pin -- it
    // may only be RAISED as the tree grows, never lowered to paper over a
    // population that shrank.
    expect(SHEETS.length).toBeGreaterThanOrEqual(41);
    expect(SHEETS.some((s) => s.relPath.startsWith("app/src/") && s.relPath.endsWith(".css"))).toBe(true);
    expect(SHEETS.some((s) => s.relPath.startsWith("src/routes/") && s.relPath.endsWith(".css.ts"))).toBe(true);
    expect(SHEETS.some((s) => s.relPath === "src/views/theme.ts")).toBe(true);
  });

  it("positive control: a fixture with two 700px blocks is flagged", () => {
    const fixture = `
.a { color: red; }
@media (max-width: 700px) {
  .a { color: blue; }
}
.b { color: green; }
@media (max-width: 700px) {
  .b { color: yellow; }
}
`;
    const result = evaluateSheet({ relPath: "fixture-two-blocks", absPath: "", cssText: fixture, fileOffset: 0 });
    expect(result.phoneBlocks.length).toBe(2);
    const violations = computeViolations([result]);
    expect(violations.length).toBe(1);
    expect(violations[0]!.reason).toMatch(/has 2 /);
  });

  it("negative control: a fixture with one terminal 700px block passes", () => {
    const fixture = `
.a { color: red; }
@media (max-width: 700px) {
  .a { color: blue; }
}
`;
    const result = evaluateSheet({ relPath: "fixture-one-terminal", absPath: "", cssText: fixture, fileOffset: 0 });
    expect(result.phoneBlocks.length).toBe(1);
    expect(computeViolations([result])).toEqual([]);
  });

  it("negative control: a fixture with one 700px block followed only by a trailing comment still passes", () => {
    const fixture = `
.a { color: red; }
@media (max-width: 700px) {
  .a { color: blue; }
}
/* trailing note, no code */
`;
    const result = evaluateSheet({ relPath: "fixture-trailing-comment", absPath: "", cssText: fixture, fileOffset: 0 });
    expect(result.phoneBlocks.length).toBe(1);
    expect(computeViolations([result])).toEqual([]);
  });

  it("portal.css.ts (this task's owned sheet) is conformant: exactly one terminal phone block", () => {
    const portal = RESULTS.find((r) => r.relPath === "src/routes/portal/portal.css.ts");
    expect(portal).toBeDefined();
    expect(portal!.phoneBlocks.length).toBe(1);
    expect(portal!.trailingText).toBeNull();
  });

  it("every enumerated sheet with >=1 phone block has exactly one, and it is textually terminal", () => {
    if (VIOLATIONS.length > 0) {
      const lines = VIOLATIONS.map((v) => `${v.relPath}: ${v.reason}`);
      throw new Error(
        `${VIOLATIONS.length} of ${MEMBERS.length} sheets with a phone block violate the terminal-block ` +
          `contract (DEC-385 amendment wave 98). This is NOT a ratchet -- fix a sheet by moving its earlier ` +
          `block's rules into its last block (or making its one block textually last), never by adding an ` +
          `exemption here. Sheets beyond portal.css.ts are out of this task's scope and are tracked in ` +
          `docs/design/audit/terminal-phone-block-v12.md, one owner per row:\n${lines.join("\n")}`
      );
    }
    expect(VIOLATIONS).toEqual([]);
  });
});
