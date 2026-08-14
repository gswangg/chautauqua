// DEC-449 regression coverage: the reviewer queue's D1 round-trip count must
// be CONSTANT, not scale with the size of the reviewer's scoped submission
// set. Before this fix, resolveReviewerSubmissions chunked a trackIds
// lookup (ceil(n/90) queries) and countEvaluationsBySubmission chunked an
// evaluation-count lookup (another ceil(n/90) queries) over the caller's id
// list, so a 2000-submission event issued ~46 extra sequential round trips.
// This test drives the same repo functions the queue route calls
// (src/routes/review/reviewer.ts's GET /plans/:id/queue) against a counting
// fake `db` and asserts the total .where()-query count is identical for a
// scoped set of 5 vs. 500, and bounded (<=7) in both cases.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { resolveReviewerSubmissions } from "../src/server/repo/review/submissions";
import { countEvaluationsBySubmission, listSubmissionIdsRatedBy } from "../src/server/repo/review/evaluations";
import { listRecusalsForReviewer } from "../src/server/repo/review/recusal";
import type { PlanRecord } from "../src/server/repo/review/plans";

function planRecord(): PlanRecord {
  return {
    id: "plan-1",
    eventId: "event-1",
    name: "Plan",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
  } as unknown as PlanRecord;
}

/** A minimal counting fake db: every top-level `.where(...)` call (the
 * genuine D1 round trip) increments `queryCount`. Table identity picks a
 * fixture; the (small) chain surface each repo fn needs is stubbed. */
function makeCountingDb(matchedSubmissionCount: number): { db: Db; queryCount: () => number } {
  let count = 0;
  const submissionRows = Array.from({ length: matchedSubmissionCount }, (_, i) => ({
    id: `sub-${i}`,
    seq: i + 1,
    title: `Talk ${i}`,
  }));

  const db = {
    select: (cols: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: (_cond: unknown) => {
          count += 1;
          if (table === schema.planReviewer) {
            const rows = [{ trackId: null, submissionId: null }];
            return { orderBy: () => ({ limit: () => Promise.resolve(rows) }) };
          }
          if (table === schema.submission) {
            return { orderBy: () => ({ limit: () => Promise.resolve(submissionRows) }) };
          }
          if (table === schema.event) {
            return {
              limit: () => Promise.resolve([{ recordPrefix: "TALK" }]),
            };
          }
          if (table === schema.evaluation) {
            // countEvaluationsBySubmission (.groupBy) vs listSubmissionIdsRatedBy
            // (awaited directly) both query this table.
            const hasGroupByShape = "count" in cols;
            if (hasGroupByShape) {
              return {
                groupBy: () => Promise.resolve(submissionRows.map((s) => ({ submissionId: s.id, count: 1 }))),
              };
            }
            return Promise.resolve(submissionRows.map((s) => ({ submissionId: s.id })));
          }
          if (table === schema.reviewRecusal) {
            return Promise.resolve([]);
          }
          throw new Error("makeCountingDb: unexpected table in fake db");
        },
      }),
    }),
  } as unknown as Db;

  return { db, queryCount: () => count };
}

async function runQueuePath(matchedSubmissionCount: number): Promise<number> {
  const { db, queryCount } = makeCountingDb(matchedSubmissionCount);
  const plan = planRecord();

  const scoped = await resolveReviewerSubmissions(db, plan, "reviewer-1");
  expect(scoped.length).toBe(matchedSubmissionCount);

  await countEvaluationsBySubmission(db, plan.id, plan.currentRound);
  await listSubmissionIdsRatedBy(db, plan.id, plan.currentRound, "reviewer-1");
  await listRecusalsForReviewer(db, plan.id, "reviewer-1");

  return queryCount();
}

describe("DEC-449: reviewer queue path issues a constant number of D1 round trips", () => {
  it("issues the same total query count for a scoped set of 5 as for 500", async () => {
    const small = await runQueuePath(5);
    const large = await runQueuePath(500);
    expect(small).toBe(large);
  });

  it("stays within a small, bounded query budget (<=7) regardless of scope size", async () => {
    const small = await runQueuePath(5);
    const large = await runQueuePath(500);
    expect(small).toBeLessThanOrEqual(7);
    expect(large).toBeLessThanOrEqual(7);
  });
});
