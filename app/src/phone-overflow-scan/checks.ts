// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): the flagged-shape detectors
// (A)-(D) from that file's header comment. `checkWidthProps` and
// `checkGridTemplateColumns` take `budgetPx` explicitly (rather than
// closing over a module-level constant) so this module has no import-order
// dependency on how the caller derives its budget.
import { countOf } from '../lib/plural';
import type { Rule } from './rules';
// DEC-957/DEC-987: the diagnostic below is a count phrase, so it goes
// through the ONE count vocabulary like every other one, never a
// hand-rolled "(s)" -- DEC-374's wave-147 ruling names this exact literal
// as the single genuine offender that survives comment-stripping and says
// it must be reworded rather than exempted.
import { countOf } from '../lib/plural';

export function checkWidthProps(body: string, budgetPx: number): string[] {
  const hits: string[] = [];
  const re = /(?:^|;)\s*(width|min-width|flex-basis)\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const px = Number(m[2]);
    if (px > budgetPx) hits.push(`${m[1]}: ${px}px exceeds budget ${budgetPx}px`);
  }
  return hits;
}

export function checkGridTemplateColumns(body: string, budgetPx: number): string[] {
  const gtc = body.match(/grid-template-columns\s*:\s*([^;]+);/);
  if (!gtc) return [];
  const tracks = gtc[1]?.match(/\d+(?:\.\d+)?px/g) ?? [];
  if (tracks.length === 0) return [];
  const trackSum = tracks.reduce((sum, t) => sum + Number(t.replace('px', '')), 0);
  const gapMatch = body.match(/(?:^|;)\s*(?:column-)?gap\s*:\s*(\d+(?:\.\d+)?)px/);
  const gapPx = gapMatch ? Number(gapMatch[1]) * Math.max(0, tracks.length - 1) : 0;
  const total = trackSum + gapPx;
  if (total > budgetPx) {
    return [`grid-template-columns fixed tracks ${trackSum}px + gaps ${gapPx}px = ${total}px exceeds budget ${budgetPx}px`];
  }
  return [];
}

/**
 * (E) DEC-919 (wave-149 amendment): a grid's flexible track(s) must never
 * receive LESS room at the 390 budget than the grid's own widest fixed
 * track -- "the yielding column is never the minority partner of a rail it
 * flanks". The floor is DERIVED from the grid's own declarations, never a
 * magic pixel constant, so the rule reads as a principle and survives every
 * token change.
 *
 * Population gate (load-bearing): fires unless the EFFECTIVE `display` of
 * `body` -- the last `display:` declaration present, cascade-merged already
 * by the caller for a top-level rule -- is EXPLICITLY something other than
 * `grid`/`inline-grid`. A `grid-template-columns` sitting under an
 * effective display that a cascade override has actually turned into
 * `flex`/`none` at 390 is inert and MUST NOT be flagged; measured on this
 * tree, `.chq-settings-row`, `.chq-settings-saved-embed-row`,
 * `.chq-review-queue-row` and `.chq-contacts-merge-compare-head` all
 * declare `display: grid` at top level and a SAME-selector phone override
 * that collapses to `display: flex` or `display: none`, and stay clean
 * under this gate. A rule that declares `grid-template-columns` but no
 * `display` at all in its own body -- a BEM-style modifier selector
 * co-classed in markup with a base selector that carries the real
 * `display: grid` (`.chq-settings-track-edit-row` beside
 * `.chq-settings-edit-row`, the same relationship this check's gap
 * conservatism already documents) -- is NOT excluded: this scan reasons
 * per-selector, never joins two selectors' declarations by markup
 * co-classing, so "no override says otherwise" is the correctly
 * conservative default, not "assume it is inert".
 *
 * Grammar: `grid-template-columns` must declare >= 2 tracks, each either a
 * fixed `Npx` track or a flexible track (`Nfr`, or `minmax(_, Nfr)`).
 * `repeat(...)` is out of grammar -- skipped, not guessed at -- and any
 * other track shape (`auto`, `%`, a bare `minmax()` without a trailing
 * `fr`, ...) takes the whole rule out of grammar too, per this check's
 * house rule of under-reporting rather than ever over-reporting on a shape
 * it cannot parse with confidence.
 *
 * Gap attribution is DELIBERATELY conservative: `gap`/`column-gap` is read
 * only from `body` itself (the rule's own -- or, for a merged top-level
 * rule, its own plus any phone override's -- declarations), never from a
 * co-classed BASE selector's gap (e.g. `.chq-settings-edit-row`'s
 * `gap: 16px` is never attributed to `.chq-settings-track-edit-row`, whose
 * real on-screen consumption is therefore 382px of a 358px budget, not the
 * 366px this check computes). The check under-reports; it never
 * over-reports.
 */
export function checkStarvedFlexTrack(body: string, budgetPx: number): string[] {
  const displayMatches = [...body.matchAll(/(?:^|;)\s*display\s*:\s*([a-zA-Z-]+)/g)];
  if (displayMatches.length > 0) {
    const effectiveDisplay = displayMatches[displayMatches.length - 1]![1];
    if (effectiveDisplay !== 'grid' && effectiveDisplay !== 'inline-grid') return []; // explicitly turned into something else -- inert
  } // else: no display declared anywhere in this rule's effective body -- no override says this grid-template-columns is inert, so it stays a candidate

  const gtcMatches = [...body.matchAll(/grid-template-columns\s*:\s*([^;]+);/g)];
  if (gtcMatches.length === 0) return [];
  const declared = gtcMatches[gtcMatches.length - 1]![1]!.trim();
  if (/repeat\s*\(/.test(declared)) return []; // out of grammar, deliberately not guessed at

  const tracks = splitTracks(declared);
  if (tracks.length < 2) return [];

  let fixedSum = 0;
  let widestFixedTrackPx = 0;
  let flexTrackCount = 0;
  for (const track of tracks) {
    const fixedMatch = track.match(/^(\d+(?:\.\d+)?)px$/);
    if (fixedMatch) {
      const px = Number(fixedMatch[1]);
      fixedSum += px;
      widestFixedTrackPx = Math.max(widestFixedTrackPx, px);
      continue;
    }
    if (/^\d+(?:\.\d+)?fr$/.test(track) || /^minmax\(\s*[^,]+,\s*\d+(?:\.\d+)?fr\s*\)$/.test(track)) {
      flexTrackCount += 1;
      continue;
    }
    return []; // an unrecognised track shape takes the whole rule out of grammar
  }
  if (flexTrackCount === 0 || widestFixedTrackPx === 0) return []; // needs at least one fixed AND one flexible track

  const gapMatch = [...body.matchAll(/(?:^|;)\s*(?:column-)?gap\s*:\s*(\d+(?:\.\d+)?)px/g)];
  const gapPx = gapMatch.length > 0 ? Number(gapMatch[gapMatch.length - 1]![1]) * (tracks.length - 1) : 0;

  const perFlexTrackPx = (budgetPx - fixedSum - gapPx) / flexTrackCount;
  if (perFlexTrackPx < widestFixedTrackPx) {
    return [
      // DEC-374/DEC-987: routed through the one count-phrase vocabulary
      // (app/src/lib/plural.ts's countOf, DEC-957) instead of a raw
      // '(s)' parenthetical -- the last genuine offender the ratchet
      // found, reworded rather than exempted; the diagnostic still names
      // the budget, the fixed sum, the gaps, and the track count.
      `grid-template-columns yields ${perFlexTrackPx.toFixed(1)}px per flexible track ` +
        `((budget ${budgetPx}px - fixed ${fixedSum}px - gaps ${gapPx}px) / ${countOf(flexTrackCount, 'track')}), ` +
        `below its own widest fixed track ${widestFixedTrackPx}px -- a starved re-line`,
    ];
  }
  return [];
}

/** Splits a `grid-template-columns` value into tracks on whitespace NOT nested inside parens (so `minmax(0, 1fr)` stays one token). */
function splitTracks(value: string): string[] {
  const tracks: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) tracks.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) tracks.push(cur);
  return tracks;
}

export function checkNowrap(body: string): string[] {
  if (!/white-space\s*:\s*nowrap/.test(body)) return [];
  const hasEscape = /(?:overflow(?:-x)?\s*:\s*(?:hidden|auto|scroll))|(?:text-overflow\s*:\s*ellipsis)/.test(body);
  return hasEscape ? [] : ['white-space: nowrap with no overflow/text-overflow escape in the same rule'];
}

export function baseToken(selector: string): string {
  // First comma part, first compound token (drop pseudo-classes/descendant chains).
  return (selector.split(',')[0] ?? '').trim().split(/\s+/)[0]?.split(':')[0] ?? '';
}

export function checkTableLayout(rule: Rule, fileRules: Rule[]): string[] {
  if (!/table-layout\s*:\s*fixed/.test(rule.body)) return [];
  const base = baseToken(rule.selector);
  if (!base) return [];
  const columnSelectors = fileRules.filter(
    (r) => baseToken(r.selector) === base && /:(?:first-child|last-child|nth-child\(\d+\))/.test(r.selector),
  );
  const distinctColumns = new Set(columnSelectors.map((r) => r.selector));
  if (distinctColumns.size <= 2) return [];
  const hasPhoneReflow = fileRules.some(
    (r) =>
      r.isPhoneScoped &&
      baseToken(r.selector) === base &&
      (/display\s*:\s*(?:block|contents)/.test(r.body) || /table-layout\s*:\s*auto/.test(r.body)),
  );
  if (hasPhoneReflow) return [];
  return [
    `table-layout: fixed on ${base} with ${distinctColumns.size} declared columns, no phone reflow (display:block|contents or table-layout:auto) for the same base`,
  ];
}

export function runChecks(rule: Rule, fileRules: Rule[], budgetPx: number): string[] {
  return [
    ...checkWidthProps(rule.body, budgetPx),
    ...checkGridTemplateColumns(rule.body, budgetPx),
    ...checkNowrap(rule.body),
    ...checkTableLayout(rule, fileRules),
  ];
}
