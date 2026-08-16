// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// CONTENTION DECOMPOSITION (no behavior change): this file was an 837-line
// merge-conflict hotspot. It is now a re-export barrel over
// src/domain/evaluation/* -- every public name below is unchanged, so
// existing `from "../domain/evaluation"` imports keep working verbatim.
// New code MAY import directly from the submodule (e.g.
// "../domain/evaluation/scoring") to shrink its own diff surface, but the
// barrel is not deprecated -- both paths are supported.

export {
  computeWeightedScore,
  aggregateSubmission,
} from "./evaluation/scoring";
export type {
  EvaluationCriterion,
  EvaluationPlanDef,
  EvaluationScores,
  SubmissionAggregate,
} from "./evaluation/scoring";

export {
  EvaluationScoresJsonError,
  parseEvaluationScoresJson,
  numericScoresFor,
} from "./evaluation/scores-json";

export {
  MAX_PLAN_ROUNDS,
  MAX_PLAN_CRITERIA,
  MIN_CRITERION_OPTIONS,
  MAX_CRITERION_OPTIONS,
  MAX_CRITERION_GUIDANCE_LENGTH,
  normalizeGuidance,
  validateEvaluationScores,
  criterionWeightShares,
  DEFAULT_PLAN_CRITERIA,
  aggregateDropdownCriterion,
  dropdownDistribution,
  criteriaForRound,
  roundMetaFor,
  roundLabel,
  planNamesRound,
} from "./evaluation/criteria";
export type {
  RatingCriterionDef,
  DropdownCriterionDef,
  TextCriterionDef,
  EvaluationCriterionDef,
  EvaluationScoreValue,
  EvaluationErrors,
  RoundMetaEntry,
  RoundMeta,
} from "./evaluation/criteria";

export { isPlanOpen } from "./evaluation/plan-window";

export { buildReviewerQueue, needsMoreRatings, assignedExcludingSaturated } from "./evaluation/queue";
export type { ReviewerQueueItem, OrderedReviewerQueueItem } from "./evaluation/queue";

export {
  buildResultsRows,
  sortValueForColumn,
  sortResultsRows,
} from "./evaluation/results";
export type {
  ResultsRowInput,
  SortDirection,
  SortableResultsRow,
  ResultsSortKey,
} from "./evaluation/results";

export { resolveAssignments } from "./evaluation/assignments";
export type { ReviewerScopeRow } from "./evaluation/assignments";

export {
  MIN_REDACTABLE_IDENTITY_LENGTH,
  redactIdentity,
  anonymizeForReviewer,
} from "./evaluation/anonymization";

export {
  MAX_RECUSAL_REASON_LENGTH,
  partitionRecused,
  assignedExcludingRecused,
} from "./evaluation/recusal";

export {
  reviewerProgressState,
  resolveReviewerScopeTrackIds,
  formatReviewerScopeLabel,
  selectRemindTargets,
} from "./evaluation/progress";
export type { ReviewerProgressState, RemindTargetRow } from "./evaluation/progress";
