// Review API (J4) producer endpoints: plan CRUD, reviewer assignment,
// progress, results and reminders. Extracted from the former monolithic
// src/routes/review.ts (see shared.ts for the parsing/authz helpers this
// sub-app depends on). Route files export a named Hono sub-app; only
// src/index.ts mounts it (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeMailer } from "../../server/context";
import { textToHtml } from "../../mail/render";
import {
  resolveAssignments,
  criteriaForRound,
  assignedExcludingRecused,
  sortResultsRows,
  type ResultsSortKey,
} from "../../domain/evaluation";
import { toCsv } from "../../lib/csv";
import { clampPage, clampPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import * as eventsRepo from "../../server/repo/events";
import { DEC_015, DEC_123, DEC_146, DEC_147, DEC_148, DEC_213, DEC_238 } from "../../decisions";
import {
  asRecord,
  currentAuth,
  parseScale,
  parseCriteria,
  parseRoundCriteria,
  parseRounds,
  parseRoundQuery,
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

reviewPlansRoutes.get("/api/v1/events/:eventId/plans", requireOrganizer, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  const items = await repo.listPlansForEvent(c.var.db, event.id);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

reviewPlansRoutes.post("/api/v1/events/:eventId/plans", requireOrganizer, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const body = asRecord(await c.req.json());
  const errors: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim().length === 0) errors.name = "required";
  const scale = parseScale(body, errors);
  const criteria = parseCriteria(body, errors);
  const rounds = body.rounds !== undefined ? parseRounds(body, errors) : 1;
  const roundCriteria = parseRoundCriteria(body, errors, rounds);
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Invalid plan", errors);

  const created = await repo.createPlan(c.var.db, event.id, {
    name: body.name as string,
    instructions: typeof body.instructions === "string" ? body.instructions : null,
    openDate: typeof body.openDate === "number" ? body.openDate : null,
    closeDate: typeof body.closeDate === "number" ? body.closeDate : null,
    filters: (body.filters as { trackIds?: string[] } | undefined) ?? null,
    anonymized: body.anonymized === true,
    scale: scale!,
    criteria: criteria!,
    rounds: rounds!,
    roundCriteria: roundCriteria ?? null,
    maxEvaluations: typeof body.maxEvaluations === "number" ? body.maxEvaluations : null,
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

  const scale = body.scale !== undefined ? parseScale(body, errors) : undefined;
  const criteria = body.criteria !== undefined ? parseCriteria(body, errors) : undefined;
  const rounds = body.rounds !== undefined ? parseRounds(body, errors, plan.currentRound) : undefined;
  const roundCriteria =
    body.roundCriteria !== undefined ? parseRoundCriteria(body, errors, rounds ?? plan.rounds) : undefined;
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

  const updated = await repo.updatePlan(c.var.db, plan.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    instructions: body.instructions !== undefined ? (body.instructions === null ? null : String(body.instructions)) : undefined,
    openDate: body.openDate !== undefined ? (body.openDate === null ? null : (body.openDate as number)) : undefined,
    closeDate: body.closeDate !== undefined ? (body.closeDate === null ? null : (body.closeDate as number)) : undefined,
    filters: body.filters !== undefined ? (body.filters as { trackIds?: string[] } | null) : undefined,
    anonymized: typeof body.anonymized === "boolean" ? body.anonymized : undefined,
    scale,
    criteria,
    rounds,
    roundCriteria,
    maxEvaluations: body.maxEvaluations !== undefined ? (body.maxEvaluations === null ? null : (body.maxEvaluations as number)) : undefined,
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
  const created = await repo.addReviewer(c.var.db, plan.id, {
    userId: body.userId,
    trackId: typeof body.trackId === "string" ? body.trackId : null,
    submissionId: typeof body.submissionId === "string" ? body.submissionId : null,
  });
  return c.json(created, 201);
});

reviewPlansRoutes.get("/api/v1/plans/:id/reviewers", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const rows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const users = await repo.getUsersByIds(c.var.db, [...new Set(rows.map((r) => r.userId))]);
  const emailByUserId = new Map(users.map((u) => [u.userId, u.email]));
  const items = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    email: emailByUserId.get(r.userId) ?? "",
    trackId: r.trackId,
    submissionId: r.submissionId,
  }));
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
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
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1, round });
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
      "count",
      "average",
      ...criteria.map((cr) => cr.label),
      ...dropdownColumns.map(({ dc, option }) => `${dc.label}: ${option}`),
    ];
    // ?format=csv ignores page/perPage (DEC-345): every row, in sort order.
    const dataRows = sortedRows.map((r) => [
      r.ref,
      r.title,
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

  const reminded: string[] = [];
  const failed: { email: string; message: string }[] = [];
  for (const user of users) {
    const assigned = assignments.get(user.userId) ?? [];
    const completed = completedByReviewer.get(user.userId)?.size ?? 0;
    if (completed >= assigned.length) continue;

    try {
      // DEC-191: reviewers are users, not contacts; per-contact email history
      // intentionally excludes rows like this one.
      await mailer.send({
        to: { email: user.email, name: user.email },
        subject: `Reminder: ${plan.name} review queue`,
        text: `You have ${assigned.length - completed} submission(s) left to review in "${plan.name}".`,
        html: textToHtml(`You have ${assigned.length - completed} submission(s) left to review in "${plan.name}".`),
        eventId: plan.eventId,
        contactId: null,
      });
      reminded.push(user.userId);
    } catch (err) {
      failed.push({ email: user.email, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return c.json({ reminded, sent: reminded.length, failed });
});
