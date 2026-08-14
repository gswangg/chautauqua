// Review API (J4) reviewer-facing endpoints (/api/v1/review/*): reviewer OR
// organizer, inline check (DEC-018 — requireReviewer itself stays narrow).
// Extracted from the former monolithic src/routes/review.ts (see shared.ts
// for the parsing/authz helpers this sub-app depends on). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson } from "../../server/middleware";
import { ApiError, readJsonBody } from "../../server/http";
import { MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-425
import {
  buildReviewerQueue,
  needsMoreRatings,
  isPlanOpen,
  anonymizeForReviewer,
  validateEvaluationScores,
  criteriaForRound,
  partitionRecused,
  computeWeightedScore,
} from "../../domain/evaluation";
import { clampPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import type { PlanRecord } from "../../server/repo/review";
import * as eventsRepo from "../../server/repo/events";
import { DEC_239, DEC_460, DEC_461, DEC_466, DEC_831, DEC_857 } from "../../decisions";
import { currentAuth, requireReviewerOrOrganizer, requireAssignedPlan } from "./shared";

export const reviewReviewerRoutes = new Hono<AppEnv>();
void DEC_239; // /review/plans/:id/queue: shaped {submissionId,ref,title,ratingsCount,alreadyRatedByMe} below
void DEC_460; // enforced bound on every /api/v1 list envelope, no exemptions
void DEC_461; // optional repo page param + sibling count fn + deterministic ORDER BY below
void DEC_466; // /review/plans/:id/queue bounded below via the blessed JS-slice (DEC-461(e))
void DEC_831; // queue items carry myScore (this reviewer's own blended score) below
void DEC_857; // queue items carry format (session-shape fact, never stripped for anonymized plans) below

reviewReviewerRoutes.get("/api/v1/review/plans", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  let plans: PlanRecord[];
  let total: number;
  if (auth.role === "organizer") {
    const eventId = c.req.query("eventId");
    if (!eventId) throw new ApiError("invalid", "eventId query param is required");
    const event = await eventsRepo.getEventForOrg(c.var.db, eventId, auth.orgId);
    if (!event) throw new ApiError("not_found", "Event not found");
    [plans, total] = await Promise.all([
      repo.listPlansForEvent(c.var.db, event.id, { limit: perPage, offset: (page - 1) * perPage }),
      repo.countPlansForEvent(c.var.db, event.id),
    ]);
  } else {
    // DEC-461(e): the reviewer's plan set starts from an already-bounded
    // assigned-plan-id list (one row per plan the reviewer is on) -- the
    // blessed JS-slice exception applies. Sort deterministically by id,
    // clamp with a slice, but report the true count as `total`.
    const planIds = [...(await repo.listPlanIdsForReviewer(c.var.db, auth.userId))].sort();
    total = planIds.length;
    const pagedIds = planIds.slice((page - 1) * perPage, (page - 1) * perPage + perPage);
    plans = (await Promise.all(pagedIds.map((id) => repo.getPlanById(c.var.db, id)))).filter(
      (p): p is PlanRecord => p !== null,
    );
  }
  return c.json({ items: plans, total, page, perPage });
});

// DEC-819: the plan-scoped queue route (/review/plans/:id) needs the plan's
// own name to head the page -- mirrors /review/plans/:id/queue's
// requireAssignedPlan scoping (organizer via org, reviewer via assignment).
reviewReviewerRoutes.get("/api/v1/review/plans/:id", async (c) => {
  requireReviewerOrOrganizer(c);
  const plan = await requireAssignedPlan(c, c.req.param("id"));
  return c.json(plan);
});

reviewReviewerRoutes.get("/api/v1/review/plans/:id/queue", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("id"));
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));

  // Both branches below build through this single shaper so the closed-plan
  // early return and the open-plan result cannot diverge in shape -- the
  // Review landing reads `recused.length` unconditionally across all plans
  // (5th-cycle lockout regression, docs/eval-findings.md).
  // DEC-845: the envelope carries the plan's own facts (name/scope
  // track/close date) so the queue header renders from ONE fetch instead of
  // a second GET /review/plans/:id round trip -- resolved here so both the
  // closed-plan early return and the open-plan result share the same values.
  const scopeTrackId = auth.role === "organizer" ? null : await repo.getReviewerScopeTrackId(c.var.db, plan.id, auth.userId);
  const scopeTrackName = scopeTrackId
    ? (await repo.getTrackNamesByIds(c.var.db, [scopeTrackId])).get(scopeTrackId) ?? null
    : null;

  const shapeQueueEnvelope = (fields: {
    items: unknown[];
    total: number;
    open: boolean;
    recused: unknown[];
  }) =>
    c.json({
      items: fields.items,
      total: fields.total,
      page,
      perPage,
      open: fields.open,
      recused: fields.recused,
      planName: plan.name,
      scopeTrackName,
      closeDate: plan.closeDate,
    });

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone)) {
    return shapeQueueEnvelope({ items: [], total: 0, open: false, recused: [] });
  }

  const scoped = await repo.resolveReviewerSubmissions(c.var.db, plan, auth.userId);
  // DEC-082/DEC-346/DEC-439: queue counts/marks only the plan's current
  // round -- earlier rounds' evaluations don't count toward this round's
  // cap or "already rated" state. SQL aggregates replace the whole-round
  // evaluation load + JS reduce, restricted to this reviewer's already-
  // scoped submission ids so the counts query scales with the slice too.
  const countsBySubmission = await repo.countEvaluationsBySubmission(c.var.db, plan.id, plan.currentRound);
  const ratedByMe = await repo.listSubmissionIdsRatedBy(c.var.db, plan.id, plan.currentRound, auth.userId);
  // DEC-831: this reviewer's own scores for the queue's `myScore` column,
  // read alongside listSubmissionIdsRatedBy rather than a second pass.
  const myScoresBySubmission = await repo.listEvaluationScoresForReviewer(
    c.var.db,
    plan.id,
    plan.currentRound,
    auth.userId,
  );
  // DEC-857: the queue row's own format meta -- batched over the scoped
  // submission ids, chunked exactly like loadDurationMinBySubmission
  // (src/server/repo/agenda.ts:316-330). Not stripped for an anonymized
  // plan: format is a session-shape fact, not identity.
  const formatBySubmission = await repo.listFormatLabelsBySubmission(
    c.var.db,
    scoped.map((s) => s.id),
  );
  // DEC-857: same batching for audience level -- also a session-shape fact,
  // not identity, so also not stripped for an anonymized plan.
  const audienceLevelBySubmission = await repo.listAudienceLevelsBySubmission(
    c.var.db,
    scoped.map((s) => s.id),
  );
  // DEC-147: blend through the round's resolved criteria, restricted to
  // 'rating' criteria -- computeWeightedScore (src/domain/evaluation.ts) is
  // the single blended-score formula; a plan with no rating criteria has
  // nothing to blend (mirrors aggregateSubmission's DEC-212 short-circuit).
  const ratingCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound).filter(
    (crit): crit is typeof crit & { kind: "rating"; weight: number } => crit.kind === "rating",
  );
  const myScoreFor = (submissionId: string): number | null => {
    const scores = myScoresBySubmission.get(submissionId);
    if (!scores || ratingCriteria.length === 0) return null;
    return computeWeightedScore(scores as Record<string, number>, ratingCriteria, plan.scale);
  };

  // DEC-271: recused submissions are dropped from the actionable queue and
  // surfaced separately in the `recused` envelope key instead. partitionRecused
  // (pure core, src/domain/evaluation.ts) does the set split; this route just
  // shapes the two output lists.
  const recusals = await repo.listRecusalsForReviewer(c.var.db, plan.id, auth.userId);
  const recusalBySubmission = new Map(recusals.map((r) => [r.submissionId, r]));
  const { kept: scopedActionable, recused: recusedScoped } = partitionRecused(
    scoped.map((s) => ({ ...s, submissionId: s.id })),
    new Set(recusals.map((r) => r.submissionId)),
  );
  // DEC-874 (wave 72 amendment): a recused row keeps the same meta line an
  // actionable row shows -- formatBySubmission is already computed over
  // EVERY scoped id (above), so carrying it onto the recused half costs no
  // extra query. A projection must carry its source's vocabulary.
  const recusedOut = recusedScoped.map((s) => ({
    submissionId: s.id,
    ref: s.ref,
    title: s.title,
    reason: recusalBySubmission.get(s.id)?.reason ?? null,
    format: formatBySubmission.get(s.id) ?? null,
    audienceLevel: audienceLevelBySubmission.get(s.id) ?? null,
  }));

  const queueItems = scopedActionable
    .map((s) => ({
      submissionId: s.id,
      ratingsCount: countsBySubmission.get(s.id) ?? 0,
      alreadyRatedByMe: ratedByMe.has(s.id),
      myScore: myScoreFor(s.id),
      format: formatBySubmission.get(s.id) ?? null,
      audienceLevel: audienceLevelBySubmission.get(s.id) ?? null,
    }))
    .filter((item) => item.alreadyRatedByMe || needsMoreRatings(item, plan.maxEvaluations ?? undefined));

  const ordered = buildReviewerQueue(queueItems);
  const byId = new Map(scopedActionable.map((s) => [s.id, s]));
  // DEC-239/DEC-831/DEC-845/DEC-857: the SPA reads submissionId/ref/title/
  // ratingsCount/alreadyRatedByMe/myScore/format by exact key -- emit the shaped
  // item, not the raw SubmissionSummary row (which has `id`, not
  // `submissionId`); myScore comes straight off buildReviewerQueue's own
  // ordered item now, not a second lookup.
  const items = ordered
    .map(({ submissionId: id, myScore }) => {
      const summary = byId.get(id);
      if (!summary) return undefined;
      return {
        submissionId: summary.id,
        ref: summary.ref,
        title: summary.title,
        ratingsCount: countsBySubmission.get(id) ?? 0,
        alreadyRatedByMe: ratedByMe.has(id),
        myScore,
        format: formatBySubmission.get(id) ?? null,
        audienceLevel: audienceLevelBySubmission.get(id) ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  // DEC-466/DEC-461(e): blessed JS-slice -- items is already assembled from a
  // materialized array (buildReviewerQueue's fewest-ratings-first order),
  // so clamp with a slice and report the FULL array length as `total`, not
  // the slice's. `recused` stays unpaged below: it's the reviewer's own
  // recusal set, not a list envelope.
  const total = items.length;
  const start = (page - 1) * perPage;
  const pagedItems = items.slice(start, start + perPage);
  return shapeQueueEnvelope({ items: pagedItems, total, open: true, recused: recusedOut });
});

reviewReviewerRoutes.get("/api/v1/review/submissions/:id", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const submissionId = c.req.param("id");
  const planId = c.req.query("planId");
  if (!planId) throw new ApiError("invalid", "planId query param is required");
  const plan = await requireAssignedPlan(c, planId);

  if (auth.role !== "organizer") {
    const inScope = await repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId);
    if (!inScope) throw new ApiError("not_found", "Submission not found");
  }

  const summary = await repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId);
  if (!summary) throw new ApiError("not_found", "Submission not found");

  const answers = await repo.listAnswersForSubmission(c.var.db, submissionId);
  const speakers = await repo.listSpeakersForSubmission(c.var.db, submissionId);
  // frame 03--01: the scorecard head's meta line needs the same
  // SESSION_FORMAT_FIELD_ID reading the queue row already carries (DEC-857)
  // -- reuse listFormatLabelsBySubmission (single-id call) rather than a
  // second lookup. audienceLevel is wired the same way (single-id call to
  // listAudienceLevelsBySubmission) and, like format, is NOT stripped for
  // an anonymized plan: a session-shape fact is not identity.
  const formatBySubmission = await repo.listFormatLabelsBySubmission(c.var.db, [submissionId]);
  const format = formatBySubmission.get(submissionId) ?? null;
  const audienceLevelBySubmission = await repo.listAudienceLevelsBySubmission(c.var.db, [submissionId]);
  const audienceLevel = audienceLevelBySubmission.get(submissionId) ?? null;

  // DEC-147: the criteria embedded on the submission detail are resolved for
  // the plan's ACTIVE round -- the reviewer's scorecard renders these, not
  // plan.criteria, so a round override actually takes effect client-side.
  const criteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound);

  // DEC-561: this reviewer's own stored evaluation for the plan's ACTIVE
  // round, omitted entirely (property absent, not null) when there's no row
  // yet -- lets a reviewer reopen/revise a submitted review.
  const myEvaluationRecord = await repo.getEvaluation(c.var.db, plan.id, submissionId, auth.userId, plan.currentRound);

  // DEC-984: this reviewer's own recusal (if any) for THIS submission -- must
  // survive a reload, not just live in client state after a POST. Property
  // absent (not null) when there's no recusal, matching myEvaluation's
  // convention (DEC-561). Never another reviewer's recusal, never a list.
  const myRecusalRecord = await repo.hasRecusal(c.var.db, plan.id, submissionId, auth.userId);

  const detail = {
    ...summary,
    speakers: speakers as repo.SpeakerSummary[] | undefined,
    speakerAnswers: answers.filter((a) => a.section === "speaker") as repo.SubmissionAnswerRow[] | undefined,
    sessionAnswers: answers.filter((a) => a.section === "session"),
    criteria,
    format,
    audienceLevel,
    ...(myEvaluationRecord ? { myEvaluation: { scores: myEvaluationRecord.scores, comment: myEvaluationRecord.comment } } : {}),
    ...(myRecusalRecord ? { myRecusal: { reason: myRecusalRecord.reason ?? null, createdAt: myRecusalRecord.createdAt } } : {}),
  };

  // DEC-018: server-side anonymization only, never client-side.
  const out = plan.anonymized ? anonymizeForReviewer(detail) : detail;
  return c.json(out);
});

reviewReviewerRoutes.put("/api/v1/review/plans/:planId/evaluations/:submissionId", csrfJson, async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("planId"));
  const submissionId = c.req.param("submissionId");

  // DEC-211: existence-hiding 404 for a submission outside the plan's event,
  // enforced for EVERY role (organizer included) before any other checks.
  const inEvent = await repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId);
  if (!inEvent) throw new ApiError("not_found", "Submission not found");

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone)) {
    throw new ApiError("conflict", "This review plan is not currently open");
  }

  if (auth.role !== "organizer") {
    const inScope = await repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId);
    if (!inScope) throw new ApiError("not_found", "Submission not found");
  }

  // DEC-271: a reviewer who has recused themselves cannot score the
  // submission through this endpoint.
  const recusal = await repo.hasRecusal(c.var.db, plan.id, submissionId, auth.userId);
  if (recusal) {
    throw new ApiError("conflict", "You have recused yourself from this submission");
  }

  const body = await readJsonBody(c);
  const scores = body.scores;
  if (typeof scores !== "object" || scores === null) {
    throw new ApiError("invalid", "scores is required", { scores: "required" });
  }

  const round = plan.currentRound;
  const existing = await repo.getEvaluation(c.var.db, plan.id, submissionId, auth.userId, round);
  if (!existing) {
    const ratingsCount = await repo.countEvaluationsForSubmission(c.var.db, plan.id, submissionId, round);
    if (!needsMoreRatings({ ratingsCount }, plan.maxEvaluations ?? undefined)) {
      throw new ApiError("conflict", "This submission has reached its evaluation cap");
    }
  }

  // DEC-147: validate against THIS round's resolved criteria, not the base
  // plan.criteria -- a round override changes what's a valid submission.
  const roundCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round);
  const result = validateEvaluationScores(scores as Record<string, unknown>, roundCriteria, plan.scale);
  if (!result.ok) {
    throw new ApiError("invalid", "Invalid scores", result.errors);
  }

  // DEC-425: cap the comment free-text field.
  if (typeof body.comment === "string" && body.comment.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", "Invalid comment", { comment: `Max ${MAX_LONG_TEXT_LENGTH}` });
  }

  const saved = await repo.upsertEvaluation(c.var.db, {
    planId: plan.id,
    submissionId,
    reviewerId: auth.userId,
    round,
    scores: scores as Record<string, number | string>,
    comment: typeof body.comment === "string" ? body.comment : null,
  });
  return c.json(saved);
});
