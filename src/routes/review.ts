// Review API (J4), per DEC-018/DEC-012/DEC-013/DEC-017. Route file exports a
// named Hono<AppEnv> sub-app; only src/index.ts mounts it. Handlers stay
// thin: parse/authz -> repo -> pure domain core -> response. Track
// filtering reads submission_track ONLY (DEC-017).

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { csrfJson, requireOrganizer } from "../server/middleware";
import { ApiError } from "../server/http";
import { makeMailer } from "../server/context";
import { textToHtml } from "../mail/render";
import {
  aggregateSubmission,
  buildReviewerQueue,
  buildResultsRows,
  needsMoreRatings,
  isPlanOpen,
  anonymizeForReviewer,
  validateEvaluationScores,
  resolveAssignments,
  criteriaForRound,
  type EvaluationCriterion,
  type EvaluationCriterionDef,
  type EvaluationScores,
} from "../domain/evaluation";
import { toCsv } from "../lib/csv";
import * as repo from "../server/repo/review";
import { roundCriteriaJsonOf } from "../server/repo/review";
import type { PlanRecord } from "../server/repo/review";
import * as eventsRepo from "../server/repo/events";
import { DEC_015, DEC_123, DEC_146, DEC_147, DEC_148, DEC_213 } from "../decisions";

export const reviewRoutes = new Hono<AppEnv>();
void DEC_123; // criteria/scale immutability guard on PATCH /api/v1/plans/:id below
void DEC_015; // append-only migrations: migrations/0010_round_criteria.sql
void DEC_146; // PlanEditor.tsx retains the null-safe SPA date guards this task must preserve
void DEC_147; // per-round scorecards: round_criteria_json + criteriaForRound resolution
void DEC_148; // free-text 'text' criterion kind
void DEC_213; // per-round criteria freeze on PATCH /api/v1/plans/:id below

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function currentAuth(c: { var: { auth?: { userId: string; role: string; orgId: string } } }) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

/** Inline reviewer-or-organizer check (DEC-018): requireReviewer stays
 * organizer-only-widening-free; /api/v1/review/* accepts either role. */
function requireReviewerOrOrganizer(c: { var: { auth?: { role: string } } }): void {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  if (auth.role !== "reviewer" && auth.role !== "organizer") {
    throw new ApiError("forbidden", "Requires role 'reviewer' or 'organizer'");
  }
}

function parseScale(body: Record<string, unknown>, errors: Record<string, string>): { min: number; max: number } | undefined {
  const scale = body.scale;
  if (typeof scale !== "object" || scale === null) {
    errors.scale = "required { min, max }";
    return undefined;
  }
  const s = scale as Record<string, unknown>;
  if (typeof s.min !== "number" || typeof s.max !== "number" || s.min >= s.max) {
    errors.scale = "must be { min: number, max: number } with min < max";
    return undefined;
  }
  return { min: s.min, max: s.max };
}

/** Shared criteria-array validator (DEC-147/DEC-148): used for both the
 * plan's base `criteria` and every round override in `roundCriteria`. Writes
 * a single error under `errKey` and returns undefined on the first problem
 * found -- callers pass a distinct errKey per array so a base-criteria error
 * and a round-override error never collide. */
function parseCriteriaList(
  list: unknown,
  errors: Record<string, string>,
  errKey: string,
): EvaluationCriterionDef[] | undefined {
  if (!Array.isArray(list) || list.length === 0) {
    errors[errKey] = "required non-empty array";
    return undefined;
  }
  const out: EvaluationCriterionDef[] = [];
  for (const raw of list) {
    if (typeof raw !== "object" || raw === null) {
      errors[errKey] = "each criterion must be an object";
      return undefined;
    }
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.label !== "string") {
      errors[errKey] = "each criterion needs id and label";
      return undefined;
    }
    if (c.kind === "rating") {
      if (typeof c.weight !== "number" || c.weight <= 0) {
        errors[errKey] = `criterion "${c.id}" (rating) requires weight > 0`;
        return undefined;
      }
      out.push({ id: c.id, label: c.label, kind: "rating", weight: c.weight });
    } else if (c.kind === "dropdown") {
      if (!Array.isArray(c.options) || c.options.length === 0 || !c.options.every((o) => typeof o === "string")) {
        errors[errKey] = `criterion "${c.id}" (dropdown) requires non-empty string options`;
        return undefined;
      }
      out.push({ id: c.id, label: c.label, kind: "dropdown", options: c.options as string[] });
    } else if (c.kind === "text") {
      out.push({ id: c.id, label: c.label, kind: "text", required: c.required === true });
    } else {
      errors[errKey] = `criterion "${c.id}" kind must be 'rating', 'dropdown', or 'text'`;
      return undefined;
    }
  }
  return out;
}

function parseCriteria(body: Record<string, unknown>, errors: Record<string, string>): EvaluationCriterionDef[] | undefined {
  return parseCriteriaList(body.criteria, errors, "criteria");
}

/** DEC-147: parses the optional `roundCriteria` map ({"<round>": [...]}) on
 * plan create/PATCH, validating every override array with the same rules as
 * the base criteria. Round keys must be integers within [1, rounds] when
 * `rounds` is known. Caller must only invoke this when `body.roundCriteria`
 * is present; a `null` body value means "clear all overrides" (returns
 * null), distinct from "field absent" which callers skip entirely. */
function parseRoundCriteria(
  body: Record<string, unknown>,
  errors: Record<string, string>,
  rounds: number | undefined,
): Record<string, EvaluationCriterionDef[]> | null | undefined {
  const raw = body.roundCriteria;
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.roundCriteria = "must be an object keyed by round number";
    return undefined;
  }
  const out: Record<string, EvaluationCriterionDef[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const roundNum = Number(key);
    if (!Number.isInteger(roundNum) || roundNum < 1 || (rounds !== undefined && roundNum > rounds)) {
      errors.roundCriteria = `round key "${key}" must be an integer between 1 and ${rounds ?? "rounds"}`;
      return undefined;
    }
    const parsed = parseCriteriaList(value, errors, `roundCriteria.${key}`);
    if (parsed === undefined) return undefined;
    out[String(roundNum)] = parsed;
  }
  return out;
}

/** DEC-082: rounds must be a positive integer. On PATCH, also refuses to
 * shrink rounds below the plan's already-reached current_round (that would
 * strand a plan mid-round with nowhere to go). */
function parseRounds(body: Record<string, unknown>, errors: Record<string, string>, minAllowed?: number): number | undefined {
  const rounds = body.rounds;
  if (!Number.isInteger(rounds) || (rounds as number) < 1) {
    errors.rounds = "must be an integer >= 1";
    return undefined;
  }
  if (minAllowed !== undefined && (rounds as number) < minAllowed) {
    errors.rounds = `must be >= the plan's current round (${minAllowed})`;
    return undefined;
  }
  return rounds as number;
}

/** DEC-082: ?round= query param, defaulting to the plan's current round.
 * Any value outside [1, plan.rounds] (or non-integer) is a 400. */
function parseRoundQuery(c: { req: { query(name: string): string | undefined } }, plan: PlanRecord): number {
  const raw = c.req.query("round");
  if (raw === undefined) return plan.currentRound;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > plan.rounds) {
    throw new ApiError("invalid", `round must be an integer between 1 and ${plan.rounds}`, { round: "out of range" });
  }
  return n;
}

/** Deterministic deep-equal via a canonicalized (sorted-keys) JSON shape,
 * for the DEC-123 no-op exemption. Array element order is preserved
 * (criteria order and scale field order are meaningful). */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function ratingCriteria(criteria: EvaluationCriterionDef[]): EvaluationCriterion[] {
  return criteria
    .filter((c): c is EvaluationCriterionDef & { kind: "rating"; weight: number } => c.kind === "rating")
    .map((c) => ({ id: c.id, label: c.label, weight: c.weight }));
}

async function requireOwnedPlan(c: { var: { db: import("../server/context").Db; auth?: { orgId: string } } }, planId: string): Promise<PlanRecord> {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const plan = await repo.getPlanForOrg(c.var.db, planId, auth.orgId);
  if (!plan) throw new ApiError("not_found", "Plan not found");
  return plan;
}

// ---------------------------------------------------------------------------
// Producer endpoints
// ---------------------------------------------------------------------------

reviewRoutes.get("/api/v1/events/:eventId/plans", requireOrganizer, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  const items = await repo.listPlansForEvent(c.var.db, event.id);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

reviewRoutes.post("/api/v1/events/:eventId/plans", requireOrganizer, csrfJson, async (c) => {
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

reviewRoutes.get("/api/v1/plans/:id", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  return c.json(plan);
});

reviewRoutes.patch("/api/v1/plans/:id", requireOrganizer, csrfJson, async (c) => {
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

reviewRoutes.delete("/api/v1/plans/:id", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  await repo.deletePlan(c.var.db, plan.id);
  return c.body(null, 204);
});

// DEC-082: advances the plan to current_round + 1. Rejects (409) once
// current_round === rounds -- there is no round beyond the plan's own count.
reviewRoutes.post("/api/v1/plans/:id/advance-round", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const updated = await repo.advancePlanRound(c.var.db, plan.id);
  return c.json(updated);
});

reviewRoutes.post("/api/v1/plans/:id/reviewers", requireOrganizer, csrfJson, async (c) => {
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

reviewRoutes.get("/api/v1/plans/:id/reviewers", requireOrganizer, async (c) => {
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

reviewRoutes.delete("/api/v1/plans/:id/reviewers/:reviewerId", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const reviewerId = c.req.param("reviewerId");
  const row = await repo.getReviewerRowById(c.var.db, reviewerId);
  if (!row || row.planId !== plan.id) throw new ApiError("not_found", "Reviewer assignment not found");
  await repo.removeReviewerById(c.var.db, reviewerId);
  return c.body(null, 204);
});

reviewRoutes.get("/api/v1/plans/:id/progress", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const round = parseRoundQuery(c, plan);
  const reviewerRows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const users = await repo.getUsersByIds(c.var.db, userIds);
  const evaluations = (await repo.listEvaluationsForPlan(c.var.db, plan.id, round)).filter((e) => e.round === round);
  // One plan-filtered load + pure assignment resolution (DEC-081): no
  // per-reviewer awaits.
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const assignments = resolveAssignments(submissions, reviewerRows);

  const items = users.map((user) => {
    const assigned = assignments.get(user.userId) ?? [];
    const completed = new Set(
      evaluations.filter((e) => e.reviewerId === user.userId).map((e) => e.submissionId),
    ).size;
    return { userId: user.userId, email: user.email, assigned: assigned.length, completed };
  });
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1, round });
});

interface ResultsRow {
  submissionId: string;
  ref: string;
  title: string;
  count: number;
  average: number;
  perCriterion: Record<string, number>;
}

async function buildResults(
  c: { var: { db: import("../server/context").Db } },
  plan: PlanRecord,
  round: number,
): Promise<ResultsRow[]> {
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const evaluations = (await repo.listEvaluationsForPlan(c.var.db, plan.id, round)).filter((e) => e.round === round);
  // DEC-147: results aggregate against THIS round's rating criteria -- a
  // round override can drop/add/reweight criteria relative to the base plan.
  const criteria = ratingCriteria(criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round));

  const rows: ResultsRow[] = submissions.map((sub) => {
    const evals = evaluations
      .filter((e) => e.submissionId === sub.id)
      .map((e) => ({ scores: e.scores as unknown as EvaluationScores }));
    const agg = aggregateSubmission(evals, criteria);
    return { submissionId: sub.id, ref: sub.ref, title: sub.title, count: agg.count, average: agg.average, perCriterion: agg.perCriterion };
  });
  return buildResultsRows(rows);
}

reviewRoutes.get("/api/v1/plans/:id/results", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const round = parseRoundQuery(c, plan);
  const rows = await buildResults(c, plan, round);

  if (c.req.query("format") === "csv") {
    const criteria = ratingCriteria(criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round));
    const header = ["ref", "title", "count", "average", ...criteria.map((cr) => cr.label)];
    const dataRows = rows.map((r) => [
      r.ref,
      r.title,
      r.count,
      Number(r.average.toFixed(2)),
      ...criteria.map((cr) => Number((r.perCriterion[cr.id] ?? 0).toFixed(2))),
    ]);
    const csv = toCsv([header, ...dataRows]);
    return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8" });
  }

  return c.json({ items: rows, total: rows.length, page: 1, perPage: rows.length || 1, round });
});

reviewRoutes.post("/api/v1/plans/:id/remind", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const reviewerRows = await repo.listReviewerRowsForPlan(c.var.db, plan.id);
  const userIds = [...new Set(reviewerRows.map((r) => r.userId))];
  const users = await repo.getUsersByIds(c.var.db, userIds);
  const evaluations = (await repo.listEvaluationsForPlan(c.var.db, plan.id, plan.currentRound)).filter((e) => e.round === plan.currentRound);
  // One plan-filtered load + pure assignment resolution (DEC-081): no
  // per-reviewer awaits.
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const assignments = resolveAssignments(submissions, reviewerRows);
  const mailer = makeMailer(c.var.db);

  const reminded: string[] = [];
  for (const user of users) {
    const assigned = assignments.get(user.userId) ?? [];
    const completed = new Set(
      evaluations.filter((e) => e.reviewerId === user.userId).map((e) => e.submissionId),
    ).size;
    if (completed >= assigned.length) continue;

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
  }
  return c.json({ reminded });
});

// ---------------------------------------------------------------------------
// Reviewer endpoints (/api/v1/review/*): reviewer OR organizer, inline check
// (DEC-018 — requireReviewer itself stays narrow).
// ---------------------------------------------------------------------------

reviewRoutes.get("/api/v1/review/plans", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  let plans: PlanRecord[];
  if (auth.role === "organizer") {
    const eventId = c.req.query("eventId");
    if (!eventId) throw new ApiError("invalid", "eventId query param is required");
    const event = await eventsRepo.getEventForOrg(c.var.db, eventId, auth.orgId);
    if (!event) throw new ApiError("not_found", "Event not found");
    plans = await repo.listPlansForEvent(c.var.db, event.id);
  } else {
    const planIds = await repo.listPlanIdsForReviewer(c.var.db, auth.userId);
    plans = (await Promise.all(planIds.map((id) => repo.getPlanById(c.var.db, id)))).filter(
      (p): p is PlanRecord => p !== null,
    );
  }
  return c.json({ items: plans, total: plans.length, page: 1, perPage: plans.length || 1 });
});

/** Mirrors requireOwnedPlan (line ~110) for the reviewer surface: organizers
 * are scoped to their own org via repo.getPlanForOrg (DEC-039), reviewers
 * are scoped via their plan assignments. */
async function requireAssignedPlan(
  c: { var: { db: import("../server/context").Db; auth?: { userId: string; role: string; orgId: string } } },
  planId: string,
): Promise<PlanRecord> {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  if (auth.role === "organizer") {
    const plan = await repo.getPlanForOrg(c.var.db, planId, auth.orgId);
    if (!plan) throw new ApiError("not_found", "Plan not found");
    return plan;
  }
  const plan = await repo.getPlanById(c.var.db, planId);
  if (!plan) throw new ApiError("not_found", "Plan not found");
  const planIds = await repo.listPlanIdsForReviewer(c.var.db, auth.userId);
  if (!planIds.includes(planId)) throw new ApiError("not_found", "Plan not found");
  return plan;
}

reviewRoutes.get("/api/v1/review/plans/:id/queue", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("id"));

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now())) {
    return c.json({ items: [], total: 0, page: 1, perPage: 1, open: false });
  }

  const scoped = await repo.resolveReviewerSubmissions(c.var.db, plan, auth.userId);
  // DEC-082: queue counts/marks only the plan's current round -- earlier
  // rounds' evaluations don't count toward this round's cap or "already
  // rated" state.
  const evaluations = (await repo.listEvaluationsForPlan(c.var.db, plan.id, plan.currentRound)).filter(
    (e) => e.round === plan.currentRound,
  );
  const countsBySubmission = new Map<string, number>();
  const ratedByMe = new Set<string>();
  for (const evaluation of evaluations) {
    countsBySubmission.set(evaluation.submissionId, (countsBySubmission.get(evaluation.submissionId) ?? 0) + 1);
    if (evaluation.reviewerId === auth.userId) ratedByMe.add(evaluation.submissionId);
  }

  const queueItems = scoped
    .map((s) => ({
      submissionId: s.id,
      ratingsCount: countsBySubmission.get(s.id) ?? 0,
      alreadyRatedByMe: ratedByMe.has(s.id),
    }))
    .filter((item) => item.alreadyRatedByMe || needsMoreRatings(item, plan.maxEvaluations ?? undefined));

  const orderedIds = buildReviewerQueue(queueItems);
  const byId = new Map(scoped.map((s) => [s.id, s]));
  const items = orderedIds.map((id) => byId.get(id)).filter((s): s is repo.SubmissionSummary => s !== undefined);

  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1, open: true });
});

reviewRoutes.get("/api/v1/review/submissions/:id", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const submissionId = c.req.param("id");
  const planId = c.req.query("planId");
  if (!planId) throw new ApiError("invalid", "planId query param is required");
  const plan = await requireAssignedPlan(c, planId);

  if (auth.role !== "organizer") {
    const inScope = await repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId);
    if (!inScope) throw new ApiError("not_found", "Submission not found");
  }

  const summary = await repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId);
  if (!summary) throw new ApiError("not_found", "Submission not found");

  const answers = await repo.listAnswersForSubmission(c.var.db, submissionId);
  const speakers = await repo.listSpeakersForSubmission(c.var.db, submissionId);

  // DEC-147: the criteria embedded on the submission detail are resolved for
  // the plan's ACTIVE round -- the reviewer's scorecard renders these, not
  // plan.criteria, so a round override actually takes effect client-side.
  const criteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound);

  const detail = {
    ...summary,
    speakers: speakers as repo.SpeakerSummary[] | undefined,
    speakerAnswers: answers.filter((a) => a.section === "speaker") as repo.SubmissionAnswerRow[] | undefined,
    sessionAnswers: answers.filter((a) => a.section === "session"),
    criteria,
  };

  // DEC-018: server-side anonymization only, never client-side.
  const out = plan.anonymized ? anonymizeForReviewer(detail) : detail;
  return c.json(out);
});

reviewRoutes.put("/api/v1/review/plans/:planId/evaluations/:submissionId", csrfJson, async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("planId"));
  const submissionId = c.req.param("submissionId");

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now())) {
    throw new ApiError("conflict", "This review plan is not currently open");
  }

  if (auth.role !== "organizer") {
    const inScope = await repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId);
    if (!inScope) throw new ApiError("not_found", "Submission not found");
  }

  const body = asRecord(await c.req.json());
  const scores = body.scores;
  if (typeof scores !== "object" || scores === null) {
    throw new ApiError("invalid", "scores is required", { scores: "required" });
  }

  const round = plan.currentRound;
  const existing = await repo.getEvaluation(c.var.db, plan.id, submissionId, auth.userId, round);
  if (!existing) {
    const ratingsCount = await repo.countEvaluationsForSubmission(c.var.db, plan.id, submissionId, round);
    if (!needsMoreRatings({ ratingsCount }, plan.maxEvaluations ?? undefined)) {
      throw new ApiError("conflict", "This submission has reached its evaluation cap");
    }
  }

  // DEC-147: validate against THIS round's resolved criteria, not the base
  // plan.criteria -- a round override changes what's a valid submission.
  const roundCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round);
  const result = validateEvaluationScores(scores as Record<string, unknown>, roundCriteria, plan.scale);
  if (!result.ok) {
    throw new ApiError("invalid", "Invalid scores", result.errors);
  }

  const saved = await repo.upsertEvaluation(c.var.db, {
    planId: plan.id,
    submissionId,
    reviewerId: auth.userId,
    round,
    scores: scores as Record<string, number | string>,
    comment: typeof body.comment === "string" ? body.comment : null,
  });
  return c.json(saved);
});
