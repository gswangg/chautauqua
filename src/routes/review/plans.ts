// Review API (J4) producer endpoints: plan CRUD, reviewer assignment,
// progress, results and reminders. Extracted from the former monolithic
// src/routes/review.ts (see shared.ts for the parsing/authz helpers this
// sub-app depends on). Route files export a named Hono sub-app; only
// src/index.ts mounts it (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { makeMailer } from "../../server/context";
import { newId } from "../../domain/ids";
import { textToHtml } from "../../mail/render";
import {
  resolveAssignments,
  criteriaForRound,
  assignedExcludingRecused,
  sortResultsRows,
  type ResultsSortKey,
} from "../../domain/evaluation";
import { toCsv } from "../../lib/csv";
import { clampPage, clampPerPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import * as eventsRepo from "../../server/repo/events";
import { DEC_015, DEC_123, DEC_146, DEC_147, DEC_148, DEC_213, DEC_238, DEC_460, DEC_461, DEC_466, DEC_535, DEC_572, DEC_623, DEC_624, DEC_659 } from "../../decisions";
import { capById, MAX_REVIEWER_REMINDER_BATCH } from "../../domain/reminders";
import {
  asRecord,
  currentAuth,
  parseScale,
  parseCriteria,
  parseRoundCriteria,
  parseRounds,
  parseRoundQuery,
  parseMaxEvaluations,
  parseEpochMs,
  checkEpochOrder,
  deepEqual,
  ratingCriteria,
  dropdownCriteria,
  requireOwnedPlan,
  buildResults,
  parseResultsSort,
} from "./shared";

export const reviewPlansRoutes = new Hono<AppEnv>();

void DEC_123; // criteria/scale immutability guard on PATCH /api/v1/plans/:id below
void DEC_015; // append-only migrations: migrations/0010_round_criteria.sql
void DEC_146; // PlanEditor.tsx retains the null-safe SPA date guards this task must preserve
void DEC_147; // per-round scorecards: round_criteria_json + criteriaForRound resolution
void DEC_148; // free-text 'text' criterion kind
void DEC_213; // per-round criteria freeze on PATCH /api/v1/plans/:id below
void DEC_238; // /plans/:id/remind: per-recipient catch, {sent,failed} 200 below
void DEC_460; // enforced bound on every /api/v1 list envelope, no exemptions
void DEC_461; // optional repo page param + sibling count fn + deterministic ORDER BY below
void DEC_466; // /plans/:id/progress bounded below via the blessed JS-slice (DEC-461(e))
void DEC_535; // /plans/:id/remind: laggard list capped via capById below
void DEC_572; // /plans/:id/scope-preview: true count + bounded preview before a track-scope fan-out below
void DEC_623; // POST /plans/:id/reviewers: submissionId resolved through findSubmissionIdByRefOrId below
void DEC_624; // PATCH /plans/:id: anonymity ratchet guard below
void DEC_659; // GET /plans/:id/reviewers: trackName/submissionRef/submissionTitle labels below

reviewPlansRoutes.get("/api/v1/events/:eventId/plans", requireOrganizer, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const [items, total] = await Promise.all([
    repo.listPlansForEvent(c.var.db, event.id, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countPlansForEvent(c.var.db, event.id),
  ]);
  return c.json({ items, total, page, perPage });
});

reviewPlansRoutes.post("/api/v1/events/:eventId/plans", requireOrganizer, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const body = asRecord(await c.req.json());
  const errors: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim().length === 0) errors.name = "required";
  else if (body.name.length > MAX_NAME_LENGTH) errors.name = `Max ${MAX_NAME_LENGTH}`; // DEC-417
  if (typeof body.instructions === "string" && body.instructions.length > MAX_LONG_TEXT_LENGTH) {
    errors.instructions = `Max ${MAX_LONG_TEXT_LENGTH}`; // DEC-417
  }
  const scale = parseScale(body, errors);
  const criteria = parseCriteria(body, errors);
  const rounds = body.rounds !== undefined ? parseRounds(body, errors) : 1;
  const roundCriteria = parseRoundCriteria(body, errors, rounds);
  // DEC-509: maxEvaluations/openDate/closeDate validated at the route --
  // a bad value must 400, never coerce to null and open the plan silently.
  const maxEvaluations = parseMaxEvaluations(body, errors);
  const openDate = parseEpochMs(body, "openDate", errors);
  const closeDate = parseEpochMs(body, "closeDate", errors);
  // DEC-517: on POST there is no stored record yet, so the effective values
  // ARE the body values.
  if (Object.keys(errors).length === 0) checkEpochOrder(openDate, closeDate, errors);
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Invalid plan", errors);

  const created = await repo.createPlan(c.var.db, event.id, {
    name: body.name as string,
    instructions: typeof body.instructions === "string" ? body.instructions : null,
    openDate: openDate ?? null,
    closeDate: closeDate ?? null,
    filters: (body.filters as { trackIds?: string[] } | undefined) ?? null,
    anonymized: body.anonymized === true,
    scale: scale!,
    criteria: criteria!,
    rounds: rounds!,
    roundCriteria: roundCriteria ?? null,
    maxEvaluations: maxEvaluations ?? null,
  });
  return c.json(created, 201);
});

reviewPlansRoutes.get("/api/v1/plans/:id", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  return c.json(plan);
});

reviewPlansRoutes.patch("/api/v1/plans/:id", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const body = asRecord(await c.req.json());
  const errors: Record<string, string> = {};

  if (body.name !== undefined && typeof body.name === "string" && body.name.length > MAX_NAME_LENGTH) {
    errors.name = `Max ${MAX_NAME_LENGTH}`; // DEC-417
  }
  if (body.instructions !== undefined && typeof body.instructions === "string" && body.instructions.length > MAX_LONG_TEXT_LENGTH) {
    errors.instructions = `Max ${MAX_LONG_TEXT_LENGTH}`; // DEC-417
  }
  const scale = body.scale !== undefined ? parseScale(body, errors) : undefined;
  const criteria = body.criteria !== undefined ? parseCriteria(body, errors) : undefined;
  const rounds = body.rounds !== undefined ? parseRounds(body, errors, plan.currentRound) : undefined;
  const roundCriteria =
    body.roundCriteria !== undefined ? parseRoundCriteria(body, errors, rounds ?? plan.rounds) : undefined;
  // DEC-509: same validation as POST -- PATCH previously did `as number`
  // casts with no check at all, letting `maxEvaluations: 0` (or a date
  // string) through verbatim.
  const maxEvaluations = parseMaxEvaluations(body, errors);
  const openDate = parseEpochMs(body, "openDate", errors);
  const closeDate = parseEpochMs(body, "closeDate", errors);
  // DEC-517: order check against the MERGED post-patch state -- whichever
  // side the body omits falls back to the plan's already-stored value, so a
  // PATCH touching only closeDate is still checked against the stored
  // openDate.
  if (Object.keys(errors).length === 0) {
    const effectiveOpen = openDate !== undefined ? openDate : plan.openDate;
    const effectiveClose = closeDate !== undefined ? closeDate : plan.closeDate;
    checkEpochOrder(effectiveOpen, effectiveClose, errors);
  }
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Invalid plan", errors);

  // DEC-123: once any evaluation exists on this plan, criteria/scale are
  // immutable -- a shape change would orphan recorded evaluations into a
  // 500ing results surface. Identical (no-op) values still pass through so
  // full-object PATCHes from the admin SPA keep working.
  if ((body.criteria !== undefined || body.scale !== undefined) && (await repo.planHasEvaluations(c.var.db, plan.id))) {
    if (body.criteria !== undefined && !deepEqual(criteria, plan.criteria)) {
      throw new ApiError(
        "conflict",
        "Criteria and scale cannot change once evaluations exist — create a new plan or delete the evaluations first",
      );
    }
    if (body.scale !== undefined && !deepEqual(scale, plan.scale)) {
      throw new ApiError(
        "conflict",
        "Criteria and scale cannot change once evaluations exist — create a new plan or delete the evaluations first",
      );
    }
  }

  // DEC-213: independent of the whole-plan criteria/scale guard above, a
  // roundCriteria change must not alter the RESOLVED criteria of any round
  // that already has recorded evaluations -- only rounds without evaluations
  // stay freely editable. Compares criteriaForRound's resolution before vs.
  // after this patch, per affected round.
  if (body.roundCriteria !== undefined && (await repo.planHasEvaluations(c.var.db, plan.id))) {
    const evaluatedRounds = await repo.listRoundsWithEvaluations(c.var.db, plan.id);
    const beforeOverridesJson = roundCriteriaJsonOf(plan);
    const afterCriteria = criteria ?? plan.criteria;
    for (const r of evaluatedRounds) {
      const before = criteriaForRound(plan.criteria, beforeOverridesJson, r);
      const after = roundCriteria === null ? afterCriteria : (roundCriteria?.[String(r)] ?? afterCriteria);
      if (!deepEqual(before, after)) {
        throw new ApiError(
          "conflict",
          "Criteria and scale cannot change once evaluations exist — create a new plan or delete the evaluations first",
        );
      }
    }
  }

  // DEC-624: anonymity is a ratchet -- once at least one evaluation has
  // been SUBMITTED under an anonymized plan, it can never be switched off.
  // Turning anonymity ON is always allowed.
  if (body.anonymized === false && plan.anonymized) {
    const submittedCount = await repo.countSubmittedEvaluationsForPlan(c.var.db, plan.id);
    if (submittedCount > 0) {
      throw new ApiError(
        "conflict",
        `${submittedCount} evaluation(s) were submitted under anonymity; anonymity cannot be switched off for this plan.`,
      );
    }
  }

  const updated = await repo.updatePlan(c.var.db, plan.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    instructions: body.instructions !== undefined ? (body.instructions === null ? null : String(body.instructions)) : undefined,
    openDate,
    closeDate,
    filters: body.filters !== undefined ? (body.filters as { trackIds?: string[] } | null) : undefined,
    anonymized: typeof body.anonymized === "boolean" ? body.anonymized : undefined,
    scale,
    criteria,
    rounds,
    roundCriteria,
    maxEvaluations,
  });
  return c.json(updated);
});

reviewPlansRoutes.delete("/api/v1/plans/:id", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  await repo.deletePlan(c.var.db, plan.id);
  return c.body(null, 204);
});

// DEC-082: advances the plan to current_round + 1. Rejects (409) once
// current_round === rounds -- there is no round beyond the plan's own count.
reviewPlansRoutes.post("/api/v1/plans/:id/advance-round", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const updated = await repo.advancePlanRound(c.var.db, plan.id);
  return c.json(updated);
});

reviewPlansRoutes.post("/api/v1/plans/:id/reviewers", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const body = asRecord(await c.req.json());
  if (typeof body.userId !== "string" || body.userId.length === 0) {
    throw new ApiError("invalid", "Invalid reviewer assignment", { userId: "required" });
  }
  await repo.requireOrgUser(c.var.db, body.userId, currentAuth(c).orgId);

  // DEC-354: reject a trackId/submissionId that does not belong to the
  // plan's own event before any plan_reviewer row is written (mirrors the
  // DEC-120 cross-org rejection at src/routes/tasks.ts:294).
  const trackId = typeof body.trackId === "string" && body.trackId.length > 0 ? body.trackId : null;
  if (trackId !== null) {
    const trackOk = await repo.trackExistsInEvent(c.var.db, trackId, plan.eventId);
    if (!trackOk) {
      throw new ApiError("invalid", "Invalid reviewer assignment", { trackId: "unknown track for this event" });
    }
  }
  // DEC-623: accept either the internal id or the printed ref (e.g.
  // SES-014) -- resolve through findSubmissionIdByRefOrId and store the
  // resolved internal id, never the ref itself.
  const rawSubmissionInput = typeof body.submissionId === "string" && body.submissionId.length > 0 ? body.submissionId : null;
  let submissionId: string | null = null;
  if (rawSubmissionInput !== null) {
    submissionId = await repo.findSubmissionIdByRefOrId(c.var.db, plan.eventId, rawSubmissionInput);
    if (!submissionId) {
      throw new ApiError("invalid", "Invalid reviewer assignment", {
        submissionId: "unknown submission for this event — use the ref (e.g. SES-014) or the internal id",
      });
    }
    // DEC-655: the plan's own filters_json trackIds narrow every other
    // scope reader (buildPlanScopeConditions, isSubmissionInReviewerScope,
    // listPlanFilteredSubmissions) -- a submissionId the plan's filters
    // exclude must be refused here too, not silently granted scope. A plan
    // with no track filter narrows nothing, so skip the extra round trip.
    if (plan.filters?.trackIds && plan.filters.trackIds.length > 0) {
      const inFilters = await repo.submissionMatchesPlanFilters(c.var.db, plan, submissionId);
      if (!inFilters) {
        throw new ApiError("invalid", "Invalid reviewer assignment", {
          submissionId: "not inside this plan's tracks -- widen the plan's filters or assign by track",
        });
      }
    }
  }

  const created = await repo.addReviewer(c.var.db, plan.id, {
    userId: body.userId,
    trackId,
    submissionId,
  });
  return c.json(created, 201);
});

// DEC-572: preview a plan_reviewer track-scope assignment BEFORE it fans out
// -- the true COUNT plus a bounded (<=200) row list, so PlanEditor can show
// "Assign N submissions" and let the organizer confirm rather than the
// server silently granting access to every plan-filtered submission in the
// track. 400 on a missing/unknown trackId, mirroring the POST /reviewers
// DEC-354 in-event check.
reviewPlansRoutes.get("/api/v1/plans/:id/scope-preview", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const trackId = c.req.query("trackId");
  if (!trackId) {
    throw new ApiError("invalid", "Invalid scope preview request", { trackId: "required" });
  }
  const trackOk = await repo.trackExistsInEvent(c.var.db, trackId, plan.eventId);
  if (!trackOk) {
    throw new ApiError("invalid", "Invalid scope preview request", { trackId: "unknown track for this event" });
  }
  const { count, items } = await repo.countPlanScopedSubmissions(c.var.db, plan, { trackId });
  return c.json({ count, items, perPage: 200 });
});

reviewPlansRoutes.get("/api/v1/plans/:id/reviewers", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const [rows, total] = await Promise.all([
    repo.listReviewerRowsForPlan(c.var.db, plan.id, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countReviewerRowsForPlan(c.var.db, plan.id),
  ]);
  const users = await repo.getUsersByIds(c.var.db, [...new Set(rows.map((r) => r.userId))]);
  const emailByUserId = new Map(users.map((u) => [u.userId, u.email]));
  // DEC-659: reviewer assignment scope speaks in names, not ULIDs -- ONE
  // batched query over the page's distinct non-null trackIds and ONE over
  // the distinct non-null submissionIds (never a query per row).
  const trackNameById = await repo.getTrackNamesByIds(c.var.db, [
    ...new Set(rows.map((r) => r.trackId).filter((id): id is string => id !== null)),
  ]);
  const submissionLabelById = await repo.getSubmissionLabelsByIds(c.var.db, [
    ...new Set(rows.map((r) => r.submissionId).filter((id): id is string => id !== null)),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    email: emailByUserId.get(r.userId) ?? "",
    trackId: r.trackId,
    submissionId: r.submissionId,
    trackName: r.trackId !== null ? (trackNameById.get(r.trackId) ?? null) : null,
    submissionRef: r.submissionId !== null ? (submissionLabelById.get(r.submissionId)?.ref ?? null) : null,
    submissionTitle: r.submissionId !== null ? (submissionLabelById.get(r.submissionId)?.title ?? null) : null,
  }));
  return c.json({ items, total, page, perPage });
});

reviewPlansRoutes.delete("/api/v1/plans/:id/reviewers/:reviewerId", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const reviewerId = c.req.param("reviewerId");
  const row = await repo.getReviewerRowById(c.var.db, reviewerId);
  if (!row || row.planId !== plan.id) throw new ApiError("not_found", "Reviewer assignment not found");
  await repo.removeReviewerById(c.var.db, reviewerId);
  return c.body(null, 204);
});

reviewPlansRoutes.get("/api/v1/plans/:id/progress", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const round = parseRoundQuery(c, plan);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const reviewerRows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const users = await repo.getUsersByIds(c.var.db, userIds);
  const evaluations = await repo.listCompletedPairsForPlan(c.var.db, plan.id, round);
  // One plan-filtered load + pure assignment resolution (DEC-081): no
  // per-reviewer awaits.
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const assignments = resolveAssignments(submissions, reviewerRows);
  // DEC-271: a recused submission never counts toward a reviewer's assigned
  // total -- an honest progress bar excludes it entirely rather than
  // stranding it as permanently "incomplete".
  const planRecusals = await repo.listRecusalsForPlan(c.var.db, plan.id);
  const recusedByUser = new Map<string, Set<string>>();
  for (const r of planRecusals) {
    const set = recusedByUser.get(r.userId) ?? new Set<string>();
    set.add(r.submissionId);
    recusedByUser.set(r.userId, set);
  }

  // DEC-345: index completed-submission-ids by reviewerId in one pass
  // instead of filtering the whole evaluation array per reviewer.
  const completedByReviewer = new Map<string, Set<string>>();
  for (const e of evaluations) {
    const set = completedByReviewer.get(e.reviewerId) ?? new Set<string>();
    set.add(e.submissionId);
    completedByReviewer.set(e.reviewerId, set);
  }

  const items = users.map((user) => {
    const assigned = assignedExcludingRecused(assignments.get(user.userId) ?? [], recusedByUser.get(user.userId) ?? new Set());
    const completed = completedByReviewer.get(user.userId)?.size ?? 0;
    return {
      userId: user.userId,
      email: user.email,
      assigned: assigned.length,
      completed,
      recused: recusedByUser.get(user.userId)?.size ?? 0,
    };
  });
  // DEC-466/DEC-461(e): blessed JS-slice -- `items` is assembled from
  // `users` (already ordered, see repo.getUsersByIds), so clamp with a
  // slice and report the FULL array length as `total`, never the slice's.
  const total = items.length;
  const start = (page - 1) * perPage;
  const pagedItems = items.slice(start, start + perPage);
  return c.json({ items: pagedItems, total, page, perPage, round });
});

reviewPlansRoutes.get("/api/v1/plans/:id/results", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const round = parseRoundQuery(c, plan);
  // DEC-345: buildResults already ranks (average desc, count desc); an
  // explicit ?sort= re-sorts that WHOLE ranked set before paging/CSV --
  // paging without moving the sort first would sort one page and mis-rank
  // the rest (DEC-341's worklist bug class).
  const rankedRows = await buildResults(c, plan, round);
  const sortSpec = parseResultsSort(c);
  const sortedRows = sortSpec ? sortResultsRows(rankedRows, sortSpec.key, sortSpec.direction) : rankedRows;

  if (c.req.query("format") === "csv") {
    const roundCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round);
    const criteria = ratingCriteria(roundCriteria);
    const dropdowns = dropdownCriteria(roundCriteria);
    const dropdownColumns = dropdowns.flatMap((dc) => dc.options.map((option) => ({ dc, option })));
    const header = [
      "ref",
      "title",
      "Status",
      "count",
      "average",
      ...criteria.map((cr) => cr.label),
      ...dropdownColumns.map(({ dc, option }) => `${dc.label}: ${option}`),
    ];
    // ?format=csv ignores page/perPage (DEC-345): every row, in sort order.
    const dataRows = sortedRows.map((r) => [
      r.ref,
      r.title,
      r.status,
      r.count,
      Number(r.average.toFixed(2)),
      ...criteria.map((cr) => Number((r.perCriterion[cr.id] ?? 0).toFixed(2))),
      ...dropdownColumns.map(({ dc, option }) => r.perDropdown[dc.id]?.counts[option] ?? 0),
    ]);
    const csv = toCsv([header, ...dataRows]);
    return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8" });
  }

  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  const start = (page - 1) * perPage;
  const items = sortedRows.slice(start, start + perPage);
  return c.json({ items, total: sortedRows.length, page, perPage, round });
});

reviewPlansRoutes.post("/api/v1/plans/:id/remind", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const reviewerRows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const users = await repo.getUsersByIds(c.var.db, userIds);
  const evaluations = await repo.listCompletedPairsForPlan(c.var.db, plan.id, plan.currentRound);
  // One plan-filtered load + pure assignment resolution (DEC-081): no
  // per-reviewer awaits.
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const assignments = resolveAssignments(submissions, reviewerRows);
  const mailer = makeMailer(c.var.db, c.env);

  // DEC-271/DEC-526: a recused submission never counts toward a reviewer's
  // assigned total -- the reminder's denominator must agree with the
  // progress panel's (:301-307), or the two dashboards contradict each
  // other for the exact same reviewer.
  const planRecusals = await repo.listRecusalsForPlan(c.var.db, plan.id);
  const recusedByUser = new Map<string, Set<string>>();
  for (const r of planRecusals) {
    const set = recusedByUser.get(r.userId) ?? new Set<string>();
    set.add(r.submissionId);
    recusedByUser.set(r.userId, set);
  }

  // DEC-238 class 2: this is an organizer-triggered batch send -- a single
  // reviewer's mail failure must not 500 the whole reminder run or hide the
  // other reviewers' outcomes. Per-recipient catch, structured summary.
  // DEC-345: index completed-submission-ids by reviewerId in one pass
  // instead of filtering the whole evaluation array per reviewer.
  const completedByReviewer = new Map<string, Set<string>>();
  for (const e of evaluations) {
    const set = completedByReviewer.get(e.reviewerId) ?? new Set<string>();
    set.add(e.submissionId);
    completedByReviewer.set(e.reviewerId, set);
  }

  const laggards: { userId: string; email: string; assignedCount: number; completed: number }[] = [];
  for (const user of users) {
    const assigned = assignedExcludingRecused(assignments.get(user.userId) ?? [], recusedByUser.get(user.userId) ?? new Set());
    const completed = completedByReviewer.get(user.userId)?.size ?? 0;
    if (completed >= assigned.length) continue;
    laggards.push({ userId: user.userId, email: user.email, assignedCount: assigned.length, completed });
  }

  // DEC-535: bound the batch the same way DEC-319 bounds the J6 sibling.
  const { items: capped, remaining } = capById(laggards, (l) => l.userId, MAX_REVIEWER_REMINDER_BATCH);

  // DEC-603: one id per fan-out call, shared by every recipient in this
  // loop, so the comms history tab can group the batch into one row.
  const batchId = newId();

  const reminded: string[] = [];
  const failed: { email: string; message: string }[] = [];
  for (const laggard of capped) {
    try {
      // DEC-191: reviewers are users, not contacts; per-contact email history
      // intentionally excludes rows like this one.
      await mailer.send({
        to: { email: laggard.email, name: laggard.email },
        subject: `Reminder: ${plan.name} review queue`,
        text: `You have ${laggard.assignedCount - laggard.completed} submission(s) left to review in "${plan.name}".`,
        html: textToHtml(
          `You have ${laggard.assignedCount - laggard.completed} submission(s) left to review in "${plan.name}".`,
        ),
        eventId: plan.eventId,
        contactId: null,
        batchId,
      });
      reminded.push(laggard.userId);
    } catch (err) {
      failed.push({ email: laggard.email, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return c.json({ reminded, sent: reminded.length, failed, remaining });
});
