// Desktop drawn-floor ledger (DEC-393 wave-151 amendment; task w7-db).
//
// DEC-393's wave-147 amendment ruled a ledger keying each PHONE
// (width:390) frame's drawn `min-height:NNpx` control to the product rule
// that carries it, and scoped it there deliberately. A frame-context
// census on main (DEC-393 wave-151 amendment) showed the DESKTOP half is
// the LARGER ungraded population: inside desktop frames the pack draws
// `min-height:46px` far more often than `min-height:44px`, and the field
// box the pack draws 91 times across the whole pack --
// `border:1px solid #BAB6A6; border-radius:Npx; background:#FAF8F2` -- is
// drawn at 46px while app/src/styles.css's `.chq-input, .chq-select,
// .chq-textarea` is byte-identical to it except `min-height: 44px`. The
// campaign's goal sentence is "every screen matches its v12 frame on
// desktop AND phone", and the desktop half of that sentence had NO
// geometry instrument: test/desktop-frame-ledger.scan.test.ts grades
// whether a test CITES a frame, test/desktop-control-label.scan.test.ts
// grades the WORDS on controls. This is that instrument -- it MEASURES and
// RATCHETS only, and changes not one product CSS byte.
//
//   1. POPULATION: the identical readdirSync docs/design enumeration and
//      nearest-preceding `font-size:19px ... >TITLE</span>` label/extent
//      walk test/desktop-frame-ledger.scan.test.ts uses (ported here, never
//      imported -- that file is owned by a sibling lane), keeping only the
//      frames whose extent carries NO `width:390px`+`height:844` line
//      (that file's own `isPhone` split, derived, never by naming files).
//      Inside each extent, a DRAWN CONTROL is any element whose attribute
//      string carries `min-height:NNpx` AND `border-radius` AND
//      (`border:` OR `background:`), plus any `<a ...min-height:NNpx...>`
//      (the anchor case needs only the min-height, per the task's own
//      grammar -- an anchor is a control shape DESIGN-RULINGS/DEC-393
//      already treat specially, never requiring a painted face). Recorded
//      as (fileName, line, drawnFloor, label). MEASURED: 266 drawn
//      controls across 12 of the 13 files (docs/design/Chautauqua
//      Docs.dc.html draws none of this shape).
//
//   2. JOIN: for each drawn control, `labelIsMatched`-style boundary-
//      anchored search (mirroring ./frame-source-corpus's own algorithm,
//      but returning a POSITION rather than a boolean, which
//      `labelIsMatched` does not expose) over the normalized non-test
//      app/src/** + src/** corpus (`enumerateSourceFiles` +
//      `normalizeSource`, skipping the decision registry via
//      `isDecisionRegistryFile` -- DEC-967's one-stripper rule, DEC-976
//      wave-129 amendment (c)). At each match position, the nearest
//      enclosing tag's `class=`/`className=` attribute is read (quoted
//      string, `{...}` expression, or template literal -- any syntax, the
//      reader only pulls `chq-` tokens out of the captured attribute-value
//      span) and its `chq-` tokens extracted. A match is REJECTED (as if
//      absent) when the text between the nearest preceding `>` and the
//      match still contains an unclosed `<` -- that shape means the match
//      landed inside an as-yet-unclosed tag's OWN attribute value (e.g.
//      `aria-label="File type"`, `placeholder="File"`, a `label="File"`
//      prop), not in real rendered text content, and reading "the nearest
//      class=" from there would misattribute a sibling/ancestor's class to
//      a string that is not actually the control's own rendered label.
//      (Measured false positive, closed by this guard: FilesLibrary.tsx's
//      `<div className="chq-chipstrip" ... aria-label="File type">`
//      wrongly resolved Settings.dc.html:1461's "File" pill to
//      `chq-chipstrip` -- a container, never a control -- before the
//      guard; the guard drops it to UNRESOLVED, which is honest, since no
//      real rendered-text match for that pill's label was found.)
//
//   3. GRADE: each `chq-` token found is resolved to its declared
//      `min-height` from any TOP-LEVEL (non-`@media`) rule mentioning it
//      as a class selector anywhere in the app/src/** + src/** corpus --
//      `@media` blocks are stripped before rule extraction (DEC-385:
//      desktop is the base/unqualified declaration, a `max-width` block
//      only narrows it, so the desktop-grading value is never inside one).
//      The MAXIMUM declared min-height across every qualifying rule and
//      every token found is the row's resolved floor. An OFFENDER declares
//      STRICTLY BELOW the floor its own frame draws; a token with a
//      qualifying rule that declares NO min-height anywhere is an offender
//      at 0. A row with no label match, no extractable token, or no rule
//      mentioning any extracted token is UNRESOLVED -- counted separately
//      with its own two-sided tripwire (DEC-808: every ratchet in this
//      campaign is two-sided). MEASURED: 23 offenders, 129 unresolved (91
//      no label match, 38 label matched but no extractable token; zero
//      rows with a token and no rule at all) -- the JOIN's own
//      conservatism (a same-tag, text-node-only class read) means over a
//      third of the population lands UNRESOLVED rather than falsely OK or
//      falsely offending; a later wave with a real DOM-aware reader can
//      drain the unresolved bucket without this ledger's offender ratchet
//      ever having asserted something untrue.
//
//   4. RATCHET, two-sided, mirroring every prior ledger in this campaign:
//      DESKTOP_FLOOR_DIVERGENCE_CEILING is a single exported const, hand-
//      measured on this branch by forcing it to -1 and reading the printed
//      offender list -- never an expression naming the measured set.
//      DESKTOP_FLOOR_UNRESOLVED_CEILING is its two-sided companion for the
//      unresolved bucket, seeded the identical way. Both registered in
//      `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` only, never
//      `CAMPAIGN_CONSTANT_NAMES`/`TIER2_CEILING_NAMES`, on the identical
//      reasoning DEC-393 wave-147 gave the phone half: a new non-zero row
//      in the exit gate would move the campaign's goalposts mid-
//      convergence.
//
//   5. VACUITY: exact drawn-control count and per-file breakdown, plus a
//      synthetic positive/negative control pair over a fabricated
//      population in a tmpdir-free, string-only fixture (mirroring
//      desktop-control-label.scan.test.ts's own in-memory fixture idiom --
//      no real product token is ever used to prove the extractor works).
//
//   6. Measured offenders/unresolved rows are recorded in
//      docs/design/audit/desktop-control-floor-v12.md, drift-proof
//      citations only (bare path then a backticked quote, never
//      `path:NNN`, per test/citation-form-drift.scan.test.ts).
//
// This file names the app's ungraded desktop control-floor fidelity; it
// does not close it, and it does not touch app/src/styles.css or any
// other desktop CSS -- desktop stays frozen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, normalizeSource } from './frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: label/extent walk, ported from
// test/desktop-frame-ledger.scan.test.ts (never imported -- sibling-owned
// file). isPhone derivation identical to that file's own. -----------------

const LABEL_RE = />([^<]+)<\//;

function isPhoneFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

interface RawLabel {
  line: number;
  title: string;
}

interface FrameExtent {
  fileName: string;
  /** 1-based line number of the label span that opens this frame. */
  line: number;
  title: string;
  /** Extent end (exclusive): the next label line, or Infinity. */
  extentEnd: number;
}

function labelsInFile(fileName: string): RawLabel[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels: RawLabel[] = [];
  lines.forEach((content, idx) => {
    if (!isLabelLine(content)) return;
    const m = content.match(LABEL_RE);
    if (m) labels.push({ line: idx + 1, title: m[1]!.trim() });
  });
  return labels;
}

/** Every label-opened frame in `fileName`, tagged with whether its extent
 * contains a phone (width:390px+height:844) line -- identical derivation
 * to test/desktop-frame-ledger.scan.test.ts's own allFramesInFile. */
function allFramesInFile(fileName: string): { frame: FrameExtent; isPhone: boolean }[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels = labelsInFile(fileName);
  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = nextLabel ? nextLabel.line : Infinity;
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isPhoneFrameLine);
    return { frame: { fileName, line: label.line, title: label.title, extentEnd }, isPhone };
  });
}

const DESKTOP_FRAMES: FrameExtent[] = designFiles().flatMap((f) =>
  allFramesInFile(f)
    .filter((e) => !e.isPhone)
    .map((e) => e.frame)
);

// -- Drawn-control extraction ------------------------------------------------

export interface DrawnControl {
  fileName: string;
  /** 1-based line number of the text immediately following the drawn
   * control's opening tag. */
  line: number;
  drawnFloor: number;
  label: string;
  frameTitle: string;
  frameLine: number;
}

const OPEN_TAG_RE = /<(\w+)\b([^>]*)>/g;

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
}

/** A drawn control per the task grammar: any element whose attribute
 * string carries min-height:NNpx AND border-radius AND (border: OR
 * background:); or, for an `<a>` specifically, min-height:NNpx alone.
 * Exported so the non-vacuity fixture below can drive this exact function
 * over a fabricated population, never a real product token. */
export function drawnControlFloor(tag: string, attrs: string): number | null {
  const mh = attrs.match(/min-height:(\d+)px/);
  if (!mh) return null;
  const floor = Number(mh[1]);
  if (tag === 'a') return floor;
  const hasBorderRadius = /border-radius/.test(attrs);
  const hasBorderOrBackground = /border:/.test(attrs) || /background:/.test(attrs);
  return hasBorderRadius && hasBorderOrBackground ? floor : null;
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

/** Every drawn control in one frame's raw text extent. Exported so the
 * non-vacuity fixture below can drive this exact function over a
 * fabricated frame, never a real product token. */
export function drawnControlsInFrameText(
  text: string
): { label: string; drawnFloor: number; offset: number }[] {
  const out: { label: string; drawnFloor: number; offset: number }[] = [];
  OPEN_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN_TAG_RE.exec(text))) {
    const tag = m[1]!;
    const attrs = m[2]!;
    const floor = drawnControlFloor(tag, attrs);
    if (floor === null) continue;
    const afterOpen = m.index + m[0].length;
    const nextLt = text.indexOf('<', afterOpen);
    const rawLabel = (nextLt === -1 ? text.slice(afterOpen) : text.slice(afterOpen, nextLt)).trim();
    if (!isRealLabel(rawLabel)) continue;
    out.push({ label: rawLabel, drawnFloor: floor, offset: afterOpen });
  }
  return out;
}

function drawnControlsInFile(fileName: string): DrawnControl[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = allFramesInFile(fileName)
    .filter((e) => !e.isPhone)
    .map((e) => e.frame);
  const out: DrawnControl[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    for (const raw of drawnControlsInFrameText(text)) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, startOff + raw.offset),
        drawnFloor: raw.drawnFloor,
        label: raw.label,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

const ALL_CONTROLS: DrawnControl[] = designFiles().flatMap(drawnControlsInFile);

// -- Match side: normalized non-test app/src/** + src/** corpus ------------
// (frame-source-corpus's shared stripper/decoder -- DEC-967's one-stripper
// rule -- imported, never re-implemented.)

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

function isAlnum(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/** First boundary-anchored occurrence of `label` in `blob`, or null.
 * Companion to ./frame-source-corpus's `labelIsMatched` -- same boundary
 * algorithm, but returns a POSITION (labelIsMatched only returns a
 * boolean), because this ledger needs the position to read the nearest
 * class attribute. Not a second copy of the stripper/decoder (those stay
 * solely in frame-source-corpus); this is position-finding only. Exported
 * for the non-vacuity fixture below. */
export function firstBoundaryMatch(label: string, blob: string): number | null {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return null;
  const firstIsAlnum = isAlnum(needle[0]);
  const lastIsAlnum = isAlnum(needle[needle.length - 1]);
  let idx = blob.indexOf(needle);
  while (idx !== -1) {
    const before = idx > 0 ? blob[idx - 1] : undefined;
    const afterIdx = idx + needle.length;
    const after = afterIdx < blob.length ? blob[afterIdx] : undefined;
    const boundaryBeforeOk = !firstIsAlnum || !isAlnum(before);
    const boundaryAfterOk = !lastIsAlnum || !isAlnum(after);
    if (boundaryBeforeOk && boundaryAfterOk) return idx;
    idx = blob.indexOf(needle, idx + 1);
  }
  return null;
}

const CLASS_TOKEN_RE = /\bchq-[A-Za-z0-9-]+/g;

/** `chq-` tokens carried by the nearest enclosing element's class=/
 * className= attribute at `idx` in `blob` -- quoted string, `{...}`
 * expression, or template literal, any syntax; the reader only pulls
 * `chq-` tokens out of the captured attribute-value span rather than
 * parsing the expression. Returns [] (UNRESOLVED, never a guess) when:
 *  - `idx` sits inside an as-yet-unclosed opening tag's OWN attribute
 *    value (detected as an unmatched `<` between the nearest preceding
 *    `>` and idx) -- e.g. `aria-label="File type"`, a `label="File"`
 *    prop -- so a sibling/ancestor's class is never misattributed to a
 *    string that is not the control's own rendered label;
 *  - no class=/className= attribute is found on the enclosing tag. */
export function classTokensNear(blob: string, idx: number): string[] {
  const prevGt = blob.lastIndexOf('>', idx);
  const afterPrevGt = blob.slice(prevGt + 1, idx);
  // If the span between the nearest preceding '>' and idx still contains an
  // unmatched '<', idx sits INSIDE an as-yet-unclosed opening tag's own
  // attribute value (e.g. aria-label="File type"), not in real text-node
  // content -- reject rather than misattribute a sibling/ancestor's class.
  if (afterPrevGt.includes('<')) return [];
  if (prevGt === -1) return [];
  // idx is real text content immediately following the tag that closed at
  // prevGt. That enclosing tag's own attribute string runs from ITS
  // opening '<' up to prevGt -- look backward for it.
  const openLt = blob.lastIndexOf('<', prevGt);
  if (openLt === -1) return [];
  const tagChunk = blob.slice(openLt, prevGt + 1);
  const cm = tagChunk.match(/\b(?:class|className)\s*=\s*/);
  if (!cm) return [];
  const startAttr = (cm.index ?? 0) + cm[0].length;
  const opener = tagChunk[startAttr];
  let valueEnd: number;
  if (opener === '"' || opener === "'" || opener === '`') {
    const close = tagChunk.indexOf(opener, startAttr + 1);
    if (close === -1) return [];
    valueEnd = close + 1;
  } else if (opener === '{') {
    let depth = 0;
    let j = startAttr;
    for (; j < tagChunk.length; j++) {
      if (tagChunk[j] === '{') depth++;
      else if (tagChunk[j] === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    valueEnd = j;
  } else {
    return [];
  }
  const valueChunk = tagChunk.slice(startAttr, valueEnd);
  return [...new Set(valueChunk.match(CLASS_TOKEN_RE) ?? [])];
}

// -- Resolve: each chq- token's declared min-height from any TOP-LEVEL
// (non-@media) rule mentioning it -----------------------------------------

/** Strips every `@media ... { ... }` block (brace-balanced) from `text`,
 * leaving only top-level rules. DEC-385: desktop is the unqualified base
 * declaration; a `max-width` block only narrows it for phone, so it is
 * never the desktop-grading value. */
export function stripMediaBlocks(text: string): string {
  const AT_RE = /@media\b[^{]*\{/g;
  let result = '';
  let i = 0;
  let m: RegExpExecArray | null;
  AT_RE.lastIndex = 0;
  while ((m = AT_RE.exec(text))) {
    if (m.index < i) continue;
    result += text.slice(i, m.index);
    let depth = 1;
    let j = AT_RE.lastIndex;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    i = j;
    AT_RE.lastIndex = j;
  }
  result += text.slice(i);
  return result;
}

const TOPLEVEL_BLOBS: string[] = NORMALIZED_BLOBS.map(stripMediaBlocks);
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;

function isTokenChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9-]/.test(ch);
}

/** True when `.token` occurs in `selectorText`, boundary-anchored so
 * `.chq-btn` never matches inside `.chq-btn-primary`. */
function selectorMentionsToken(selectorText: string, token: string): boolean {
  const needle = `.${token}`;
  let idx = selectorText.indexOf(needle);
  while (idx !== -1) {
    const before = idx > 0 ? selectorText[idx - 1] : undefined;
    const after = selectorText[idx + needle.length];
    if (!isTokenChar(before) && !isTokenChar(after)) return true;
    idx = selectorText.indexOf(needle, idx + 1);
  }
  return false;
}

/** Resolves `token`'s declared min-height from every top-level rule (any
 * source file) whose selector list mentions it: `hasRule` is true the
 * moment any such rule exists (even with no min-height declared, per the
 * task grammar's "an offender at 0"); `maxMinHeight` is the largest
 * min-height px value found across all qualifying rules, or null if none
 * declare one. Exported for the non-vacuity fixture below (over a small
 * fixture blob list); the real corpus join below uses `TOKEN_INDEX`
 * instead, a one-pass precomputed map over the whole corpus -- calling
 * this function per token per row would be O(rows * tokens * rules),
 * where the index is O(rules) total. */
export function resolveTokenMinHeight(
  token: string,
  blobs: readonly string[]
): { hasRule: boolean; maxMinHeight: number | null } {
  let hasRule = false;
  let maxMinHeight: number | null = null;
  for (const blob of blobs) {
    RULE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE_RE.exec(blob))) {
      const selectorText = m[1]!;
      const body = m[2]!;
      if (!selectorMentionsToken(selectorText, token)) continue;
      hasRule = true;
      const mh = body.match(/min-height\s*:\s*(\d+)px/);
      if (mh) {
        const v = Number(mh[1]);
        if (maxMinHeight === null || v > maxMinHeight) maxMinHeight = v;
      }
    }
  }
  return { hasRule, maxMinHeight };
}

/** Selector-list class tokens, extracted directly (never re-testing every
 * known token against every selector) -- the single-pass companion to
 * `selectorMentionsToken`'s per-token search, used to build `TOKEN_INDEX`
 * below in one walk over the corpus. */
const SELECTOR_CLASS_TOKEN_RE = /\.([A-Za-z][A-Za-z0-9-]*)/g;

/** One-pass precomputed index: every top-level rule in the whole corpus is
 * visited exactly once, and every `chq-`-token-shaped class its selector
 * list names gets this rule's min-height (if any) folded into the token's
 * running max. Built once at module load; the JOIN below is then a plain
 * map lookup per token instead of a corpus re-scan per token. */
const TOKEN_INDEX = new Map<string, { hasRule: boolean; maxMinHeight: number | null }>();
for (const blob of TOPLEVEL_BLOBS) {
  RULE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RULE_RE.exec(blob))) {
    const selectorText = m[1]!;
    const body = m[2]!;
    const mh = body.match(/min-height\s*:\s*(\d+)px/);
    const v = mh ? Number(mh[1]) : null;
    SELECTOR_CLASS_TOKEN_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    const seenInRule = new Set<string>();
    while ((tm = SELECTOR_CLASS_TOKEN_RE.exec(selectorText))) {
      const tok = tm[1]!;
      if (seenInRule.has(tok)) continue;
      seenInRule.add(tok);
      const existing = TOKEN_INDEX.get(tok);
      if (!existing) {
        TOKEN_INDEX.set(tok, { hasRule: true, maxMinHeight: v });
      } else {
        existing.hasRule = true;
        if (v !== null && (existing.maxMinHeight === null || v > existing.maxMinHeight)) existing.maxMinHeight = v;
      }
    }
  }
}

function resolveTokenMinHeightIndexed(token: string): { hasRule: boolean; maxMinHeight: number | null } {
  return TOKEN_INDEX.get(token) ?? { hasRule: false, maxMinHeight: null };
}

// -- Join + grade every drawn control ---------------------------------------

export type RowStatus = 'ok' | 'offender' | 'unresolved';

export interface GradedRow {
  control: DrawnControl;
  status: RowStatus;
  reason: 'no-label-match' | 'no-token' | 'no-rule' | null;
  tokens: string[];
  declaredMinHeight: number | null;
}

function gradeControl(control: DrawnControl): GradedRow {
  let tokens: string[] = [];
  let labelMatched = false;
  for (const blob of NORMALIZED_BLOBS) {
    const idx = firstBoundaryMatch(control.label, blob);
    if (idx === null) continue;
    labelMatched = true;
    tokens.push(...classTokensNear(blob, idx));
  }
  tokens = [...new Set(tokens)];

  if (!labelMatched) {
    return { control, status: 'unresolved', reason: 'no-label-match', tokens, declaredMinHeight: null };
  }
  if (tokens.length === 0) {
    return { control, status: 'unresolved', reason: 'no-token', tokens, declaredMinHeight: null };
  }

  let best: number | null = null;
  let anyRule = false;
  for (const token of tokens) {
    const { hasRule, maxMinHeight } = resolveTokenMinHeightIndexed(token);
    if (hasRule) anyRule = true;
    if (maxMinHeight !== null && (best === null || maxMinHeight > best)) best = maxMinHeight;
  }
  if (!anyRule) {
    return { control, status: 'unresolved', reason: 'no-rule', tokens, declaredMinHeight: null };
  }
  const declared = best ?? 0;
  const status: RowStatus = declared < control.drawnFloor ? 'offender' : 'ok';
  return { control, status, reason: null, tokens, declaredMinHeight: declared };
}

const GRADED: GradedRow[] = ALL_CONTROLS.map(gradeControl);
const OFFENDERS: GradedRow[] = GRADED.filter((r) => r.status === 'offender');
const UNRESOLVED: GradedRow[] = GRADED.filter((r) => r.status === 'unresolved');

// -- Ratchets -----------------------------------------------------------
// Both measured on this branch by forcing each to -1 and reading the
// printed row list. Two-sided per DEC-808 (every ratchet in this campaign
// is two-sided); registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE only (DEC-393 wave-151 amendment's own reasoning).
export const DESKTOP_FLOOR_DIVERGENCE_CEILING = 23;
export const DESKTOP_FLOOR_UNRESOLVED_CEILING = 129;

describe('desktop drawn-floor ledger (DEC-393 wave-151 amendment, v12 mobile campaign)', () => {
  it('non-vacuity: enumerates exactly 108 desktop frames across 13 files (same population test/desktop-frame-ledger.scan.test.ts measures pre-exclusion)', () => {
    const files = designFiles();
    expect(files.length).toBe(13);
    expect(DESKTOP_FRAMES.length).toBe(108);
  });

  it('non-vacuity: extracts exactly 266 drawn controls, with the exact per-file breakdown', () => {
    const perFile: Record<string, number> = {};
    for (const c of ALL_CONTROLS) perFile[c.fileName] = (perFile[c.fileName] ?? 0) + 1;
    expect(perFile).toEqual({
      'Chautauqua Account.dc.html': 17,
      'Chautauqua Agenda.dc.html': 5,
      'Chautauqua Comms.dc.html': 9,
      'Chautauqua Contacts.dc.html': 28,
      'Chautauqua Content.dc.html': 4,
      'Chautauqua Home.dc.html': 5,
      'Chautauqua Overview.dc.html': 28,
      'Chautauqua Public and Portal.dc.html': 41,
      'Chautauqua Review.dc.html': 15,
      'Chautauqua Settings.dc.html': 67,
      'Chautauqua Speakers.dc.html': 20,
      'Chautauqua Submissions.dc.html': 27,
    });
    expect(ALL_CONTROLS.length).toBe(266);
    // Chautauqua Docs.dc.html draws none of this shape -- confirmed absent
    // rather than silently missing from the breakdown above.
    expect(perFile['Chautauqua Docs.dc.html']).toBeUndefined();
  });

  it('non-vacuity: the drawn-floor histogram is large and spans more than the ruled 44px minimum', () => {
    const histogram: Record<number, number> = {};
    for (const c of ALL_CONTROLS) histogram[c.drawnFloor] = (histogram[c.drawnFloor] ?? 0) + 1;
    expect(histogram[46]).toBeGreaterThan(histogram[44] ?? 0);
    expect(Object.values(histogram).reduce((a, b) => a + b, 0)).toBe(266);
  });

  it('non-vacuity: source population is large and spans both app/src and src', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(300);
    expect(SOURCE_FILES.some((f) => f.startsWith(APP_SRC_ROOT))).toBe(true);
    expect(SOURCE_FILES.some((f) => f.startsWith(SRC_ROOT) && !f.startsWith(APP_SRC_ROOT))).toBe(true);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population', () => {
    // Fabricated frame text -- never a real product token -- wearing the
    // three drawn-control shapes the extractor looks for, plus a negative
    // (bare min-height, no border-radius/border/background) that must NOT
    // be extracted.
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <span style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px">Zzy Field Present</span>',
      '  <span style="background:#4E5C31; border-radius:4px; min-height:44px">Zzy Chip Present</span>',
      '  <a href="#" style="min-height:44px">Zzy Anchor Present</a>',
      '  <span style="min-height:44px">Zzy Bare Chip Absent</span>',
      '</div>',
    ].join('\n');
    const extracted = drawnControlsInFrameText(fabricatedFrameText);
    const labels = extracted.map((e) => e.label);
    expect(labels).toContain('Zzy Field Present');
    expect(labels).toContain('Zzy Chip Present');
    expect(labels).toContain('Zzy Anchor Present');
    // NEGATIVE: bare min-height with no border-radius/border/background is
    // not a drawn control face -- never extracted.
    expect(labels).not.toContain('Zzy Bare Chip Absent');
    expect(extracted.find((e) => e.label === 'Zzy Field Present')?.drawnFloor).toBe(46);

    // POSITIVE class-token read: a label directly inside a classed tag's
    // text content resolves that tag's chq- tokens.
    const positiveBlob = normalizeSource('<span className="chq-zzy-fixture chq-zzy-other">Zzy Field Present</span>');
    const posIdx = firstBoundaryMatch('Zzy Field Present', positiveBlob)!;
    expect(posIdx).not.toBeNull();
    expect(classTokensNear(positiveBlob, posIdx).sort()).toEqual(['chq-zzy-fixture', 'chq-zzy-other']);

    // NEGATIVE: a match landing inside an attribute value (not real text
    // content) must not misattribute the enclosing tag's class.
    const negativeBlob = normalizeSource('<div className="chq-zzy-wrapper" aria-label="Zzy Field Present type">x</div>');
    const negIdx = firstBoundaryMatch('Zzy Field Present', negativeBlob)!;
    expect(negIdx).not.toBeNull();
    expect(classTokensNear(negativeBlob, negIdx)).toEqual([]);

    // Rule resolution: top-level rule wins, @media-scoped rule is ignored
    // for the desktop grading value.
    const fixtureCss = normalizeSource(
      [
        '.chq-zzy-fixture { min-height: 30px; }',
        '@media (max-width: 700px) { .chq-zzy-fixture { min-height: 60px; } }',
      ].join('\n')
    );
    const stripped = stripMediaBlocks(fixtureCss);
    expect(stripped).not.toContain('60px');
    const resolved = resolveTokenMinHeight('chq-zzy-fixture', [stripped]);
    expect(resolved).toEqual({ hasRule: true, maxMinHeight: 30 });
    // NEGATIVE: an unmentioned token has no rule at all.
    const unresolved = resolveTokenMinHeight('chq-zzy-unmentioned', [stripped]);
    expect(unresolved).toEqual({ hasRule: false, maxMinHeight: null });
  });

  it(`never exceeds DESKTOP_FLOOR_DIVERGENCE_CEILING (${DESKTOP_FLOOR_DIVERGENCE_CEILING}) resolved offenders`, () => {
    if (OFFENDERS.length > DESKTOP_FLOOR_DIVERGENCE_CEILING) {
      const rows = OFFENDERS.map(
        (r) =>
          `${r.control.fileName}:${r.control.line} -- "${r.control.label}" draws min-height:${r.control.drawnFloor}px ` +
          `(frame: ${r.control.frameTitle}); resolved tokens [${r.tokens.join(', ')}] declare ${r.declaredMinHeight}px`
      );
      throw new Error(
        `${OFFENDERS.length} desktop drawn-floor divergences, above the ceiling of ` +
          `${DESKTOP_FLOOR_DIVERGENCE_CEILING}. DESKTOP_FLOOR_DIVERGENCE_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane). Offenders:\n${rows.join('\n')}`
      );
    }
    expect(OFFENDERS.length).toBeLessThanOrEqual(DESKTOP_FLOOR_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW DESKTOP_FLOOR_DIVERGENCE_CEILING (${DESKTOP_FLOOR_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < DESKTOP_FLOOR_DIVERGENCE_CEILING) {
      throw new Error(
        `${OFFENDERS.length} desktop drawn-floor divergences, below the ceiling of ` +
          `${DESKTOP_FLOOR_DIVERGENCE_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const DESKTOP_FLOOR_DIVERGENCE_CEILING = ${OFFENDERS.length};`
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(DESKTOP_FLOOR_DIVERGENCE_CEILING);
  });

  it(`never exceeds DESKTOP_FLOOR_UNRESOLVED_CEILING (${DESKTOP_FLOOR_UNRESOLVED_CEILING}) unresolved rows`, () => {
    if (UNRESOLVED.length > DESKTOP_FLOOR_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} desktop drawn-floor rows are unresolved, above the ceiling of ` +
          `${DESKTOP_FLOOR_UNRESOLVED_CEILING}. DESKTOP_FLOOR_UNRESOLVED_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane).`
      );
    }
    expect(UNRESOLVED.length).toBeLessThanOrEqual(DESKTOP_FLOOR_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW DESKTOP_FLOOR_UNRESOLVED_CEILING (${DESKTOP_FLOOR_UNRESOLVED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNRESOLVED.length < DESKTOP_FLOOR_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} desktop drawn-floor rows are unresolved, below the ceiling of ` +
          `${DESKTOP_FLOOR_UNRESOLVED_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const DESKTOP_FLOOR_UNRESOLVED_CEILING = ${UNRESOLVED.length};`
      );
    }
    expect(UNRESOLVED.length).toBeGreaterThanOrEqual(DESKTOP_FLOOR_UNRESOLVED_CEILING);
  });

  it('every row is accounted for exactly once across ok/offender/unresolved', () => {
    expect(GRADED.length).toBe(ALL_CONTROLS.length);
    const okCount = GRADED.filter((r) => r.status === 'ok').length;
    expect(okCount + OFFENDERS.length + UNRESOLVED.length).toBe(ALL_CONTROLS.length);
  });
});
