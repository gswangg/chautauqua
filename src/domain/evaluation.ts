// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.

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

export interface RatingCriterionDef {
  id: string;
  label: string;
  kind: "rating";
  weight: number;
  options?: undefined;
}

export interface DropdownCriterionDef {
  id: string;
  label: string;
  kind: "dropdown";
  weight?: undefined;
  options: string[];
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
}

export type EvaluationCriterionDef = RatingCriterionDef | DropdownCriterionDef | TextCriterionDef;

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
 */
export function validateEvaluationScores(
  scores: Record<string, unknown>,
  criteria: EvaluationCriterionDef[],
  scale: { min: number; max: number },
): { ok: true } | { ok: false; errors: EvaluationErrors } {
  const errors: EvaluationErrors = {};
  const criterionIds = new Set(criteria.map((c) => c.id));

  for (const criterion of criteria) {
    const value = scores[criterion.id];
    if (value === undefined || value === null) {
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
 */
export function isPlanOpen(
  openDate: number | null | undefined,
  closeDate: number | null | undefined,
  now: number,
): boolean {
  if (openDate !== null && openDate !== undefined && now < openDate) return false;
  if (closeDate !== null && closeDate !== undefined && now > closeDate) return false;
  return true;
}

export interface ReviewerQueueItem {
  submissionId: string;
  ratingsCount: number;
  alreadyRatedByMe: boolean;
}

/**
 * Builds a reviewer's queue: excludes submissions already rated by this
 * reviewer, ordered fewest-ratings-first so coverage closes (SPEC J4), and
 * stable by submissionId for ties.
 */
export function buildReviewerQueue(items: ReviewerQueueItem[]): string[] {
  return items
    .filter((item) => !item.alreadyRatedByMe)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.ratingsCount !== b.item.ratingsCount) {
        return a.item.ratingsCount - b.item.ratingsCount;
      }
      if (a.item.submissionId !== b.item.submissionId) {
        return a.item.submissionId < b.item.submissionId ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item.submissionId);
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
 * Strips speaker identity/answer fields from a submission for an anonymized
 * reviewer queue. This must run server-side -- anonymization is never
 * implemented as CSS-hiding on the client.
 */
export function anonymizeForReviewer<
  T extends { speakers?: unknown; speakerAnswers?: unknown },
>(sub: T): T {
  return { ...sub, speakers: undefined, speakerAnswers: undefined };
}
