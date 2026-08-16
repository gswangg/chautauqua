// Review API (J4) shared helpers, per DEC-018/DEC-012/DEC-013/DEC-017.
// Split out of the former monolithic src/routes/review.ts so the producer
// (plans.ts), reviewer (reviewer.ts) and recusal (recusals.ts) sub-apps can
// each stay small and cohesive; this module holds ONLY the request
// parsing/validation/authz helpers and result-shaping logic they all share.
// No behavior change from the original file — pure extraction.

import type { AppEnv } from "../../server/env";
import { ApiError } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapCountMessage } from "../../domain/cap-copy"; // DEC-422 amendment
import {
  aggregateSubmission,
  aggregateDropdownCriterion,
  buildResultsRows,
  criteriaForRound,
  normalizeGuidance,
  numericScoresFor,
  MAX_CRITERION_GUIDANCE_LENGTH,
  MAX_PLAN_ROUNDS,
  MAX_PLAN_CRITERIA,
  MAX_CRITERION_OPTIONS,
  type EvaluationCriterion,
  type EvaluationCriterionDef,
  type DropdownCriterionDef,
  type ResultsSortKey,
  type SortDirection,
  type RoundMetaEntry,
} from "../../domain/evaluation";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import type { PlanRecord } from "../../server/repo/review";
import { isDayLabelMs, isEpochMs, isEpochOrderValid } from "../api/validators"; // DEC-517/DEC-522
import { DEC_676, DEC_703 } from "../../decisions";

void DEC_676; // parseCriteriaList's guidance passthrough below
void DEC_703; // hydrateResultsRows' speakers/trackNames columns below

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
  // DEC-422 (amendment, wave 2): the plan editor's soft cap of
  // MAX_PLAN_CRITERIA was previously enforced ONLY by the SPA disabling its
  // Add link -- the server accepted an array of any length. Applies equally
  // to the base `criteria` array and every `roundCriteria` override.
  if (list.length > MAX_PLAN_CRITERIA) {
    errors[errKey] = overCapCountMessage(list.length, MAX_PLAN_CRITERIA, "criterion", "criteria"); // DEC-422 grammar
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
    // DEC-422 (amendment, wave 2): the criterion id string was previously
    // unbounded.
    if (c.id.length > MAX_NAME_LENGTH) {
      errors[errKey] = `criterion id must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
      return undefined;
    }
    if (c.label.length > MAX_NAME_LENGTH) {
      errors[errKey] = `criterion "${c.id}" label must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
      return undefined;
    }
    // DEC-676: optional one-line guidance, bounded so it stays a hint.
    if (c.guidance !== undefined && typeof c.guidance !== "string") {
      errors[errKey] = `criterion "${c.id}" guidance must be a string`;
      return undefined;
    }
    if (typeof c.guidance === "string" && c.guidance.length > MAX_CRITERION_GUIDANCE_LENGTH) {
      errors[errKey] = `criterion "${c.id}" guidance must be at most ${MAX_CRITERION_GUIDANCE_LENGTH} characters`;
      return undefined;
    }
    const guidance = normalizeGuidance(typeof c.guidance === "string" ? c.guidance : undefined);
    if (c.kind === "rating") {
      if (typeof c.weight !== "number" || c.weight <= 0) {
        errors[errKey] = `criterion "${c.id}" (rating) requires weight > 0`;
        return undefined;
      }
      out.push({ id: c.id, label: c.label, kind: "rating", weight: c.weight, guidance });
    } else if (c.kind === "dropdown") {
      if (!Array.isArray(c.options) || c.options.length === 0 || !c.options.every((o) => typeof o === "string")) {
        errors[errKey] = `criterion "${c.id}" (dropdown) requires non-empty string options`;
        return undefined;
      }
      // DEC-422 (amendment, wave 2): options count and each option's length
      // were previously unbounded here -- the CFP builder caps its own
      // options, this one did not.
      if (c.options.length > MAX_CRITERION_OPTIONS) {
        errors[errKey] = `criterion "${c.id}" (dropdown) has ${overCapCountMessage(c.options.length, MAX_CRITERION_OPTIONS, "option")}`; // DEC-422 grammar
        return undefined;
      }
      if ((c.options as string[]).some((o) => o.length > MAX_NAME_LENGTH)) {
        errors[errKey] = `criterion "${c.id}" (dropdown) options must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
        return undefined;
      }
      out.push({ id: c.id, label: c.label, kind: "dropdown", options: c.options as string[], guidance });
    } else if (c.kind === "text") {
      out.push({ id: c.id, label: c.label, kind: "text", required: c.required === true, guidance });
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

/** DEC-147 amendment (wave 8, task w8-c): parses the optional `roundMeta`
 * map ({"<round>": {name?, opensAt?, closesAt?}}) on plan create/PATCH --
 * mirrors parseRoundCriteria's shape/placement exactly (round keys must be
 * integers within [1, rounds] when `rounds` is known; `null` body value
 * clears all overrides, `undefined` means "unchanged" and is never called
 * by the caller). name is bounded like every other short name field;
 * opensAt/closesAt are ms-epoch integers or null (unset), and when both are
 * present on the same entry, open must be <= close. */
export function parseRoundMeta(
  body: Record<string, unknown>,
  errors: Record<string, string>,
  rounds: number | undefined,
): Record<string, RoundMetaEntry> | null | undefined {
  const raw = body.roundMeta;
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.roundMeta = "must be an object keyed by round number";
    return undefined;
  }
  const out: Record<string, RoundMetaEntry> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const roundNum = Number(key);
    if (!Number.isInteger(roundNum) || roundNum < 1 || (rounds !== undefined && roundNum > rounds)) {
      errors.roundMeta = `round key "${key}" must be an integer between 1 and ${rounds ?? "rounds"}`;
      return undefined;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.roundMeta = `round meta for "${key}" must be an object`;
      return undefined;
    }
    const entry = value as Record<string, unknown>;
    const parsedEntry: RoundMetaEntry = {};
    if (entry.name !== undefined) {
      if (typeof entry.name !== "string" || entry.name.length > MAX_NAME_LENGTH) {
        errors.roundMeta = `round "${key}" name must be a string of at most ${MAX_NAME_LENGTH} characters`; // DEC-417
        return undefined;
      }
      parsedEntry.name = entry.name;
    }
    if (entry.opensAt !== undefined) {
      if (entry.opensAt !== null && !isEpochMs(entry.opensAt)) {
        errors.roundMeta = `round "${key}" opensAt must be a ms-epoch integer, or null`;
        return undefined;
      }
      parsedEntry.opensAt = entry.opensAt as number | null;
    }
    if (entry.closesAt !== undefined) {
      if (entry.closesAt !== null && !isEpochMs(entry.closesAt)) {
        errors.roundMeta = `round "${key}" closesAt must be a ms-epoch integer, or null`;
        return undefined;
      }
      parsedEntry.closesAt = entry.closesAt as number | null;
    }
    if (
      parsedEntry.opensAt !== undefined &&
      parsedEntry.closesAt !== undefined &&
      !isEpochOrderValid(parsedEntry.opensAt, parsedEntry.closesAt)
    ) {
      errors.roundMeta = `round "${key}" opensAt must be before or equal to closesAt`;
      return undefined;
    }
    out[String(roundNum)] = parsedEntry;
  }
  return out;
}

// DEC-082 (wave-43 amendment)/DEC-422 (amendment, wave 59): MAX_PLAN_ROUNDS
// now lives in src/domain/evaluation.ts (imported above). On PATCH, also
// refuses to shrink rounds below the plan's already-reached current_round
// (that would strand a plan mid-round with nowhere to go).
export function parseRounds(body: Record<string, unknown>, errors: Record<string, string>, minAllowed?: number): number | undefined {
  const rounds = body.rounds;
  if (!Number.isInteger(rounds) || (rounds as number) < 1 || (rounds as number) > MAX_PLAN_ROUNDS) {
    errors.rounds = `must be an integer between 1 and ${MAX_PLAN_ROUNDS}`;
    return undefined;
  }
  if (minAllowed !== undefined && (rounds as number) < minAllowed) {
    errors.rounds = `must be >= the plan's current round (${minAllowed})`;
    return undefined;
  }
  return rounds as number;
}

/** DEC-509: maxEvaluations must be a positive integer, or explicitly null
 * (uncapped). Absent means "unchanged" on PATCH / "not set" on POST --
 * callers distinguish undefined from null themselves. Mirrors parseRounds'
 * shape/placement/error style. */
export function parseMaxEvaluations(body: Record<string, unknown>, errors: Record<string, string>): number | null | undefined {
  const raw = body.maxEvaluations;
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Number.isInteger(raw) || (raw as number) < 1) {
    errors.maxEvaluations = "must be an integer >= 1, or null";
    return undefined;
  }
  return raw as number;
}

/** DEC-509/DEC-522: openDate/closeDate must be a UTC-midnight day label
 * (isDayLabelMs), or explicitly null (unset). Absent means "unchanged" on
 * PATCH / "not set" on POST. Mirrors the CFP form door (forms.ts) exactly,
 * per DEC-517's whole point: refuse identically on both surfaces. */
export function parseEpochMs(body: Record<string, unknown>, key: string, errors: Record<string, string>): number | null | undefined {
  const raw = body[key];
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!isDayLabelMs(raw)) {
    errors[key] = "must be a UTC-midnight day label (ms-epoch multiple of 86400000)"; // DEC-522
    return undefined;
  }
  return raw;
}

/** DEC-517: refuses a close-before-open date pair, evaluated against the
 * MERGED post-patch state -- callers pass the effective open/close (body
 * value if present, else the stored record's value) so a PATCH that only
 * touches one side is still checked against the other's stored value.
 * Writes the same error under BOTH openDate and closeDate per the house
 * error shape. */
export function checkEpochOrder(
  open: number | null | undefined,
  close: number | null | undefined,
  errors: Record<string, string>,
): void {
  if (!isEpochOrderValid(open, close)) {
    errors.openDate = "openDate must be before or equal to closeDate";
    errors.closeDate = "closeDate must be after or equal to openDate";
  }
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
  // DEC-632/DEC-633: the submission's decision state, so the results screen
  // (and its CSV export) tell the truth about accept/reject/waitlist rather
  // than always rendering a pair of pending decision buttons.
  status: string;
  // DEC-703: who this is and where it goes, so the one screen an organizer
  // decides the programme from doesn't require leaving the page. Visible-
  // participant order (speakers) / track.position order (trackNames).
  speakers: string[];
  trackNames: string[];
  // w42-h/DEC-366 amendment: the Reviews cell's disclosure trigger names a
  // real count of self-recused reviewers for this submission, never a
  // fabricated figure -- plan-scoped (not round-scoped; a recusal has no
  // round of its own).
  recusals: number;
}

/** Ranked-only shape (DEC-829 w32 amendment): everything `sortValueForColumn`
 * (src/domain/evaluation/results.ts:62-79) and `SortableResultsRow` (:35-44)
 * can read -- ref/title/average/count/perCriterion/perDropdown -- plus
 * `status` (part of the CSV/JSON row but never a sort input) and
 * `submissionId` (the join key hydration slices on). Ranking and ?sort=
 * never touch speakers/trackNames/recusals, so hydrating AFTER the page
 * slice cannot change any order. */
export interface RankedResultsRow {
  submissionId: string;
  ref: string;
  title: string;
  count: number;
  average: number;
  perCriterion: Record<string, number>;
  perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
  status: string;
}

/** RANK the whole population (DEC-829/DEC-338 w32): the two independent
 * plan-scoped reads issue as one Promise.all, then the existing DEC-345/
 * DEC-440 aggregation runs verbatim -- no speakers/trackNames/recusals read
 * here, since sorting never touches them. */
export async function rankPlanResults(
  c: { var: { db: import("../../server/context").Db } },
  plan: PlanRecord,
  round: number,
): Promise<RankedResultsRow[]> {
  // DEC-439: buildResults never reads trackIds, so skip the second
  // whole-event submission_track scan; DEC-440: only submission_id +
  // scores_json are read from evaluation, not whole rows.
  //
  // DEC-338 (wave-31 amendment, narrowed by DEC-829's wave-32 rank/hydrate
  // split): the two reads below are independent (neither depends on the
  // other's result), so they still issue as ONE Promise.all wave rather
  // than a sequential waterfall. Promise.all rejects with the first read's
  // own ApiError unchanged -- no error is swallowed or replaced. The
  // plan-scoped recusal read moved to hydrateResultsRows, since ranking
  // never reads recusals.
  const [submissions, evaluations] = await Promise.all([
    repo.listPlanFilteredSubmissions(c.var.db, plan, { withTrackIds: false }),
    repo.listEvaluationScoresForPlan(c.var.db, plan.id, round),
  ]);
  // DEC-147: results aggregate against THIS round's full criteria list -- a
  // round override can drop/add/reweight criteria relative to the base plan.
  const roundCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round);
  const criteria = ratingCriteria(roundCriteria);
  const dropdowns = dropdownCriteria(roundCriteria);

  // DEC-345: index evaluations by submissionId in one pass instead of
  // filtering the whole per-plan evaluation array once per submission
  // (O(submissions x evaluations) -> O(submissions + evaluations)).
  const evalsBySubmission = new Map<string, { submissionId: string; scores: Record<string, number | string> }[]>();
  for (const e of evaluations) {
    const list = evalsBySubmission.get(e.submissionId) ?? [];
    list.push(e);
    evalsBySubmission.set(e.submissionId, list);
  }

  const rows: RankedResultsRow[] = submissions.map((sub) => {
    const subEvals = evalsBySubmission.get(sub.id) ?? [];
    // DEC-212 (wave-81 amendment): numericScoresFor is the ONE validated
    // narrowing from the row's raw Record<string, number|string> to the
    // arithmetic-safe EvaluationScores shape -- no cast, since a non-numeric
    // value here would otherwise reach computeWeightedScore's `score *
    // weight` as NaN and silently poison the plan's ranking.
    const evals = subEvals.map((e) => ({ scores: numericScoresFor(e.scores, criteria, e.submissionId) }));
    const agg = aggregateSubmission(evals, criteria);
    // aggregateDropdownCriterion only ever reads a dropdown criterion's own
    // key (validated as a string against its options list) -- the row's
    // Record<string, number|string> already satisfies its
    // Record<string, unknown> parameter structurally, no cast needed.
    const dropdownEvals = subEvals.map((e) => ({ scores: e.scores }));
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
      status: sub.status,
    };
  });
  return buildResultsRows(rows);
}

/** HYDRATE an already-sliced/sorted set of ranked rows with the
 * DEC-703/DEC-366 display-only columns (speakers, trackNames, recusals).
 * The caller controls how much of the ranked population this runs over: the
 * JSON page route passes only the current page's slice, the CSV export
 * passes every row (DEC-829 w32 amendment -- HYDRATION IS PER-PAGE). */
export async function hydrateResultsRows(
  c: { var: { db: import("../../server/context").Db } },
  plan: PlanRecord,
  rows: RankedResultsRow[],
): Promise<ResultsRow[]> {
  // DEC-703: SPEAKER and TRACK for the results row -- ONE batched query
  // each, keyed to THIS CALL's own (possibly sliced) submission id set
  // (never a per-row read, never an unscoped full-table scan).
  const submissionIds = rows.map((r) => r.submissionId);
  const [speakersBySubmission, trackNamesBySubmission, planRecusals] = await Promise.all([
    repo.listSpeakerNamesForSubmissions(c.var.db, submissionIds),
    repo.listTrackNamesForSubmissions(c.var.db, submissionIds),
    // w42-h/DEC-366 amendment: one plan-scoped recusal read, indexed by
    // submissionId -- never a per-row query.
    repo.listRecusalsForPlan(c.var.db, plan.id),
  ]);
  const recusalCountsBySubmission = new Map<string, number>();
  for (const r of planRecusals) {
    recusalCountsBySubmission.set(r.submissionId, (recusalCountsBySubmission.get(r.submissionId) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    speakers: speakersBySubmission.get(row.submissionId) ?? [],
    trackNames: trackNamesBySubmission.get(row.submissionId) ?? [],
    recusals: recusalCountsBySubmission.get(row.submissionId) ?? 0,
  }));
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
