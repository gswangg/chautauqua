import { describe, expect, it } from 'vitest';
import { clampRating, isEvaluationComplete, scorecardKeyAction } from './scorecardLogic';
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

describe('scorecardKeyAction', () => {
  const scale = { min: 1, max: 5 };
  const ratingCriterion = criteria[0]!;
  const dropdownCriterion = criteria[1]!;

  it('maps a digit key to a clamped rating on the focused rating criterion', () => {
    expect(scorecardKeyAction('9', ratingCriterion, scale)).toEqual({
      type: 'setRating',
      criterionId: 'quality',
      value: 5,
    });
  });

  it('does nothing for a digit key when the focused criterion is a dropdown', () => {
    expect(scorecardKeyAction('3', dropdownCriterion, scale)).toEqual({ type: 'none' });
  });

  it('does nothing for a digit key with no focused criterion', () => {
    expect(scorecardKeyAction('3', null, scale)).toEqual({ type: 'none' });
  });

  it('maps Enter to submit-and-advance regardless of focus', () => {
    expect(scorecardKeyAction('Enter', null, scale)).toEqual({ type: 'submitAndAdvance' });
  });

  it('ignores non-digit, non-Enter keys', () => {
    expect(scorecardKeyAction('a', ratingCriterion, scale)).toEqual({ type: 'none' });
  });
});
