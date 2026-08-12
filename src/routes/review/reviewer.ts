// Review API (J4) reviewer-facing endpoints (/api/v1/review/*): reviewer OR
// organizer, inline check (DEC-018 — requireReviewer itself stays narrow).
// Extracted from the former monolithic src/routes/review.ts (see shared.ts
// for the parsing/authz helpers this sub-app depends on). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-425
import {
  buildReviewerQueue,
  needsMoreRatings,
  isPlanOpen,
  anonymizeForReviewer,
  validateEvaluationScores,
  criteriaForRound,
  partitionRecused,
} from "../../domain/evaluation";
import { clampPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import type { PlanRecord } from "../../server/repo/review";
import * as eventsRepo from "../../server/repo/events";
import { DEC_239, DEC_460, DEC_461, DEC_466 } from "../../decisions";
import { currentAuth, requireReviewerOrOrganizer, asRecord, requireAssignedPlan } from "./shared";

export const reviewReviewerRoutes = new Hono<AppEnv>();
void DEC_239; // /review/plans/:id/queue: shaped {submissionId,ref,title,ratingsCount,alreadyRatedByMe} below
void DEC_460; // enforced bound on every /api/v1 list envelope, no exemptions
void DEC_461; // optional repo page param + sibling count fn + deterministic ORDER BY below
void DEC_466; // /review/plans/:id/queue bounded below via the blessed JS-slice (DEC-461(e))

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

reviewReviewerRoutes.get("/api/v1/review/plans/:id/queue", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("id"));
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now())) {
    return c.json({ items: [], total: 0, page, perPage, open: false });
  }

  const scoped = await repo.resolveReviewerSubmissions(c.var.db, plan, auth.userId);
  // DEC-082/DEC-346/DEC-439: queue counts/marks only the plan's current
  // round -- earlier rounds' evaluations don't count toward this round's
  // cap or "already rated" state. SQL aggregates replace the whole-round
  // evaluation load + JS reduce, restricted to this reviewer's already-
  // scoped submission ids so the counts query scales with the slice too.
  const countsBySubmission = await repo.countEvaluationsBySubmission(c.var.db, plan.id, plan.currentRound);
  const ratedByMe = await repo.listSubmissionIdsRatedBy(c.var.db, plan.id, plan.currentRound, auth.userId);

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
  const recusedOut = recusedScoped.map((s) => ({
    submissionId: s.id,
    ref: s.ref,
    title: s.title,
    reason: recusalBySubmission.get(s.id)?.reason ?? null,
  }));

  const queueItems = scopedActionable
    .map((s) => ({
      submissionId: s.id,
      ratingsCount: countsBySubmission.get(s.id) ?? 0,
      alreadyRatedByMe: ratedByMe.has(s.id),
    }))
    .filter((item) => item.alreadyRatedByMe || needsMoreRatings(item, plan.maxEvaluations ?? undefined));

  const orderedIds = buildReviewerQueue(queueItems);
  const byId = new Map(scopedActionable.map((s) => [s.id, s]));
  // DEC-239: the SPA reads submissionId/ref/title/ratingsCount/
  // alreadyRatedByMe by exact key -- emit the shaped item, not the raw
  // SubmissionSummary row (which has `id`, not `submissionId`).
  const items = orderedIds
    .map((id) => {
      const summary = byId.get(id);
      if (!summary) return undefined;
      return {
        submissionId: summary.id,
        ref: summary.ref,
        title: summary.title,
        ratingsCount: countsBySubmission.get(id) ?? 0,
        alreadyRatedByMe: ratedByMe.has(id),
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
  return c.json({ items: pagedItems, total, page, perPage, open: true, recused: recusedOut });
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

  // DEC-147: the criteria embedded on the submission detail are resolved for
  // the plan's ACTIVE round -- the reviewer's scorecard renders these, not
  // plan.criteria, so a round override actually takes effect client-side.
  const criteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound);

  const detail = {
    ...summary,
    speakers: speakers as repo.SpeakerSummary[] | undefined,
    speakerAnswers: answers.filter((a) => a.section === "speaker") as repo.SubmissionAnswerRow[] | undefined,
    sessionAnswers: answers.filter((a) => a.section === "session"),
    criteria,
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

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now())) {
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

  const body = asRecord(await c.req.json());
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
