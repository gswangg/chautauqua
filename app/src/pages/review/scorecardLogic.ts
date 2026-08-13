// Pure scorecard helpers: completeness check + keyboard-fast input mapping
// (number keys 1-9 set the focused rating; Enter submits and advances).
import type { EvaluationCriterion, EvaluationScale, EvaluationScores } from './types';

/** True once every criterion in the plan has a valid entry in `scores`.
 * DEC-148: a 'text' criterion is complete once its value is a string --
 * required ones must be non-empty, optional ones may be ''. */
export function isEvaluationComplete(criteria: EvaluationCriterion[], scores: EvaluationScores): boolean {
  return criteria.every((c) => {
    const v = scores[c.id];
    if (c.kind === 'text') {
      if (typeof v !== 'string') return false;
      return c.required ? v.trim().length > 0 : true;
    }
    if (v === undefined || v === null || v === '') return false;
    if (c.kind === 'rating') return typeof v === 'number' && !Number.isNaN(v);
    return typeof v === 'string' && (c.options ?? []).includes(v);
  });
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

export type ScorecardKeyAction =
  | { type: 'setRating'; criterionId: string; value: number }
  | { type: 'submitAndAdvance' }
  | { type: 'none' };

/**
 * Keyboard-fast scorecard input: number keys 1-9 set the focused rating
 * criterion's score (clamped to the plan scale); Enter submits and
 * advances. Pure so it's testable without simulating real DOM key events.
 */
export function scorecardKeyAction(
  key: string,
  focusedCriterion: EvaluationCriterion | null,
  scale: EvaluationScale,
): ScorecardKeyAction {
  if (key === 'Enter') {
    return { type: 'submitAndAdvance' };
  }
  if (/^[1-9]$/.test(key) && focusedCriterion !== null && focusedCriterion.kind === 'rating') {
    const value = clampRating(Number(key), scale);
    return { type: 'setRating', criterionId: focusedCriterion.id, value };
  }
  return { type: 'none' };
}
