// DEC-212 (wave 7 amendment): the evaluations export must use the ONE
// validated reader for evaluation.scores_json (parseEvaluationScoresJson /
// numericScoresFor from src/domain/evaluation) instead of an unguarded
// `JSON.parse(...) as Record<string, unknown>` outside any try/catch, and it
// must honour the policy it already states ten lines below its own parse: a
// row whose scores_json is corrupt/legacy must render with empty score
// cells and an empty weightedScore rather than 500 the whole export. Uses
// the same fakeDb select-queue pattern as test/exports-evaluations-columns.test.ts.

import { describe, expect, it } from "vitest";
import { buildExport } from "../src/server/repo/exports";
import type { AppEnv } from "../src/server/env";

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

const PLAN_CRITERIA = JSON.stringify([
  { id: "cri_1", label: "Clarity", kind: "rating", weight: 1 },
  { id: "cri_2", label: "Relevance", kind: "rating", weight: 2 },
]);
const SCALE = JSON.stringify({ min: 1, max: 5 });

function baseRow(overrides: Record<string, unknown>) {
  return {
    id: "eval-good",
    planId: "plan-a",
    planName: "Program Committee",
    criteriaJson: PLAN_CRITERIA,
    roundCriteriaJson: null,
    scaleJson: SCALE,
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

describe("DEC-212 (wave 7): the evaluations export's ONE validated reader for scores_json", () => {
  it("a row whose scores_json is not valid JSON does not 500 the export -- it renders with empty score/weightedScore cells and its own identity columns intact", async () => {
    const badRow = baseRow({
      id: "eval-bad-json",
      seq: 2,
      title: "Talk Two",
      round: 2,
      scoresJson: "not json{{{",
      comment: "corrupt row",
    });
    const table = await buildExport(fakeDb(queueFor([badRow])), "event-1", "evaluations");
    expect(table.records.length).toBe(1);
    const row = table.records[0]!;
    expect(row["title"]).toBe("Talk Two");
    expect(row["reviewer"]).toBe("Alice Reviewer");
    expect(row["round"]).toBe("2");
    expect(row["comment"]).toBe("corrupt row");
    expect(row["weightedScore"]).toBe("");
    const clarityCol = table.header.find((h) => h.includes("Clarity"))!;
    const relevanceCol = table.header.find((h) => h.includes("Relevance"))!;
    expect(row[clarityCol]).toBe("");
    expect(row[relevanceCol]).toBe("");
  });

  it("a row whose rating criterion holds a non-numeric string does not 500 the export -- weightedScore is empty, the string still prints in its own score cell (display tolerance, not arithmetic)", async () => {
    const badRow = baseRow({
      id: "eval-bad-type",
      seq: 3,
      title: "Talk Three",
      round: 1,
      scoresJson: JSON.stringify({ cri_1: "not-a-number", cri_2: 5 }),
    });
    const table = await buildExport(fakeDb(queueFor([badRow])), "event-1", "evaluations");
    expect(table.records.length).toBe(1);
    const row = table.records[0]!;
    expect(row["title"]).toBe("Talk Three");
    expect(row["weightedScore"]).toBe("");
    const clarityCol = table.header.find((h) => h.includes("Clarity"))!;
    const relevanceCol = table.header.find((h) => h.includes("Relevance"))!;
    expect(row[clarityCol]).toBe("not-a-number");
    expect(row[relevanceCol]).toBe("5");
  });

  it("a good row in the same result set as a bad row is byte-unchanged", async () => {
    const goodRow = baseRow({ id: "eval-good", seq: 1, title: "Talk One" });
    const badRow = baseRow({
      id: "eval-bad-json",
      seq: 2,
      title: "Talk Two",
      round: 2,
      scoresJson: "not json{{{",
    });
    const table = await buildExport(fakeDb(queueFor([goodRow, badRow])), "event-1", "evaluations");
    expect(table.records.length).toBe(2);
    const goodOut = table.records.find((r) => r["title"] === "Talk One")!;
    expect(goodOut).toBeDefined();
    const clarityCol = table.header.find((h) => h.includes("Clarity"))!;
    const relevanceCol = table.header.find((h) => h.includes("Relevance"))!;
    expect(goodOut[clarityCol]).toBe("4");
    expect(goodOut[relevanceCol]).toBe("5");
    expect(goodOut["weightedScore"]).toBe(String((4 * 1 + 5 * 2) / 3));
  });
});
