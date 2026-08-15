// DEC-829 (wave-39 amendment, task w39-d): the reviewer queue's evaluation
// counts must never fan out into ~23 chunked statements for an unrestricted
// reviewer's ~2000-submission scope -- that's the whole-plan population
// again, just chunked, not "the already-scoped set" DEC-829 requires. This
// proves the FIX behaviourally (statement count), not by re-reading the
// source: a fake db counts every `.where()` call (one per SQL round trip)
// countEvaluationsBySubmission issues for a 2000-id submissionIds scope, and
// asserts it stays bounded at exactly 1 -- the single unscoped plan+round
// GROUP BY fallback -- rather than growing with chunkIds(ids).length (~23
// for 2000 ids at ID_CHUNK_SIZE=90). This test FAILS against the prior
// per-batch-Promise.all implementation, which issued one .where() per batch.

import { describe, expect, it } from "vitest";
import { countEvaluationsBySubmission } from "../src/server/repo/review";
import type { Db } from "../src/server/context";

interface FakeEvaluationRow {
  submissionId: string;
  planId: string;
  round: number;
}

function makeCountingFakeDb(fixture: FakeEvaluationRow[], stats: { statementCount: number }): Db {
  return {
    select: (_cols: unknown) => ({
      from: () => ({
        where: (_cond: unknown) => {
          stats.statementCount += 1;
          // Every row matches -- the id-scoping/plan-round filtering is
          // exercised elsewhere (test/review-repo-aggregates.test.ts); this
          // fake only needs to prove HOW MANY statements are issued.
          return {
            groupBy: () => {
              const counts = new Map<string, number>();
              for (const r of fixture) counts.set(r.submissionId, (counts.get(r.submissionId) ?? 0) + 1);
              const rows = [...counts.entries()].map(([submissionId, count]) => ({ submissionId, count }));
              return {
                // The whole-plan (no submissionIds) branch chains .limit(n)
                // after .groupBy(); the id-scoped single-batch branch awaits
                // .groupBy()'s result directly (thenable) with no .limit()
                // call -- support both shapes.
                limit: (n: number) => Promise.resolve(rows.slice(0, n)),
                then: (resolve: (v: unknown[]) => void) => resolve(rows),
              };
            },
          };
        },
      }),
    }),
  } as unknown as Db;
}

describe("DEC-829 (wave-39, task w39-d): countEvaluationsBySubmission read budget", () => {
  it("issues exactly ONE statement for a 2000-id submissionIds scope (falls through to the unscoped GROUP BY), not one per ID_CHUNK_SIZE=90 batch (~23)", async () => {
    const bigIds = Array.from({ length: 2000 }, (_, i) => `sub-${i}`);
    const fixture: FakeEvaluationRow[] = bigIds.map((id) => ({ planId: "plan-1", submissionId: id, round: 1 }));
    const stats = { statementCount: 0 };
    const db = makeCountingFakeDb(fixture, stats);

    const result = await countEvaluationsBySubmission(db, "plan-1", 1, bigIds);

    expect(stats.statementCount).toBe(1);
    expect(result.size).toBe(2000);
  });

  it("issues exactly ONE statement for a small (<= ID_CHUNK_SIZE) submissionIds scope -- the id-scoped branch stays a single query, not a wider fallback", async () => {
    const smallIds = Array.from({ length: 5 }, (_, i) => `sub-${i}`);
    const fixture: FakeEvaluationRow[] = smallIds.map((id) => ({ planId: "plan-1", submissionId: id, round: 1 }));
    const stats = { statementCount: 0 };
    const db = makeCountingFakeDb(fixture, stats);

    const result = await countEvaluationsBySubmission(db, "plan-1", 1, smallIds);

    expect(stats.statementCount).toBe(1);
    expect(result.size).toBe(5);
  });
});
