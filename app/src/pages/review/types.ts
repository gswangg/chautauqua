// Shared shapes for the J4 review SPA (DEC-018 wire contract). Kept
// dependency-free so the pure helpers stay unit-testable without a DOM.

// DEC-018/DEC-148: criteria kinds. 'rating' requires weight > 0 and numeric
// scores within scale_json {min,max}; 'dropdown' requires options: string[]
// and stores the chosen string; 'text' stores a free-text string, optionally
// required, and never weighs into aggregation (like 'dropdown').
export type CriterionKind = 'rating' | 'dropdown' | 'text';

export interface EvaluationCriterion {
  id: string;
  label: string;
  kind: CriterionKind;
  weight?: number;
  options?: string[];
  required?: boolean;
}

export interface EvaluationScale {
  min: number;
  max: number;
}

// EvaluationPlan mirrors the raw wire shape returned by GET /api/v1/plans/:id
// and /api/v1/events/:eventId/plans (src/server/repo/review.ts PlanRecord),
// per DEC-171. PlanEditor's internal PlanDraft may keep friendlier field
// names, but any type describing the API response/request bodies MUST match
// the wire exactly -- this crashed the SPA once already (task-w4-e).
export interface EvaluationPlan {
  id: string;
  eventId: string;
  name: string;
  instructions?: string;
  openDate: number | null;
  closeDate: number | null;
  filters: { trackIds?: string[] } | null;
  anonymized: boolean;
  scale: EvaluationScale;
  criteria: EvaluationCriterion[];
  rounds: number;
  // DEC-082: the round the plan is currently on (1-based, <= rounds).
  currentRound: number;
  // DEC-147: round -> criteria override map, keyed by round number as a
  // string ("2", "3", ...). A round absent from this map (including round 1
  // by convention) uses `criteria` above. null/undefined = no overrides.
  roundCriteria?: Record<string, EvaluationCriterion[]> | null;
  maxEvaluations: number | null;
  createdAt: number;
}

// PlanDraft keeps the SPA-internal field names (openAt/closeAt/trackIds/
// maxEvaluationsPerSubmission); PlanEditor maps to/from the wire names above
// when loading (GET) and saving (POST/PATCH).
export interface PlanDraft {
  name: string;
  instructions?: string;
  openAt: number | null;
  closeAt: number | null;
  trackIds: string[];
  anonymized: boolean;
  scale: EvaluationScale;
  criteria: EvaluationCriterion[];
  rounds: number;
  roundCriteria?: Record<string, EvaluationCriterion[]> | null;
  maxEvaluationsPerSubmission?: number;
}

export const DEFAULT_PLAN_DRAFT: PlanDraft = {
  name: '',
  instructions: '',
  openAt: null,
  closeAt: null,
  trackIds: [],
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [],
  rounds: 1,
  roundCriteria: null,
  maxEvaluationsPerSubmission: undefined,
};

// POST/DELETE /api/v1/plans/:id/reviewers { userId, trackId?, submissionId? }
// DEC-017 scope semantics: trackId set = whole track; submissionId set =
// single submission; both omitted = all plan-filtered submissions.
export interface PlanReviewer {
  id: string;
  userId: string;
  email?: string;
  trackId?: string | null;
  submissionId?: string | null;
}

// GET /api/v1/plans/:id/progress item.
export interface ProgressRow {
  userId: string;
  email: string;
  assigned: number;
  completed: number;
}

// GET /api/v1/plans/:id/results item.
export interface ResultsRow {
  submissionId: string;
  ref: string;
  title: string;
  count: number;
  average: number;
  perCriterion: Record<string, number>;
}

// GET /api/v1/review/plans/:id/queue item.
export interface ReviewerQueueItem {
  submissionId: string;
  ref: string;
  title: string;
  ratingsCount: number;
}

// PUT /api/v1/review/plans/:planId/evaluations/:submissionId body/response.
export type EvaluationScores = Record<string, number | string>;

export interface MyEvaluation {
  scores: EvaluationScores;
  comment?: string;
}

// GET /api/v1/review/submissions/:id?planId= response. When plan.anonymized
// the server has already stripped speaker fields -- never re-applied
// client-side.
export interface ReviewerSubmissionDetail {
  id: string;
  ref: string;
  title: string;
  description?: string;
  speakers?: { contactId: string; name: string }[];
  answers?: Record<string, unknown>;
  // This reviewer's own prior rating on this submission, if any. Reviewers
  // never see the aggregate/other reviewers' scores (DEC-018) -- only this.
  myEvaluation?: MyEvaluation;
  // DEC-147: criteria resolved for the plan's ACTIVE round (via the server's
  // criteriaForRound) -- the Scorecard renders these instead of plan.criteria
  // so a round override actually takes effect.
  criteria?: EvaluationCriterion[];
}

export interface Track {
  id: string;
  name: string;
}

export interface ReviewerOption {
  userId: string;
  email: string;
}
