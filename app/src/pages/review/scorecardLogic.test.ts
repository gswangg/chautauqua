import { describe, expect, it } from 'vitest';
import { clampRating, incompleteCriteria, isEvaluationComplete, plainAverage, scorecardKeyAction } from './scorecardLogic';
import type { EvaluationCriterion, EvaluationScores } from './types';

const criteria: EvaluationCriterion[] = [
  { id: 'quality', label: 'Quality', kind: 'rating', weight: 2 },
  { id: 'fit', label: 'Format fit', kind: 'dropdown', options: ['Yes', 'No'] },
];

describe('isEvaluationComplete', () => {
  it('is false when a criterion has no entry', () => {
    expect(isEvaluationComplete(criteria, { quality: 4 })).toBe(false);
  });

  it('is false when a dropdown value is not one of its options', () => {
    const scores: EvaluationScores = { quality: 4, fit: 'Maybe' };
    expect(isEvaluationComplete(criteria, scores)).toBe(false);
  });

  it('is true when every criterion has a valid entry', () => {
    const scores: EvaluationScores = { quality: 4, fit: 'Yes' };
    expect(isEvaluationComplete(criteria, scores)).toBe(true);
  });
});

describe('isEvaluationComplete (DEC-148 text criteria)', () => {
  const withText: EvaluationCriterion[] = [
    { id: 'quality', label: 'Quality', kind: 'rating', weight: 2 },
    { id: 'notes', label: 'Notes', kind: 'text' },
    { id: 'flag', label: 'Escalation reason', kind: 'text', required: true },
  ];

  it('is true when an optional text criterion is an empty string', () => {
    const scores: EvaluationScores = { quality: 4, notes: '', flag: 'reason' };
    expect(isEvaluationComplete(withText, scores)).toBe(true);
  });

  it('is false when a required text criterion is an empty string', () => {
    const scores: EvaluationScores = { quality: 4, notes: '', flag: '' };
    expect(isEvaluationComplete(withText, scores)).toBe(false);
  });

  it('is false when a required text criterion is whitespace-only', () => {
    const scores: EvaluationScores = { quality: 4, notes: '', flag: '   ' };
    expect(isEvaluationComplete(withText, scores)).toBe(false);
  });

  it('is false when a text criterion has no entry at all', () => {
    const scores: EvaluationScores = { quality: 4, flag: 'reason' };
    expect(isEvaluationComplete(withText, scores)).toBe(false);
  });
});

describe('clampRating', () => {
  it('clamps to the scale bounds', () => {
    expect(clampRating(9, { min: 1, max: 5 })).toBe(5);
    expect(clampRating(0, { min: 1, max: 5 })).toBe(1);
    expect(clampRating(3, { min: 1, max: 5 })).toBe(3);
  });
});

describe('plainAverage', () => {
  it('computes the unweighted mean to full precision (rounded at render, not here)', () => {
    expect(plainAverage([5, 4, 4])).toBeCloseTo(4.333333, 5);
    expect(plainAverage([5, 4, 4]).toFixed(2)).toBe('4.33');
  });

  it('handles a single value', () => {
    expect(plainAverage([3])).toBe(3);
  });

  it('throws rather than silently returning NaN for an empty list', () => {
    expect(() => plainAverage([])).toThrow();
  });
});

describe('scorecardKeyAction', () => {
  const scale = { min: 1, max: 5 };
  const ratingCriterion = criteria[0]!;
  const dropdownCriterion = criteria[1]!;

  it('maps a digit key to a clamped rating on the focused rating criterion', () => {
    expect(scorecardKeyAction('9', ratingCriterion, scale, { fromFormField: false })).toEqual({
      type: 'setRating',
      criterionId: 'quality',
      value: 5,
    });
  });

  it('does nothing for a digit key when the focused criterion is a dropdown', () => {
    expect(scorecardKeyAction('3', dropdownCriterion, scale, { fromFormField: false })).toEqual({ type: 'none' });
  });

  it('does nothing for a digit key with no focused criterion', () => {
    expect(scorecardKeyAction('3', null, scale, { fromFormField: false })).toEqual({ type: 'none' });
  });

  it('maps Enter to submit-and-advance regardless of focus', () => {
    expect(scorecardKeyAction('Enter', null, scale, { fromFormField: false })).toEqual({ type: 'submitAndAdvance' });
  });

  it('ignores non-digit, non-Enter keys', () => {
    expect(scorecardKeyAction('a', ratingCriterion, scale, { fromFormField: false })).toEqual({ type: 'none' });
  });

  // DEC-939 (wave-3 amendment): a page-level key handler never fires from a
  // form field -- both the digit-to-rating and Enter-to-submit paths must
  // yield 'none' when the originating event target is a real form control.
  it('yields none for a digit key when fromFormField is true, even with a focused rating criterion', () => {
    expect(scorecardKeyAction('4', ratingCriterion, scale, { fromFormField: true })).toEqual({ type: 'none' });
  });

  it('yields none for Enter when fromFormField is true', () => {
    expect(scorecardKeyAction('Enter', ratingCriterion, scale, { fromFormField: true })).toEqual({ type: 'none' });
  });
});

// DEC-939 (wave-3 amendment): incompleteCriteria is the ONE predicate --
// isEvaluationComplete is its zero-length case, never a second definition.
describe('incompleteCriteria', () => {
  it('lists the criteria with no entry', () => {
    expect(incompleteCriteria(criteria, { quality: 4 })).toEqual([criteria[1]]);
  });

  it('lists a dropdown criterion whose value is not one of its options', () => {
    const scores: EvaluationScores = { quality: 4, fit: 'Maybe' };
    expect(incompleteCriteria(criteria, scores)).toEqual([criteria[1]]);
  });

  it('is empty when every criterion has a valid entry', () => {
    const scores: EvaluationScores = { quality: 4, fit: 'Yes' };
    expect(incompleteCriteria(criteria, scores)).toEqual([]);
  });

  it('lists every still-missing criterion, in criteria order', () => {
    expect(incompleteCriteria(criteria, {})).toEqual([criteria[0], criteria[1]]);
  });

  it('agrees with isEvaluationComplete: complete iff nothing is incomplete', () => {
    const scores: EvaluationScores = { quality: 4, fit: 'Yes' };
    expect(isEvaluationComplete(criteria, scores)).toBe(incompleteCriteria(criteria, scores).length === 0);
    expect(isEvaluationComplete(criteria, {})).toBe(incompleteCriteria(criteria, {}).length === 0);
  });
});
