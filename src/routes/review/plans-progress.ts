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
import { renderEmailHtml } from "../../mail/shell";
import { getEventForOrg } from "../../server/repo/events";
import { resolveBaseUrl } from "../../server/origin";
import { formatCalendarDate } from "../../lib/event-time";
import {
  resolveAssignments,
  criteriaForRound,
  assignedExcludingRecused,
  assignedExcludingSaturated,
  sortResultsRows,
  selectRemindTargets,
  resolveReviewerScopeTrackIds,
  formatReviewerScopeLabel,
} from "../../domain/evaluation";
import { toCsv } from "../../domain/csv";
import { contentDispositionAttachment } from "../../domain/files";
import { clampPage, clampPerPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import { loadRecentlySent } from "../../server/repo/comms";
import { dedupeCutoff, dedupeKey } from "../../domain/comms-dedupe";
import { DEC_238, DEC_466, DEC_535, DEC_707, DEC_708 } from "../../decisions";
import { capById, MAX_REVIEWER_REMINDER_BATCH } from "../../domain/reminders";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../lib/fanout";
import {
  parseRoundQuery,
  ratingCriteria,
  dropdownCriteria,
  requireOwnedPlan,
  rankPlanResults,
  hydrateResultsRows,
  parseResultsSort,
} from "./shared";

export const reviewPlansProgressRoutes = new Hono<AppEnv>();

void DEC_238; // /plans/:id/remind: per-recipient catch, {sent,failed} 200 below; wave-66 amendment: loadRecentlySent/dedupeCutoff/dedupeKey dedupe the batch before it sends
void DEC_466; // /plans/:id/progress bounded below via the blessed JS-slice (DEC-461(e))
void DEC_535; // /plans/:id/remind: laggard list capped via capById below
void DEC_707; // GET /plans/:id/progress + POST /plans/:id/remind: scope selection via selectRemindTargets, round via parseRoundQuery, queue link + name via resolveBaseUrl/batchUserDisplayNames below
void DEC_708; // GET /plans/:id/progress: item.name via batchUserDisplayNames below

reviewPlansProgressRoutes.get("/api/v1/plans/:id/progress", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const round = parseRoundQuery(c, plan);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  // DEC-338 (w32 amendment): the four reads below depend only on `plan`
  // (none reads another's result), so they issue as one Promise.all wave
  // instead of four sequential round trips.
  const [reviewerRows, evaluatedPairs, submissions, planRecusals] = await Promise.all([
    repo.listReviewerRowsForPlan(c.var.db, plan.id),
    // DEC-707 (wave-3 amendment): every evaluated pair, folded per reviewer
    // against THEIR OWN resolved-assigned set below -- never a raw per-plan
    // count, which is how 'completed' could exceed 'assigned'.
    repo.listEvaluatedPairsForPlan(c.var.db, plan.id, round),
    // One plan-filtered load + pure assignment resolution (DEC-081): no
    // per-reviewer awaits.
    repo.listPlanFilteredSubmissions(c.var.db, plan),
    // DEC-271: a recused submission never counts toward a reviewer's assigned
    // total -- an honest progress bar excludes it entirely rather than
    // stranding it as permanently "incomplete".
    repo.listRecusalsForPlan(c.var.db, plan.id),
  ]);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const evaluatedByReviewer = new Map<string, Set<string>>();
  // DEC-707 (wave-74 amendment): fold the SAME evaluatedPairs load into a
  // per-submissionId count -- zero new reads. listEvaluatedPairsForPlan
  // carries submittedEvaluationCondition(), the identical predicate
  // countEvaluationsBySubmission uses, so this count agrees with the
  // actionable queue's needsMoreRatings check (reviewer.ts) exactly.
  const ratingsBySubmissionId = new Map<string, number>();
  for (const p of evaluatedPairs) {
    const set = evaluatedByReviewer.get(p.reviewerId) ?? new Set<string>();
    set.add(p.submissionId);
    evaluatedByReviewer.set(p.reviewerId, set);
    ratingsBySubmissionId.set(p.submissionId, (ratingsBySubmissionId.get(p.submissionId) ?? 0) + 1);
  }
  const assignments = resolveAssignments(submissions, reviewerRows);
  const recusedByUser = new Map<string, Set<string>>();
  for (const r of planRecusals) {
    const set = recusedByUser.get(r.userId) ?? new Set<string>();
    set.add(r.submissionId);
    recusedByUser.set(r.userId, set);
  }

  // w5-f/DEC-845 (reuse): the mock's reviewer-progress row carries this
  // reviewer's OWN track scope (e.g. "AI Engineering"), not the plan-wide
  // filter -- resolved from the reviewerRows already loaded above (grouped
  // per user), never a query per reviewer. This grouping only needs
  // `reviewerRows`/`userIds` (wave 1's output), so it can run before the
  // getTrackNamesByIds read it feeds.
  const reviewerRowsByUser = new Map<string, { trackId: string | null; submissionId: string | null }[]>();
  for (const r of reviewerRows) {
    const list = reviewerRowsByUser.get(r.userId) ?? [];
    list.push({ trackId: r.trackId, submissionId: r.submissionId });
    reviewerRowsByUser.set(r.userId, list);
  }
  const scopeTrackIdsByUser = new Map<string, string[]>();
  for (const userId of userIds) {
    scopeTrackIdsByUser.set(userId, resolveReviewerScopeTrackIds(reviewerRowsByUser.get(userId) ?? []));
  }
  const allScopeTrackIds = [...new Set([...scopeTrackIdsByUser.values()].flat())];

  // DEC-338 (w33 landing of the w32 ruling): second wave -- getUsersByIds,
  // getTrackNamesByIds AND batchUserDisplayNames all depend only on ids
  // resolved from wave 1 (userIds, allScopeTrackIds), never on each other's
  // result, so all three issue as one Promise.all instead of three
  // sequential round trips. batchUserDisplayNames is fed `userIds` (the
  // deduped set derived from reviewerRows above), NOT `users.map(u =>
  // u.userId)`, so it no longer has to wait on `users` first -- extra keys
  // in the returned map beyond the eventual `users` set are inert, since
  // every lookup below is `nameByUserId.get(user.userId)` over `users`.
  // DEC-708: one batched account->contact resolution for the whole page's
  // reviewer set, never a query per row.
  const [users, trackNameById, nameByUserId] = await Promise.all([
    repo.getUsersByIds(c.var.db, userIds),
    repo.getTrackNamesByIds(c.var.db, allScopeTrackIds),
    repo.batchUserDisplayNames(c.var.db, userIds),
  ]);

  // DEC-829 (wave 39): `users` is already ordered (repo.getUsersByIds) and
  // `total` is `users.length`, so slice to the page BEFORE the per-reviewer
  // fold below -- per-request fold work is bounded by perPage instead of
  // every reviewer on the plan. Semantics are unchanged: `total` still reads
  // the FULL `users.length`, never the slice's.
  const total = users.length;
  const start = (page - 1) * perPage;
  const pagedUsers = users.slice(start, start + perPage);
  const pagedItems = pagedUsers.map((user) => {
    const recusedExcluded = assignedExcludingRecused(assignments.get(user.userId) ?? [], recusedByUser.get(user.userId) ?? new Set());
    // DEC-707 (wave-74 amendment): recusal first, then saturation -- a
    // submission other reviewers have already filled the plan's cap on is
    // not reachable by THIS reviewer (reviewer.ts's actionable queue
    // already refuses it), so it must not sit in their denominator forever
    // reading "assigned, incomplete". A submission this reviewer already
    // rated stays counted (ratedByThisReviewer), preserving
    // `completed <= assigned`.
    const assigned = assignedExcludingSaturated(
      recusedExcluded,
      ratingsBySubmissionId,
      evaluatedByReviewer.get(user.userId) ?? new Set<string>(),
      plan.maxEvaluations ?? undefined,
    );
    // DEC-707 (wave-3 amendment): `completed` is a SUBSET of `assigned` --
    // only evaluations whose submissionId is in this reviewer's own
    // resolved-assigned set for the round count toward it, so
    // `completed <= assigned` holds as an invariant rather than a hope.
    const assignedIds = new Set(assigned.map((s) => s.id));
    const evaluated = evaluatedByReviewer.get(user.userId) ?? new Set<string>();
    let completed = 0;
    for (const submissionId of evaluated) {
      if (assignedIds.has(submissionId)) completed += 1;
    }
    const scopeTrackIds = scopeTrackIdsByUser.get(user.userId) ?? [];
    const scopeTrackNames = scopeTrackIds.map((id) => trackNameById.get(id)).filter((n): n is string => n !== undefined);
    return {
      userId: user.userId,
      email: user.email,
      name: nameByUserId.get(user.userId) ?? null,
      assigned: assigned.length,
      completed,
      recused: recusedByUser.get(user.userId)?.size ?? 0,
      // DEC-845 amendment: null (unrestricted scope) reads as "All tracks"
      // in the SPA; a reviewer scoped to one or more tracks is named in
      // full, joined with ' · ' -- never truncated to a count.
      trackName: formatReviewerScopeLabel(scopeTrackNames),
    };
  });
  // DEC-745 (wave-72 amendment): the plan editor's cap row reads its
  // talks/reviews/reviewers summary off this ONE number -- zero extra
  // queries, since `submissions` is already loaded above for assignment
  // resolution.
  return c.json({ items: pagedItems, total, page, perPage, round, submissionsInScope: submissions.length });
});

reviewPlansProgressRoutes.get("/api/v1/plans/:id/results", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const round = parseRoundQuery(c, plan);
  // DEC-345: rankPlanResults already ranks (average desc, count desc); an
  // explicit ?sort= re-sorts that WHOLE ranked set before paging/CSV --
  // paging without moving the sort first would sort one page and mis-rank
  // the rest (DEC-341's worklist bug class).
  const rankedRows = await rankPlanResults(c, plan, round);
  const sortSpec = parseResultsSort(c);
  const sortedRows = sortSpec ? sortResultsRows(rankedRows, sortSpec.key, sortSpec.direction) : rankedRows;

  if (c.req.query("format") === "csv") {
    // DEC-829 (w32 amendment): CSV semantics are unchanged -- every ranked
    // row, in sort order -- so hydration runs over the FULL sorted array.
    const csvRows = await hydrateResultsRows(c, plan, sortedRows);
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
    const dataRows = csvRows.map((r) => [
      r.ref,
      r.title,
      r.speakers.join("; "),
      r.trackNames.join("; "),
      r.status,
      r.count,
      // DEC-147 amendment (w62-d): deliberately NOT src/domain/score-copy's
      // formatScore -- that module owns copy for a human screen (one
      // decimal, em dash for null). This CSV is data, not copy: it keeps
      // its own two-decimal-precision numeric value, unrounded further.
      Number(r.average.toFixed(2)),
      ...criteria.map((cr) => Number((r.perCriterion[cr.id] ?? 0).toFixed(2))),
      ...dropdownColumns.map(({ dc, option }) => r.perDropdown[dc.id]?.counts[option] ?? 0),
    ]);
    const csv = toCsv([header, ...dataRows]);
    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDispositionAttachment("results.csv"),
    });
  }

  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  const start = (page - 1) * perPage;
  // DEC-829 (w32 amendment): HYDRATION IS PER-PAGE -- slice the ranked/sorted
  // population BEFORE hydrating, so speakers/trackNames/recusals are only
  // ever fetched for the page's own row set, never the whole population.
  const pageRows = sortedRows.slice(start, start + perPage);
  const items = await hydrateResultsRows(c, plan, pageRows);
  return c.json({ items, total: sortedRows.length, page, perPage, round });
});

reviewPlansProgressRoutes.post("/api/v1/plans/:id/remind", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  // B9: the reminder shell names the event in its wordmark/footer -- one
  // extra owned lookup, not threaded through PlanRecord (DEC-037 amendment).
  const remindEvent = await getEventForOrg(c.var.db, plan.eventId, auth.orgId);
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
  // DEC-707 (wave-61 amendment): resolve the round through the SAME
  // parseRoundQuery GET /progress uses, so the count that labelled the
  // reminder button and the set it reaches can never be resolved against
  // different rounds.
  const round = parseRoundQuery(c, plan);
  const reviewerRows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const users = await repo.getUsersByIds(c.var.db, userIds);
  // DEC-707 (wave-3 amendment): same fold as GET /progress -- completed is a
  // subset of assigned, never a raw per-plan evaluation count.
  const evaluatedPairs = await repo.listEvaluatedPairsForPlan(c.var.db, plan.id, round);
  const evaluatedByReviewer = new Map<string, Set<string>>();
  // DEC-707 (wave-74 amendment): same fold as GET /progress -- zero new
  // reads, this reuses the evaluatedPairs load already above.
  const ratingsBySubmissionId = new Map<string, number>();
  for (const p of evaluatedPairs) {
    const set = evaluatedByReviewer.get(p.reviewerId) ?? new Set<string>();
    set.add(p.submissionId);
    evaluatedByReviewer.set(p.reviewerId, set);
    ratingsBySubmissionId.set(p.submissionId, (ratingsBySubmissionId.get(p.submissionId) ?? 0) + 1);
  }
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
  // DEC-707: EVERY reviewer's row (not pre-filtered) so selectRemindTargets
  // -- the SAME predicate the SPA's landing-page label counts through -- is
  // the single place that decides who a given scope actually reaches.
  const progressRows = users.map((user) => {
    const recusedExcluded = assignedExcludingRecused(assignments.get(user.userId) ?? [], recusedByUser.get(user.userId) ?? new Set());
    // DEC-707 (wave-74 amendment): the SAME recusal-then-saturation compose
    // as GET /progress -- so `selectRemindTargets(rows,'incomplete')` can
    // never nag a reviewer whose remaining assignments are all saturated by
    // OTHER reviewers.
    const assigned = assignedExcludingSaturated(
      recusedExcluded,
      ratingsBySubmissionId,
      evaluatedByReviewer.get(user.userId) ?? new Set<string>(),
      plan.maxEvaluations ?? undefined,
    );
    const assignedIds = new Set(assigned.map((s) => s.id));
    const evaluated = evaluatedByReviewer.get(user.userId) ?? new Set<string>();
    let completed = 0;
    for (const submissionId of evaluated) {
      if (assignedIds.has(submissionId)) completed += 1;
    }
    return { userId: user.userId, email: user.email, assignedCount: assigned.length, assigned: assigned.length, completed };
  });
  const laggards = selectRemindTargets(progressRows, scope);

  // DEC-535: bound the batch the same way DEC-319 bounds the J6 sibling.
  const { items: capped, remaining } = capById(laggards, (l) => l.userId, MAX_REVIEWER_REMINDER_BATCH);

  // DEC-603: one id per fan-out call, shared by every recipient in this
  // loop, so the comms history tab can group the batch into one row.
  const batchId = newId();

  // DEC-707 (wave-61 amendment): one batched account->contact resolution for
  // the capped laggard set (never a query per recipient) -- the SAME helper
  // GET /progress uses (see the top of this file).
  const nameByUserId = await repo.batchUserDisplayNames(c.var.db, capped.map((l) => l.userId));

  const queueUrl = `${resolveBaseUrl(c)}/admin/review/plans/${plan.id}`;
  const closeDateClause = plan.closeDate !== null ? ` (closes ${formatCalendarDate(plan.closeDate)})` : "";

  // DEC-238 (wave-66 amendment): the SAME constant subject string is used to
  // build the dedupe keys below AND to address the mailer.send call further
  // down -- one variable, never two literals that could drift apart.
  const reminderSubject = `Reminder: ${plan.name} review queue`;

  // DEC-238 (wave-66 amendment): a reminder is a send -- reuse the SAME
  // shared dedupe primitives compose/send already uses (loadRecentlySent,
  // dedupeCutoff, dedupeKey) rather than hand-rolling a second window. Keyed
  // on (event, lower(email), the constant per-plan reminder subject) so a
  // second "Remind laggards" click inside the hour skips instead of
  // re-mailing.
  const recentlySent = await loadRecentlySent(
    c.var.db,
    plan.eventId,
    capped.map((l) => ({ email: l.email, subject: reminderSubject })),
    dedupeCutoff(Date.now()),
  );
  const attempted = capped.filter((l) => !recentlySent.has(dedupeKey(l.email, reminderSubject)));
  const skipped = capped.filter((l) => recentlySent.has(dedupeKey(l.email, reminderSubject)));

  const reminded: string[] = [];
  const failed: { email: string; message: string }[] = [];

  // DEC-547/DEC-238 class 2 (wave-43 amendment): makeMailer is total -- it
  // always returns a Mailer (DevSink/EmailBinding/Unconfigured) and never
  // throws, so a misconfigured environment surfaces as a per-recipient
  // 'failed' row from UnconfiguredMailer.send inside the try/catch below
  // (DEC-923), never here.
  const mailer = makeMailer(c.var.db, c.env);

  // DEC-530 wave-70 amendment: up to MAIL_FANOUT_CONCURRENCY sends in
  // flight at once; results come back in INPUT order so reminded[]/failed[]
  // below reconstruct exactly what the old sequential loop produced.
  const results = await mapWithConcurrency(attempted, MAIL_FANOUT_CONCURRENCY, async (laggard) => {
    const name = nameByUserId.get(laggard.userId) ?? laggard.email;
    const text = `You have ${countOf(laggard.assignedCount - laggard.completed, "submission")} left to review in "${plan.name}"${closeDateClause}. Review here: ${queueUrl}`;
    // DEC-191: reviewers are users, not contacts; per-contact email history
    // intentionally excludes rows like this one.
    await mailer.send({
      to: { email: laggard.email, name },
      subject: reminderSubject,
      text,
      html: renderEmailHtml(text, {
        eventName: remindEvent?.name ?? null,
        reason: `you're a reviewer with outstanding evaluations in "${plan.name}"`,
      }),
      eventId: plan.eventId,
      contactId: null,
      batchId,
    });
  });
  results.forEach((result, i) => {
    const laggard = attempted[i]!;
    if (result.status === "fulfilled") {
      reminded.push(laggard.userId);
      return;
    }
    const err = result.reason;
    failed.push({ email: laggard.email, message: err instanceof Error ? err.message : String(err) });
  });
  return c.json({ reminded, sent: reminded.length, skipped: skipped.length, failed, remaining });
});
