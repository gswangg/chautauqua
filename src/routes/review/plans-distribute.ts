// Review API (J4) plan assignment-distribution endpoints (preview/apply of
// the round-robin distributor). Extracted from the former monolithic
// src/routes/review/plans.ts (803 lines, a merge-conflict hotspot) — see
// shared.ts for the parsing/authz helpers this sub-app depends on. Route
// files export a named Hono sub-app; only plans.ts composes these sub-apps
// into `reviewPlansRoutes` (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError, readOptionalJsonBody } from "../../server/http";
import * as repo from "../../server/repo/review";
import { DEC_786, DEC_824 } from "../../decisions";
import {
  distributeAssignments,
  maxSubmissionsForDistribute,
  MAX_DISTRIBUTE_ASSIGNMENT_WRITES,
  type DistributeReviewerScope,
} from "../../domain/review-distribute";
import { resolveAssignments, type ReviewerScopeRow } from "../../domain/evaluation";
import { requireOwnedPlan } from "./shared";

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

/** Amendment (wave 52): per-reviewer scope for distributeAssignments'
 * eligibility check -- broad (eligible for anything) means either an
 * explicit unrestricted ('All submissions') row, or simply no trackId-
 * scoped row at all (an explicit single-submission pick never narrows a
 * reviewer's eligibility for OTHER submissions -- only a track-scope row
 * does that). Otherwise the reviewer is restricted to their scoped
 * trackIds. */
function buildReviewerScopes(reviewerUserIds: string[], reviewerRows: ReviewerScopeRow[]): DistributeReviewerScope[] {
  return reviewerUserIds.map((userId) => {
    const rows = reviewerRows.filter((r) => r.userId === userId);
    const hasUnrestrictedRow = rows.some((r) => r.trackId === null && r.submissionId === null);
    const trackIds = [...new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
    const broad = hasUnrestrictedRow || trackIds.length === 0;
    return { userId, broad, trackIds };
  });
}

// DEC-786/DEC-824: pure round-robin distribution of the plan's own reviewer
// pool (every distinct userId already assigned to this plan, regardless of
// scope) across every submission the plan's filters resolve to, honoring
// this run's own `capPerReviewer`. Shared by the preview (writes NOTHING)
// and the apply endpoint below, so the two can never disagree about which
// pairs would be added.
// Amendment (wave 52): coverage/load ("existing") is resolved the SAME way
// every other reader resolves a reviewer's scope -- resolveAssignments
// (src/domain/evaluation.ts), not a flat filter over rows with an explicit
// submissionId. A broad ('All submissions') or track-scoped reviewer
// already covers every submission their scope reaches BEFORE this run, so
// distribute proposes nothing for a plan that scope alone already covers.
// Both preview and apply resolve trackIds (withTrackIds always true) so the
// two can never see a different pair set (DEC-840's byte-identical promise).
async function computeDistribution(
  c: { var: { db: import("../../server/context").Db } },
  plan: repo.PlanRecord,
  capPerReviewer: number | null,
) {
  const [reviewerRows, submissions, recusals] = await Promise.all([
    repo.listReviewerRowsForPlan(c.var.db, plan.id),
    repo.listPlanFilteredSubmissions(c.var.db, plan, { withTrackIds: true }),
    repo.listRecusalsForPlan(c.var.db, plan.id),
  ]);
  const reviewerUserIds = [...new Set(reviewerRows.map((r) => r.userId))].sort();
  const reviewerScopes = buildReviewerScopes(reviewerUserIds, reviewerRows);
  const resolved = resolveAssignments(
    submissions.map((s) => ({ id: s.id, trackIds: s.trackIds })),
    reviewerRows,
  );
  // w11-b: de-duplicate on userId|submissionId before this reaches
  // distributeAssignments/buildPerReviewer -- the defensive read-side twin of
  // task-w11-c's writer-side onConflictDoNothing fix. resolveAssignments folds
  // a reviewer's rows into coverage already, but a duplicate plan_reviewer row
  // (e.g. a repeat POST /reviewers, DEC-786 §addReviewers) must not inflate a
  // reviewer's `before` count or let a duplicate pair spend their cap twice.
  const existingKeys = new Set<string>();
  const existing: { userId: string; submissionId: string }[] = [];
  for (const [userId, subs] of resolved) {
    for (const s of subs) {
      const key = `${userId}::${s.id}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      existing.push({ userId, submissionId: s.id });
    }
  }
  const recused = recusals.map((r) => ({ userId: r.userId, submissionId: r.submissionId }));
  const reviewsPerSubmission = plan.maxEvaluations ?? 1;
  const { created, shortfall } = distributeAssignments({
    submissions: submissions.map((s) => ({ id: s.id, trackIds: s.trackIds })),
    reviewers: reviewerScopes,
    reviewsPerSubmission,
    existing,
    recused,
    capPerReviewer,
  });
  return { created, shortfall, submissions, reviewerUserIds, reviewerRows, reviewerScopes, existing, reviewsPerSubmission };
}

// DEC-786/DEC-824: preview writes NOTHING -- the organizer sees exactly
// which pairs would be added, the per-reviewer load those pairs would
// produce, and the honest shortfall this run's cap could not meet, before
// confirming the apply call below.
reviewPlansDistributeRoutes.get("/api/v1/plans/:id/assignments/distribute/preview", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const capPerReviewer = parseCapPerReviewer(c.req.query("cap"));
  const { created, shortfall, submissions, reviewerUserIds, reviewerScopes, existing, reviewsPerSubmission } = await computeDistribution(
    c,
    plan,
    capPerReviewer,
  );

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const nameByUserId = await repo.batchUserDisplayNames(c.var.db, reviewerUserIds);
  const users = await repo.getUsersByIds(c.var.db, reviewerUserIds);
  const emailByUserId = new Map(users.map((u) => [u.userId, u.email]));
  const scopeTrackIds = [...new Set(reviewerScopes.flatMap((s) => s.trackIds))];
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
    reviewerScopes,
    existing,
    created,
    submissions,
    reviewsPerSubmission,
    capPerReviewer,
    nameByUserId,
    emailByUserId,
    trackNameById,
  });

  // w11-b/DEC-840: preview and apply must never disagree -- a preview whose
  // pairs the apply would refuse to write must say so, computed from the
  // SAME created.length the apply checks against MAX_DISTRIBUTE_ASSIGNMENT_WRITES.
  return c.json({
    cap: capPerReviewer,
    totalAssigned,
    items,
    perReviewer,
    shortfall: shortfallItems,
    writeCap: MAX_DISTRIBUTE_ASSIGNMENT_WRITES,
    writeCapExceeded: created.length > MAX_DISTRIBUTE_ASSIGNMENT_WRITES,
  });
});

// DEC-840: shared by preview and (indirectly, since only preview needs the
// display shape) render of per-reviewer before/after/eligibility -- the
// apply endpoint itself does not need this, only the plain created pairs.
// Amendment (wave 52): `before`, `wrongTrack`, and `capReached` are all
// derived from the SAME resolved-existing/eligibility inputs the distributor
// itself used (distributeAssignments in src/domain/review-distribute.ts),
// not re-inferred from raw plan_reviewer rows -- an 'All submissions'
// reviewer's `before` reflects their real resolved load, and `wrongTrack`
// matches the distributor's own broad/trackIds eligibility predicate.
function buildPerReviewer(args: {
  reviewerUserIds: string[];
  reviewerScopes: { userId: string; broad: boolean; trackIds: string[] }[];
  existing: { userId: string; submissionId: string }[];
  created: { userId: string; submissionId: string }[];
  submissions: { id: string; trackIds: string[] }[];
  reviewsPerSubmission: number;
  capPerReviewer: number | null;
  nameByUserId: Map<string, string | null>;
  emailByUserId: Map<string, string>;
  trackNameById: Map<string, string>;
}) {
  const { reviewerUserIds, reviewerScopes, existing, created, submissions, reviewsPerSubmission, capPerReviewer, nameByUserId, emailByUserId, trackNameById } = args;

  // Existing load per reviewer (before this run, already resolved the same
  // way the distributor resolves it -- see computeDistribution's `existing`)
  // plus how many this run would add, so the confirm dialog shows a
  // fair-looking before/after.
  const existingCountByUser = new Map<string, number>();
  for (const p of existing) {
    existingCountByUser.set(p.userId, (existingCountByUser.get(p.userId) ?? 0) + 1);
  }
  const addedByUser = new Map<string, number>();
  for (const p of created) addedByUser.set(p.userId, (addedByUser.get(p.userId) ?? 0) + 1);

  const scopeByUser = new Map(reviewerScopes.map((s) => [s.userId, s]));

  // Submissions still short of `reviewsPerSubmission` reviewers BEFORE this
  // run (resolved existing coverage) -- what a reviewer's scope would need
  // to reach for "wrong track" to be false. Mirrors the distributor's own
  // per-submission `need` computation.
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
    const scope = scopeByUser.get(userId);
    const broad = scope?.broad ?? true;
    const trackIds = scope?.trackIds ?? [];
    // Same eligibility predicate the distributor used: a non-broad reviewer
    // is wrong-track when none of their scoped tracks appear on a still-short
    // submission.
    const wrongTrack = added === 0 && !broad && !trackIds.some((t) => unassignedTrackIds.has(t));
    const capReached = added === 0 && capPerReviewer !== null && before >= capPerReviewer;
    const reason: "cap_reached" | "wrong_track" | null = capReached ? "cap_reached" : wrongTrack ? "wrong_track" : null;
    const trackName = trackIds.length > 0
      ? trackIds.map((t) => trackNameById.get(t)).filter((n): n is string => !!n).join(", ") || null
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
  const bodyRecord = await readOptionalJsonBody(c);
  const capPerReviewer = parseCapPerReviewer(bodyRecord.cap);
  const { created, reviewsPerSubmission } = await computeDistribution(c, plan, capPerReviewer);
  // w11-b: pre-write refusal on the plan_reviewer fan-out -- at SPEC's stated
  // scale (up to 5,000 submissions/event, maxEvaluations 3) the unbounded
  // set could be ~15,000 inserts in one request, exhausting D1's per-request
  // statement budget mid-write with no transaction to roll back, leaving the
  // plan half-distributed. Refuse BEFORE any write (mirrors DEC-079/DEC-528's
  // task-assignment fan-out and agenda's MAX_AUTO_SCHEDULE_PLACEMENTS), and
  // name a forward path derived from the same cap the message quotes, never
  // a bare internal number.
  if (created.length > MAX_DISTRIBUTE_ASSIGNMENT_WRITES) {
    const maxSubmissions = maxSubmissionsForDistribute(reviewsPerSubmission);
    throw new ApiError(
      "invalid",
      `Distributing this plan would create ${created.length} reviewer assignments, over the cap of ${MAX_DISTRIBUTE_ASSIGNMENT_WRITES} — narrow the plan's track filters to at most ${maxSubmissions} submissions, or lower \`cap\``,
      {
        cap: `${created.length} exceeds cap ${MAX_DISTRIBUTE_ASSIGNMENT_WRITES}; narrow the plan's track filters to at most ${maxSubmissions} submissions, or lower cap`,
      },
    );
  }
  // DEC-924 (amendment, wave 47): one set-based insert instead of a
  // per-assignment loop -- addReviewers chunks through chunkRowsForInsert
  // (DEC-528) and returns [] for an empty input, so the empty-set case still
  // 201s with created: 0.
  await repo.addReviewers(c.var.db, plan.id, created.map((p) => ({ userId: p.userId, trackId: null, submissionId: p.submissionId })));
  return c.json({ created: created.length }, 201);
});
