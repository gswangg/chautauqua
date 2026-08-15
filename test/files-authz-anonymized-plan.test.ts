// DEC-170 (supersedes DEC-066): "a reviewer must never download a
// submission's files via an anonymized plan assignment" — src/server/repo/
// files-authz.ts:129-160 (reviewerCanAccessSubmissionFile) and :111-127
// (canAccessFile). docs/verification-log/task-w16-d-security-probe-stage1.md
// found no FAILs across the whole IDOR/authz matrix but recorded that this
// specific reviewer-file-via-anonymized-plan case could not be probed live,
// because the seed has no file whose track is covered exclusively by an
// anonymized plan assignment. task-w17-e-evidence-reconciliation-stage1.md
// carried it forward as open item 3, unowned, informational.
//
// TEST-ONLY: this file isolates the invariant with a fake drizzle-chain db
// (no real D1, no seed change), following the makeChain/fakeDb pattern used
// by test/public-surface-hostile-input.test.ts and test/email-validation.test.ts.
// Each select() call is resolved from a queue of canned row-sets in the exact
// order src/server/repo/files-authz.ts and src/server/repo/review/
// submissions.ts issue them for this code path — nothing under src/, app/,
// docs/ or decisions/ is touched.

import { describe, expect, it } from "vitest";
import type { Db } from "../src/server/context";
import { canAccessFile, reviewerCanAccessSubmissionFile } from "../src/server/repo/files-authz";

// ---------------------------------------------------------------------------
// Fake db: a queue of canned row-sets, one per db.select() call, consumed in
// call order. Mirrors the makeChain shape from test/public-surface-hostile-
// input.test.ts (from/innerJoin/where/limit/then all resolve to `rows`).
// ---------------------------------------------------------------------------

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

/** Builds a db whose select() calls resolve, in order, to `responses[0]`,
 * `responses[1]`, ... . A call past the end of the queue resolves to []
 * (nothing further "found") — same convention as the shared fake-db pattern. */
function makeQueueDb(responses: unknown[][]): Db {
  let call = 0;
  return {
    select: () => {
      const rows = responses[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  } as unknown as Db;
}

const EVENT_ID = "ev1";
const USER_ID = "user-reviewer-1";
const SUBMISSION_ID = "sub1";

const now = new Date("2026-01-01T00:00:00Z");

function evaluationPlanRow(id: string, anonymized: boolean) {
  return {
    id,
    eventId: EVENT_ID,
    name: `Plan ${id}`,
    instructions: null,
    openDate: null,
    closeDate: null,
    filtersJson: null,
    anonymized,
    scaleJson: JSON.stringify({ min: 1, max: 5 }),
    criteriaJson: JSON.stringify([]),
    rounds: 1,
    currentRound: 1,
    roundCriteriaJson: null,
    maxEvaluations: null,
    createdAt: now,
    updatedAt: now,
  };
}

// An "unrestricted" plan_reviewer row (trackId + submissionId both null):
// isSubmissionInReviewerScope's unrestricted branch, which — once a
// submission-existence row comes back and the plan has no track filters —
// grants scope on any submission in the plan's event.
const UNRESTRICTED_ASSIGNMENT_ROW = { trackId: null, submissionId: null };

describe("reviewerCanAccessSubmissionFile / canAccessFile — DEC-170 anonymized-plan isolation", () => {
  it("an anonymized-only assignment never grants file access (the core invariant)", async () => {
    const ANON_PLAN = "plan-anon";
    // 1) planReviewer join evaluationPlan, filtered to this reviewer+event:
    //    only the anonymized plan's assignment comes back.
    // 2) listPlansForEvent: the full plan roster for the event.
    // The anonymized-only assignment is filtered out of candidatePlans by
    // `p.anonymized === false` before any submission-scope query runs, so
    // the queue ends here — a third select() would indicate a code-path
    // regression (it would resolve to [] and still fail scope, but the
    // point of this case is that reviewerCanAccessSubmissionFile returns
    // false without ever consulting submission scope for an anonymized plan).
    const db = makeQueueDb([[{ planId: ANON_PLAN }], [{ plan: evaluationPlanRow(ANON_PLAN, true), timezone: "UTC" }]]);

    const inScope = await reviewerCanAccessSubmissionFile(db, USER_ID, EVENT_ID, SUBMISSION_ID);
    expect(inScope).toBe(false);

    // canAccessFile must deny a reviewer when the precomputed scope is false
    // — never defaulting to true for role 'reviewer'.
    const denied = canAccessFile(
      { role: "reviewer", orgId: "org1" },
      { orgId: "org1", uploadedByContactId: null, readParticipantContactIds: [] },
      { reviewerInScope: inScope },
    );
    expect(denied).toBe(false);
  });

  it("the same reviewer with a non-anonymized covering assignment gets true — proves isolation, not a blanket deny", async () => {
    const OPEN_PLAN = "plan-open";
    const db = makeQueueDb([
      [{ planId: OPEN_PLAN }], // assigned plan ids for this reviewer/event
      [{ plan: evaluationPlanRow(OPEN_PLAN, false), timezone: "UTC" }], // full plan roster: one non-anonymized plan
      [UNRESTRICTED_ASSIGNMENT_ROW], // isSubmissionInReviewerScope: this reviewer's plan_reviewer rows on OPEN_PLAN
      [{ id: SUBMISSION_ID }], // submission exists in plan.eventId
    ]);

    const inScope = await reviewerCanAccessSubmissionFile(db, USER_ID, EVENT_ID, SUBMISSION_ID);
    expect(inScope).toBe(true);

    const allowed = canAccessFile(
      { role: "reviewer", orgId: "org1" },
      { orgId: "org1", uploadedByContactId: null, readParticipantContactIds: [] },
      { reviewerInScope: inScope },
    );
    expect(allowed).toBe(true);
  });

  it("both an anonymized and a non-anonymized covering assignment: anonymized neither grants nor poisons — still true", async () => {
    const ANON_PLAN = "plan-anon";
    const OPEN_PLAN = "plan-open";
    const db = makeQueueDb([
      // assigned to BOTH plans in this event
      [{ planId: ANON_PLAN }, { planId: OPEN_PLAN }],
      // full plan roster: order matches how listPlansForEvent would return them;
      // candidatePlans filters to anonymized === false, i.e. only OPEN_PLAN,
      // regardless of ANON_PLAN's position or presence in assignedPlanIds.
      [
        { plan: evaluationPlanRow(ANON_PLAN, true), timezone: "UTC" },
        { plan: evaluationPlanRow(OPEN_PLAN, false), timezone: "UTC" },
      ],
      // isSubmissionInReviewerScope is only ever invoked for OPEN_PLAN —
      // the anonymized plan is filtered out before the loop, so no queue
      // entries for it are needed.
      [UNRESTRICTED_ASSIGNMENT_ROW],
      [{ id: SUBMISSION_ID }],
    ]);

    const inScope = await reviewerCanAccessSubmissionFile(db, USER_ID, EVENT_ID, SUBMISSION_ID);
    expect(inScope).toBe(true);
  });

  it("canAccessFile never defaults reviewerInScope to true when opts/reviewerInScope is omitted", () => {
    const scope = { orgId: "org1", uploadedByContactId: null, readParticipantContactIds: [] as string[] };

    expect(canAccessFile({ role: "reviewer", orgId: "org1" }, scope)).toBe(false);
    expect(canAccessFile({ role: "reviewer", orgId: "org1" }, scope, {})).toBe(false);
    expect(canAccessFile({ role: "reviewer", orgId: "org1" }, scope, { reviewerInScope: undefined })).toBe(false);
    expect(canAccessFile({ role: "reviewer", orgId: "org1" }, scope, { reviewerInScope: false })).toBe(false);
  });
});
