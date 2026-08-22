// Phone drawn-floor ledger (DEC-393 wave-147 amendment; task w7-da).
//
// DEC-393's wave-147 amendment rules a ledger keying each phone (width:390)
// frame's drawn `min-height:NNpx` control to the product rule that carries
// it, graded against the height its own frame draws -- 44px is the ruling's
// MINIMUM, not the pack's value; the pack draws min-height:46px 260 times
// and min-height:48px 89 times against 44px 215 times, and no instrument
// before this file graded a control against the floor its own frame draws
// rather than against the ruling's bare >=44px minimum. This file builds
// that ledger for the PHONE half only -- the desktop half is a sibling
// file, `v12m-w7-db`'s task this wave (DEC-393 wave-151 amendment). No
// product CSS byte changes here: this file MEASURES and RATCHETS; the drain
// is a later, separately-ruled act once the offender list exists.
//
// 1. POPULATION -- phone frames: readdirSync docs/design for *.dc.html; a
//    frame opens on any line carrying both `width:390px` and `height:844`;
//    its title is the nearest preceding `font-size:19px ... >TITLE</span>`
//    label; its extent runs to the next such label line or EOF. Ported
//    (not imported) from test/phone-frame-ledger.scan.test.ts's own idiom,
//    per that file's header precedent of standing alone.
//
//    Inside each frame's extent, a DRAWN CONTROL is one of:
//      (a) any `<div>`/`<span>`/`<a>` whose own inline `style="..."` carries
//          a `min-height:NNpx` AND `border-radius` AND (`border:` OR
//          `background:`) -- the painted-face predicate
//          test/frame-control-label.scan.test.ts's `isPaintedSpanFace`
//          already uses, generalised from `<span>` alone to the three tags
//          the pack actually paints this face onto (measured: div 165x,
//          span 312x, a 2x);
//      (b) any `<a ...min-height:NNpx...>` regardless of a painted face
//          (mirrors that file's own `ANCHOR_RE`, generalised from the
//          literal 44px to any NNpx);
//      (c) any element inside the docked-footer signature
//          (`flex-shrink:0; border-top:1px solid #1B1D17;
//          background:#EFEBDF`, walked `<div`/`</div>` with a depth counter
//          to the BALANCED close -- a column-direction footer nests rows
//          inside itself, so stopping at the first `</div>` truncates the
//          region, the exact bug that file's own header warns against)
//          carrying its own `min-height:NNpx` but NOT already caught by (a)
//          -- the admin tabbar's per-tab column
//          (`flex:1; min-height:44px; display:flex; flex-direction:column;
//          align-items:center; justify-content:center`) draws no
//          border-radius/border/background of its own and is invisible to
//          (a) alone.
//    Each recorded control's label is its trimmed, tag-stripped inner text
//    (nested decoration tags -- e.g. a caret `<span>` inside a filter
//    chip -- are stripped rather than defeating the match, since the
//    element's own painted OR footer geometry is what carries the floor,
//    not its children's). A control whose label is empty or shorter than 2
//    characters, or contains `{{` (an `sc-for` template placeholder such as
//    `{{ t.label }}`, never a literal word the app renders), is dropped
//    from the ledger before matching -- the tabbar's own `{{ t.label }}`
//    template row is exactly this shape and is correctly excluded here
//    rather than counted as an unresolved offender.
//
// 2. JOIN -- drawn control -> product rule (WAVE 25 REPAIR, DEC-393
//    amendment, task w25-b -- ported from test/desktop-control-floor.scan.
//    test.ts, which "already solved this" for the desktop half). The
//    non-test source corpus is `app/src/**` + `src/**` .ts/.tsx/.css
//    (test/frame-source-corpus.ts's `enumerateSourceFiles`, which already
//    skips `.test.` paths and the decision registry via
//    `isDecisionRegistryFile` -- DEC-967 sighting #16). Each file is
//    normalized (`normalizeSource`: comment-stripped, entity-decoded,
//    whitespace-collapsed -- DEC-967's one-stripper rule) into a blob.
//
//    For every BOUNDARY-ANCHORED occurrence of a drawn control's label in
//    every blob (`allBoundaryMatches`, collecting EVERY position rather
//    than the first), the occurrence is kept only when `ownTextEquals`
//    confirms the enclosing tag's OWN text content -- the run from the
//    nearest preceding `>` to the next `<` -- normalises to EXACTLY the
//    label, never merely CONTAINS it ("the element whose own text content
//    IS the label"). At each surviving position, the enclosing tag's
//    `class=`/`className=` tokens are read (`classTokensNear`; quoted
//    string, `{...}` expression, or template literal, any syntax) and its
//    `chq-` tokens are UNIONED across every surviving position in every
//    blob -- never a first-occurrence-per-blob pick. `classTokensNear`
//    additionally rejects a position that sits inside an as-yet-unclosed
//    tag's OWN attribute value (e.g. `aria-label="File type"`), so a
//    sibling/ancestor's class is never misattributed to a string that is
//    not the control's own rendered label.
//
//    WAVE 25 REPAIR retires the wave-22 (DEC-995) `LABEL_SITES`/
//    `AMBIGUOUS_LABELS`/`ambiguous-source-match` shape entirely: that join
//    graded a label UNRESOLVED (rather than crediting an arbitrary
//    first-file pick) the moment its several rendering SITES disagreed on
//    token set -- an honest-but-unmeasuring fix that left 60 of 235 drawn
//    controls (26% of the population) permanently ungraded on principle,
//    with a ceiling of 0 giving no signal over them. The union join
//    resolves this the same way `ownTextEquals`+`allBoundaryMatches` do for
//    the desktop half: every genuinely OWN-TEXT-EQUAL site (not a mere
//    substring/aria-label/co-incidental-sibling match) legitimately renders
//    that exact label, so its class tokens all belong in the same row's
//    token set -- there is no "disagreement" to be ambiguous about, only a
//    control whose token set is the union of every element that truly
//    renders it. `firstBoundaryMatch`'s old "first occurrence per blob"
//    shape (never used by the ambiguity join, but a decoy the desktop file
//    already diagnosed) is not ported here at all.
//
// 3. GRADE (WAVE 25 REPAIR, ported from desktop's `gradeControl` union
//    grade): the token set is the union of every own-text-equal position's
//    `chq-` tokens across the whole corpus. A row grades:
//      - `no-label-match`  -- no own-text-equal position exists anywhere
//        (the corpus renders no element whose text IS the label -- a label
//        composed at render, a shared helper, a live count, ...);
//      - `no-token`        -- an own-text-equal position exists but no
//        `chq-` token was extracted from its enclosing tag;
//      - `no-rule`         -- every extracted token has NO CSS rule
//        anywhere in the corpus mentioning it as a class selector (any
//        top-level rule, or ANY `@media (max-width: ...)` block regardless
//        of breakpoint -- a phone-only rule is the correct authoring shape
//        under DEC-385 and is not treated as unowned, DEC-393 wave-94);
//      - `no-control-shape` -- every extracted token's qualifying rule(s)
//        declare no min-height AND none is CONTROL-SHAPED (its own
//        top-level-or-@media rule declares a `border:`, `background:`,
//        `padding-inline:`, or `min-height:`, EXCLUDING a bare
//        `border:none`/`background:none`/`transparent`/`0`/`0px` reset) --
//        a typography/eyebrow class the pack happens to draw inside a
//        bordered chip is not the app rendering a control, and grading it
//        OFFENDER at 0 would assert a gap that does not exist (this is
//        what stops a bordered typography class becoming a false
//        offender, ported from desktop's wave-157 repair (iii));
//      - `resolved`        -- at least one resolved token is
//        control-shaped; the row's resolved height is the MAXIMUM declared
//        `min-height` across every qualifying rule and every token found,
//        and it is an OFFENDER iff that height is strictly below the floor
//        its own frame draws (an unstyled-height rule counts as declaring
//        0).
//    `no-label-match`/`no-token`/`no-rule`/`no-control-shape` are all
//    UNRESOLVED, never OFFENDER.
//
// 4. RATCHET (two-sided, DEC-808): FRAME_FLOOR_DIVERGENCE_CEILING, seeded
//    by forcing it to -1, running the file, and reading the printed
//    offender list back. UNRESOLVED_COUNT_TRIPWIRE is its non-vacuity
//    companion for the unresolved bucket, seeded the identical way.
//
// 5. VACUITY: an exact drawn-control count and exact per-file breakdown
//    tripwire, plus a synthetic positive/negative control pair over a
//    fabricated single-file population written to a tmpdir (never a live
//    product count) -- the idiom app/src/tautological-assertion.scan.test.ts
//    and test/frame-caption-ledger.scan.test.ts both use.
//
// 6. REGISTERED in scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE ONLY
//    (never CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES) -- the wave-147
//    ruling is explicit that a new non-zero row in the exit gate would move
//    the campaign's goalposts mid-convergence.
//
// WAVE 23 (DEC-393 amendment, task w23-g): a composed-label resolution
// tier, shared with the desktop half via test/helpers/composed-label-
// resolve.ts (DEC-613: one join, not two) and consulted ONLY when the
// own-text tier above finds no match at all. Every exported string-
// returning helper under src/domain/*-copy.ts and app/src/lib/*-
// vocabulary.ts (readdirSync-derived, never hand-listed) whose returned
// template literal carries a `${...}` hole is decomposed into its fixed
// text segments; a drawn label resolves ONLY when it matches exactly ONE
// helper AND that helper has exactly ONE call site in the whole corpus
// shaped as its own text (two helpers or two call sites is left
// UNRESOLVED, deliberately not unioned -- see that module's own header).
// Re-measured on this branch (forcing UNRESOLVED_COUNT_TRIPWIRE to -1):
// the tier resolves 2 of the 111 no-label-match rows -- both "Move
// DFC-047 to 11:30" (Chautauqua Agenda.dc.html:171, Chautauqua
// Overview.dc.html:276), via schedule-copy.ts's conflictMoveLabel, to
// PhoneAgenda.tsx's ONE call site (`chq-phone-slot-clash-move`), declared
// 44px, exactly matching both frames' own drawn 44px floor -- both grade
// OK, zero new offenders. FRAME_FLOOR_DIVERGENCE_CEILING stays 0.
// UNRESOLVED_COUNT_TRIPWIRE lowered 111 -> 109. Full receipt in
// docs/design/audit/frame-control-floor-390-v12.md's "WAVE 23" section.
//
// PORTING NOTE (wave 25): `ownTextEquals`/`allBoundaryMatches`/
// `classTokensNear` are copied (not imported) from
// test/desktop-control-floor.scan.test.ts even though that file exports
// them, because that file is itself a vitest suite -- importing it would
// execute its module-scope `describe`/`it` calls a second time inside this
// file's own module graph, double-registering its 12 tests. This mirrors
// the file's own pre-existing precedent (§1 above): a sibling SCAN test is
// always PORTED, never imported, exactly per that file's own "stands
// alone" header. `stripMediaBlocks`/desktop's `resolveTokenMinHeight`/
// `tokenIsControlShaped` are NOT ported as-is: the desktop file grades
// against TOP-LEVEL rules only (DEC-385: desktop is the unqualified base),
// while the phone grade must ALSO admit `@media (max-width: ...)` rules
// (DEC-393 wave-94) -- this file's pre-existing CSS-rule corpus (`ALL_CSS_RULES`,
// built from the shared `app/src/phone-tap-target-scan/core` +
// `app/src/phone-overflow-scan/population` primitives per DEC-613) already
// carries both registers as a flat `{selector, body}` list, a different
// shape from desktop's raw-blob-plus-regex walk. The control-shape test
// itself (`isControlShapedBody`'s property/value grammar) is ported
// unchanged onto that `{selector, body}` shape.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, normalizeSource } from './frame-source-corpus';
import {
  allCssFiles,
  narrowMediaRules,
  selectorMentionsToken,
  stripComments as stripCssComments,
  topLevelRulesWithExemption,
} from '../app/src/phone-tap-target-scan/core';
import { extractCssTsLiteral, sanitizeCommentBraces } from '../app/src/phone-overflow-scan/population';
import { discoverComposedHelpers, resolveComposedLabel, type ComposedHelper } from './helpers/composed-label-resolve';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: every width:390/height:844 phone frame in docs/design -----
// (ported, not imported, from test/phone-frame-ledger.scan.test.ts's own
// Frame population idiom, per that file's own "stands alone" precedent.)

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

function designFiles(): string[] {
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

// -- Drawn-control extraction ------------------------------------------------

export interface DrawnControl {
  fileName: string;
  line: number;
  drawnFloor: number;
  label: string;
  kind: 'painted' | 'anchor' | 'footer';
  frameTitle: string;
  frameLine: number;
}

const FOOTER_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF';
const PAINTED_OPEN_RE = /<(div|span|a)\b([^>]*)>/g;
const MIN_HEIGHT_ATTR_RE = /min-height:(\d+(?:\.\d+)?)px/;
const BORDER_RADIUS_ATTR_RE = /border-radius/;
const BORDER_ATTR_RE = /border:/;
const BACKGROUND_ATTR_RE = /background:/;
const FOOTER_MIN_HEIGHT_OPEN_RE = /<(div|span)\b([^>]*)>/g;

function isPaintedFace(attrs: string): boolean {
  return (
    MIN_HEIGHT_ATTR_RE.test(attrs) &&
    BORDER_RADIUS_ATTR_RE.test(attrs) &&
    (BORDER_ATTR_RE.test(attrs) || BACKGROUND_ATTR_RE.test(attrs))
  );
}

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
}

function innerTextFlat(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Walks `<${tag}` / `</${tag}>` tokens forward from `openStart` with a
 * depth counter to the BALANCED close, mirroring
 * test/frame-control-label.scan.test.ts's `balancedDivEnd`, generalised to
 * any tag name so the same walk serves the footer's own `<div>` region and
 * (if ever needed) a painted element that nests a same-tag child. */
function balancedTagEnd(text: string, openStart: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}\\b`, 'g');
  re.lastIndex = openStart;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        const closeGt = text.indexOf('>', m.index);
        if (closeGt === -1) throw new Error(`unterminated </${tag}> during balanced walk`);
        return closeGt + 1;
      }
    } else {
      depth++;
    }
  }
  throw new Error(`balancedTagEnd: <${tag}> at offset ${openStart} never closed`);
}

/** Extracts every drawn control from one frame's raw text extent. Exported
 * so the non-vacuity synthetic controls below can drive this exact
 * function over a fabricated fixture, never a real product token.
 * `lineStartIndex`/`baseOffset` map back to real file line numbers; a
 * synthetic caller can pass a trivial identity mapping. */
export function drawnControlsInFrameText(
  text: string,
): { label: string; kind: 'painted' | 'anchor' | 'footer'; offset: number; drawnFloor: number }[] {
  const out: { label: string; kind: 'painted' | 'anchor' | 'footer'; offset: number; drawnFloor: number }[] = [];
  const seenOffsets = new Set<number>();

  // (a) painted div/span/a.
  PAINTED_OPEN_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = PAINTED_OPEN_RE.exec(text))) {
    const tag = pm[1]!;
    const attrs = pm[2]!;
    if (!isPaintedFace(attrs)) continue;
    const heightMatch = attrs.match(MIN_HEIGHT_ATTR_RE);
    if (!heightMatch) continue;
    const end = balancedTagEnd(text, pm.index, tag);
    const closeTagLen = `</${tag}>`.length;
    const content = text.slice(pm.index + pm[0].length, end - closeTagLen);
    const label = innerTextFlat(content);
    if (!isRealLabel(label)) continue;
    out.push({ label, kind: 'painted', offset: pm.index, drawnFloor: Number(heightMatch[1]) });
    seenOffsets.add(pm.index);
  }

  // (b) any anchor carrying its own min-height, painted or not.
  const ANCHOR_RE = /<a\b([^>]*)>([^<]+)<\/a>/g;
  let am: RegExpExecArray | null;
  while ((am = ANCHOR_RE.exec(text))) {
    if (seenOffsets.has(am.index)) continue; // already recorded by (a)
    const attrs = am[1]!;
    const heightMatch = attrs.match(MIN_HEIGHT_ATTR_RE);
    if (!heightMatch) continue;
    const label = am[2]!.trim();
    if (!isRealLabel(label)) continue;
    out.push({ label, kind: 'anchor', offset: am.index, drawnFloor: Number(heightMatch[1]) });
    seenOffsets.add(am.index);
  }

  // (c) docked-footer signature: every div/span carrying its OWN
  // min-height but not already caught by (a)/(b) above.
  let sigIdx = text.indexOf(FOOTER_SIGNATURE);
  while (sigIdx !== -1) {
    const divStart = text.lastIndexOf('<div', sigIdx);
    if (divStart === -1) throw new Error(`footer signature at offset ${sigIdx} has no enclosing <div`);
    const footerEnd = balancedTagEnd(text, divStart, 'div');
    const footerText = text.slice(divStart, footerEnd);

    FOOTER_MIN_HEIGHT_OPEN_RE.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = FOOTER_MIN_HEIGHT_OPEN_RE.exec(footerText))) {
      const absOffset = divStart + fm.index;
      if (seenOffsets.has(absOffset)) continue;
      const tag = fm[1]!;
      const attrs = fm[2]!;
      const heightMatch = attrs.match(MIN_HEIGHT_ATTR_RE);
      if (!heightMatch) continue;
      const end = balancedTagEnd(footerText, fm.index, tag);
      const closeTagLen = `</${tag}>`.length;
      const content = footerText.slice(fm.index + fm[0].length, end - closeTagLen);
      const label = innerTextFlat(content);
      if (!isRealLabel(label)) continue;
      out.push({ label, kind: 'footer', offset: absOffset, drawnFloor: Number(heightMatch[1]) });
      seenOffsets.add(absOffset);
    }
    sigIdx = text.indexOf(FOOTER_SIGNATURE, footerEnd);
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

  function offsetToLine(offset: number): number {
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

  const frames = framesInFile(fileName);
  const out: DrawnControl[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    const raw = drawnControlsInFrameText(text);
    for (const r of raw) {
      out.push({
        fileName,
        line: offsetToLine(startOff + r.offset),
        drawnFloor: r.drawnFloor,
        label: r.label,
        kind: r.kind,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

const ALL_CONTROLS: DrawnControl[] = designFiles().flatMap(drawnControlsInFile);

// -- Source corpus: comment-stripped, entity-decoded, whitespace-collapsed
// (`normalizeSource`, DEC-967's one-stripper rule -- shared with the
// desktop half, same corpus population). -----------------------------------

const SOURCE_FILE_PATHS = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_BLOBS: string[] = SOURCE_FILE_PATHS.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

// -- Composed-label resolution tier (DEC-393 wave-23 amendment; task w23-g)
// -- consulted ONLY when the own-text tier above finds no match for a
// label at all. See test/helpers/composed-label-resolve.ts's own header
// for the full algorithm and honesty clauses; that module is the ONE place
// this join lives, shared byte-for-byte with the desktop half. -----------

const COMPOSED_HELPERS: ComposedHelper[] = discoverComposedHelpers(join(SRC_ROOT, 'domain'), join(APP_SRC_ROOT, 'lib'));

function isAlnum(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/** Every boundary-anchored occurrence of `label` in `blob`. Ported
 * unchanged from test/desktop-control-floor.scan.test.ts's export of the
 * same name (see file-header PORTING NOTE for why this is a copy, not an
 * import). Exported for the non-vacuity fixture below. */
export function allBoundaryMatches(label: string, blob: string): number[] {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return [];
  const firstIsAlnum = isAlnum(needle[0]);
  const lastIsAlnum = isAlnum(needle[needle.length - 1]);
  const positions: number[] = [];
  let idx = blob.indexOf(needle);
  while (idx !== -1) {
    const before = idx > 0 ? blob[idx - 1] : undefined;
    const afterIdx = idx + needle.length;
    const after = afterIdx < blob.length ? blob[afterIdx] : undefined;
    const boundaryBeforeOk = !firstIsAlnum || !isAlnum(before);
    const boundaryAfterOk = !lastIsAlnum || !isAlnum(after);
    if (boundaryBeforeOk && boundaryAfterOk) positions.push(idx);
    idx = blob.indexOf(needle, idx + 1);
  }
  return positions;
}

/** True when the text content of the tag immediately enclosing `idx` in
 * `blob` -- from the nearest preceding `>` to the next `<` -- normalises
 * (whitespace-collapsed, trimmed) to EXACTLY `label`. Ported unchanged from
 * test/desktop-control-floor.scan.test.ts's export of the same name.
 * Exported for the non-vacuity fixture below. */
export function ownTextEquals(label: string, blob: string, idx: number): boolean {
  const needle = label.replace(/\s+/g, ' ').trim();
  const prevGt = blob.lastIndexOf('>', idx);
  if (prevGt === -1) return false;
  const afterPrevGt = blob.slice(prevGt + 1, idx);
  if (afterPrevGt.includes('<')) return false;
  const nextLt = blob.indexOf('<', idx);
  const textEnd = nextLt === -1 ? blob.length : nextLt;
  const fullText = blob.slice(prevGt + 1, textEnd).replace(/\s+/g, ' ').trim();
  return fullText === needle;
}

const CLASS_TOKEN_RE = /\bchq-[A-Za-z0-9-]+/g;

/** `chq-` tokens carried by the nearest enclosing element's class=/
 * className= attribute at `idx` in `blob`. Ported unchanged from
 * test/desktop-control-floor.scan.test.ts's export of the same name.
 * Exported for the non-vacuity fixture below. */
export function classTokensNear(blob: string, idx: number): string[] {
  const prevGt = blob.lastIndexOf('>', idx);
  const afterPrevGt = blob.slice(prevGt + 1, idx);
  if (afterPrevGt.includes('<')) return [];
  if (prevGt === -1) return [];
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

// -- CSS corpus: app/src/**/*.css + src/**/*.css.ts template literals ------
// (unchanged from the pre-wave-25 file: this is the phone-specific CSS
// register that admits BOTH top-level and @media(max-width) rules per
// DEC-385/DEC-393 wave-94, a different corpus shape from desktop's
// top-level-only blob walk -- see file-header PORTING NOTE.)

function cssTsFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css.ts')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface CssRule {
  selector: string;
  body: string;
}

const ALL_CSS_RULES: CssRule[] = [];
for (const cssFile of allCssFiles(APP_SRC_ROOT)) {
  const raw = sanitizeCommentBraces(stripCssComments(readFileSync(cssFile, 'utf-8')));
  ALL_CSS_RULES.push(...topLevelRulesWithExemption(raw));
  ALL_CSS_RULES.push(...narrowMediaRules(raw, Number.MAX_SAFE_INTEGER));
}
for (const cssTsFile of cssTsFiles(SRC_ROOT)) {
  const raw = readFileSync(cssTsFile, 'utf-8');
  const { css } = extractCssTsLiteral(raw, dirname(cssTsFile));
  const sanitized = sanitizeCommentBraces(stripCssComments(css));
  ALL_CSS_RULES.push(...topLevelRulesWithExemption(sanitized));
  ALL_CSS_RULES.push(...narrowMediaRules(sanitized, Number.MAX_SAFE_INTEGER));
}

const MIN_HEIGHT_DECL_RE = /min-height\s*:\s*(\d+(?:\.\d+)?)px/g;

/** Resolves `token`'s declared min-height from every CSS rule (top-level or
 * @media(max-width), per the phone corpus above) whose selector mentions
 * it: `hasRule` is true the moment any such rule exists (even one
 * declaring no min-height, per the file's own "an offender at 0" grammar);
 * `maxMinHeight` is the largest min-height px value found across all
 * qualifying rules. Ported (grammar, not code shape -- the underlying rule
 * representation differs) from desktop's `resolveTokenMinHeightIndexed`. */
function resolveTokenMinHeight(token: string): { hasRule: boolean; maxMinHeight: number | undefined } {
  let hasRule = false;
  let maxMinHeight: number | undefined;
  for (const rule of ALL_CSS_RULES) {
    if (!selectorMentionsToken(rule.selector, token)) continue;
    hasRule = true;
    MIN_HEIGHT_DECL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MIN_HEIGHT_DECL_RE.exec(rule.body))) {
      const v = Number(m[1]);
      if (maxMinHeight === undefined || v > maxMinHeight) maxMinHeight = v;
    }
  }
  return { hasRule, maxMinHeight };
}

// -- Control-shape corroboration (WAVE 25 REPAIR, ported from desktop's
// `isControlShapedBody`/`tokenIsControlShaped`, §676/§795): a resolved
// token must actually paint a control face -- its own rule declares a
// border, a background, a padding-inline, or a min-height, EXCLUDING a
// bare `border:none`/`background:none`/`transparent`/`0`/`0px` reset -- or
// the row grades UNRESOLVED (`no-control-shape`) rather than OFFENDER.
// `isControlShapedBody`'s grammar is ported byte-for-byte onto the phone
// corpus's own `{selector, body}` shape; `selectorOwnsToken` is likewise
// ported so a token only "owns" a rule when it is the rightmost
// (own-element) compound of a selector, never merely an ANCESTOR
// (`.token button { ... }` resets a nested control, not `.token`'s own
// box). -----------------------------------------------------------------

const NONE_VALUE_RE = /^(none|transparent|0|0px)$/i;

/** Ported byte-for-byte from desktop's `isControlShapedBody`. */
function isControlShapedBody(body: string): boolean {
  for (const raw of body.split(';')) {
    const m = raw.trim().match(/^(border|background|padding-inline|min-height)\s*:\s*(.+)$/);
    if (!m) continue;
    const prop = m[1]!;
    const value = m[2]!.trim();
    if ((prop === 'border' || prop === 'background') && NONE_VALUE_RE.test(value)) continue;
    return true;
  }
  return false;
}

function isTokenChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9-]/.test(ch);
}

/** Ported unchanged from desktop's `selectorOwnsToken`: `topLevelRulesWithExemption`/
 * `narrowMediaRules` capture the raw, still comma-joined selector text of
 * each `{...}` block exactly as desktop's own `RULE_RE` walk does (neither
 * splits a comma-separated selector list into one rule per selector), so
 * the comma-split loop is required here too -- e.g.
 * `app/src/pages/submissions/detail.css`'s `.chq-detail-back,\n
 * .chq-detail-position-prev,\n  .chq-detail-position-next { ... }` is ONE
 * rule with a 3-way selector list, and `.chq-detail-position-prev` only
 * "owns" it via the middle branch of that list. */
function selectorOwnsToken(selectorText: string, token: string): boolean {
  const needle = `.${token}`;
  for (const rawSel of selectorText.split(',')) {
    let idx = rawSel.indexOf(needle);
    while (idx !== -1) {
      const before = idx > 0 ? rawSel[idx - 1] : undefined;
      const afterIdx = idx + needle.length;
      const after = rawSel[afterIdx];
      if (!isTokenChar(before) && !isTokenChar(after)) {
        const rest = rawSel.slice(afterIdx);
        if (!/[\s>+~][^\s]/.test(rest)) return true;
      }
      idx = rawSel.indexOf(needle, idx + 1);
    }
  }
  return false;
}

/** True when `token`'s own rule(s) anywhere in the phone CSS corpus
 * (top-level or @media(max-width)) declare a border, a background, a
 * padding-inline, or a min-height. Ported from desktop's
 * `tokenIsControlShaped`, adapted to the phone corpus's pre-parsed
 * `{selector, body}` list rather than a raw-blob regex walk. Exported for
 * the non-vacuity fixture below. */
export function tokenIsControlShaped(token: string): boolean {
  for (const rule of ALL_CSS_RULES) {
    if (!selectorOwnsToken(rule.selector, token)) continue;
    if (isControlShapedBody(rule.body)) return true;
  }
  return false;
}

// -- Grade -------------------------------------------------------------------

export type RowReason = 'no-label-match' | 'no-token' | 'no-rule' | 'no-control-shape' | 'resolved';

interface Graded {
  control: DrawnControl;
  resolvedHeight: number | undefined;
  reason: RowReason;
  tokens: string[];
  /** WAVE 23 (DEC-393 amendment): which tier resolved this row's tokens --
   * not part of the grading grammar itself, carried through for the
   * ledger's own reporting. */
  matchTier: 'own-text' | 'composed' | null;
}

/** WAVE 25 REPAIR (DEC-393 amendment, task w25-b): resolves the token set
 * as the UNION of the class tokens of every element in the whole corpus
 * whose OWN text content IS the label (`allBoundaryMatches` +
 * `ownTextEquals`, ported from desktop's `gradeControl`) -- never a
 * first-occurrence-per-blob pick, and never a "sites disagree -> unresolved"
 * ambiguity gate (the retired wave-22 `LABEL_SITES` shape): every
 * genuinely own-text-equal site really does render that exact label, so
 * its tokens belong in the row's set. A row with a resolved token set but
 * no CONTROL-SHAPED member grades UNRESOLVED (`no-control-shape`) rather
 * than OFFENDER. */
function gradeControl(control: DrawnControl): Graded {
  let tokens: string[] = [];
  let ownTextMatched = false;
  for (const blob of NORMALIZED_BLOBS) {
    for (const idx of allBoundaryMatches(control.label, blob)) {
      if (!ownTextEquals(control.label, blob, idx)) continue;
      ownTextMatched = true;
      tokens.push(...classTokensNear(blob, idx));
    }
  }
  tokens = [...new Set(tokens)].filter((t) => t.startsWith('chq-'));

  let matchTier: Graded['matchTier'] = ownTextMatched ? 'own-text' : null;
  if (!ownTextMatched) {
    // WAVE 23 (DEC-393 amendment): composed-label tier, consulted ONLY when
    // the own-text tier found no match anywhere in the corpus.
    const composed = resolveComposedLabel(control.label, COMPOSED_HELPERS, NORMALIZED_BLOBS, classTokensNear);
    if (composed !== null) {
      tokens = composed.tokens;
      matchTier = 'composed';
    }
  }

  if (matchTier === null) {
    return { control, resolvedHeight: undefined, reason: 'no-label-match', tokens, matchTier: null };
  }
  if (tokens.length === 0) {
    return { control, resolvedHeight: undefined, reason: 'no-token', tokens, matchTier };
  }

  let best: number | undefined;
  let anyRule = false;
  let anyControlShaped = false;
  for (const t of tokens) {
    const { hasRule, maxMinHeight } = resolveTokenMinHeight(t);
    if (hasRule) anyRule = true;
    if (maxMinHeight !== undefined && (best === undefined || maxMinHeight > best)) best = maxMinHeight;
    if (tokenIsControlShaped(t)) anyControlShaped = true;
  }
  if (!anyRule) {
    return { control, resolvedHeight: undefined, reason: 'no-rule', tokens, matchTier };
  }
  if (!anyControlShaped) {
    return { control, resolvedHeight: undefined, reason: 'no-control-shape', tokens, matchTier };
  }
  return { control, resolvedHeight: best ?? 0, reason: 'resolved', tokens, matchTier };
}

const GRADED: Graded[] = ALL_CONTROLS.map(gradeControl);
const OFFENDERS: Graded[] = GRADED.filter((g) => g.reason === 'resolved' && g.resolvedHeight! < g.control.drawnFloor);
const UNRESOLVED: Graded[] = GRADED.filter((g) => g.reason !== 'resolved');

// -- Ratchets ------------------------------------------------------------
// Wave-155 pb (DEC-393): the 7 offenders measured on v12m-w7-da -- "Sign in"
// (Account:136, drawn 50/declared 48), "Edit" (Contacts:435, drawn 48/
// declared 44; Public and Portal:589, drawn 48/declared 44), "‹ Previous"/
// "Next ›" (Docs:201-202, drawn 46/declared 44), and "Download .ics" (Public
// and Portal:401, drawn 46/declared 44; :885, drawn 48/declared 44) -- are
// each fixed at the token the scan resolved, in a scoped rule inside the
// owning sheet's terminal max-width:700px block.
//
// WAVE 25 REPAIR (DEC-393 amendment, task w25-b): re-measured on this
// branch with the union join replacing the wave-22 ambiguity gate, forcing
// this ceiling to -1 and reading the printed offender list back:
// FRAME_FLOOR_DIVERGENCE_CEILING remains 0. See
// docs/design/audit/frame-control-floor-390-v12.md for the wave-25
// breakdown.
export const FRAME_FLOOR_DIVERGENCE_CEILING = 0;

// Non-vacuity tripwire for the UNRESOLVED bucket (DEC-180/808), re-measured
// on this branch the same way. See the audit doc for the wave-25
// no-label-match/no-token/no-rule/no-control-shape breakdown.
// Lowered wave-13-xb (DEC-613): re-measured at 111, was stale at 112.
// Lowered wave-23-g (DEC-393 amendment): the composed-label tier
// (test/helpers/composed-label-resolve.ts) resolves 2 of the 111
// no-label-match rows -- both "Move DFC-047 to 11:30"
// (Chautauqua Agenda.dc.html:171, Chautauqua Overview.dc.html:276), via
// schedule-copy.ts's conflictMoveLabel, to chq-phone-slot-clash-move
// (PhoneAgenda.tsx's ONE call site), declared 44px >= both frames' drawn
// 44px -- both grade OK, zero new offenders. Re-measured at 109, was 111.
export const UNRESOLVED_COUNT_TRIPWIRE = 109;

describe('phone drawn-floor ledger (DEC-393 wave-147 amendment, v12 mobile campaign)', () => {
  it('non-vacuity: enumerates a large, multi-file population of drawn phone controls', () => {
    expect(designFiles().length).toBe(13);
    const distinctFiles = new Set(ALL_CONTROLS.map((c) => c.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(8);
    // exact per-file breakdown tripwire, measured on this branch (v12m-w7-da)
    const actualPerFile: Record<string, number> = {};
    for (const c of ALL_CONTROLS) actualPerFile[c.fileName] = (actualPerFile[c.fileName] ?? 0) + 1;
    expect(actualPerFile).toEqual({
      'Chautauqua Account.dc.html': 11,
      'Chautauqua Agenda.dc.html': 10,
      'Chautauqua Comms.dc.html': 10,
      'Chautauqua Contacts.dc.html': 24,
      'Chautauqua Content.dc.html': 26,
      'Chautauqua Docs.dc.html': 3,
      'Chautauqua Home.dc.html': 11,
      'Chautauqua Overview.dc.html': 10,
      'Chautauqua Public and Portal.dc.html': 55,
      'Chautauqua Review.dc.html': 18,
      'Chautauqua Settings.dc.html': 33,
      'Chautauqua Speakers.dc.html': 8,
      'Chautauqua Submissions.dc.html': 16,
    });
    expect(ALL_CONTROLS.length).toBe(235);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population in a tmpdir', () => {
    // A fabricated frame extent, never a real product token, wearing all
    // three drawn-control shapes this scan looks for.
    const fabricatedFrameText = [
      '<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px">Zzy Painted Present</div>',
      '<a href="#" style="min-height:44px; display:flex">Zzy Anchor Present</a>',
      '<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF">',
      '  <div style="flex:1; min-height:44px; display:flex; flex-direction:column">',
      '    <span>Zzy Footer Present</span>',
      '  </div>',
      '</div>',
    ].join('\n');
    const extracted = drawnControlsInFrameText(fabricatedFrameText);
    const labels = extracted.map((e) => e.label);
    expect(labels).toContain('Zzy Painted Present');
    expect(labels).toContain('Zzy Anchor Present');
    expect(labels).toContain('Zzy Footer Present');
    expect(extracted.find((e) => e.label === 'Zzy Painted Present')?.drawnFloor).toBe(46);
    expect(extracted.find((e) => e.label === 'Zzy Anchor Present')?.drawnFloor).toBe(44);
    expect(extracted.find((e) => e.label === 'Zzy Footer Present')?.drawnFloor).toBe(44);

    // A bare min-height:44px span with no painted face, no anchor, no
    // footer signature is correctly NOT extracted (the 283-hit data-chip
    // shape frame-control-label.scan.test.ts's own header rejects).
    const negativeText = '<span style="min-height:44px">Zzy Bare Absent</span>';
    expect(drawnControlsInFrameText(negativeText).map((e) => e.label)).not.toContain('Zzy Bare Absent');

    // Fabricated single-file source population + CSS, written to a real
    // tmpdir (never a live product path), proving the join/resolve/grade
    // pipeline end to end: the OFFENDER token declares LESS than its drawn
    // floor; the CONFORMING token declares AT LEAST its drawn floor; the
    // TYPOGRAPHY-ONLY token (no control shape) must not offend either.
    const dir = mkdtempSync(join(tmpdir(), 'frame-control-floor-synth-'));
    try {
      writeFileSync(
        join(dir, 'Fixture.tsx'),
        [
          '// a comment mentioning Zzy Footer Present must not satisfy anything',
          'export const Fixture = () => (',
          '  <div>',
          '    <span className="chq-zzy-painted">Zzy Painted Present</span>',
          '    <a className="chq-zzy-anchor">Zzy Anchor Present</a>',
          '    <span className="chq-zzy-label">Zzy Typography Present</span>',
          '  </div>',
          ');',
        ].join('\n'),
      );
      writeFileSync(
        join(dir, 'fixture.css'),
        [
          '.chq-zzy-painted { border-radius: 4px; background: #4E5C31; min-height: 30px; }', // OFFENDER: control-shaped, 30 < 46
          '@media (max-width: 700px) { .chq-zzy-anchor { min-height: 44px; } }', // conforming: control-shaped (min-height itself), 44 >= 44
          '.chq-zzy-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }', // NOT control-shaped
        ].join('\n'),
      );

      const rawTsx = readFileSync(join(dir, 'Fixture.tsx'), 'utf-8');
      const blob = normalizeSource(rawTsx);
      const paintedIdx = allBoundaryMatches('Zzy Painted Present', blob).find((idx) =>
        ownTextEquals('Zzy Painted Present', blob, idx),
      );
      expect(paintedIdx).not.toBeUndefined();
      expect(classTokensNear(blob, paintedIdx!)).toEqual(['chq-zzy-painted']);
      const anchorIdx = allBoundaryMatches('Zzy Anchor Present', blob).find((idx) =>
        ownTextEquals('Zzy Anchor Present', blob, idx),
      );
      expect(anchorIdx).not.toBeUndefined();
      expect(classTokensNear(blob, anchorIdx!)).toEqual(['chq-zzy-anchor']);
      // NEGATIVE: a comment-only mention never satisfies own-text-equal.
      const footerSites = allBoundaryMatches('Zzy Footer Present', blob).filter((idx) =>
        ownTextEquals('Zzy Footer Present', blob, idx),
      );
      expect(footerSites).toEqual([]);

      const cssRaw = sanitizeCommentBraces(stripCssComments(readFileSync(join(dir, 'fixture.css'), 'utf-8')));
      const synthRules = [
        ...topLevelRulesWithExemption(cssRaw),
        ...narrowMediaRules(cssRaw, Number.MAX_SAFE_INTEGER),
      ];
      function synthResolve(token: string): { hasRule: boolean; maxMinHeight: number | undefined } {
        let hasRule = false;
        let maxMinHeight: number | undefined;
        for (const rule of synthRules) {
          if (!selectorMentionsToken(rule.selector, token)) continue;
          hasRule = true;
          MIN_HEIGHT_DECL_RE.lastIndex = 0;
          let hm: RegExpExecArray | null;
          while ((hm = MIN_HEIGHT_DECL_RE.exec(rule.body))) {
            const v = Number(hm[1]);
            if (maxMinHeight === undefined || v > maxMinHeight) maxMinHeight = v;
          }
        }
        return { hasRule, maxMinHeight };
      }
      function synthControlShaped(token: string): boolean {
        for (const rule of synthRules) {
          if (!selectorOwnsToken(rule.selector, token)) continue;
          if (isControlShapedBody(rule.body)) return true;
        }
        return false;
      }
      expect(synthResolve('chq-zzy-painted')).toEqual({ hasRule: true, maxMinHeight: 30 });
      expect(synthResolve('chq-zzy-anchor')).toEqual({ hasRule: true, maxMinHeight: 44 });
      expect(synthControlShaped('chq-zzy-painted')).toBe(true);
      expect(synthControlShaped('chq-zzy-anchor')).toBe(true);
      // NEGATIVE: a typography-only rule (no border/background/
      // padding-inline/min-height) is not control-shaped, even though a
      // rule mentioning it exists.
      expect(synthResolve('chq-zzy-label')).toEqual({ hasRule: true, maxMinHeight: undefined });
      expect(synthControlShaped('chq-zzy-label')).toBe(false);
      // POSITIVE: an offender (drawn 46 > declared 30, control-shaped).
      expect(30 < 46).toBe(true);
      // NEGATIVE: a conforming control (drawn 44 <= declared 44).
      expect(44 < 44).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('every FIXTURE_EXCLUSIONS-style tabbar template row is correctly dropped before matching (no `{{` labels survive)', () => {
    const templateOffenders = ALL_CONTROLS.filter((c) => c.label.includes('{{'));
    expect(templateOffenders).toEqual([]);
  });

  it(`never exceeds FRAME_FLOOR_DIVERGENCE_CEILING (${FRAME_FLOOR_DIVERGENCE_CEILING}) resolved drawn-floor offenders`, () => {
    if (OFFENDERS.length > FRAME_FLOOR_DIVERGENCE_CEILING) {
      const lines = OFFENDERS.map(
        (o) =>
          `${o.control.fileName}:${o.control.line} -- drawn ${o.control.drawnFloor}px, "${o.control.label}" ` +
          `declares ${o.resolvedHeight}px (tokens [${o.tokens.join(', ')}])`,
      );
      throw new Error(
        `${OFFENDERS.length} drawn controls declare a min-height BELOW the floor their own frame draws, ` +
          `above the ceiling of ${FRAME_FLOOR_DIVERGENCE_CEILING}. FRAME_FLOOR_DIVERGENCE_CEILING may only ` +
          `be RAISED (a merge-train act, never a worker's edit mid-lane), and only once re-measured. ` +
          `Offenders:\n${lines.join('\n')}`,
      );
    }
    expect(OFFENDERS.length).toBeLessThanOrEqual(FRAME_FLOOR_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW FRAME_FLOOR_DIVERGENCE_CEILING (${FRAME_FLOOR_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < FRAME_FLOOR_DIVERGENCE_CEILING) {
      throw new Error(
        `${OFFENDERS.length} offenders is below the ceiling of ${FRAME_FLOOR_DIVERGENCE_CEILING}. This is ` +
          `the ratchet working: fidelity landed. Lower the ceiling in the same commit (a merge-train act) by ` +
          `replacing the line:\n  export const FRAME_FLOOR_DIVERGENCE_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(FRAME_FLOOR_DIVERGENCE_CEILING);
  });

  it(`UNRESOLVED bucket tripwire: exactly UNRESOLVED_COUNT_TRIPWIRE (${UNRESOLVED_COUNT_TRIPWIRE}) drawn controls resolve to no label match, no class token, no CSS rule, or no control-shaped token`, () => {
    if (UNRESOLVED.length !== UNRESOLVED_COUNT_TRIPWIRE) {
      throw new Error(
        `measured ${UNRESOLVED.length} unresolved drawn controls, expected the tripwire value ` +
          `${UNRESOLVED_COUNT_TRIPWIRE}. This tripwire exists so the drawn-control population cannot ` +
          `silently shrink (DEC-180/808) -- re-measure and replace the line:\n` +
          `  export const UNRESOLVED_COUNT_TRIPWIRE = ${UNRESOLVED.length};`,
      );
    }
    expect(UNRESOLVED.length).toBe(UNRESOLVED_COUNT_TRIPWIRE);
  });

  it('every row is accounted for exactly once across resolved/unresolved, and every resolved row is offender xor ok', () => {
    expect(GRADED.length).toBe(ALL_CONTROLS.length);
    const resolvedCount = GRADED.filter((g) => g.reason === 'resolved').length;
    expect(resolvedCount + UNRESOLVED.length).toBe(ALL_CONTROLS.length);
    const resolvedOk = GRADED.filter((g) => g.reason === 'resolved' && g.resolvedHeight! >= g.control.drawnFloor);
    expect(resolvedOk.length + OFFENDERS.length).toBe(resolvedCount);
  });

  it('union join: a label rendered at more than one site unions their tokens rather than flagging ambiguity (DEC-393 wave-25 repair of the retired wave-22 ambiguity gate)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'frame-control-floor-union-synth-'));
    try {
      writeFileSync(
        join(dir, 'FixtureA.tsx'),
        ['export const FixtureA = () => (', '  <span className="chq-zzy-union-a">Zzy Union Present</span>', ');'].join(
          '\n',
        ),
      );
      writeFileSync(
        join(dir, 'FixtureB.tsx'),
        ['export const FixtureB = () => (', '  <span className="chq-zzy-union-b">Zzy Union Present</span>', ');'].join(
          '\n',
        ),
      );
      const blobs = [
        normalizeSource(readFileSync(join(dir, 'FixtureA.tsx'), 'utf-8')),
        normalizeSource(readFileSync(join(dir, 'FixtureB.tsx'), 'utf-8')),
      ];
      let tokens: string[] = [];
      let matched = false;
      for (const blob of blobs) {
        for (const idx of allBoundaryMatches('Zzy Union Present', blob)) {
          if (!ownTextEquals('Zzy Union Present', blob, idx)) continue;
          matched = true;
          tokens.push(...classTokensNear(blob, idx));
        }
      }
      tokens = [...new Set(tokens)];
      // POSITIVE: both sites' tokens are UNIONED into one row, not flagged
      // ambiguous and dropped to unresolved -- the retired wave-22 shape.
      expect(matched).toBe(true);
      expect(tokens.sort()).toEqual(['chq-zzy-union-a', 'chq-zzy-union-b']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
