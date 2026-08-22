// Frame-citation contract (DEC-976 amendment, wave 23; DEC-808). DEC-976's
// amendment rules that every `docs/design/*.dc.html:<line>` reference in an
// app/src or src comment must be immediately followed, in the same
// comment, by the cited line's literal declaration in backticks -- the
// quote is the receipt: a reader comparing the rule below to the quote
// beside it needs no second file open, and a frame edit that moves a line
// breaks the quote instead of silently rotting the number.
//
// This scan asserts quote PRESENCE and frame-TRUTH only, per DEC-976's own
// text -- it deliberately does NOT assert the neighbouring CSS/copy equals
// the quote (that comparison is the auditor's judgment; a rule may
// legitimately differ from a frame under a recorded ruling, and forcing
// equality would turn the scan into a rubber stamp):
//
//   1) a backticked literal follows every citation, within the same
//      comment;
//   2) that literal appears verbatim (whitespace-normalised) at the
//      cited line of the named frame file under docs/design/.
//
// Enumeration (DEC-808): readdirSync over app/src and src -- never a
// hand-listed manifest of "the files with citations", which desyncs the
// moment a citation is added or moved. The one non-manifest scoping rule
// this test applies (mirrored from the task that landed it, w23-e) is
// structural, not a list of names: every *.css file under app/src, and
// every *.ts/*.tsx file under src, excluding *.test.ts/*.test.tsx (test
// files are not held to the citation contract, mirroring
// css-contract.scan.test.ts's own *.test.tsx exclusion for invariant C/D).
//
// Matching is done against a WHITESPACE-FLATTENED copy of each file (all
// runs of whitespace, and any jsdoc `* `/line-comment `// ` continuation
// marker at a line start, collapsed to one space) so a citation or its
// quote that a house wrapped across a comment's line width -- e.g. a frame
// name split "Chautauqua Public and\n * Portal.dc.html" -- is still found;
// this is a house convention (long comments wrap), never itself asserted.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_SRC = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(APP_SRC, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');

function isTestFile(name: string): boolean {
  return /\.test\.tsx?$/.test(name);
}

/** Every file under `root` matching one of `extensions`, test files
 * excluded, enumerated via readdirSync rather than named (DEC-808). */
function enumerateFiles(root: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!extensions.some((ext) => entry.name.endsWith(ext))) continue;
    if (isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const TARGET_FILES = [
  ...enumerateFiles(APP_SRC, ['.css']),
  ...enumerateFiles(SRC_ROOT, ['.ts', '.tsx']),
];

function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Collapses comment-wrap line breaks (and any run of whitespace) to a
 * single space, so a citation or quote split across a wrapped comment line
 * reads as one contiguous string for matching purposes. */
function flatten(content: string): string {
  return content
    .replace(/\r?\n[ \t]*\*\/?[ \t]?/g, ' ')
    .replace(/\r?\n[ \t]*\/\/[ \t]?/g, ' ')
    .replace(/\s+/g, ' ');
}

interface Citation {
  /** Repo-relative path of the file carrying the citation. */
  file: string;
  /** The frame's filename under docs/design/, e.g. "Chautauqua Review.dc.html". */
  frameFile: string;
  /** The first line number named by the citation (a multi-line citation
   * like ":97/101" or ":117,121,136,140,153" cites several identical
   * lines in this codebase's usage so far; the first is the one checked). */
  firstLine: number;
  /** The full matched citation text, for failure messages. */
  matchText: string;
  /** Index in the FLATTENED source immediately after the citation, where
   * the backtick quote is expected to follow. */
  index: number;
}

// Strict form: docs/design/<Frame Name>.dc.html:<line-blob>
const STRICT_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

// Abbreviated form -- used only where the source is licensed to ship to the
// browser (PUBLIC_CSS / THEME_CSS) and is forbidden from spelling the
// product-name-bearing frame filename: docs/design's "<Sheet>" sheet
// (.dc.html:<line-blob> ...).
const ABBREV_RE = /docs\/design's\s+"([^"]+)"\s+sheet\s*\(\.dc\.html:\s*([\d/,-]+)/g;

function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

function findCitations(file: string, flat: string): Citation[] {
  const out: Citation[] = [];
  for (const m of flat.matchAll(STRICT_RE)) {
    out.push({
      file,
      frameFile: m[1]!,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
      index: m.index! + m[0].length,
    });
  }
  for (const m of flat.matchAll(ABBREV_RE)) {
    out.push({
      file,
      frameFile: `Chautauqua ${normalise(m[1]!)}.dc.html`,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
      index: m.index! + m[0].length,
    });
  }
  return out;
}

/**
 * The first backtick-quoted literal within `window` characters after a
 * citation's end (in the flattened source), or null if none is found.
 * Tolerates an escaped backtick (`\``) immediately inside either
 * delimiter: some citations live inside a JS/TS template-literal string
 * (CARDS_CSS/THEME_CSS), where a bare `` ` `` would terminate the string
 * early, so the source escapes it -- the escape character itself is never
 * part of the quoted CSS/copy and is stripped.
 */
function quoteAfter(flat: string, index: number, window = 400): string | null {
  const slice = flat.slice(index, index + window);
  const m = slice.match(/`([^`]*)`/);
  if (!m) return null;
  return (m[1] ?? '').replace(/\\/g, '');
}

const frameLineCache = new Map<string, string[]>();
function frameLines(frameFile: string): string[] {
  let lines = frameLineCache.get(frameFile);
  if (!lines) {
    lines = readFileSync(join(DESIGN_ROOT, frameFile), 'utf-8').split('\n');
    frameLineCache.set(frameFile, lines);
  }
  return lines;
}

interface Scanned extends Citation {
  flat: string;
}

const ALL_CITATIONS: Scanned[] = TARGET_FILES.flatMap((file) => {
  const relPath = relative(REPO_ROOT, file);
  const flat = flatten(readFileSync(file, 'utf-8'));
  return findCitations(relPath, flat).map((c) => ({ ...c, flat }));
});

describe('frame-citation contract (DEC-976 amendment wave 23, DEC-808)', () => {
  it('enumeration finds citations to check (guards against a silently-empty scan)', () => {
    expect(ALL_CITATIONS.length).toBeGreaterThanOrEqual(23);
  });

  it('every citation is immediately followed, in the same comment, by a backtick-quoted literal', () => {
    const missing = ALL_CITATIONS.filter((c) => {
      const quote = quoteAfter(c.flat, c.index);
      return !quote || quote.length === 0;
    }).map((c) => `${c.file}: "${c.matchText}" has no backtick-quoted literal following it`);
    expect(missing).toEqual([]);
  });

  it('every quoted literal appears verbatim (whitespace-normalised) at its cited frame line', () => {
    const mismatches: string[] = [];
    for (const c of ALL_CITATIONS) {
      const quote = quoteAfter(c.flat, c.index);
      if (!quote) continue; // reported by the presence test above
      const lines = frameLines(c.frameFile);
      const frameLine = lines[c.firstLine - 1];
      if (frameLine === undefined) {
        mismatches.push(
          `${c.file}: "${c.matchText}" cites ${c.frameFile}:${c.firstLine}, which does not exist in that frame`
        );
        continue;
      }
      if (!normalise(frameLine).includes(normalise(quote))) {
        mismatches.push(
          `${c.file}: quote \`${quote}\` for "${c.matchText}" does not appear verbatim at ${c.frameFile}:${c.firstLine} (frame line: "${frameLine.trim()}")`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DEC-976 wave-87 amendment (task w5-j): "the claim receipt becomes
// executable over test files". Wave 86's amendment ruled that a claim is
// three things in one place -- a strict citation landing inside a phone
// frame's extent, the cited line's literal quoted verbatim in backticks
// beside it, and a real assertion beneath pinning what that literal
// declares -- and left it enforced by nothing but each worker's care. This
// block makes the full three-part contract executable for *.test.ts /
// *.test.tsx files under test/ and app/src/, reusing this file's own
// STRICT_RE (via findCitations) and flatten rather than re-implementing
// either (a second copy of a citation vocabulary is a trap with a delay
// fuse, field guide DEC-613) -- and never touching
// test/phone-frame-ledger.scan.test.ts, which owns CLAIMED_FLOOR and is
// in flight under other lanes this wave.
//
// Frame extents are computed HERE, independently, the same way
// phone-frame-ledger.scan.test.ts computes them: from a frame's own
// `width:390px`/`height:844` line up to (but excluding) the next
// `font-size:19px` label line in the same file, or EOF for the last frame
// -- never a listed range, and never the label line itself (the label sits
// ~3 rows ABOVE the frame it labels).
// ---------------------------------------------------------------------------

const TEST_DIR_ROOT = join(REPO_ROOT, 'test');

/** Every *.test.ts/*.test.tsx file under `root` (readdirSync, DEC-808 idiom,
 * never a hand-listed manifest). */
function enumerateTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const TEST_TARGET_FILES = [...enumerateTestFiles(TEST_DIR_ROOT), ...enumerateTestFiles(APP_SRC)];

interface FrameExtent {
  fileName: string;
  line: number;
  extentEnd: number;
}

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

const LABEL_LINE_RE = />([^<]+)<\/span>/;
function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_LINE_RE.test(line);
}

function designFileNames(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

function frameExtentsInFile(fileName: string): FrameExtent[] {
  const lines = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n');
  const labelLineNums: number[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) labelLineNums.push(lineNo);
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });
  return frameLineNums.map((line) => {
    const nextLabel = labelLineNums.find((l) => l > line);
    return { fileName, line, extentEnd: nextLabel ?? Infinity };
  });
}

const ALL_FRAME_EXTENTS: FrameExtent[] = designFileNames().flatMap(frameExtentsInFile);

function isInsideAPhoneFrame(frameFile: string, firstLine: number): boolean {
  return ALL_FRAME_EXTENTS.some(
    (f) => f.fileName === frameFile && firstLine >= f.line && firstLine < f.extentEnd
  );
}

/** Locates a citation's SOURCE line (its position in the citing test file --
 * distinct from `firstLine`, which is the FRAME's cited line) via a
 * sequential search with a rolling cursor, so repeated identical matchTexts
 * in one file resolve in appearance order. Tolerates whitespace collapsed by
 * `flatten` (a wrapped comment) by falling back to a regex that rejoins
 * words with the same connector flatten() would have collapsed. */
function locateSourceIndex(raw: string, matchText: string, searchFrom: number): number {
  // matchText came out of flatten(), which collapses a wrapped comment's
  // line break AND its continuation marker (`* `/`// `) to one space -- so
  // the raw text may have `// ` or `* ` sitting where matchText has a bare
  // space. Rejoin each space with the same connector flatten() would have
  // collapsed, so a name split across a wrapped `//` comment (e.g.
  // "...Chautauqua\n// Comms.dc.html:177") still resolves.
  //
  // The connector is all-optional, so this pattern also matches the ordinary
  // unwrapped spelling -- it is a SUPERSET of a literal indexOf, and the
  // earliest position it reports is the true next occurrence of this
  // citation in either form.
  //
  // That superset relationship is the whole point, and why the literal
  // indexOf below is only allowed to WIN A TIE rather than short-circuit.
  // Citations are resolved in flattened-source order against a rolling
  // cursor, which is only sound if each lookup returns the EARLIEST
  // remaining occurrence. Preferring a literal hit outright breaks that:
  // when a file cites the same frame span twice -- once wrapped across a
  // comment line break, once contiguous further down -- the wrapped first
  // citation finds no literal match at its own position and silently
  // resolves to the CONTIGUOUS one instead, leapfrogging it. The cursor
  // then advances past that stolen position and the second, genuinely
  // contiguous citation can no longer be found at all, so a file with
  // perfectly well-formed citations throws "flatten() and the raw file
  // disagree on its text". test/portal-edit-390-frames.test.ts is exactly
  // this shape: its header comment wraps
  // "docs/design/Chautauqua Public\n// and Portal.dc.html:600-674" across
  // lines 2-3 and its describe() repeats the same span contiguously.
  const CONNECTOR = String.raw`\s*(?:\/\/|\*\/?)?\s*`;
  const pattern = matchText
    .split(' ')
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(CONNECTOR);
  const m = raw.slice(searchFrom).match(new RegExp(pattern));
  const wrapped = m?.index === undefined ? -1 : searchFrom + m.index;
  const direct = raw.indexOf(matchText, searchFrom);

  if (wrapped === -1 && direct === -1) {
    throw new Error(
      `could not locate citation "${matchText}" in its own source file to check line adjacency -- ` +
        `flatten() and the raw file disagree on its text`
    );
  }
  if (wrapped === -1) return direct;
  if (direct === -1) return wrapped;
  return Math.min(direct, wrapped);
}

function lineNumberAt(raw: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (raw.charCodeAt(i) === 10) n++;
  return n;
}

interface TestPhoneCitation extends Citation {
  sourceLine: number;
  flat: string;
  raw: string;
}

const TEST_PHONE_CITATIONS: TestPhoneCitation[] = [];
for (const file of TEST_TARGET_FILES) {
  const relPath = relative(REPO_ROOT, file);
  const raw = readFileSync(file, 'utf-8');
  const flat = flatten(raw);
  const citations = findCitations(relPath, flat).filter((c) => isInsideAPhoneFrame(c.frameFile, c.firstLine));
  let cursor = 0;
  for (const c of citations) {
    const idx = locateSourceIndex(raw, c.matchText, cursor);
    cursor = idx + c.matchText.length;
    TEST_PHONE_CITATIONS.push({ ...c, flat, raw, sourceLine: lineNumberAt(raw, idx) });
  }
}

/** How many source lines beneath a test-file citation's own line a real
 * `expect(` must appear within, to count as a receipted claim. */
const EXPECT_PROXIMITY_LINES = 6;

/** Ratchet ceiling (DEC-976 wave-87 amendment): the count of test-file
 * phone-frame citations that are NOT fully receipted (missing either the
 * backtick quote or a nearby `expect(`), measured on this branch. This is a
 * CEILING on debt, not a floor on coverage (mirror of CLAIMED_FLOOR in
 * test/phone-frame-ledger.scan.test.ts, which this file never touches): it
 * may only be LOWERED as unreceipted claims get fixed, never raised to
 * paper over a regression, and this task does not fix other lanes' test
 * files to force it down -- honest debt beats a green scan that hides it.
 *
 * Lowered 14 -> 2 by the wave-107 merge train (DEC-385 wave-93 rules this
 * constant merge-train-only), re-measured on the integrated tree per DEC-989
 * clause a rather than copied from any branch's note. Lowered 2 -> 0 by
 * task w5-r (DEC-976 wave-109 amendment): fixed this file's own negative
 * control (was anchored on a real frame path), tightened the proximity of
 * one describe block's citation, and re-measured -- the other two named
 * offenders in the ImportWizard phoneColumns test were already receipted
 * on this main SHA (fixed upstream between the wave-109 report and this
 * task). The two-sided companion at the bottom of this file is what forced
 * the tightening. */
const UNRECEIPTED_CLAIM_CEILING = 0;

// ---------------------------------------------------------------------------
// Task w14-a (DEC-976 wave-14m amendment): two predicate changes to
// computeUnreceiptedCitations below.
//
// (1) CREDIT A FRAME-VERBATIM HELPER. The corpus's newer idiom -- see
// app/src/pages/Contacts-import.desktop-frame-verdicts.render.test.tsx:37-42
// for the canonical body -- reads DESIGN_FILE, indexes `lines[lineNo - 1]`,
// and calls `expect(line).toBe(literal)`. That is STRICTLY STRONGER than a
// comment quote plus a nearby `expect(`: it fails the owning test when the
// pack is re-cut, where a quote is inert prose. A citation is credited by a
// helper only when, within its own comment block plus EXPECT_PROXIMITY_LINES
// source lines beneath, there is a call to a helper that (a) is declared in
// the SAME file, (b) whose BODY both reads the design file and calls
// `expect(...).toBe(...)`, and (c) is invoked with the citation's cited
// FIRST line number as its first argument. All three are structural --
// derived from the helper's own body shape, never from its NAME (DEC-180: a
// name allowlist is not a population). Some files call it `frameLine`,
// others `verbatimLine`; both qualify by shape, neither by name.
//
// (2) EXEMPT HEADER-BLOCK SCOPE CITATIONS. A citation above the file's first
// `describe(` names the frame the FILE is about (DEC-808's already-
// adjudicated `.dc.html:<line>` naming shorthand) and no `expect(` can
// legally sit in a header, so it is exempt from the receipt check outright.
// The exemption is paid for by a companion assertion below: a file carrying
// a header-block citation into frame file F must also carry at least one
// FULLY receipted citation (quote+expect, or helper credit) into that same
// F elsewhere in the file -- otherwise the file declares a scope it verifies
// nothing about.
// ---------------------------------------------------------------------------

/** Every named `function NAME(...) { ... }` declaration in `raw`, with its
 * body extracted via a balanced-brace scan from the declaration's opening
 * `{` -- never a naive regex body capture, which breaks the instant a
 * helper's own body contains a nested `{}` (an object literal, an arrow
 * function, an `if`). */
function extractFunctionDecls(raw: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const headRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = headRe.exec(raw))) {
    const braceStart = headRe.lastIndex - 1;
    let depth = 1;
    let i = braceStart + 1;
    while (i < raw.length && depth > 0) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') depth--;
      i++;
    }
    out.push({ name: m[1]!, body: raw.slice(braceStart + 1, i - 1) });
  }
  return out;
}

/** A helper body "reads the design file" when a `readFileSync(` call's
 * argument names `docs`/`design` inline, or resolves (via a same-file
 * `const`/`let`/`var` declaration) to a value that does. Never satisfied by
 * the helper's NAME -- a `verbatimLine`-named function whose body reads
 * something else entirely does not qualify. */
function bodyReadsDesignFile(body: string, raw: string): boolean {
  const callIdx = body.search(/readFileSync\s*\(/);
  if (callIdx === -1) return false;
  const argWindow = body.slice(callIdx, callIdx + 200);
  if (/docs/i.test(argWindow) && /design/i.test(argWindow)) return true;
  const identMatch = argWindow.match(/readFileSync\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*[,)]/);
  if (!identMatch) return false;
  const varName = identMatch[1]!;
  const declRe = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=([^;]*);`, 's');
  const dm = raw.match(declRe);
  return !!dm && /docs/i.test(dm[1]!) && /design/i.test(dm[1]!);
}

/** A helper body "calls expect(...).toBe(...)" -- the shape that fails the
 * owning test outright when the cited literal stops matching, rather than
 * merely sitting beside an unrelated assertion. */
function bodyCallsExpectToBe(body: string): boolean {
  return /expect\([\s\S]*?\)\s*\.toBe\(/.test(body);
}

/** Qualifying frame-verbatim helper names declared in `raw` (DEC-180:
 * derived from each function's BODY shape via extractFunctionDecls, never
 * from a name list). */
function qualifyingHelperNames(raw: string): Set<string> {
  const names = new Set<string>();
  for (const fn of extractFunctionDecls(raw)) {
    if (bodyReadsDesignFile(fn.body, raw) && bodyCallsExpectToBe(fn.body)) {
      names.add(fn.name);
    }
  }
  return names;
}

const HELPER_NAMES_CACHE = new Map<string, Set<string>>();
function helperNamesFor(raw: string): Set<string> {
  let names = HELPER_NAMES_CACHE.get(raw);
  if (!names) {
    names = qualifyingHelperNames(raw);
    HELPER_NAMES_CACHE.set(raw, names);
  }
  return names;
}

/** True when `windowText` contains a call to one of `helperNames` whose
 * FIRST argument is exactly `firstLine` -- `\s*` matches across the
 * newlines a multi-line call like `verbatimLine(\n  709,\n  '...'\n)`
 * wraps onto, so a wrapped call is found the same as an inline one. */
function hasHelperCredit(windowText: string, helperNames: ReadonlySet<string>, firstLine: number): boolean {
  for (const name of helperNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\s*\\(\\s*(\\d+)\\s*[,)]`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(windowText))) {
      if (Number(m[1]) === firstLine) return true;
    }
  }
  return false;
}

const FIRST_DESCRIBE_LINE_CACHE = new Map<string, number>();
/** The line number of a file's first `describe(` call, or Infinity if it has
 * none -- a citation strictly above this line sits in the file's header
 * block, naming the frame the file is about rather than proving a claim. */
function firstDescribeLine(raw: string): number {
  let line = FIRST_DESCRIBE_LINE_CACHE.get(raw);
  if (line === undefined) {
    const idx = raw.search(/\bdescribe\s*\(/);
    line = idx === -1 ? Infinity : lineNumberAt(raw, idx);
    FIRST_DESCRIBE_LINE_CACHE.set(raw, line);
  }
  return line;
}

function isHeaderBlockCitation(c: { sourceLine: number; raw: string }): boolean {
  return c.sourceLine < firstDescribeLine(c.raw);
}

/** True when `c` is receipted by EITHER the quote+nearby-expect( rule or a
 * qualifying helper call -- the two independent receipt shapes this file
 * now credits. Never applies the header-block exemption (that is a
 * separate, prior gate in computeUnreceiptedCitations and in the companion
 * check below -- a header citation that also happens to satisfy this
 * predicate should not be double-counted as its own companion). */
function isFullyReceipted(c: Citation & { sourceLine: number; flat: string; raw: string }): boolean {
  const quote = quoteAfter(c.flat, c.index);
  const rawLines = c.raw.split('\n');
  const window = rawLines.slice(c.sourceLine - 1, c.sourceLine - 1 + EXPECT_PROXIMITY_LINES);
  if (quote && quote.length > 0 && window.some((l) => l.includes('expect('))) return true;
  const helperNames = helperNamesFor(c.raw);
  if (helperNames.size === 0) return false;
  return hasHelperCredit(window.join('\n'), helperNames, c.firstLine);
}

/** Shared receipt check (quote presence + nearby `expect(`, OR a qualifying
 * helper credit; header-block scope citations exempt), factored out so the
 * phone describe block below and the desktop block (DEC-808 wave-107 task
 * w3-v) run the identical rule rather than each re-implementing it -- a
 * second copy of a vocabulary is a trap with a delay fuse (DEC-613). */
function computeUnreceiptedCitations(
  citations: readonly (Citation & { sourceLine: number; flat: string; raw: string })[]
): string[] {
  const unreceipted: string[] = [];
  for (const c of citations) {
    if (isHeaderBlockCitation(c)) continue; // DEC-808 naming shorthand, exempt (paid for below)
    if (isFullyReceipted(c)) continue;
    const quote = quoteAfter(c.flat, c.index);
    if (!quote || quote.length === 0) {
      unreceipted.push(`${c.file}:${c.sourceLine} — ${c.matchText} (no backtick-quoted literal)`);
      continue;
    }
    unreceipted.push(`${c.file}:${c.sourceLine} — ${c.matchText} (no expect( within ${EXPECT_PROXIMITY_LINES} lines beneath)`);
  }
  return unreceipted;
}

/** The companion the header-block exemption is paid for with: every file
 * that carries a header-block citation into frame file F must carry at
 * least one FULLY receipted (non-header) citation into that same F
 * elsewhere in the file -- otherwise the file declares a scope it verifies
 * nothing about. Grouped by (file, frameFile) rather than by file alone, so
 * a file citing two different frames in its header is checked per frame. */
function computeHeaderScopeWithoutReceiptOffenders(
  citations: readonly (Citation & { sourceLine: number; flat: string; raw: string })[]
): string[] {
  const byFileFrame = new Map<string, (Citation & { sourceLine: number; flat: string; raw: string })[]>();
  for (const c of citations) {
    const key = `${c.file}::${c.frameFile}`;
    const group = byFileFrame.get(key);
    if (group) group.push(c);
    else byFileFrame.set(key, [c]);
  }
  const offenders: string[] = [];
  for (const [key, group] of byFileFrame) {
    if (!group.some(isHeaderBlockCitation)) continue;
    const hasReceiptedNonHeader = group.some((c) => !isHeaderBlockCitation(c) && isFullyReceipted(c));
    if (!hasReceiptedNonHeader) {
      const [file, frameFile] = key.split('::');
      offenders.push(`${file} declares header-block scope into ${frameFile} but carries no fully-receipted (non-header) citation into it`);
    }
  }
  return offenders.sort();
}

/** Ratchet ceiling (task w14-a companion, DEC-808's header-block exemption
 * pay-for-it rule): the count of (file, frameFile) pairs where the file
 * carries a header-block scope citation into that frame but no fully-
 * receipted (non-header) citation into the same frame elsewhere in the
 * file. Seeded at 22, measured on THIS branch (DEC-989 clause a) by running
 * the scan, not invented as 0 -- this task adds the check but does not fix
 * any of these 22 files' bodies (out of this task's stated scope, which is
 * computeUnreceiptedCitations plus new helpers/controls only). May only be
 * LOWERED as offenders get fixed, never raised to paper over a regression.
 *
 * Lowered 22 -> 8 by task w17-f (DEC-998 wave-17, Content cluster, sole
 * owner of this constant this wave): fixed this worktree's two owned
 * offenders (FilesLibrary.frame390.render.test.tsx,
 * FilesLibrary.session-size-fuse.receipt.render.test.tsx), each by adding a
 * genuine in-body citation into Chautauqua Content.dc.html (backtick literal
 * read verbatim from the frame line, receipted by a nearby expect( / a
 * qualifying verbatimLine helper call), then re-ran this scan forced to -1
 * and measured the remaining population directly rather than assuming 22-2.
 * Per DEC-998 wave-17 clause (b), only what this worktree measured and fixed
 * is landed here -- the other 8 measured offenders (PhoneAgenda.clash390,
 * PhoneAgenda.clashMove390, PlanEditor.frame390, ReviewerQueue.hub390-frame,
 * Scorecard.unscored390, SettingsDrill.publicPages390,
 * SettingsDrill.savedEmbeds390, cfp-stored-label-register) belong to sibling
 * lanes v12m-w17-c/d/e; the merge train re-seeds this constant to the
 * batch-measured truth (forced to -1, offender list read fresh) once those
 * lanes land, rather than trusting any branch's own note. */
const HEADER_SCOPE_WITHOUT_RECEIPT_CEILING = 8;

describe('test-file claims are receipted: quote + nearby expect() (DEC-976 wave-87 amendment, task w5-j)', () => {
  it('the test-file phone-frame citation population is non-empty and contains a known-good example', () => {
    expect(TEST_PHONE_CITATIONS.length).toBeGreaterThan(0);
    // app/src/phone-page-scaffold.test.ts:116 cites
    // `docs/design/Chautauqua Speakers.dc.html:261` inside a comment that
    // also carries a backtick-quoted literal, followed within
    // EXPECT_PROXIMITY_LINES by a real `expect(` -- a fully-receipted claim,
    // confirmed against the measured tree before this test was written.
    const known = TEST_PHONE_CITATIONS.some(
      (c) =>
        c.file === 'app/src/phone-page-scaffold.test.ts' &&
        c.sourceLine === 116 &&
        c.frameFile === 'Chautauqua Speakers.dc.html' &&
        c.firstLine === 261
    );
    expect(known).toBe(true);
  });

  it(`every test-file phone-frame citation is receipted: a backtick quote in the same comment, and a real expect( within ${EXPECT_PROXIMITY_LINES} source lines beneath it (ceiling: UNRECEIPTED_CLAIM_CEILING, may only be lowered)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_PHONE_CITATIONS);
    if (unreceipted.length > UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `${unreceipted.length} test-file phone-frame citations are unreceipted, above the ratchet ` +
          `ceiling of ${UNRECEIPTED_CLAIM_CEILING} (UNRECEIPTED_CLAIM_CEILING may only be LOWERED, ` +
          `never raised to paper over a regression):\n${unreceipted.join('\n')}`
      );
    }
    expect(unreceipted.length).toBeLessThanOrEqual(UNRECEIPTED_CLAIM_CEILING);
  });

  it(`every file's header-block scope citation into a phone frame is paid for by at least one fully-receipted citation into the same frame elsewhere in the file (ceiling: HEADER_SCOPE_WITHOUT_RECEIPT_CEILING, may only be lowered)`, () => {
    const offenders = computeHeaderScopeWithoutReceiptOffenders(TEST_PHONE_CITATIONS);
    if (offenders.length > HEADER_SCOPE_WITHOUT_RECEIPT_CEILING) {
      throw new Error(
        `${offenders.length} files declare header-block phone-frame scope with no receipted citation to pay for it, ` +
          `above the ratchet ceiling of ${HEADER_SCOPE_WITHOUT_RECEIPT_CEILING} (may only be LOWERED, ` +
          `never raised to paper over a regression):\n${offenders.join('\n')}`
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(HEADER_SCOPE_WITHOUT_RECEIPT_CEILING);
  });
});

// ---------------------------------------------------------------------------
// DEC-808 wave-107 amendment (task w3-v): a symmetric DESKTOP receipt
// population. The two describe blocks above (wave-23 file-level receipts and
// wave-87's test-file phone-frame receipts) only ever checked PHONE claims;
// the wave-107 planner amendment to DEC-808 measured that 64 desktop frames
// are claimed today (99 once the in-flight w4-k/w5-a..e lanes land) with NO
// receipt population checking them at all -- the desktop ledger
// (test/desktop-frame-ledger.scan.test.ts) only asserts a claiming citation
// RESOLVES to a real line, never that it carries a quote or a nearby
// `expect(`. This block closes that gap for test-file citations, reusing
// this file's own `findCitations`, `flatten`, `quoteAfter`,
// `locateSourceIndex`, `lineNumberAt` and the new `computeUnreceiptedCitations`
// helper above rather than re-implementing any of them (DEC-613).
//
// DESKTOP CLASSIFICATION: test/desktop-frame-ledger.scan.test.ts derives "is
// this label-opened frame desktop" itself but exports ONLY `CLAIMED_FLOOR`,
// not a reusable classifier function -- so this block DERIVES the identical
// grammar rather than diverge from it (a second copy of a vocabulary is a
// trap with a delay fuse, DEC-613; if the ledger ever exports a classifier,
// import it here instead of re-deriving):
//   - a label line is `font-size:19px` plus a closing tag with a title
//     inside it, matched by />([^<]+)<\//  (wider than this file's own
//     phone-oriented `isLabelLine`, which requires `</span>` specifically --
//     the ledger widens to any closing tag because some desktop labels sit
//     on an `<a>`, e.g. Chautauqua Home.dc.html:205);
//   - a label opens a frame whose extent runs to the next label line (or
//     EOF);
//   - the frame is DESKTOP when that extent contains no `width:390px` +
//     `height:844` line anywhere in it (this file's own `isFrameLine`,
//     reused verbatim -- that part of the grammar is common to both files
//     already and is not duplicated here).
// This block does NOT reproduce the ledger's further exclusions (template
// interpolations, explainer panels) -- those narrow which frames count
// toward the desktop POPULATION total; this block only asks the narrower
// geometric question "does this cited line fall inside a desktop frame's
// extent", which the exclusions do not change.
const DESKTOP_LABEL_RE = />([^<]+)<\//;

function isDesktopLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && DESKTOP_LABEL_RE.test(line);
}

interface DesktopFrameExtent {
  fileName: string;
  line: number;
  extentEnd: number;
}

function desktopFrameExtentsInFile(fileName: string): DesktopFrameExtent[] {
  const lines = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n');
  const labelLineNums: number[] = [];
  lines.forEach((content, idx) => {
    if (isDesktopLabelLine(content)) labelLineNums.push(idx + 1);
  });
  const out: DesktopFrameExtent[] = [];
  labelLineNums.forEach((line, i) => {
    const extentEnd = labelLineNums[i + 1] ?? Infinity;
    const extentLines = lines.slice(line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    if (extentLines.some(isFrameLine)) return; // has a width:390px+height:844 line -- phone, not desktop
    out.push({ fileName, line, extentEnd });
  });
  return out;
}

const ALL_DESKTOP_FRAME_EXTENTS: DesktopFrameExtent[] = designFileNames().flatMap(desktopFrameExtentsInFile);

function isInsideADesktopFrame(frameFile: string, firstLine: number): boolean {
  return ALL_DESKTOP_FRAME_EXTENTS.some(
    (f) => f.fileName === frameFile && firstLine >= f.line && firstLine < f.extentEnd
  );
}

const TEST_DESKTOP_CITATIONS: TestPhoneCitation[] = [];
for (const file of TEST_TARGET_FILES) {
  const relPath = relative(REPO_ROOT, file);
  const raw = readFileSync(file, 'utf-8');
  const flat = flatten(raw);
  const citations = findCitations(relPath, flat).filter((c) => isInsideADesktopFrame(c.frameFile, c.firstLine));
  let cursor = 0;
  for (const c of citations) {
    const idx = locateSourceIndex(raw, c.matchText, cursor);
    cursor = idx + c.matchText.length;
    TEST_DESKTOP_CITATIONS.push({ ...c, flat, raw, sourceLine: lineNumberAt(raw, idx) });
  }
}

/** Ratchet ceiling, mirroring UNRECEIPTED_CLAIM_CEILING's own contract
 * exactly, for the desktop half: the count of test-file desktop-frame
 * citations that are NOT fully receipted, measured on THIS branch by
 * running the scan (never copied from an audit doc, DEC-989 clause a). A
 * ceiling on debt, not a floor on coverage -- may only be LOWERED as
 * unreceipted claims get fixed, never raised to paper over a regression.
 * This task does not fix other lanes' test files to force it down.
 *
 * Lowered 15 -> 10 (2026-08-20, task w12-t, DEC-989): fixed this branch's
 * five app/src-half offenders (App.render.test.tsx:281,
 * Speakers.render.test.tsx:119/138, RecentSends.render.test.tsx:133,
 * ContactsTable.render.test.tsx:198/203, select-caret.scan.test.ts:4) by
 * relocating each frame-citation comment to sit within
 * EXPECT_PROXIMITY_LINES of the `expect(` that already receipts its
 * claim (never re-pointing or shortening a citation, DEC-967), and adding
 * a missing backtick quote where the original relied on an incidental
 * template-literal backtick that moved out of range. The remaining 10
 * offenders are all under test/** (companion lane w12-s's half) and are
 * untouched by this task; the merge train re-measures the integrated
 * value per DEC-989 clause a.
 *
 * Lowered 15 -> 5 by task w12-s (2026-08-20, DEC-976 wave-123 amendment):
 * fixed all 10 `test/**` offenders by moving each citation's proof
 * (`expect(`) into EXPECT_PROXIMITY_LINES of its own citation line, never
 * re-pointing or weakening an assertion. The 5 remaining offenders are all
 * under `app/src/**` (App.render.test.tsx, Speakers.render.test.tsx,
 * RecentSends.render.test.tsx, ContactsTable.render.test.tsx,
 * select-caret.scan.test.ts) -- lane w12-t's half, re-measured on this
 * branch per DEC-989 clause a, not copied from any audit doc.
 *
 * Thunderdome megabatch (wave 123): lanes w12-t and w12-s drained exactly
 * complementary halves of this population (5 under app/src/**, 10 under
 * test/**) and landed in one pass, so the integrated tree has none left.
 * Re-measured here on the merged tree, not copied from either branch.
 * This ratchet may only fall. */
const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 0;

/** Ratchet ceiling, desktop half of HEADER_SCOPE_WITHOUT_RECEIPT_CEILING's
 * own contract exactly (task w14-a companion). Seeded at 2, measured on
 * THIS branch, not invented as 0 -- may only be LOWERED, never raised to
 * paper over a regression. */
const DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING = 2;

describe('test-file DESKTOP-frame claims are receipted: quote + nearby expect() (DEC-808 wave-107, task w3-v)', () => {
  it('the test-file desktop-frame citation population is non-empty (guards against a silently-empty scan)', () => {
    expect(TEST_DESKTOP_CITATIONS.length).toBeGreaterThan(0);
  });

  it(`every test-file desktop-frame citation is receipted: a backtick quote in the same comment, and a real expect( within ${EXPECT_PROXIMITY_LINES} source lines beneath it (ceiling: DESKTOP_UNRECEIPTED_CLAIM_CEILING, may only be lowered)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_DESKTOP_CITATIONS);
    if (unreceipted.length > DESKTOP_UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `${unreceipted.length} test-file desktop-frame citations are unreceipted, above the ratchet ` +
          `ceiling of ${DESKTOP_UNRECEIPTED_CLAIM_CEILING} (DESKTOP_UNRECEIPTED_CLAIM_CEILING may only ` +
          `be LOWERED, never raised to paper over a regression):\n${unreceipted.join('\n')}`
      );
    }
    expect(unreceipted.length).toBeLessThanOrEqual(DESKTOP_UNRECEIPTED_CLAIM_CEILING);
  });

  // Two-sided companion (DEC-808 wave-106's requirement that every campaign
  // ratchet gets one): FAILS when the measured count falls BELOW the
  // constant, so a stale ceiling that's higher than reality cannot survive a
  // wave that fixes desktop-receipt debt. DESKTOP_UNRECEIPTED_CLAIM_CEILING
  // was lowered 28 -> 23 by task w5-s (DEC-976 wave-109 amendment), which
  // added the missing backtick receipt to the 17 citations that had none --
  // 5 of those 17 became fully receipted (a nearby expect( was already
  // present), the other 12 remain unreceipted for the separate "no expect(
  // within 6 lines" reason, out of this task's scope. Re-measured on THIS
  // branch (DEC-989 clause a), so this companion is expected GREEN today
  // (measured 23, ceiling 23) -- unlike UNRECEIPTED_CLAIM_CEILING's own
  // companion below, which is deliberately red because that constant is
  // DEC-385 wave-93 merge-train-only and this task does not edit it.
  it(`never measures FEWER unreceipted desktop-frame citations than DESKTOP_UNRECEIPTED_CLAIM_CEILING (${DESKTOP_UNRECEIPTED_CLAIM_CEILING}) without the ceiling being lowered to match (a stale ceiling hides fixed debt)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_DESKTOP_CITATIONS);
    if (unreceipted.length < DESKTOP_UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `measured ${unreceipted.length} unreceipted test-file desktop-frame citations, below the ` +
          `ratchet ceiling of ${DESKTOP_UNRECEIPTED_CLAIM_CEILING}. This is the ratchet working -- debt ` +
          `got fixed. Lower the ceiling by replacing the line:\n` +
          `  const DESKTOP_UNRECEIPTED_CLAIM_CEILING = ${unreceipted.length};`
      );
    }
    expect(unreceipted.length).toBeGreaterThanOrEqual(DESKTOP_UNRECEIPTED_CLAIM_CEILING);
  });

  it(`every file's header-block scope citation into a desktop frame is paid for by at least one fully-receipted citation into the same frame elsewhere in the file (ceiling: DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING, may only be lowered)`, () => {
    const offenders = computeHeaderScopeWithoutReceiptOffenders(TEST_DESKTOP_CITATIONS);
    if (offenders.length > DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING) {
      throw new Error(
        `${offenders.length} files declare header-block desktop-frame scope with no receipted citation to pay for it, ` +
          `above the ratchet ceiling of ${DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING} (may only be LOWERED, ` +
          `never raised to paper over a regression):\n${offenders.join('\n')}`
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING);
  });
});

// Two-sided companion for UNRECEIPTED_CLAIM_CEILING (the PHONE ceiling
// above), which DEC-808 wave-106 requires of every campaign ratchet but
// which the wave-87 amendment never added. FAILS when the measured count
// falls BELOW the constant, printing the exact replacement line -- mirroring
// desktop-frame-ledger.scan.test.ts's own CLAIMED_FLOOR "never claims MORE"
// companion in shape (a two-sided ratchet, not a one-way floor).
//
// This companion was born RED on task w3-v's branch: it measured 2
// unreceipted phone-frame citations against a constant of 14 that wave-87
// had seeded and that other branches' fixes had since made stale. Because
// DEC-385 wave-93 rules UNRECEIPTED_CLAIM_CEILING a merge-train-only edit,
// w3-v added the companion but left the constant alone, and the wave-107
// merge train re-measured on the integrated tree (still 2, per DEC-989
// clause a -- re-derived, not copied) and lowered 14 -> 2. Both sides now
// sit at the measured value, so this is GREEN and the phone ceiling is
// honest again, matching the desktop pair above.
describe('UNRECEIPTED_CLAIM_CEILING companion (two-sided ratchet, DEC-808 wave-106 requirement)', () => {
  it(`never measures FEWER unreceipted phone-frame citations than UNRECEIPTED_CLAIM_CEILING (${UNRECEIPTED_CLAIM_CEILING}) without the ceiling being lowered to match by the merge train (a stale ceiling hides fixed debt)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_PHONE_CITATIONS);
    if (unreceipted.length < UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `measured ${unreceipted.length} unreceipted test-file phone-frame citations, below the ` +
          `ratchet ceiling of ${UNRECEIPTED_CLAIM_CEILING}. This is the ratchet working -- debt got ` +
          `fixed. The merge train (not a worker mid-lane, DEC-385 wave-93) should lower the ceiling ` +
          `by replacing the line:\n  const UNRECEIPTED_CLAIM_CEILING = ${unreceipted.length};`
      );
    }
    expect(unreceipted.length).toBeGreaterThanOrEqual(UNRECEIPTED_CLAIM_CEILING);
  });
});

// Synthetic controls (DEC-808 wave-107, task w3-v item 3): run the receipt
// logic itself through this file's own `flatten`/`findCitations`/
// `quoteAfter` helpers (never a re-implementation) against small fixture
// strings, so the receipt rule's two failure modes -- missing quote, and
// quote-present-but-no-nearby-expect -- are each independently confirmed to
// fire (negative control) and independently confirmed NOT to fire when the
// citation is fully receipted (positive control).
/** Builds a synthetic citation-plus-sourceLine object from a fixture's raw
 * source, reusing this file's own findCitations/flatten/locateSourceIndex/
 * lineNumberAt (DEC-613: never a second copy of this file's own citation
 * vocabulary, even for its own fixtures). Assumes exactly one citation in
 * the fixture; multi-citation fixtures build their own list inline (see
 * below) the same way ALL_CITATIONS/TEST_PHONE_CITATIONS do. */
function syntheticCitation(file: string, raw: string): TestPhoneCitation {
  const flat = flatten(raw);
  const [citation] = findCitations(file, flat);
  if (!citation) throw new Error(`fixture for ${file} carries no findable citation`);
  const idx = locateSourceIndex(raw, citation.matchText, 0);
  return { ...citation, flat, raw, sourceLine: lineNumberAt(raw, idx) };
}

describe('receipt-checking synthetic controls (positive/negative, DEC-808 wave-107, task w3-v)', () => {
  it('flags a citation with no following backtick quote at all (negative control)', () => {
    // DEC-976 wave-109 amendment (task w5-r): this fixture must NOT use a real
    // frame path -- a synthetic sentinel anchored on a real artefact joins the
    // population the scan exists to police (field guide, wave-107/108). The
    // fixture filename below deliberately names a frame that does not exist
    // in docs/design/, so this control still exercises the missing-quote
    // branch without resolving to any real citation.
    const src = 'see docs/design/Chautauqua Fixture.dc.html:261 for the rule, no quote follows this at all';
    const flat = flatten(src);
    const [citation] = findCitations('fixture.ts', flat);
    expect(citation).toBeDefined();
    const quote = quoteAfter(flat, citation!.index);
    expect(quote === null || quote.length === 0).toBe(true);
  });

  it('does not flag a citation with a quote AND a nearby expect( (positive control)', () => {
    const src = [
      '// docs/design/Chautauqua Speakers.dc.html:261 `.chq-speaker-name{font-weight:600}`',
      'expect(el).toHaveStyle("font-weight:600");',
    ].join('\n');
    const flat = flatten(src);
    const [citation] = findCitations('fixture.ts', flat);
    expect(citation).toBeDefined();
    const quote = quoteAfter(flat, citation!.index);
    expect(quote).toBe('.chq-speaker-name{font-weight:600}');
    expect(quote === null || quote.length === 0).toBe(false);
    const rawLines = src.split('\n');
    const window = rawLines.slice(0, EXPECT_PROXIMITY_LINES);
    expect(window.some((l) => l.includes('expect('))).toBe(true);
  });

  // Task w14-a controls: the frame-verbatim helper credit and the
  // header-block exemption plus its companion. Each fixture reuses this
  // file's own findCitations/flatten/locateSourceIndex/lineNumberAt (DEC-613)
  // via `syntheticCitation` below, and -- per the negative control above --
  // never anchors on a real frame path.

  it('credits a qualifying frame-verbatim helper call with the correct cited line as fully receipted, even with no backtick quote at all (positive control)', () => {
    const raw = [
      'function verbatimLine(lineNo, literal) {',
      '  const lines = readFileSync(join("docs", "design", "Chautauqua Fixture.dc.html"), "utf-8").split("\\n");',
      '  const line = lines[lineNo - 1];',
      '  expect(line).toBe(literal);',
      '}',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:261 no quote follows this comment at all',
      '    verbatimLine(261, "whatever the frame says");',
      '  });',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-helper-credit.ts', raw);
    expect(helperNamesFor(citation.raw).has('verbatimLine')).toBe(true);
    expect(computeUnreceiptedCitations([citation])).toEqual([]);
  });

  it('does NOT credit a qualifying helper called with the WRONG line number (negative control)', () => {
    const raw = [
      'function verbatimLine(lineNo, literal) {',
      '  const lines = readFileSync(join("docs", "design", "Chautauqua Fixture.dc.html"), "utf-8").split("\\n");',
      '  const line = lines[lineNo - 1];',
      '  expect(line).toBe(literal);',
      '}',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:261 no quote follows this comment at all',
      '    verbatimLine(999, "whatever the frame says");',
      '  });',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-wrong-line.ts', raw);
    expect(computeUnreceiptedCitations([citation])).toEqual([
      `${citation.file}:${citation.sourceLine} — ${citation.matchText} (no backtick-quoted literal)`,
    ]);
  });

  it('does NOT credit a same-named helper whose body never reads the design file (negative control -- DEC-180: shape, not name)', () => {
    const raw = [
      'function verbatimLine(lineNo, literal) {',
      '  const line = SOME_OTHER_ARRAY[lineNo - 1];',
      '  expect(line).toBe(literal);',
      '}',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:261 no quote follows this comment at all',
      '    verbatimLine(261, "whatever the frame says");',
      '  });',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-non-reading-helper.ts', raw);
    expect(helperNamesFor(citation.raw).size).toBe(0);
    expect(computeUnreceiptedCitations([citation])).toEqual([
      `${citation.file}:${citation.sourceLine} — ${citation.matchText} (no backtick-quoted literal)`,
    ]);
  });

  it("exempts a header-block citation (above the file's first describe()) from the receipt check", () => {
    const raw = [
      '// docs/design/Chautauqua Fixture.dc.html:261 scope header, no quote, no expect(',
      '',
      'describe("x", () => {',
      '  it("y", () => {});',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-header-only.ts', raw);
    expect(isHeaderBlockCitation(citation)).toBe(true);
    expect(computeUnreceiptedCitations([citation])).toEqual([]);
  });

  it("flags a header-block citation whose file carries no OTHER receipted citation into the same frame (the exemption's companion)", () => {
    const raw = [
      '// docs/design/Chautauqua Fixture.dc.html:261 scope header, no quote, no expect(',
      '',
      'describe("x", () => {',
      '  it("y", () => {});',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-header-unpaid.ts', raw);
    expect(computeHeaderScopeWithoutReceiptOffenders([citation])).toEqual([
      `${citation.file} declares header-block scope into ${citation.frameFile} but carries no fully-receipted (non-header) citation into it`,
    ]);
  });

  it('does NOT flag a header-block citation whose file also carries a fully-receipted citation into the same frame elsewhere', () => {
    const raw = [
      '// docs/design/Chautauqua Fixture.dc.html:261 scope header, no quote, no expect(',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:300 `.chq-fixture{color:#000}`',
      '    expect(el).toHaveStyle("color:#000");',
      '  });',
      '});',
    ].join('\n');
    const flat = flatten(raw);
    const citations = findCitations('fixture-header-paid.ts', flat);
    expect(citations.length).toBe(2);
    let cursor = 0;
    const withSource = citations.map((c) => {
      const idx = locateSourceIndex(raw, c.matchText, cursor);
      cursor = idx + c.matchText.length;
      return { ...c, flat, raw, sourceLine: lineNumberAt(raw, idx) };
    });
    expect(withSource.some(isHeaderBlockCitation)).toBe(true);
    expect(computeHeaderScopeWithoutReceiptOffenders(withSource)).toEqual([]);
  });
});
