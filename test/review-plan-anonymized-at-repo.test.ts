// DEC-799: countSubmittedEvaluationsForPlan's optional sinceMs param is the
// ratchet's actual filter -- evaluations submitted before a plan's
// anonymizedAt must not count. Fake-chain pattern mirrors
// test/review-repo-aggregates.test.ts (no D1/wrangler dependency in stage 1).

import { describe, expect, it } from "vitest";
import { countSubmittedEvaluationsForPlan } from "../src/server/repo/review/plans";
import type { Db } from "../src/server/context";

interface FakeEvaluationRow {
  planId: string;
  submittedAt: Date | null;
}

const FIXTURE: FakeEvaluationRow[] = [
  { planId: "plan-1", submittedAt: new Date(1_000) },
  { planId: "plan-1", submittedAt: new Date(2_500) },
  { planId: "plan-1", submittedAt: null }, // draft, never counts
  { planId: "plan-2", submittedAt: new Date(2_500) }, // different plan
];

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
  if (node instanceof Date) return [`val:${node.getTime()}`];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value instanceof Date) out.push(`val:${n.value.getTime()}`);
  else if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

/** Recovers {planId, sinceMs?} from the drizzle and(...) condition built by
 * countSubmittedEvaluationsForPlan. The submitted_at-is-not-null clause is
 * raw SQL (no column/value pair to recover) so it's applied unconditionally
 * by the fake below, matching the real WHERE's semantics. */
function recoverFilter(cond: unknown): { planId?: string; sinceMs?: number } {
  const tokens = walkCondition(cond);
  const out: { planId?: string; sinceMs?: number } = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "col:plan_id" && tokens[i + 1]?.startsWith("val:")) {
      out.planId = JSON.parse(tokens[i + 1]!.slice(4));
    }
    if (t === "col:submitted_at" && tokens[i + 1]?.startsWith("val:")) {
      out.sinceMs = Number(tokens[i + 1]!.slice(4));
    }
  }
  return out;
}

function makeFakeDb(fixture: FakeEvaluationRow[]): Db {
  return {
    select: (_cols: unknown) => ({
      from: () => ({
        where: (cond: unknown) => {
          const filter = recoverFilter(cond);
          const matched = fixture.filter(
            (r) =>
              r.submittedAt !== null &&
              (filter.planId === undefined || r.planId === filter.planId) &&
              (filter.sinceMs === undefined || r.submittedAt.getTime() >= filter.sinceMs),
          );
          return Promise.resolve([{ count: matched.length }]);
        },
      }),
    }),
  } as unknown as Db;
}

describe("DEC-799: countSubmittedEvaluationsForPlan sinceMs filter", () => {
  it("with no sinceMs, counts every submitted evaluation on the plan (drafts excluded)", async () => {
    const db = makeFakeDb(FIXTURE);
    const count = await countSubmittedEvaluationsForPlan(db, "plan-1");
    expect(count).toBe(2);
  });

  it("with sinceMs, excludes evaluations submitted before anonymity was enabled", async () => {
    const db = makeFakeDb(FIXTURE);
    // anonymizedAt = 2_000: only the 2_500 submission counts, not the 1_000 one.
    const count = await countSubmittedEvaluationsForPlan(db, "plan-1", 2_000);
    expect(count).toBe(1);
  });

  it("with sinceMs before every submission, counts them all", async () => {
    const db = makeFakeDb(FIXTURE);
    const count = await countSubmittedEvaluationsForPlan(db, "plan-1", 500);
    expect(count).toBe(2);
  });

  it("never leaks another plan's submitted evaluations into the count", async () => {
    const db = makeFakeDb(FIXTURE);
    const count = await countSubmittedEvaluationsForPlan(db, "plan-2", 0);
    expect(count).toBe(1);
  });
});
