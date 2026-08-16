// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Weighted scoring + per-submission aggregation. Split out of the former
// monolithic src/domain/evaluation.ts (contention decomposition, no
// behavior change) -- see src/domain/evaluation.ts for the re-export barrel.

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
    if (typeof score !== "number" || !Number.isFinite(score)) {
      // Fail loudly (DEC-241 amendment): a non-numeric value under a
      // 'rating' criterion id (e.g. a Choice/dropdown pick that leaked
      // through, or malformed data) must never silently multiply into NaN
      // and poison the weighted mean -- callers pass only rating criteria
      // here (see src/routes/review/reviewer.ts, evaluations.ts,
      // src/server/repo/exports/evaluations.ts), so every id in `criteria`
      // is expected to carry a real number.
      throw new Error(
        `computeWeightedScore: score for criterion "${criterion.id}" must be a finite number, got ${JSON.stringify(score)}`,
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
