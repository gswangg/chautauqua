// Pure helpers for the plan editor's criteria editor and validation
// (DEC-018: 'rating' requires weight > 0 and numeric scores within
// scale_json {min,max}; 'dropdown' requires options: string[]).
import type { CriterionKind, EvaluationCriterion, PlanDraft } from './types';
import { formatDayInput, msToDateInput } from '../../lib/dates';

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
      : kind === 'dropdown'
        ? { id: newCriterionId(), label: '', kind: 'dropdown', options: [] }
        : { id: newCriterionId(), label: '', kind: 'text', required: false };
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
  // DEC-745/DEC-124 (V9 error standard): a cross-field error is worded as a
  // CONSEQUENCE and attached to the field the reader would actually fix --
  // the close date, not the open date it conflicts with.
  if (draft.openAt !== null && draft.closeAt !== null && draft.closeAt < draft.openAt) {
    const opens = formatDayInput(msToDateInput(draft.openAt));
    errors.closeAt = `This is before the plan opens. Pick a date after ${opens}.`;
  }
  Object.assign(errors, validateCriteriaList(draft.criteria));

  return errors;
}

/**
 * Validates a criteria array against DEC-018/DEC-148's shape rules --
 * 'rating' needs weight > 0, 'dropdown' needs non-empty options, 'text' only
 * needs a label. Shared by the base `criteria` validation above and by every
 * round override array in `roundCriteria` (DEC-147), so a round-tabbed
 * editor reuses the exact same rules. Returns `{ criteria: ... }` only when
 * the list itself is empty; per-row errors use the same
 * `criterion.<id>.<field>` keys as validatePlanDraft.
 */
export function validateCriteriaList(criteria: EvaluationCriterion[]): PlanValidationErrors {
  const errors: PlanValidationErrors = {};
  // DEC-745/DEC-124 (V9 error standard): the empty-collection error names
  // WHY the collection can't be empty, not just that it is.
  if (criteria.length === 0) {
    errors.criteria = 'A plan needs at least one criterion — reviewers score against them';
  }
  for (const criterion of criteria) {
    if (criterion.label.trim().length === 0) {
      errors[`criterion.${criterion.id}.label`] = 'Criterion label is required.';
    }
    if (criterion.kind === 'rating') {
      if (criterion.weight === undefined || criterion.weight <= 0) {
        errors[`criterion.${criterion.id}.weight`] = 'Rating criteria need a weight greater than 0.';
      }
    } else if (criterion.kind === 'dropdown') {
      if (!criterion.options || criterion.options.length === 0) {
        errors[`criterion.${criterion.id}.options`] = 'Dropdown criteria need at least one option.';
      }
    }
    // 'text' criteria have no further shape requirements beyond a label.
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
