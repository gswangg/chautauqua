// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Criteria validation (DEC-018): a plan's criteria_json can mix 'rating'
// (numeric, weighted, in-scale) and 'dropdown' (string, from a fixed option
// list) criteria; free text lives outside scores as evaluation.comment.
// Split out of the former monolithic src/domain/evaluation.ts (contention
// decomposition, no behavior change) -- see src/domain/evaluation.ts for
// the re-export barrel.

// DEC-425: caps the last uncapped free-text write paths; reuses the
// existing MAX_LONG_TEXT_LENGTH constant rather than introducing a new one.
import { MAX_LONG_TEXT_LENGTH } from "../../forms/validate";
import { overCapFieldMessage } from "../cap-copy";
// DEC-676: criteria carry optional one-line guidance, a plan-wide weighted
// share display, and default-plan criteria -- see normalizeGuidance,
// criterionWeightShares, DEFAULT_PLAN_CRITERIA below.
import { DEC_676 } from "../../decisions";

void DEC_676;

/** DEC-082 (wave-43 amendment), moved to pure core DEC-422 (amendment, wave
 * 59): rounds must be a positive integer, capped at MAX_PLAN_ROUNDS --
 * every reader (PlanEditor.tsx, ResultsTable.tsx) turns this count
 * straight into `Array.from({ length: rounds })`, so an unbounded value is
 * a client-side allocation DoS that permanently bricks the plan's editor
 * and results pages. */
export const MAX_PLAN_ROUNDS = 10;

// DEC-422 (amendment, wave 2): the plan editor's criteria list soft cap --
// previously hand-declared ONLY as `MAX_CRITERIA = 7` in
// app/src/pages/review/PlanEditor.tsx, with the server-side
// parseCriteriaList (src/routes/review/shared.ts) enforcing nothing. Single-
// sourced here so the SPA's Add-disable/caption and the server's refusal
// read the same number. Applies to both the plan's base `criteria` array and
// every `roundCriteria` override array (DEC-147) -- a round override is not
// a separate cap.
export const MAX_PLAN_CRITERIA = 7;

// DEC-422 (amendment, wave 2): a dropdown criterion's options list was
// bounded by the CFP builder's own control but not here -- capped at the
// same order of magnitude as other bounded option lists in the codebase.
export const MAX_CRITERION_OPTIONS = 20;

// DEC-676: a criterion may carry a one-line guidance string shown to
// reviewers under its label and to organizers in the plan editor -- bounded
// length so it stays a hint, not a second instructions field.
export const MAX_CRITERION_GUIDANCE_LENGTH = 140;

export interface RatingCriterionDef {
  id: string;
  label: string;
  kind: "rating";
  weight: number;
  options?: undefined;
  guidance?: string;
}

export interface DropdownCriterionDef {
  id: string;
  label: string;
  kind: "dropdown";
  weight?: undefined;
  options: string[];
  guidance?: string;
}

/** DEC-148: free-text criterion. Stored in the same scores map as a string,
 * excluded from weighted scoring/aggregates exactly like 'dropdown'. */
export interface TextCriterionDef {
  id: string;
  label: string;
  kind: "text";
  weight?: undefined;
  options?: undefined;
  required?: boolean;
  guidance?: string;
}

export type EvaluationCriterionDef = RatingCriterionDef | DropdownCriterionDef | TextCriterionDef;

/**
 * DEC-676: normalizes a criterion's optional one-line guidance -- trims
 * surrounding whitespace and collapses a blank string to `undefined` (never
 * stored as `""`). Callers that accept untrusted input still bound the
 * length themselves against MAX_CRITERION_GUIDANCE_LENGTH (this stays a pure
 * normalizer, not a route error reporter -- it never throws).
 */
export function normalizeGuidance(raw: string | undefined | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export type EvaluationScoreValue = number | string;

export type EvaluationErrors = Record<string, string>;

/**
 * Validates a reviewer's submitted scores against the plan's criteria and
 * scale (DEC-018): 'rating' criteria must have weight > 0 and a numeric
 * score within [scale.min, scale.max]; 'dropdown' criteria must have a
 * non-empty options list and the score must be one of those options. Every
 * criterion must have a score present (no partial submissions); unknown
 * criterion ids in `scores` are also rejected. Returns `{ ok: true }` or
 * `{ ok: false, errors }` keyed by criterion id -- never throws, since this
 * validates untrusted reviewer input at the route boundary.
 *
 * DEC-873 (wave 27 amendment): pass `{ partial: true }` for a draft save --
 * a criterion with no entry in `scores` is skipped rather than erroring
 * ("no completeness check"), but any criterion that IS present in `scores`
 * is still validated by kind/range/options exactly as a full submit would,
 * so a draft can never persist a malformed value.
 */
export function validateEvaluationScores(
  scores: Record<string, unknown>,
  criteria: EvaluationCriterionDef[],
  scale: { min: number; max: number },
  opts?: { partial?: boolean },
): { ok: true } | { ok: false; errors: EvaluationErrors } {
  const errors: EvaluationErrors = {};
  const criterionIds = new Set(criteria.map((c) => c.id));
  const partial = opts?.partial === true;

  for (const criterion of criteria) {
    const value = scores[criterion.id];
    if (value === undefined || value === null) {
      if (partial) continue;
      errors[criterion.id] = "score is required";
      continue;
    }
    if (criterion.kind === "rating") {
      if (criterion.weight <= 0) {
        errors[criterion.id] = `criterion "${criterion.id}" has non-positive weight ${criterion.weight}`;
        continue;
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors[criterion.id] = "score must be a number";
        continue;
      }
      if (value < scale.min || value > scale.max) {
        errors[criterion.id] = `score must be within [${scale.min}, ${scale.max}]`;
      }
    } else if (criterion.kind === "dropdown") {
      if (!Array.isArray(criterion.options) || criterion.options.length === 0) {
        errors[criterion.id] = `criterion "${criterion.id}" has no options defined`;
        continue;
      }
      if (typeof value !== "string" || !criterion.options.includes(value)) {
        errors[criterion.id] = `score must be one of: ${criterion.options.join(", ")}`;
      }
    } else {
      // DEC-148: 'text' -- a string map entry is always required (no partial
      // submissions), but an empty string is only rejected when the
      // criterion itself is marked required.
      if (typeof value !== "string") {
        errors[criterion.id] = "score must be a string";
        continue;
      }
      if (criterion.required === true && value.trim().length === 0) {
        errors[criterion.id] = "a response is required";
        continue;
      }
      // DEC-425: cap free-text criterion values.
      if (value.length > MAX_LONG_TEXT_LENGTH) {
        errors[criterion.id] = overCapFieldMessage(value.length, MAX_LONG_TEXT_LENGTH);
      }
    }
  }

  for (const key of Object.keys(scores)) {
    if (!criterionIds.has(key)) {
      errors[key] = "unknown criterion";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * DEC-676: each rating criterion's integer percentage share of the total
 * rating weight -- weights stay relative and plan-wide (never forced to sum
 * to 100 by the editor), but the editor renders the derived share so
 * "Weight 3" reads as "Weight 3 · 30%". Non-weighted kinds (dropdown/text,
 * or a rating row with no/zero weight yet) get no entry. Empty input or a
 * zero total weight yields an empty map rather than dividing by zero.
 */
export function criterionWeightShares(criteria: { id: string; weight?: number }[]): Record<string, number> {
  const weighted = criteria.filter((c) => typeof c.weight === "number" && c.weight > 0);
  const totalWeight = weighted.reduce((sum, c) => sum + (c.weight as number), 0);
  const shares: Record<string, number> = {};
  if (totalWeight <= 0) return shares;
  for (const c of weighted) {
    shares[c.id] = Math.round(((c.weight as number) / totalWeight) * 100);
  }
  return shares;
}

// DEC-676: a brand-new plan prefills these three editable defaults (equal
// weights, one-line guidance each) instead of an empty criteria list --
// organizers start from a sane baseline rather than a blank "at least one
// criterion is required" error.
export const DEFAULT_PLAN_CRITERIA: EvaluationCriterionDef[] = [
  {
    id: "relevance",
    label: "Relevance",
    kind: "rating",
    weight: 1,
    guidance: "How well does this fit the event's theme and audience?",
  },
  {
    id: "depth",
    label: "Depth",
    kind: "rating",
    weight: 1,
    guidance: "Does the proposal go beyond a surface-level treatment?",
  },
  {
    id: "speaker-readiness",
    label: "Speaker readiness",
    kind: "rating",
    weight: 1,
    guidance: "Has this speaker delivered before, with materials that look ready?",
  },
];

/**
 * DEC-241: aggregates a dropdown criterion's answers into per-option counts
 * plus the modal (most-frequent) option. Ties are broken by the criterion's
 * own option-list order (first tied option wins), so the modal is stable and
 * deterministic. Every evaluation must carry a string score for this
 * criterion -- a missing or non-string score is a data-integrity violation
 * and throws (fail loudly) rather than being silently skipped. Empty input
 * yields a zeroed counts map (one entry per option, all 0) and a null modal.
 */
export function aggregateDropdownCriterion(
  evals: { scores: Record<string, unknown> }[],
  criterion: DropdownCriterionDef,
): { counts: Record<string, number>; modal: string | null } {
  const counts: Record<string, number> = {};
  for (const option of criterion.options) {
    counts[option] = 0;
  }

  for (const evaluation of evals) {
    const value = evaluation.scores[criterion.id];
    if (typeof value !== "string") {
      throw new Error(
        `aggregateDropdownCriterion: missing or non-string score for criterion "${criterion.id}"`,
      );
    }
    if (!(value in counts)) {
      throw new Error(
        `aggregateDropdownCriterion: score "${value}" for criterion "${criterion.id}" is not one of its options`,
      );
    }
    counts[value] = (counts[value] ?? 0) + 1;
  }

  let modal: string | null = null;
  let modalCount = 0;
  for (const option of criterion.options) {
    const count = counts[option] ?? 0;
    if (count > modalCount) {
      modalCount = count;
      modal = option;
    }
  }

  return { counts, modal };
}

/**
 * DEC-147: resolves the criteria list that applies to a given round of a
 * plan. `overridesJson` is the plan's round_criteria_json column verbatim --
 * a JSON object shaped `{"<round>": EvaluationCriterionDef[]}` -- or null.
 * Round 1 and any round absent from the overrides map fall back to `base`
 * (the plan's own criteria_json). This is the single resolution point: every
 * caller (route validation, results/progress aggregation, the reviewer
 * queue/submission/PUT surface) must resolve round criteria through this
 * function rather than re-deriving the fallback logic.
 */
export function criteriaForRound(
  base: EvaluationCriterionDef[],
  overridesJson: string | null,
  round: number,
): EvaluationCriterionDef[] {
  if (!overridesJson) return base;
  const parsed = JSON.parse(overridesJson) as Record<string, EvaluationCriterionDef[]>;
  const forRound = parsed[String(round)];
  return forRound ?? base;
}
