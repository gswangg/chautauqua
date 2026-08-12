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

// GET /api/v1/plans/:id/progress item. DEC-271: `recused` is the count of
// submissions this reviewer has declared a conflict of interest on, so the
// organizer can see declared conflicts alongside assigned/completed.
export interface ProgressRow {
  userId: string;
  email: string;
  assigned: number;
  completed: number;
  recused: number;
}

// GET /api/v1/plans/:id/results item.
export interface ResultsRow {
  submissionId: string;
  ref: string;
  title: string;
  count: number;
  average: number;
  perCriterion: Record<string, number>;
  // DEC-241: per-dropdown-criterion option counts + modal option, keyed by
  // criterion id. Never folded into `average`/`perCriterion` (rating-only).
  perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
}

// GET /api/v1/review/plans/:id/queue item. DEC-561: the queue keeps
// already-rated items instead of erasing them, so `alreadyRatedByMe` tells
// the SPA to render a completed pill rather than a live count.
export interface ReviewerQueueItem {
  submissionId: string;
  ref: string;
  title: string;
  ratingsCount: number;
  alreadyRatedByMe: boolean;
}

// DEC-271: a submission this reviewer has recused themselves from (conflict
// of interest). Surfaced by the queue envelope's `recused` array -- these
// submissions are excluded from `items` (never assigned/scored) but still
// need to be visible so the reviewer can see/undo their own declared
// conflicts.
export interface RecusalItem {
  submissionId: string;
  ref: string;
  title: string;
  reason: string | null;
}

// POST/DELETE /api/v1/review/plans/:planId/recusals/:submissionId response
// (POST only -- DELETE returns 204 with no body). POST body is
// { reason: string | null }.
export interface RecusalRecord {
  planId: string;
  submissionId: string;
  userId: string;
  reason: string | null;
  createdAt: number;
}

// GET /api/v1/review/plans/:id/queue envelope. Extends the shared list
// envelope with `open` (DEC-141, plan open/close window) and `recused`
// (DEC-271, this reviewer's declared conflicts of interest on this plan).
export interface ReviewerQueueEnvelope {
  items: ReviewerQueueItem[];
  total: number;
  page: number;
  perPage: number;
  open: boolean;
  recused: RecusalItem[];
}

// PUT /api/v1/review/plans/:planId/evaluations/:submissionId body/response.
export type EvaluationScores = Record<string, number | string>;

export interface MyEvaluation {
  scores: EvaluationScores;
  comment?: string;
}

// A single CFP custom-answer entry, session or speaker side. DEC-561:
// `value` is rendered through formatAnswerValue -- never assumed to be a
// string.
export interface SubmissionAnswer {
  fieldId: string;
  label: string;
  kind: string;
  value: unknown;
}

// GET /api/v1/review/submissions/:id?planId= response (DEC-561 wire
// contract). When plan.anonymized the server has already stripped
// `speakers`/`speakerAnswers` entirely (no key at all) -- never
// re-applied/re-stripped client-side.
export interface ReviewerSubmissionDetail {
  id: string;
  ref: string;
  title: string;
  description?: string;
  speakers?: { contactId: string; name: string; company: string | null; title: string | null }[];
  // The CFP's custom answers for the session itself, in form order
  // (form_field.position asc) -- rendered in the order delivered, never
  // re-sorted.
  sessionAnswers: SubmissionAnswer[];
  // The CFP's custom answers on the speaker record(s), when the plan isn't
  // anonymized. Same shape/order guarantee as sessionAnswers.
  speakerAnswers?: SubmissionAnswer[];
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

// GET /api/v1/users?role=reviewer item (DEC-239 wire-shape contract: the
// server's OrgUserRecord keys the id as `id`, not `userId` -- an earlier
// mismatch here posted `undefined` as the reviewer assignment's userId).
export interface ReviewerOption {
  id: string;
  email: string;
  role: string;
}
