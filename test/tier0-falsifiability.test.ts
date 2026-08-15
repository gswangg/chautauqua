// DEC-358 wave-39 falsifiability audit: closes the one row from
// docs/eval-findings.md's UNFALSIFIABLE batch that had no exercised check
// anywhere in the tree -- isSubmissionInReviewerScope sharing
// resolveReviewerSubmissions' MAX_REVIEWER_SCOPE_ROWS cap
// (src/server/repo/review/submissions.ts:396-407 vs :241-252). Every OTHER
// call site that imports isSubmissionInReviewerScope (review-idor.test.ts,
// admin-list-bounds-review.test.ts, eval-scorecard-caps.test.ts, etc.) mocks
// it -- none exercise its real cap-refusal, so a revert of the cap check at
// :401-407 would pass every existing test in the tree silently. This test
// asserts the OBSERVABLE behaviour only (the thrown ApiError + its message
// naming the cap), never the query shape, per this task's co-ownership note
// with task-w39-d/e which are editing this file's siblings this same wave.
import { describe, expect, it } from "vitest";
import { isSubmissionInReviewerScope } from "../src/server/repo/review/submissions";
import { MAX_REVIEWER_SCOPE_ROWS } from "../src/server/repo/review/reviewers";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";
import type { PlanRecord } from "../src/server/repo/review/plans";

function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "plan-1",
    eventId: "event-1",
    name: "Plan One",
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
    ...overrides,
  } as PlanRecord;
}

/** Fake db: models the plan_reviewer read (select().from().where().orderBy()
 * .limit(n)) isSubmissionInReviewerScope's cap-refusal reads first, PLUS the
 * follow-on single-submission-scoped lookups
 * (select().from().where().limit(1), no orderBy) its unrestricted/
 * submission-scoped branches issue once the cap read passes -- those return
 * an empty array (submission not found), which is enough for the function
 * to return a boolean without throwing again, so "does not throw" cases can
 * run past the cap check. */
function makeFakeDb(rowCount: number): Db {
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    trackId: null,
    submissionId: `sub-${i}`,
  }));
  return {
    select: (_cols: unknown) => ({
      from: (_table: unknown) => ({
        where: (_cond: unknown) => {
          const chain = {
            orderBy: (..._args: unknown[]) => ({
              limit: (n: number) => Promise.resolve(rows.slice(0, n)),
            }),
            limit: (_n: number) => Promise.resolve([] as unknown[]),
          };
          return chain;
        },
      }),
    }),
  } as unknown as Db;
}

describe("isSubmissionInReviewerScope shares resolveReviewerSubmissions' MAX_REVIEWER_SCOPE_ROWS cap (DEC-439)", () => {
  it("under the cap: does not throw on the plan_reviewer read (resolves to a boolean)", async () => {
    const db = makeFakeDb(3);
    const plan = makePlan();
    const result = await isSubmissionInReviewerScope(db, plan, "user-1", "sub-does-not-exist");
    expect(typeof result).toBe("boolean");
  });

  it("over MAX_REVIEWER_SCOPE_ROWS plan_reviewer rows: refuses loudly naming the cap, never silently truncates", async () => {
    const db = makeFakeDb(MAX_REVIEWER_SCOPE_ROWS + 1);
    const plan = makePlan();
    await expect(isSubmissionInReviewerScope(db, plan, "user-1", "sub-0")).rejects.toBeInstanceOf(ApiError);
    await expect(isSubmissionInReviewerScope(db, plan, "user-1", "sub-0")).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_REVIEWER_SCOPE_ROWS)),
    });
  });

  it("at exactly the cap: does not throw (the +1 overshoot, not the cap itself, trips the refusal)", async () => {
    const db = makeFakeDb(MAX_REVIEWER_SCOPE_ROWS);
    const plan = makePlan();
    await expect(isSubmissionInReviewerScope(db, plan, "user-1", "sub-0")).resolves.toBeDefined();
  });
});
