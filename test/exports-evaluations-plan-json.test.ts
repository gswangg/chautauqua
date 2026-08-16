// DEC-147 (wave 11 amendment): the evaluations export's weightedScore
// arithmetic must come from the SAME throwing plan-json parsers the
// plan-results door (src/server/repo/review/plans.ts's toPlanRecord,
// src/server/repo/review/evaluations.ts) uses -- parsePlanCriteria and
// parsePlanScale -- not a private swallowing try/catch that silently drops
// to [] / undefined. Before this fix a malformed criteria_json/scale_json
// row made /plans/:id/results refuse (PlanJsonError) while the CSV printed
// a wrong weightedScore for the same plan. Uses the same fakeDb
// select-queue pattern as test/exports-evaluations-scores-json.test.ts, and
// asserts against parsePlanCriteria/parsePlanScale directly (the plan-json
// door the screen itself calls) to prove both surfaces refuse for the
// identical reason, not just that the export throws SOMETHING.

import { describe, expect, it } from "vitest";
import { buildExport } from "../src/server/repo/exports";
import type { AppEnv } from "../src/server/env";
import { PlanJsonError, parsePlanCriteria, parsePlanScale } from "../src/domain/evaluation/plan-json";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

const GOOD_CRITERIA = JSON.stringify([
  { id: "cri_1", label: "Clarity", kind: "rating", weight: 1 },
  { id: "cri_2", label: "Relevance", kind: "rating", weight: 2 },
]);
const GOOD_SCALE = JSON.stringify({ min: 1, max: 5 });

function baseRow(overrides: Record<string, unknown>) {
  return {
    id: "eval-good",
    planId: "plan-a",
    planName: "Program Committee",
    criteriaJson: GOOD_CRITERIA,
    roundCriteriaJson: null,
    scaleJson: GOOD_SCALE,
    seq: 1,
    title: "Talk One",
    reviewerEmail: "reviewer1@example.com",
    contactFirstName: "Alice",
    contactLastName: "Reviewer",
    round: 1,
    scoresJson: JSON.stringify({ cri_1: 4, cri_2: 5 }),
    comment: "Great session",
    submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function queueFor(rows: unknown[]) {
  return [[{ recordPrefix: "SES" }], rows];
}

describe("DEC-147 (wave 11): evaluations export refuses instead of computing wrong arithmetic", () => {
  it("a plan whose criteria_json holds a criterion with a string weight makes the export refuse with the same PlanJsonError the plan-results door raises", async () => {
    const badCriteria = JSON.stringify([
      { id: "cri_1", label: "Clarity", kind: "rating", weight: "1" },
      { id: "cri_2", label: "Relevance", kind: "rating", weight: 2 },
    ]);
    const row = baseRow({ criteriaJson: badCriteria });

    // The plan-results door's own parser (review/plans.ts's toPlanRecord
    // calls this exact function) refuses this row.
    expect(() => parsePlanCriteria(badCriteria, "plan-a")).toThrow(PlanJsonError);
    expect(() => parsePlanCriteria(badCriteria, "plan-a")).toThrow(/plan-a/);
    expect(() => parsePlanCriteria(badCriteria, "plan-a")).toThrow(/criteria_json/);

    // The export must refuse for the identical reason, not silently print a
    // number derived from a partially-parsed row.
    await expect(buildExport(fakeDb(queueFor([row])), "event-1", "evaluations")).rejects.toThrow(PlanJsonError);
    await expect(buildExport(fakeDb(queueFor([row])), "event-1", "evaluations")).rejects.toThrow(/plan-a/);
    await expect(buildExport(fakeDb(queueFor([row])), "event-1", "evaluations")).rejects.toThrow(/criteria_json/);
  });

  it("a plan whose scale_json holds a non-numeric min makes the export refuse with the same PlanJsonError the plan-results door raises", async () => {
    const badScale = JSON.stringify({ min: "1", max: 5 });
    const row = baseRow({ scaleJson: badScale });

    expect(() => parsePlanScale(badScale, "plan-a")).toThrow(PlanJsonError);
    expect(() => parsePlanScale(badScale, "plan-a")).toThrow(/plan-a/);
    expect(() => parsePlanScale(badScale, "plan-a")).toThrow(/scale_json/);

    await expect(buildExport(fakeDb(queueFor([row])), "event-1", "evaluations")).rejects.toThrow(PlanJsonError);
    await expect(buildExport(fakeDb(queueFor([row])), "event-1", "evaluations")).rejects.toThrow(/plan-a/);
    await expect(buildExport(fakeDb(queueFor([row])), "event-1", "evaluations")).rejects.toThrow(/scale_json/);
  });

  it("regression pin: a well-formed plan's CSV is unchanged", async () => {
    const row = baseRow({});
    const table = await buildExport(fakeDb(queueFor([row])), "event-1", "evaluations");
    expect(table.records.length).toBe(1);
    const out = table.records[0]!;
    expect(out["title"]).toBe("Talk One");
    expect(out["reviewer"]).toBe("Alice Reviewer");
    expect(out["round"]).toBe("1");
    expect(out["comment"]).toBe("Great session");
    const clarityCol = table.header.find((h) => h.includes("Clarity"))!;
    const relevanceCol = table.header.find((h) => h.includes("Relevance"))!;
    expect(out[clarityCol]).toBe("4");
    expect(out[relevanceCol]).toBe("5");
    expect(out["weightedScore"]).toBe(String((4 * 1 + 5 * 2) / 3));
  });
});
