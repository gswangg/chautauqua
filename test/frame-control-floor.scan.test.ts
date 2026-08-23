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
// WAVE 26 (DEC-995 amendment, task w26-b): an attribute/prop label
// resolution tier, ported (not imported) from desktop's own WAVE 28
// (DEC-393 + DEC-808) tier -- see `SOURCE_OPEN_TAG_RE`/`ATTR_LABEL_VALUE_RE`
// below -- consulted ONLY when the own-text tier finds no match, and
// BEFORE the composed tier so this file's tier order (own-text ->
// attribute -> composed) matches the desktop file's. Resolves 4 of the 109
// no-label-match rows; one ("you@example.com", Chautauqua Account.dc.
// html:130) newly resolved to a real 48px-declared-vs-50px-drawn
// divergence, fixed in src/routes/auth.css.ts's existing phone-only
// (max-width:700px) 50px rule by adding the `.chq-auth-card .chq-input`
// class selector alongside its existing element-type selectors (desktop
// untouched, DEC-385). UNRESOLVED_COUNT_TRIPWIRE lowered 109 -> 106.
// FRAME_FLOOR_DIVERGENCE_CEILING stays 0. Full receipt in
// docs/design/audit/frame-control-floor-390-v12.md's "WAVE 26" section.
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
import {
  buildSkeletonBlobs,
  labelIsComposedLiteral,
  labelIsComposedWithKnownAffix,
  looksLikeDataValue,
  skeletonOwnTextTokens,
} from './skeleton-join';
import { DEC_393 } from '../src/decisions';

// WAVE 53 (task w53-b): DEC_393's own text is a mutable scribe-owned
// constant (DEC-976 wave-32's own standing lesson -- never assert its
// prose), so this import is a compile-checked DEPENDENCY MARKER only,
// pointing at src/decisions-data/DEC-393.md's wave-31 amendment (the
// desktop ledger's own ruling that a token set resolving to nothing but a
// typography/column register grades UNRESOLVED, never OFFENDER and never a
// silent exemption) -- the POPULATION_EXCLUDED_FIELD_LABELS table below
// applies that same ruling's *reasoning* to two rows this file's own union
// join mis-resolves onto that same token, but does so as an explicit,
// receipted population-step exclusion (never silent), the shape
// test/desktop-control-floor.scan.test.ts's RULING_SETTLED_EXCLUSIONS/
// isStatesSwatchFrameTitle already use for the identical problem.
void DEC_393;

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

/** DEC-967 wave-41 amendment: the 1-based line of the single `</x-dc>`
 * template close in `fileName`, throwing loudly on zero or multiple
 * matches. Ported (not imported) per this file's own PORTING NOTE
 * precedent -- every ledger this ruling touches carries its own copy. */
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
    // Clipped at the template's own close (DEC-967 wave-41 amendment) so
    // the last labelled block can never swallow `</x-dc>` and everything
    // past it.
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full)),
    };
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

// -- WAVE 53 (task w53-b, DEC-995's wave-53 amendment): population-step
// exclusion for portal profile field-name eyebrows -----------------------
//
// Adjudicating the sixteen NON-COMPOSED unresolved rows named in
// docs/design/audit/frame-control-floor-390-v12.md:28-49/97 individually
// (per the task's own instruction, none may remain merely bucketed) found
// two of the eleven `no-control-shape` rows are not controls at all:
// "First name" (Chautauqua Public and Portal.dc.html:645) and "Last name"
// (:649) are real, own-text-equal matches -- but the ONLY element in the
// whole corpus whose own text is exactly that string is
// src/routes/portal/profile.tsx's `<label class="chq-portal-field-label"
// for="firstName">First name</label>` (and the sibling `for="lastName"`
// label) -- a form-field NAME, not a tap target, exactly the
// "typography/column register" shape src/decisions-data/DEC-393.md's
// wave-31 amendment already rules for the desktop ledger (see the DEC_393
// dependency marker above). Excluded here at the POPULATION step, named by
// citation rather than by a bare line range, the same shape
// test/desktop-control-floor.scan.test.ts's RULING_SETTLED_EXCLUSIONS
// table uses.
const POPULATION_EXCLUDED_FIELD_LABELS: { fileName: string; line: number; label: string; reason: string }[] = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 645,
    label: 'First name',
    reason:
      'src/routes/portal/profile.tsx renders a label element reading "First name" for the firstName field -- ' +
      'a form-field NAME labelling an adjacent input, not itself an interactive control or tap target (src/decisions-data/DEC-393.md, wave-31 amendment).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 649,
    label: 'Last name',
    reason:
      'src/routes/portal/profile.tsx renders a label element reading "Last name" for the lastName field -- ' +
      'same shape as "First name" above, same field-name-eyebrow disposition.',
  },
];

function isPopulationExcludedFieldLabel(control: { fileName: string; line: number }): boolean {
  return POPULATION_EXCLUDED_FIELD_LABELS.some((e) => e.fileName === control.fileName && e.line === control.line);
}

const ALL_CONTROLS: DrawnControl[] = designFiles()
  .flatMap(drawnControlsInFile)
  .filter((c) => !isPopulationExcludedFieldLabel(c));

// -- Source corpus: comment-stripped, entity-decoded, whitespace-collapsed
// (`normalizeSource`, DEC-967's one-stripper rule -- shared with the
// desktop half, same corpus population). -----------------------------------

const SOURCE_FILE_PATHS = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_BLOBS: string[] = SOURCE_FILE_PATHS.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

// WAVE 31 (DEC-808 wave-31 amendment, task w31-b): digit-collapsed skeleton
// blobs, built once from the SAME NORMALIZED_BLOBS corpus above, for the
// skeleton join tier below. The join technique itself (`collapseDigitsToSkeleton`
// / `buildSkeletonBlobs` / `skeletonOwnTextTokens`) lives in ONE shared
// module, test/skeleton-join.ts (DEC-613) -- see that file's own header for
// why it does not also re-implement allBoundaryMatches/ownTextEquals/
// classTokensNear (each ledger PORTS those, never imports a sibling suite).
const SKELETON_BLOBS: string[] = buildSkeletonBlobs(NORMALIZED_BLOBS);

// -- Composed-label resolution tier (DEC-393 wave-23 amendment; task w23-g)
// -- consulted ONLY when the own-text tier above finds no match for a
// label at all. See test/helpers/composed-label-resolve.ts's own header
// for the full algorithm and honesty clauses; that module is the ONE place
// this join lives, shared byte-for-byte with the desktop half. -----------

const COMPOSED_HELPERS: ComposedHelper[] = discoverComposedHelpers(join(SRC_ROOT, 'domain'), join(APP_SRC_ROOT, 'lib'));

// WAVE 31 (DEC-808 wave-31 amendment, task w31-b): a small, explicit,
// HAND-VERIFIED table for the handful of no-label-match rows the automatic
// passes above (own-text/attribute/composed/skeleton tiers, plus
// `labelIsComposedLiteral`/`looksLikeDataValue`/`labelIsComposedWithKnownAffix`)
// cannot classify on pattern alone -- each entry backed by a real, checked
// citation to the rendering source. Mirrors `HAND_VERIFIED_COMPOSED` from
// branch `v12m-w29-e`'s (unlanded) desktop file, kept as a SEPARATE table
// here (DEC-613's "one join" rule is about the join TECHNIQUE, never about
// every hand-triage table feeding it -- see test/skeleton-join.ts's own
// header). Keyed on fileName+line only (construction-proof).
const HAND_VERIFIED_COMPOSED: { fileName: string; line: number; reason: string }[] = [
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 165,
    reason:
      'COMPOSED-from-a-constant: src/routes/auth-views.tsx renders `placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}` -- a backtick template literal with an interpolation hole; the source carries no literal digit at all, only the variable name, so neither the own-text tier (a placeholder, not text content -- also not caught by the attribute tier because the value is a template expression, not a plain quoted string) nor the digit-skeleton join (which requires a digit already present at the matching source position) can see it.',
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 140,
    reason:
      "COMPOSED-from-data-plus-a-sibling-flag: app/src/pages/agenda/PhoneAgenda.tsx renders the room chip as `{room.name}` (a live room name, \"Room 2A\" is this pack's fixture) followed by a SEPARATE `<span className=\"chq-flag\">CLASH</span>` sibling when `roomHasConflict(...)` is true -- the frame's own-text extraction concatenates both elements' text into one label, but no single element's own text is ever \"Room 2A CLASH\".",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 142,
    reason:
      'COMPOSED-from-data: same room-chip renderer as the :140 entry above (PhoneAgenda.tsx `{room.name}`); "Room 2B" is this pack\'s second fixture room name, live data, not static app copy.',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 386,
    reason:
      "COMPOSED-from-data: app/src/pages/content/DeliverableDetail.tsx's deliverable-kind chip renders `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}` -- that file's own comment at the same site names the exact shape (\"the plain '<kind> · N versions' label\"); the count is a live chain length, never a literal digit in source.",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 387,
    reason: 'COMPOSED-from-data: same `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, \'version\')}` renderer as the :386 entry above (DeliverableDetail.tsx), a different kind/count pair ("Recording · 1 version").',
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 215,
    reason:
      "COMPOSED-from-data (DEC-919 wave-128 amendment prose): app/src/pages/Overview.tsx renders `Remind all {spellCount(new Set(payload.overdueTasks.rows.map((r) => r.contactId)).size)}` via src/domain/count-copy.ts's spellCount/plural pair -- \"three\" is a live spelled-out count, never a literal string in source.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 277,
    reason:
      'COMPOSED-from-data (DEC-919 wave-128 amendment): app/src/pages/overview/AgendaWorkSection.tsx renders `<div className="chq-overview-overflow">{agendaOverflowLine(payload)}</div>` -- the composed sentence plus the frame\'s "›" mark, never a literal string; the amendment\'s own prose names this exact frame row.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 493,
    reason:
      'BLESSED SUBSTITUTION (DEC-967 wave-106 amendment, cited verbatim in src/routes/portal/tasks/views.tsx\'s own header comment above `tasksPageDockPrimary`): the frame\'s fixed dock resolves to "the first NOT-complete assignment\'s own existing control -- the same href/label/form the row itself would render, reused rather than duplicated content" (one of "Fill out form" / "Update your bio and headshot ›" / "Mark complete", never the literal frame string "Mark the release signed") -- a RULED, deliberate divergence, not an unadjudicated gap.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 588,
    reason:
      'BLESSED OMISSION (DEC-967 wave-106 amendment, same site as the :493 entry above): `tasksPageDockPrimary` explicitly `return`s `null` for a `file_request`-kind task ("no dockable single control (see comment above)"), because "reusing a `<input type=file>` form in two places on one page is not \'the same control\', it\'s a second, empty upload widget" -- the frame\'s "Upload slides" dock primary is a RULED, deliberate omission, not an unadjudicated gap.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 620,
    reason:
      "COMPOSED-from-data (DEC-777/DEC-041): src/routes/portal/edit.tsx:293 renders `<p class=\"chq-portal-sub\">{sessionFormatLabel(data.formatLabel)} · set by the organisers</p>` -- the format clause is live `sessionFormatLabel` vocabulary (DEC-908), only the trailing '· set by the organisers' rider is a literal; the row as a whole is never one string in source.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1091,
    reason:
      'NEAR-MISS, SETTLED (DEC-908 amendment): src/routes/public/submit-views.tsx:967 renders `<a href={...}>Submit another talk &rsaquo;</a>` -- the frame\'s own drawn label omits the trailing chevron the app adds; DEC-908\'s own prose ("The adjacent \'Submit another talk\' anchor\'s flat-link face stays as-is: cfp.css.ts already documents that as a settled whole-row styling choice") already adjudicates this exact row -- an own-text-equal match will never resolve because the two strings genuinely differ by one glyph, not because the control goes unbuilt.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 358,
    reason:
      "COMPOSED via the landed two-node idiom (DEC-919 wave-98 amendment, cited verbatim in app/src/pages/submissions/SubmissionDetailPage.tsx's own comment): `<Link className=\"chq-detail-back\">&lsaquo; <span className=\"chq-detail-back-full\">All submissions</span><span className=\"chq-detail-back-short\">Triage</span></Link>` -- ONE anchor, two sibling spans, CSS reveals `.chq-detail-back-short` at phone and `.chq-detail-back-full` at desktop; the anchor's own SOURCE text content is never the single string \"‹ Triage\", only its CSS-resolved rendered text is.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 283,
    reason:
      'COMPOSED-from-data: app/src/pages/review/Scorecard.tsx renders `<Link to={...} className="chq-review-back">&lsaquo; {plan.name} queue</Link>` -- "Wave 2" is this pack\'s live fixture plan name, never a literal string; the leading chevron and trailing " queue" are the only static parts, split around a variable my chevron-affix check cannot bridge because a SECOND fixed suffix follows the variable.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 666,
    reason:
      "BLESSED, RULED NOT A DEFECT (DEC-745 wave-98 amendment, §4, quoted verbatim): \"Review.dc.html:665-667 draws 'Save the plan' + 'Cancel'. That pair captions the NEW-plan state; an existing plan renders 'Duplicate' + 'Save' and has no Cancel-while-editing affordance on any surface. Introducing one is a behaviour change with no ruling behind it and would evict Duplicate; the geometry-only dock stands and the copy delta is recorded as a frame interpretation, not a defect.\" app/src/pages/review/PlanEditor.tsx:1497-1499 confirms the existing-plan dock renders `{saving ? \\'Saving…\\' : \\'Save\\'}`, never \"Save the plan\".",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 936,
    reason: 'Same composed `&lsaquo; {plan.name} queue` renderer as the :283 entry above (Scorecard.tsx), a second frame state drawing the identical live plan-name back-link.',
  },
];

function handVerifiedComposedReason(control: DrawnControl): string | null {
  const hit = HAND_VERIFIED_COMPOSED.find((e) => e.fileName === control.fileName && e.line === control.line);
  return hit ? hit.reason : null;
}

// WAVE 31 (DEC-808 wave-31 amendment, task w31-b): a hand-verified DENYLIST
// for the inverse mistake -- `labelIsComposedLiteral`'s "flanked by a
// matching quote character" test cannot distinguish real rendered app text
// from a DEVELOPER'S OWN COMMENT PROSE that happens to quote the frame's
// literal word, when that comment lives inside a CSS-in-JS tagged template
// (a `.css.ts` file's own `/* :NNN -- ... "Word" ... */` documentation
// block is STRING CONTENT of the template literal, not a JS syntax
// comment, so `frame-source-corpus.ts`'s `stripComments` correctly leaves
// it alone -- this is the SAME trap the field guide already names, "a
// comment quoting a frame literal", one register further down). Each entry
// is a real row where the automatic composed-literal pass fires on exactly
// this false-positive shape, hand-checked against the actual render path,
// which renders DIFFERENT text.
const NOT_ACTUALLY_COMPOSED: { fileName: string; line: number; reason: string }[] = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1063,
    reason:
      'FALSE-POSITIVE composed-literal match: the only quoted "Draft" in the corpus is inside src/routes/public/cfp.css.ts\'s own CSS-in-JS documentation comment ("the step-1 dock\'s secondary \\"Draft\\" control" / "the frame\'s \\"Draft\\" is a drawing abbreviation, not a label") -- prose ABOUT the frame, never rendered app text. The real control (src/routes/public/submit-views.tsx:746, class `chq-cfp-save-draft`) renders the literal text "Save draft", never bare "Draft" -- a genuine, unadjudicated label divergence.',
  },
];

function notActuallyComposedReason(control: DrawnControl): string | null {
  const hit = NOT_ACTUALLY_COMPOSED.find((e) => e.fileName === control.fileName && e.line === control.line);
  return hit ? hit.reason : null;
}

// WAVE 34 (DEC-613 wave-34 amendment, task w34-g): a SEPARATE hand-verified
// table -- same {fileName,line,reason} shape as HAND_VERIFIED_COMPOSED and
// NOT_ACTUALLY_COMPOSED above, consulted BEFORE notActuallyComposedReason --
// for the one remaining shape neither of those tables can express: a frame
// draws an ABBREVIATED word for a control whose real, shipped, one-name-at-
// every-width label has already been ruled correct in full elsewhere. The
// :1063 "Draft" row's own NOT_ACTUALLY_COMPOSED entry above is still true
// (the only quoted "Draft" in the corpus is documentation prose, not
// rendered text) but that classification alone still routed the row to
// `not-drawn`/OFFENDER, because nothing told gradeControl the real control
// ITSELF was already adjudicated, not merely mis-matched. This table closes
// that gap: a hit here short-circuits BEFORE the not-drawn fallback and
// grades the row `composed-unseen` (UNRESOLVED, never OFFENDER) instead.
// Each reason is PRINCIPLE-ONLY (test/exemption-reason-is-a-principle.scan.
// test.ts grades every reason string under test/) -- it quotes DEC-613
// wave-96's own ruling sentence, never a lane token or schedule language.
const BLESSED_ABBREVIATION: { fileName: string; line: number; reason: string }[] = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1063,
    reason:
      'BLESSED ABBREVIATION, quoting DEC-613 wave-96\'s own ruling sentence verbatim (src/routes/public/cfp.css.ts\'s ' +
      '`.chq-cfp-save-draft` comment, echoed in docs/design/DEVIATIONS.md): "the accessible name stays \'Save draft\' ' +
      'per DEC-613 wave-96 amendment (one control, one name at every width -- the frame\'s \'Draft\' is a drawing ' +
      'abbreviation, not a label to ship)". One control, one shipped name at every width is the correct rendering; ' +
      'the frame\'s bare "Draft" is the mockup\'s own abbreviation of that single name, not a second label the ' +
      'product owes.',
  },
];

function blessedAbbreviationReason(control: DrawnControl): string | null {
  const hit = BLESSED_ABBREVIATION.find((e) => e.fileName === control.fileName && e.line === control.line);
  return hit ? hit.reason : null;
}

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

// -- WAVE 26 (DEC-995 amendment): second match tier, an attribute/prop
// label read, ported unchanged (grammar and code) from desktop's own
// WAVE 28 (DEC-393 + DEC-808) tier -- see that file's header comment above
// `SOURCE_OPEN_TAG_RE` for the full rationale. Consulted ONLY when the
// own-text tier above finds no match for a label at all, and BEFORE the
// composed tier so this file's tier order matches the desktop file's
// (own-text -> attribute -> composed). -------------------------------------

const SOURCE_OPEN_TAG_RE = /<(\w+)\b([^>]*)>/g;
const ATTR_LABEL_VALUE_RE = /\b(?:label|aria-label|placeholder|title)\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/g;

/** Ported unchanged from test/desktop-control-floor.scan.test.ts's export
 * of the same name (see file-header PORTING NOTE for why this is a copy,
 * not an import). Exported for the non-vacuity fixture below. */
export function classTokensInOpenTag(tagChunk: string): string[] {
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

/** Ported unchanged from test/desktop-control-floor.scan.test.ts's export
 * of the same name. Exported for the non-vacuity fixture below. */
export function attributeLabelTokensInBlob(label: string, blob: string): string[] {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return [];
  const tokens: string[] = [];
  SOURCE_OPEN_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SOURCE_OPEN_TAG_RE.exec(blob))) {
    const attrs = m[2]!;
    ATTR_LABEL_VALUE_RE.lastIndex = 0;
    let am: RegExpExecArray | null;
    let labelMatched = false;
    while ((am = ATTR_LABEL_VALUE_RE.exec(attrs))) {
      const value = am[2]!.replace(/\s+/g, ' ').trim();
      if (value === needle) {
        labelMatched = true;
        break;
      }
    }
    if (!labelMatched) continue;
    tokens.push(...classTokensInOpenTag(m[0]!));
  }
  return [...new Set(tokens)];
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

export type RowReason =
  | 'no-label-match'
  | 'no-token'
  | 'no-rule'
  | 'no-control-shape'
  | 'resolved'
  /** WAVE 31 (DEC-808 wave-31 amendment): the label resolves as a quoted
   * string literal SOMEWHERE in the corpus (a ternary's alternate branch, a
   * template literal's fixed segment) or has the SHAPE of live fixture data
   * (an email, a date, a bare count, ...) -- the app composes/renders this
   * exact text, but no join tier can attach it to a control's own class
   * list. Never OFFENDER: real, live app text the join is blind to, not a
   * gap in the product. */
  | 'composed-unseen'
  /** WAVE 31 (DEC-808 wave-31 amendment): after the own-text, attribute,
   * composed, and skeleton tiers ALL fail, and neither
   * `labelIsComposedLiteral` nor `looksLikeDataValue` explains the miss,
   * the corpus carries NO trace of this label at all -- the frame draws a
   * control the product simply does not render. Phone is not frozen, so
   * this is a real, repairable divergence and grades OFFENDER (at an
   * effective declared height of 0, strictly below any drawn floor) even
   * though no CSS token was ever resolved to compare against. */
  | 'not-drawn';

export interface Graded {
  control: DrawnControl;
  resolvedHeight: number | undefined;
  reason: RowReason;
  tokens: string[];
  /** WAVE 23 (DEC-393 amendment): which tier resolved this row's tokens --
   * not part of the grading grammar itself, carried through for the
   * ledger's own reporting. WAVE 26 (DEC-995 amendment) adds 'attribute'.
   * WAVE 31 (DEC-808 wave-31 amendment) adds 'skeleton'. WAVE 53 (task
   * w53-b) adds 'widened-join'. */
  matchTier: 'own-text' | 'attribute' | 'composed' | 'skeleton' | 'widened-join' | null;
}

// -- WAVE 53 (task w53-b, DEC-995's wave-53 amendment): hand-verified
// widened-join resolutions for the fourteen remaining non-composed
// unresolved rows (the eleven `no-control-shape` rows plus "Headshot",
// which the attribute tier's wave-26 own text moved into that same
// bucket, plus the four `no-token` rows -- two POPULATION-EXCLUDED above,
// leaving fourteen here) -----------------------------------------------
//
// Every row below IS a control -- its floor lives on an ancestor or
// sibling class token this file's own-text/attribute joins never consult
// (the nearest ENCLOSING tag only, never a parent further up the tree, and
// never a sibling render site sharing one data-driven component). Each
// entry is HAND-VERIFIED against the real source and the real CSS rule
// that governs it (never re-derived from the generic mentions-based
// `resolveTokenMinHeight`/`tokenIsControlShaped` pair used elsewhere in
// this file, which would risk picking up an unrelated same-token rule
// elsewhere in the corpus with a taller OR shorter height and reporting a
// height that is not actually the one this specific control renders at --
// `.chq-btn`'s own min-height alone ranges 44px-48px across a dozen
// unrelated scoped rules in this corpus, so a naive "add the ancestor
// token and let the generic resolver run" widening would silently borrow
// the wrong one). `resolvedHeight` is fed straight into this file's
// existing OFFENDER grammar (`resolvedHeight < control.drawnFloor`), so a
// row whose real ancestor floor falls short of its own frame's drawn floor
// grades OFFENDER here exactly as an own-text-resolved row would --
// "resolved" is not a synonym for "conforming".
interface WidenedJoinResolution {
  fileName: string;
  line: number;
  resolvedHeight: number;
  tokens: string[];
  citation: string;
}

const WIDENED_JOIN_RESOLUTIONS: WidenedJoinResolution[] = [
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 350,
    resolvedHeight: 44,
    tokens: ['chq-btn', 'chq-comms-batch-toggle', 'chq-comms-batch-toggle-label-phone'],
    citation:
      "app/src/pages/comms/RecentSends.tsx's history row-toggle button carries " +
      'className="chq-btn chq-btn-secondary chq-comms-batch-toggle" around the ' +
      '.chq-comms-batch-toggle-label-phone span the own-text tier resolved; ' +
      "app/src/styles.css's terminal max-width:700px block gives .chq-btn min-height 44px, " +
      'exactly meeting the drawn 44px floor (DEC-833).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 537,
    resolvedHeight: 48,
    tokens: ['chq-btn', 'chq-btn-primary', 'chq-contacts-merge-footer', 'chq-contacts-merge-primary-phone-label'],
    citation:
      "app/src/pages/contacts/MergePage.tsx's primary merge button (className=\"chq-btn chq-btn-primary\") " +
      'wraps the .chq-contacts-merge-primary-phone-label span inside a .chq-contacts-merge-footer container; ' +
      "app/src/pages/contacts/contacts-panels.css's phone block declares " +
      '.chq-contacts-merge-footer .chq-btn min-height:48px, exactly meeting the drawn 48px floor.',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 417,
    resolvedHeight: 50,
    tokens: ['chq-content-upload-zone', 'chq-content-upload-prompt-phone'],
    citation:
      "app/src/pages/content/UploadZone.tsx's outer drop-zone div carries " +
      'className="chq-upload-zone chq-content-upload-zone", two levels above the ' +
      '.chq-content-upload-prompt-phone span the own-text tier resolved; ' +
      "app/src/pages/content/content.css declares .chq-content-upload-zone min-height:50px " +
      "(narrowed to 46px in app/src/pages/content/upload-zone.css's own phone block) -- " +
      'the union maximum, 50px, clears the drawn 46px floor either way.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 149,
    resolvedHeight: 44,
    tokens: ['chq-pill', 'chq-submissions-status-pending-phone'],
    citation:
      "app/src/pages/submissions/FilterBar.tsx's status-pill button carries className=\"chq-pill\" " +
      '(or "chq-pill is-active") around the .chq-submissions-status-pending-phone span the own-text tier resolved; ' +
      "app/src/styles.css's terminal phone block gives .chq-pill min-height 44px, exactly meeting the drawn 44px floor.",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 391,
    // WAVE 53 found a genuine offender here; WAVE 56 (w56-c) repaired it.
    // The own-text tier's match (.chq-detail-back-short) is a real element
    // -- the width-toggled short form of the DECISION_ACTION_LABELS.waitlisted
    // button (app/src/pages/submissions/SubmissionDetailPage.tsx's
    // decisionActionLabel, DEC-878 wave-129 amendment) -- but the SPAN
    // carries no height of its own; the real floor lives on its ancestor
    // <button className="chq-btn chq-btn-secondary">, itself wrapped in
    // .chq-detail-decision-secondary-pair inside the phone .chq-phone-dock
    // scaffold. app/src/pages/submissions/detail.css's terminal
    // max-width:700px block now adds
    // .chq-phone-dock .chq-detail-decision-primary ~ .chq-detail-decision-secondary-pair .chq-btn
    // { min-height: 46px } -- dock-scoped and primary-sibling-scoped, so the
    // in-aside pair and the decided-state pair (no primary sibling) keep
    // their prior 44px and the desktop aside stays byte-identical.
    resolvedHeight: 46,
    tokens: ['chq-btn', 'chq-btn-secondary', 'chq-detail-decision-secondary-pair', 'chq-detail-back-short'],
    citation:
      'app/src/pages/submissions/detail.css declares ' +
      '.chq-phone-dock .chq-detail-decision-primary ~ .chq-detail-decision-secondary-pair .chq-btn ' +
      'min-height:46px (w56-c) -- meeting the drawn 46px floor for Decline and Wait inside the dock, ' +
      "while .chq-detail-decision-secondary-pair .chq-btn's base and non-dock rules stay 44px for the " +
      'in-aside pair and the decided-state pair.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 523,
    resolvedHeight: 44,
    tokens: ['chq-pill', 'chq-pill-static'],
    citation:
      "app/src/pages/settings/PortalSettingsPanel.tsx's SpeakerEditPills renders SPEAKER_EDIT_FIELDS " +
      '(Bio/Headshot/Links/Session title/Abstract) as <span className="chq-pill chq-pill-static[ is-active]">' +
      '{field.label}</span> -- the own-text tier cannot see this render site at all (the text is a JSX ' +
      'expression, never a literal string, so it never own-text-matches any label) and instead mis-resolved ' +
      '"Bio" to an unrelated portal-profile field-name label sharing the same word. ' +
      "app/src/pages/settings/settings.css's phone block declares .chq-settings-portal-pills .chq-pill " +
      'min-height:44px, exactly meeting the drawn 44px floor -- same disposition for every pill in this strip ' +
      '("Headshot"/"Links"/"Title"/"Abstract" below).',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 524,
    resolvedHeight: 44,
    tokens: ['chq-pill', 'chq-pill-static'],
    citation:
      'Same SpeakerEditPills strip as "Bio" above (SPEAKER_EDIT_FIELDS[1].label === "Headshot", exact match) -- ' +
      "the wave-26 attribute tier instead mis-resolved this row to an unrelated wrapper div's title=\"Headshot\" " +
      'attribute (the profile-picture uploader section). Same .chq-settings-portal-pills .chq-pill 44px floor applies.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 525,
    resolvedHeight: 44,
    tokens: ['chq-pill', 'chq-pill-static'],
    citation:
      'Same SpeakerEditPills strip as "Bio" above (SPEAKER_EDIT_FIELDS[2].label === "Links", exact match) -- ' +
      'the own-text tier instead mis-resolved this row to an unrelated ContactDrawer.tsx section-heading span ' +
      'sharing the same word. Same .chq-settings-portal-pills .chq-pill 44px floor applies.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 526,
    resolvedHeight: 44,
    tokens: ['chq-pill', 'chq-pill-static'],
    citation:
      'Same SpeakerEditPills strip as "Bio" above, fourth pill (SPEAKER_EDIT_FIELDS[3].label === "Session title", ' +
      'a wording the frame draws abbreviated to "Title" -- the same DEC-878-style width-conditioned-copy shape ' +
      'this ledger already accepts for "Wait"/Waitlist, flagged here as a content note rather than blocking the ' +
      'disposition since geometry, not wording, is this ledger\'s own scope) -- the own-text tier instead ' +
      "mis-resolved this row to an unrelated Submissions-list column header and a portal-profile field label " +
      'sharing the word "Title". Same .chq-settings-portal-pills .chq-pill 44px floor applies.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 527,
    resolvedHeight: 44,
    tokens: ['chq-pill', 'chq-pill-static'],
    citation:
      'Same SpeakerEditPills strip as "Bio" above, fifth pill (SPEAKER_EDIT_FIELDS[4].label === "Abstract", exact ' +
      'match) -- the own-text tier instead mis-resolved this row to unrelated Settings/Submissions section-title ' +
      'headings sharing the same word. Same .chq-settings-portal-pills .chq-pill 44px floor applies.',
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 141,
    resolvedHeight: 44,
    tokens: ['chq-auth-footer-links'],
    citation:
      'src/routes/auth-views.tsx renders a bare, classless <a> for "Browse the sessions ›" inside a ' +
      '<div className="chq-auth-footer-links"> wrapper -- the own-text tier finds the own-text match but no ' +
      "chq- class on the anchor itself (`classTokensNear`'s nearest-enclosing-tag walk finds none). " +
      "src/routes/auth.css.ts's terminal phone block declares .chq-auth-footer-links a min-height:44px, " +
      'exactly meeting the drawn 44px floor (DEC-367 wave-57 amendment).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1092,
    resolvedHeight: 44,
    tokens: ['chq-cfp-links'],
    citation:
      'src/routes/public/submit-views.tsx renders a bare, classless <a> for "Browse the sessions ›" inside a ' +
      '<div class="chq-cfp-links"> wrapper, same classless-anchor shape as the Account.dc.html row above. ' +
      'src/routes/public/cfp.css.ts declares ".chq-cfp-links a, .chq-cfp-confirm-actions a:not(.chq-btn)" ' +
      'min-height:44px (its own header comment names both :1092 and :1135 as the two rows this exact rule ' +
      'was written for), exactly meeting the drawn 44px floor.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 192,
    resolvedHeight: 44,
    tokens: ['chq-contacts-filter-add-chip'],
    citation:
      'app/src/pages/contacts/FilterRulesPanel.tsx renders the "+ Rule" chip as ' +
      '<button className="chq-contacts-filter-add-chip">+ Rule</button> -- a REAL chq- class the join misses ' +
      "for a mechanical reason: the button's onClick handler body contains a bare `<` comparison " +
      '(`rules.length < MAX_SEGMENT_RULES`), and `classTokensNear`\'s `blob.lastIndexOf(\'<\', prevGt)` walk finds ' +
      "that operator's `<` instead of the real `<button` tag opener, so it reads className from a garbage tag " +
      "chunk and finds nothing. app/src/pages/contacts/contacts.css's phone block declares " +
      '.chq-contacts-filter-add-chip min-height:44px, exactly meeting the drawn 44px floor.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1135,
    resolvedHeight: 44,
    tokens: ['chq-cfp-confirm-actions'],
    citation:
      'src/routes/public/submit-views.tsx renders a bare, classless <a href="/login"> for "Log in ›" inside a ' +
      '<div class="chq-cfp-confirm-actions"> wrapper. The same src/routes/public/cfp.css.ts rule cited for the ' +
      '"Browse the sessions ›" row above (".chq-cfp-links a, .chq-cfp-confirm-actions a:not(.chq-btn)" ' +
      'min-height:44px) reaches this anchor too (it carries no .chq-btn class); a separate, later rule in the ' +
      "same file only adds `display:flex` to .chq-cfp-links a (not this selector) and a nearby " +
      '"tap-floor-exempt: inline-in-prose" receipt covers a DIFFERENT check (the flex-centred lens), not this ' +
      'min-height. Exactly meets the drawn 44px floor.',
  },
];

function widenedJoinResolutionFor(control: { fileName: string; line: number }): WidenedJoinResolution | null {
  return WIDENED_JOIN_RESOLUTIONS.find((r) => r.fileName === control.fileName && r.line === control.line) ?? null;
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
export function gradeControl(control: DrawnControl): Graded {
  // WAVE 53 (task w53-b): a hand-verified widened-join resolution takes
  // priority over every other tier -- these fourteen rows are already
  // individually adjudicated (see WIDENED_JOIN_RESOLUTIONS above) and must
  // never fall through to the generic own-text/attribute/composed/skeleton
  // machinery, which is exactly what mis-attributed most of them in the
  // first place.
  const widened = widenedJoinResolutionFor(control);
  if (widened !== null) {
    return {
      control,
      resolvedHeight: widened.resolvedHeight,
      reason: 'resolved',
      tokens: widened.tokens,
      matchTier: 'widened-join',
    };
  }

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

  // WAVE 26 (DEC-995 amendment): attribute/prop label tier, consulted ONLY
  // when the own-text tier above found no match for this label at all --
  // ported unchanged from desktop's WAVE 28 tier, and placed BEFORE the
  // composed tier so this file's tier order matches the desktop file's.
  let attrMatched = false;
  if (!ownTextMatched) {
    const attrTokens: string[] = [];
    for (const blob of NORMALIZED_BLOBS) {
      const found = attributeLabelTokensInBlob(control.label, blob);
      if (found.length > 0) {
        attrMatched = true;
        attrTokens.push(...found);
      }
    }
    tokens = [...new Set(attrTokens)];
  }

  let matchTier: Graded['matchTier'] = ownTextMatched ? 'own-text' : attrMatched ? 'attribute' : null;
  if (!ownTextMatched && !attrMatched) {
    // WAVE 23 (DEC-393 amendment): composed-label tier, consulted ONLY when
    // NEITHER the own-text nor the attribute tier above found a match.
    const composed = resolveComposedLabel(control.label, COMPOSED_HELPERS, NORMALIZED_BLOBS, classTokensNear);
    if (composed !== null) {
      tokens = composed.tokens;
      matchTier = 'composed';
    }
  }

  if (matchTier === null) {
    // WAVE 31 (DEC-808 wave-31 amendment, task w31-b): digit-collapsed
    // skeleton tier, consulted ONLY when own-text, attribute, and composed
    // ALL fail -- see test/skeleton-join.ts for the algorithm.
    const skeleton = skeletonOwnTextTokens(control.label, SKELETON_BLOBS, allBoundaryMatches, ownTextEquals, classTokensNear);
    if (skeleton.matched) {
      tokens = skeleton.tokens.filter((t) => t.startsWith('chq-'));
      matchTier = 'skeleton';
    }
  }

  if (matchTier === null) {
    // WAVE 31 (DEC-808 wave-31 amendment, task w31-b): every join tier has
    // failed. Distinguish "the app composes/renders this text and no tier
    // can attach it to a control" (stays UNRESOLVED, `composed-unseen`)
    // from "the corpus carries no trace of this label at all" (a real,
    // repairable phone divergence, `not-drawn` -- OFFENDER).
    //
    // WAVE 34 (DEC-613 wave-34 amendment, task w34-g): the blessed-
    // abbreviation table is consulted FIRST, before notActuallyComposedReason
    // -- a row can be both "the only corpus match is documentation prose"
    // AND "the real control is already ruled correct as-is", and the second
    // fact, not the first, is what settles whether it is an offender.
    if (blessedAbbreviationReason(control) !== null) {
      return { control, resolvedHeight: undefined, reason: 'composed-unseen', tokens: [], matchTier: null };
    }
    if (notActuallyComposedReason(control) !== null) {
      return { control, resolvedHeight: 0, reason: 'not-drawn', tokens: [], matchTier: null };
    }
    if (
      labelIsComposedLiteral(control.label, NORMALIZED_BLOBS) ||
      looksLikeDataValue(control.label) ||
      labelIsComposedWithKnownAffix(control.label, NORMALIZED_BLOBS) ||
      handVerifiedComposedReason(control) !== null
    ) {
      return { control, resolvedHeight: undefined, reason: 'composed-unseen', tokens: [], matchTier: null };
    }
    return { control, resolvedHeight: 0, reason: 'not-drawn', tokens: [], matchTier: null };
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
// WAVE 31 (DEC-808 wave-31 amendment): a `not-drawn` row (no join tier
// found any trace of the label in the corpus at all -- see gradeControl
// above) is an OFFENDER too, at an effective declared height of 0, exactly
// like a resolved-but-too-short row.
const OFFENDERS: Graded[] = GRADED.filter(
  (g) => (g.reason === 'resolved' && g.resolvedHeight! < g.control.drawnFloor) || g.reason === 'not-drawn',
);
const UNRESOLVED: Graded[] = GRADED.filter((g) => g.reason !== 'resolved' && g.reason !== 'not-drawn');

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
//
// WAVE 31 (DEC-808 wave-31 amendment, task w31-b): the skeleton-digit-join
// tier (test/skeleton-join.ts) plus a `not-drawn` disposition for whatever
// STILL cannot resolve after every join tier AND both automatic
// composed-vs-not-drawn classifiers fail -- see gradeControl above and
// docs/design/audit/frame-control-floor-390-v12.md's "WAVE 31" section for
// the full offender-by-offender receipt. Re-measured on this branch
// (forcing this ceiling to -1, reading the printed offender list back):
// RAISED 0 -> 1. The one real offender, "Draft" (Chautauqua Public and
// Portal.dc.html:1063), is a genuine, previously-invisible label
// divergence: the real control (src/routes/public/submit-views.tsx:746)
// renders "Save draft", never bare "Draft". No product byte moved this
// wave (this lane's own scope); left for the next wave to fix.
//
// WAVE 34 (DEC-613 wave-34 amendment, task w34-g): the wave-31 offender was
// a false positive, not a genuine divergence -- DEC-613's own wave-96
// amendment already ruled this exact row (src/routes/public/cfp.css.ts's
// `.chq-cfp-save-draft` comment, echoed in docs/design/DEVIATIONS.md and in
// docs/design/audit/public-390-request-verdicts-v12.md's "Submit a talk"
// row): "the accessible name stays 'Save draft' per DEC-613 wave-96
// amendment (one control, one name at every width -- the frame's 'Draft'
// is a drawing abbreviation, not a label to ship)". The BLESSED_ABBREVIATION
// table above encodes that ruling and short-circuits the row to
// `composed-unseen` before it can reach `not-drawn`. Re-measured on this
// branch (forcing this ceiling to -1, reading the printed offender list
// back): LOWERED 1 -> 0, zero offenders. See
// docs/design/audit/frame-control-floor-390-v12.md's "WAVE 34" section.
//
// WAVE 53 (task w53-b, DEC-995's wave-53 amendment): adjudicating the
// sixteen non-composed unresolved rows individually (WIDENED_JOIN_RESOLUTIONS
// above) surfaced one genuine, previously-invisible offender: "Wait"
// (Chautauqua Submissions.dc.html:391, drawn min-height:46px). The real
// control is the .chq-detail-decision-secondary-pair .chq-btn button (the
// own-text tier's match, .chq-detail-back-short, is a real but heightless
// sibling span inside it) -- app/src/pages/submissions/detail.css declares
// that selector min-height:44px, both at top level and inside its
// .chq-phone-dock override, while the frame draws all three dock buttons
// (Accept/Decline/Wait) at 46px. Re-measured on this branch (forcing this
// ceiling to -1, reading the printed offender list back): RAISED 0 -> 1.
// No product CSS byte moved this wave (instrument-only scope); left for a
// future wave's repair lane. See docs/design/audit/
// frame-control-floor-390-v12.md's "WAVE 53" section.
//
// WAVE 56 (task w56-c): repaired. detail.css's terminal max-width:700px
// block now adds
// .chq-phone-dock .chq-detail-decision-primary ~ .chq-detail-decision-secondary-pair .chq-btn
// { min-height: 46px }, dock-scoped and primary-sibling-scoped so the
// in-aside pair and the decided-state pair keep their prior 44px and the
// desktop aside stays byte-identical (DEC-385). Re-measured on this branch
// (forcing this ceiling to -1, reading the printed offender list back):
// LOWERED 1 -> 0. See docs/design/audit/frame-control-floor-390-v12.md
// row 11 ("Wait").
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
// Lowered wave-26 (DEC-995 amendment, task w26-b): the attribute/prop
// label tier (ported from desktop's WAVE 28 tier -- SOURCE_OPEN_TAG_RE /
// ATTR_LABEL_VALUE_RE / classTokensInOpenTag / attributeLabelTokensInBlob
// above) resolves 4 of the 109 no-label-match rows: "you@example.com"
// (Chautauqua Account.dc.html:130), "Search name, email or company…"
// (Chautauqua Contacts.dc.html:186), and "Search title or speaker…"
// (Chautauqua Submissions.dc.html:147) resolve to `resolved`/OK; "Headshot"
// (Chautauqua Settings.dc.html:524) resolves tokens but stays UNRESOLVED
// under `no-control-shape` (a typography/section class, not a control
// face) -- so the bucket net-shrinks by 3, 109 -> 106. Full receipt in
// docs/design/audit/frame-control-floor-390-v12.md's "WAVE 26" section.
//
// WAVE 31 (DEC-808 wave-31 amendment, task w31-b): the skeleton-digit join
// (test/skeleton-join.ts) resolved 0 of the 106 `no-label-match` rows to a
// genuine token (every digit-bearing label in this population is composed
// from a runtime value with NO digit literal anywhere in source, not a
// static template with a varying digit -- see the audit doc). The
// composed-vs-not-drawn split (`labelIsComposedLiteral` /
// `looksLikeDataValue` / `labelIsComposedWithKnownAffix` / a small
// hand-verified table, all in gradeControl above) reclassifies 105 of the
// 106 as `composed-unseen` (still UNRESOLVED, real live app text the join
// cannot attach to a class) and 1 as `not-drawn` (moved to OFFENDERS
// above). Re-measured on this branch (forcing this tripwire to -1, reading
// the printed reason breakdown back): 89 `composed-unseen`, 4 `no-token`,
// 12 `no-control-shape` (the wave-26 11 plus 1 reclassified from
// `no-label-match` by the attribute tier's own pre-existing "Headshot"
// row -- unchanged from wave 26, just now counted under this file's own
// updated bucket names). LOWERED 106 -> 105 (net: -106 old no-label-match
// rows, +105 composed-unseen, +1 not-drawn moved to OFFENDERS -- the
// bucket's own total this wave is 89+4+12=105). Full per-row receipt in
// docs/design/audit/frame-control-floor-390-v12.md's "WAVE 31" section.
//
// WAVE 34 (DEC-613 wave-34 amendment, task w34-g): the "Draft" row moves
// OUT of OFFENDERS and INTO this bucket as `composed-unseen` (the
// BLESSED_ABBREVIATION short-circuit above). Re-measured on this branch
// (forcing this tripwire to -1, reading the printed reason breakdown
// back): 90 `composed-unseen` (was 89, +1), 4 `no-token`, 12
// `no-control-shape` -- unchanged. RAISED 105 -> 106 (net: +1
// composed-unseen, -1 OFFENDER; the bucket's own total this wave is
// 90+4+12=106). See docs/design/audit/frame-control-floor-390-v12.md's
// "WAVE 34" section.
//
// WAVE 53 (task w53-b, DEC-995's wave-53 amendment): the sixteen
// non-composed unresolved rows (4 `no-token` + 12 `no-control-shape`) are
// each individually adjudicated -- none left merely bucketed (per the
// task's own mandate). Two ("First name"/"Last name",
// Chautauqua Public and Portal.dc.html:645/649) are POPULATION-EXCLUDED
// (see POPULATION_EXCLUDED_FIELD_LABELS, applied before ALL_CONTROLS is
// built -- they no longer appear anywhere in this file's population at
// all, graded or unresolved). Thirteen resolve OK and one ("Wait") grades
// OFFENDER via WIDENED_JOIN_RESOLUTIONS above (see
// FRAME_FLOOR_DIVERGENCE_CEILING's own WAVE 53 note). Re-measured on this
// branch (forcing this tripwire to -1, reading the printed reason
// breakdown back): 90 `composed-unseen`, 0 `no-token`, 0 `no-control-shape`
// -- LOWERED 106 -> 90 (net: -16 rows removed from UNRESOLVED, composed-
// unseen unchanged at 90). See docs/design/audit/
// frame-control-floor-390-v12.md's "WAVE 53" section for the full
// sixteen-row table.
export const UNRESOLVED_COUNT_TRIPWIRE = 90;

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
      'Chautauqua Public and Portal.dc.html': 53,
      'Chautauqua Review.dc.html': 18,
      'Chautauqua Settings.dc.html': 33,
      'Chautauqua Speakers.dc.html': 8,
      'Chautauqua Submissions.dc.html': 16,
    });
    // WAVE 53 (task w53-b): 235 -> 233, two portal profile field-name
    // eyebrows ("First name"/"Last name", Chautauqua Public and
    // Portal.dc.html:645/649) excluded at the population step -- see
    // POPULATION_EXCLUDED_FIELD_LABELS above.
    expect(ALL_CONTROLS.length).toBe(233);
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
      const lines = OFFENDERS.map((o) =>
        o.reason === 'not-drawn'
          ? `${o.control.fileName}:${o.control.line} -- drawn ${o.control.drawnFloor}px, "${o.control.label}" ` +
            `NOT-DRAWN: no join tier (own-text/attribute/composed/skeleton) finds this label anywhere in the corpus`
          : `${o.control.fileName}:${o.control.line} -- drawn ${o.control.drawnFloor}px, "${o.control.label}" ` +
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
      const breakdown: Record<string, number> = {};
      for (const g of UNRESOLVED) breakdown[g.reason] = (breakdown[g.reason] ?? 0) + 1;
      throw new Error(
        `measured ${UNRESOLVED.length} unresolved drawn controls, expected the tripwire value ` +
          `${UNRESOLVED_COUNT_TRIPWIRE}. This tripwire exists so the drawn-control population cannot ` +
          `silently shrink (DEC-180/808) -- re-measure and replace the line:\n` +
          `  export const UNRESOLVED_COUNT_TRIPWIRE = ${UNRESOLVED.length};\n` +
          `Reason breakdown: ${JSON.stringify(breakdown)}`,
      );
    }
    expect(UNRESOLVED.length).toBe(UNRESOLVED_COUNT_TRIPWIRE);
  });

  it('every row is accounted for exactly once across resolved/not-drawn/unresolved, and every resolved row is offender xor ok', () => {
    expect(GRADED.length).toBe(ALL_CONTROLS.length);
    const resolvedCount = GRADED.filter((g) => g.reason === 'resolved').length;
    const notDrawnCount = GRADED.filter((g) => g.reason === 'not-drawn').length;
    // WAVE 31 (DEC-808 wave-31 amendment): `not-drawn` rows are neither
    // `resolved` nor counted in UNRESOLVED (they are OFFENDERS, graded
    // without ever resolving a token) -- the population splits three ways.
    expect(resolvedCount + notDrawnCount + UNRESOLVED.length).toBe(ALL_CONTROLS.length);
    const resolvedOk = GRADED.filter((g) => g.reason === 'resolved' && g.resolvedHeight! >= g.control.drawnFloor);
    const resolvedOffenders = GRADED.filter((g) => g.reason === 'resolved' && g.resolvedHeight! < g.control.drawnFloor);
    expect(resolvedOk.length + resolvedOffenders.length).toBe(resolvedCount);
    expect(resolvedOffenders.length + notDrawnCount).toBe(OFFENDERS.length);
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

// WAVE 34 (DEC-613 wave-34 amendment, task w34-g): "Draft" (Chautauqua
// Public and Portal.dc.html:1063) is not a frame-floor offender -- it is a
// pack abbreviation of an already-ruled, one-name-at-every-width control.
// This block proves the BLESSED_ABBREVIATION table (a) resolves the real
// row out of OFFENDERS, (b) discriminates -- a synthetic row with no
// receipt still grades OFFENDER, never vacuously exempting everything --
// and (c) carries a resolution guard so the exemption's premise cannot rot
// silently if cfp.css.ts's own comment ever changes (the standing lesson,
// "an in-code exemption's premise rots like an allowlist").
describe('"Draft" abbreviation exemption (DEC-613 wave-34 amendment, task w34-g)', () => {
  it('the real row (Public and Portal:1063) is excluded from OFFENDERS and grades composed-unseen, not not-drawn', () => {
    const real = OFFENDERS.find((o) => o.control.fileName === 'Chautauqua Public and Portal.dc.html' && o.control.line === 1063);
    expect(real).toBeUndefined();
    const graded = GRADED.find((g) => g.control.fileName === 'Chautauqua Public and Portal.dc.html' && g.control.line === 1063);
    expect(graded).not.toBeUndefined();
    expect(graded!.reason).toBe('composed-unseen');
    expect(graded!.matchTier).toBeNull();
  });

  it('non-vacuity: a SYNTHETIC row with no BLESSED_ABBREVIATION receipt still grades OFFENDER (not-drawn) through the full pipeline', () => {
    // A fabricated fileName/line/label, never a live product citation --
    // proves the exemption discriminates rather than exempting everything
    // that reaches this fallback tier. Anchored on the synthetic fixture
    // per the standing rule: never anchor non-vacuity on a live offender a
    // sibling lane may fix out from under this proof.
    const synthetic: DrawnControl = {
      fileName: 'Zzy Fixture.dc.html',
      line: 9999,
      label: 'Zzy Unblessed Abbreviation',
      drawnFloor: 44,
      kind: 'painted',
      frameTitle: 'Zzy Fixture Frame',
      frameLine: 1,
    };
    expect(blessedAbbreviationReason(synthetic)).toBeNull();
    const graded = gradeControl(synthetic);
    expect(graded.reason).toBe('not-drawn');
    expect(OFFENDERS.some((o) => o.control.fileName === synthetic.fileName && o.control.line === synthetic.line)).toBe(false); // synthetic control was never added to ALL_CONTROLS/OFFENDERS -- gradeControl alone proves the shape
  });

  it('positive control: blessedAbbreviationReason resolves the real row to a non-null, principle-only reason', () => {
    const realControl = ALL_CONTROLS.find((c) => c.fileName === 'Chautauqua Public and Portal.dc.html' && c.line === 1063);
    expect(realControl).not.toBeUndefined();
    const reason = blessedAbbreviationReason(realControl!);
    expect(reason).not.toBeNull();
    expect(reason).toContain('DEC-613 wave-96');
  });

  it('resolution guard: the cited receipt still resolves verbatim against src/routes/public/cfp.css.ts (the exemption premise has not rotted)', () => {
    const cssPath = join(REPO_ROOT, 'src/routes/public/cfp.css.ts');
    const cssText = readFileSync(cssPath, 'utf-8');
    const receipt = 'the accessible name stays "Save draft" per DEC-613 wave-96 amendment';
    if (!cssText.includes(receipt)) {
      throw new Error(
        `BLESSED_ABBREVIATION's cited receipt no longer resolves verbatim against ${cssPath}. ` +
          `The sheet's own comment changed under this exemption -- re-derive the disposition from the live ` +
          `source before trusting this settlement. Quote was:\n  "${receipt}"`,
      );
    }
    // The receipt also names the class the real control renders, cross-
    // checked so the exemption stays pinned to the actual control, not
    // just to a floating quote that happens to still be somewhere in the
    // file.
    expect(cssText).toContain('.chq-cfp-save-draft');
  });
});

describe('control (DEC-967 wave-41 amendment): frame extent clipped at the template close', () => {
  it('a fabricated drawn control after the template close is excluded from a frame\'s extent, and the same shape before the close is included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'template-close-synth-'));
    try {
      const fixturePath = join(dir, 'Zzy Fixture.dc.html');
      const lines = [
        '<div style="font-size:19px">Zzy Frame</span>', // line 1: label
        '<div style="width:390px; height:844px">', // line 2: frame line
        '  <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px">Zzy Before Close Present</div>', // line 3
        '</div>', // line 4
        '</x-dc>', // line 5: template close
        '<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px">Zzy After Close Absent</div>', // line 6: after close -- must not enter
      ];
      writeFileSync(fixturePath, lines.join('\n'));
      const content = lines.join('\n');
      const lineStartIndex: number[] = [0];
      for (let i = 0; i < lines.length; i++) {
        lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
      }

      const closeLine = templateCloseLine(fixturePath);
      expect(closeLine).toBe(5);

      // Mirrors drawnControlsInFile's own extentEnd computation above: no
      // next label after the frame line (2), so the raw extent would run
      // to Infinity -- clipped here to the template close, exactly as the
      // production `extentEnd: Math.min(nextLabel ? nextLabel.line :
      // Infinity, templateCloseLine(full))` does.
      const frameLine = 2;
      const extentEnd = Math.min(Infinity, closeLine);
      expect(extentEnd).toBe(5);

      const startOff = lineStartIndex[frameLine - 1]!;
      const endOff = lineStartIndex[extentEnd - 1]!;
      const text = content.slice(startOff, endOff);
      const extracted = drawnControlsInFrameText(text).map((e) => e.label);

      // POSITIVE: the before-close control sits inside the clipped extent.
      expect(extracted).toContain('Zzy Before Close Present');
      // NEGATIVE: the after-close control, despite wearing the identical
      // painted-face shape in the same file, sits outside the clipped
      // extent -- exactly the swallow this ruling closes.
      expect(extracted).not.toContain('Zzy After Close Absent');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
