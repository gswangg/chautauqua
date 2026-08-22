// Open-divergence ledger (DEC-099, task w11-td).
//
// test/phone-frame-ledger.scan.test.ts and test/desktop-frame-ledger.scan.
// test.ts are two saturated COVERAGE ledgers (CLAIMED_FLOOR = 53/53 and
// 100/100) -- both measure only whether a v12 frame is CLAIMED by some
// test, never whether the frame CONFORMS to the pack. Nothing in the tree
// counts the recorded divergences docs/design/audit/**/*.md already carries
// that are still OPEN, so the campaign's exit predicate cannot see how far
// there is left to run. This is that instrument, built in the house style
// of the two frame ledgers above (derived population, vacuous-population
// tripwire, two-sided ratchet, offending rows printed by name -- never an
// allowlist populated from the failure output, per app/src/phone-tap-
// target.scan.test.ts:30-32).
//
// POPULATION (derived, never hand-listed, per DEC-808): readdirSync
// docs/design/audit for *.md -- a FLAT listing, identical in shape to the
// two frame ledgers' own designFiles(), and deliberately non-recursive: a
// nested docs/design/audit/settings-v12/ directory holds three further .md
// files that this scan does not reach, mirroring the literal task brief
// ("readdirSync docs/design/audit for *.md") rather than inventing a wider
// walk. Within each of the 100 files, every raw-text occurrence of the
// token `DIVERGES` opens one row, keyed `file:line`.
//
// ADJUDICATION GRAMMAR: a row is ADJUDICATED when its own line, or "the
// paragraph it heads", carries a `DEC-NNN` citation or names
// `docs/design/DEVIATIONS.md`; otherwise it is OPEN. "The paragraph it
// heads" is resolved by the same line-shape the audit corpus is actually
// written in (three shapes reused verbatim from established idioms
// elsewhere in this suite, plus one fallback):
//
//   1. HEADING shape (`^#+\s`, e.g. "## DIVERGES 1 -- ..."): the paragraph
//      runs from the heading line up to (not including) the next `^#+\s`
//      heading line, or EOF -- the same extractSection() shape
//      test/clarifications-ledger.scan.test.ts and the desktop frame
//      ledger's own DEVIATIONS §6 reader both use.
//   2. TABLE-ROW shape (`^\s*\|`): the row is atomic -- a markdown table
//      row is one line, so its paragraph is that single line.
//   3. BULLET shape (`^\s*-\s`): the paragraph is the bullet line plus any
//      immediately-following indented continuation lines (`^\s+\S`),
//      mirroring findDeviationsOffenders' bullet-join shape (DEC-613: an
//      established shape reused, not reinvented) which
//      test/exemption-reason-is-a-principle.scan.test.ts already applies
//      to docs/design/DEVIATIONS.md's own bullets.
//   4. FALLBACK (bare prose, e.g. "**DIVERGES** (label wording only...)."
//      or a plain narrative sentence): a blank-line-delimited paragraph
//      containing the line, the same shape
//      test/exemption-reason-is-a-principle.scan.test.ts's own
//      flushParagraph() uses for DEVIATIONS.md prose.
//
// This grammar is intentionally the SIMPLEST rule that can be stated and
// derived without a hand-curated per-row list (DEC-180/DEC-808: a
// hand-listed population is not a population). It is a known
// over-approximation in one direction and an under-approximation in the
// other, and both are the safe direction for a ledger whose job is "never
// hide a problem" (DEC-099): (a) a stray DEC-NNN citation elsewhere in a
// long table-row cell can adjudicate a row that is not actually resolved by
// that citation (e.g. contacts-v12.md's :196 row, which cites DEC-976 for
// its citation FORM while its own body clause is still genuinely open) --
// this under-counts OPEN; (b) a resolving ruling written in the NEXT
// paragraph, separated by a blank line from the paragraph that still says
// "DIVERGES" (e.g. agenda-clash-390-v12.md:18), is not credited -- this
// over-counts OPEN. Given DEC-099's own "fail loudly, never hide a defect"
// principle, erring toward OPEN is the correct default; this scan does not
// attempt row-by-row hand curation, which would make the population
// hand-listed again.
//
// RATCHET (DEC-808, two-sided, mirroring the two frame ledgers' own
// CLAIMED_FLOOR amendments): OPEN_DIVERGENCE_CEILING is a single exported
// const, set to the OPEN count measured on THIS commit (after this task's
// three re-verdicts landed above, which is why the number here is lower
// than a pre-re-verdict measurement would have read). It may only be
// LOWERED in a future wave as adjudications/fixes land; a companion test
// fails when OPEN rises above it (printing every offending file:line) and
// another fails when OPEN drops below it without the constant being
// lowered to match (printing the exact replacement line), so neither
// direction can go stale.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const AUDIT_DIR = join(REPO_ROOT, 'docs', 'design', 'audit');

const DEC_CITE_RE = /\bDEC-\d{3}\b/;
const DEVIATIONS_RE = /docs\/design\/DEVIATIONS\.md/;
const TOKEN = 'DIVERGES';

export type RowShape = 'heading' | 'table' | 'bullet' | 'fallback';

export interface DivergenceRow {
  /** Repo-relative audit file, e.g. "docs/design/audit/contacts-v12.md". */
  file: string;
  /** 1-based line number of the DIVERGES occurrence. */
  line: number;
  shape: RowShape;
  paragraph: string;
  adjudicated: boolean;
}

/** Which of the four line-shapes governs this line's "paragraph it heads". */
export function classifyLineShape(line: string): RowShape {
  if (/^#+\s/.test(line)) return 'heading';
  if (/^\s*\|/.test(line)) return 'table';
  if (/^\s*-\s/.test(line)) return 'bullet';
  return 'fallback';
}

/** Resolves "the paragraph" a DIVERGES-carrying line at `idx` heads, per the
 * four-shape grammar in the file header comment above. Pure function of
 * `lines` + `idx` -- exported so the negative-control tests below can drive
 * it with synthetic fixtures rather than real files. */
export function paragraphFor(lines: string[], idx: number): string {
  const shape = classifyLineShape(lines[idx]!);
  if (shape === 'heading') {
    let end = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^#+\s/.test(lines[i]!)) {
        end = i;
        break;
      }
    }
    return lines.slice(idx, end).join('\n');
  }
  if (shape === 'table') {
    return lines[idx]!;
  }
  if (shape === 'bullet') {
    let end = idx + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end]!) && !/^\s*-\s/.test(lines[end]!)) end++;
    return lines.slice(idx, end).join('\n');
  }
  // fallback: blank-line-delimited paragraph containing idx.
  let start = idx;
  while (start > 0 && lines[start - 1]!.trim() !== '') start--;
  let end = idx;
  while (end < lines.length - 1 && lines[end + 1]!.trim() !== '') end++;
  return lines.slice(start, end + 1).join('\n');
}

/** A row is ADJUDICATED when its own line, or the paragraph it heads,
 * carries a DEC-NNN citation or names docs/design/DEVIATIONS.md. */
export function isAdjudicated(line: string, paragraph: string): boolean {
  return DEC_CITE_RE.test(line) || DEVIATIONS_RE.test(line) || DEC_CITE_RE.test(paragraph) || DEVIATIONS_RE.test(paragraph);
}

/** Derives every DIVERGES row in `text` (already split into `lines`), tagged
 * with its file, shape, paragraph and adjudication status. Pure function --
 * exported for the negative-control tests. */
export function deriveRowsFromLines(relFile: string, lines: string[]): DivergenceRow[] {
  const out: DivergenceRow[] = [];
  lines.forEach((line, idx) => {
    if (!line.includes(TOKEN)) return;
    const paragraph = paragraphFor(lines, idx);
    out.push({
      file: relFile,
      line: idx + 1,
      shape: classifyLineShape(line),
      paragraph,
      adjudicated: isAdjudicated(line, paragraph),
    });
  });
  return out;
}

/** Every *.md file directly under docs/design/audit, enumerated rather than
 * named (DEC-808), FLAT (non-recursive) per the file header comment above. */
function auditFiles(): string[] {
  return readdirSync(AUDIT_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();
}

function rowsInFile(fileName: string): DivergenceRow[] {
  const full = join(AUDIT_DIR, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, 'utf-8').split('\n');
  return deriveRowsFromLines(relFile, lines);
}

const ALL_ROWS: DivergenceRow[] = auditFiles().flatMap(rowsInFile);
const OPEN_ROWS: DivergenceRow[] = ALL_ROWS.filter((r) => !r.adjudicated);

const EXPECTED_AUDIT_FILE_COUNT = 101;
const EXPECTED_TOTAL_TOKEN_COUNT = 153;
const EXPECTED_SHAPE_COUNTS: Record<RowShape, number> = {
  heading: 15,
  table: 38,
  bullet: 27,
  fallback: 73,
};

// -- Ratchet -------------------------------------------------------------
// RE-BASELINED (task w13-xa, DEC-069/DEC-808 amendment): these constants
// were measured on branch v12m-w11-td, never on post-megabatch main, so the
// exit predicate's own header for this file (previously "203 total
// DIVERGES-token rows across 100 audit files, 133 OPEN") was stale by an
// entire branch-tree diff. The drop from 203 is ADJUDICATION, not row
// deletion: `git grep -c DIVERGES 5eadde2c5 -- 'docs/design/audit/*.md'`
// and the same grep on this branch's parent both total 148 lines -- no
// audit-file content was removed by this task, only re-measured. The
// further drop to the values below happened because this branch's base
// (6459bebdd, "merge v12m-w12-xf") includes SIX MORE audit-file edits than
// the w13-xa task brief's own 880726041 snapshot did (comms-v12.md,
// contacts-v12.md, content-v12.md, review-reviewer-desktop-v12.md,
// submissions-390-v12.md, plus a wholly NEW file,
// phone-verdict-cascade-read-v12.md, which raises EXPECTED_AUDIT_FILE_COUNT
// to 101) -- landed by other in-flight lanes between when the task brief's
// numbers were measured and when this task actually ran. Per the task's own
// instruction ("re-run the scan yourself and use the numbers IT prints,
// never these"), all four constants below are the scan's live output on
// this commit, not the brief's 100/146/{15,37,27,67}/85 figures, which
// were already one branch-generation stale. 153 total DIVERGES-token rows
// across 101 audit files, 4 OPEN. May only be LOWERED in a future wave as more
// rows get adjudicated (a DEC ruling lands, or the row is fixed and the fix
// cited); must never be raised to paper over new debt landing unadjudicated.
//
// RE-BASELINED (Thunderdome wave-14m megabatch, medic pass): 90 -> 4. The
// POPULATION IS UNCHANGED -- 101 audit files, 153 DIVERGES-token rows, and
// the 15/38/27/73 shape split are all byte-identical to the pre-megabatch
// measurement at 542f93006, and all three vacuous-population guards above
// still pass untouched. No audit file was added, deleted, or stripped of a
// DIVERGES token. The drop is pure ADJUDICATION landed by lanes w14-f/g/h/i
// (0c222beaa, 54c44e732, 828654280, 78766c114), which added in-cell and
// in-paragraph DEC-NNN citations to 86 rows. Those lanes predicted this
// exact red -- 45664f1aa's commit body says so outright -- but no lane owned
// the re-baseline, so it fell through the batch. Re-measured live on the
// integrated tree by the scan itself, never by arithmetic on a lane's
// snapshot. The 4 rows once OPEN were cfp-desktop-v12.md:21,
// contacts-import-390-v12.md:106, public-390-request-verdicts-v12.md:100 and
// settings-dialogs-desktop-v12.md:154.
//
// RE-BASELINED (task w18-c, DEC-903 wave-18): 4 -> 1. By the time this task
// ran, cfp-desktop-v12.md:22 and settings-dialogs-desktop-v12.md:154 had
// already been repaired by prior in-flight lanes (the hyphenated `DEC-976`
// / `DEC-903` forms now sit in each row's own paragraph, live-measured, not
// re-derived from a stale brief). This task adds the two hyphenated
// citations (`DEC-976` for the Session-format legend, `DEC-613` for
// "Save draft" vs the frame's "Draft") into public-390-request-verdicts-
// v12.md:100's own table-row cell, landing 4 -> 1. The one row still OPEN,
// contacts-import-390-v12.md:106, belongs to sibling task v12m-w18-a and is
// intentionally untouched here -- forced to -1 and re-read, never assumed.
export const OPEN_DIVERGENCE_CEILING = 1;

describe('open-divergence ledger (DEC-099, task w11-td)', () => {
  it('enumerates exactly 101 audit files and exactly 153 DIVERGES-token rows (vacuous-population guard)', () => {
    const files = auditFiles();
    expect(files.length).toBe(EXPECTED_AUDIT_FILE_COUNT);
    expect(ALL_ROWS.length).toBe(EXPECTED_TOTAL_TOKEN_COUNT);
  });

  it('classifies rows into the four line-shapes at exactly the counts measured on this branch (vacuous-grammar guard)', () => {
    const actual: Record<RowShape, number> = { heading: 0, table: 0, bullet: 0, fallback: 0 };
    for (const row of ALL_ROWS) actual[row.shape]++;
    expect(actual).toEqual(EXPECTED_SHAPE_COUNTS);
  });

  it(`never exceeds OPEN_DIVERGENCE_CEILING (${OPEN_DIVERGENCE_CEILING}) open divergence rows`, () => {
    if (OPEN_ROWS.length > OPEN_DIVERGENCE_CEILING) {
      const offenders = OPEN_ROWS.map((r) => `${r.file}:${r.line} [${r.shape}]`);
      throw new Error(
        `${OPEN_ROWS.length} open divergence rows, above the ratchet ceiling of ` +
          `${OPEN_DIVERGENCE_CEILING}. OPEN_DIVERGENCE_CEILING may only be LOWERED, never raised -- ` +
          `new unadjudicated debt landed. Offending rows:\n${offenders.join('\n')}`
      );
    }
    expect(OPEN_ROWS.length).toBeLessThanOrEqual(OPEN_DIVERGENCE_CEILING);
  });

  it(`never drops below OPEN_DIVERGENCE_CEILING (${OPEN_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling hides progress and licenses regrowth back up to it)`, () => {
    if (OPEN_ROWS.length < OPEN_DIVERGENCE_CEILING) {
      throw new Error(
        `${OPEN_ROWS.length} open divergence rows, below the ratchet ceiling of ` +
          `${OPEN_DIVERGENCE_CEILING}. This is the ratchet working: rows got adjudicated or fixed. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const OPEN_DIVERGENCE_CEILING = ${OPEN_ROWS.length};`
      );
    }
    expect(OPEN_ROWS.length).toBeGreaterThanOrEqual(OPEN_DIVERGENCE_CEILING);
    // goalComplete for this ledger is OPEN_ROWS.length reaching 0 -- every
    // recorded divergence adjudicated or fixed.
  });
});

describe('open-divergence ledger negative controls (DEC-099: every scan ships one, shape from test/clarifications-ledger.scan.test.ts)', () => {
  it('a bare heading-shape DIVERGES row with no DEC/DEVIATIONS citation anywhere in its section is OPEN', () => {
    const lines = ['## DIVERGES 1 -- something', '', 'No citation here at all.', '', '## Next heading'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.shape).toBe('heading');
    expect(rows[0]!.adjudicated).toBe(false);
  });

  it('a heading-shape row whose section later cites a DEC is ADJUDICATED, even many lines down', () => {
    const lines = ['## DIVERGES 1 -- something', '', 'Ruled by DEC-380 wave-32.', '', '## Next heading'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows[0]!.adjudicated).toBe(true);
  });

  it('a heading-shape row does NOT reach past the next heading for its citation (section boundary respected)', () => {
    const lines = ['## DIVERGES 1 -- something', '', 'No citation in this section.', '', '## Next heading (DEC-999)'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows[0]!.adjudicated).toBe(false);
  });

  it('a table-row-shape DIVERGES cell is adjudicated only by its OWN row, not a neighboring row', () => {
    const lines = [
      '| a | DIVERGES | no citation on this row |',
      '| b | DIVERGES | resolved, see DEC-101 |',
    ];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.adjudicated).toBe(false);
    expect(rows[1]!.adjudicated).toBe(true);
  });

  it('a bullet-shape DIVERGES row picks up citations from its own indented continuation lines but not a sibling bullet', () => {
    const lines = [
      '- **DIVERGES**: first finding',
      '  continues here with DEC-202 backing it.',
      '- **DIVERGES**: second finding, unrelated',
      '  no citation on this one.',
    ];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.adjudicated).toBe(true);
    expect(rows[1]!.adjudicated).toBe(false);
  });

  it('a fallback bare-prose DIVERGES line is adjudicated by docs/design/DEVIATIONS.md named in its own blank-line-delimited paragraph', () => {
    const lines = [
      'Some earlier unrelated paragraph.',
      '',
      '**DIVERGES** (structural). See docs/design/DEVIATIONS.md §7 for the ruling',
      'that settles this permanently.',
      '',
      'A later unrelated paragraph.',
    ];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.shape).toBe('fallback');
    expect(rows[0]!.adjudicated).toBe(true);
  });

  it('a fallback bare-prose DIVERGES line does NOT reach into the next blank-separated paragraph for its citation', () => {
    const lines = ['**DIVERGES** (structural). No citation in this paragraph.', '', 'Resolved by DEC-303 in the next paragraph, too late to count.'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows[0]!.adjudicated).toBe(false);
  });

  it('classifyLineShape resolves all four shapes correctly, including leading whitespace', () => {
    expect(classifyLineShape('## DIVERGES heading')).toBe('heading');
    expect(classifyLineShape('| cell | DIVERGES | cell |')).toBe('table');
    expect(classifyLineShape('  | indented table row DIVERGES |')).toBe('table');
    expect(classifyLineShape('- **DIVERGES**: bullet')).toBe('bullet');
    expect(classifyLineShape('  - nested bullet DIVERGES')).toBe('bullet');
    expect(classifyLineShape('Plain prose sentence with DIVERGES in it.')).toBe('fallback');
  });

  it('a compliant synthetic corpus (every row adjudicated) reports zero open rows -- proves the scan can pass', () => {
    const lines = ['## DIVERGES 1 -- fixed', '', 'Ruled by DEC-100.', '', '## end'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows.every((r) => r.adjudicated)).toBe(true);
  });
});
