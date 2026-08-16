// Shared shapes for the J4 review SPA (DEC-018 wire contract). Kept
// dependency-free so the pure helpers stay unit-testable without a DOM.

// DEC-018/DEC-148: criteria kinds. 'rating' requires weight > 0 and numeric
// scores within scale_json {min,max}; 'dropdown' requires options: string[]
// and stores the chosen string; 'text' stores a free-text string, optionally
// required, and never weighs into aggregation (like 'dropdown').
export type CriterionKind = 'rating' | 'dropdown' | 'text';

// DEC-147 amendment (wave 8, task w8-c): a round's own name and open/close
// window, keyed by round number as a string on EvaluationPlan.roundMeta --
// mirrors `roundCriteria`'s shape exactly. Every field optional: an absent
// field falls back to `Round ${n}` / the plan's own dates server-side (see
// roundMetaFor in src/domain/evaluation.ts).
export interface RoundMetaEntry {
  name?: string;
  opensAt?: number | null;
  closesAt?: number | null;
}

export interface EvaluationCriterion {
  id: string;
  label: string;
  kind: CriterionKind;
  weight?: number;
  options?: string[];
  required?: boolean;
  // DEC-676: optional one-line guidance shown under the criterion's label
  // (editor row + reviewer scorecard). Absent/blank renders nothing.
  guidance?: string;
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
  // DEC-147 amendment (wave 8, task w8-c): round -> {name?, opensAt?,
  // closesAt?} override map, keyed by round number as a string. A round
  // absent from this map (including round 1 by convention) reads as
  // `Round ${n}` with the plan's own open/close dates. null/undefined = no
  // overrides.
  roundMeta?: Record<string, RoundMetaEntry> | null;
  maxEvaluations: number | null;
  // DEC-522: the owning event's IANA timezone, joined in server-side so a
  // plan's open/close window/relative "closes in N days" reads correctly
  // regardless of the viewer's own timezone.
  timezone: string;
  createdAt: number;
  // DEC-676: GET /api/v1/plans/:id only -- recorded-evaluation count per
  // round, keyed by round number as a string. Surfaces DEC-213's
  // server-side criteria freeze in the editor; the SPA reads this rather
  // than re-deriving the freeze rule itself.
  evaluationCountsByRound?: Record<string, number>;
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
  roundMeta?: Record<string, RoundMetaEntry> | null;
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
  roundMeta: null,
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
  // DEC-659: the scope row's own labels, resolved server-side -- never
  // derive a display string from the raw id.
  trackName?: string | null;
  submissionRef?: string | null;
  submissionTitle?: string | null;
}

// GET /api/v1/plans/:id/progress item. DEC-271: `recused` is the count of
// submissions this reviewer has declared a conflict of interest on, so the
// organizer can see declared conflicts alongside assigned/completed.
export interface ProgressRow {
  userId: string;
  email: string;
  // DEC-708: batched account->contact resolution; null when unresolvable --
  // render the email alone, never a fabricated name.
  name: string | null;
  assigned: number;
  completed: number;
  recused: number;
  // w5-f/DEC-845 (reuse): this reviewer's own track scope ("AI Engineering"),
  // resolved server-side from their plan_reviewer rows -- null reads as "All
  // tracks" (the mock's reviewer-progress row subtitle, never the plan-wide
  // filters.trackIds).
  trackName: string | null;
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
  // DEC-632/DEC-633: the submission's decision state (DEC-003 literal),
  // server truth for whether this row has already been decided.
  status: string;
  // DEC-703: who this is and where it goes -- visible-participant order
  // (speakers) / the event's own track order (trackNames).
  speakers: string[];
  trackNames: string[];
  // w42-h/DEC-366 amendment: count of reviewers who self-recused from this
  // submission -- real data, never derived from `count`.
  recusals: number;
}

// A single criterion's contribution to one evaluation, as rendered in the
// DEC-596 "reviews behind a decision" drawer (DEC-723). `label`/`kind`/
// `weight` are resolved server-side from the plan's criteria at the round
// this evaluation was recorded against -- the client never looks up a
// criterion by `id` itself, so a since-edited/removed criterion still
// renders its original label instead of a raw id or blank cell.
export interface SubmissionEvaluationCriterionItem {
  id: string;
  label: string;
  kind: CriterionKind;
  weight?: number;
}

// GET /api/v1/submissions/:id/evaluations item (DEC-596/DEC-622/DEC-632/
// DEC-633/DEC-723/DEC-736): the organiser-facing "reviews behind a
// decision" drawer. DEC-736: the server always resolves a reviewer name --
// there is no anonymized-reviewer branch here (organiser-facing endpoint).
// DEC-723: `score` is this evaluation's own blended score (2dp when
// present, null when the criteria set has no weighted rating criterion);
// `criteria` carries each criterion's resolved label/kind/weight alongside
// its recorded value from `scores`.
export interface SubmissionEvaluationItem {
  planId: string;
  planName: string;
  round: number;
  reviewerName: string;
  scores: Record<string, number | string>;
  score: number | null;
  criteria: SubmissionEvaluationCriterionItem[];
  comment: string | null;
  submittedAt: number | null;
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
  // DEC-831: this reviewer's own blended score for the plan's current round
  // (computeWeightedScore over their recorded scores), null when unscored.
  myScore: number | null;
  // DEC-857: the submission's role-tagged session_format answer label,
  // verbatim (already carries its own '(N min)' suffix). Null when
  // unanswered. A session-shape fact, not identity -- present even on an
  // anonymized plan.
  format: string | null;
  // DEC-874/DEC-986: an audience-level answer, when the submission's CFP
  // form has a field with role 'audience_level' (src/forms/types.ts,
  // resolved via src/server/repo/form-roles.ts) and the
  // submission answered it. Null (not absent) when there's no such answer,
  // mirroring `format`'s convention -- the wire now always includes the
  // key. A session-shape fact, never stripped for an anonymized plan.
  audienceLevel: string | null;
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
  // DEC-874 (wave 72 amendment)/DEC-986: the same session-shape fact an
  // actionable row's meta line carries -- a recused row must keep its
  // "Talk, 30 min · advanced" meta line, not drop it. The server carries
  // both `format` and `audienceLevel` for every recused row (never
  // stripped), mirroring ReviewerQueueItem's convention exactly.
  format: string | null;
  audienceLevel: string | null;
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
  // DEC-845 amendment (wave 38): the FULL unscored count across every page
  // of this reviewer's scope, computed server-side before any page slice --
  // never derive "N left to score" from items.length/filter, which only
  // sees whatever page happens to be loaded (clamped to MAX_PER_PAGE=200).
  unscoredTotal: number;
  page: number;
  perPage: number;
  open: boolean;
  // DEC-018 (wave-58 amendment): server-set from auth.role -- the SPA must
  // never infer this from row presence (a closed plan with zero submissions
  // would fool that).
  viewerIsOrganizer: boolean;
  recused: RecusalItem[];
  // DEC-845: the plan's own facts, carried on the queue envelope so the
  // scoped header renders from this one fetch. scopeTrackName is the
  // CALLER's own plan_reviewer.track_id resolved to a name (null = all
  // tracks) -- not the plan-wide filters.trackIds.
  planName: string;
  scopeTrackName: string | null;
  closeDate: number | null;
  // DEC-147 amendment (wave 8, task w8-c): the plan's own round facts, so
  // the queue head can print the ACTIVE round's own name (via roundLabel)
  // instead of a bare "round N" -- rounds/currentRound gate whether a round
  // even shows (a single-round plan shows none), roundMeta is this round's
  // resolved {name, opensAt, closesAt} (server-resolved via roundMetaFor,
  // never re-derived client-side).
  rounds: number;
  currentRound: number;
  roundMeta: { name: string; opensAt: number | null; closesAt: number | null };
}

// PUT /api/v1/review/plans/:planId/evaluations/:submissionId body/response.
export type EvaluationScores = Record<string, number | string>;

export interface MyEvaluation {
  scores: EvaluationScores;
  comment?: string;
}

// A single CFP custom-answer entry, session or speaker side. DEC-561:
// `value` is rendered through src/domain/answer-text.ts's answerDisplayText
// -- never assumed to be a string.
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
  // The CFP's custom answers on the speaker records, when the plan isn't
  // anonymized. Same shape/order guarantee as sessionAnswers.
  speakerAnswers?: SubmissionAnswer[];
  // This reviewer's own prior rating on this submission, if any. Reviewers
  // never see the aggregate/other reviewers' scores (DEC-018) -- only this.
  myEvaluation?: MyEvaluation;
  // DEC-984: this reviewer's own recusal on this submission, if any --
  // property absent (not null) when there is no recusal, same convention as
  // myEvaluation. Never another reviewer's recusal, never a list. Lets the
  // recused branch (disabled scorecard + Undo) render on first paint after a
  // reload, instead of only after a client-side POST.
  myRecusal?: { reason: string | null; createdAt: number };
  // DEC-147: criteria resolved for the plan's ACTIVE round (via the server's
  // criteriaForRound) -- the Scorecard renders these instead of plan.criteria
  // so a round override actually takes effect.
  criteria?: EvaluationCriterion[];
  // frame 03--01 (DEC-857 reuse): the SAME session-shape fact the reviewer
  // queue row's meta line already carries (formatBySubmission on the reviewer
  // route) -- a session-shape fact, not identity, so present even on an
  // anonymized plan. audienceLevel mirrors ReviewerQueueItem's documented
  // gap (no reserved field id yet; the wire does not populate it).
  format: string | null;
  audienceLevel?: string | null;
  // DEC-018 (wave-54 amendment): present (true) only when the server ran
  // anonymizeForReviewer over this detail -- the Scorecard's own signal for
  // the reading-column disclosure, rather than re-deriving it from plan.
  anonymized?: boolean;
}

export interface Track {
  id: string;
  name: string;
}

// GET /api/v1/users?role=reviewer item (DEC-239 wire-shape contract: the
// server's OrgUserRecord keys the id as `id`, not `userId` -- an earlier
// mismatch here posted `undefined` as the reviewer assignment's userId).
// w35-e/DEC-757: `name` is optional so a pre-w35-c payload (no name field)
// still round-trips -- callers fall back to `email` when it's absent/blank.
export interface ReviewerOption {
  id: string;
  email: string;
  role: string;
  name?: string;
}

// GET /api/v1/plans/:id/scope-preview?trackId=... response (DEC-572): the
// TRUE total plus a bounded (<=perPage) preview page, so the reviewer
// track-assignment action can show a real count and let the organizer
// confirm before it fans out.
export interface ScopePreviewItem {
  id: string;
  ref: string;
  title: string;
}

export interface ScopePreview {
  count: number;
  items: ScopePreviewItem[];
  perPage: number;
}

// GET /api/v1/plans/:id/assignments/distribute/preview (DEC-786): writes
// nothing -- the pairs a POST to .../distribute would add, plus the
// per-reviewer load those pairs would produce, so the organizer can review
// before confirming.
// DEC-840: the wire contract pinned so the route half and the editor half
// build to the same shape -- `items` is the plain created pairs, everything
// display-shaped (names, before/after, track) lives on `perReviewer`.
export interface DistributePreviewItem {
  submissionId: string;
  userId: string;
}

export interface DistributePreviewReviewer {
  userId: string;
  name: string;
  // DEC-824/DEC-840: this reviewer's own scope -- null when their scope is
  // broad ("All submissions") or spans no track.
  trackName: string | null;
  before: number;
  after: number;
  added: number;
  // DEC-840: false exactly when `reason` is set -- a reviewer the run
  // could not use is LISTED with its reason, never omitted.
  eligible: boolean;
  reason: 'cap_reached' | 'wrong_track' | null;
}

// DEC-824/DEC-840: what a `cap` run could not staff, per submission -- a
// closed-vocabulary reason so the dialog can name the constraint.
export interface DistributePreviewShortfall {
  submissionId: string;
  ref: string;
  title: string;
  trackName: string | null;
  needed: number;
  reason: 'cap_reached' | 'no_eligible_reviewer';
}

export interface DistributePreview {
  // DEC-840: the cap this run used, echoed back so the apply call can send
  // byte-identically what the preview showed.
  cap: number | null;
  items: DistributePreviewItem[];
  perReviewer: DistributePreviewReviewer[];
  totalAssigned: number;
  shortfall: DistributePreviewShortfall[];
}

// GET /api/v1/plans/:id/delete-preview (DEC-929): names what DELETE
// /api/v1/plans/:id is about to destroy, so the confirm dialog's prose
// matches deletePlan's tally exactly.
export interface PlanDeleteImpact {
  reviewers: number;
  evaluationsSubmitted: number;
  evaluationsDraft: number;
  recusals: number;
}
