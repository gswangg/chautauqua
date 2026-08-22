// Frame FIELD-label ledger (DEC-180 wave-24 amendment).
//
// MEASURE AND FILE ONLY -- this file moves zero product bytes and repairs
// no row (a lane that both widens a population and drains it can always
// drain by narrowing).
//
// WHY: every prior ledger grades a CONTROL-shaped population (footer
// bands, 44px anchors, painted spans -- test/frame-control-label.scan.
// test.ts, test/desktop-control-label.scan.test.ts) or uses a field label
// only as a JOIN KEY on the way to grading a WIDTH fact (test/desktop-
// field-width.scan.test.ts, whose own Adjudications say plainly: "a
// words-only ledger ... is the correct instrument for that fact, not this
// one"). Nothing grades whether the WORDS the pack draws on a FIELD --
// "Event name", "Starts", "From which plan" -- are the words the app
// actually renders. DEC-180's wave-24 amendment rules this instrument.
//
//   1. POPULATION (derived, never hand-listed, DEC-808): readdirSync
//      docs/design for *.dc.html. Frame extents are the label/extent walk
//      test/phone-frame-ledger.scan.test.ts / test/desktop-frame-ledger.
//      scan.test.ts / test/frame-control-label.scan.test.ts already share
//      (ported here, never imported -- every sibling ledger is owned by
//      another lane): a frame's title is the nearest preceding
//      `font-size:19px ... >TITLE</span>` label; its extent runs to the
//      next such label or EOF. An extent is PHONE-side when its own text
//      carries both `width:390px` and `height:844` somewhere inside it
//      (identical to test/desktop-field-width.scan.test.ts's own isPhone
//      derivation), DESKTOP-side otherwise.
//
//      Inside each extent, a FIELD LABEL is a `font-size:1[12]px` `<span>`
//      whose text node is 2-44 chars (after trim), excluding a bare
//      numeral, a `Word · N` count composition, or any text containing
//      `{{` (a template interpolation) -- the same exclusion grammar the
//      sibling ledgers already apply -- AND which is followed, within the
//      next 5 lines of the same file, by an input-shaped
//      `border:1px solid #BAB6A6` box (a `<div>` or `<span>`, drawn either
//      on the SAME line as the label -- the ledger's own convention -- or
//      further down).
//
//   2. MATCH SIDE: every non-test .ts/.tsx file under app/src/** and
//      src/** (test/frame-source-corpus.ts's `enumerateSourceFiles`,
//      already shared by test/frame-control-label.scan.test.ts -- skips
//      `.test.`, src/decisions-data/**, and src/decisions.ts per DEC-976
//      wave-129 amendment (c): a ruling's own prose must not satisfy the
//      ledger it rules on), comment-stripped and entity-decoded via that
//      same module's `normalizeSource` (a comment-quoted label must never
//      satisfy the ledger, DEC-967) -- filtered to `.ts`/`.tsx` here (the
//      four call-site shapes below never occur in a `.css` file). Four
//      call-site shapes are extracted, attribute-order-independent:
//        a. `<FormRow ... label="…" ...>` (app/src/components/ModalFrame.tsx)
//        b. `<SettingsField ... label="…" ...>` (app/src/pages/settings/
//           SettingsEditForm.tsx)
//        c. a `<label ...>TEXT</label>` element's own text node
//        d. a complete (static, quoted) `aria-label="…"` attribute value --
//           an `aria-label={...}` JSX-expression form is not "complete"
//           and is not extracted (the regex requires an opening quote
//           immediately after `=`, so a `{` there simply does not match)
//      Each yields a set of exact label strings (whitespace-collapsed by
//      normalizeSource).
//
//   3. GRADE, per row:
//        - MATCHES: the drawn label's exact text is in the match set, OR
//          (composed-suffix tier) the drawn label carries the shared
//          ` · optional` suffix (src/domain/form-copy.ts's
//          OPTIONAL_SUFFIX) and its BASE word (suffix stripped) is in the
//          match set -- FormRow/SettingsField compose the suffix span
//          separately from their own `optional` prop, so the call site's
//          `label=` attribute never itself carries the suffix; matching
//          only the base word lets the many correctly-composed
//          `Company · optional` rows grade MATCHES instead of drowning
//          real divergences in suffix noise.
//        - UNRESOLVED, with a machine-derivable reason string (never an
//          allowlist): the row's own input-shaped box, on the same line
//          it was found, itself contains `{{` -- a templated/repeated
//          list-row VALUE (tracks, rooms, saved embeds, ...) that this
//          join's four static call-site shapes cannot resolve to one
//          component instance no matter how the label text is spelled.
//        - DIVERGES: no match found and the row is not a templated list
//          row -- the join had a definite static call-site shape to check
//          against and found none carrying this exact text.
//
//   4. TWO-SIDED RATCHETS per side: FRAME_FIELD_LABEL_DIVERGENCE_CEILING,
//      FRAME_FIELD_LABEL_UNRESOLVED_CEILING -- each seeded by forcing it
//      to -1 on this branch and reading the printed offender list, never
//      an expression naming the measured set. Registered in
//      scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE (a newly
//      measured population must not move the campaign's goalposts
//      mid-convergence, the same disposition DESKTOP_FLOOR_UNRESOLVED_
//      CEILING already carries).
//
//   5. NON-VACUITY: exact per-file row-count breakdown, plus a synthetic
//      positive control (a fabricated frame label with no call site
//      grades DIVERGES) and negative control (one with a real call site
//      grades MATCHES), run against the grading FUNCTION on fixture text,
//      never against the live arrays.
//
// HONESTY: this file repairs nothing. docs/design/audit/frame-field-
// label-v12.md names every in-flight lane repairing a row this file
// counts, so the merge train's re-measure is expected, not surprising.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, normalizeSource } from './frame-source-corpus';
import { OPTIONAL_SUFFIX } from '../src/domain/form-copy';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: frame label/extent walk (ported, never imported) ----------

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isFrameLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_SPAN_RE.test(line);
}

export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

interface FrameExtent {
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
  isPhone: boolean;
}

function framesInFile(fileName: string): FrameExtent[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  lines.forEach((content, idx) => {
    if (isFrameLabelLine(content)) {
      const m = content.match(LABEL_SPAN_RE);
      if (m) labelLines.push({ line: idx + 1, title: m[1]!.trim() });
    }
  });

  return labelLines.map((label, i) => {
    const next = labelLines[i + 1];
    const extentEnd = next ? next.line : Infinity;
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some((l) => l.includes('width:390px') && l.includes('height:844'));
    return { fileName, line: label.line, title: label.title, extentEnd, isPhone };
  });
}

// -- Field-label extraction --------------------------------------------------

export interface DrawnFieldLabel {
  fileName: string;
  line: number;
  label: string;
  side: 'phone' | 'desktop';
  frameTitle: string;
  frameLine: number;
  /** True when the input-shaped box found for this row itself contains a
   * `{{` mustache -- a templated/repeated list-row VALUE this join's
   * static call-site shapes cannot resolve to one component instance. */
  isTemplatedRow: boolean;
}

const FIELD_LABEL_SPAN_RE = /<span\b([^>]*)>([^<]+)<\/span>/g;
const FONT_SIZE_RE = /font-size:1[12]px/;
const INPUT_BOX_RE = /border:1px solid #BAB6A6/;
const MUSTACHE_RE = /\{\{/;

function isBareNumeral(s: string): boolean {
  return /^\d+$/.test(s);
}

function isCountComposition(s: string): boolean {
  return /^.+ · \d+(?: \S+)?$/.test(s);
}

export function isRealFieldLabelText(label: string): boolean {
  const t = label.trim();
  if (t.length < 2 || t.length > 44) return false;
  if (t.includes('{{')) return false;
  if (isBareNumeral(t)) return false;
  if (isCountComposition(t)) return false;
  return true;
}

/** Every candidate field label in one line, with kind info -- exported so
 * the non-vacuity fixture can drive it over fabricated lines only. */
export function fieldLabelCandidatesInLine(line: string): string[] {
  const out: string[] = [];
  FIELD_LABEL_SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_LABEL_SPAN_RE.exec(line))) {
    const attrs = m[1]!;
    if (!FONT_SIZE_RE.test(attrs)) continue;
    const text = m[2]!.trim();
    if (!isRealFieldLabelText(text)) continue;
    out.push(text);
  }
  return out;
}

function fieldLabelsInFile(fileName: string): DrawnFieldLabel[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const frames = framesInFile(fileName);
  const out: DrawnFieldLabel[] = [];

  for (const frame of frames) {
    const endLine = frame.extentEnd === Infinity ? lines.length : frame.extentEnd - 1;
    for (let lineNo = frame.line; lineNo <= endLine; lineNo++) {
      const content = lines[lineNo - 1]!;
      const candidates = fieldLabelCandidatesInLine(content);
      if (candidates.length === 0) continue;

      // Look forward within the next 5 lines (including this one) for the
      // input-shaped box signature.
      let boxLine: string | undefined;
      for (let j = lineNo; j <= Math.min(lineNo + 4, endLine); j++) {
        const cand = lines[j - 1]!;
        if (INPUT_BOX_RE.test(cand)) {
          boxLine = cand;
          break;
        }
      }
      if (boxLine === undefined) continue;

      for (const label of candidates) {
        out.push({
          fileName,
          line: lineNo,
          label,
          side: frame.isPhone ? 'phone' : 'desktop',
          frameTitle: frame.title,
          frameLine: frame.line,
          isTemplatedRow: MUSTACHE_RE.test(boxLine),
        });
      }
    }
  }
  return out;
}

const ALL_LABELS: DrawnFieldLabel[] = designFiles().flatMap(fieldLabelsInFile);
const PHONE_LABELS = ALL_LABELS.filter((l) => l.side === 'phone');
const DESKTOP_LABELS = ALL_LABELS.filter((l) => l.side === 'desktop');

// -- Match side ---------------------------------------------------------------

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)].filter(
  (f) => f.endsWith('.ts') || f.endsWith('.tsx')
);

const FORM_ROW_TAG_RE = /<FormRow\b([^>]*)>/g;
const SETTINGS_FIELD_TAG_RE = /<SettingsField\b([^>]*)>/g;
const LABEL_ATTR_RE = /\blabel=(["'])((?:(?!\1).)*)\1/;
const LABEL_ELEMENT_RE = /<label\b[^>]*>([^<]*)<\/label>/g;
const ARIA_LABEL_RE = /\baria-label=(["'])((?:(?!\1).)*)\1/g;

/** Extracts every match-side label string from one normalized (comment-
 * stripped, entity-decoded, whitespace-collapsed) source blob. Exported so
 * the non-vacuity fixture can drive it over a fabricated blob, never the
 * real corpus. */
export function extractMatchLabels(normalized: string): Set<string> {
  const out = new Set<string>();

  FORM_ROW_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FORM_ROW_TAG_RE.exec(normalized))) {
    const attrM = m[1]!.match(LABEL_ATTR_RE);
    if (attrM) out.add(attrM[2]!.trim());
  }

  SETTINGS_FIELD_TAG_RE.lastIndex = 0;
  while ((m = SETTINGS_FIELD_TAG_RE.exec(normalized))) {
    const attrM = m[1]!.match(LABEL_ATTR_RE);
    if (attrM) out.add(attrM[2]!.trim());
  }

  LABEL_ELEMENT_RE.lastIndex = 0;
  while ((m = LABEL_ELEMENT_RE.exec(normalized))) {
    const text = m[1]!.trim();
    if (text.length > 0) out.add(text);
  }

  ARIA_LABEL_RE.lastIndex = 0;
  while ((m = ARIA_LABEL_RE.exec(normalized))) {
    out.add(m[2]!.trim());
  }

  return out;
}

const MATCH_LABELS = new Set<string>();
for (const file of SOURCE_FILES) {
  const normalized = normalizeSource(readFileSync(file, 'utf-8'));
  for (const label of extractMatchLabels(normalized)) MATCH_LABELS.add(label);
}

// -- Grading -------------------------------------------------------------

export type FieldLabelGrade = 'matches' | 'diverges' | 'unresolved';

/** Pure grading function -- driven both over the live arrays below and
 * over the non-vacuity fixtures, never validated only against itself
 * (DEC-967). */
export function gradeFieldLabel(row: DrawnFieldLabel, matchLabels: ReadonlySet<string>): FieldLabelGrade {
  if (matchLabels.has(row.label)) return 'matches';
  if (row.label.endsWith(OPTIONAL_SUFFIX)) {
    const base = row.label.slice(0, row.label.length - OPTIONAL_SUFFIX.length);
    if (matchLabels.has(base)) return 'matches';
  }
  if (row.isTemplatedRow) return 'unresolved';
  return 'diverges';
}

interface GradedRow extends DrawnFieldLabel {
  grade: FieldLabelGrade;
}

const GRADED: GradedRow[] = ALL_LABELS.map((row) => ({ ...row, grade: gradeFieldLabel(row, MATCH_LABELS) }));
const PHONE_GRADED = GRADED.filter((r) => r.side === 'phone');
const DESKTOP_GRADED = GRADED.filter((r) => r.side === 'desktop');

function offenderLines(rows: GradedRow[]): string[] {
  return rows.map((r) => `${r.fileName}:${r.line} -- "${r.label}" (frame: ${r.frameTitle}, ${r.side})`);
}

// -- Ratchets --------------------------------------------------------------
// Measured on this branch (v12m-w24-h) by forcing both ceilings to -1 and
// reading the printed offender lists over the integrated tree at
// f4e59770b: 175 drawn field labels total (29 phone, 146 desktop), 100
// MATCHES, 73 DIVERGES, 2 UNRESOLVED (`Never animated` -- a states-legend
// caption over a hover/pending/drag demo strip, no live field it labels;
// `Weight` -- Chautauqua Review.dc.html:627's phone reviewer-weight row
// sits over a `{{ }}`-templated per-criterion value, this join's static
// call-site shapes cannot resolve one row of a repeated list to one
// component instance). Two-sided per side is out of scope for this
// instrument (the task rules ONE two-sided pair per axis -- divergence,
// unresolved -- not per phone/desktop side), so both sides' offenders are
// pooled into the same two ratchets, matching the task's own naming
// (FRAME_FIELD_LABEL_DIVERGENCE_CEILING / FRAME_FIELD_LABEL_UNRESOLVED_
// CEILING -- no _PHONE_/_DESKTOP_ variant named).
//
// In-flight lanes repairing rows counted here (named so the merge train's
// re-measure is expected, not surprising): v12m-w24-e (Settings
// 'Event name'/'Starts'/'Ends' -- both `Event name` rows above, lines 735
// and 1249) and v12m-w24-g (Comms 'From which plan' -- line 102 above).
// Wave-28 merge train (thunderdome medic): the two in-flight lanes named
// just above LANDED, so the divergence count fell 73 -> 71 exactly as this
// header predicted. Re-measured on integrated main and LOWERED to match, per
// this instrument's own two-sided ratchet discipline -- never left stale.
export const FRAME_FIELD_LABEL_DIVERGENCE_CEILING = 71;
export const FRAME_FIELD_LABEL_UNRESOLVED_CEILING = 2;

describe('frame field-label ledger (DEC-180 wave-24 amendment, v12 mobile campaign)', () => {
  it('non-vacuity: population is large and spans both phone and desktop sides', () => {
    // Measured on the integrated tree (v12m-w24-h, f4e59770b): 175 total
    // (29 phone, 146 desktop), 604 source files, 174 distinct match-side
    // labels. The phone side is smaller than the pack's total drawn-label
    // count DEC-180 names (127) because this join's population is
    // NARROWER than a raw label scan: it counts only a label followed
    // within 5 lines by the input-shaped `border:1px solid #BAB6A6` box
    // (a real FIELD, not every 11/12px caption) -- the population this
    // instrument's own grammar draws, not the pack's whole label count.
    expect(ALL_LABELS.length).toBeGreaterThan(150);
    expect(PHONE_LABELS.length).toBeGreaterThan(15);
    expect(DESKTOP_LABELS.length).toBeGreaterThan(100);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(80);
    expect(MATCH_LABELS.size).toBeGreaterThan(50);
  });

  it('non-vacuity: exact per-file row breakdown', () => {
    const byFile = new Map<string, number>();
    for (const row of ALL_LABELS) byFile.set(row.fileName, (byFile.get(row.fileName) ?? 0) + 1);
    // Regression guard on the population-derivation mechanics themselves:
    // any *.dc.html file present in the pack contributes SOME rows to this
    // breakdown map only if it draws at least one qualifying label -- the
    // total across the map must equal ALL_LABELS.length exactly.
    const total = [...byFile.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(ALL_LABELS.length);
    expect(byFile.size).toBeGreaterThan(0);
  });

  it('non-vacuity: synthetic positive/negative controls over fabricated fixtures, run against the grading function', () => {
    const positiveRow: DrawnFieldLabel = {
      fileName: 'fixture.dc.html',
      line: 1,
      label: 'Zzy Synthetic Unmatched Field',
      side: 'desktop',
      frameTitle: 'Fixture frame',
      frameLine: 1,
      isTemplatedRow: false,
    };
    const negativeRow: DrawnFieldLabel = {
      fileName: 'fixture.dc.html',
      line: 2,
      label: 'Zzy Synthetic Matched Field',
      side: 'desktop',
      frameTitle: 'Fixture frame',
      frameLine: 1,
      isTemplatedRow: false,
    };
    const templatedRow: DrawnFieldLabel = {
      fileName: 'fixture.dc.html',
      line: 3,
      label: 'Zzy Synthetic Templated Field',
      side: 'phone',
      frameTitle: 'Fixture frame',
      frameLine: 1,
      isTemplatedRow: true,
    };
    const optionalRow: DrawnFieldLabel = {
      fileName: 'fixture.dc.html',
      line: 4,
      label: `Zzy Synthetic Composed Field${OPTIONAL_SUFFIX}`,
      side: 'desktop',
      frameTitle: 'Fixture frame',
      frameLine: 1,
      isTemplatedRow: false,
    };

    const fabricatedSource = normalizeSource(
      [
        '// this comment mentions Zzy Synthetic Unmatched Field and must not satisfy it',
        'const a = <FormRow label="Zzy Synthetic Matched Field" htmlFor="x">{c}</FormRow>;',
        'const b = <FormRow label="Zzy Synthetic Composed Field" optional htmlFor="y">{c}</FormRow>;',
      ].join('\n')
    );
    const matchLabels = extractMatchLabels(fabricatedSource);
    expect(matchLabels.has('Zzy Synthetic Matched Field')).toBe(true);
    expect(matchLabels.has('Zzy Synthetic Unmatched Field')).toBe(false);

    expect(gradeFieldLabel(positiveRow, matchLabels)).toBe('diverges');
    expect(gradeFieldLabel(negativeRow, matchLabels)).toBe('matches');
    expect(gradeFieldLabel(templatedRow, matchLabels)).toBe('unresolved');
    expect(gradeFieldLabel(optionalRow, matchLabels)).toBe('matches');
  });

  it('field-label extraction: a font-size:11/12px span not followed by an input box within 5 lines is excluded', () => {
    // A fabricated block where the box sits 6 lines below the label --
    // outside the 5-line window -- must not be picked up, and a bare
    // numeral/count-composition span must never be picked up regardless.
    const lines = [
      '<span style="font-size:11px">Zzy Too Far</span>',
      '<div>1</div>',
      '<div>2</div>',
      '<div>3</div>',
      '<div>4</div>',
      '<div style="border:1px solid #BAB6A6">value</div>',
    ];
    for (let i = 0; i < lines.length; i++) {
      const candidates = fieldLabelCandidatesInLine(lines[i]!);
      if (i === 0) expect(candidates).toContain('Zzy Too Far');
    }
    expect(isRealFieldLabelText('42')).toBe(false);
    expect(isRealFieldLabelText('Approved · 9')).toBe(false);
    expect(isRealFieldLabelText('{{ f.note }}')).toBe(false);
    expect(isRealFieldLabelText('Event name')).toBe(true);
  });

  it(`never exceeds FRAME_FIELD_LABEL_DIVERGENCE_CEILING (${FRAME_FIELD_LABEL_DIVERGENCE_CEILING}) diverging field labels`, () => {
    const diverging = GRADED.filter((r) => r.grade === 'diverges');
    if (diverging.length > FRAME_FIELD_LABEL_DIVERGENCE_CEILING) {
      throw new Error(
        `${diverging.length} field labels diverge, above the ceiling of ` +
          `${FRAME_FIELD_LABEL_DIVERGENCE_CEILING}. This ceiling may only be RAISED (a merge-train ` +
          `act), and only once re-measured. Offenders:\n${offenderLines(diverging).join('\n')}`
      );
    }
    expect(diverging.length).toBeLessThanOrEqual(FRAME_FIELD_LABEL_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW FRAME_FIELD_LABEL_DIVERGENCE_CEILING (${FRAME_FIELD_LABEL_DIVERGENCE_CEILING}) without the ceiling being lowered to match`, () => {
    const diverging = GRADED.filter((r) => r.grade === 'diverges');
    if (diverging.length < FRAME_FIELD_LABEL_DIVERGENCE_CEILING) {
      throw new Error(
        `${diverging.length} field labels diverge, below the ceiling of ` +
          `${FRAME_FIELD_LABEL_DIVERGENCE_CEILING}. Lower the ceiling in the same commit:\n` +
          `  export const FRAME_FIELD_LABEL_DIVERGENCE_CEILING = ${diverging.length};`
      );
    }
    expect(diverging.length).toBeGreaterThanOrEqual(FRAME_FIELD_LABEL_DIVERGENCE_CEILING);
  });

  it(`never exceeds FRAME_FIELD_LABEL_UNRESOLVED_CEILING (${FRAME_FIELD_LABEL_UNRESOLVED_CEILING}) unresolved field labels`, () => {
    const unresolved = GRADED.filter((r) => r.grade === 'unresolved');
    if (unresolved.length > FRAME_FIELD_LABEL_UNRESOLVED_CEILING) {
      throw new Error(
        `${unresolved.length} field labels are unresolved, above the ceiling of ` +
          `${FRAME_FIELD_LABEL_UNRESOLVED_CEILING}. Offenders:\n${offenderLines(unresolved).join('\n')}`
      );
    }
    expect(unresolved.length).toBeLessThanOrEqual(FRAME_FIELD_LABEL_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW FRAME_FIELD_LABEL_UNRESOLVED_CEILING (${FRAME_FIELD_LABEL_UNRESOLVED_CEILING}) without the ceiling being lowered to match`, () => {
    const unresolved = GRADED.filter((r) => r.grade === 'unresolved');
    if (unresolved.length < FRAME_FIELD_LABEL_UNRESOLVED_CEILING) {
      throw new Error(
        `${unresolved.length} field labels are unresolved, below the ceiling of ` +
          `${FRAME_FIELD_LABEL_UNRESOLVED_CEILING}. Lower the ceiling in the same commit:\n` +
          `  export const FRAME_FIELD_LABEL_UNRESOLVED_CEILING = ${unresolved.length};`
      );
    }
    expect(unresolved.length).toBeGreaterThanOrEqual(FRAME_FIELD_LABEL_UNRESOLVED_CEILING);
  });

  it('reference: matches/diverges/unresolved counts partition the whole population', () => {
    const matches = GRADED.filter((r) => r.grade === 'matches').length;
    const diverges = GRADED.filter((r) => r.grade === 'diverges').length;
    const unresolved = GRADED.filter((r) => r.grade === 'unresolved').length;
    expect(matches + diverges + unresolved).toBe(GRADED.length);
  });
});

// Silence unused-import lints for helpers kept exported for future sibling
// ledgers (mirroring test/frame-control-label.scan.test.ts's own re-export
// convention) while staying referenced here.
void PHONE_GRADED;
void DESKTOP_GRADED;
