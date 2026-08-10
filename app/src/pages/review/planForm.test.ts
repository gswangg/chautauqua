import { describe, expect, it } from 'vitest';
import {
  addCriterion,
  isPlanDraftValid,
  removeCriterion,
  totalRatingWeight,
  updateCriterion,
  validatePlanDraft,
} from './planForm';
import { DEFAULT_PLAN_DRAFT, type EvaluationCriterion, type PlanDraft } from './types';

function draft(overrides: Partial<PlanDraft> = {}): PlanDraft {
  return { ...DEFAULT_PLAN_DRAFT, ...overrides };
}

describe('addCriterion / removeCriterion / updateCriterion', () => {
  it('adds a rating criterion with a default positive weight', () => {
    const criteria = addCriterion([], 'rating');
    expect(criteria).toHaveLength(1);
    expect(criteria[0]).toMatchObject({ kind: 'rating', weight: 1, label: '' });
  });

  it('adds a dropdown criterion with empty options', () => {
    const criteria = addCriterion([], 'dropdown');
    expect(criteria[0]).toMatchObject({ kind: 'dropdown', options: [] });
  });

  it('removes a criterion by id', () => {
    const criteria = addCriterion(addCriterion([], 'rating'), 'dropdown');
    const id = criteria[0]!.id;
    const next = removeCriterion(criteria, id);
    expect(next).toHaveLength(1);
    expect(next.find((c) => c.id === id)).toBeUndefined();
  });

  it('updates a criterion by id without mutating the input', () => {
    const criteria = addCriterion([], 'rating');
    const id = criteria[0]!.id;
    const next = updateCriterion(criteria, id, { label: 'Novelty', weight: 3 });
    expect(next[0]).toMatchObject({ label: 'Novelty', weight: 3 });
    expect(criteria[0]).toMatchObject({ label: '' });
  });
});

describe('validatePlanDraft', () => {
  it('requires a name', () => {
    const errors = validatePlanDraft(draft({ criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }] }));
    expect(errors.name).toBeDefined();
  });

  it('requires scale.max > scale.min', () => {
    const errors = validatePlanDraft(
      draft({
        name: 'Plan',
        scale: { min: 5, max: 5 },
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
      }),
    );
    expect(errors.scale).toBeDefined();
  });

  it('requires at least one criterion', () => {
    const errors = validatePlanDraft(draft({ name: 'Plan', criteria: [] }));
    expect(errors.criteria).toBeDefined();
  });

  it('requires a positive weight on rating criteria', () => {
    const criteria: EvaluationCriterion[] = [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 0 }];
    const errors = validatePlanDraft(draft({ name: 'Plan', criteria }));
    expect(errors['criterion.c1.weight']).toBeDefined();
  });

  it('requires at least one option on dropdown criteria', () => {
    const criteria: EvaluationCriterion[] = [{ id: 'c1', label: 'Format fit', kind: 'dropdown', options: [] }];
    const errors = validatePlanDraft(draft({ name: 'Plan', criteria }));
    expect(errors['criterion.c1.options']).toBeDefined();
  });

  it('is valid for a well-formed draft', () => {
    const d = draft({
      name: 'Track A review',
      criteria: [
        { id: 'c1', label: 'Quality', kind: 'rating', weight: 2 },
        { id: 'c2', label: 'Format fit', kind: 'dropdown', options: ['Yes', 'No'] },
      ],
    });
    expect(validatePlanDraft(d)).toEqual({});
    expect(isPlanDraftValid(d)).toBe(true);
  });

  it('rejects rounds below 1 and a non-positive max-evaluations cap', () => {
    const d = draft({
      name: 'Plan',
      rounds: 0,
      maxEvaluationsPerSubmission: 0,
      criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
    });
    const errors = validatePlanDraft(d);
    expect(errors.rounds).toBeDefined();
    expect(errors.maxEvaluationsPerSubmission).toBeDefined();
  });
});

describe('totalRatingWeight', () => {
  it('sums only rating-criterion weights, ignoring dropdown criteria', () => {
    const criteria: EvaluationCriterion[] = [
      { id: 'c1', label: 'Quality', kind: 'rating', weight: 2 },
      { id: 'c2', label: 'Depth', kind: 'rating', weight: 3 },
      { id: 'c3', label: 'Format fit', kind: 'dropdown', options: ['Yes', 'No'] },
    ];
    expect(totalRatingWeight(criteria)).toBe(5);
  });
});
