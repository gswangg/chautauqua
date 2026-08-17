import { describe, it, expect } from "vitest";
import {
  computeWeightedScore,
  aggregateSubmission,
  aggregateDropdownCriterion,
  buildReviewerQueue,
  needsMoreRatings,
  buildResultsRows,
  assignScoreRanks,
  anonymizeForReviewer,
  redactIdentity,
  validateEvaluationScores,
  reviewerProgressState,
  selectRemindTargets,
  isPlanOpen,
  resolveAssignments,
  criteriaForRound,
  partitionRecused,
  assignedExcludingRecused,
  resolveReviewerScopeTrackIds,
  formatReviewerScopeLabel,
  type EvaluationCriterion,
  type EvaluationCriterionDef,
  type DropdownCriterionDef,
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
  // DEC-561: already-rated items are no longer excluded -- they sink to the
  // bottom of the queue instead of vanishing, so a reviewer can reopen them.
  it("keeps items already rated by the reviewer, sunk to the bottom", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 0, alreadyRatedByMe: true },
      { submissionId: "b", ratingsCount: 0, alreadyRatedByMe: false },
    ]);
    expect(queue.map((i) => i.submissionId)).toEqual(["b", "a"]);
  });

  it("orders fewest-ratings-first so coverage closes", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 3, alreadyRatedByMe: false },
      { submissionId: "b", ratingsCount: 1, alreadyRatedByMe: false },
      { submissionId: "c", ratingsCount: 2, alreadyRatedByMe: false },
    ]);
    expect(queue.map((i) => i.submissionId)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties stably by submissionId", () => {
    const queue = buildReviewerQueue([
      { submissionId: "z", ratingsCount: 1, alreadyRatedByMe: false },
      { submissionId: "a", ratingsCount: 1, alreadyRatedByMe: false },
      { submissionId: "m", ratingsCount: 1, alreadyRatedByMe: false },
    ]);
    expect(queue.map((i) => i.submissionId)).toEqual(["a", "m", "z"]);
  });

  it("returns a single-item queue when everything is already rated", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 0, alreadyRatedByMe: true },
    ]);
    expect(queue.map((i) => i.submissionId)).toEqual(["a"]);
  });

  it("orders rated items last (fewest-ratings-first preserved within each group), fewest-ratings-first preserved among unrated", () => {
    const queue = buildReviewerQueue([
      { submissionId: "z", ratingsCount: 1, alreadyRatedByMe: true },
      { submissionId: "a", ratingsCount: 5, alreadyRatedByMe: true },
      { submissionId: "b", ratingsCount: 3, alreadyRatedByMe: false },
      { submissionId: "c", ratingsCount: 1, alreadyRatedByMe: false },
    ]);
    expect(queue.map((i) => i.submissionId)).toEqual(["c", "b", "z", "a"]);
  });

  // DEC-845: each ordered item carries the reviewer's OWN blended score
  // through verbatim -- null when they have not scored the submission yet,
  // never re-derived or dropped by the sort/map pass.
  it("carries myScore through per item, null when unscored", () => {
    const queue = buildReviewerQueue([
      { submissionId: "a", ratingsCount: 0, alreadyRatedByMe: true, myScore: 4.5 },
      { submissionId: "b", ratingsCount: 0, alreadyRatedByMe: false },
      { submissionId: "c", ratingsCount: 0, alreadyRatedByMe: false, myScore: null },
    ]);
    expect(queue).toEqual([
      { submissionId: "b", myScore: null },
      { submissionId: "c", myScore: null },
      { submissionId: "a", myScore: 4.5 },
    ]);
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

// Post-eval amendment: the results table's Rank column must report SCORE
// standing, not display position -- toggling the sort ascending used to
// renumber the rows 1..N top-down.
describe("assignScoreRanks", () => {
  it("numbers the ranked population 1..N", () => {
    const ranked = assignScoreRanks(
      buildResultsRows([
        { submissionId: "a", average: 3, count: 1 },
        { submissionId: "b", average: 4.5, count: 1 },
        { submissionId: "c", average: 1, count: 1 },
      ]),
    );
    expect(ranked.map((r) => [r.submissionId, r.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });

  it("gives rows equal on BOTH ranking keys the same rank, and skips the positions they consumed", () => {
    const ranked = assignScoreRanks(
      buildResultsRows([
        { submissionId: "a", average: 4, count: 2 },
        { submissionId: "b", average: 5, count: 2 },
        { submissionId: "c", average: 4, count: 2 },
        { submissionId: "d", average: 2, count: 1 },
      ]),
    );
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("does NOT tie rows that share an average but differ on count -- they hold different positions", () => {
    const ranked = assignScoreRanks(
      buildResultsRows([
        { submissionId: "a", average: 4, count: 2 },
        { submissionId: "b", average: 4, count: 5 },
      ]),
    );
    expect(ranked.map((r) => [r.submissionId, r.rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("a rank travels with its row -- re-sorting the ranked array never renumbers it", () => {
    const ranked = assignScoreRanks(
      buildResultsRows([
        { submissionId: "a", average: 3, count: 1 },
        { submissionId: "b", average: 4.5, count: 1 },
        { submissionId: "c", average: 1, count: 1 },
      ]),
    );
    const ascending = [...ranked].sort((x, y) => x.average - y.average);
    expect(ascending.map((r) => [r.submissionId, r.rank])).toEqual([
      ["c", 3],
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("returns a new array of new objects -- the input rows are untouched", () => {
    const input = [{ submissionId: "a", average: 1, count: 1 }];
    const ranked = assignScoreRanks(input);
    expect(ranked).not.toBe(input);
    expect(ranked[0]).not.toBe(input[0]);
    expect(input[0]).not.toHaveProperty("rank");
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

  // DEC-425: caps a 'text' criterion's value at MAX_LONG_TEXT_LENGTH.
  it("rejects a text criterion value over MAX_LONG_TEXT_LENGTH", () => {
    const result = validateEvaluationScores(
      { content: 4, notes: "x".repeat(20001), flag: "reason" },
      withText,
      scale,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.notes).toBeDefined();
  });

  it("accepts a text criterion value exactly AT MAX_LONG_TEXT_LENGTH (off-by-one)", () => {
    const result = validateEvaluationScores(
      { content: 4, notes: "x".repeat(20000), flag: "reason" },
      withText,
      scale,
    );
    expect(result).toEqual({ ok: true });
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
  const UTC = "UTC";

  it("is open with no dates at all", () => {
    expect(isPlanOpen(null, null, 1000, UTC)).toBe(true);
  });

  it("is closed before the open date", () => {
    expect(isPlanOpen(Date.UTC(1970, 0, 3), null, 1000, UTC)).toBe(false);
  });

  it("is closed after the close date", () => {
    expect(isPlanOpen(null, Date.UTC(1970, 0, 1), 1000, UTC)).toBe(true); // still within day-label 1970-01-01
    expect(isPlanOpen(null, Date.UTC(1970, 0, 1), Date.UTC(1970, 0, 2), UTC)).toBe(false);
  });

  it("is open within the window", () => {
    expect(isPlanOpen(Date.UTC(1970, 0, 1), Date.UTC(1970, 0, 3), 1000, UTC)).toBe(true);
  });

  it("throws without a timeZone", () => {
    expect(() => isPlanOpen(null, null, 1000, "")).toThrow();
  });

  // DEC-522: openDate/closeDate are day labels (UTC midnight of the intended
  // calendar day), not instants -- a plan set to close 2027-03-01 for a
  // Pacific-timezone event stays open through end-of-day Pacific on
  // 2027-03-01, not UTC midnight.
  it("DEC-522 regression: a close day-label of 2027-03-01 in America/Los_Angeles is still OPEN at 2027-03-01T23:00Z", () => {
    const closeDate = Date.UTC(2027, 2, 1);
    const now = Date.UTC(2027, 2, 1, 23, 0, 0);
    expect(isPlanOpen(null, closeDate, now, "America/Los_Angeles")).toBe(true);
  });

  it("DEC-522: closes at 2027-03-02T08:00:01Z (one second past end-of-day Pacific)", () => {
    const closeDate = Date.UTC(2027, 2, 1);
    const now = Date.UTC(2027, 2, 2, 8, 0, 1);
    expect(isPlanOpen(null, closeDate, now, "America/Los_Angeles")).toBe(false);
  });

  it("DEC-522: east-of-UTC zone (Asia/Tokyo) — a day-label expands to the preceding UTC day's afternoon", () => {
    const closeDate = Date.UTC(2027, 5, 15); // 2027-06-15 day label
    const stillOpen = Date.UTC(2027, 5, 15, 14, 59, 59, 999); // 23:59:59.999 Tokyo
    const closed = Date.UTC(2027, 5, 15, 15, 0, 0); // 2027-06-16T00:00 Tokyo
    expect(isPlanOpen(null, closeDate, stillOpen, "Asia/Tokyo")).toBe(true);
    expect(isPlanOpen(null, closeDate, closed, "Asia/Tokyo")).toBe(false);
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

describe("redactIdentity", () => {
  it("masks a case-insensitive occurrence in a string", () => {
    expect(redactIdentity("Talk by ADA LOVELACE about math", ["Ada Lovelace"])).toBe(
      "Talk by [hidden] about math",
    );
  });

  it("applies identities longest-first so a full name is masked before a substring identity fragments it", () => {
    // "Ada" alone is also an identity here (e.g. a nickname/first-name-only
    // entry); the full name must win so no bare "[hidden] Lovelace" fragment
    // survives.
    expect(redactIdentity("Ada Lovelace spoke well", ["Ada", "Ada Lovelace"])).toBe(
      "[hidden] spoke well",
    );
  });

  it("escapes regex metacharacters so a literal company name matches itself", () => {
    expect(redactIdentity("Sponsored by C++ Corp this year", ["C++ Corp"])).toBe(
      "Sponsored by [hidden] this year",
    );
    // Sanity: a naive unescaped regex would treat "++" as invalid/greedy
    // syntax and either throw or fail to match -- this must not happen.
    expect(() => redactIdentity("no match here", ["C++ Corp"])).not.toThrow();
  });

  it("masks every occurrence within an array of strings", () => {
    expect(redactIdentity(["Ada Lovelace", "not Ada Lovelace either"], ["Ada Lovelace"])).toEqual([
      "[hidden]",
      "not [hidden] either",
    ]);
  });

  it("leaves non-string, non-string-array values untouched", () => {
    expect(redactIdentity(42, ["Ada Lovelace"])).toBe(42);
    expect(redactIdentity(true, ["Ada Lovelace"])).toBe(true);
    expect(redactIdentity(null, ["Ada Lovelace"])).toBe(null);
    const obj = { foo: "Ada Lovelace" };
    expect(redactIdentity(obj, ["Ada Lovelace"])).toBe(obj);
  });

  it("ignores blank/whitespace-only identities", () => {
    expect(redactIdentity("hello world", ["", "   "])).toBe("hello world");
  });

  it("returns the value unchanged when there are no identities", () => {
    expect(redactIdentity("Ada Lovelace", [])).toBe("Ada Lovelace");
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
    const anon = anonymizeForReviewer(sub, []);
    expect(anon.speakers).toBeUndefined();
    expect(anon.speakerAnswers).toBeUndefined();
    expect(anon.id).toBe("s1");
    expect(anon.title).toBe("Talk");
    expect(anon.anonymized).toBe(true);
  });

  it("redacts speaker identity strings out of title, description, and sessionAnswers values", () => {
    const sub = {
      id: "s1",
      title: "A talk by Ada Lovelace",
      description: "Ada Lovelace (ada@example.com, Analytical Engines Inc) will speak.",
      speakers: [{ name: "Ada Lovelace" }],
      sessionAnswers: [
        { fieldId: "f1", section: "session" as const, label: "Bio", kind: "text", value: "By Ada Lovelace, of Analytical Engines Inc" },
        { fieldId: "f2", section: "session" as const, label: "Tags", kind: "text", value: ["ada lovelace", "math"] },
        { fieldId: "f3", section: "session" as const, label: "Rating", kind: "rating", value: 4 },
      ],
    };
    const identities = ["Ada Lovelace", "ada@example.com", "Analytical Engines Inc"];
    const anon = anonymizeForReviewer(sub, identities);
    expect(anon.title).toBe("A talk by [hidden]");
    expect(anon.description).toBe("[hidden] ([hidden], [hidden]) will speak.");
    expect(anon.sessionAnswers?.[0]?.value).toBe("By [hidden], of [hidden]");
    expect(anon.sessionAnswers?.[1]?.value).toEqual(["[hidden]", "math"]);
    expect(anon.sessionAnswers?.[2]?.value).toBe(4);
    expect(anon.anonymized).toBe(true);
  });
});

describe("aggregateDropdownCriterion", () => {
  const format: DropdownCriterionDef = {
    id: "format",
    label: "Talk length",
    kind: "dropdown",
    options: ["Too short", "Just right", "Too long"],
  };

  it("counts each option and picks the most-frequent as modal", () => {
    const evals = [
      { scores: { format: "Just right" } },
      { scores: { format: "Just right" } },
      { scores: { format: "Too long" } },
    ];
    const result = aggregateDropdownCriterion(evals, format);
    expect(result.counts).toEqual({ "Too short": 0, "Just right": 2, "Too long": 1 });
    expect(result.modal).toBe("Just right");
  });

  it("breaks ties by option-list order", () => {
    const evals = [{ scores: { format: "Too short" } }, { scores: { format: "Too long" } }];
    const result = aggregateDropdownCriterion(evals, format);
    expect(result.modal).toBe("Too short");
  });

  it("returns a zeroed counts map and null modal for no evaluations", () => {
    const result = aggregateDropdownCriterion([], format);
    expect(result.counts).toEqual({ "Too short": 0, "Just right": 0, "Too long": 0 });
    expect(result.modal).toBeNull();
  });

  it("throws on a missing score", () => {
    expect(() => aggregateDropdownCriterion([{ scores: {} }], format)).toThrow();
  });

  it("throws on a non-string score", () => {
    expect(() => aggregateDropdownCriterion([{ scores: { format: 3 } }], format)).toThrow();
  });

  it("throws on a score outside the option list", () => {
    expect(() => aggregateDropdownCriterion([{ scores: { format: "Nonsense" } }], format)).toThrow();
  });
});

describe("partitionRecused (DEC-271)", () => {
  it("splits items into kept/recused by submissionId membership, preserving kept order", () => {
    const items = [{ submissionId: "s1" }, { submissionId: "s2" }, { submissionId: "s3" }];
    const result = partitionRecused(items, new Set(["s2"]));
    expect(result.kept).toEqual([{ submissionId: "s1" }, { submissionId: "s3" }]);
    expect(result.recused).toEqual([{ submissionId: "s2" }]);
  });

  it("with an empty recusedIds set, everything is kept and nothing is recused", () => {
    const items = [{ submissionId: "s1" }, { submissionId: "s2" }];
    const result = partitionRecused(items, new Set());
    expect(result.kept).toEqual(items);
    expect(result.recused).toEqual([]);
  });

  it("with every id recused, kept is empty", () => {
    const items = [{ submissionId: "s1" }, { submissionId: "s2" }];
    const result = partitionRecused(items, new Set(["s1", "s2"]));
    expect(result.kept).toEqual([]);
    expect(result.recused).toEqual(items);
  });
});

describe("assignedExcludingRecused (DEC-271)", () => {
  it("filters out assigned items whose id is in recusedIds", () => {
    const assigned = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
    const result = assignedExcludingRecused(assigned, new Set(["s2"]));
    expect(result).toEqual([{ id: "s1" }, { id: "s3" }]);
  });

  it("returns the full list unchanged when recusedIds is empty", () => {
    const assigned = [{ id: "s1" }, { id: "s2" }];
    expect(assignedExcludingRecused(assigned, new Set())).toEqual(assigned);
  });

  it("returns an empty list when every assigned id is recused", () => {
    const assigned = [{ id: "s1" }, { id: "s2" }];
    expect(assignedExcludingRecused(assigned, new Set(["s1", "s2"]))).toEqual([]);
  });
});

describe("reviewerProgressState (DEC-707)", () => {
  it("is 'done' when completed >= assigned", () => {
    expect(reviewerProgressState({ assigned: 4, completed: 4 })).toBe("done");
    expect(reviewerProgressState({ assigned: 4, completed: 5 })).toBe("done");
  });

  it("is 'done' (vacuously) when nothing is assigned", () => {
    expect(reviewerProgressState({ assigned: 0, completed: 0 })).toBe("done");
  });

  it("is 'not_started' when completed is 0 and something is assigned", () => {
    expect(reviewerProgressState({ assigned: 4, completed: 0 })).toBe("not_started");
  });

  it("is 'in_progress' when 0 < completed < assigned", () => {
    expect(reviewerProgressState({ assigned: 4, completed: 1 })).toBe("in_progress");
    expect(reviewerProgressState({ assigned: 4, completed: 3 })).toBe("in_progress");
  });
});

describe("selectRemindTargets (DEC-707)", () => {
  const rows = [
    { userId: "u-done", assigned: 4, completed: 4 },
    { userId: "u-not-started", assigned: 4, completed: 0 },
    { userId: "u-in-progress", assigned: 4, completed: 2 },
    { userId: "u-nothing-assigned", assigned: 0, completed: 0 },
  ];

  it("'not_started' selects only reviewers with completed === 0 and something assigned", () => {
    expect(selectRemindTargets(rows, "not_started").map((r) => r.userId)).toEqual(["u-not-started"]);
  });

  it("'incomplete' selects every non-done reviewer (not_started + in_progress)", () => {
    expect(selectRemindTargets(rows, "incomplete").map((r) => r.userId)).toEqual(["u-not-started", "u-in-progress"]);
  });

  it("'incomplete' never selects a reviewer whose completed >= assigned", () => {
    expect(selectRemindTargets(rows, "incomplete")).not.toContainEqual(expect.objectContaining({ userId: "u-done" }));
  });
});

describe("resolveReviewerScopeTrackIds (DEC-845 amendment)", () => {
  it("returns [] for no rows", () => {
    expect(resolveReviewerScopeTrackIds([])).toEqual([]);
  });

  it("returns [] when any row is unrestricted (trackId + submissionId both null)", () => {
    expect(resolveReviewerScopeTrackIds([{ trackId: "t-1", submissionId: null }, { trackId: null, submissionId: null }])).toEqual([]);
  });

  it("returns the track id when every row agrees on exactly one track", () => {
    expect(resolveReviewerScopeTrackIds([{ trackId: "t-1", submissionId: null }, { trackId: "t-1", submissionId: null }])).toEqual(["t-1"]);
  });

  it("returns every distinct track id when rows span more than one track", () => {
    expect(resolveReviewerScopeTrackIds([{ trackId: "t-1", submissionId: null }, { trackId: "t-2", submissionId: null }])).toEqual(["t-1", "t-2"]);
  });

  it("ignores a submission-scoped row's null trackId when a track-scoped row is also present", () => {
    expect(resolveReviewerScopeTrackIds([{ trackId: "t-1", submissionId: null }, { trackId: null, submissionId: "sub-1" }])).toEqual(["t-1"]);
  });
});

describe("formatReviewerScopeLabel (DEC-845 amendment)", () => {
  it("returns null for an empty track list", () => {
    expect(formatReviewerScopeLabel([])).toBeNull();
  });

  it("returns the single name for one track", () => {
    expect(formatReviewerScopeLabel(["AI Engineering"])).toBe("AI Engineering");
  });

  it("sorts ascending and joins two or more names with ' · ', no truncation", () => {
    expect(formatReviewerScopeLabel(["Zebras", "AI Engineering", "Music"])).toBe("AI Engineering · Music · Zebras");
  });
});
