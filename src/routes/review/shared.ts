// Review API (J4) shared helpers, per DEC-018/DEC-012/DEC-013/DEC-017.
// Split out of the former monolithic src/routes/review.ts so the producer
// (plans.ts), reviewer (reviewer.ts) and recusal (recusals.ts) sub-apps can
// each stay small and cohesive; this module holds ONLY the request
// parsing/validation/authz helpers and result-shaping logic they all share.
// No behavior change from the original file — pure extraction.

import type { AppEnv } from "../../server/env";
import { ApiError } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import {
  aggregateSubmission,
  aggregateDropdownCriterion,
  buildResultsRows,
  criteriaForRound,
  type EvaluationCriterion,
  type EvaluationCriterionDef,
  type DropdownCriterionDef,
  type EvaluationScores,
  type ResultsSortKey,
  type SortDirection,
} from "../../domain/evaluation";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import type { PlanRecord, EvaluationRecord } from "../../server/repo/review";

export function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function currentAuth(c: { var: { auth?: { userId: string; role: string; orgId: string } } }) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

/** Inline reviewer-or-organizer check (DEC-018): requireReviewer stays
 * organizer-only-widening-free; /api/v1/review/* accepts either role. */
export function requireReviewerOrOrganizer(c: { var: { auth?: { role: string } } }): void {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  if (auth.role !== "reviewer" && auth.role !== "organizer") {
    throw new ApiError("forbidden", "Requires role 'reviewer' or 'organizer'");
  }
}

export function parseScale(body: Record<string, unknown>, errors: Record<string, string>): { min: number; max: number } | undefined {
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
export function parseCriteriaList(
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
    if (c.label.length > MAX_NAME_LENGTH) {
      errors[errKey] = `criterion "${c.id}" label must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
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

export function parseCriteria(body: Record<string, unknown>, errors: Record<string, string>): EvaluationCriterionDef[] | undefined {
  return parseCriteriaList(body.criteria, errors, "criteria");
}

/** DEC-147: parses the optional `roundCriteria` map ({"<round>": [...]}) on
 * plan create/PATCH, validating every override array with the same rules as
 * the base criteria. Round keys must be integers within [1, rounds] when
 * `rounds` is known. Caller must only invoke this when `body.roundCriteria`
 * is present; a `null` body value means "clear all overrides" (returns
 * null), distinct from "field absent" which callers skip entirely. */
export function parseRoundCriteria(
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
export function parseRounds(body: Record<string, unknown>, errors: Record<string, string>, minAllowed?: number): number | undefined {
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
export function parseRoundQuery(c: { req: { query(name: string): string | undefined } }, plan: PlanRecord): number {
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
export function canonicalize(value: unknown): unknown {
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

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

export function ratingCriteria(criteria: EvaluationCriterionDef[]): EvaluationCriterion[] {
  return criteria
    .filter((c): c is EvaluationCriterionDef & { kind: "rating"; weight: number } => c.kind === "rating")
    .map((c) => ({ id: c.id, label: c.label, weight: c.weight }));
}

// DEC-241: dropdown criteria of a round's resolved criteria list, for the
// results endpoint's perDropdown aggregate and CSV option columns.
export function dropdownCriteria(criteria: EvaluationCriterionDef[]): DropdownCriterionDef[] {
  return criteria.filter((c): c is DropdownCriterionDef => c.kind === "dropdown");
}

export async function requireOwnedPlan(c: { var: { db: import("../../server/context").Db; auth?: { orgId: string } } }, planId: string): Promise<PlanRecord> {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const plan = await repo.getPlanForOrg(c.var.db, planId, auth.orgId);
  if (!plan) throw new ApiError("not_found", "Plan not found");
  return plan;
}

/** Mirrors requireOwnedPlan for the reviewer surface: organizers are scoped
 * to their own org via repo.getPlanForOrg (DEC-039), reviewers are scoped
 * via their plan assignments. */
export async function requireAssignedPlan(
  c: { var: { db: import("../../server/context").Db; auth?: { userId: string; role: string; orgId: string } } },
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

export interface ResultsRow {
  submissionId: string;
  ref: string;
  title: string;
  count: number;
  average: number;
  perCriterion: Record<string, number>;
  // DEC-241: dropdown criteria never fold into the rating-only Average; each
  // gets its own per-option distribution + modal here instead.
  perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
}

export async function buildResults(
  c: { var: { db: import("../../server/context").Db } },
  plan: PlanRecord,
  round: number,
): Promise<ResultsRow[]> {
  const submissions = await repo.listPlanFilteredSubmissions(c.var.db, plan);
  const evaluations = (await repo.listEvaluationsForPlan(c.var.db, plan.id, round)).filter((e) => e.round === round);
  // DEC-147: results aggregate against THIS round's full criteria list -- a
  // round override can drop/add/reweight criteria relative to the base plan.
  const roundCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round);
  const criteria = ratingCriteria(roundCriteria);
  const dropdowns = dropdownCriteria(roundCriteria);

  // DEC-345: index evaluations by submissionId in one pass instead of
  // filtering the whole per-plan evaluation array once per submission
  // (O(submissions x evaluations) -> O(submissions + evaluations)).
  const evalsBySubmission = new Map<string, EvaluationRecord[]>();
  for (const e of evaluations) {
    const list = evalsBySubmission.get(e.submissionId) ?? [];
    list.push(e);
    evalsBySubmission.set(e.submissionId, list);
  }

  const rows: ResultsRow[] = submissions.map((sub) => {
    const subEvals = evalsBySubmission.get(sub.id) ?? [];
    const evals = subEvals.map((e) => ({ scores: e.scores as unknown as EvaluationScores }));
    const agg = aggregateSubmission(evals, criteria);
    const dropdownEvals = subEvals.map((e) => ({ scores: e.scores as unknown as Record<string, unknown> }));
    const perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }> = {};
    for (const dc of dropdowns) {
      perDropdown[dc.id] = aggregateDropdownCriterion(dropdownEvals, dc);
    }
    return {
      submissionId: sub.id,
      ref: sub.ref,
      title: sub.title,
      count: agg.count,
      average: agg.average,
      perCriterion: agg.perCriterion,
      perDropdown,
    };
  });
  return buildResultsRows(rows);
}

/** DEC-345: parses the results endpoint's optional ?sort=/&criterionId=/
 * &dir= query params into a {key, direction} pair, or undefined when ?sort=
 * is absent (caller then skips the server-side sort entirely, leaving the
 * DEC-341-style average-desc/count-desc ranking as the order). criterionId
 * is required (and validated) only for the 'rating'/'dropdown' columns. */
export function parseResultsSort(c: {
  req: { query(name: string): string | undefined };
}): { key: ResultsSortKey; direction: SortDirection } | undefined {
  const sort = c.req.query("sort");
  if (sort === undefined) return undefined;
  const dirRaw = c.req.query("dir");
  const direction: SortDirection = dirRaw === "asc" ? "asc" : "desc";
  if (dirRaw !== undefined && dirRaw !== "asc" && dirRaw !== "desc") {
    throw new ApiError("invalid", "dir must be 'asc' or 'desc'", { dir: "must be 'asc' or 'desc'" });
  }
  if (sort === "ref" || sort === "title" || sort === "count" || sort === "average") {
    return { key: { column: sort }, direction };
  }
  if (sort === "rating" || sort === "dropdown") {
    const criterionId = c.req.query("criterionId");
    if (!criterionId) {
      throw new ApiError("invalid", "criterionId is required when sort is 'rating' or 'dropdown'", {
        criterionId: "required",
      });
    }
    return { key: { column: sort, criterionId }, direction };
  }
  throw new ApiError("invalid", "sort must be one of ref|title|count|average|rating|dropdown", { sort: "invalid" });
}

export function toRecusalOut(r: { planId: string; submissionId: string; userId: string; reason: string | null; createdAt: number }) {
  return { planId: r.planId, submissionId: r.submissionId, userId: r.userId, reason: r.reason, createdAt: r.createdAt };
}

export type { AppEnv };
