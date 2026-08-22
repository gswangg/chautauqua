// Frame drawn-EYEBROW ledger (DEC-976 wave-27; task w27-e).
//
// Four ledgers already grade the words this pack draws, and every one of
// them explicitly steps AROUND the population this file names:
//   - test/frame-caption-ledger.scan.test.ts grades muted-prose captions,
//     but EXCLUDES `text-transform:uppercase` by its own stated grammar
//     ("an eyebrow/label chip, not prose").
//   - test/frame-control-label.scan.test.ts and
//     test/desktop-control-label.scan.test.ts key on CONTROL SHAPES
//     (docked-footer regions, `<a min-height:44px>` anchors, painted spans
//     carrying min-height + border-radius + a face) -- a bare eyebrow span
//     has none of those.
//   - The two field-label ledgers (in flight this wave) both REQUIRE an
//     input-shaped box (`border:1px solid #BAB6A6` with a border-radius)
//     immediately after the caption.
// A section eyebrow, a table column head, or a status micro-label -- an
// uppercase-transform span with no control face and no following input box
// -- is graded by none of the five. That silence is exactly where the
// Organiser/Organizer divergence a sibling lane closed this wave had been
// sitting (field guide, wave-27 EXCLUSION-TABLE entry).
//
//   1. POPULATION (derived at test time, never hand-listed -- DEC-808):
//      readdirSync docs/design for *.dc.html. Frame enumeration is the SAME
//      idiom every sibling ledger in this campaign uses (ported, not
//      imported -- each sibling file already ports its own copy rather than
//      cross-importing, precisely so a worker touching one ledger's
//      population never becomes a merge-conflict on another's): a frame
//      opens on a line carrying both `width:390px` and `height:844`; its
//      title is the nearest preceding `font-size:19px ... >TITLE</span>`
//      label; its extent runs to the next such label, or EOF. ONLY phone
//      (width:390) extents are walked this wave -- the desktop half is
//      named as the NEXT population in the audit doc, deliberately not
//      built here.
//
//      Inside each phone extent, an EYEBROW CANDIDATE is a
//      `<span|div ...>TEXT</span|div>` (opening/closing tag names matched
//      via backreference) whose style attribute carries
//      `text-transform:uppercase`, whose own TEXT contains no `<`, `>` (so
//      a wrapper around further markup can never qualify) or `{{` (a
//      template interpolation, not literal prose the pack itself commits
//      to), and is >= 2 chars after trim.
//
//   2. DISJOINTNESS BY CONSTRUCTION (the ruling, not an optimisation --
//      DEC-976 wave-27 amendment):
//        a. A candidate whose OWN style attribute carries a control face
//           (`min-height:<n>px` AND `border-radius` AND (`border:1px` OR
//           `background:`)) is dropped -- that row is the painted-span
//           control-label ledgers' population, not this one.
//        b. A candidate followed, within its own sibling markup (the next
//           400 characters of raw frame text after its closing tag --
//           measured against the pack: every real field-label pair in this
//           tree sits its input box directly beneath the caption inside
//           the same wrapper `<div>`, well under this bound, while the
//           next unrelated eyebrow in a list is always further away),  by
//           an input-shaped box (`border:1px solid #BAB6A6` with a
//           `border-radius` in that same window) is dropped -- that row
//           belongs to the field-label ledgers.
//      Both drops are asserted disjoint from the other four ledgers'
//      OWN populations below (test 'disjointness'), not merely argued in
//      prose: this population shares no (fileName, line) pair with the
//      caption ledger's ALL_CAPTIONS (trivially, by construction -- that
//      ledger's own grammar excludes text-transform:uppercase and this
//      one requires it), with the phone control-label ledger's control
//      rows (computed here by re-running ITS OWN imported
//      `labelsInFrameText` over the same phone extents this file walks,
//      DEC-613 -- never a second re-implementation of the footer/anchor/
//      painted-span walk), or with the desktop control-label ledger's
//      population (by construction: that ledger's frames are selected by
//      its OWN non-390 card signature -- `border-radius:6px` card corners
//      at width != 390 -- disjoint from this file's `width:390px` +
//      `height:844` frame signature the same way the desktop ledger's own
//      header already proves the reverse direction).
//
//   3. JOIN: every non-test .ts/.tsx/.css file under app/src/** and src/**
//      (`enumerateSourceFiles`, `normalizeSource`, `labelIsMatched` --
//      imported from ./frame-source-corpus verbatim, DEC-613: this is the
//      ONE stripper/matcher every sibling ledger already shares). Both
//      sides are lower-cased before the match: the app renders many of
//      these labels through CSS `text-transform:uppercase` layered over
//      mixed-case source text (`<h3>Questions &middot; 8</h3>` painted
//      uppercase by a class, never typed in Shout Case in the component),
//      so a case-SENSITIVE join would manufacture false divergences out of
//      that styling layer alone. This is the explicit reason this ledger
//      compares case-insensitively where its siblings do not.
//
//      A candidate that fails the verbatim (case-folded) join is not
//      automatically a divergence: MEASURED on this branch, every unmatched
//      candidate whose text carries a digit is a COMPOSED-from-live-data
//      row (a date, a DFC-NNN ref, a count) -- the join technique is a
//      static substring test and can never resolve a value assembled at
//      render time, so a digit-bearing miss is UNRESOLVED, not DIVERGES
//      (this is the same COMPOSED-from-data shape
//      test/frame-control-label.scan.test.ts's own COMPOSED_EXCLUSIONS
//      table names for its footer/anchor population, applied here as a
//      DISCRIMINATOR on the miss rather than a hand-triaged exclusion
//      table, because every single digit-bearing miss on this branch
//      resolved to a live composing expression on inspection -- see
//      docs/design/audit/frame-eyebrow-label-390-v12.md for the per-row
//      citations). Two digit-FREE misses are independently confirmed
//      COMPOSED on inspection (NO_DIGIT_COMPOSED below, each citing the
//      composing source expression) and folded into UNRESOLVED for the
//      same reason. Every other digit-free miss is a genuine, real DIVERGES
//      row (measured: exactly one this wave, recorded in the audit doc,
//      NOT fixed in this lane per this task's own scope).
//
//   4. RATCHET -- two constants, both hand-measured on this branch by
//      forcing them to -1 and reading the printed offender list back
//      (never `= COUNT` or any expression naming the measured set):
//      FRAME_EYEBROW_DIVERGENCE_CEILING (real copy gaps) and
//      FRAME_EYEBROW_UNRESOLVED_CEILING (composed-from-data misses the
//      join technique cannot resolve). Both two-sided, identical shape to
//      every prior ledger in this campaign.
//
// This file MEASURES AND RATCHETS ONLY -- it moves no product byte and no
// CSS. The desktop half of this population is the NEXT lane, not this one.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_099, DEC_180, DEC_613, DEC_808, DEC_976 } from '../src/decisions';
import { ALL_CAPTIONS } from './frame-caption-ledger/population';
import { enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';
import { labelsInFrameText } from './frame-control-label.scan.test';

// Compile-checked dependency markers (CLAUDE.md: code depending on a
// decision must reference its constant so the dependency is compile-
// checked).
void DEC_976; // this ledger's own ruling (wave-27 amendment): the drawn-eyebrow population, disjoint by construction from all four sibling ledgers.
void DEC_808; // population derived from the tree at test time, never hand-listed.
void DEC_180; // an eyebrow discriminator (control-face / input-box / digit) narrows the POPULATION or the MISS classification, never hides a real offender after classification.
void DEC_613; // the match-side stripper/matcher and the control-label extraction walk are imported, never re-implemented.
void DEC_099; // OUT_OF_CAMPAIGN_SCOPE reasons below are principles, not schedules.

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: every width:390/height:844 phone frame in docs/design -----
// (ported verbatim from test/frame-control-label.scan.test.ts's own Frame
// enumeration, per this campaign's standing "port, don't cross-import a
// population walk" convention -- see that file's own header.)

interface Frame {
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
}

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_SPAN_RE.test(line);
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to every sibling ledger's own designFiles(). */
export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

function framesInFile(fileName: string): Frame[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_SPAN_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });

  return frameLineNums.map((frameLine) => {
    let title: string | undefined;
    for (let i = labelLines.length - 1; i >= 0; i--) {
      if (labelLines[i]!.line <= frameLine) {
        title = labelLines[i]!.title;
        break;
      }
    }
    if (title === undefined) {
      throw new Error(`${fileName}:${frameLine} -- no preceding font-size:19px label found`);
    }
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return { fileName, line: frameLine, title, extentEnd: nextLabel ? nextLabel.line : Infinity };
  });
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

// -- Eyebrow candidate extraction -------------------------------------------

export interface Eyebrow {
  fileName: string;
  line: number;
  text: string;
  frameTitle: string;
  frameLine: number;
}

// Opening `<span|div style="...">` through its matching closing tag
// (backreference on the tag name) -- the pack's eyebrow spans are
// single-line in practice, but the grammar does not assume that (`s` flag).
const TAG_RE = /<(span|div)\s+style="([^"]*)">([^<]*)<\/\1>/gs;
const UPPERCASE_RE = /text-transform:uppercase/;
const CONTROL_FACE_MIN_HEIGHT_RE = /min-height:\d+px/;
const CONTROL_FACE_BORDER_RADIUS_RE = /border-radius/;
const CONTROL_FACE_BORDER_OR_BG_RE = /border:1px|background:/;
const INPUT_BOX_BORDER_RE = /border:1px solid #BAB6A6/;
const INPUT_BOX_RADIUS_RE = /border-radius/;
// Sibling-markup lookahead window (chars) for the input-shaped-box drop --
// see the module header's DISJOINTNESS discussion for why 400 was chosen.
const INPUT_BOX_WINDOW = 400;

function hasControlFace(style: string): boolean {
  return (
    CONTROL_FACE_MIN_HEIGHT_RE.test(style) &&
    CONTROL_FACE_BORDER_RADIUS_RE.test(style) &&
    CONTROL_FACE_BORDER_OR_BG_RE.test(style)
  );
}

function isFollowedByInputBox(text: string, tagEnd: number): boolean {
  // The window is capped at whichever comes first: 400 raw characters, or
  // the START of the NEXT eyebrow candidate (another text-transform:
  // uppercase declaration) -- otherwise a short, densely-packed sibling
  // group can leak an unrelated LATER field's input box into an earlier
  // eyebrow's window (measured directly: a synthetic fixture with two
  // eyebrows and one field pair a few lines apart tripped exactly this
  // leak before this bound was added).
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
 * extent TEXT, applying both disjointness drops (control-face,
 * followed-by-input-box). Exported so the non-vacuity synthetic fixture
 * below can drive this exact function over a fabricated fixture, never a
 * real product count. */
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
    if (hasControlFace(style)) continue; // (a) control-label ledger territory
    const tagEnd = m.index + m[0].length;
    if (isFollowedByInputBox(text, tagEnd)) continue; // (b) field-label ledger territory
    out.push({ offset: m.index, text: trimmed });
  }
  return out;
}

function eyebrowsInFile(fileName: string): Eyebrow[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lineStartIndex = lineStartIndexOf(content);
  const frames = framesInFile(fileName);
  const out: Eyebrow[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    for (const r of eyebrowsInFrameText(text)) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, startOff + r.offset),
        text: r.text,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

export const ALL_EYEBROWS: Eyebrow[] = designFiles().flatMap(eyebrowsInFile);

// -- Disjointness cross-check against the phone control-label ledger -------
// Re-derived by calling THAT ledger's own imported `labelsInFrameText` over
// the SAME phone extents this file already walks (DEC-613 -- never a
// second re-implementation of the footer/anchor/painted-span walk).

interface ControlLabelSite {
  fileName: string;
  line: number;
}

function controlLabelSitesInFile(fileName: string): ControlLabelSite[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lineStartIndex = lineStartIndexOf(content);
  const frames = framesInFile(fileName);
  const out: ControlLabelSite[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    const raw = labelsInFrameText(text, lineStartIndex, startOff);
    for (const r of raw) {
      out.push({ fileName, line: offsetToLine(lineStartIndex, startOff + r.offset) });
    }
  }
  return out;
}

const ALL_CONTROL_LABEL_SITES: ControlLabelSite[] = designFiles().flatMap(controlLabelSitesInFile);

// -- Match side: every non-test .ts/.tsx/.css under app/src/** and src/** --

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
// Case-folded (see module header, clause 3): the app frequently paints an
// eyebrow's uppercase transform via CSS over mixed-case source text.
const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) =>
  normalizeSource(readFileSync(f, 'utf-8')).toLowerCase()
);

function eyebrowIsMatched(text: string): boolean {
  return labelIsMatched(text.toLowerCase(), NORMALIZED_SOURCE_BLOBS);
}

// -- Digit-free COMPOSED misses, hand-verified on inspection ----------------
// A digit-bearing miss is classified UNRESOLVED by construction (see module
// header clause 3). These two digit-FREE misses were independently
// inspected and are also COMPOSED-from-a-shared-vocabulary, not a real copy
// gap -- each entry is asserted below to still resolve to its cited
// file:line:text in the current pack, exactly like every prior ledger's
// exclusion-citation guard, so a stale entry fails loudly rather than
// silently mis-classifying a future real divergence as composed.
interface NoDigitComposed {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

const NO_DIGIT_COMPOSED: NoDigitComposed[] = [
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 161,
    text: 'Two sessions in this slot',
    reason:
      "COMPOSED-from-data: `{capitalizeFirst(spellCount(slot.sessions.length))} {plural(slot.sessions.length, 'session')} in this slot` composes the clash-card flag from the live session count using the pack's own spelled-count grammar (app/src/pages/agenda/PhoneAgenda.tsx), never the frame's fixed 'Two'.",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 406,
    text: 'Notes on the slides',
    reason:
      'COMPOSED-from-data: `Notes on the {DELIVERABLE_LABELS[activeKind].toLowerCase()}` composes the deliverable-notes label from the active deliverable kind (app/src/pages/content/DeliverableDetail.tsx:595), never a literal frame-fixed string.',
  },
];

function isNoDigitComposed(e: Eyebrow): boolean {
  return NO_DIGIT_COMPOSED.some((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
}

const DIGIT_RE = /\d/;

interface Classified {
  eyebrow: Eyebrow;
  verdict: 'MATCHED' | 'DIVERGES' | 'UNRESOLVED';
}

const CLASSIFIED: Classified[] = ALL_EYEBROWS.map((eyebrow) => {
  if (eyebrowIsMatched(eyebrow.text)) return { eyebrow, verdict: 'MATCHED' as const };
  if (DIGIT_RE.test(eyebrow.text)) return { eyebrow, verdict: 'UNRESOLVED' as const };
  if (isNoDigitComposed(eyebrow)) return { eyebrow, verdict: 'UNRESOLVED' as const };
  return { eyebrow, verdict: 'DIVERGES' as const };
});

const MATCHED = CLASSIFIED.filter((c) => c.verdict === 'MATCHED');
const DIVERGES = CLASSIFIED.filter((c) => c.verdict === 'DIVERGES');
const UNRESOLVED = CLASSIFIED.filter((c) => c.verdict === 'UNRESOLVED');

// -- Ratchets -----------------------------------------------------------
// Measured on this branch (v12m-w27-e) by forcing both to -1 and reading
// the printed offender lists back: 1 real divergence ('Insert a field ·
// open' -- Chautauqua Comms.dc.html:303, the merge-field panel's own static
// header row, never rendered by app/src/pages/comms/InsertFieldMenu.tsx,
// which renders no header text above its menu items at all), 18 unresolved
// (16 digit-bearing composed-from-data misses + the 2 digit-free
// NO_DIGIT_COMPOSED rows above). See
// docs/design/audit/frame-eyebrow-label-390-v12.md for the full per-row
// breakdown.
export const FRAME_EYEBROW_DIVERGENCE_CEILING = 1;
export const FRAME_EYEBROW_UNRESOLVED_CEILING = 18;

describe('frame drawn-eyebrow ledger (DEC-976 wave-27, v12 mobile campaign)', () => {
  it('non-vacuity: population is non-trivial and spans multiple frames and files', () => {
    expect(ALL_EYEBROWS.length).toBeGreaterThan(30);
    const distinctFiles = new Set(ALL_EYEBROWS.map((e) => e.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(8);
    const distinctFrames = new Set(ALL_EYEBROWS.map((e) => `${e.fileName}:${e.frameLine}`));
    expect(distinctFrames.size).toBeGreaterThanOrEqual(15);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('enumerates exactly 62 population-qualifying eyebrows across 12 files (vacuous-population tripwire)', () => {
    expect(designFiles().length).toBe(13);
    expect(ALL_EYEBROWS.length).toBe(62);
    expect(new Set(ALL_EYEBROWS.map((e) => e.fileName)).size).toBe(12);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file frame extent, never a live product count', () => {
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#565A4B">Zzy Synthetic Eyebrow Present</span>',
      '  <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#565A4B">Zzy Synthetic Eyebrow Absent</span>',
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
    expect(extractedTexts).toContain('Zzy Synthetic Eyebrow Present');
    expect(extractedTexts).toContain('Zzy Synthetic Eyebrow Absent');
    expect(extractedTexts.some((t) => t.includes('Control Face'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Field Label'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Lowercase'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Nested Markup'))).toBe(false);
    expect(extractedTexts.length).toBe(2);

    const fabricatedSource = normalizeSource(
      [
        '// this comment mentions Zzy Synthetic Eyebrow Absent and must not satisfy it',
        'const x = "Zzy Synthetic Eyebrow Present";',
      ].join('\n')
    ).toLowerCase();

    expect(labelIsMatched('zzy synthetic eyebrow present', [fabricatedSource])).toBe(true);
    expect(labelIsMatched('zzy synthetic eyebrow absent', [fabricatedSource])).toBe(false);
  });

  it('case-insensitivity: a frame eyebrow (painted uppercase) matches mixed-case app source that a case-sensitive join would miss', () => {
    const fabricatedSource = normalizeSource('const label = "Track";').toLowerCase();
    // The frame's own literal is already upper-case ("TRACK" as drawn); a
    // case-sensitive join would fail against the mixed-case "Track" the
    // component actually types. The real join (eyebrowIsMatched) lower-
    // cases both sides -- exercised here directly against the shared
    // matcher, never a live product count.
    expect(labelIsMatched('TRACK'.toLowerCase(), [fabricatedSource])).toBe(true);
  });

  it('disjointness: the population shares no (fileName, line) with the caption ledger population (by construction: that ledger excludes uppercase, this one requires it)', () => {
    const captionKeys = new Set(ALL_CAPTIONS.map((c) => `${c.fileName}:${c.line}`));
    const overlap = ALL_EYEBROWS.filter((e) => captionKeys.has(`${e.fileName}:${e.line}`));
    expect(overlap, JSON.stringify(overlap)).toEqual([]);
  });

  it('disjointness: the population shares no (fileName, line) with the phone control-label ledger population', () => {
    const controlKeys = new Set(ALL_CONTROL_LABEL_SITES.map((c) => `${c.fileName}:${c.line}`));
    const overlap = ALL_EYEBROWS.filter((e) => controlKeys.has(`${e.fileName}:${e.line}`));
    expect(overlap, JSON.stringify(overlap)).toEqual([]);
  });

  it('disjointness: every population eyebrow sits inside a phone (width:390/height:844) frame, structurally disjoint from the desktop control-label ledger\'s own non-390 card-signature population', () => {
    // The desktop ledger selects frames by its OWN card signature
    // (`border-radius:6px` card corners at width != 390) -- disjoint from
    // this file's `width:390px` + `height:844` frame signature by the same
    // reasoning that ledger's own header already states in the reverse
    // direction. Verified here directly: every eyebrow's frameLine is a
    // width:390px+height:844 line, never a card-signature line.
    for (const e of ALL_EYEBROWS) {
      const full = join(DESIGN_ROOT, e.fileName);
      const lines = readFileSync(full, 'utf-8').split('\n');
      const frameLineText = lines[e.frameLine - 1]!;
      expect(isFrameLine(frameLineText), `${e.fileName}:${e.frameLine}`).toBe(true);
    }
  });

  it('NO_DIGIT_COMPOSED exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const c of NO_DIGIT_COMPOSED) {
      const hit = ALL_EYEBROWS.find((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
      expect(hit, `${c.fileName}:${c.line} no longer resolves to the cited text in the pack`).toBeDefined();
      expect(DIGIT_RE.test(c.text), `${c.fileName}:${c.line} now carries a digit; drop this row, it is UNRESOLVED by the digit rule instead`).toBe(false);
    }
  });

  it('classification totals partition the population exactly (MATCHED + DIVERGES + UNRESOLVED = population)', () => {
    expect(MATCHED.length + DIVERGES.length + UNRESOLVED.length).toBe(ALL_EYEBROWS.length);
  });

  it(`never exceeds FRAME_EYEBROW_DIVERGENCE_CEILING (${FRAME_EYEBROW_DIVERGENCE_CEILING}) real eyebrow divergences`, () => {
    if (DIVERGES.length > FRAME_EYEBROW_DIVERGENCE_CEILING) {
      const offenders = DIVERGES.map((c) => `${c.eyebrow.fileName}:${c.eyebrow.line} -- "${c.eyebrow.text}"`);
      throw new Error(
        `${DIVERGES.length} eyebrow divergences, above the ceiling of ${FRAME_EYEBROW_DIVERGENCE_CEILING}. ` +
          `FRAME_EYEBROW_DIVERGENCE_CEILING may only be RAISED (a merge-train act, never a worker's edit ` +
          `mid-lane), and only once re-measured against the integrated tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(DIVERGES.length).toBeLessThanOrEqual(FRAME_EYEBROW_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW FRAME_EYEBROW_DIVERGENCE_CEILING (${FRAME_EYEBROW_DIVERGENCE_CEILING}) without the ceiling being lowered to match`, () => {
    if (DIVERGES.length < FRAME_EYEBROW_DIVERGENCE_CEILING) {
      throw new Error(
        `${DIVERGES.length} eyebrow divergences, below the ceiling of ${FRAME_EYEBROW_DIVERGENCE_CEILING}. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const FRAME_EYEBROW_DIVERGENCE_CEILING = ${DIVERGES.length};`
      );
    }
    expect(DIVERGES.length).toBeGreaterThanOrEqual(FRAME_EYEBROW_DIVERGENCE_CEILING);
  });

  it(`never exceeds FRAME_EYEBROW_UNRESOLVED_CEILING (${FRAME_EYEBROW_UNRESOLVED_CEILING}) unresolved eyebrow misses`, () => {
    if (UNRESOLVED.length > FRAME_EYEBROW_UNRESOLVED_CEILING) {
      const offenders = UNRESOLVED.map((c) => `${c.eyebrow.fileName}:${c.eyebrow.line} -- "${c.eyebrow.text}"`);
      throw new Error(
        `${UNRESOLVED.length} unresolved eyebrow misses, above the ceiling of ${FRAME_EYEBROW_UNRESOLVED_CEILING}. ` +
          `FRAME_EYEBROW_UNRESOLVED_CEILING may only be RAISED (a merge-train act), and only once re-measured ` +
          `against the integrated tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNRESOLVED.length).toBeLessThanOrEqual(FRAME_EYEBROW_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW FRAME_EYEBROW_UNRESOLVED_CEILING (${FRAME_EYEBROW_UNRESOLVED_CEILING}) without the ceiling being lowered to match`, () => {
    if (UNRESOLVED.length < FRAME_EYEBROW_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} unresolved eyebrow misses, below the ceiling of ${FRAME_EYEBROW_UNRESOLVED_CEILING}. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const FRAME_EYEBROW_UNRESOLVED_CEILING = ${UNRESOLVED.length};`
      );
    }
    expect(UNRESOLVED.length).toBeGreaterThanOrEqual(FRAME_EYEBROW_UNRESOLVED_CEILING);
  });
});
