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
import { listEvaluationsForSubmission } from "../../server/repo/review/evaluations";
import { DEC_596 } from "../../decisions";

void DEC_596; // reviewerName is null exactly when the owning plan is anonymized, decided below

export const reviewEvaluationsRoutes = new Hono<AppEnv>();

reviewEvaluationsRoutes.get("/api/v1/submissions/:id/evaluations", requireOrganizer, async (c) => {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const submissionId = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, submissionId);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const rows = await listEvaluationsForSubmission(c.var.db, submissionId);
  const items = rows.map((r) => ({
    planId: r.planId,
    planName: r.planName,
    round: r.round,
    reviewerName: r.reviewerName,
    scores: r.scores,
    comment: r.comment,
    submittedAt: r.submittedAt,
  }));
  return c.json({ items });
});
