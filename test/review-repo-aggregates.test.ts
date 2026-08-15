// DEC-346 regression coverage: the plan-scoped whole-set loaders drop
// `description` (type-level PlanSubmissionRef vs SubmissionSummary), and the
// reviewer queue's evaluation counts/ratedByMe come from SQL aggregates
// (countEvaluationsBySubmission / listSubmissionIdsRatedBy) rather than a
// whole-round evaluation load + JS reduce. No local sqlite/D1 test driver is
// wired up in stage 1 (see test/agenda-repo.test.ts) -- this uses the same
// fake-chain pattern: a minimal db stub that captures the drizzle `where`
// condition, walks it to recover the (planId, round[, reviewerId]) values
// the repo function actually bound, and filters a fixture "evaluation" table
// through those recovered values so the round filter is genuinely proven
// (not just asserted against canned output).

import { describe, expect, expectTypeOf, it } from "vitest";
import {
  countEvaluationsBySubmission,
  listSubmissionIdsRatedBy,
  type PlanSubmissionRef,
  type SubmissionSummary,
} from "../src/server/repo/review";
import { MAX_PLAN_SUBMISSION_SCAN } from "../src/server/repo/review/submissions";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

// ---------------------------------------------------------------------------
// Type-level assertion: the plan-filtered loader's row shape has no
// `description` field, but SubmissionSummary (single-submission lookup)
// still does.
// ---------------------------------------------------------------------------

describe("DEC-346: PlanSubmissionRef vs SubmissionSummary", () => {
  it("PlanSubmissionRef has no description key", () => {
    expectTypeOf<PlanSubmissionRef>().not.toHaveProperty("description");
  });

  it("SubmissionSummary extends PlanSubmissionRef with description", () => {
    expectTypeOf<SubmissionSummary>().toMatchTypeOf<PlanSubmissionRef>();
    expectTypeOf<SubmissionSummary["description"]>().toEqualTypeOf<string | null>();
  });

  it("a PlanSubmissionRef-shaped row satisfies the row-shape contract with exactly id/ref/status/title/trackIds", () => {
    const row: PlanSubmissionRef = { id: "sub-1", ref: "S-001", title: "Talk", trackIds: ["t1"], status: "pending" };
    expect(Object.keys(row).sort()).toEqual(["id", "ref", "status", "title", "trackIds"]);
    expect((row as unknown as Record<string, unknown>).description).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fake db chain (same shape as test/agenda-repo.test.ts's makeChain +
// walkCondition helpers).
// ---------------------------------------------------------------------------

interface FakeEvaluationRow {
  submissionId: string;
  reviewerId: string;
  planId: string;
  round: number;
}

const FIXTURE: FakeEvaluationRow[] = [
  // Round 1: two reviewers rate sub-1, one rates sub-2.
  { planId: "plan-1", submissionId: "sub-1", reviewerId: "rev-1", round: 1 },
  { planId: "plan-1", submissionId: "sub-1", reviewerId: "rev-2", round: 1 },
  { planId: "plan-1", submissionId: "sub-2", reviewerId: "rev-1", round: 1 },
  // Round 2: only rev-2 has rated, and only sub-1 -- distinct from round 1's
  // shape so a round-filter bug (e.g. ignoring round entirely) is visible.
  { planId: "plan-1", submissionId: "sub-1", reviewerId: "rev-2", round: 2 },
  // A different plan entirely -- must never leak into plan-1's aggregates.
  { planId: "plan-2", submissionId: "sub-9", reviewerId: "rev-1", round: 1 },
];

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

/** Recovers {planId, round, reviewerId?} from the drizzle `and(eq(...), ...)`
 * condition the repo function built, by pairing consecutive col:/val:
 * tokens from walkCondition. */
function recoverFilter(cond: unknown): { planId?: string; round?: number; reviewerId?: string } {
  const tokens = walkCondition(cond);
  const out: { planId?: string; round?: number; reviewerId?: string } = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "col:plan_id" && tokens[i + 1]?.startsWith("val:")) {
      out.planId = JSON.parse(tokens[i + 1]!.slice(4));
    }
    if (t === "col:round" && tokens[i + 1]?.startsWith("val:")) {
      out.round = JSON.parse(tokens[i + 1]!.slice(4));
    }
    if (t === "col:reviewer_id" && tokens[i + 1]?.startsWith("val:")) {
      out.reviewerId = JSON.parse(tokens[i + 1]!.slice(4));
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
              (filter.planId === undefined || r.planId === filter.planId) &&
              (filter.round === undefined || r.round === filter.round) &&
              (filter.reviewerId === undefined || r.reviewerId === filter.reviewerId),
          );
          return {
            // countEvaluationsBySubmission calls .groupBy().limit() after
            // .where() (DEC-346 amendment, wave 18: MAX_PLAN_EVALUATION_SCAN
            // bound); listSubmissionIdsRatedBy resolves .where()'s result
            // directly (it's thenable).
            groupBy: () => {
              const counts = new Map<string, number>();
              for (const r of matched) counts.set(r.submissionId, (counts.get(r.submissionId) ?? 0) + 1);
              const rows = [...counts.entries()].map(([submissionId, count]) => ({ submissionId, count }));
              return { limit: (n: number) => Promise.resolve(rows.slice(0, n)) };
            },
            then: (resolve: (v: unknown[]) => void) =>
              resolve(matched.map((r) => ({ submissionId: r.submissionId }))),
          };
        },
      }),
    }),
  } as unknown as Db;
}

describe("DEC-346: countEvaluationsBySubmission", () => {
  it("groups counts by submission within (planId, round), excluding other rounds/plans", async () => {
    const db = makeFakeDb(FIXTURE);
    const round1 = await countEvaluationsBySubmission(db, "plan-1", 1);
    expect(round1.get("sub-1")).toBe(2);
    expect(round1.get("sub-2")).toBe(1);
    expect(round1.has("sub-9")).toBe(false);

    const round2 = await countEvaluationsBySubmission(db, "plan-1", 2);
    expect(round2.get("sub-1")).toBe(1);
    expect(round2.has("sub-2")).toBe(false);
  });

  it("returns an empty map for a round with no evaluations", async () => {
    const db = makeFakeDb(FIXTURE);
    const round3 = await countEvaluationsBySubmission(db, "plan-1", 3);
    expect(round3.size).toBe(0);
  });
});

describe("DEC-346: listSubmissionIdsRatedBy", () => {
  it("returns only the ids this reviewer rated in this (planId, round)", async () => {
    const db = makeFakeDb(FIXTURE);
    const rev2Round1 = await listSubmissionIdsRatedBy(db, "plan-1", 1, "rev-2");
    expect(rev2Round1).toEqual(new Set(["sub-1"]));

    const rev1Round1 = await listSubmissionIdsRatedBy(db, "plan-1", 1, "rev-1");
    expect(rev1Round1).toEqual(new Set(["sub-1", "sub-2"]));

    // Round 2: rev-1 rated nothing (only round 1) -- proves the round filter,
    // not just the reviewer filter, is applied.
    const rev1Round2 = await listSubmissionIdsRatedBy(db, "plan-1", 2, "rev-1");
    expect(rev1Round2.size).toBe(0);

    const rev2Round2 = await listSubmissionIdsRatedBy(db, "plan-1", 2, "rev-2");
    expect(rev2Round2).toEqual(new Set(["sub-1"]));
  });
});

describe("DEC-346 (wave 22-e): countEvaluationsBySubmission's cap is a submission cap, not an evaluation cap", () => {
  it("refuses past MAX_PLAN_SUBMISSION_SCAN distinct submissions, in submission vocabulary", async () => {
    // One evaluation per submission is enough to exceed the group cap --
    // proves the guard bounds distinct SUBMISSIONS (one row per group),
    // not raw evaluation rows (which would need reviewers x submissions to
    // trip the old, wrong constant).
    const bigFixture: FakeEvaluationRow[] = Array.from({ length: MAX_PLAN_SUBMISSION_SCAN + 1 }, (_, i) => ({
      planId: "plan-big",
      submissionId: `sub-${i}`,
      reviewerId: "rev-1",
      round: 1,
    }));
    const db = makeFakeDb(bigFixture);
    await expect(countEvaluationsBySubmission(db, "plan-big", 1)).rejects.toBeInstanceOf(ApiError);
    await expect(countEvaluationsBySubmission(db, "plan-big", 1)).rejects.toMatchObject({
      message: expect.stringContaining(`more than ${MAX_PLAN_SUBMISSION_SCAN} submissions`),
    });
  });
});
