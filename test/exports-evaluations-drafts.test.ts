// DEC-873 (wave 54 amendment): the evaluations CSV must apply
// submittedEvaluationCondition() so it agrees with GET /api/v1/plans/:id/results
// on row count -- a draft (submittedAt null) must never appear in the export.
// Drives buildExport('evaluations') through the fakeDb select-queue pattern
// from test/exports-evaluations-columns.test.ts, but the fake `.where(...)`
// CAPTURES its argument so this test can assert -- by compiling both SQL
// fragments through the same dialect -- that the captured WHERE condition
// carries the exact submitted-at-is-not-null predicate, not merely "some
// condition". Reverting the src fix (removing the pushed condition) must
// fail this test.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { buildExport } from "../src/server/repo/exports";
import { submittedEvaluationCondition } from "../src/server/repo/review/evaluations";
import type { AppEnv } from "../src/server/env";

const dialect = new SQLiteSyncDialect();

function makeChain(rows: unknown[], onWhere: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      onWhere(cond);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][], capturedWheres: unknown[]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows, (cond) => capturedWheres.push(cond));
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

const PLAN_CRITERIA = JSON.stringify([{ id: "cri_1", label: "Clarity", kind: "rating", weight: 1 }]);

function evaluationRows() {
  return [
    {
      planId: "plan-a",
      planName: "Program Committee",
      criteriaJson: PLAN_CRITERIA,
      roundCriteriaJson: null,
      seq: 1,
      title: "Talk One",
      reviewerEmail: "reviewer1@example.com",
      round: 1,
      scoresJson: JSON.stringify({ cri_1: 4 }),
      comment: "Great session",
      submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ];
}

function queue() {
  return [[{ recordPrefix: "SES" }], evaluationRows()];
}

describe("DEC-873: evaluations export applies submittedEvaluationCondition()", () => {
  it("the driving query's WHERE carries the exact submitted-at-is-not-null predicate", async () => {
    const capturedWheres: unknown[] = [];
    await buildExport(fakeDb(queue(), capturedWheres), "event-1", "evaluations");

    // Second select() call is the row-driving query (the first fetches the
    // event's record prefix and has no WHERE relevant here).
    expect(capturedWheres.length).toBeGreaterThanOrEqual(2);
    const rowsWhere = capturedWheres[capturedWheres.length - 1];

    const expectedFragment = dialect.sqlToQuery(submittedEvaluationCondition() as any);
    const compiledWhere = dialect.sqlToQuery(rowsWhere as any);

    expect(compiledWhere.sql).toContain(expectedFragment.sql);
  });
});
