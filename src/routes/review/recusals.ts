// Recusal (DEC-271, ABS-12): reviewer conflict-of-interest self-exclusion.
// Extracted from the former monolithic src/routes/review.ts (see shared.ts
// for the parsing/authz helpers this sub-app depends on). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson } from "../../server/middleware";
import { ApiError, readOptionalJsonBody } from "../../server/http";
import * as repo from "../../server/repo/review";
import { DEC_271, DEC_425 } from "../../decisions";
import { MAX_RECUSAL_REASON_LENGTH, isPlanOpen } from "../../domain/evaluation";
import { currentAuth, requireReviewerOrOrganizer, asRecord, requireAssignedPlan, toRecusalOut } from "./shared";

export const reviewRecusalRoutes = new Hono<AppEnv>();
void DEC_271; // recusal endpoints below: POST/DELETE .../recusals/:submissionId, queue exclusion, 409 on scoring, progress math
void DEC_425; // MAX_RECUSAL_REASON_LENGTH single-sourced in src/domain/evaluation.ts

reviewRecusalRoutes.post("/api/v1/review/plans/:planId/recusals/:submissionId", csrfJson, async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("planId"));
  const submissionId = c.req.param("submissionId");

  // DEC-211: existence-hiding 404 for a submission outside the plan's event,
  // enforced before any role-scope check.
  const inEvent = await repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId);
  if (!inEvent) throw new ApiError("not_found", "Submission not found");

  // DEC-018 (wave-10 amendment): a recusal is a write into the plan's round
  // -- gate it on the same open/close window as the score PUT, non-organizer
  // only.
  if (auth.role !== "organizer" && !isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone)) {
    throw new ApiError("conflict", "This review plan is not currently open");
  }

  if (auth.role !== "organizer") {
    const inScope = await repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId);
    if (!inScope) throw new ApiError("not_found", "Submission not found");
  }

  const body = asRecord(await readOptionalJsonBody(c));
  let reason: string | null = null;
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== "string" || body.reason.length > MAX_RECUSAL_REASON_LENGTH) {
      throw new ApiError("invalid", "Invalid recusal", {
        reason: `must be a string of at most ${MAX_RECUSAL_REASON_LENGTH} characters`,
      });
    }
    reason = body.reason;
  }

  const { recusal, created } = await repo.createRecusal(c.var.db, { planId: plan.id, submissionId, userId: auth.userId, reason });
  return c.json({ recusal: toRecusalOut(recusal) }, created ? 201 : 200);
});

reviewRecusalRoutes.delete("/api/v1/review/plans/:planId/recusals/:submissionId", csrfJson, async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("planId"));
  const submissionId = c.req.param("submissionId");

  const inEvent = await repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId);
  if (!inEvent) throw new ApiError("not_found", "Submission not found");

  // DEC-018 (wave-10 amendment): same write-window gate as POST above.
  if (auth.role !== "organizer" && !isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone)) {
    throw new ApiError("conflict", "This review plan is not currently open");
  }

  if (auth.role !== "organizer") {
    const inScope = await repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId);
    if (!inScope) throw new ApiError("not_found", "Submission not found");
  }

  const deleted = await repo.deleteRecusal(c.var.db, plan.id, submissionId, auth.userId);
  if (!deleted) throw new ApiError("not_found", "Recusal not found");
  return c.body(null, 204);
});
