// Pure core (DEC-002: no node:/cloudflare/drizzle imports) — the ONE
// validated home for evaluation_plan's five JSON columns: scale_json,
// criteria_json, filters_json, round_criteria_json, round_meta_json.
//
// DEC-147 amendment (wave 80): before this module, `toPlanRecord`
// (src/server/repo/review/plans.ts) cast all five columns with zero
// validation, and the same columns were re-parsed uncast at
// src/server/repo/review/evaluations.ts's listPlanCriteriaByIds and inside
// criteriaForRound (src/domain/evaluation/criteria.ts). A well-formed-but-
// wrong-shape row (e.g. a criterion with a missing/non-numeric weight, or a
// scale missing min/max) reached computeWeightedScore as NaN and the
// scorecard's range control as an unusable input, with nothing loud along
// the way. Modeled on src/forms/field-json.ts (the wave-79 sibling for
// form_field's two JSON columns): every parser here either returns a
// correctly-shaped value or throws a named PlanJsonError naming the plan id
// and column, never a silent cast.
//
// HOUSE RULE (read this before adding a second reader of these columns): a
// TOLERANT reader is legitimate only for resolving a display LABEL for
// legacy/malformed history (e.g. src/server/repo/exports/evaluations.ts's
// labelByCriterionId, which try/catches criteria_json on purpose so one bad
// legacy plan can't 500 an export) — that boundary is deliberate and stays
// where it is. A tolerant reader must NEVER be the source of a criterion's
// WEIGHT or a scale's min/max: those values feed scoring math and a
// scorecard control, so they must come from these throwing parsers, not from
// a swallowing try/catch. Do not "unify" the two readers.

import type { EvaluationCriterionDef, RoundMetaEntry } from "./criteria";
import { roundMetaFor } from "./criteria";

type PlanJsonColumn =
  | "scale_json"
  | "criteria_json"
  | "filters_json"
  | "round_criteria_json"
  | "round_meta_json";

/** Thrown by every parser in this module when the stored JSON does not match
 * the shape its column is contracted to hold. Names the offending plan id
 * and column so a bad row is loud, not a silently-mis-cast NaN or an
 * unusable scale control. */
export class PlanJsonError extends Error {
  constructor(planId: string, column: PlanJsonColumn, detail: string) {
    super(`evaluation_plan ${planId}.${column}: ${detail}`);
    this.name = "PlanJsonError";
  }
}

function parseJson(json: string, planId: string, column: PlanJsonColumn): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new PlanJsonError(planId, column, "not valid JSON");
  }
}

/** Parses evaluation_plan.scale_json. Throws PlanJsonError unless the result
 * is an object with finite numeric `min`/`max` and `min < max`. */
export function parsePlanScale(json: string, planId: string): { min: number; max: number } {
  const parsed = parseJson(json, planId, "scale_json");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PlanJsonError(planId, "scale_json", "must be an object");
  }
  const { min, max } = parsed as Record<string, unknown>;
  if (typeof min !== "number" || !Number.isFinite(min)) {
    throw new PlanJsonError(planId, "scale_json", "min must be a finite number");
  }
  if (typeof max !== "number" || !Number.isFinite(max)) {
    throw new PlanJsonError(planId, "scale_json", "max must be a finite number");
  }
  if (!(min < max)) {
    throw new PlanJsonError(planId, "scale_json", "min must be less than max");
  }
  return { min, max };
}

/** Validates one already-parsed criterion entry against the real
 * EvaluationCriterionDef shape (src/domain/evaluation/criteria.ts): a
 * non-empty string id, a string label, and -- for a 'rating' kind (the only
 * kind computeWeightedScore reads a weight from) -- a finite non-negative
 * numeric weight. Dropdown/text kinds are not required to carry a weight
 * (the union's own shape makes weight optional for them); when present on
 * any kind, a weight must still be a finite non-negative number so a
 * malformed weight can never reach scoring math regardless of kind. */
function assertCriterionShape(entry: unknown, planId: string, column: PlanJsonColumn, index: number): void {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new PlanJsonError(planId, column, `criteria[${index}] must be an object`);
  }
  const c = entry as Record<string, unknown>;
  if (typeof c.id !== "string" || c.id.trim() === "") {
    throw new PlanJsonError(planId, column, `criteria[${index}].id must be a non-empty string`);
  }
  if (typeof c.label !== "string") {
    throw new PlanJsonError(planId, column, `criteria[${index}].label must be a string`);
  }
  if (c.weight !== undefined) {
    if (typeof c.weight !== "number" || !Number.isFinite(c.weight) || c.weight < 0) {
      throw new PlanJsonError(planId, column, `criteria[${index}].weight must be a finite non-negative number`);
    }
  }
}

/** Parses evaluation_plan.criteria_json. Throws PlanJsonError unless the
 * result is an array of well-formed criterion entries. */
export function parsePlanCriteria(json: string, planId: string): EvaluationCriterionDef[] {
  const parsed = parseJson(json, planId, "criteria_json");
  if (!Array.isArray(parsed)) {
    throw new PlanJsonError(planId, "criteria_json", "must be an array");
  }
  parsed.forEach((entry, index) => assertCriterionShape(entry, planId, "criteria_json", index));
  return parsed as EvaluationCriterionDef[];
}

/** Thrown by assertPlanFiltersShape (the ONE shape predicate for
 * evaluation_plan.filters_json) when an already-parsed value does not match
 * `{ trackIds?: string[] }`. Carries a plain `.detail` message with no
 * plan id / column framing, because this predicate is shared by both the
 * read door (parsePlanFilters, which wraps it into a PlanJsonError with
 * plan id + column) and the write door (validatePlanFiltersInput, which has
 * no plan id yet since the plan may not exist -- POST -- or the value may
 * never be persisted at all -- a 400). DEC-509 wave-30 amendment. */
export class PlanFiltersShapeError extends Error {
  constructor(public readonly detail: string) {
    super(detail);
    this.name = "PlanFiltersShapeError";
  }
}

/** The ONE shape predicate for evaluation_plan.filters_json (DEC-509
 * wave-30 amendment). Before this helper, the read door (this file) and the
 * write door (src/routes/review/plans-crud.ts POST/PATCH) had NO validation
 * in common -- the write door cast `body.filters` with zero checks, so
 * `{"trackIds":"t1"}` (a string, not an array) wrote a filters_json that
 * made every subsequent read of the plan throw PlanJsonError forever
 * (toPlanRecord calls parsePlanFilters on every read). Both
 * parsePlanFilters (read) and validatePlanFiltersInput (write) below call
 * ONLY this function for the shape check, so they can never drift apart
 * again. Takes an already-JSON.parsed value (the read door has already run
 * JSON.parse; the write door's value is already-parsed JSON from the
 * request body). Returns null for `null` (clear filters). Throws
 * PlanFiltersShapeError with a `.detail` message on any shape violation. */
export function assertPlanFiltersShape(parsed: unknown): { trackIds?: string[] } | null {
  if (parsed === null) return null;
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PlanFiltersShapeError("must be an object");
  }
  const { trackIds } = parsed as Record<string, unknown>;
  if (trackIds === undefined) {
    return {};
  }
  if (!Array.isArray(trackIds) || trackIds.some((v) => typeof v !== "string")) {
    throw new PlanFiltersShapeError("trackIds must be an array of strings");
  }
  return { trackIds };
}

/** Parses evaluation_plan.filters_json. Returns null for null/empty input
 * (no filters stored). Throws PlanJsonError if the JSON parses but is not an
 * object whose optional `trackIds` is an array of strings -- shape checked
 * by assertPlanFiltersShape above (DEC-509 wave-30 amendment), the same
 * predicate the write door in plans-crud.ts calls via
 * validatePlanFiltersInput. */
export function parsePlanFilters(
  json: string | null | undefined,
  planId: string,
): { trackIds?: string[] } | null {
  if (json === null || json === undefined || json === "") return null;
  const parsed = parseJson(json, planId, "filters_json");
  try {
    return assertPlanFiltersShape(parsed);
  } catch (err) {
    const detail = err instanceof PlanFiltersShapeError ? err.detail : String(err);
    throw new PlanJsonError(planId, "filters_json", detail);
  }
}

/** Write-door validator for evaluation_plan.filters_json's INPUT shape
 * (DEC-509 wave-30 amendment). Calls assertPlanFiltersShape above -- the
 * SAME predicate parsePlanFilters uses to read the column back -- so a
 * `filters` value that passes this validator is guaranteed to pass the read
 * door too; a value that would fail the read door is refused HERE, as a
 * named 400 field error, instead of being written and bricking the plan
 * (and its results/queue/repair-PATCH) on next read. Takes the
 * already-JSON-parsed request body value (`body.filters`), not a JSON
 * string. Callers (POST/PATCH in src/routes/review/plans-crud.ts) catch
 * PlanFiltersShapeError and surface its `.detail` under the `filters` field
 * of the route's own `errors` map. */
export function validatePlanFiltersInput(value: unknown): { trackIds?: string[] } | null {
  return assertPlanFiltersShape(value);
}

/** Parses evaluation_plan.round_criteria_json. Returns null for null/empty
 * input (no round overrides stored). Throws PlanJsonError if the JSON parses
 * but is not an object mapping round keys to arrays of well-formed criterion
 * entries. */
export function parseRoundCriteria(
  json: string | null | undefined,
  planId: string,
): Record<string, EvaluationCriterionDef[]> | null {
  if (json === null || json === undefined || json === "") return null;
  const parsed = parseJson(json, planId, "round_criteria_json");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PlanJsonError(planId, "round_criteria_json", "must be an object");
  }
  const map = parsed as Record<string, unknown>;
  for (const [round, entries] of Object.entries(map)) {
    if (!Array.isArray(entries)) {
      throw new PlanJsonError(planId, "round_criteria_json", `round "${round}" must be an array`);
    }
    entries.forEach((entry, index) => assertCriterionShape(entry, planId, "round_criteria_json", index));
  }
  return map as Record<string, EvaluationCriterionDef[]>;
}

/** Parses evaluation_plan.round_meta_json. Returns null for null/empty input
 * (no round meta overrides stored). Throws PlanJsonError if the JSON parses
 * but is not an object; each entry's own shape is validated by
 * roundMetaFor's existing per-field checks (src/domain/evaluation/
 * criteria.ts) rather than a second copy of that validation here -- this
 * function calls roundMetaFor once per entry (against round 1's own
 * fallback shape, which is irrelevant here since only the validation
 * side-effect is used) purely to reuse its throwing checks. */
export function parseRoundMeta(
  json: string | null | undefined,
  planId: string,
): Record<string, RoundMetaEntry> | null {
  if (json === null || json === undefined || json === "") return null;
  const parsed = parseJson(json, planId, "round_meta_json");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PlanJsonError(planId, "round_meta_json", "must be an object");
  }
  const map = parsed as Record<string, RoundMetaEntry>;
  for (const round of Object.keys(map)) {
    try {
      // roundMetaFor throws a named error on a malformed entry; we only
      // want that validation, so the fallback plan/round args are inert.
      roundMetaFor({ name: "", openDate: null, closeDate: null }, map, Number(round));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new PlanJsonError(planId, "round_meta_json", detail);
    }
  }
  return map;
}
