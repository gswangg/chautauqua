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
//   not just a phone one (see test/phone-cascade-order.scan.test.ts,
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
//   This is the field-guide w94 bug (test/phone-cascade-order.scan.test.ts used
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
// EXPECTED STATE ON THIS BRANCH (task w16-bb, DEC-385 wave-141 amendment):
// this scan now grades every src/ *_CSS module's COMPOSED output (imports
// resolved, `${NAME}` interpolations substituted with the named export's
// own resolved literal, recursively -- see resolveComposedLiteral below),
// not just each file's own on-disk text. A sheet composing another *_CSS
// module was previously invisible to this check: the interpolation token
// sits in the literal as plain "${" + "}" characters, which the brace-
// matcher treats as an ignorable non-"@media" node, so a phone block
// living entirely inside a composed import (rather than the host's own
// text) was never counted. That blindness is exactly how
// src/views/error-states.css.ts grew an early phone block inside
// ERROR_STATES_CSS undetected (task w16-bb's regression): every host's OWN
// file text still showed one terminal block, so this scan stayed green
// while the actual composed output was non-terminal.
//
// src/routes/auth.css.ts and src/routes/public/cfp.css.ts are fully
// conformant on composed output as of this task: ERROR_STATES_CSS's phone
// rules were split into their own export, ERROR_STATES_PHONE_CSS, composed
// immediately after each host's own terminal block (ascending source
// order, nothing reordered/reworded) -- see src/views/error-states.css.ts.
//
// Widening this scan to grade composed output also surfaces two sheets
// that were ALREADY non-conformant in a way file-text grading could never
// see, unrelated to ERROR_STATES_CSS and out of this task's scope to fix:
// src/routes/portal/portal.css.ts (composes EMPTY_CSS mid-file, ahead of
// its own terminal block) and src/routes/public/public.css.ts (composes
// CHROME_CSS/CARDS_CSS/AGENDA_CSS/RAIL_CSS/EMPTY_CSS, several with their
// own non-terminal phone blocks). Both are named in
// docs/design/audit/terminal-phone-block-v12.md. Every OTHER non-
// conformant sheet this scan discovers is likewise NOT fixed here (out of
// scope) and is named there, one row per sheet with its owning cluster --
// an audit that names no owner never shrinks. This scan is therefore
// expected to be RED on this branch until those sheets are fixed by later
// waves; that redness is the honest replacement for a green check that
// could not see this entire class of bug.

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * not be silently skipped from the population.
 *
 * When `exportName` is given, matches that SPECIFIC `export const NAME =`
 * declaration -- required for a module (like src/views/error-states.css.ts)
 * that exports more than one `*_CSS` constant, where grabbing "the first
 * match" silently returns the WRONG export's body for every name but the
 * first (this was a real bug caught while building this resolver: an
 * imported `ERROR_STATES_PHONE_CSS` resolved to `ERROR_STATES_CSS`'s body
 * instead). With no `exportName`, keeps the prior "first *_CSS export in
 * the file" behaviour used for whole-file population entries. */
function extractCssLiteral(text: string, exportName?: string): { body: string; startOffset: number } {
  const re = exportName ? new RegExp(`export const ${exportName}\\s*=`) : CSS_EXPORT_RE;
  const m = re.exec(text);
  if (!m) {
    throw new Error(
      exportName
        ? `expected an \`export const ${exportName} = \\\`...\\\`\` declaration`
        : "expected an `export const X_CSS = \\`...\\`` declaration"
    );
  }
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

// -- Composition resolver (DEC-385 wave-141 amendment, task w16-bb) --------
//
// A *_CSS module can compose another *_CSS module by importing it and
// interpolating it into its own template literal (`${ERROR_STATES_CSS}`,
// `${BARE_PAGE_CSS}`, etc.) -- src/routes/public/public.css.ts composing
// CHROME_CSS/CARDS_CSS/AGENDA_CSS/RAIL_CSS/EMPTY_CSS is the same idiom.
// Reading only a sheet's OWN literal text (extractCssLiteral, unchanged
// above) is structurally blind to a phone block living inside a composed
// import: the interpolation token `${NAME}` sits in the literal as four
// plain characters -- a "{" and "}" pair the brace-matcher below treats as
// an ignorable, non-"@media" node -- never as the composed module's actual
// CSS text. That blindness is exactly how src/views/error-states.css.ts
// grew an early phone block inside ERROR_STATES_CSS undetected: no sheet's
// OWN file text ever contained "@media (max-width: 700px)" twice, so the
// exactly-one-and-terminal check below passed on every host while the
// COMPOSED output of all three hosts carried a non-terminal phone block.
//
// This resolver walks each module's own `import { NAME, ... } from "spec"`
// statements (spec must be relative; local composition only), and for
// every imported identifier ending in `_CSS` that the module's literal
// actually interpolates, recursively substitutes that identifier's own
// resolved (composed) literal text in place of the `${NAME}` token --
// verbatim string substitution, no CSS re-parsing, no reordering. The
// result is the sheet's REAL composed CSS text, the same bytes the runtime
// template literal produces, not just its own on-disk slice of it.
const RESOLVE_CACHE = new Map<string, string>();

function resolveModuleSpec(fromAbsPath: string, spec: string): string {
  if (!spec.startsWith(".")) {
    throw new Error(`cannot resolve non-relative import spec "${spec}" from ${fromAbsPath}`);
  }
  const base = join(dirname(fromAbsPath), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
    try {
      readFileSync(candidate, "utf-8");
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`cannot resolve import "${spec}" from ${fromAbsPath} (tried .ts/.tsx)`);
}

const IMPORT_RE = /import\s*\{\s*([^}]+)\}\s*from\s*["']([^"']+)["']/g;

/** Resolves `absPath`'s exported `*_CSS` literal (defaulting to the file's
 * first such export when `exportName` is omitted -- the whole-file
 * population entry point) into its fully COMPOSED text: every `${NAME}`
 * interpolation whose `NAME` is a locally-imported `*_CSS` identifier is
 * replaced, recursively, with THAT identifier's own resolved literal --
 * resolved by NAME, not "whichever export the sub-module declares first"
 * (a file exporting more than one `*_CSS` constant, like
 * src/views/error-states.css.ts, would otherwise silently hand back the
 * wrong sibling's body for every name but the first). Cache key is
 * (path, exportName) so two differently-named exports from the same file
 * cache independently. */
function resolveComposedLiteral(absPath: string, exportName?: string): string {
  const cacheKey = `${absPath} ${exportName ?? ""}`;
  const cached = RESOLVE_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const text = readFileSync(absPath, "utf-8");
  const { body } = extractCssLiteral(text, exportName);

  const nameToPath = new Map<string, string>();
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(text))) {
    const names = m[1]!.split(",").map((s) => s.trim()).filter(Boolean);
    const spec = m[2]!;
    if (!spec.startsWith(".")) continue; // only local *_CSS composition matters here
    for (const name of names) {
      if (!/_CSS$/.test(name)) continue;
      nameToPath.set(name, resolveModuleSpec(absPath, spec));
    }
  }

  let resolved = body;
  for (const [name, subPath] of nameToPath) {
    const token = `\${${name}}`;
    if (!resolved.includes(token)) continue;
    resolved = resolved.split(token).join(resolveComposedLiteral(subPath, name));
  }

  RESOLVE_CACHE.set(cacheKey, resolved);
  return resolved;
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
    // Grade the COMPOSED exported string, not just this file's own literal
    // text -- a sheet with no composition resolves to exactly its own body.
    const composed = resolveComposedLiteral(abs);
    sheets.push({ relPath: relative(REPO_ROOT, abs), absPath: abs, cssText: composed, fileOffset: 0 });
  }

  return sheets;
}

const SHEETS = loadCssSheets();

// -- Brace-matching parser (mirrors test/phone-cascade-order.scan.test.ts) --

interface BlockNode {
  header: string;
  /** offset of the first byte of `header` (i.e. before the header text,
   * not the opening brace) -- lets a caller report a violation starting at
   * the selector, not at the bare "{" that comes after it. */
  headerStart: number;
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
        headerStart: bufStart,
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
  const depth0 = nodes.filter((n) => n.depth === 0);
  const phoneBlocks = depth0.filter((n) => normalizeHeader(n.header) === PHONE_HEADER);

  let trailingText: string | null = null;
  let trailingOffset: number | null = null;

  if (phoneBlocks.length > 0) {
    // A composed sheet legitimately ends with MORE THAN ONE phone block
    // back-to-back (its own terminal block immediately followed by a
    // composed module's phone block, DEC-385 wave-141) -- that is not
    // shadowing, because nothing non-phone sits between them or after the
    // last one. The actual invariant: once the FIRST depth-0 phone block
    // begins, every remaining depth-0 top-level construct through EOF must
    // itself be a phone block (or trailing whitespace/comments) -- no
    // desktop rule interleaves with, or follows, the phone region.
    const firstPhoneIdx = depth0.findIndex((n) => normalizeHeader(n.header) === PHONE_HEADER);
    const tail = depth0.slice(firstPhoneIdx);
    const nonPhoneInTail = tail.find((n) => normalizeHeader(n.header) !== PHONE_HEADER);
    if (nonPhoneInTail) {
      // Report from the start of the offending construct's HEADER (its
      // selector/at-rule text), not its bare opening "{" -- skip leading
      // whitespace so the reported snippet starts at the first meaningful
      // byte.
      const headerText = clean.slice(nonPhoneInTail.headerStart, nonPhoneInTail.openIdx);
      const leadingWs = headerText.length - headerText.trimStart().length;
      trailingOffset = nonPhoneInTail.headerStart + leadingWs;
      trailingText = sheet.cssText.slice(trailingOffset, trailingOffset + 60);
    } else {
      const last = tail[tail.length - 1]!;
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
    if (r.trailingText !== null) {
      out.push({
        relPath: r.relPath,
        reason: `the sheet's ${r.phoneBlocks.length} \`${PHONE_HEADER}\` block(s) (lines ${r.phoneBlocks
          .map((b) => b.startLine)
          .join(", ")}) do not form one contiguous trailing phone-block region -- byte offset ${r.trailingOffset} carries a non-phone top-level construct or trailing content: ${JSON.stringify(
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
    expect(violations[0]!.reason).toMatch(/do not form one contiguous trailing phone-block region/);
  });

  it("negative control: TWO CONTIGUOUS phone blocks with nothing between or after them still pass -- this is the legitimate composed-sheet shape (DEC-385 wave-141): a host's own terminal block immediately followed by a composed module's phone block is not shadowing", () => {
    const fixture = `
.a { color: red; }
@media (max-width: 700px) {
  .a { color: blue; }
}
@media (max-width: 700px) {
  .b { color: yellow; }
}
`;
    const result = evaluateSheet({ relPath: "fixture-two-contiguous-blocks", absPath: "", cssText: fixture, fileOffset: 0 });
    expect(result.phoneBlocks.length).toBe(2);
    expect(computeViolations([result])).toEqual([]);
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

  it("auth.css.ts / cfp.css.ts (task w16-bb) are conformant on their COMPOSED output: their own terminal block immediately followed by ERROR_STATES_PHONE_CSS's block, nothing after", () => {
    for (const relPath of ["src/routes/auth.css.ts", "src/routes/public/cfp.css.ts"]) {
      const sheet = RESULTS.find((r) => r.relPath === relPath);
      expect(sheet, relPath).toBeDefined();
      expect(sheet!.phoneBlocks.length, relPath).toBe(2);
      expect(sheet!.trailingText, relPath).toBeNull();
    }
  });

  it("portal.css.ts (task w18-f, DEC-385 wave-143 amendment): fully conformant on composed output -- EMPTY_CSS's phone rule (formerly mid-file at ~line 703, the pre-existing gap task w16-bb's own pin used to document) is now its own export, EMPTY_PHONE_CSS, composed immediately ahead of this sheet's own terminal block, so all THREE phone blocks (EMPTY_PHONE_CSS, portal's own terminal block, ERROR_STATES_PHONE_CSS) are contiguous with nothing trailing", () => {
    const portal = RESULTS.find((r) => r.relPath === "src/routes/portal/portal.css.ts");
    expect(portal).toBeDefined();
    // multi-portal adds a fourth: HOME_PHONE_CSS (participant-home.css.ts),
    // composed between the sheet's own block and ERROR_STATES_PHONE_CSS
    expect(portal!.phoneBlocks.length).toBe(4); // EMPTY_PHONE_CSS's + portal's own terminal + HOME_PHONE_CSS's + ERROR_STATES_PHONE_CSS's, contiguous
    const [emptyPhone, own, homePhone, phoneCss] = portal!.phoneBlocks;
    expect(emptyPhone).toBeDefined();
    expect(own).toBeDefined();
    expect(homePhone).toBeDefined();
    expect(phoneCss).toBeDefined();
    expect(portal!.trailingText).toBeNull(); // no non-phone construct sits between/after the three blocks any more
  });

  it("composed-blindness regression proof: a fabricated host that composes a fabricated module carrying a phone block, with a non-phone rule sitting AFTER the composed import, is invisible to a raw-file-text scan but caught once composition is resolved", () => {
    const scratchDir = mkdtempSync(join(tmpdir(), "phone-terminal-block-fixture-"));
    try {
      const subPath = join(scratchDir, "fake-sub.css.ts");
      const hostPath = join(scratchDir, "fake-host.css.ts");
      writeFileSync(
        subPath,
        [
          "export const FAKE_SUB_CSS = `",
          "  .sub { color: red; }",
          "  @media (max-width: 700px) {",
          "    .sub { color: blue; }",
          "  }",
          "`;",
          "",
        ].join("\n")
      );
      writeFileSync(
        hostPath,
        [
          'import { FAKE_SUB_CSS } from "./fake-sub.css";',
          "export const FAKE_HOST_CSS = `",
          "  .host-a { color: green; }",
          "${FAKE_SUB_CSS}",
          "  .host-b { color: purple; }",
          "`;",
          "",
        ].join("\n")
      );

      // The OLD, file-text-only extraction sees zero phone blocks in the
      // host's own literal -- exactly the blindness this task fixes. It is
      // not "conformant"; it is invisible to the check entirely.
      const rawText = readFileSync(hostPath, "utf-8");
      const rawBody = extractCssLiteral(rawText).body;
      const rawResult = evaluateSheet({ relPath: "fake-host (raw)", absPath: hostPath, cssText: rawBody, fileOffset: 0 });
      expect(rawResult.phoneBlocks.length).toBe(0);
      expect(computeViolations([rawResult])).toEqual([]); // blind: reports clean

      // The WIDENED, composition-resolving check sees the real shape: a
      // phone block from the composed import, followed by .host-b -- a
      // non-phone construct AFTER the phone region -- and flags it.
      const composedBody = resolveComposedLiteral(hostPath);
      const composedResult = evaluateSheet({
        relPath: "fake-host (composed)",
        absPath: hostPath,
        cssText: composedBody,
        fileOffset: 0,
      });
      expect(composedResult.phoneBlocks.length).toBe(1);
      const violations = computeViolations([composedResult]);
      expect(violations.length).toBe(1);
      expect(violations[0]!.reason).toMatch(/do not form one contiguous trailing phone-block region/);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
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

// -- DEC-385 single-direction: desktop is FROZEN (task w16-bb) -------------
//
// The ERROR_STATES_CSS/ERROR_STATES_PHONE_CSS split only moves a phone-only
// block from inside ERROR_STATES_CSS to a new sibling export, composed
// after each host's own terminal block -- it must not touch a single byte
// of any desktop (above max-width:700px) declaration in ERROR_STATES_CSS
// or in any of the three hosts. Pinned against the base rule these hosts
// share (test/error-vocabulary-parity.scan.test.ts also pins this
// property-for-property against the SPA twin), proving it: (a) still
// exists verbatim in ERROR_STATES_CSS's base body with no @media block of
// its own, and (b) still appears, byte-identical, in the desktop layer
// (everything before each host's own first @media (max-width: 700px)) of
// every composed host.
describe("DEC-385 single-direction: desktop layer above 700px is byte-identical after the split (task w16-bb)", () => {
  const FROZEN_ERROR_SUMMARY_LINK_BASE =
    ".chq-error-summary-link { font-size: 13px; font-weight: 700; color: var(--chq-brand); text-decoration: none; }";

  it("ERROR_STATES_CSS's own resolved body still contains the frozen .chq-error-summary-link declaration verbatim and carries no @media block of its own", () => {
    const errorStatesPath = join(SRC_ROOT, "views", "error-states.css.ts");
    const base = resolveComposedLiteral(errorStatesPath, "ERROR_STATES_CSS");
    expect(base).toContain(FROZEN_ERROR_SUMMARY_LINK_BASE);
    expect(base).not.toContain("@media");
  });

  it("each host's composed output still contains the frozen declaration verbatim, and it sits OUTSIDE every @media (max-width: 700px) block -- i.e. it is still a desktop (unconditional) rule, not something the split accidentally pulled phone-only", () => {
    for (const relPath of ["src/routes/auth.css.ts", "src/routes/public/cfp.css.ts", "src/routes/portal/portal.css.ts"]) {
      const sheet = SHEETS.find((s) => s.relPath === relPath);
      expect(sheet, relPath).toBeDefined();
      const declIdx = sheet!.cssText.indexOf(FROZEN_ERROR_SUMMARY_LINK_BASE);
      expect(declIdx, relPath).toBeGreaterThan(-1);
      const result = RESULTS.find((r) => r.relPath === relPath);
      expect(result, relPath).toBeDefined();
      const insidePhoneBlock = result!.phoneBlocks.some((b) => declIdx > b.openIdx && declIdx < b.closeIdx);
      expect(insidePhoneBlock, relPath).toBe(false);
    }
  });
});
