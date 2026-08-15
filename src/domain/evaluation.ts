// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.

// DEC-425: caps the last uncapped free-text write paths; reuses the
// existing MAX_LONG_TEXT_LENGTH constant rather than introducing a new one.
import { MAX_LONG_TEXT_LENGTH } from "../forms/validate";
// DEC-522: openDate/closeDate are day labels (UTC midnight of the intended
// calendar day), not instants -- expand through the owning event's timezone
// at this hard gate, same class of fix as the CFP open/close window.
import { dayLabelStartInstant, dayLabelEndInstant } from "../lib/timezone";
// DEC-676: criteria carry optional one-line guidance, a plan-wide weighted
// share display, and default-plan criteria -- see normalizeGuidance,
// criterionWeightShares, DEFAULT_PLAN_CRITERIA below.
import { DEC_676 } from "../decisions";

void DEC_676;

export interface EvaluationCriterion {
  id: string;
  label: string;
  /** Must be a positive number; weight of zero or negative is invalid. */
  weight: number;
}

export interface EvaluationPlanDef {
  scale: { min: number; max: number };
  criteria: EvaluationCriterion[];
  anonymized: boolean;
  /** Optional cap on how many reviewer evaluations a submission may receive. */
  maxEvaluationsPerSubmission?: number;
}

/** Map of criterionId -> score, one entry per criterion in the plan. */
export type EvaluationScores = Record<string, number>;

/**
 * Weighted mean of scores, normalized by total weight. Fails loudly if a
 * criterion's score is missing, or a score falls outside the plan's scale
 * bounds -- callers must supply complete, valid data.
 */
export function computeWeightedScore(
  scores: EvaluationScores,
  criteria: EvaluationCriterion[],
  scale?: { min: number; max: number },
): number {
  if (criteria.length === 0) {
    throw new Error("computeWeightedScore: criteria list is empty");
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of criteria) {
    if (criterion.weight <= 0) {
      throw new Error(
        `computeWeightedScore: criterion "${criterion.id}" has non-positive weight ${criterion.weight}`,
      );
    }
    const score = scores[criterion.id];
    if (score === undefined || score === null) {
      throw new Error(
        `computeWeightedScore: missing score for criterion "${criterion.id}"`,
      );
    }
    if (scale && (score < scale.min || score > scale.max)) {
      throw new Error(
        `computeWeightedScore: score ${score} for criterion "${criterion.id}" is out of scale [${scale.min}, ${scale.max}]`,
      );
    }
    weightedSum += score * criterion.weight;
    totalWeight += criterion.weight;
  }

  return weightedSum / totalWeight;
}

export interface SubmissionAggregate {
  count: number;
  average: number;
  perCriterion: Record<string, number>;
}

/**
 * Aggregates a submission's evaluations into a per-criterion mean and an
 * overall weighted average. Empty input yields count 0, average 0, and an
 * empty perCriterion map -- never throws on zero evaluations.
 */
export function aggregateSubmission(
  evals: { scores: EvaluationScores }[],
  criteria: EvaluationCriterion[],
): SubmissionAggregate {
  // DEC-212: a rating-less scorecard (all dropdown/text criteria, no
  // 'rating' criteria) has no numeric weight to aggregate -- there is
  // nothing for computeWeightedScore to do, and calling it per-eval would
  // hit its empty-list invariant throw. Short-circuit with average 0 and an
  // empty perCriterion map, but keep count real (reviews did happen).
  if (criteria.length === 0) {
    return { count: evals.length, average: 0, perCriterion: {} };
  }

  const perCriterion: Record<string, number> = {};

  if (evals.length === 0) {
    for (const criterion of criteria) {
      perCriterion[criterion.id] = 0;
    }
    return { count: 0, average: 0, perCriterion };
  }

  for (const criterion of criteria) {
    let sum = 0;
    for (const evaluation of evals) {
      const score = evaluation.scores[criterion.id];
      if (score === undefined || score === null) {
        throw new Error(
          `aggregateSubmission: missing score for criterion "${criterion.id}"`,
        );
      }
      sum += score;
    }
    perCriterion[criterion.id] = sum / evals.length;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const evaluation of evals) {
    weightedSum += computeWeightedScore(evaluation.scores, criteria);
    totalWeight += 1;
  }

  return {
    count: evals.length,
    average: weightedSum / totalWeight,
    perCriterion,
  };
}

// ---------------------------------------------------------------------------
// Criteria validation (DEC-018): a plan's criteria_json can mix 'rating'
// (numeric, weighted, in-scale) and 'dropdown' (string, from a fixed option
// list) criteria; free text lives outside scores as evaluation.comment.
// ---------------------------------------------------------------------------

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
        errors[criterion.id] = `Max ${MAX_LONG_TEXT_LENGTH}`;
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

/**
 * True when `now` falls within the plan's open/close window (DEC-018 queue
 * gating). A null openDate/closeDate means unbounded on that side.
 *
 * DEC-522: openDate/closeDate are day labels (UTC midnight of the intended
 * calendar day), not instants -- a present openDate is expanded through
 * dayLabelStartInstant (start of that day in `timeZone`) and a present
 * closeDate through dayLabelEndInstant (end of that day in `timeZone`), so a
 * plan set to close 2027-03-01 for a Pacific-timezone event stays open
 * through end-of-day Pacific on 2027-03-01, not UTC midnight.
 */
export function isPlanOpen(
  openDate: number | null | undefined,
  closeDate: number | null | undefined,
  now: number,
  timeZone: string,
): boolean {
  if (!timeZone) throw new Error("isPlanOpen requires a non-empty timeZone");
  if (openDate !== null && openDate !== undefined && now < dayLabelStartInstant(openDate, timeZone)) return false;
  if (closeDate !== null && closeDate !== undefined && now > dayLabelEndInstant(closeDate, timeZone)) return false;
  return true;
}

export interface ReviewerQueueItem {
  submissionId: string;
  ratingsCount: number;
  alreadyRatedByMe: boolean;
  // DEC-845: this reviewer's OWN blended score (computeWeightedScore, this
  // module), null when they have not scored the submission yet. Optional on
  // input -- callers that don't yet have it can omit it and it reads as null
  // on output -- but always present on every returned item.
  myScore?: number | null;
}

export interface OrderedReviewerQueueItem {
  submissionId: string;
  myScore: number | null;
}

/**
 * Builds a reviewer's queue ordering: returns EVERY item (DEC-561 --
 * completed work sinks to the bottom instead of vanishing), sorted by
 * (alreadyRatedByMe ? 1 : 0) asc first, then ratingsCount asc, then
 * submissionId asc, then original index -- so everything actionable stays
 * fewest-ratings-first ahead of everything already rated by this reviewer.
 * DEC-845: each returned item also carries the reviewer's own `myScore`
 * (passed through verbatim, defaulting to null) -- callers no longer need a
 * second pass over the ordered ids to attach it.
 */
export function buildReviewerQueue(items: ReviewerQueueItem[]): OrderedReviewerQueueItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRated = a.item.alreadyRatedByMe ? 1 : 0;
      const bRated = b.item.alreadyRatedByMe ? 1 : 0;
      if (aRated !== bRated) return aRated - bRated;
      if (a.item.ratingsCount !== b.item.ratingsCount) {
        return a.item.ratingsCount - b.item.ratingsCount;
      }
      if (a.item.submissionId !== b.item.submissionId) {
        return a.item.submissionId < b.item.submissionId ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ item }) => ({ submissionId: item.submissionId, myScore: item.myScore ?? null }));
}

/**
 * True when a submission still needs more ratings under the plan's
 * maxEvaluationsPerSubmission cap. With no cap, always true (unbounded).
 */
export function needsMoreRatings(
  item: { ratingsCount: number },
  cap: number | undefined,
): boolean {
  if (cap === undefined) return true;
  return item.ratingsCount < cap;
}

export interface ResultsRowInput {
  submissionId: string;
  average: number;
  count: number;
}

/**
 * Producer results table rows: sorted by average score descending, then by
 * count descending as a tiebreaker (more-rated submissions rank higher when
 * averages tie).
 */
export function buildResultsRows<T extends ResultsRowInput>(subs: T[]): T[] {
  return [...subs].sort((a, b) => {
    if (a.average !== b.average) return b.average - a.average;
    if (a.count !== b.count) return b.count - a.count;
    return 0;
  });
}

// DEC-345: results-table column sort, moved verbatim from the former SPA
// module app/src/pages/review/resultsSort.ts into pure core so the
// GET /api/v1/plans/:id/results route can sort server-side over the WHOLE
// ranked set before paging (DEC-341's paging-without-sorting bug class).

export type SortDirection = "asc" | "desc";

/** The minimal row shape the sort helper needs -- matches ResultsRow. */
export interface SortableResultsRow {
  ref: string;
  // DEC-345 addition (beyond the resultsSort.ts port): the results route's
  // ?sort= param also accepts 'title', for a server-side title sort.
  title?: string;
  average: number;
  count: number;
  perCriterion: Record<string, number>;
  perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
}

export type ResultsSortKey =
  | { column: "ref" }
  | { column: "title" }
  | { column: "average" }
  | { column: "count" }
  | { column: "rating"; criterionId: string }
  | { column: "dropdown"; criterionId: string };

/**
 * Extracts the comparable value for a column: Ref/Title sort as strings;
 * average and # Evaluations sort as their own numbers; a rating-criterion
 * column sorts by its perCriterion mean (0 when absent -- mirrors the
 * table's '—' display, which reads a missing entry as 0); a
 * dropdown-criterion column sorts by its modal option's count (the number
 * rendered as 'modal xN'), 0 when there's no modal (no evaluations yet).
 */
export function sortValueForColumn(row: SortableResultsRow, key: ResultsSortKey): number | string {
  switch (key.column) {
    case "ref":
      return row.ref;
    case "title":
      return row.title ?? "";
    case "average":
      return row.average;
    case "count":
      return row.count;
    case "rating":
      return row.perCriterion[key.criterionId] ?? 0;
    case "dropdown": {
      const agg = row.perDropdown[key.criterionId];
      if (!agg || agg.modal === null) return 0;
      return agg.counts[agg.modal] ?? 0;
    }
  }
}

function compareResultsValues(a: number | string, b: number | string): number {
  if (typeof a === "string" && typeof b === "string") {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  return (a as number) - (b as number);
}

/**
 * Sorts a copy of `rows` by the given column/direction. Ties keep their
 * original relative order (Array.prototype.sort is stable, and negating the
 * comparator for 'desc' preserves that -- 0 stays 0 either way) so a
 * direction toggle never reshuffles equal rows.
 */
export function sortResultsRows<T extends SortableResultsRow>(
  rows: T[],
  key: ResultsSortKey,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareResultsValues(sortValueForColumn(a, key), sortValueForColumn(b, key)));
}

export interface ReviewerScopeRow {
  userId: string;
  trackId: string | null;
  submissionId: string | null;
}

/**
 * Pure set-based assignment resolution (DEC-081): given the plan-filtered
 * submissions and every plan_reviewer row for a plan, returns a map of
 * userId -> assigned submissions. A reviewer with any unrestricted row
 * (trackId and submissionId both null) is assigned every submission in
 * `all`; otherwise a reviewer is assigned the union of their explicit
 * submission scopes and submissions matching one of their track scopes.
 * A userId with no rows at all is simply absent from the returned map.
 */
export function resolveAssignments<T extends { id: string; trackIds: string[] }>(
  all: T[],
  reviewerRows: ReviewerScopeRow[],
): Map<string, T[]> {
  const rowsByUser = new Map<string, ReviewerScopeRow[]>();
  for (const row of reviewerRows) {
    const list = rowsByUser.get(row.userId) ?? [];
    list.push(row);
    rowsByUser.set(row.userId, list);
  }

  const result = new Map<string, T[]>();
  for (const [userId, rows] of rowsByUser) {
    const unrestricted = rows.some((r) => r.trackId === null && r.submissionId === null);
    if (unrestricted) {
      result.set(userId, all);
      continue;
    }
    const submissionScopes = new Set(rows.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string));
    const trackScopes = new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string));
    const assigned = all.filter((item) => submissionScopes.has(item.id) || item.trackIds.some((t) => trackScopes.has(t)));
    result.set(userId, assigned);
  }
  return result;
}

/**
 * Escapes every regex metacharacter in `s` so it can be embedded literally
 * inside a RegExp source string (a company name like "C++ Corp" must match
 * itself, not be read as regex syntax).
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * DEC-018 (wave-54 amendment): masks every occurrence of any of `identities`
 * inside `value` with the literal string `[hidden]`, case-insensitively.
 * Identities are matched as literal text (regex metacharacters escaped, so a
 * company like "C++ Corp" matches itself rather than being read as regex
 * syntax) and applied longest-first, so a full name is masked before a
 * shorter identity that happens to be a substring of it gets a chance to
 * leave a fragment behind. Blank/whitespace-only identities are ignored
 * (they would otherwise match everything). `value` may be a string (masked
 * directly) or an array of strings (each entry masked); any other value
 * (number, boolean, null, object, ...) passes through untouched -- this is a
 * text-redaction primitive, not a deep-object walker.
 */
export function redactIdentity(value: unknown, identities: string[]): unknown {
  const cleaned = identities
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .sort((a, b) => b.length - a.length);

  if (cleaned.length === 0) {
    return value;
  }

  const pattern = new RegExp(cleaned.map(escapeRegExp).join("|"), "gi");

  const maskString = (s: string): string => s.replace(pattern, "[hidden]");

  if (typeof value === "string") {
    return maskString(value);
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return (value as string[]).map(maskString);
  }
  return value;
}

/**
 * Strips speaker identity/answer fields from a submission for an anonymized
 * reviewer queue, and masks every occurrence of a speaker's identity
 * (name/email/company, DEC-018 wave-54 amendment) out of the free text that
 * survives -- title, description, and every sessionAnswers[].value -- so an
 * anonymized plan carries no speaker identity STRING anywhere in the
 * payload, not just in the dedicated speaker fields. This must run
 * server-side -- anonymization is never implemented as CSS-hiding on the
 * client.
 */
export function anonymizeForReviewer<
  T extends {
    speakers?: unknown;
    speakerAnswers?: unknown;
    title?: unknown;
    description?: unknown;
    sessionAnswers?: { value: unknown }[];
  },
>(sub: T, identities: string[]): T & { anonymized: true } {
  const redactedSessionAnswers = sub.sessionAnswers?.map((a) => ({
    ...a,
    value: redactIdentity(a.value, identities),
  }));
  return {
    ...sub,
    speakers: undefined,
    speakerAnswers: undefined,
    title: typeof sub.title === "string" ? redactIdentity(sub.title, identities) : sub.title,
    description:
      typeof sub.description === "string" ? redactIdentity(sub.description, identities) : sub.description,
    ...(redactedSessionAnswers ? { sessionAnswers: redactedSessionAnswers } : {}),
    anonymized: true,
  };
}

// ---------------------------------------------------------------------------
// Recusal (DEC-271, ABS-12): reviewer conflict-of-interest self-exclusion.
// Pure set-partitioning logic lives here; the repo layer has no real-D1 test
// harness, so this is the tested core.
// ---------------------------------------------------------------------------

/**
 * Splits a reviewer's queue/scope items into { kept, recused } by
 * submissionId membership in `recusedIds`. Order of `kept` is preserved.
 */
export function partitionRecused<T extends { submissionId: string }>(
  items: T[],
  recusedIds: Set<string>,
): { kept: T[]; recused: T[] } {
  const kept: T[] = [];
  const recused: T[] = [];
  for (const item of items) {
    if (recusedIds.has(item.submissionId)) recused.push(item);
    else kept.push(item);
  }
  return { kept, recused };
}

/**
 * Filters a reviewer's assigned submissions down to those they have not
 * recused themselves from, for progress-endpoint `assigned` counts.
 */
export function assignedExcludingRecused<T extends { id: string }>(
  assigned: T[],
  recusedIds: Set<string>,
): T[] {
  return assigned.filter((item) => !recusedIds.has(item.id));
}

// ---------------------------------------------------------------------------
// Reviewer progress state + reminder scope (DEC-707): the mock's vocabulary
// is DONE / N TO GO / NOT STARTED, and a reminder's label must name exactly
// who it sends to -- ONE predicate here, imported by both
// POST /plans/:id/remind and the Review landing's SPA label.
// ---------------------------------------------------------------------------

export type ReviewerProgressState = "done" | "not_started" | "in_progress";

/** DEC-707: a reviewer with nothing assigned reads as "done" (vacuously
 * complete -- there is no queue to work), never "not started". */
export function reviewerProgressState({
  assigned,
  completed,
}: {
  assigned: number;
  completed: number;
}): ReviewerProgressState {
  if (completed >= assigned) return "done";
  if (completed === 0) return "not_started";
  return "in_progress";
}

/** DEC-845/w5-f: a reviewer's own track scope, resolved from THEIR
 * plan_reviewer scope rows for one plan -- the same pure fold
 * getReviewerScopeTrackId (server/repo/review/reviewers.ts) wraps with a
 * DB read, factored out so the progress endpoint can resolve it for every
 * reviewer from rows it already has in memory (no query per reviewer). A
 * row with both trackId and submissionId null means "no track restriction"
 * (null result); more than one distinct trackId across the reviewer's rows
 * is not a single scope either (null result) -- only a reviewer whose scope
 * rows agree on exactly one track resolves to that track's id. */
export function resolveReviewerScopeTrackId(rows: { trackId: string | null; submissionId: string | null }[]): string | null {
  if (rows.length === 0) return null;
  const unrestricted = rows.some((r) => r.trackId === null && r.submissionId === null);
  if (unrestricted) return null;
  const trackIds = [...new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
  if (trackIds.length !== 1) return null;
  return trackIds[0] ?? null;
}

export interface RemindTargetRow {
  userId: string;
  assigned: number;
  completed: number;
}

/**
 * DEC-707: selects which reviewer rows a reminder send targets. 'not_started'
 * is the landing page's tertiary "Remind the N not started" link; 'incomplete'
 * (any non-done state) is the broader batch POST /plans/:id/remind defaults
 * to. Both the route and the SPA label MUST call this -- a hand-copied
 * predicate in either place is exactly the drift DEC-707 forbids.
 */
export function selectRemindTargets<T extends RemindTargetRow>(
  rows: T[],
  scope: "not_started" | "incomplete",
): T[] {
  if (scope === "not_started") {
    return rows.filter((r) => reviewerProgressState(r) === "not_started");
  }
  return rows.filter((r) => reviewerProgressState(r) !== "done");
}
