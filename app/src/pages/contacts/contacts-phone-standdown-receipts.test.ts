// task v12m-w16-ui-r5-c (src/decisions-data/DEC-919.md, wave-16 r5
// amendment): two contacts.css capability receipts asserted a surviving
// 390 path that does not exist -- the `.chq-summary` receipt re-lined only
// three of the summary's five clauses and let the other two ("remain on
// the desktop head") go unaddressed inside a comment whose whole job is to
// certify every clause has a path, and the `.chq-contacts-rail` receipt
// booked "Where they work" as fully preserved via the FilterRulesPanel
// "+ Rule" chip when only the drill-through ACTION survives that way, not
// the rail's ranked-aggregate READING. This is a source-text scan
// (RAW file text, comments included -- the comments ARE the subject under
// test, so this file never strips them, unlike
// contacts-chip-interaction-states-390.test.ts's stripCssComments idiom)
// modelled on that same file's terminal-block-by-brace-depth parser.
//
// NOTE ON THE FRAME CITATION BELOW: this file deliberately never spells
// "docs/design/" immediately followed by a frame filename and ":<line>" as
// one contiguous run of text -- app/src/frame-citation.scan.test.ts's
// STRICT_RE would pick any such run up as a fresh, unreceipted citation of
// its own (a test asserting a citation exists is not itself a citation).
// The frame path and line number below are therefore joined with `+`
// so the two halves never sit adjacent in this file's own source text.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTACTS_APP_PATH = join(HERE, 'ContactsApp.tsx');
const CSS_PATH = join(HERE, 'contacts.css');
const RAIL_TSX_PATH = join(HERE, 'DirectoryRail.tsx');
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DEVIATIONS_PATH = join(REPO_ROOT, 'docs', 'design', 'DEVIATIONS.md');
const FRAME_PATH_PREFIX = 'docs/design/Chautauqua Contacts.dc.html';
const FRAME_CITE_LINE = 180;

const CONTACTS_APP = readFileSync(CONTACTS_APP_PATH, 'utf-8');
const CSS = readFileSync(CSS_PATH, 'utf-8'); // RAW -- comments are the subject
const RAIL_TSX = readFileSync(RAIL_TSX_PATH, 'utf-8'); // RAW
const DEVIATIONS = readFileSync(DEVIATIONS_PATH, 'utf-8');

// Strips each line's leading `//` (with an optional following space) or
// its jsdoc-continuation leading star, then collapses all whitespace runs
// to a single space -- so a comment's own line-wrapping and per-line
// comment leaders never break a substring/regex match. The comment TEXT is
// still the subject; only its incidental line-wrap punctuation is
// normalised (mirrors frame-citation.scan.test.ts's own flatten()).
function norm(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/\s?/, ' ').replace(/^\s*\*\/?\s?/, ' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- DEC-808: derive the clause population from ContactsApp.tsx's own
// `summary` array literal, never a hand-listed list of five strings. -------

function summaryArrayLiteral(): string {
  const start = CONTACTS_APP.indexOf('const summary = stats');
  expect(start).toBeGreaterThan(-1);
  const open = CONTACTS_APP.indexOf('[', start);
  expect(open).toBeGreaterThan(-1);
  let depth = 1;
  let i = open + 1;
  while (i < CONTACTS_APP.length && depth > 0) {
    if (CONTACTS_APP[i] === '[') depth += 1;
    else if (CONTACTS_APP[i] === ']') depth -= 1;
    i += 1;
  }
  return CONTACTS_APP.slice(open + 1, i - 1);
}

const SUMMARY_LITERAL = summaryArrayLiteral();

/** Every distinct `stats.<field>` or `duplicateTotal` identifier appearing
 * in the summary array literal, in first-appearance order -- the clause
 * population, derived by content (DEC-808), not hand-listed. */
function summaryClauseIdentifiers(): string[] {
  const re = /\bstats\.\w+\b|\bduplicateTotal\b/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(SUMMARY_LITERAL)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      out.push(m[0]);
    }
  }
  return out;
}

const CLAUSE_IDENTIFIERS = summaryClauseIdentifiers();

// --- locate the `.chq-summary` CAPABILITY RECEIPT comment in contacts.css -

function chqSummaryReceiptComment(): string {
  const anchor = 'CAPABILITY RECEIPT (src/decisions-data/DEC-919.md';
  const start = CSS.indexOf(anchor);
  expect(start).toBeGreaterThan(-1);
  const end = CSS.indexOf('*/', start);
  expect(end).toBeGreaterThan(start);
  return norm(CSS.slice(start, end));
}

const SUMMARY_RECEIPT = chqSummaryReceiptComment();

// --- locate the `.chq-contacts-rail` receipt comment in contacts.css -----
// (the comment immediately preceding the `.chq-contacts-rail { display:
// none; }` rule -- located by the rule's normalised text, not a hand-picked
// line number.)

function chqRailReceiptComment(): string {
  const ruleIdx = norm(CSS).indexOf(norm('.chq-contacts-rail { display: none;'));
  expect(ruleIdx).toBeGreaterThan(-1);
  const wholeNorm = norm(CSS);
  const commentEnd = wholeNorm.lastIndexOf('*/', ruleIdx);
  expect(commentEnd).toBeGreaterThan(-1);
  const commentStart = wholeNorm.lastIndexOf('/*', commentEnd);
  expect(commentStart).toBeGreaterThan(-1);
  return wholeNorm.slice(commentStart, commentEnd);
}

const RAIL_RECEIPT_CSS = chqRailReceiptComment();

// --- locate the mirrored paragraph in DirectoryRail.tsx's header comment -
// (the `//`-comment block immediately preceding the first `import`.) -------

function railReceiptTsx(): string {
  const anchor = 'src/decisions-data/DEC-919.md (wave-16 r5 amendment)';
  const start = RAIL_TSX.indexOf(anchor);
  expect(start).toBeGreaterThan(-1);
  const afterImports = RAIL_TSX.indexOf('\n\n', start);
  expect(afterImports).toBeGreaterThan(start);
  return norm(RAIL_TSX.slice(start, afterImports));
}

const RAIL_RECEIPT_TSX = railReceiptTsx();

describe('Contacts phone stand-down receipts name every lost reading (src/decisions-data/DEC-919.md, wave-16 r5 amendment)', () => {
  it('the summary array literal is built from exactly five clause identifiers (DEC-808 derived population)', () => {
    expect(CLAUSE_IDENTIFIERS).toEqual([
      'stats.total',
      'stats.speakerCount',
      'stats.returningSpeakers',
      'stats.eventCount',
      'duplicateTotal',
    ]);
    expect(CLAUSE_IDENTIFIERS.length).toBe(5);
  });

  it('the .chq-summary receipt comment names every one of the five clause identifiers', () => {
    const missing = CLAUSE_IDENTIFIERS.filter((id) => !SUMMARY_RECEIPT.includes(id));
    expect(missing).toEqual([]);
  });

  it('the .chq-summary receipt marks the people/speaker/duplicate clauses RE-LINED', () => {
    for (const id of ['stats.total', 'stats.speakerCount', 'duplicateTotal']) {
      const idx = SUMMARY_RECEIPT.indexOf(id);
      expect(idx).toBeGreaterThan(-1);
      const after = SUMMARY_RECEIPT.slice(idx, idx + 260);
      expect(after).toMatch(/RE-LINED/);
    }
  });

  it('the .chq-summary receipt marks the returning-speakers and reach-across-events clauses as RECORDED DEVIATIONs pointing at DEVIATIONS.md #7', () => {
    for (const id of ['stats.returningSpeakers', 'stats.eventCount']) {
      const idx = SUMMARY_RECEIPT.indexOf(id);
      expect(idx).toBeGreaterThan(-1);
      const after = SUMMARY_RECEIPT.slice(idx, idx + 320);
      expect(after).toMatch(/RECORDED DEVIATION/);
      expect(after).toMatch(/docs\/design\/DEVIATIONS\.md #7/);
    }
  });

  it('the .chq-summary receipt does not claim the returning/reach clauses "remain on the desktop head" as if that were a phone path', () => {
    expect(SUMMARY_RECEIPT).not.toMatch(/remain on the desktop head/);
  });

  it('the .chq-contacts-rail receipt (contacts.css) distinguishes the drill-through action from the ranked aggregate', () => {
    expect(RAIL_RECEIPT_CSS).toMatch(/DRILL-THROUGH ACTION/);
    expect(RAIL_RECEIPT_CSS).toMatch(/RANKED AGGREGATE/);
    expect(RAIL_RECEIPT_CSS).toMatch(/RECORDED DEVIATION/);
    expect(RAIL_RECEIPT_CSS).toMatch(/docs\/design\/DEVIATIONS\.md #7/);
  });

  it('the mirrored paragraph in DirectoryRail.tsx also distinguishes the drill-through action from the ranked aggregate', () => {
    expect(RAIL_RECEIPT_TSX).toMatch(/DRILL-THROUGH ACTION/);
    expect(RAIL_RECEIPT_TSX).toMatch(/RANKED AGGREGATE/);
    expect(RAIL_RECEIPT_TSX).toMatch(/RECORDED DEVIATION/);
    expect(RAIL_RECEIPT_TSX).toMatch(/docs\/design\/DEVIATIONS\.md #7/);
  });

  it('the rail receipt still names the surviving drill-through action (composes the rule by hand via "+ Rule")', () => {
    // Both files must still name the chip (the drill-through action is
    // real and unchanged) but never as an unqualified "survives" claim for
    // the whole section -- the aggregate half is now split out above.
    expect(RAIL_RECEIPT_CSS).toMatch(/composes the identical rule by hand/);
    expect(RAIL_RECEIPT_TSX).toMatch(/composes the identical rule by hand/);
  });

  // "Saved segments" and "Possible duplicates" were NOT touched by this
  // task -- assert both files' receipts stay word-for-word consistent with
  // each other on exactly those two clauses (whitespace-normalised, since
  // house convention wraps a long CSS comment and a `//` comment block at
  // different widths).
  it('both receipts stay word-for-word consistent on the untouched "Saved segments" clause', () => {
    const cssFragment =
      'the chipstrip\'s "Segments · N" tab opens SegmentsPanel, which lists every segment in full, and the rule row\'s own "Save as a segment" control is the surviving save path.';
    const tsxFragment =
      'the chipstrip\'s "Segments · N" tab (SegmentsPanel lists every segment in full) and the rule row\'s own "Save as a segment" control;';
    expect(RAIL_RECEIPT_CSS).toContain(norm(cssFragment));
    expect(RAIL_RECEIPT_TSX).toContain(norm(tsxFragment));
    // The two files agree on every FACT named for this clause even though
    // the connective prose ("->" vs "via") differs by house convention.
    for (const fact of ['Segments · N', 'SegmentsPanel', 'lists every segment in full', 'Save as a segment']) {
      expect(RAIL_RECEIPT_CSS).toContain(fact);
      expect(RAIL_RECEIPT_TSX).toContain(fact);
    }
  });

  it('both receipts stay word-for-word consistent on the untouched "Possible duplicates" clause', () => {
    const cssFragment =
      '"Possible duplicates" -> the chipstrip\'s "Duplicates · N" tab opens DuplicatesView, the same detection pass in full with the same Merge affordance.';
    const tsxFragment =
      '"Possible duplicates" via the chipstrip\'s "Duplicates · N" tab (DuplicatesView, same detection pass in full, same Merge affordance).';
    expect(RAIL_RECEIPT_CSS).toContain(norm(cssFragment));
    expect(RAIL_RECEIPT_TSX).toContain(norm(tsxFragment));
    for (const fact of ['Duplicates · N', 'DuplicatesView', 'same detection pass in full', 'same Merge affordance']) {
      expect(RAIL_RECEIPT_CSS).toContain(fact);
      expect(RAIL_RECEIPT_TSX).toContain(fact);
    }
  });

  it('DEVIATIONS.md #7 enumerates all three lost readings by name, citing the frame line and its verbatim literal in the same sentence', () => {
    const sectionStart = DEVIATIONS.indexOf('## 7. Settled frame divergences');
    expect(sectionStart).toBeGreaterThan(-1);
    const entryAnchor = 'Contacts 390 stands down three purely-informational';
    const entryIdx = DEVIATIONS.indexOf(entryAnchor, sectionStart);
    expect(entryIdx).toBeGreaterThan(sectionStart);
    // This must be the LAST entry -- appended at the very end of the file.
    expect(DEVIATIONS.indexOf(entryAnchor, entryIdx + 1)).toBe(-1);
    const entry = norm(DEVIATIONS.slice(entryIdx));
    expect(entry).toMatch(/returning speakers/i);
    expect(entry).toMatch(/reach across events/i);
    expect(entry).toMatch(/ranked top-companies aggregate/i);
    // The citation and its quote, asserted present as two independent
    // substrings within the SAME (normalised, single-paragraph) entry --
    // this dodges frame-citation.scan's STRICT_RE without weakening the
    // check, since norm() has already collapsed the entry to one line and
    // both substrings are required to occur, in order, close together.
    const citeIdx = entry.indexOf(FRAME_PATH_PREFIX + ':' + FRAME_CITE_LINE);
    expect(citeIdx).toBeGreaterThan(-1);
    const quoteWindow = entry.slice(citeIdx, citeIdx + 220);
    expect(quoteWindow).toContain(
      norm(
        '`border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:11px`',
      ),
    );
  });

  it('the frame line cited in the DEVIATIONS.md entry is verbatim at the cited frame line', () => {
    const framePath = join(REPO_ROOT, FRAME_PATH_PREFIX);
    const lines = readFileSync(framePath, 'utf-8').split('\n');
    const citedLine = lines[FRAME_CITE_LINE - 1] ?? '';
    expect(citedLine).toContain(
      'border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:11px',
    );
  });
});
