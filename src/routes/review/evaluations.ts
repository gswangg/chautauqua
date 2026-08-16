// Review API (J4) organiser-facing evaluations-for-submission read (DEC-596):
// the organiser reads the SAME evaluation the reviewer wrote, across every
// plan the submission has ever been scored under. A NEW file (not plans.ts)
// so it does not contend with plan CRUD merges; src/routes/review/index.ts
// mounts this sub-app with one line.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getSubmissionOwnership } from "../../server/repo/submissions";
import { listEvaluationsForSubmission, listPlanCriteriaByIds } from "../../server/repo/review/evaluations";
import { getPlanForOrg } from "../../server/repo/review/plans";
import { countAssignedReviewersForSubmission } from "../../server/repo/review/reviewers";
import { criteriaForRound, computeWeightedScore, type EvaluationCriterionDef } from "../../domain/evaluation";
import { DEC_596, DEC_723, DEC_736, DEC_763 } from "../../decisions";

void DEC_596; // organiser reads the same evaluation the reviewer wrote, across every plan
void DEC_723; // each item carries its own round's criteria + the plan's weighted score
void DEC_736; // reviewerName is always populated -- anonymization never hides the reviewer from the organiser
void DEC_763; // an optional ?planId= scopes the row disclosure to the plan the caller is looking at

export const reviewEvaluationsRoutes = new Hono<AppEnv>();

reviewEvaluationsRoutes.get("/api/v1/submissions/:id/evaluations", requireOrganizer, async (c) => {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const submissionId = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, submissionId);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const planIdParam = c.req.query("planId");
  if (planIdParam) {
    const plan = await getPlanForOrg(c.var.db, planIdParam, auth.orgId);
    if (!plan || plan.eventId !== ownership.eventId) throw new ApiError("not_found", "Plan not found");
  }

  // DEC-596: `assigned` (reviewers assigned, not evaluation rows) rides the
  // SAME wave as the evaluations read -- no extra round trip.
  const [rows, assigned] = await Promise.all([
    listEvaluationsForSubmission(c.var.db, submissionId, planIdParam),
    countAssignedReviewersForSubmission(c.var.db, ownership.eventId, submissionId, planIdParam),
  ]);

  // DEC-723: an evaluation read carries its own round's criteria and the
  // plan's own weighted score -- never bare criterion ids. Plan lookups
  // batch over the DISTINCT planIds in the row set (one query).
  const planIds = [...new Set(rows.map((r) => r.planId))];
  const plansById = await listPlanCriteriaByIds(c.var.db, planIds);

  const items = rows.map((r) => {
    const plan = plansById.get(r.planId);
    if (!plan) throw new Error(`evaluations read: plan ${r.planId} missing for a row that references it`);
    const roundCriteria = criteriaForRound(plan.criteria, plan.roundCriteriaJson, r.round);
    const criteria = roundCriteria.map((c) => ({
      id: c.id,
      label: c.label,
      kind: c.kind,
      weight: c.weight ?? 0,
    }));
    const ratingCriteria: EvaluationCriterionDef[] = roundCriteria.filter((c) => c.kind === "rating");
    // DEC-723: null when there are no rating criteria, or any rating
    // criterion has no value in `scores` -- an incomplete review has no
    // score; a read must never throw computeWeightedScore's invariant.
    const complete =
      ratingCriteria.length > 0 &&
      ratingCriteria.every((c) => r.scores[c.id] !== undefined && r.scores[c.id] !== null);
    const score = complete
      ? computeWeightedScore(
          r.scores as Record<string, number>,
          ratingCriteria.map((c) => ({ id: c.id, label: c.label, weight: c.weight as number })),
          plan.scale,
        )
      : null;

    return {
      planId: r.planId,
      planName: r.planName,
      round: r.round,
      reviewerName: r.reviewerName,
      scores: r.scores,
      comment: r.comment,
      submittedAt: r.submittedAt,
      criteria,
      score,
    };
  });
  // DEC-461(a) list envelope. This read is unpaginated on purpose -- one
  // submission's evaluations are bounded by (plans x reviewers), so the whole
  // set is always one page.
  return c.json({ items, total: items.length, page: 1, perPage: items.length, assigned });
});
