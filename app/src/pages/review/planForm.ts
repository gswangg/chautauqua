// Pure helpers for the plan editor's criteria editor and validation
// (DEC-018: 'rating' requires weight > 0 and numeric scores within
// scale_json {min,max}; 'dropdown' requires options: string[]).
import type { CriterionKind, EvaluationCriterion, PlanDraft } from './types';

let criterionCounter = 0;

/** Deterministic-enough client id for a new criterion row before it's saved. */
export function newCriterionId(): string {
  criterionCounter += 1;
  return `draft-${Date.now()}-${criterionCounter}`;
}

export function addCriterion(criteria: EvaluationCriterion[], kind: CriterionKind): EvaluationCriterion[] {
  const base: EvaluationCriterion =
    kind === 'rating'
      ? { id: newCriterionId(), label: '', kind: 'rating', weight: 1 }
      : { id: newCriterionId(), label: '', kind: 'dropdown', options: [] };
  return [...criteria, base];
}

export function removeCriterion(criteria: EvaluationCriterion[], id: string): EvaluationCriterion[] {
  return criteria.filter((c) => c.id !== id);
}

export function updateCriterion(
  criteria: EvaluationCriterion[],
  id: string,
  patch: Partial<EvaluationCriterion>,
): EvaluationCriterion[] {
  return criteria.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

export interface PlanValidationErrors {
  [field: string]: string;
}

/**
 * Validates a plan draft against DEC-018's criteria rules. Returns an empty
 * object when the draft is valid. Never throws -- this feeds inline form
 * error display, not a fail-loud invariant.
 */
export function validatePlanDraft(draft: PlanDraft): PlanValidationErrors {
  const errors: PlanValidationErrors = {};

  if (draft.name.trim().length === 0) {
    errors.name = 'Name is required.';
  }
  if (draft.scale.min >= draft.scale.max) {
    errors.scale = 'Scale max must be greater than scale min.';
  }
  if (draft.rounds < 1) {
    errors.rounds = 'Rounds must be at least 1.';
  }
  if (
    draft.maxEvaluationsPerSubmission !== undefined &&
    draft.maxEvaluationsPerSubmission < 1
  ) {
    errors.maxEvaluationsPerSubmission = 'Max evaluations must be at least 1, if set.';
  }
  if (draft.criteria.length === 0) {
    errors.criteria = 'At least one criterion is required.';
  }

  for (const criterion of draft.criteria) {
    if (criterion.label.trim().length === 0) {
      errors[`criterion.${criterion.id}.label`] = 'Criterion label is required.';
    }
    if (criterion.kind === 'rating') {
      if (criterion.weight === undefined || criterion.weight <= 0) {
        errors[`criterion.${criterion.id}.weight`] = 'Rating criteria need a weight greater than 0.';
      }
    } else {
      if (!criterion.options || criterion.options.length === 0) {
        errors[`criterion.${criterion.id}.options`] = 'Dropdown criteria need at least one option.';
      }
    }
  }

  return errors;
}

export function isPlanDraftValid(draft: PlanDraft): boolean {
  return Object.keys(validatePlanDraft(draft)).length === 0;
}

/** Sum of weights across rating criteria only (DEC-018: dropdown criteria never weigh into aggregation). */
export function totalRatingWeight(criteria: EvaluationCriterion[]): number {
  return criteria
    .filter((c) => c.kind === 'rating')
    .reduce((sum, c) => sum + (c.weight ?? 0), 0);
}
