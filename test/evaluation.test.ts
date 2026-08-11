import { describe, it, expect } from "vitest";
import {
  computeWeightedScore,
  aggregateSubmission,
  buildReviewerQueue,
  needsMoreRatings,
  buildResultsRows,
  anonymizeForReviewer,
  validateEvaluationScores,
  isPlanOpen,
  resolveAssignments,
  criteriaForRound,
  type EvaluationCriterion,
  type EvaluationCriterionDef,
  type ReviewerScopeRow,
} from "../src/domain/evaluation";

const criteria: EvaluationCriterion[] = [
  { id: "content", label: "Content quality", weight: 2 },
  { id: "delivery", label: "Delivery", weight: 1 },
];

describe("computeWeightedScore", () => {
  it("computes the weighted mean normalized by total weight", () => {
    const score = computeWeightedScore(
      { content: 4, delivery: 2 },
      criteria,
    );
    // (4*2 + 2*1) / 3 = 10/3
    expect(score).toBeCloseTo(10 / 3);
  });

  it("handles a single criterion (mean equals the raw score)", () => {
    const single: EvaluationCriterion[] = [{ id: "only", label: "Only", weight: 5 }];
    expect(computeWeightedScore({ only: 3 }, single)).toBe(3);
  });

  it("throws on a missing criterion score", () => {
    expect(() => computeWeightedScore({ content: 4 }, criteria)).toThrow();
  });

  it("throws on an out-of-scale value when a scale is given", () => {
    expect(() =>
      computeWeightedScore({ content: 10, delivery: 2 }, criteria, { min: 1, max: 5 }),
    ).toThrow();
  });

  it("throws when criteria list is empty", () => {
    expect(() => computeWeightedScore({}, [])).toThrow();
  });

  it("throws on a non-positive weight", () => {
    const bad: EvaluationCriterion[] = [{ id: "x", label: "X", weight: 0 }];
    expect(() => computeWeightedScore({ x: 1 }, bad)).toThrow();
  });
});

describe("aggregateSubmission", () => {
  it("aggregates multiple evaluations into per-criterion means and overall average", () => {
    const evals = [
      { scores: { content: 4, delivery: 2 } },
      { scores: { content: 2, delivery: 4 } },
    ];
    const agg = aggregateSubmission(evals, criteria);
    expect(agg.count).toBe(2);
    expect(agg.perCriterion.content).toBe(3);
    expect(agg.perCriterion.delivery).toBe(3);
    // eval1 weighted: (4*2+2*1)/3 = 10/3; eval2 weighted: (2*2+4*1)/3 = 8/3
    expect(agg.average).toBeCloseTo((10 / 3 + 8 / 3) / 2);
  });

  it("returns zeroed aggregate for zero evaluations", () => {
    const agg = aggregateSubmission([], criteria);
    expect(agg).toEqual({
      count: 0,
      average: 0,
      perCriterion: { content: 0, delivery: 0 },
    });
  });

  it("throws when an evaluation is missing a criterion score", () => {
    expect(() =>
      aggregateSubmission([{ scores: { content: 4 } }], criteria),
    ).toThrow();
  });

  // DEC-212: a rating-less scorecard (all dropdown/text criteria) passes an
  // empty rating-criteria list to aggregateSubmission; this must not throw
  // (computeWeightedScore's empty-list guard would otherwise fire per-eval).
  it("returns count 0, average 0, empty perCriterion for zero criteria and zero evals", () => {
    const agg = aggregateSubmission([], []);
    expect(agg).toEqual({ count: 0, average: 0, perCriterion: {} });
  });

  it("returns real count, average 0, empty perCriterion for zero criteria with >=1 evals", () => {
    // scores map is irrelevant when criteria is empty -- no criterion id to
    // look up -- but real reviews (e.g. dropdown-only scorecards) still land
    // arbitrary non-rating values here; the shape doesn't matter to the
    // short-circuit.
    const agg = aggregateSubmission(
      [{ scores: {} }, { scores: {} }],
      [],
    );
    expect(agg).toEqual({ count: 2, average: 0, perCriterion: {} });
  });
});

describe("buildReviewerQueue", () => {
  it("excludes items already rated by the reviewer", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 0, alreadyRatedByMe: true },
      { submissionId: "b", ratingsCount: 0, alreadyRatedByMe: false },
    ]);
    expect(queue).toEqual(["b"]);
  });

  it("orders fewest-ratings-first so coverage closes", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 3, alreadyRatedByMe: false },
      { submissionId: "b", ratingsCount: 1, alreadyRatedByMe: false },
      { submissionId: "c", ratingsCount: 2, alreadyRatedByMe: false },
    ]);
    expect(queue).toEqual(["b", "c", "a"]);
  });

  it("breaks ties stably by submissionId", () => {
    const queue = buildReviewerQueue([
      { submissionId: "z", ratingsCount: 1, alreadyRatedByMe: false },
      { submissionId: "a", ratingsCount: 1, alreadyRatedByMe: false },
      { submissionId: "m", ratingsCount: 1, alreadyRatedByMe: false },
    ]);
    expect(queue).toEqual(["a", "m", "z"]);
  });

  it("returns an empty queue when everything is already rated", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 0, alreadyRatedByMe: true },
    ]);
    expect(queue).toEqual([]);
  });
});

describe("needsMoreRatings", () => {
  it("is always true when there is no cap", () => {
    expect(needsMoreRatings({ ratingsCount: 1000 }, undefined)).toBe(true);
  });

  it("is true below the cap", () => {
    expect(needsMoreRatings({ ratingsCount: 2 }, 3)).toBe(true);
  });

  it("is false once the cap is reached", () => {
    expect(needsMoreRatings({ ratingsCount: 3 }, 3)).toBe(false);
  });

  it("is false when past the cap", () => {
    expect(needsMoreRatings({ ratingsCount: 5 }, 3)).toBe(false);
  });
});

describe("buildResultsRows", () => {
  it("sorts by average descending", () => {
    const rows = buildResultsRows([
      { submissionId: "a", average: 3, count: 1 },
      { submissionId: "b", average: 4.5, count: 1 },
      { submissionId: "c", average: 1, count: 1 },
    ]);
    expect(rows.map((r) => r.submissionId)).toEqual(["b", "a", "c"]);
  });

  it("breaks average ties by count descending", () => {
    const rows = buildResultsRows([
      { submissionId: "a", average: 4, count: 2 },
      { submissionId: "b", average: 4, count: 5 },
    ]);
    expect(rows.map((r) => r.submissionId)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { submissionId: "a", average: 1, count: 1 },
      { submissionId: "b", average: 2, count: 1 },
    ];
    const rows = buildResultsRows(input);
    expect(rows).not.toBe(input);
    expect(input[0]?.submissionId).toBe("a");
  });
});

describe("validateEvaluationScores", () => {
  const scale = { min: 1, max: 5 };
  const mixedCriteria: EvaluationCriterionDef[] = [
    { id: "content", label: "Content", kind: "rating", weight: 2 },
    { id: "format", label: "Format", kind: "dropdown", options: ["Talk", "Workshop"] },
  ];

  it("accepts a valid rating + dropdown submission", () => {
    const result = validateEvaluationScores({ content: 4, format: "Talk" }, mixedCriteria, scale);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a missing score", () => {
    const result = validateEvaluationScores({ content: 4 }, mixedCriteria, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.format).toBeDefined();
  });

  it("rejects a rating score outside the scale", () => {
    const result = validateEvaluationScores({ content: 9, format: "Talk" }, mixedCriteria, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.content).toBeDefined();
  });

  it("rejects a non-numeric rating score", () => {
    const result = validateEvaluationScores({ content: "great", format: "Talk" }, mixedCriteria, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.content).toBeDefined();
  });

  it("rejects a dropdown value not in the option list", () => {
    const result = validateEvaluationScores({ content: 4, format: "Keynote" }, mixedCriteria, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.format).toBeDefined();
  });

  it("rejects a non-positive weight on a rating criterion", () => {
    const bad: EvaluationCriterionDef[] = [{ id: "x", label: "X", kind: "rating", weight: 0 }];
    const result = validateEvaluationScores({ x: 1 }, bad, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.x).toBeDefined();
  });

  it("rejects an unknown criterion id in scores", () => {
    const result = validateEvaluationScores(
      { content: 4, format: "Talk", extra: 1 },
      mixedCriteria,
      scale,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.extra).toBeDefined();
  });
});

describe("validateEvaluationScores (DEC-148 'text' kind)", () => {
  const scale = { min: 1, max: 5 };
  const withText: EvaluationCriterionDef[] = [
    { id: "content", label: "Content", kind: "rating", weight: 2 },
    { id: "notes", label: "Notes", kind: "text" },
    { id: "flag", label: "Flag reason", kind: "text", required: true },
  ];

  it("accepts an empty string for a non-required text criterion", () => {
    const result = validateEvaluationScores({ content: 4, notes: "", flag: "reason" }, withText, scale);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a non-empty string for a non-required text criterion", () => {
    const result = validateEvaluationScores({ content: 4, notes: "great talk", flag: "reason" }, withText, scale);
    expect(result).toEqual({ ok: true });
  });

  it("rejects an empty string for a required text criterion", () => {
    const result = validateEvaluationScores({ content: 4, notes: "", flag: "" }, withText, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.flag).toBeDefined();
  });

  it("rejects whitespace-only as empty for a required text criterion", () => {
    const result = validateEvaluationScores({ content: 4, notes: "", flag: "   " }, withText, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.flag).toBeDefined();
  });

  it("rejects a non-string value for a text criterion", () => {
    const result = validateEvaluationScores({ content: 4, notes: 5, flag: "reason" }, withText, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.notes).toBeDefined();
  });

  it("still rejects a missing text criterion entry entirely", () => {
    const result = validateEvaluationScores({ content: 4, flag: "reason" }, withText, scale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.notes).toBeDefined();
  });
});

describe("criteriaForRound (DEC-147)", () => {
  const base: EvaluationCriterionDef[] = [{ id: "c1", label: "Base quality", kind: "rating", weight: 1 }];
  const round2: EvaluationCriterionDef[] = [{ id: "c2", label: "Round 2 override", kind: "rating", weight: 3 }];

  it("returns base when overridesJson is null", () => {
    expect(criteriaForRound(base, null, 1)).toBe(base);
    expect(criteriaForRound(base, null, 2)).toBe(base);
  });

  it("returns base for round 1 by convention even with overrides present for other rounds", () => {
    const overrides = JSON.stringify({ "2": round2 });
    expect(criteriaForRound(base, overrides, 1)).toBe(base);
  });

  it("returns the round-specific override when present", () => {
    const overrides = JSON.stringify({ "2": round2 });
    expect(criteriaForRound(base, overrides, 2)).toEqual(round2);
  });

  it("falls back to base for a round absent from the overrides map", () => {
    const overrides = JSON.stringify({ "2": round2 });
    expect(criteriaForRound(base, overrides, 3)).toBe(base);
  });
});

describe("isPlanOpen", () => {
  it("is open with no dates at all", () => {
    expect(isPlanOpen(null, null, 1000)).toBe(true);
  });

  it("is closed before the open date", () => {
    expect(isPlanOpen(2000, null, 1000)).toBe(false);
  });

  it("is closed after the close date", () => {
    expect(isPlanOpen(null, 500, 1000)).toBe(false);
  });

  it("is open within the window", () => {
    expect(isPlanOpen(500, 1500, 1000)).toBe(true);
  });
});

describe("resolveAssignments", () => {
  const subs = [
    { id: "s1", trackIds: ["t1"] },
    { id: "s2", trackIds: ["t2"] },
    { id: "s3", trackIds: [] as string[] },
  ];

  it("assigns everything to a reviewer with an unrestricted row", () => {
    const rows: ReviewerScopeRow[] = [{ userId: "u1", trackId: null, submissionId: null }];
    const result = resolveAssignments(subs, rows);
    expect(result.get("u1")?.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("assigns only submissions matching a track-scoped row", () => {
    const rows: ReviewerScopeRow[] = [{ userId: "u1", trackId: "t1", submissionId: null }];
    const result = resolveAssignments(subs, rows);
    expect(result.get("u1")?.map((s) => s.id)).toEqual(["s1"]);
  });

  it("assigns only the submission named by a submission-scoped row", () => {
    const rows: ReviewerScopeRow[] = [{ userId: "u1", trackId: null, submissionId: "s3" }];
    const result = resolveAssignments(subs, rows);
    expect(result.get("u1")?.map((s) => s.id)).toEqual(["s3"]);
  });

  it("unions submission scopes and track scopes across multiple rows for the same reviewer", () => {
    const rows: ReviewerScopeRow[] = [
      { userId: "u1", trackId: "t2", submissionId: null },
      { userId: "u1", trackId: null, submissionId: "s3" },
    ];
    const result = resolveAssignments(subs, rows);
    expect(result.get("u1")?.map((s) => s.id).sort()).toEqual(["s2", "s3"]);
  });

  it("reflects the plan's own track-filter intersection because `all` is already plan-filtered", () => {
    // resolveAssignments itself doesn't know about plan filters -- callers
    // pass an `all` list already narrowed by listPlanFilteredSubmissions.
    // A track-scoped reviewer whose track was filtered out of `all` gets no
    // assignments even though their plan_reviewer row still names it.
    const planFiltered = [{ id: "s1", trackIds: ["t1"] }];
    const rows: ReviewerScopeRow[] = [{ userId: "u1", trackId: "t2", submissionId: null }];
    const result = resolveAssignments(planFiltered, rows);
    expect(result.get("u1")).toEqual([]);
  });

  it("gives no entry for a userId with no rows at all", () => {
    const result = resolveAssignments(subs, []);
    expect(result.has("u1")).toBe(false);
  });

  it("assigns nothing to a reviewer whose scopes match nothing", () => {
    const rows: ReviewerScopeRow[] = [{ userId: "u1", trackId: "t9", submissionId: null }];
    const result = resolveAssignments(subs, rows);
    expect(result.get("u1")).toEqual([]);
  });
});

describe("anonymizeForReviewer", () => {
  it("strips speaker identity and answer fields", () => {
    const sub = {
      id: "s1",
      title: "Talk",
      speakers: [{ name: "Ada Lovelace" }],
      speakerAnswers: { bio: "..." },
    };
    const anon = anonymizeForReviewer(sub);
    expect(anon.speakers).toBeUndefined();
    expect(anon.speakerAnswers).toBeUndefined();
    expect(anon.id).toBe("s1");
    expect(anon.title).toBe("Talk");
  });
});
