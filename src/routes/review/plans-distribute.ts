// Review API (J4) plan assignment-distribution endpoints (preview/apply of
// the round-robin distributor). Extracted from the former monolithic
// src/routes/review/plans.ts (803 lines, a merge-conflict hotspot) — see
// shared.ts for the parsing/authz helpers this sub-app depends on. Route
// files export a named Hono sub-app; only plans.ts composes these sub-apps
// into `reviewPlansRoutes` (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/review";
import { DEC_786, DEC_824 } from "../../decisions";
import { distributeAssignments } from "../../domain/review-distribute";
import { asRecord, requireOwnedPlan } from "./shared";

export const reviewPlansDistributeRoutes = new Hono<AppEnv>();

void DEC_786; // /plans/:id/assignments/distribute(/preview): pure round-robin below
void DEC_824; // capPerReviewer + honest shortfall below

/** DEC-824/DEC-840: `cap` is a parameter of THIS RUN (never a column on the
 * plan) -- accepted from the preview's query string (a string) or the
 * apply's JSON body (a number), positive integer or absent/null, anything
 * else a loud 400 naming the field. */
function parseCapPerReviewer(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    throw new ApiError("invalid", "Invalid distribution request", { cap: "must be a positive integer, or absent/null" });
  }
  return n;
}

// DEC-786/DEC-824: pure round-robin distribution of the plan's own reviewer
// pool (every distinct userId already assigned to this plan, regardless of
// scope) across every submission the plan's filters resolve to, honoring
// this run's own `capPerReviewer`. Shared by the preview (writes NOTHING)
// and the apply endpoint below, so the two can never disagree about which
// pairs would be added.
async function computeDistribution(
  c: { var: { db: import("../../server/context").Db } },
  plan: repo.PlanRecord,
  capPerReviewer: number | null,
  opts?: { withTrackIds?: boolean },
) {
  const [reviewerRows, submissions, recusals] = await Promise.all([
    repo.listReviewerRowsForPlan(c.var.db, plan.id),
    repo.listPlanFilteredSubmissions(c.var.db, plan, { withTrackIds: opts?.withTrackIds ?? false }),
    repo.listRecusalsForPlan(c.var.db, plan.id),
  ]);
  const reviewerUserIds = [...new Set(reviewerRows.map((r) => r.userId))].sort();
  const existing = reviewerRows
    .filter((r): r is typeof r & { submissionId: string } => r.submissionId !== null)
    .map((r) => ({ userId: r.userId, submissionId: r.submissionId }));
  const recused = recusals.map((r) => ({ userId: r.userId, submissionId: r.submissionId }));
  const reviewsPerSubmission = plan.maxEvaluations ?? 1;
  const { created, shortfall } = distributeAssignments({
    submissionIds: submissions.map((s) => s.id),
    reviewerUserIds,
    reviewsPerSubmission,
    existing,
    recused,
    capPerReviewer,
  });
  return { created, shortfall, submissions, reviewerUserIds, reviewerRows, existing, reviewsPerSubmission };
}

// DEC-786/DEC-824: preview writes NOTHING -- the organizer sees exactly
// which pairs would be added, the per-reviewer load those pairs would
// produce, and the honest shortfall this run's cap could not meet, before
// confirming the apply call below.
reviewPlansDistributeRoutes.get("/api/v1/plans/:id/assignments/distribute/preview", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const capPerReviewer = parseCapPerReviewer(c.req.query("cap"));
  const { created, shortfall, submissions, reviewerUserIds, reviewerRows, existing, reviewsPerSubmission } = await computeDistribution(
    c,
    plan,
    capPerReviewer,
    { withTrackIds: true },
  );

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const nameByUserId = await repo.batchUserDisplayNames(c.var.db, reviewerUserIds);
  const users = await repo.getUsersByIds(c.var.db, reviewerUserIds);
  const emailByUserId = new Map(users.map((u) => [u.userId, u.email]));
  const scopeTrackIds = [
    ...new Set(reviewerRows.filter((r) => r.trackId !== null).map((r) => r.trackId as string)),
  ];
  const trackIdsOnShortfall = [
    ...new Set(shortfall.map((s) => submissionById.get(s.submissionId)?.trackIds ?? []).flat()),
  ];
  const trackNameById = await repo.getTrackNamesByIds(c.var.db, [...new Set([...scopeTrackIds, ...trackIdsOnShortfall])]);

  const items = created.map((p) => ({ submissionId: p.submissionId, userId: p.userId }));

  const shortfallItems = shortfall.map((s) => {
    const sub = submissionById.get(s.submissionId);
    const trackNames = (sub?.trackIds ?? []).map((id) => trackNameById.get(id)).filter((n): n is string => !!n);
    return {
      submissionId: s.submissionId,
      ref: sub?.ref ?? "",
      title: sub?.title ?? "",
      trackName: trackNames.length > 0 ? trackNames.join(", ") : null,
      needed: s.missing,
      reason: s.reason,
    };
  });

  const { perReviewer, totalAssigned } = buildPerReviewer({
    reviewerUserIds,
    reviewerRows,
    existing,
    created,
    submissions,
    reviewsPerSubmission,
    capPerReviewer,
    nameByUserId,
    emailByUserId,
    trackNameById,
  });

  return c.json({
    cap: capPerReviewer,
    totalAssigned,
    items,
    perReviewer,
    shortfall: shortfallItems,
  });
});

// DEC-840: shared by preview and (indirectly, since only preview needs the
// display shape) render of per-reviewer before/after/eligibility -- the
// apply endpoint itself does not need this, only the plain created pairs.
function buildPerReviewer(args: {
  reviewerUserIds: string[];
  reviewerRows: { userId: string; trackId: string | null; submissionId: string | null }[];
  existing: { userId: string; submissionId: string }[];
  created: { userId: string; submissionId: string }[];
  submissions: { id: string; trackIds: string[] }[];
  reviewsPerSubmission: number;
  capPerReviewer: number | null;
  nameByUserId: Map<string, string | null>;
  emailByUserId: Map<string, string>;
  trackNameById: Map<string, string>;
}) {
  const { reviewerUserIds, reviewerRows, existing, created, submissions, reviewsPerSubmission, capPerReviewer, nameByUserId, emailByUserId, trackNameById } = args;

  // Existing load per reviewer (before this run) plus how many this run
  // would add, so the confirm dialog shows a fair-looking before/after.
  const existingCountByUser = new Map<string, number>();
  for (const p of existing) {
    existingCountByUser.set(p.userId, (existingCountByUser.get(p.userId) ?? 0) + 1);
  }
  const addedByUser = new Map<string, number>();
  for (const p of created) addedByUser.set(p.userId, (addedByUser.get(p.userId) ?? 0) + 1);

  // DEC-824: a reviewer's own scope -- the union of trackIds across every
  // plan_reviewer row for that userId that scopes to a track (submissionId
  // null, trackId set). Empty means the reviewer's scope is broad ("All
  // submissions") and "wrong track" never applies to them.
  const scopeTrackIdsByUser = new Map<string, Set<string>>();
  for (const row of reviewerRows) {
    if (row.trackId === null) continue;
    const set = scopeTrackIdsByUser.get(row.userId) ?? new Set<string>();
    set.add(row.trackId);
    scopeTrackIdsByUser.set(row.userId, set);
  }
  // Submissions still short of `reviewsPerSubmission` reviewers BEFORE this
  // run (existing coverage only) -- what a reviewer's scope would need to
  // reach for "wrong track" to be false.
  const existingCoverageBySubmission = new Map<string, number>();
  for (const p of existing) {
    existingCoverageBySubmission.set(p.submissionId, (existingCoverageBySubmission.get(p.submissionId) ?? 0) + 1);
  }
  const unassignedTrackIds = new Set<string>();
  for (const sub of submissions) {
    const covered = existingCoverageBySubmission.get(sub.id) ?? 0;
    if (covered < reviewsPerSubmission) for (const t of sub.trackIds) unassignedTrackIds.add(t);
  }

  const perReviewer = reviewerUserIds.map((userId) => {
    const added = addedByUser.get(userId) ?? 0;
    const before = existingCountByUser.get(userId) ?? 0;
    const scope = scopeTrackIdsByUser.get(userId);
    const wrongTrack = added === 0 && scope !== undefined && scope.size > 0 && ![...scope].some((t) => unassignedTrackIds.has(t));
    const capReached = added === 0 && capPerReviewer !== null && before >= capPerReviewer;
    const reason: "cap_reached" | "wrong_track" | null = capReached ? "cap_reached" : wrongTrack ? "wrong_track" : null;
    const trackName = scope && scope.size > 0
      ? [...scope].map((t) => trackNameById.get(t)).filter((n): n is string => !!n).join(", ") || null
      : null;
    return {
      userId,
      name: nameByUserId.get(userId) ?? emailByUserId.get(userId) ?? userId,
      trackName,
      before,
      after: before + added,
      added,
      eligible: reason === null,
      reason,
    };
  });

  return { perReviewer, totalAssigned: created.length };
}

// DEC-786/DEC-824: applies exactly the pairs the preview above computed
// under the SAME cap -- no re-derivation, no independent randomness or
// clock, so a preview the organizer saw is exactly what gets written.
reviewPlansDistributeRoutes.post("/api/v1/plans/:id/assignments/distribute", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  // DEC-824: capPerReviewer is optional -- an empty/absent JSON body is
  // valid (uncapped), matching /remind's optional-body convention.
  let capPerReviewer: number | null = null;
  const rawBody = await c.req.text();
  if (rawBody.length > 0) {
    const bodyRecord = asRecord(JSON.parse(rawBody));
    capPerReviewer = parseCapPerReviewer(bodyRecord.cap);
  }
  const { created } = await computeDistribution(c, plan, capPerReviewer);
  for (const p of created) {
    await repo.addReviewer(c.var.db, plan.id, { userId: p.userId, submissionId: p.submissionId });
  }
  return c.json({ created: created.length }, 201);
});
