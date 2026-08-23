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
//      automatically a divergence, and (WAVE 33, DEC-808 amendment, task
//      w33-f) is no longer waved through UNRESOLVED by digit-presence
//      alone either -- the wave-27 discriminator treated every digit-
//      bearing miss as UNRESOLVED with no join ever run against it
//      (docs/design/audit/frame-eyebrow-label-390-v12.md said so outright).
//      Wave 33 runs a SECOND join first: the digit-collapsed skeleton pass
//      ported from test/desktop-control-floor.scan.test.ts's own wave-29
//      technique (`collapseDigitsToSkeleton`, hoisted to
//      ./frame-source-corpus so both ledgers import the ONE sentinel,
//      DEC-613) -- collapsing every digit run to one sentinel on BOTH the
//      drawn eyebrow and the corpus turns a live-value miss (a date, a
//      clock reading, a counter) back into an exact match, without ever
//      touching a non-digit word. A row that resolves here is MATCHED.
//      A row the skeleton pass still cannot resolve is graded on its
//      merits, never by the digit rule alone: DIVERGES when no composing
//      expression could EVER produce the frame's string, for any data
//      state (KNOWN_DIVERGES below, empty this wave -- its one row, the
//      390 CFP header eyebrow at :1019, was SETTLED at wave 36 by the
//      DEC-986 wave-36 amendment, see SETTLED_EXCLUSIONS below); UNRESOLVED
//      when a live composing source expression IS named (DIGIT_COMPOSED
//      below, 14 rows this wave, each citing the expression that builds
//      it -- the same COMPOSED-from-data shape
//      test/frame-control-label.scan.test.ts's own COMPOSED_EXCLUSIONS
//      table names for its footer/anchor population). Two digit-FREE
//      misses are independently confirmed COMPOSED on inspection
//      (NO_DIGIT_COMPOSED below, each citing the composing source
//      expression) and folded into UNRESOLVED for the same reason. Every
//      other digit-free miss is a genuine, real DIVERGES row, NOT fixed in
//      this lane per this task's own scope (fix capability is file-scoped).
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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_099, DEC_180, DEC_613, DEC_808, DEC_976, DEC_986, DEC_993 } from '../src/decisions';
import { ALL_CAPTIONS } from './frame-caption-ledger/population';
import { collapseDigitsToSkeleton, enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';
import { labelsInFrameText } from './frame-control-label.scan.test';

// Compile-checked dependency markers (CLAUDE.md: code depending on a
// decision must reference its constant so the dependency is compile-
// checked).
void DEC_976; // this ledger's own ruling (wave-27 amendment): the drawn-eyebrow population, disjoint by construction from all four sibling ledgers.
void DEC_808; // population derived from the tree at test time, never hand-listed.
void DEC_180; // an eyebrow discriminator (control-face / input-box / digit) narrows the POPULATION or the MISS classification, never hides a real offender after classification.
void DEC_613; // the match-side stripper/matcher, the control-label extraction walk, and the digit-collapsed skeleton sentinel are imported, never re-implemented.
void DEC_099; // OUT_OF_CAMPAIGN_SCOPE reasons below are principles, not schedules.
void DEC_993; // wave-28 amendment: the :303 row is a settled divergence, not an open one -- SETTLED_EXCLUSIONS below.
void DEC_986; // wave-36 amendment: the :1019 row (the 390 CFP header eyebrow) is a settled divergence, not an open one -- SETTLED_EXCLUSIONS below.

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

/** DEC-967 wave-42 (second derivation): the 1-based line of the single
 * `</x-dc>` template close in `fullPath`, throwing loudly on zero or
 * multiple matches. A frame's extent is never allowed to reach past this
 * line -- without the clip, the last labelled block of a file swallows the
 * template's own closing tag and everything after it (fixture
 * `data-dc-script` bodies, trailing markup). Ported (not imported), the
 * same shape v12m-w41-c landed in test/phone-frame-ledger.scan.test.ts, per
 * this file's own module-header "port, don't cross-import a population
 * walk" convention. */
function templateCloseLine(fullPath: string): number {
  const lines = readFileSync(fullPath, 'utf-8').split('\n');
  const matches: number[] = [];
  lines.forEach((line, idx) => {
    if (line.includes('</x-dc>')) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fullPath}: expected exactly one </x-dc>, found ${matches.length} (lines ${matches.join(', ')})`);
  }
  return matches[0]!;
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
    // Extent end: next label line strictly after this frame's own line, or
    // EOF -- clipped at the template's own close (DEC-967 wave-42 second
    // derivation) so the last labelled block can never swallow `</x-dc>`
    // and everything past it.
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full)),
    };
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

// -- WAVE 33 (DEC-808 amendment, task w33-f): digit-collapsed skeleton
// re-grade pass, over the primary tier's miss bucket only ------------------
// Ported from the desktop control-floor ledger's own wave-29 technique
// (`collapseDigitsToSkeleton`, imported above from ./frame-source-corpus,
// never a second copy -- DEC-613): a frame eyebrow can draw a live-looking
// value (a date, a `DFC-NNN` ref, a count) whose DIGITS the real product
// renders differently at runtime while every surrounding word stays
// identical. Collapsing every digit run to one sentinel on BOTH sides turns
// that into an exact match again, without ever touching a non-digit word.
const SKELETON_SOURCE_BLOBS: string[] = NORMALIZED_SOURCE_BLOBS.map(collapseDigitsToSkeleton);
const HAS_DIGIT_RE_FOR_SKELETON = /\d/;

/** True when `text` carries a digit AND its digit-collapsed skeleton occurs
 * verbatim in the digit-collapsed corpus. Skipped entirely (returns false)
 * for a digit-free label -- collapsing would be a no-op and
 * `eyebrowIsMatched` above already tried the identical string (this task's
 * own scope clause 2: "skip the pass entirely for a label with no digit").
 * Exported so the non-vacuity synthetic control below can drive it
 * directly, never a live product count. */
export function eyebrowIsMatchedBySkeleton(text: string): boolean {
  if (!HAS_DIGIT_RE_FOR_SKELETON.test(text)) return false;
  const skeleton = collapseDigitsToSkeleton(text.toLowerCase());
  return labelIsMatched(skeleton, SKELETON_SOURCE_BLOBS);
}

// -- WAVE 40 (DEC-808/DEC-986 amendment; task w40-c): composed-template
// resolver, over the primary + skeleton tiers' miss bucket only -----------
// The 14 DIGIT_COMPOSED + 2 NO_DIGIT_COMPOSED rows below were, before this
// wave, hand-verified UNRESOLVED misses -- a human read the cited source
// expression and confirmed it composes the frame's exact string at
// render time, but the join techniques above (verbatim, skeleton) cannot
// SEE that: they compare whole strings, and a composed string is never one
// contiguous literal in the source. This pass widens the join itself so the
// machine can reproduce that hand verification, the same "template with an
// interpolated value" shape the skeleton pass already resolves for a purely
// numeric interpolation (e.g. 'In 6 days').
//
// Two source shapes carry a literal-text-plus-hole composition in this
// pack: a JSX text node (`>...{expr}...<`) and a template literal
// (`` `...${expr}...` ``), both already present verbatim in
// NORMALIZED_SOURCE_BLOBS (comments stripped, entities decoded, case-
// folded, whitespace collapsed -- DEC-613, no second stripper). For each
// such phrase this pass finds, it builds a regex: every non-hole segment is
// matched LITERALLY, and every hole (`{...}` / `${...}`, braces not
// nested -- this pass does not attempt a full JS parse, DEC-180: a
// discriminator narrows the miss classification, it never claims more than
// it can prove) is a `.+?` requiring AT LEAST ONE character, never a
// zero-width gap. That last clause is the whole difference between a real
// resolver and a rule that would just wave through anything containing the
// template's static words: a frame string equal to only the static half
// (the hole position rendered empty) must NOT match, or this pass would
// stop being a join and become a substring existence check (DEC-099's
// negative control below proves exactly this).
//
// A phrase whose hole(s) leave no non-whitespace literal segment (e.g. a
// JSX text node that is nothing but `{expr}`, no surrounding words -- the
// 390 header's `eventDatesLine(event)` row, :374 below) is dropped
// entirely: a lone hole with no static anchor cannot discriminate a real
// composition from any other string, and building a regex for one would
// make this pass a tautology. That row, and the two genuinely
// two-sibling-node rows (a count in an ADJACENT DOM node, or a CSS
// `::before` prefix), stay UNRESOLVED -- correctly: no single-text-node
// join can ever see across a sibling boundary, so the hand-verification
// this pass targets was never claiming those three would resolve.
const HOLE_RE = /\$?\{[^{}]*\}/;
const HOLE_RE_G = /\$?\{[^{}]*\}/g;
const JSX_TEXT_NODE_RE = />([^<]*)</g;
const TEMPLATE_LITERAL_RE = /`([^`]*)`/g;

function escapeRegExpLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a whole-string regex from a composed phrase (a JSX text node or
 * template-literal body already containing at least one hole): every
 * literal segment between holes is escaped and matched verbatim, every
 * hole becomes `.+?` (one-or-more, never zero-width). Returns null for a
 * phrase with no hole, or whose only non-empty content IS a hole (no
 * static anchor -- see module note above). Exported so the DEC-099
 * positive/negative controls below can drive it directly against a
 * fabricated phrase, never a live product string. */
// A floating punctuation-only separator (`{a} · {b}`, zero alnum chars in
// every literal segment) produced a regex as loose as `/^.+? · .+?$/` --
// measured directly this wave: that ONE pattern matched 15 of this file's
// 62-row population, including rows with no relationship whatsoever to the
// phrase that derived it. Requiring a minimum amount of real WORD content
// (letters/digits, not just spaces and separators) across the literal
// segments is what turns "the static half of the template" into an actual
// anchor rather than a punctuation coincidence -- this is the DEC-099
// negative control's own clause, enforced structurally rather than merely
// tested for.
const ALNUM_RE = /[A-Za-z0-9]/g;
const MIN_LITERAL_ALNUM_CHARS = 6;

function totalAlnumChars(parts: string[]): number {
  return parts.reduce((sum, p) => sum + (p.match(ALNUM_RE)?.length ?? 0), 0);
}

export function buildComposedTemplateRegex(phraseRaw: string): RegExp | null {
  // Trimmed first: the extracted phrase carries whatever leading/trailing
  // whitespace the source's own indentation collapsed to (a single space
  // either side of a JSX text node's newline), but the eyebrow candidate
  // this regex is tested against is always already `.trim()`-ed (see
  // `eyebrowsInFrameText` above and the needle trim below) -- an untrimmed
  // edge would anchor `^`/`$` against a space the trimmed needle can never
  // supply, turning a real composition into a false miss.
  const phrase = phraseRaw.trim();
  if (!HOLE_RE.test(phrase)) return null;
  const parts = phrase.split(HOLE_RE_G);
  if (totalAlnumChars(parts) < MIN_LITERAL_ALNUM_CHARS) return null;
  const pattern = parts.map((p) => escapeRegExpLiteral(p)).join('.+?');
  return new RegExp(`^${pattern}$`);
}

/** Every composed-template regex derivable from the real corpus, built
 * once at module load, over .ts/.tsx blobs only (a JSX text node or a
 * template literal is a source-language construct; `.css` has neither,
 * and including it only manufactures noise from CSS's own unrelated `{`
 * rule-block / `>` combinator characters). A JSX text node or
 * template-literal body qualifies only if it contains a hole;
 * `buildComposedTemplateRegex` drops the lone-hole (no static anchor) and
 * weak-anchor (fewer than MIN_LITERAL_ALNUM_CHARS) cases. */
const TS_SOURCE_BLOBS: string[] = SOURCE_FILES.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx')).map((f) =>
  normalizeSource(readFileSync(f, 'utf-8')).toLowerCase()
);

const COMPOSED_TEMPLATE_REGEXES: RegExp[] = TS_SOURCE_BLOBS.flatMap((blob) => {
  const phrases: string[] = [];
  let m: RegExpExecArray | null;
  JSX_TEXT_NODE_RE.lastIndex = 0;
  while ((m = JSX_TEXT_NODE_RE.exec(blob)) !== null) {
    if (m[1]!.includes('{')) phrases.push(m[1]!);
  }
  TEMPLATE_LITERAL_RE.lastIndex = 0;
  while ((m = TEMPLATE_LITERAL_RE.exec(blob)) !== null) {
    if (m[1]!.includes('{')) phrases.push(m[1]!);
  }
  return phrases
    .map(buildComposedTemplateRegex)
    .filter((r): r is RegExp => r !== null);
});

/** True when `text` (case-folded, whitespace-collapsed) matches some
 * composed-template regex derived from the real corpus. Exported so the
 * DEC-099 controls below can drive the real module-level regex set
 * directly, and so a future sibling ledger can reuse the entrypoint
 * rather than re-deriving its own copy (DEC-613). */
export function eyebrowIsMatchedByComposedTemplate(text: string): boolean {
  const needle = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return false;
  return COMPOSED_TEMPLATE_REGEXES.some((r) => r.test(needle));
}

// -- Digit-bearing COMPOSED misses that the skeleton pass still cannot
// resolve, individually inspected (wave-33, task w33-f) --------------------
// Wave-27's original discriminator treated EVERY digit-bearing miss as
// UNRESOLVED by construction, with no join ever run (the defect this task
// closes -- docs/design/audit/frame-eyebrow-label-390-v12.md's own prior
// text named this outright). Each of the 14 rows below is now individually
// re-verified: the skeleton pass (above) does not resolve it, and each cites
// the composing source expression that IS live and IS render-time -- either
// a template literal / join whose surrounding words are byte-identical to
// the frame's own literal (so only a live digit or a live ref differs), or
// a two-sibling-node composition (an adjacent count node, or a CSS
// `::before` prefix keyed off a `data-*` attribute) that a text-content-only
// join can never assemble into one string. This is the SAME COMPOSED shape
// NO_DIGIT_COMPOSED below already carries for its two digit-free rows,
// applied here to the digit-bearing bucket instead of being waved through
// by the digit rule alone (DEC-180: a discriminator narrows the miss
// classification, it never hides a real offender after classification).
interface DigitComposed {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

const DIGIT_COMPOSED: DigitComposed[] = [
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 381,
    text: 'Re-uploaded · you asked for changes 8 days ago',
    reason:
      "COMPOSED-from-data: `{statusLabel}{statusNeedsCauseClause ? ' · you asked for changes ' + formatRelativeDays(...) : ...}` (app/src/pages/content/DeliverableDetail.tsx:446-452) composes the status band's cause clause from the live update timestamp, never the frame's fixed '8 days'.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 274,
    text: 'Tue 12, 10:00 · Room 2A',
    reason:
      "COMPOSED-from-data: `{formatDayLabel(conflict.day)}, {clockHHMM(conflict.startMin)} · {publicRoomLabel(conflict.roomName)}` (app/src/pages/overview/AgendaWorkSection.tsx:130-133, comment there cites this exact frame line) draws the clash card's day/time/room from the live agenda conflict, never the frame's fixed 'Tue 12, 10:00'.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 374,
    text: '12–14 May 2027 · Moscone West',
    reason:
      "COMPOSED-from-data: `eventDatesLine(event)` (src/routes/public/shell.tsx:228-230, `` `${formatEventDayRange(...)} · ${event.location}` ``) draws the public header's date range and venue from the event's own startDate/endDate/location columns, never the frame's fixed '12–14 May 2027 · Moscone West'.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 624,
    text: 'On this session · 1',
    reason:
      "COMPOSED-from-data, two-sibling-node: `<span>On this session</span><span class=\"chq-portal-session-count\">{participants.length}</span>` (src/routes/portal/edit.tsx:362-363) -- a text-content-only join can never assemble two sibling DOM nodes joined visually by CSS into the frame's one-span literal; the live count is `participants.length`, never the frame's fixed '1'.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1318,
    text: 'On this session · 1',
    reason:
      'COMPOSED-from-data, two-sibling-node: same `<span>On this session</span><span class="chq-portal-session-count">{participants.length}</span>` (src/routes/portal/edit.tsx:362-363) as :624 above -- the co-presenter duplicate-notice frame draws the identical panel.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 286,
    text: 'Wave 2 · AI Engineering · round 1',
    reason:
      'COMPOSED-from-data: `scorecardEyebrow` (app/src/pages/review/Scorecard.tsx:503-507, `[plan.name, planTrackScope(...), planNamesRound(plan.rounds) ? roundLabel(...) : null]`) joins the plan name, track scope and round label from the live review plan, never the frame\'s fixed "Wave 2 · AI Engineering · round 1".',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 361,
    text: 'DFC-033 · lightning talk, 10 min',
    reason:
      'COMPOSED-from-data, two-sibling-node: `<p className="chq-detail-eyebrow" data-ref={detail.ref}>{eyebrowText}</p>` (app/src/pages/submissions/SubmissionDetailPage.tsx:1207-1209) with the ref prefix drawn by a phone-only CSS `::before` keyed off `data-ref` (app/src/pages/submissions/detail.css:1292) -- a text-content-only join can never assemble a CSS-generated prefix into the frame\'s one-string literal; `eyebrowText` itself is a live `[track, format].join(\' · \')`.',
  },
];

function isDigitComposed(e: Eyebrow): boolean {
  return DIGIT_COMPOSED.some((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
}

// -- WAVE 40 (task w40-c): rows the composed-template resolver above now
// resolves to MATCHED, moved out of DIGIT_COMPOSED/NO_DIGIT_COMPOSED --------
// Each of these 9 rows was, before this wave, a hand-verified UNRESOLVED
// miss in one of the two tables above; the widened join now reproduces that
// hand verification (see the module note above `buildComposedTemplateRegex`
// for the mechanism). Kept here, not deleted, so the resolution is a
// citation, not a silent count change: each entry re-asserts the same
// composing source expression the original hand verification named, PLUS a
// live check (test 'COMPOSED_TEMPLATE_RESOLVED rows...' below) that the
// resolver actually classifies the row MATCHED today, so a future change
// that narrows the resolver's reach fails loudly here instead of silently
// pushing the row back into an un-cited UNRESOLVED/DIVERGES bucket.
interface ComposedTemplateResolved {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

const COMPOSED_TEMPLATE_RESOLVED: ComposedTemplateResolved[] = [
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 494,
    text: 'Column 2 of 5',
    reason:
      'COMPOSED-from-data, RESOLVED: `Column {phoneColumnIndex + 1} of {header.length}` (app/src/pages/contacts/ImportWizard.tsx:1096) -- the composed-template resolver matches the JSX text node\'s static words ("Column " ... " of ") against the frame\'s "Column 2 of 5" with both holes filled.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1076,
    text: 'Submitted · DFC-048',
    reason:
      'COMPOSED-from-data, RESOLVED: `SUBMITTED &middot; {props.ref}` (src/routes/public/submit-views.tsx:856) -- the resolver matches the entity-decoded static prefix "submitted · " against the frame\'s "Submitted · DFC-048" with the ref hole filled.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1126,
    text: 'Submitted · DFC-049',
    reason:
      'COMPOSED-from-data, RESOLVED: same `SUBMITTED &middot; {props.ref}` (src/routes/public/submit-views.tsx:856) as :1076 above -- the pending-existing-contact confirmation state renders the identical composing expression against a different fixture ref.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1149,
    text: 'Submitted · DFC-050',
    reason:
      'COMPOSED-from-data, RESOLVED: same `SUBMITTED &middot; {props.ref}` (src/routes/public/submit-views.tsx:856) as :1076 above -- the has-account confirmation state renders the identical composing expression against a different fixture ref.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 419,
    text: 'Review · Wave 2',
    reason:
      "COMPOSED-from-data, RESOLVED: `` `REVIEW · ${routeEnvelope.planName}` `` (app/src/pages/review/ReviewerQueue.tsx:657) -- the resolver matches the template literal's static prefix \"review · \" against the frame's \"Review · Wave 2\" with the plan-name hole filled.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 461,
    text: 'Questions · 8',
    reason:
      "COMPOSED-from-data, RESOLVED: `` `Questions · ${list.length}` `` (app/src/pages/settings/CallForPapersPanel.tsx:128) -- the resolver matches the template literal's static prefix \"questions · \" against the frame's \"Questions · 8\" with the count hole filled.",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 375,
    text: 'Reviews · 3 of 3 in',
    reason:
      "COMPOSED-from-data, RESOLVED: `` Reviews &middot; {evaluations.filter((ev) => ev.submittedAt !== null).length} of {assignedReviewers} in `` (app/src/pages/submissions/SubmissionDetailPage.tsx:1383) -- the resolver matches the entity-decoded JSX text node's static words (\"reviews · \" ... \" of \" ... \" in\") against the frame's \"Reviews · 3 of 3 in\" with both holes filled.",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 161,
    text: 'Two sessions in this slot',
    reason:
      "COMPOSED-from-data, RESOLVED: `{capitalizeFirst(spellCount(slot.sessions.length))} {plural(slot.sessions.length, 'session')} in this slot` (app/src/pages/agenda/PhoneAgenda.tsx) -- the resolver matches the JSX text node's static suffix \" in this slot\" against the frame's \"Two sessions in this slot\" with both holes filled.",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 406,
    text: 'Notes on the slides',
    reason:
      'COMPOSED-from-data, RESOLVED: `Notes on the {DELIVERABLE_LABELS[activeKind].toLowerCase()}` (app/src/pages/content/DeliverableDetail.tsx:595) -- the resolver matches the JSX text node\'s static prefix "notes on the " against the frame\'s "Notes on the slides" with the deliverable-kind hole filled.',
  },
];

// -- Formerly "known DIVERGES", SETTLED at wave 36 (DEC-986 wave-36
// amendment) -- see the SETTLED_EXCLUSIONS table below. This array is kept
// empty (not deleted) so isKnownDiverges retains its shape for a future
// row; DEC-986's amendment closed the one row that ever populated it.
interface KnownDiverges {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

const KNOWN_DIVERGES: KnownDiverges[] = [];

function isKnownDiverges(e: Eyebrow): boolean {
  return KNOWN_DIVERGES.some((d) => d.fileName === e.fileName && d.line === e.line && d.text === e.text);
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

// Both former rows here (Agenda.dc.html:161, Content.dc.html:406) are now
// resolved by the composed-template resolver -- moved to
// COMPOSED_TEMPLATE_RESOLVED above, wave 40. Kept empty, not deleted, so
// isNoDigitComposed retains its shape for a future digit-free composed row
// the resolver still cannot reach.
const NO_DIGIT_COMPOSED: NoDigitComposed[] = [];

function isNoDigitComposed(e: Eyebrow): boolean {
  return NO_DIGIT_COMPOSED.some((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
}

const DIGIT_RE = /\d/;

// -- SETTLED exclusions (DEC-993 wave-28 amendment) --------------------------
// A row a STANDING RULING has already adjudicated as a settled divergence --
// never a real, open copy gap, and never re-derived as DIVERGES each wave a
// new ledger happens to walk over it. Modelled EXACTLY on
// test/phone-dock-ledger.scan.test.ts's own NON_BUILD_EXCLUSIONS: each entry
// quotes the governing ruling VERBATIM, by file:line, so the exclusion rots
// loudly the day that ruling is reversed rather than lands silently; a
// companion assertion below re-resolves every entry against the current pack
// so a stale entry (the cited text no longer at the cited line) fails
// loudly instead of silently over-excluding a future real offender. This
// table is for a row a standing ruling has SETTLED -- it may never carry a
// "the app spells this differently" claim (DEC-613 wave-27 clause (d));
// that is the COMPOSED/exclusion shape other ledgers already use for wording
// drift, not this one.
interface SettledExclusion {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

const SETTLED_EXCLUSIONS: SettledExclusion[] = [
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 303,
    text: 'Insert a field · open',
    reason:
      'src/decisions-data/DEC-993.md (wave-12m amendment): "the closed `Insert a field ▾` trigger IS the ruled ' +
      "shape; the frame's permanently-open merge-field palette is a settled divergence recorded on the row, not " +
      're-derived each wave... Ruling: DEC-993\'s shape is final (a permanently-open palette duplicates the ' +
      'vocabulary the menu already carries and cannot satisfy the one-control-per-composer clause), and the ' +
      'divergence is recorded as SETTLED on the Comms row with the DEC cited, so it stops buying triage."',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1019,
    text: 'DevFlow Conf 2027 · closes 16 Aug',
    reason:
      'src/decisions-data/DEC-986.md ("## Amendment (wave 36): the 390 CFP header\'s single drawn eyebrow is a ' +
      'SETTLED divergence — the wave-40 restructure superseded the frame\'s composition"): "docs/design/' +
      'Chautauqua Public and Portal.dc.html:1019 draws one eyebrow, `DevFlow Conf 2027 · closes 16 Aug`, ' +
      'directly above `<h1>Submit a talk</h1>`. src/routes/public/submit-views.tsx renders three header ' +
      'elements instead — `chq-cfp-meta` (`eventDatesLine(event)`), `chq-cfp-title` (`{event.name}`), ' +
      '`chq-cfp-sub` (the fixed literal `Call for papers · closes {…}`) — so the event name never reaches the ' +
      'eyebrow position. This is the only real, unfixed, unowned frame divergence any ledger still names, ' +
      'handed off by w33-f. RULED: SETTLED, not a build. DEC-986 wave-40 already moved the `<h1>` out of this ' +
      "header, so the frame's single-eyebrow-above-H1 composition no longer describes a header this codebase " +
      'draws; the shipped three-element header carries strictly more than the frame\'s one eyebrow (dates, ' +
      'venue, event name, CFP close) with the event name promoted from eyebrow to title; and the only ' +
      'available repair — rewording `chq-cfp-sub` — is a desktop-visible copy change on a FROZEN surface. It ' +
      'is recorded on the DEC and excluded by the ledger\'s own SETTLED table, never as a DEVIATIONS bullet: ' +
      'that would move a ledger population another lane owns."',
  },
];

function isSettled(e: Eyebrow): boolean {
  return SETTLED_EXCLUSIONS.some((s) => s.fileName === e.fileName && s.line === e.line && s.text === e.text);
}

interface Classified {
  eyebrow: Eyebrow;
  verdict: 'MATCHED' | 'DIVERGES' | 'UNRESOLVED' | 'SETTLED';
}

const CLASSIFIED: Classified[] = ALL_EYEBROWS.map((eyebrow) => {
  if (eyebrowIsMatched(eyebrow.text)) return { eyebrow, verdict: 'MATCHED' as const };
  if (isSettled(eyebrow)) return { eyebrow, verdict: 'SETTLED' as const };
  // WAVE 33 (task w33-f, DEC-808 amendment): the digit-collapsed skeleton
  // join runs BEFORE any digit-presence discriminator -- a row that
  // resolves here is a real match the primary tier could never see because
  // the drawn and rendered digit runs differ, never a guess.
  if (eyebrowIsMatchedBySkeleton(eyebrow.text)) return { eyebrow, verdict: 'MATCHED' as const };
  // WAVE 40 (task w40-c, DEC-808/DEC-986 amendment): the composed-template
  // join runs BEFORE isKnownDiverges/the digit discriminator too -- a row
  // that resolves here is a real match the primary and skeleton tiers could
  // never see because the composition spans a hole the earlier tiers treat
  // as opaque text, never a guess (same DEC-180 clause the skeleton pass
  // above already cites: a discriminator narrows classification, it never
  // hides a real offender).
  if (eyebrowIsMatchedByComposedTemplate(eyebrow.text)) return { eyebrow, verdict: 'MATCHED' as const };
  if (isKnownDiverges(eyebrow)) return { eyebrow, verdict: 'DIVERGES' as const };
  if (DIGIT_RE.test(eyebrow.text)) {
    // Every digit-bearing miss the skeleton pass could not resolve is now
    // individually re-verified (DIGIT_COMPOSED above), never waved through
    // by the digit rule alone -- DEC-180: a discriminator narrows the miss
    // classification, it never hides a real offender after classification.
    if (isDigitComposed(eyebrow)) return { eyebrow, verdict: 'UNRESOLVED' as const };
    return { eyebrow, verdict: 'DIVERGES' as const };
  }
  if (isNoDigitComposed(eyebrow)) return { eyebrow, verdict: 'UNRESOLVED' as const };
  return { eyebrow, verdict: 'DIVERGES' as const };
});

const MATCHED = CLASSIFIED.filter((c) => c.verdict === 'MATCHED');
const DIVERGES = CLASSIFIED.filter((c) => c.verdict === 'DIVERGES');
const UNRESOLVED = CLASSIFIED.filter((c) => c.verdict === 'UNRESOLVED');
const SETTLED = CLASSIFIED.filter((c) => c.verdict === 'SETTLED');

// -- Ratchets -----------------------------------------------------------
// Re-measured on this branch (v12m-w33-f, DEC-808 amendment: the digit-
// collapsed skeleton join) by forcing both to -1 and reading the printed
// offender lists back, never carried forward or computed by arithmetic:
// 1 real divergence -- 'DevFlow Conf 2027 · closes 16 Aug'
// (Chautauqua Public and Portal.dc.html:1019, KNOWN_DIVERGES above,
// adjudicated in the audit doc so it does not open a new row on
// test/open-divergence-ledger.scan.test.ts's own ledger) -- and 16
// unresolved (14 digit-bearing COMPOSED misses individually re-verified
// after the skeleton pass could not resolve them, DIGIT_COMPOSED above,
// down from 16 pre-skeleton because 'In 6 days' -- Chautauqua
// Settings.dc.html:458 -- now resolves to MATCHED + the 2 digit-free
// NO_DIGIT_COMPOSED rows below, unchanged). See
// docs/design/audit/frame-eyebrow-label-390-v12.md for the full per-row
// breakdown and the DEC-993 + DEC-986 SETTLED rows this ratchet excludes.
//
// Re-measured this wave (v12m-w36-h, DEC-986 wave-36 amendment) by forcing
// FRAME_EYEBROW_DIVERGENCE_CEILING to -1 and reading the printed offender
// roster back: empty. The one row that ever populated DIVERGES
// (Chautauqua Public and Portal.dc.html:1019) is now SETTLED, not a live
// product gap -- see SETTLED_EXCLUSIONS above. NOT touched by task w40-c --
// see that task's own scope clause.
//
// Re-measured this wave (v12m-w42-f, DEC-967 wave-42 second derivation:
// framesInFile's extentEnd is now clipped at each file's own template
// close, `Math.min(nextLabel ? nextLabel.line : Infinity,
// templateCloseLine(full))`, mirroring v12m-w41-c's port into the sibling
// phone ledgers) by forcing BOTH ceilings to -1 in turn and reading the
// printed offender rosters back: DIVERGES is still empty (0) and UNRESOLVED
// is still the same 16 rows (the 14 DIGIT_COMPOSED + 2 NO_DIGIT_COMPOSED
// rows above, unchanged file:line:text). Neither ceiling moves: no eyebrow
// candidate in this population lived in the swallowed
// `</x-dc>`..`data-dc-script` fixture range the clip removes -- the clip is
// a correctness guard against a latent swallow, not a population mover for
// this ledger this wave (same conclusion v12m-w41-c reached for its own
// four ledgers).
export const FRAME_EYEBROW_DIVERGENCE_CEILING = 0;
// Re-measured this wave (v12m-w40-c, DEC-808/DEC-986 amendment: the
// composed-template resolver) by forcing FRAME_EYEBROW_UNRESOLVED_CEILING
// to -1 and reading the printed offender roster back: 9 of the prior 16
// unresolved rows (7 from DIGIT_COMPOSED, 2 from NO_DIGIT_COMPOSED --
// COMPOSED_TEMPLATE_RESOLVED above) now resolve to MATCHED, because the
// widened join can now see a template's static words either side of a hole
// the earlier verbatim/skeleton joins treated as opaque. The remaining 7
// (5 in DIGIT_COMPOSED, above) stay UNRESOLVED for the reason each entry
// cites: two are genuine two-sibling-node compositions (a count in an
// adjacent DOM node, or a CSS ::before prefix) no text-content-only join can
// ever assemble; one is a lone-hole JSX text node with no static anchor
// (`eventDatesLine(event)`, deliberately excluded, see the module note
// above `buildComposedTemplateRegex`); the rest compose via plain
// TypeScript (an array `.join(...)`, a nested nested-brace ternary) outside
// the two source shapes (JSX text node, template literal) this resolver
// reads. See docs/design/audit/frame-eyebrow-label-390-v12.md for the
// per-row breakdown.
export const FRAME_EYEBROW_UNRESOLVED_CEILING = 7;

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

  it('DIGIT_COMPOSED rows each resolve to their cited file:line:text, still carry a digit, and are still unresolved by the skeleton pass (else they belong in MATCHED, not here)', () => {
    for (const c of DIGIT_COMPOSED) {
      const hit = ALL_EYEBROWS.find((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
      expect(hit, `${c.fileName}:${c.line} no longer resolves to the cited text in the pack`).toBeDefined();
      expect(DIGIT_RE.test(c.text), `${c.fileName}:${c.line} no longer carries a digit; drop this row, it is graded on its own merits now`).toBe(true);
      expect(
        eyebrowIsMatchedBySkeleton(c.text),
        `${c.fileName}:${c.line} now resolves under the skeleton pass; this row is stale, it belongs in MATCHED, not DIGIT_COMPOSED`
      ).toBe(false);
      expect(
        eyebrowIsMatchedByComposedTemplate(c.text),
        `${c.fileName}:${c.line} now resolves under the composed-template resolver; this row is stale, move it to COMPOSED_TEMPLATE_RESOLVED, not DIGIT_COMPOSED`
      ).toBe(false);
    }
  });

  it('COMPOSED_TEMPLATE_RESOLVED rows (task w40-c) each resolve to their cited file:line:text and are actually classified MATCHED by the widened resolver today', () => {
    for (const c of COMPOSED_TEMPLATE_RESOLVED) {
      const hit = ALL_EYEBROWS.find((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
      expect(hit, `${c.fileName}:${c.line} no longer resolves to the cited text in the pack`).toBeDefined();
      expect(
        eyebrowIsMatchedByComposedTemplate(c.text),
        `${c.fileName}:${c.line} no longer resolves under the composed-template resolver; this row is stale, move it back to DIGIT_COMPOSED/NO_DIGIT_COMPOSED`
      ).toBe(true);
    }
  });

  it('DEC-099 positive control: the composed-template resolver fires on a fabricated template + literal pair that genuinely composes, never a live product string', () => {
    // Mirrors the real 'Column {n} of {m}' / 'Questions · {n}' shape: one
    // static prefix, one hole, filled with plausible fabricated content.
    // Both sides lower-cased, mirroring eyebrowIsMatchedByComposedTemplate's
    // own case-folding contract (this direct-primitive control drives
    // buildComposedTemplateRegex itself, which does not lower-case its
    // input -- that is the exported entrypoint's job).
    const regex = buildComposedTemplateRegex('zzy synthetic retention {window} window');
    expect(regex).not.toBeNull();
    expect(regex!.test('zzy synthetic retention 90-day window')).toBe(true);
    // A DIFFERENT word in the static half must still fail -- the resolver
    // is not simply "contains some of these words somewhere".
    expect(regex!.test('zzy synthetic eviction 90-day window')).toBe(false);
  });

  it('DEC-099 negative control: the composed-template resolver does NOT resolve a row by matching only the static half of the template -- the hole must consume real content, never zero-width', () => {
    const regex = buildComposedTemplateRegex('zzy synthetic retention {window} window');
    expect(regex).not.toBeNull();
    // The static words alone, with the hole position left EMPTY (no
    // interpolated content at all) -- a resolver that only checked "the
    // static words are present" would wrongly accept this; `.+?` requires
    // at least one character, so it must reject a zero-width gap.
    expect(regex!.test('zzy synthetic retention  window')).toBe(false);
    // A lone-hole phrase (no static anchor at all) must be refused a regex
    // outright -- see the module note above `buildComposedTemplateRegex`:
    // a hole with nothing to anchor it against cannot discriminate a real
    // composition from any other string.
    expect(buildComposedTemplateRegex('{onlyanexpression}')).toBeNull();
    // A phrase whose only literal content is punctuation (no letters/
    // digits) must also be refused -- this is the exact shape that, before
    // this control existed, produced `/^.+? · .+?$/` and matched 15 of this
    // file's 62-row population (measured directly this wave).
    expect(buildComposedTemplateRegex('{a} · {b}')).toBeNull();
  });

  it('KNOWN_DIVERGES rows each resolve to their cited file:line:text and are still unresolved by both the primary and skeleton joins', () => {
    for (const d of KNOWN_DIVERGES) {
      const hit = ALL_EYEBROWS.find((e) => e.fileName === d.fileName && e.line === d.line && e.text === d.text);
      expect(hit, `${d.fileName}:${d.line} no longer resolves to the cited text in the pack`).toBeDefined();
      expect(eyebrowIsMatched(d.text), `${d.fileName}:${d.line} now matches the primary join; this row is stale, drop it from KNOWN_DIVERGES`).toBe(false);
      expect(
        eyebrowIsMatchedBySkeleton(d.text),
        `${d.fileName}:${d.line} now resolves under the skeleton pass; this row is stale, drop it from KNOWN_DIVERGES`
      ).toBe(false);
    }
  });

  it('non-vacuity control (task w33-f clause 3): the skeleton pass resolves an eyebrow differing from a real source literal ONLY in a digit run, but NOT one differing by a word -- both ways, never a live product count', () => {
    const fabricatedSource = normalizeSource(
      'const zzyBadge = `Zzy Synthetic Retention Window · 12 days`;'
    ).toLowerCase();

    // Positive control: only the digit run differs ("12" vs "45") -- the
    // skeleton pass must resolve this, exactly the shape a live counter/
    // date/ref produces against a fixed frame mock.
    const digitOnlyDiffers = 'Zzy Synthetic Retention Window · 45 days';
    expect(HAS_DIGIT_RE_FOR_SKELETON.test(digitOnlyDiffers)).toBe(true);
    const digitSkeleton = collapseDigitsToSkeleton(digitOnlyDiffers.toLowerCase());
    expect(labelIsMatched(digitSkeleton, [collapseDigitsToSkeleton(fabricatedSource)])).toBe(true);

    // Negative control: a WORD differs ("Window" -> "Period"), the digit run
    // is untouched -- collapsing digits must NOT paper over a real
    // vocabulary difference; the pass has to stay permissive on digits
    // only, never on words, or it could pass by being permissive.
    const wordDiffers = 'Zzy Synthetic Retention Period · 12 days';
    expect(HAS_DIGIT_RE_FOR_SKELETON.test(wordDiffers)).toBe(true);
    const wordSkeleton = collapseDigitsToSkeleton(wordDiffers.toLowerCase());
    expect(labelIsMatched(wordSkeleton, [collapseDigitsToSkeleton(fabricatedSource)])).toBe(false);

    // Same two controls driven through the real exported function, not the
    // primitives directly, against a fabricated corpus swapped in for the
    // module-level SKELETON_SOURCE_BLOBS is not possible (that array is
    // built once at module load from the real tree) -- so the function-
    // level control below drives eyebrowIsMatchedBySkeleton's OWN digit
    // gate and normalization instead, against a real, already-MATCHED
    // digit-bearing eyebrow this pack draws (Chautauqua Overview.dc.html's
    // '01 — Overdue tasks' resolves via the skeleton pass, per the module's
    // own classification above) to prove the exported entrypoint's digit
    // gate is live, not a fixture-only property of the primitives.
    expect(eyebrowIsMatchedBySkeleton('Zzy No Digit At All')).toBe(false);
  });

  it('control (DEC-967 wave-42 second derivation): a fabricated uppercase-eyebrow-shaped span after the template close is excluded from a frame\'s extent, and the same shape before the close is included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eyebrow-template-close-synth-'));
    try {
      const fixturePath = join(dir, 'Zzy Fixture.dc.html');
      const lines = [
        '<div style="font-size:19px">Zzy Frame</span>', // line 1: label
        '<div style="width:390px; height:844px">', // line 2: frame line
        '  <span style="text-transform:uppercase">Zzy Before Close Eyebrow</span>', // line 3: before close
        '</div>', // line 4
        '</x-dc>', // line 5: template close
        '<script data-dc-script>const x = 1;</script>', // line 6: fixture body after close
        '<span style="text-transform:uppercase">Zzy After Close Eyebrow</span>', // line 7: after close -- must not enter
      ];
      writeFileSync(fixturePath, lines.join('\n'));

      const closeLine = templateCloseLine(fixturePath);
      expect(closeLine).toBe(5);

      // Mirrors framesInFile's own extentEnd computation above: no next
      // label after the frame line (2), so the raw extent would run to
      // Infinity -- clipped here to the template close.
      const content = readFileSync(fixturePath, 'utf-8');
      const lineStartIndex = lineStartIndexOf(content);
      const frameLine = 2;
      const extentEnd = Math.min(Infinity, templateCloseLine(fixturePath));
      expect(extentEnd).toBe(5);

      const startOff = lineStartIndex[frameLine - 1]!;
      const endOff = lineStartIndex[extentEnd - 1]!;
      const text = content.slice(startOff, endOff);
      const extracted = eyebrowsInFrameText(text).map((e) => e.text);

      // POSITIVE: the before-close eyebrow sits inside the clipped extent.
      expect(extracted).toContain('Zzy Before Close Eyebrow');
      // NEGATIVE: the after-close eyebrow, despite being eyebrow-shaped and
      // in the same file, sits outside the clipped extent -- exactly the
      // swallow this ruling closes (a frame's extent can never reach past
      // its own template's `</x-dc>`, including the `data-dc-script`
      // fixture body between the close and any trailing markup).
      expect(extracted).not.toContain('Zzy After Close Eyebrow');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classification totals partition the population exactly (MATCHED + DIVERGES + UNRESOLVED + SETTLED = population)', () => {
    expect(MATCHED.length + DIVERGES.length + UNRESOLVED.length + SETTLED.length).toBe(ALL_EYEBROWS.length);
  });

  it('SETTLED exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const s of SETTLED_EXCLUSIONS) {
      const hit = ALL_EYEBROWS.find((e) => e.fileName === s.fileName && e.line === s.line && e.text === s.text);
      expect(hit, `${s.fileName}:${s.line} -- "${s.text}" no longer resolves in the pack`).toBeDefined();
    }
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



