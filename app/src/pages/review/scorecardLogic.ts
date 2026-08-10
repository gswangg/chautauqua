// Pure scorecard helpers: completeness check + keyboard-fast input mapping
// (number keys 1-9 set the focused rating; Enter submits and advances).
import type { EvaluationCriterion, EvaluationScale, EvaluationScores } from './types';

/** True once every criterion in the plan has a valid entry in `scores`. */
export function isEvaluationComplete(criteria: EvaluationCriterion[], scores: EvaluationScores): boolean {
  return criteria.every((c) => {
    const v = scores[c.id];
    if (v === undefined || v === null || v === '') return false;
    if (c.kind === 'rating') return typeof v === 'number' && !Number.isNaN(v);
    return typeof v === 'string' && (c.options ?? []).includes(v);
  });
}

export function clampRating(value: number, scale: EvaluationScale): number {
  return Math.min(scale.max, Math.max(scale.min, value));
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
