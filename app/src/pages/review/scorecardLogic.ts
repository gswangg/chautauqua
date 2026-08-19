// Pure scorecard helpers: completeness check + keyboard-fast input mapping
// (number keys 1-9 set the focused rating; Enter submits and advances).
import type { EvaluationCriterion, EvaluationScale, EvaluationScores } from './types';
// DEC-939 (wave-85 amendment, task w3-g): the phone unscored banner's copy
// reuses the ONE count-phrase vocabulary (src/domain/count-copy.ts) rather
// than hand-typing "One"/"three" -- the same module app/src/lib/plural.ts
// already re-exports for every other SPA count phrase.
import { capitalizeFirst, plural, spellCount } from '../../../../src/domain/count-copy';

/** DEC-939 (wave-3 amendment): ONE predicate for scorecard completeness --
 * the validator, the incomplete notice, and the rail's per-criterion
 * markers all read this same list; isEvaluationComplete is its zero-length
 * case, never a second definition. DEC-148: a 'text' criterion is complete
 * once its value is a string -- required ones must be non-empty, optional
 * ones may be ''. */
export function incompleteCriteria(criteria: EvaluationCriterion[], scores: EvaluationScores): EvaluationCriterion[] {
  return criteria.filter((c) => {
    const v = scores[c.id];
    if (c.kind === 'text') {
      if (typeof v !== 'string') return true;
      return c.required ? v.trim().length === 0 : false;
    }
    if (v === undefined || v === null || v === '') return true;
    if (c.kind === 'rating') return !(typeof v === 'number' && !Number.isNaN(v));
    return !(typeof v === 'string' && (c.options ?? []).includes(v));
  });
}

/** True once every criterion in the plan has a valid entry in `scores`. */
export function isEvaluationComplete(criteria: EvaluationCriterion[], scores: EvaluationScores): boolean {
  return incompleteCriteria(criteria, scores).length === 0;
}

export function clampRating(value: number, scale: EvaluationScale): number {
  return Math.min(scale.max, Math.max(scale.min, value));
}

/** DEC-873: the rating control is a segmented row of buttons, one per
 * integer in [scale.min, scale.max] -- this is the single source for that
 * range so the radiogroup's rendered buttons and any keyboard-fast path
 * agree on which values exist. */
export function ratingScaleValues(scale: EvaluationScale): number[] {
  const values: number[] = [];
  for (let v = scale.min; v <= scale.max; v++) values.push(v);
  return values;
}

/** DEC-939 reconciliation line: a plain (unweighted) mean of the same
 * per-criterion rating values the weighted blend (computeWeightedScore)
 * reads, in the same criterion order -- never re-derives or touches the
 * weighted math itself, just gives the reviewer the un-weighted comparison
 * figure alongside it. */
export function plainAverage(values: number[]): number {
  if (values.length === 0) throw new Error('plainAverage requires at least one value');
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** DEC-939 (wave-85 amendment, task w3-g): the phone scorecard's unscored
 * banner (docs/design/Chautauqua Review.dc.html:934-1138, "a criterion
 * unscored") is a LIVE, always-on card -- unlike the desktop rail's
 * `showIncompleteNotice`, it is never gated behind an attempted submit.
 * Reads the SAME incompleteCriteria predicate every other completeness
 * surface on this page reads, so it can never disagree with the rail's
 * per-criterion markers or the submit/save validators. Returns null once
 * every criterion is scored -- the caller renders nothing then, never an
 * empty card. The denominator is the criterion COUNT (matching the frame's
 * "until all three are scored" -- every criterion kind, Choice included,
 * since a Choice pick is still required even though it is not averaged),
 * not the rating-only subset computeWeightedScore blends. */
export function unscoredBannerCopy(
  criteria: EvaluationCriterion[],
  scores: EvaluationScores,
): { heading: string; body: string } | null {
  const incomplete = incompleteCriteria(criteria, scores);
  if (incomplete.length === 0) return null;
  const n = incomplete.length;
  return {
    heading: `${capitalizeFirst(spellCount(n))} ${plural(n, 'criterion', 'criteria')} still ${plural(n, 'needs', 'need')} a score`,
    body: `The weighted total cannot be worked out until all ${spellCount(criteria.length)} are scored.`,
  };
}

export type ScorecardKeyAction =
  | { type: 'setRating'; criterionId: string; value: number }
  | { type: 'submitAndAdvance' }
  | { type: 'none' };

/**
 * Keyboard-fast scorecard input: number keys 1-9 set the focused rating
 * criterion's score (clamped to the plan scale); Enter submits and
 * advances. Pure so it's testable without simulating real DOM key events.
 *
 * DEC-939 (wave-3 amendment): these are page-level shortcuts, not field
 * behaviour -- `opts.fromFormField` is true whenever the originating event
 * target is a real input/textarea/select/[contenteditable] (typing a
 * comment, choosing a dropdown value), and in that case this always
 * returns 'none' so digits and Enter reach the field instead of being
 * hijacked into a rating change or a premature submit.
 */
export function scorecardKeyAction(
  key: string,
  focusedCriterion: EvaluationCriterion | null,
  scale: EvaluationScale,
  opts: { fromFormField: boolean },
): ScorecardKeyAction {
  if (opts.fromFormField) {
    return { type: 'none' };
  }
  if (key === 'Enter') {
    return { type: 'submitAndAdvance' };
  }
  if (/^[1-9]$/.test(key) && focusedCriterion !== null && focusedCriterion.kind === 'rating') {
    const value = clampRating(Number(key), scale);
    return { type: 'setRating', criterionId: focusedCriterion.id, value };
  }
  return { type: 'none' };
}
