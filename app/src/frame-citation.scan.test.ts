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
  const direct = raw.indexOf(matchText, searchFrom);
  if (direct !== -1) return direct;
  // matchText came out of flatten(), which collapses a wrapped comment's
  // line break AND its continuation marker (`* `/`// `) to one space -- so
  // the raw text may have `// ` or `* ` sitting where matchText has a bare
  // space. Rejoin each space with the same connector flatten() would have
  // collapsed, so a name split across a wrapped `//` comment (e.g.
  // "...Chautauqua\n// Comms.dc.html:177") still resolves.
  const CONNECTOR = String.raw`\s*(?:\/\/|\*\/?)?\s*`;
  const pattern = matchText
    .split(' ')
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(CONNECTOR);
  const m = raw.slice(searchFrom).match(new RegExp(pattern));
  if (!m || m.index === undefined) {
    throw new Error(
      `could not locate citation "${matchText}" in its own source file to check line adjacency -- ` +
        `flatten() and the raw file disagree on its text`
    );
  }
  return searchFrom + m.index;
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

/** Shared receipt check (quote presence + nearby `expect(`), factored out so
 * the phone describe block below and the new desktop block (DEC-808 wave-107
 * task w3-v) run the identical rule rather than each re-implementing it --
 * a second copy of a vocabulary is a trap with a delay fuse (DEC-613). */
function computeUnreceiptedCitations(
  citations: readonly (Citation & { sourceLine: number; flat: string; raw: string })[]
): string[] {
  const unreceipted: string[] = [];
  for (const c of citations) {
    const quote = quoteAfter(c.flat, c.index);
    if (!quote || quote.length === 0) {
      unreceipted.push(`${c.file}:${c.sourceLine} — ${c.matchText} (no backtick-quoted literal)`);
      continue;
    }
    const rawLines = c.raw.split('\n');
    const window = rawLines.slice(c.sourceLine - 1, c.sourceLine - 1 + EXPECT_PROXIMITY_LINES);
    if (!window.some((l) => l.includes('expect('))) {
      unreceipted.push(`${c.file}:${c.sourceLine} — ${c.matchText} (no expect( within ${EXPECT_PROXIMITY_LINES} lines beneath)`);
    }
  }
  return unreceipted;
}

describe('test-file claims are receipted: quote + nearby expect() (DEC-976 wave-87 amendment, task w5-j)', () => {
  it('the test-file phone-frame citation population is non-empty and contains a known-good example', () => {
    expect(TEST_PHONE_CITATIONS.length).toBeGreaterThan(0);
    // app/src/phone-page-scaffold.test.ts:115 cites
    // `docs/design/Chautauqua Speakers.dc.html:261` inside a comment that
    // also carries a backtick-quoted literal, followed within
    // EXPECT_PROXIMITY_LINES by a real `expect(` -- a fully-receipted claim,
    // confirmed against the measured tree before this test was written.
    const known = TEST_PHONE_CITATIONS.some(
      (c) =>
        c.file === 'app/src/phone-page-scaffold.test.ts' &&
        c.sourceLine === 115 &&
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
 * This task does not fix other lanes' test files to force it down. */
const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 28;

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
  // is seeded at exactly what this branch measures (28), so this companion is
  // expected GREEN today (measured 28, ceiling 28) -- unlike
  // UNRECEIPTED_CLAIM_CEILING's own companion below, which is deliberately
  // red because that constant is DEC-385 wave-93 merge-train-only and this
  // task does not edit it.
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
});
