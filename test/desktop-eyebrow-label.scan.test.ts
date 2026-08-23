// Frame drawn-EYEBROW ledger, DESKTOP half (DEC-986 wave-41 amendment;
// task w41-f).
//
// test/frame-eyebrow-label.scan.test.ts's own closing section ("Next
// population, deliberately not built here") names this exact population:
// the desktop (non-390) card frames, graded by the SAME uppercase/
// control-face/input-box disjointness rules that phone ledger applies. It
// declined to build it because that ledger's population is the width:390
// extents only. This file is that population's own instrument.
//
// PORT, NEVER IMPORT (this campaign's standing precedent, restated by every
// sibling desktop ledger's own header -- test/desktop-control-label
// .scan.test.ts's, for one): test/frame-eyebrow-label.scan.test.ts is held
// by in-flight v12m-w40-c, which is draining its own
// FRAME_EYEBROW_UNRESOLVED_CEILING. Every extraction primitive below
// (TAG_RE, hasControlFace, isFollowedByInputBox, eyebrowsInFrameText) is a
// verbatim copy of that file's own, so a grammar change on one side can
// never silently regrade the other.
//
//   1. POPULATION (derived at test time, never hand-listed -- DEC-808):
//      readdirSync docs/design for *.dc.html. Frame enumeration here is
//      PORTED from test/desktop-frame-ledger.scan.test.ts's own label-per-
//      frame walk (that file's `allFramesInFile`/`isFrameLine` at
//      test/desktop-frame-ledger.scan.test.ts:191): every `font-size:19px
//      ... >TITLE<` label line (the wider LABEL_RE that file uses, which
//      accepts any closing tag, not only `</span>` -- desktop labels are
//      sometimes set on an `<a>`) OPENS a frame; the frame's extent runs to
//      the next such label, CLIPPED at the file's own single `</x-dc>`
//      line if that comes first (DEC-967 wave-41: "a frame extent ends at
//      the pack template's own close, never at EOF" -- the last labelled
//      block in every .dc.html otherwise swallows the file's trailing
//      `<script data-dc-script>` fixture body). A frame is DESKTOP when its
//      (clipped) extent contains NO `width:390px`+`height:844` line
//      anywhere in it -- the exact `isPhone` predicate
//      test/desktop-frame-ledger.scan.test.ts:191 already uses, restated
//      here rather than imported (that file is a sibling lane's own
//      population, port not cross-import).
//
//      MEASURED WRINKLE (found this wave, not assumed): a desktop label
//      line is frequently followed, BEFORE the card itself opens, by a
//      design-RATIONALE annotation span painted in the identical
//      `font-size:11px; text-transform:uppercase` idiom the eyebrow grammar
//      matches (e.g. Chautauqua Account.dc.html:29, `"Forgot your
//      password?" starts the reset below` -- a note to the mockup's reader
//      about why the screen looks this way, never text the product
//      renders). The phone ledger never meets this row: its own frame
//      anchor is the `width:390px` DIV itself, which opens AFTER that
//      annotation span, so the row sits outside its extent by construction.
//      A label-line anchor does not have that boundary, so this file
//      additionally restricts EYEBROW EXTRACTION (not frame/isPhone
//      classification, which stays label-anchored per this task's own
//      citation) to the sub-extent starting at the pack's own non-390 CARD
//      SIGNATURE line -- `background:#F4F1E8; border:1px solid #D3CFC0;
//      border-radius:6px; overflow:hidden; box-shadow:0 18px 44px
//      rgba(27,29,23,0.13)` -- the SAME signature and the SAME
//      content-extraction anchor test/desktop-control-label.scan.test.ts's
//      own framesInFile already uses for its own content extraction, ported
//      here rather than invented fresh. A label extent with no card
//      signature in it at all (an explainer/style-guide panel with no
//      drawable card of its own) contributes nothing.
//
//      Inside each card sub-extent, an EYEBROW CANDIDATE is extracted by
//      the IDENTICAL grammar test/frame-eyebrow-label.scan.test.ts uses for
//      its phone population: a `<span|div style="...">TEXT</span|div>`
//      whose style carries `text-transform:uppercase`, whose own TEXT
//      contains no `<`, `>` or `{{`, and is >= 2 chars after trim; a
//      candidate whose OWN style carries a control face (min-height +
//      border-radius + (border:1px or background:)) is dropped
//      (control-label ledger territory), and a candidate followed within a
//      400-char sibling window by an input-shaped box (`border:1px solid
//      #BAB6A6` with a border-radius) is dropped (field-label ledger
//      territory).
//
//   2. DISJOINTNESS BY CONSTRUCTION, asserted directly (not merely argued):
//      a. Against test/frame-caption-ledger.scan.test.ts's ALL_CAPTIONS
//         (that ledger covers every frame, phone AND desktop, but excludes
//         text-transform:uppercase by its own grammar -- disjoint the same
//         way the phone eyebrow ledger's own disjointness test proves it).
//      b. Against test/desktop-control-label.scan.test.ts's own ALL_LABELS
//         (that ledger's population is footer/anchor/painted-span CONTROL
//         shapes over the SAME non-390 card-signature frames; this file's
//         own control-face drop (a) already excludes any candidate sharing
//         that ledger's face grammar, verified here by re-checking every
//         population row's (fileName, line) against ALL_LABELS directly).
//      c. Every population row sits inside an extent this file's own
//         isPhone predicate calls false -- structurally disjoint from
//         test/frame-eyebrow-label.scan.test.ts's phone-only population by
//         the same width:390px+height:844 signature that ledger's own
//         header states in the reverse direction.
//
//   3. JOIN: identical technique to the phone ledger, ported: verbatim
//      case-folded match against every non-test .ts/.tsx/.css file under
//      app/src/** and src/** (enumerateSourceFiles/normalizeSource/
//      labelIsMatched, imported from ./frame-source-corpus verbatim,
//      DEC-613 -- the one shared stripper/matcher, never re-implemented),
//      then the digit-collapsed skeleton join (collapseDigitsToSkeleton,
//      same import) for any miss still carrying a digit.
//
//   4. GRADE: MATCHED / DIVERGES / UNRESOLVED / SETTLED, identical shape to
//      the phone ledger. DESKTOP IS FROZEN (mobile-campaign mandate): this
//      file measures and adjudicates, it repairs no product byte and no
//      CSS.
//
//      SCOPE NARROWING, STATED HONESTLY (measured this wave, not assumed):
//      the desktop population (245 rows) is roughly 4x the phone ledger's
//      62, because every non-390 card carries its own copy of this pack's
//      shared eyebrow idiom, repeated per file rather than shared like the
//      phone footer/nav chrome is. Individually verifying every miss's
//      composing source expression -- the labour the phone ledger spent an
//      entire wave on for 16 rows -- is out of this task's own scope for
//      103 rows; that full pass is this ledger's own NEXT population,
//      named in docs/design/audit/desktop-eyebrow-label-v12.md's own
//      closing section. This wave verifies only the two rows (one
//      composing expression, two frame instances) the phone eyebrow ledger
//      ALREADY verified for the identical expression (COMPOSED below,
//      DEC-180: a discriminator narrows the miss classification, it never
//      hides a real offender after classification) -- UNRESOLVED. Every
//      other unmatched row is graded DIVERGES at face value: some are real
//      copy gaps (the pack's own illustrative frame text vs. the app's
//      actual words), some are design-rationale prose this pack's author
//      never intended the app to render verbatim, and some are
//      composed-from-data misses this wave's join technique did not
//      individually verify -- the audit doc's per-file table and sample
//      citations make this composition visible rather than pretending a
//      single number tells the whole story.
//
//   5. RATCHET -- two constants, both hand-measured on this branch by
//      forcing them to -1 and reading the printed offender list back:
//      DESKTOP_EYEBROW_DIVERGENCE_CEILING and
//      DESKTOP_EYEBROW_UNRESOLVED_CEILING. Both two-sided (a companion `it`
//      fails when the measured count falls BELOW the ceiling). Both
//      registered in scripts/exit-predicate/campaign-scope.ts's
//      OUT_OF_CAMPAIGN_SCOPE with a principle reason (DEC-099): a newly
//      measured, previously-uncounted population must not move the
//      campaign's own exit-gate goalposts mid-convergence -- the same
//      disposition already given to FRAME_EYEBROW_DIVERGENCE_CEILING /
//      FRAME_EYEBROW_UNRESOLVED_CEILING and to
//      DESKTOP_FLOOR_DIVERGENCE_CEILING / DESKTOP_FLOOR_UNRESOLVED_CEILING.
//
// This file MEASURES AND ADJUDICATES ONLY -- it moves no product byte and
// no CSS (DESKTOP IS FROZEN).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_099, DEC_180, DEC_613, DEC_808, DEC_967, DEC_976, DEC_986 } from '../src/decisions';
import { ALL_CAPTIONS } from './frame-caption-ledger/population';
import { ALL_LABELS } from './desktop-control-label.scan.test';
import { collapseDigitsToSkeleton, enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';
import { stripHtmlComments } from './helpers/strip-html-comments';

// Compile-checked dependency markers (CLAUDE.md: code depending on a
// decision must reference its constant so the dependency is compile-
// checked).
void DEC_986; // this ledger's own ruling (wave-41 amendment): the desktop half of the eyebrow grammar is owed and this file builds it.
void DEC_976; // the eyebrow population's own originating ruling (wave-27 amendment), ported for the desktop half.
void DEC_808; // population derived from the tree at test time, never hand-listed.
void DEC_180; // a discriminator (control-face / input-box / digit) narrows the POPULATION or the MISS classification, never hides a real offender after classification.
void DEC_613; // the match-side stripper/matcher and the digit-collapsed skeleton sentinel are imported, never re-implemented.
void DEC_099; // OUT_OF_CAMPAIGN_SCOPE reasons below are principles, not schedules.
void DEC_967; // frame extents are clipped at the pack template's own </x-dc> close, never run to EOF.

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: every label-opened, NON-phone frame in docs/design --------
// (ported from test/desktop-frame-ledger.scan.test.ts's own allFramesInFile
// / isFrameLine / isLabelLine -- that file's own header calls this the
// desktop-frame idiom; per this campaign's "port, don't cross-import a
// population walk" convention.)

interface Frame {
  fileName: string;
  line: number;
  title: string;
  /** Extent end (exclusive): the next label line, or the file's own
   * </x-dc> close line, whichever comes first (DEC-967 wave-41 clip). */
  extentEnd: number;
}

const LABEL_RE = />([^<]+)<\//;
const XDC_CLOSE_RE = /<\/x-dc>/;

function isPhoneFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to every sibling ledger's own designFiles(). */
export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** The 1-based line number of `fileName`'s own single `</x-dc>` close, or
 * Infinity if none exists. Throws loudly if more than one is found -- the
 * task's own premise ("the file's single </x-dc> line") is an assumption
 * this function verifies rather than trusts. */
function xdcCloseLine(lines: string[]): number {
  const hits: number[] = [];
  lines.forEach((content, idx) => {
    if (XDC_CLOSE_RE.test(content)) hits.push(idx + 1);
  });
  if (hits.length > 1) {
    throw new Error(`expected at most one </x-dc> line, found ${hits.length}: ${hits.join(', ')}`);
  }
  return hits.length === 1 ? hits[0]! : Infinity;
}

/** Every label-opened frame in `fileName`, tagged with whether it is a
 * phone (width:390px+height:844) frame -- the DESKTOP population below
 * keeps only the ones this returns `isPhone: false` for, the exact
 * predicate test/desktop-frame-ledger.scan.test.ts:191 already uses. */
function allFramesInFile(fileName: string): { frame: Frame; isPhone: boolean }[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const xdcLine = xdcCloseLine(lines);

  const labelLines: { line: number; title: string }[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
  });

  return labelLines.map((label, i) => {
    const nextLabel = labelLines[i + 1];
    // DEC-967 wave-41 clip: extent ends at the next label, OR the file's
    // own </x-dc> close, whichever comes first -- never EOF.
    const extentEnd = Math.min(nextLabel ? nextLabel.line : Infinity, xdcLine);
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isPhoneFrameLine);
    return {
      frame: { fileName, line: label.line, title: label.title, extentEnd },
      isPhone,
    };
  });
}

/** Every desktop (non-390) frame across the whole pack. */
function desktopFramesInFile(fileName: string): Frame[] {
  return allFramesInFile(fileName)
    .filter((entry) => !entry.isPhone)
    .map((entry) => entry.frame);
}

function lineStartIndexOf(content: string): number[] {
  const lines = content.split('\n');
  const idx: number[] = [0];
  for (let i = 0; i < lines.length; i++) idx.push(idx[i]! + lines[i]!.length + 1);
  return idx;
}

function offsetToLine(lineStartIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineStartIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStartIndex[mid]! <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

// -- Eyebrow candidate extraction (ported VERBATIM from
// test/frame-eyebrow-label.scan.test.ts -- never imported, that file is
// owned by in-flight v12m-w40-c) ---------------------------------------

export interface Eyebrow {
  fileName: string;
  line: number;
  text: string;
  frameTitle: string;
  frameLine: number;
}

const TAG_RE = /<(span|div)\s+style="([^"]*)">([^<]*)<\/\1>/gs;
const UPPERCASE_RE = /text-transform:uppercase/;
const CONTROL_FACE_MIN_HEIGHT_RE = /min-height:\d+px/;
const CONTROL_FACE_BORDER_RADIUS_RE = /border-radius/;
const CONTROL_FACE_BORDER_OR_BG_RE = /border:1px|background:/;
const INPUT_BOX_BORDER_RE = /border:1px solid #BAB6A6/;
const INPUT_BOX_RADIUS_RE = /border-radius/;
const INPUT_BOX_WINDOW = 400;

function hasControlFace(style: string): boolean {
  return (
    CONTROL_FACE_MIN_HEIGHT_RE.test(style) &&
    CONTROL_FACE_BORDER_RADIUS_RE.test(style) &&
    CONTROL_FACE_BORDER_OR_BG_RE.test(style)
  );
}

function isFollowedByInputBox(text: string, tagEnd: number): boolean {
  const nextEyebrow = text.indexOf('text-transform:uppercase', tagEnd);
  const windowEnd = Math.min(
    text.length,
    tagEnd + INPUT_BOX_WINDOW,
    nextEyebrow === -1 ? Infinity : nextEyebrow
  );
  const window = text.slice(tagEnd, windowEnd);
  return INPUT_BOX_BORDER_RE.test(window) && INPUT_BOX_RADIUS_RE.test(window);
}

/** Extracts every population-qualifying eyebrow candidate from raw frame-
 * extent TEXT. Exported so the non-vacuity synthetic fixture below can
 * drive this exact function over a fabricated fixture, never a real
 * product count. */
export function eyebrowsInFrameText(text: string): { offset: number; text: string }[] {
  const out: { offset: number; text: string }[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text)) !== null) {
    const style = m[2]!;
    const rawText = m[3]!;
    if (!UPPERCASE_RE.test(style)) continue;
    if (rawText.includes('<') || rawText.includes('>') || rawText.includes('{{')) continue;
    const trimmed = rawText.trim();
    if (trimmed.length < 2) continue;
    if (hasControlFace(style)) continue; // control-label ledger territory
    const tagEnd = m.index + m[0].length;
    if (isFollowedByInputBox(text, tagEnd)) continue; // field-label ledger territory
    out.push({ offset: m.index, text: trimmed });
  }
  return out;
}

// The pack's own non-390 card signature (ported verbatim from
// test/desktop-control-label.scan.test.ts's own CARD_SIGNATURE -- the
// SAME string that ledger anchors its own content extraction on). A label
// line is frequently followed, BEFORE the card itself opens, by a design-
// rationale annotation span in the identical
// `font-size:11px; text-transform:uppercase` idiom this file's own
// UPPERCASE_RE/eyebrowsInFrameText grammar matches (e.g. Chautauqua
// Account.dc.html:29, `"Forgot your password?" starts the reset below` --
// a note to the mockup's reader about WHY the screen looks this way, never
// text the product renders). That row sits between the label line and the
// card-signature line, inside the LABEL-anchored extent isPhone above
// walks, but is not itself drawn UI copy -- test/desktop-control-label
// .scan.test.ts's own content-extraction convention already excludes it
// the same way, by starting its OWN frame at the card-signature line, not
// the label line. This file follows that same, proven convention for
// CONTENT extraction (though not for isPhone classification, which stays
// label-anchored per this task's own citation of
// test/desktop-frame-ledger.scan.test.ts:191): eyebrow extraction is
// restricted to the extent starting at the card-signature line, when one
// is found inside the label's (isPhone-classified) extent; a label whose
// extent contains no card-signature line at all (an explainer panel, or a
// desktop label with no drawable card of its own) contributes nothing --
// there is no card for a product eyebrow to sit inside.
const CARD_SIGNATURE =
  'background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px; overflow:hidden; box-shadow:0 18px 44px rgba(27,29,23,0.13)';

function eyebrowsInFile(fileName: string): Eyebrow[] {
  const full = join(DESIGN_ROOT, fileName);
  // Comment-blind guard (DEC-374 wave-44, task w44-i, shared
  // test/helpers/strip-html-comments.ts -- DEC-613, never a private copy):
  // an `<!-- -->` frame comment must never contribute a false
  // CARD_SIGNATURE hit or eyebrow text below. Newline-count-preserving, so
  // lineStartIndex/offsetToLine stay valid.
  const content = stripHtmlComments(readFileSync(full, 'utf-8'));
  const lineStartIndex = lineStartIndexOf(content);
  const frames = desktopFramesInFile(fileName);
  const out: Eyebrow[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const fullExtentText = content.slice(startOff, endOff);
    const cardRel = fullExtentText.indexOf(CARD_SIGNATURE);
    if (cardRel === -1) continue; // no card in this label's extent -- not a drawable screen
    const cardStartOff = startOff + cardRel;
    const text = content.slice(cardStartOff, endOff);
    for (const r of eyebrowsInFrameText(text)) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, cardStartOff + r.offset),
        text: r.text,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

export const ALL_EYEBROWS: Eyebrow[] = designFiles().flatMap(eyebrowsInFile);

// -- Match side: every non-test .ts/.tsx/.css under app/src/** and src/** --

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) =>
  normalizeSource(readFileSync(f, 'utf-8')).toLowerCase()
);

function eyebrowIsMatched(text: string): boolean {
  return labelIsMatched(text.toLowerCase(), NORMALIZED_SOURCE_BLOBS);
}

const SKELETON_SOURCE_BLOBS: string[] = NORMALIZED_SOURCE_BLOBS.map(collapseDigitsToSkeleton);
const HAS_DIGIT_RE_FOR_SKELETON = /\d/;

/** True when `text` carries a digit AND its digit-collapsed skeleton occurs
 * verbatim in the digit-collapsed corpus. Exported so the non-vacuity
 * synthetic control below can drive it directly. */
export function eyebrowIsMatchedBySkeleton(text: string): boolean {
  if (!HAS_DIGIT_RE_FOR_SKELETON.test(text)) return false;
  const skeleton = collapseDigitsToSkeleton(text.toLowerCase());
  return labelIsMatched(skeleton, SKELETON_SOURCE_BLOBS);
}

// -- COMPOSED misses individually verified on this branch ------------------
// The desktop population (245 rows, well past the phone ledger's 62) is too
// large for this task's own scope to hand-verify every miss's composing
// source expression the way the phone ledger did for its 16 UNRESOLVED rows
// -- that full pass is this ledger's own next lane, named in this file's
// audit doc under "Next work, deliberately not done here". This wave
// verifies only the rows the phone eyebrow ledger ALREADY verified for the
// identical composing expression, now confirmed to resolve at their desktop
// coordinates too (DEC-613: never a second independent investigation of a
// join already proven).
interface Composed {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

const COMPOSED: Composed[] = [
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 202,
    text: 'Wave 2 · AI Engineering · round 1',
    reason:
      'COMPOSED-from-data: `scorecardEyebrow` (app/src/pages/review/Scorecard.tsx, ' +
      '`[plan.name, planTrackScope(...), planNamesRound(plan.rounds) ? roundLabel(...) : null]`) ' +
      "joins the plan name, track scope and round label from the live review plan, never the " +
      "frame's fixed 'Wave 2 · AI Engineering · round 1' -- the identical composing expression the " +
      "phone eyebrow ledger's own DIGIT_COMPOSED table already verified for its own instance of this " +
      'row (docs/design/audit/frame-eyebrow-label-390-v12.md).',
  },
];

function isComposed(e: Eyebrow): boolean {
  return COMPOSED.some((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
}

interface Classified {
  eyebrow: Eyebrow;
  verdict: 'MATCHED' | 'DIVERGES' | 'UNRESOLVED' | 'SETTLED';
}

const CLASSIFIED: Classified[] = ALL_EYEBROWS.map((eyebrow) => {
  if (eyebrowIsMatched(eyebrow.text)) return { eyebrow, verdict: 'MATCHED' as const };
  if (eyebrowIsMatchedBySkeleton(eyebrow.text)) return { eyebrow, verdict: 'MATCHED' as const };
  if (isComposed(eyebrow)) return { eyebrow, verdict: 'UNRESOLVED' as const };
  return { eyebrow, verdict: 'DIVERGES' as const };
});

const MATCHED = CLASSIFIED.filter((c) => c.verdict === 'MATCHED');
const DIVERGES = CLASSIFIED.filter((c) => c.verdict === 'DIVERGES');
const UNRESOLVED = CLASSIFIED.filter((c) => c.verdict === 'UNRESOLVED');
const SETTLED = CLASSIFIED.filter((c) => c.verdict === 'SETTLED');

// -- Ratchets -----------------------------------------------------------
// Both hand-measured on this branch (v12m-w41-f) by forcing to -1 and
// reading the printed offender roster back -- never guessed, never a
// computed expression. See docs/design/audit/desktop-eyebrow-label-v12.md
// for the full per-row breakdown, per-file table and the two individually
// verified UNRESOLVED rows.
export const DESKTOP_EYEBROW_DIVERGENCE_CEILING = 103;
export const DESKTOP_EYEBROW_UNRESOLVED_CEILING = 1;

describe('desktop drawn-eyebrow ledger (DEC-986 wave-41, v12 mobile campaign)', () => {
  it('non-vacuity: population is non-trivial and spans multiple frames and files', () => {
    expect(ALL_EYEBROWS.length).toBeGreaterThan(5);
    const distinctFiles = new Set(ALL_EYEBROWS.map((e) => e.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(2);
    const distinctFrames = new Set(ALL_EYEBROWS.map((e) => `${e.fileName}:${e.frameLine}`));
    expect(distinctFrames.size).toBeGreaterThanOrEqual(2);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
    expect(designFiles().length).toBe(13);
  });

  it('vacuous-population tripwire: enumerates exactly the measured desktop eyebrow population', () => {
    expect(ALL_EYEBROWS.length).toBe(245);
    expect(new Set(ALL_EYEBROWS.map((e) => e.fileName)).size).toBe(13);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file frame extent, never a live product count', () => {
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#565A4B">Zzy Synthetic Desktop Eyebrow Present</span>',
      '  <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#565A4B">Zzy Synthetic Desktop Eyebrow Absent</span>',
      // Excluded (a): carries a control face (min-height + border-radius + border/background).
      '  <span style="text-transform:uppercase; min-height:44px; border-radius:6px; border:1px solid #000">Zzy Synthetic Control Face Not Counted</span>',
      // Excluded (b): followed within the window by an input-shaped box.
      '  <div style="display:flex; flex-direction:column">',
      '    <span style="text-transform:uppercase; color:#565A4B">Zzy Synthetic Field Label Not Counted</span>',
      '    <div style="border:1px solid #BAB6A6; border-radius:4px">value</div>',
      '  </div>',
      // Excluded by not being uppercase at all.
      '  <span style="color:#565A4B">Zzy Synthetic Lowercase Not An Eyebrow</span>',
      // Excluded by the < / > containment rule (wraps further markup).
      '  <div style="text-transform:uppercase"><span>Zzy Synthetic Nested Markup Not Counted</span></div>',
      // Excluded by the {{ containment rule (template, not literal prose).
      '  <span style="text-transform:uppercase">{{ t.label }}</span>',
      '</div>',
    ].join('\n');

    const extracted = eyebrowsInFrameText(fabricatedFrameText);
    const extractedTexts = extracted.map((e) => e.text);
    expect(extractedTexts).toContain('Zzy Synthetic Desktop Eyebrow Present');
    expect(extractedTexts).toContain('Zzy Synthetic Desktop Eyebrow Absent');
    expect(extractedTexts.some((t) => t.includes('Control Face'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Field Label'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Lowercase'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Nested Markup'))).toBe(false);
    expect(extractedTexts.length).toBe(2);

    const fabricatedSource = normalizeSource(
      [
        '// this comment mentions Zzy Synthetic Desktop Eyebrow Absent and must not satisfy it',
        'const x = "Zzy Synthetic Desktop Eyebrow Present";',
      ].join('\n')
    ).toLowerCase();

    expect(labelIsMatched('zzy synthetic desktop eyebrow present', [fabricatedSource])).toBe(true);
    expect(labelIsMatched('zzy synthetic desktop eyebrow absent', [fabricatedSource])).toBe(false);
  });

  it('clip fixture: a synthetic file whose last labelled block runs past a </x-dc> close is clipped there, never to EOF', () => {
    // Fabricated, never a real product file -- proves xdcCloseLine/the
    // extentEnd clip directly, the same discipline every other synthetic
    // control in this file follows (never validate a detector by reading
    // the same array it grades as its own evidence, DEC-967).
    const lines = [
      '<div style="width:1600px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px">',
      '<span style="font-size:19px">Zzy Synthetic Desktop Frame</span>',
      '<span style="text-transform:uppercase">Zzy Synthetic Clipped Eyebrow</span>',
      '</x-dc>',
      '<script data-dc-script>',
      '<span style="text-transform:uppercase">Zzy Synthetic Fixture Body Eyebrow Not A Screen</span>',
      '</script>',
    ];
    const xdcLine = xdcCloseLine(lines);
    expect(xdcLine).toBe(4);
    const labelLine = 2;
    const extentEnd = Math.min(Infinity, xdcLine);
    expect(extentEnd).toBe(4);
    const extentText = lines.slice(labelLine - 1, extentEnd - 1).join('\n');
    expect(extentText).toContain('Zzy Synthetic Clipped Eyebrow');
    expect(extentText).not.toContain('Zzy Synthetic Fixture Body Eyebrow Not A Screen');
  });

  it('disjointness: the population shares no (fileName, line) with the caption ledger population (by construction: that ledger excludes uppercase, this one requires it)', () => {
    const captionKeys = new Set(ALL_CAPTIONS.map((c) => `${c.fileName}:${c.line}`));
    const overlap = ALL_EYEBROWS.filter((e) => captionKeys.has(`${e.fileName}:${e.line}`));
    expect(overlap, JSON.stringify(overlap)).toEqual([]);
  });

  it('disjointness: the population shares no (fileName, line) with the desktop control-label ledger population', () => {
    const controlKeys = new Set(ALL_LABELS.map((c) => `${c.fileName}:${c.line}`));
    const overlap = ALL_EYEBROWS.filter((e) => controlKeys.has(`${e.fileName}:${e.line}`));
    expect(overlap, JSON.stringify(overlap)).toEqual([]);
  });

  it('disjointness: every population eyebrow sits inside a frame this file\'s own isPhone predicate calls false, structurally disjoint from the phone eyebrow ledger\'s population', () => {
    for (const e of ALL_EYEBROWS) {
      const full = join(DESIGN_ROOT, e.fileName);
      const lines = readFileSync(full, 'utf-8').split('\n');
      const entry = allFramesInFile(e.fileName).find((f) => f.frame.line === e.frameLine);
      expect(entry, `${e.fileName}:${e.frameLine} no longer resolves to a frame`).toBeDefined();
      expect(entry!.isPhone, `${e.fileName}:${e.frameLine}`).toBe(false);
      void lines;
    }
  });

  it('COMPOSED exclusions each resolve to their cited file:line:text, still carry a digit or a live composing source, and are still unresolved by both joins', () => {
    for (const c of COMPOSED) {
      const hit = ALL_EYEBROWS.find((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
      expect(hit, `${c.fileName}:${c.line} no longer resolves to the cited text in the pack`).toBeDefined();
      expect(eyebrowIsMatched(c.text), `${c.fileName}:${c.line} now matches the primary join; this row is stale`).toBe(false);
      expect(
        eyebrowIsMatchedBySkeleton(c.text),
        `${c.fileName}:${c.line} now resolves under the skeleton pass; this row is stale, it belongs in MATCHED, not COMPOSED`
      ).toBe(false);
    }
  });

  it('non-vacuity control: the skeleton pass resolves an eyebrow differing from a real source literal ONLY in a digit run, but NOT one differing by a word -- both ways, never a live product count', () => {
    const fabricatedSource = normalizeSource(
      'const zzyBadge = `Zzy Synthetic Desktop Retention Window · 12 days`;'
    ).toLowerCase();

    const digitOnlyDiffers = 'Zzy Synthetic Desktop Retention Window · 45 days';
    expect(HAS_DIGIT_RE_FOR_SKELETON.test(digitOnlyDiffers)).toBe(true);
    const digitSkeleton = collapseDigitsToSkeleton(digitOnlyDiffers.toLowerCase());
    expect(labelIsMatched(digitSkeleton, [collapseDigitsToSkeleton(fabricatedSource)])).toBe(true);

    const wordDiffers = 'Zzy Synthetic Desktop Retention Period · 12 days';
    expect(HAS_DIGIT_RE_FOR_SKELETON.test(wordDiffers)).toBe(true);
    const wordSkeleton = collapseDigitsToSkeleton(wordDiffers.toLowerCase());
    expect(labelIsMatched(wordSkeleton, [collapseDigitsToSkeleton(fabricatedSource)])).toBe(false);

    expect(eyebrowIsMatchedBySkeleton('Zzy No Digit At All')).toBe(false);
  });

  it('classification totals partition the population exactly (MATCHED + DIVERGES + UNRESOLVED + SETTLED = population)', () => {
    expect(MATCHED.length + DIVERGES.length + UNRESOLVED.length + SETTLED.length).toBe(ALL_EYEBROWS.length);
  });

  it(`never exceeds DESKTOP_EYEBROW_DIVERGENCE_CEILING (${DESKTOP_EYEBROW_DIVERGENCE_CEILING}) real eyebrow divergences`, () => {
    if (DIVERGES.length > DESKTOP_EYEBROW_DIVERGENCE_CEILING) {
      const offenders = DIVERGES.map((c) => `${c.eyebrow.fileName}:${c.eyebrow.line} -- "${c.eyebrow.text}"`);
      throw new Error(
        `${DIVERGES.length} desktop eyebrow divergences, above the ceiling of ${DESKTOP_EYEBROW_DIVERGENCE_CEILING}. ` +
          `DESKTOP_EYEBROW_DIVERGENCE_CEILING may only be RAISED (a merge-train act, never a worker's edit ` +
          `mid-lane), and only once re-measured against the integrated tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(DIVERGES.length).toBeLessThanOrEqual(DESKTOP_EYEBROW_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW DESKTOP_EYEBROW_DIVERGENCE_CEILING (${DESKTOP_EYEBROW_DIVERGENCE_CEILING}) without the ceiling being lowered to match`, () => {
    if (DIVERGES.length < DESKTOP_EYEBROW_DIVERGENCE_CEILING) {
      throw new Error(
        `${DIVERGES.length} desktop eyebrow divergences, below the ceiling of ${DESKTOP_EYEBROW_DIVERGENCE_CEILING}. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const DESKTOP_EYEBROW_DIVERGENCE_CEILING = ${DIVERGES.length};`
      );
    }
    expect(DIVERGES.length).toBeGreaterThanOrEqual(DESKTOP_EYEBROW_DIVERGENCE_CEILING);
  });

  it(`never exceeds DESKTOP_EYEBROW_UNRESOLVED_CEILING (${DESKTOP_EYEBROW_UNRESOLVED_CEILING}) unresolved eyebrow misses`, () => {
    if (UNRESOLVED.length > DESKTOP_EYEBROW_UNRESOLVED_CEILING) {
      const offenders = UNRESOLVED.map((c) => `${c.eyebrow.fileName}:${c.eyebrow.line} -- "${c.eyebrow.text}"`);
      throw new Error(
        `${UNRESOLVED.length} unresolved desktop eyebrow misses, above the ceiling of ${DESKTOP_EYEBROW_UNRESOLVED_CEILING}. ` +
          `DESKTOP_EYEBROW_UNRESOLVED_CEILING may only be RAISED (a merge-train act), and only once re-measured ` +
          `against the integrated tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNRESOLVED.length).toBeLessThanOrEqual(DESKTOP_EYEBROW_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW DESKTOP_EYEBROW_UNRESOLVED_CEILING (${DESKTOP_EYEBROW_UNRESOLVED_CEILING}) without the ceiling being lowered to match`, () => {
    if (UNRESOLVED.length < DESKTOP_EYEBROW_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} unresolved desktop eyebrow misses, below the ceiling of ${DESKTOP_EYEBROW_UNRESOLVED_CEILING}. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const DESKTOP_EYEBROW_UNRESOLVED_CEILING = ${UNRESOLVED.length};`
      );
    }
    expect(UNRESOLVED.length).toBeGreaterThanOrEqual(DESKTOP_EYEBROW_UNRESOLVED_CEILING);
  });
});
