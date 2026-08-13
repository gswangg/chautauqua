// Review API (J4) plan progress/results/remind endpoints. Extracted from the
// former monolithic src/routes/review/plans.ts (803 lines, a merge-conflict
// hotspot) — see shared.ts for the parsing/authz helpers this sub-app
// depends on. Route files export a named Hono sub-app; only plans.ts
// composes these sub-apps into `reviewPlansRoutes` (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError, readOptionalJsonBody } from "../../server/http";
import { makeMailer } from "../../server/context";
import { newId } from "../../domain/ids";
import { countOf } from "../../domain/count-copy";
import { textToHtml } from "../../mail/render";
import {
  resolveAssignments,
  criteriaForRound,
  assignedExcludingRecused,
  sortResultsRows,
  selectRemindTargets,
} from "../../domain/evaluation";
import { toCsv } from "../../lib/csv";
import { clampPage, clampPerPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import { DEC_238, DEC_466, DEC_535, DEC_707, DEC_708 } from "../../decisions";
import { capById, MAX_REVIEWER_REMINDER_BATCH } from "../../domain/reminders";
import {
  parseRoundQuery,
  ratingCriteria,
  dropdownCriteria,
  requireOwnedPlan,
  buildResults,
  parseResultsSort,
} from "./shared";

export const reviewPlansProgressRoutes = new Hono<AppEnv>();

void DEC_238; // /plans/:id/remind: per-recipient catch, {sent,failed} 200 below
void DEC_466; // /plans/:id/progress bounded below via the blessed JS-slice (DEC-461(e))
void DEC_535; // /plans/:id/remind: laggard list capped via capById below
void DEC_707; // GET /plans/:id/progress + POST /plans/:id/remind: scope selection via selectRemindTargets below
void DEC_708; // GET /plans/:id/progress: item.name via batchUserDisplayNames below

reviewPlansProgressRoutes.get("/api/v1/plans/:id/progress", requireOrganizer, async (c) => {
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

  // DEC-708: one batched account->contact resolution for the whole page's
  // reviewer set, never a query per row.
  const nameByUserId = await repo.batchUserDisplayNames(c.var.db, users.map((u) => u.userId));

  const items = users.map((user) => {
    const assigned = assignedExcludingRecused(assignments.get(user.userId) ?? [], recusedByUser.get(user.userId) ?? new Set());
    const completed = completedByReviewer.get(user.userId)?.size ?? 0;
    return {
      userId: user.userId,
      email: user.email,
      name: nameByUserId.get(user.userId) ?? null,
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

reviewPlansProgressRoutes.get("/api/v1/plans/:id/results", requireOrganizer, async (c) => {
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
    // DEC-703: Speaker/Track sit between title and the score columns, same
    // as the SPA table -- the export is not a second opinion about what a
    // result is.
    const header = [
      "ref",
      "title",
      "Speaker",
      "Track",
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
      r.speakers.join("; "),
      r.trackNames.join("; "),
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

reviewPlansProgressRoutes.post("/api/v1/plans/:id/remind", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  // DEC-707: optional scope body -- 'not_started' is the landing page's
  // tertiary link, 'incomplete' (default) is the broader batch nudge. Body
  // is optional (an empty/absent JSON body is valid: default scope).
  let scope: "not_started" | "incomplete" = "incomplete";
  const bodyRecord = await readOptionalJsonBody(c);
  if (bodyRecord.scope === "not_started" || bodyRecord.scope === "incomplete") {
    scope = bodyRecord.scope;
  } else if (bodyRecord.scope !== undefined) {
    throw new ApiError("invalid", "Invalid remind request", { scope: "must be 'not_started' or 'incomplete'" });
  }
  const reviewerRows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const users = await repo.getUsersByIds(c.var.db, userIds);
  const evaluations = await repo.listCompletedPairsForPlan(c.var.db, plan.id, plan.currentRound);
  // One plan-filtered load + pure assignment resolution (DEC-081): no
  // per-reviewer awaits.
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const assignments = resolveAssignments(submissions, reviewerRows);

  // DEC-271/DEC-526: a recused submission never counts toward a reviewer's
  // assigned total -- the reminder's denominator must agree with the
  // progress panel's, or the two dashboards contradict each other for the
  // exact same reviewer.
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

  // DEC-707: EVERY reviewer's row (not pre-filtered) so selectRemindTargets
  // -- the SAME predicate the SPA's landing-page label counts through -- is
  // the single place that decides who a given scope actually reaches.
  const progressRows = users.map((user) => {
    const assigned = assignedExcludingRecused(assignments.get(user.userId) ?? [], recusedByUser.get(user.userId) ?? new Set());
    const completed = completedByReviewer.get(user.userId)?.size ?? 0;
    return { userId: user.userId, email: user.email, assignedCount: assigned.length, assigned: assigned.length, completed };
  });
  const laggards = selectRemindTargets(progressRows, scope);

  // DEC-535: bound the batch the same way DEC-319 bounds the J6 sibling.
  const { items: capped, remaining } = capById(laggards, (l) => l.userId, MAX_REVIEWER_REMINDER_BATCH);

  // DEC-603: one id per fan-out call, shared by every recipient in this
  // loop, so the comms history tab can group the batch into one row.
  const batchId = newId();

  const reminded: string[] = [];
  const failed: { email: string; message: string }[] = [];

  // DEC-547/DEC-238 class 2: makeMailer throws on a misconfigured
  // environment — a config-level failure, not a per-recipient one, so it
  // can't be caught by the per-recipient try below. Construct inside this
  // guarded region (now that `capped` is known) so that failure reports as
  // every laggard 'failed' in the normal 200 envelope instead of 500ing.
  let mailer;
  try {
    mailer = makeMailer(c.var.db, c.env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("plan remind: mailer unavailable", message);
    return c.json({
      reminded,
      sent: 0,
      failed: capped.map((l) => ({ email: l.email, message })),
      remaining,
    });
  }

  for (const laggard of capped) {
    try {
      // DEC-191: reviewers are users, not contacts; per-contact email history
      // intentionally excludes rows like this one.
      await mailer.send({
        to: { email: laggard.email, name: laggard.email },
        subject: `Reminder: ${plan.name} review queue`,
        text: `You have ${countOf(laggard.assignedCount - laggard.completed, "submission")} left to review in "${plan.name}".`,
        html: textToHtml(
          `You have ${countOf(laggard.assignedCount - laggard.completed, "submission")} left to review in "${plan.name}".`,
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
