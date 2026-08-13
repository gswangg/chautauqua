// Review API (J4) plan reviewer-assignment endpoints (add/list/remove +
// scope-preview). Extracted from the former monolithic
// src/routes/review/plans.ts (803 lines, a merge-conflict hotspot) — see
// shared.ts for the parsing/authz helpers this sub-app depends on. Route
// files export a named Hono sub-app; only plans.ts composes these sub-apps
// into `reviewPlansRoutes` (DEC-012/DEC-013).

import { Hono } from "hono";
import type { Db } from "../../server/context";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError, parseBoundedIdArray, readJsonBody } from "../../server/http";
import { clampPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import type { PlanReviewerRecord } from "../../server/repo/review/reviewers";
import { DEC_572, DEC_623, DEC_659, DEC_924 } from "../../decisions";
import { currentAuth, requireOwnedPlan } from "./shared";

export const reviewPlansReviewersRoutes = new Hono<AppEnv>();

void DEC_572; // /plans/:id/scope-preview: true count + bounded preview before a track-scope fan-out below
void DEC_623; // POST /plans/:id/reviewers: submissionId resolved through findSubmissionIdByRefOrId below
void DEC_659; // GET + POST /plans/:id/reviewers: trackName/submissionRef/submissionTitle labels below
void DEC_924; // POST /plans/:id/reviewers: submissionIds[] array form below -- one set-based, all-or-nothing request

export interface DecoratedReviewerRow {
  id: string;
  userId: string;
  email: string;
  trackId: string | null;
  submissionId: string | null;
  trackName: string | null;
  submissionRef: string | null;
  submissionTitle: string | null;
}

/** DEC-659: reviewer assignment scope speaks in names, not ULIDs -- ONE
 * batched query over the set's distinct non-null trackIds and ONE over the
 * distinct non-null submissionIds (never a query per row). Shared by the GET
 * list and both POST forms so a just-created row never renders "(removed)"
 * before a reload. */
async function decorateReviewerRows(db: Db, rows: PlanReviewerRecord[]): Promise<DecoratedReviewerRow[]> {
  const [users, trackNameById, submissionLabelById] = await Promise.all([
    repo.getUsersByIds(db, [...new Set(rows.map((r) => r.userId))]),
    repo.getTrackNamesByIds(db, [...new Set(rows.map((r) => r.trackId).filter((id): id is string => id !== null))]),
    repo.getSubmissionLabelsByIds(
      db,
      [...new Set(rows.map((r) => r.submissionId).filter((id): id is string => id !== null))],
    ),
  ]);
  const emailByUserId = new Map(users.map((u) => [u.userId, u.email]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    email: emailByUserId.get(r.userId) ?? "",
    trackId: r.trackId,
    submissionId: r.submissionId,
    trackName: r.trackId !== null ? (trackNameById.get(r.trackId) ?? null) : null,
    submissionRef: r.submissionId !== null ? (submissionLabelById.get(r.submissionId)?.ref ?? null) : null,
    submissionTitle: r.submissionId !== null ? (submissionLabelById.get(r.submissionId)?.title ?? null) : null,
  }));
}

reviewPlansReviewersRoutes.post("/api/v1/plans/:id/reviewers", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const body = await readJsonBody(c);
  if (typeof body.userId !== "string" || body.userId.length === 0) {
    throw new ApiError("invalid", "Invalid reviewer assignment", { userId: "required" });
  }
  await repo.requireOrgUser(c.var.db, body.userId, currentAuth(c).orgId);

  // DEC-924: the array form -- one set-based, all-or-nothing request that
  // assigns body.userId to every submission named in submissionIds. Every
  // ref/id is resolved in ONE query (findSubmissionIdsByRefsOrIds), the
  // plan's own filters_json trackIds are checked for the WHOLE set in ONE
  // query (submissionsMatchingPlanFilters), and every plan_reviewer row is
  // inserted through addReviewers -- an unknown id or an id outside the
  // plan's filters refuses the entire request (400, fields.submissionIds
  // naming the offending refs) before anything is written. The existing
  // single submissionId/trackId forms below are unchanged.
  if (Array.isArray(body.submissionIds)) {
    const rawInputs = parseBoundedIdArray(body.submissionIds, "submissionIds");
    const inputs = [...new Set(rawInputs)];
    const resolvedByInput = await repo.findSubmissionIdsByRefsOrIds(c.var.db, plan.eventId, inputs);
    const unknown = inputs.filter((input) => !resolvedByInput.has(input));
    if (unknown.length > 0) {
      throw new ApiError("invalid", "Invalid reviewer assignment", {
        submissionIds: `unknown submission for this event -- use the ref (e.g. SES-014) or the internal id: ${unknown.join(", ")}`,
      });
    }
    if (plan.filters?.trackIds && plan.filters.trackIds.length > 0) {
      const resolvedIds = inputs.map((input) => resolvedByInput.get(input) as string);
      const inFilters = await repo.submissionsMatchingPlanFilters(c.var.db, plan, resolvedIds);
      const outOfScope = inputs.filter((input) => !inFilters.has(resolvedByInput.get(input) as string));
      if (outOfScope.length > 0) {
        throw new ApiError("invalid", "Invalid reviewer assignment", {
          submissionIds: `not inside this plan's tracks -- widen the plan's filters or assign by track: ${outOfScope.join(", ")}`,
        });
      }
    }
    const created = await repo.addReviewers(
      c.var.db,
      plan.id,
      inputs.map((input) => ({
        userId: body.userId as string,
        trackId: null,
        submissionId: resolvedByInput.get(input) as string,
      })),
    );
    const items = await decorateReviewerRows(c.var.db, created);
    return c.json({ items, total: items.length }, 201);
  }

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

  // DEC-924 (amendment, wave 47): addReviewer (singular) is retired -- the
  // single-pair path routes through the same set-based addReviewers with a
  // one-element array, keeping the wire contract (a single created object,
  // not an array) unchanged.
  const [created] = await repo.addReviewers(c.var.db, plan.id, [{ userId: body.userId, trackId, submissionId }]);
  if (!created) throw new Error("addReviewers: insert did not persist");
  const [decorated] = await decorateReviewerRows(c.var.db, [created]);
  if (!decorated) throw new Error("decorateReviewerRows: did not return a row for the created reviewer");
  return c.json(decorated, 201);
});

// DEC-572: preview a plan_reviewer track-scope assignment BEFORE it fans out
// -- the true COUNT plus a bounded (<=200) row list, so PlanEditor can show
// "Assign N submissions" and let the organizer confirm rather than the
// server silently granting access to every plan-filtered submission in the
// track. 400 on a missing/unknown trackId, mirroring the POST /reviewers
// DEC-354 in-event check.
reviewPlansReviewersRoutes.get("/api/v1/plans/:id/scope-preview", requireOrganizer, async (c) => {
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

reviewPlansReviewersRoutes.get("/api/v1/plans/:id/reviewers", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const [rows, total] = await Promise.all([
    repo.listReviewerRowsForPlan(c.var.db, plan.id, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countReviewerRowsForPlan(c.var.db, plan.id),
  ]);
  const items = await decorateReviewerRows(c.var.db, rows);
  return c.json({ items, total, page, perPage });
});

reviewPlansReviewersRoutes.delete("/api/v1/plans/:id/reviewers/:reviewerId", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const reviewerId = c.req.param("reviewerId");
  const row = await repo.getReviewerRowById(c.var.db, reviewerId);
  if (!row || row.planId !== plan.id) throw new ApiError("not_found", "Reviewer assignment not found");
  await repo.removeReviewerById(c.var.db, reviewerId);
  return c.body(null, 204);
});
