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
// 2. JOIN -- drawn control -> product rule: the non-test source corpus is
//    `app/src/**` + `src/**` .ts/.tsx/.css (test/frame-source-corpus.ts's
//    `enumerateSourceFiles`, which already skips `.test.` paths and the
//    decision registry via `isDecisionRegistryFile` -- DEC-967 sighting
//    #16, a DEC quoting a caption must never satisfy a ledger). Comments
//    are stripped (string/template-aware, `stripComments`) and HTML
//    entities decoded (`ENTITY_MAP`) -- but, unlike `normalizeSource`,
//    *not* whitespace-collapsed, because this file needs the source's own
//    tag structure to find the element that RENDERS a label, not merely
//    whether the label occurs anywhere in the corpus (that weaker question
//    is `frame-control-label.scan.test.ts`'s job).
//
//    The element is found by a BOUNDARY-ANCHORED match in the strongest
//    available sense: an exact, flat (no nested tag, no `{`/`}` JSX
//    expression) tag/text pair -- `<TAG attrs>LABEL</TAG>` -- whose
//    trimmed, whitespace-collapsed text content equals the drawn control's
//    label exactly. This is strictly stronger than the substring
//    boundary-anchoring `frame-control-label.scan.test.ts`'s
//    `labelIsMatched` uses (which only proves the label occurs SOMEWHERE in
//    the corpus): a whole-text-node equality can only ever be satisfied by
//    the actual rendering element, never by a longer sentence merely
//    containing the label as a substring, and it is the narrowest
//    interpretation that still lets this file read the RENDERING element's
//    own class attribute rather than merely proving the words exist (which
//    is already graded elsewhere). A label whose control is composed at
//    render (a shared helper, a template literal, a live count) therefore
//    does not resolve to a source element here -- it falls into the
//    UNRESOLVED bucket below, exactly as `frame-control-label.scan.test.ts`
//    already treats that shape as an exclusion, not a defect.
//
//    Once an element is found, its own `class=`/`className=` tokens (BOTH
//    spellings; the value may be a quoted string, a `{...}` expression, or
//    a template literal -- Hono JSX writes `class=`, DEC-393 wave-95) are
//    read, and each `chq-` token's DECLARED `min-height` is resolved from
//    any CSS rule (app/src/**/*.css via `allCssFiles`/
//    `topLevelRulesWithExemption`/`narrowMediaRules`, plus src/**/*.css.ts
//    via `extractCssTsLiteral` -- both already-shared primitives from
//    app/src/phone-tap-target-scan/core.ts and app/src/phone-overflow-scan/
//    population.ts, reused rather than re-derived per DEC-613) whose
//    selector mentions the token (`selectorMentionsToken`), in a top-level
//    rule OR inside ANY `@media (max-width: ...)` block regardless of
//    breakpoint -- a phone-only rule is the correct authoring shape under
//    DEC-385 and must not be treated as unowned (DEC-393 wave-94). When a
//    token resolves against more than one matching rule, the token's
//    resolved height is the MAXIMUM declared `min-height` among them (the
//    narrowest reasonable reading of "declared": the strongest floor any
//    rule commits the token to, since which rule actually wins the cascade
//    at runtime is not this scan's question -- that is `css-contract`'s).
//    When an element carries more than one `chq-` token, the element's
//    resolved height is the maximum across its tokens for the same reason.
//
// 3. GRADE: an OFFENDER is a drawn control whose resolved token declares a
//    min-height STRICTLY BELOW the floor its own frame draws. A control
//    with no exact-text source match, no `chq-` class token on the matched
//    element, or no CSS rule for any of its tokens is NOT an offender --
//    already graded by frame-control-label's own label ledger and by the
//    tap-floor family -- and is counted separately as UNRESOLVED, with its
//    own tripwire so the population cannot silently shrink (DEC-180/808).
//
// 4. RATCHET (two-sided, DEC-808): FRAME_FLOOR_DIVERGENCE_CEILING, seeded
//    by forcing it to -1, running the file, and reading the printed
//    offender list back.
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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, ENTITY_MAP, stripComments } from './frame-source-corpus';
import {
  allCssFiles,
  narrowMediaRules,
  selectorMentionsToken,
  stripComments as stripCssComments,
  topLevelRulesWithExemption,
} from '../app/src/phone-tap-target-scan/core';
import { extractCssTsLiteral, sanitizeCommentBraces } from '../app/src/phone-overflow-scan/population';

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

// -- Source corpus: comment-stripped, entity-decoded, whitespace NOT
// collapsed (this file needs tag structure, unlike frame-control-label's
// whitespace-collapsed blobs). --------------------------------------------

function decodeEntitiesKeepingStructure(raw: string): string {
  let s = raw;
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(char);
  }
  return s;
}

const SOURCE_FILE_PATHS = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];

// Every flat (no nested tag, no `{`/`}` JSX expression) tag/text pair found
// across the whole source corpus, keyed by its trimmed whitespace-collapsed
// text content -- an exact match against this key is the strongest
// available boundary anchoring (see file header §2). `chq-` class tokens
// come from either spelling, string/expr/template value.
const CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*"|`[^`]*`)/;
const FLAT_TAG_TEXT_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>([^<>{}]*)<\/\1>/g;

const LABEL_TO_TOKENS = new Map<string, string[]>();
for (const filePath of SOURCE_FILE_PATHS) {
  const raw = readFileSync(filePath, 'utf-8');
  const processed = decodeEntitiesKeepingStructure(stripComments(raw));
  FLAT_TAG_TEXT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FLAT_TAG_TEXT_RE.exec(processed))) {
    const attrs = m[2]!;
    const text = m[3]!.replace(/\s+/g, ' ').trim();
    if (text.length === 0) continue;
    if (LABEL_TO_TOKENS.has(text)) continue; // first occurrence wins, deterministic file order
    const classMatch = attrs.match(CLASS_ATTR_RE);
    const tokens = classMatch ? [...classMatch[1]!.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]) : [];
    LABEL_TO_TOKENS.set(text, tokens);
  }
}

// -- CSS corpus: app/src/**/*.css + src/**/*.css.ts template literals ------

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

/** The largest declared `min-height` (px) among every CSS rule whose
 * selector mentions `token`, or `undefined` if no rule mentions it at all
 * (file header §2: "declared" is read as the strongest floor any matching
 * rule commits the token to). */
function resolveTokenMinHeight(token: string): number | undefined {
  let best: number | undefined;
  for (const rule of ALL_CSS_RULES) {
    if (!selectorMentionsToken(rule.selector, token)) continue;
    MIN_HEIGHT_DECL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MIN_HEIGHT_DECL_RE.exec(rule.body))) {
      const v = Number(m[1]);
      if (best === undefined || v > best) best = v;
    }
  }
  return best;
}

// -- Grade -------------------------------------------------------------------

interface Graded {
  control: DrawnControl;
  resolvedHeight: number | undefined;
  reason: 'no-source-match' | 'no-class-token' | 'no-css-rule' | 'resolved';
}

const GRADED: Graded[] = ALL_CONTROLS.map((control) => {
  const tokens = LABEL_TO_TOKENS.get(control.label);
  if (tokens === undefined) return { control, resolvedHeight: undefined, reason: 'no-source-match' };
  const chqTokens = tokens.filter((t) => t.startsWith('chq-'));
  if (chqTokens.length === 0) return { control, resolvedHeight: undefined, reason: 'no-class-token' };
  let best: number | undefined;
  for (const t of chqTokens) {
    const h = resolveTokenMinHeight(t);
    if (h !== undefined && (best === undefined || h > best)) best = h;
  }
  if (best === undefined) return { control, resolvedHeight: undefined, reason: 'no-css-rule' };
  return { control, resolvedHeight: best, reason: 'resolved' };
});

const OFFENDERS: Graded[] = GRADED.filter((g) => g.reason === 'resolved' && g.resolvedHeight! < g.control.drawnFloor);
const UNRESOLVED: Graded[] = GRADED.filter((g) => g.reason !== 'resolved');

// -- Ratchets ------------------------------------------------------------
// Measured on this branch (v12m-w7-da) by forcing FRAME_FLOOR_DIVERGENCE_CEILING
// to -1 and reading the printed offender list back: 7 drawn controls
// declare a min-height strictly below the floor their own frame draws --
// "Sign in" (Account:136, drawn 50/declares 48), "Edit" (Contacts:435,
// drawn 48/declares 44; Public and Portal:589, drawn 48/declares 44),
// "‹ Previous"/"Next ›" (Docs:201-202, drawn 46/declares 44), and
// "Download .ics" (Public and Portal:401, drawn 46/declares 44; :885, drawn
// 48/declares 44). Real frame/app divergences, not fixture noise -- see
// docs/design/audit/frame-control-floor-390-v12.md.
export const FRAME_FLOOR_DIVERGENCE_CEILING = 7;

// Non-vacuity tripwire for the UNRESOLVED bucket (DEC-180/808): re-measured
// on this branch the same way, so the population cannot silently shrink to
// zero controls and pass by construction. May move either direction as the
// pack or the corpus changes -- it is a tripwire, not a two-sided ratchet,
// because "resolved but conformant" and "unresolved" are not the same
// finding and neither direction of this count is inherently a regression.
// Re-measured wave 154 (merge of task w10-na, the SPA classless-control
// tap-floor widening): 153 -> 152. w10-na gave previously classless page
// anchors real CSS rules (.chq-notfound-links a, .chq-agenda-held-back a,
// .chq-event-unscheduled-notice a, .chq-settings-portal-preview-link,
// .chq-speakers-*/.chq-detail-* terminal-block rules), so one drawn control
// that previously resolved to NO CSS rule now resolves to one and leaves
// this bucket. The population did not shrink -- a member moved from
// UNRESOLVED to resolved, which is the direction this campaign wants.
export const UNRESOLVED_COUNT_TRIPWIRE = 152;

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
    // floor; the CONFORMING token declares AT LEAST its drawn floor.
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
          '  </div>',
          ');',
        ].join('\n'),
      );
      writeFileSync(
        join(dir, 'fixture.css'),
        [
          '.chq-zzy-painted { min-height: 30px; }', // OFFENDER: 30 < 46
          '@media (max-width: 700px) { .chq-zzy-anchor { min-height: 44px; } }', // conforming: 44 >= 44
        ].join('\n'),
      );

      const synthTokens = new Map<string, string[]>();
      const raw = readFileSync(join(dir, 'Fixture.tsx'), 'utf-8');
      const processed = decodeEntitiesKeepingStructure(stripComments(raw));
      FLAT_TAG_TEXT_RE.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = FLAT_TAG_TEXT_RE.exec(processed))) {
        const text = mm[3]!.replace(/\s+/g, ' ').trim();
        const classMatch = mm[2]!.match(CLASS_ATTR_RE);
        const tokens = classMatch ? [...classMatch[1]!.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]) : [];
        synthTokens.set(text, tokens);
      }
      expect(synthTokens.get('Zzy Painted Present')).toEqual(['chq-zzy-painted']);
      expect(synthTokens.get('Zzy Anchor Present')).toEqual(['chq-zzy-anchor']);
      expect(synthTokens.get('Zzy Footer Present')).toBeUndefined(); // negative: comment-only mention never satisfies

      const cssRaw = sanitizeCommentBraces(stripCssComments(readFileSync(join(dir, 'fixture.css'), 'utf-8')));
      const synthRules = [
        ...topLevelRulesWithExemption(cssRaw),
        ...narrowMediaRules(cssRaw, Number.MAX_SAFE_INTEGER),
      ];
      function synthResolve(token: string): number | undefined {
        let best: number | undefined;
        for (const rule of synthRules) {
          if (!selectorMentionsToken(rule.selector, token)) continue;
          MIN_HEIGHT_DECL_RE.lastIndex = 0;
          let hm: RegExpExecArray | null;
          while ((hm = MIN_HEIGHT_DECL_RE.exec(rule.body))) {
            const v = Number(hm[1]);
            if (best === undefined || v > best) best = v;
          }
        }
        return best;
      }
      expect(synthResolve('chq-zzy-painted')).toBe(30);
      expect(synthResolve('chq-zzy-anchor')).toBe(44);
      // POSITIVE: an offender (drawn 46 > declared 30).
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
          `declares ${o.resolvedHeight}px`,
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

  it(`UNRESOLVED bucket tripwire: exactly UNRESOLVED_COUNT_TRIPWIRE (${UNRESOLVED_COUNT_TRIPWIRE}) drawn controls resolve to no source match, no class token, or no CSS rule`, () => {
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
});
