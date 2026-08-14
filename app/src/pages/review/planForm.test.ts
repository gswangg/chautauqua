import { describe, expect, it } from 'vitest';
import {
  addCriterion,
  isPlanDraftValid,
  removeCriterion,
  totalRatingWeight,
  updateCriterion,
  validateCriteriaList,
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

  it('adds a free-text criterion defaulting to not required (DEC-148)', () => {
    const criteria = addCriterion([], 'text');
    expect(criteria[0]).toMatchObject({ kind: 'text', required: false, label: '' });
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

describe('validateCriteriaList (DEC-147/DEC-148, used for round overrides)', () => {
  it('is valid for a well-formed mix including a text criterion', () => {
    const criteria: EvaluationCriterion[] = [
      { id: 'c1', label: 'Quality', kind: 'rating', weight: 2 },
      { id: 'c2', label: 'Escalation reason', kind: 'text', required: true },
    ];
    expect(validateCriteriaList(criteria)).toEqual({});
  });

  it('requires a label on a text criterion like any other kind', () => {
    const criteria: EvaluationCriterion[] = [{ id: 'c1', label: '', kind: 'text' }];
    const errors = validateCriteriaList(criteria);
    expect(errors['criterion.c1.label']).toBeDefined();
  });

  it('does not require a weight or options for a text criterion', () => {
    const criteria: EvaluationCriterion[] = [{ id: 'c1', label: 'Notes', kind: 'text' }];
    expect(validateCriteriaList(criteria)).toEqual({});
  });

  it('requires at least one criterion in the list', () => {
    expect(validateCriteriaList([]).criteria).toBeDefined();
  });

  it('matches validatePlanDraft criteria-shape errors for the base list', () => {
    const criteria: EvaluationCriterion[] = [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 0 }];
    const draftErrors = validatePlanDraft({ ...DEFAULT_PLAN_DRAFT, name: 'Plan', criteria });
    const listErrors = validateCriteriaList(criteria);
    expect(draftErrors['criterion.c1.weight']).toEqual(listErrors['criterion.c1.weight']);
  });
});

// DEC-124 amendment: the client mirrors the server's DEC-509 checkEpochOrder
// (src/routes/review/shared.ts) so the SPA never posts a shape the server
// will reject.
describe('validatePlanDraft cross-field date rule (DEC-124 amendment)', () => {
  const validCriteria: EvaluationCriterion[] = [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }];

  it('allows equal open/close dates', () => {
    const openAt = Date.UTC(2027, 8, 2);
    const errors = validatePlanDraft(draft({ name: 'Plan', criteria: validCriteria, openAt, closeAt: openAt }));
    expect(errors.closeAt).toBeUndefined();
  });

  it('flags a close date before the open date, naming the open date', () => {
    const openAt = Date.UTC(2027, 8, 2); // 2 Sep 2027
    const closeAt = Date.UTC(2027, 7, 20); // 20 Aug 2027
    const errors = validatePlanDraft(draft({ name: 'Plan', criteria: validCriteria, openAt, closeAt }));
    expect(errors.closeAt).toBe('This is before the plan opens. Pick a date after 2 Sep 2027.');
  });

  it('does not fire when either side is unset', () => {
    const openAt = Date.UTC(2027, 8, 2);
    expect(validatePlanDraft(draft({ name: 'Plan', criteria: validCriteria, openAt, closeAt: null })).closeAt).toBeUndefined();
    expect(
      validatePlanDraft(draft({ name: 'Plan', criteria: validCriteria, openAt: null, closeAt: Date.UTC(2020, 0, 1) })).closeAt,
    ).toBeUndefined();
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
