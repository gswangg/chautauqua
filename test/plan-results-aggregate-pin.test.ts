// task w31-c (DEC-338 wave-31 amendment / DEC-347 wave-31 amendment): the
// plan-results read (`GET /api/v1/plans/:id/results`) collapsed its
// buildResults waterfall (src/routes/review/shared.ts) into two
// dependency-ordered Promise.all waves -- independent plan/round-scoped
// reads first (submissions, evaluations, recusals), then the id-scoped
// speaker/track hydration second. This file has two jobs:
//
// (a) an aggregate-pinning test proving the scheduling change moved zero
//     numbers: ranked rows/averages/perCriterion/perDropdown/recusal counts
//     for a fixture plan (rating + dropdown criteria, a draft evaluation
//     that DEC-873 excludes, a recused submission, and an average tie broken
//     by count-desc) are byte-identical to what the pre-change sequential
//     code produced.
// (b) a concurrency test with an instrumented fake `Db` that records the
//     maximum number of in-flight statements and asserts it exceeds 1 --
//     DEC-338's wave-31 amendment requires this be proven behaviorally,
//     never with a source grep for `Promise.all`.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { rankPlanResults, hydrateResultsRows } from "../src/routes/review/shared";
import type { PlanRecord } from "../src/server/repo/review";
import type { Db } from "../src/server/context";

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
    anonymizedAt: null,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    roundMeta: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// (a) aggregate-pinning fake db: same recording-fake-db chain shape as
// test/review-results-payload.test.ts, extended with schema.reviewRecusal.
// DEC-873: the ONLY reader of schema.evaluation in buildResults' call graph
// is listEvaluationScoresForPlan, which always applies
// submittedEvaluationCondition() (WHERE submitted_at is not null) -- since
// this fake ignores real `.where()` predicates (matching the established
// pattern), it bakes that ONE known predicate in directly at the
// schema.evaluation table lookup so a draft row (submittedAt: null) in the
// fixture is excluded exactly like the real SQL excludes it.
// ---------------------------------------------------------------------------
function fakePinDb(rows: {
  event: unknown[];
  submission: unknown[];
  evaluation: { submissionId: string; scoresJson: string; submittedAt: number | null }[];
  reviewRecusal: unknown[];
  submissionTrack?: unknown[];
  participant?: unknown[];
}) {
  const evaluationRowsSubmittedOnly = rows.evaluation.filter((r) => r.submittedAt !== null);
  const byTable = new Map<unknown, unknown[]>([
    [schema.event, rows.event],
    [schema.submission, rows.submission],
    [schema.evaluation, evaluationRowsSubmittedOnly],
    [schema.reviewRecusal, rows.reviewRecusal],
    [schema.submissionTrack, rows.submissionTrack ?? []],
    [schema.participant, rows.participant ?? []],
  ]);

  const db = {
    select(_cols?: unknown) {
      return {
        from(table: unknown) {
          const tableRows = byTable.get(table) ?? [];
          const chain = {
            innerJoin(_joinTable: unknown) {
              return chain;
            },
            // DEC-271 (wave-110 amendment): listEvaluationScoresForPlan now
            // left-joins review_recusal before its where(). This fixture's
            // recused submission (sub-3) only ever has a DRAFT evaluation
            // (already excluded above by evaluationRowsSubmittedOnly), so a
            // structural no-op here still pins the same byte-identical rows
            // -- exercising the recusal-retracts-a-SUBMITTED-score path is
            // test/review-results-recusal-exclusion.test.ts's job.
            leftJoin(_joinTable: unknown, _cond?: unknown) {
              return chain;
            },
            where() {
              const result: Promise<unknown[]> & {
                limit?: (n: number) => Promise<unknown[]>;
                orderBy?: (...args: unknown[]) => Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> };
              } = Promise.resolve(tableRows);
              (result as { limit: (n: number) => Promise<unknown[]> }).limit = async (n: number) =>
                tableRows.slice(0, n);
              (
                result as {
                  orderBy: (...args: unknown[]) => Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> };
                }
              ).orderBy = (..._args: unknown[]) => {
                const ordered: Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> } =
                  Promise.resolve(tableRows);
                (ordered as { limit: (n: number) => Promise<unknown[]> }).limit = async (n: number) =>
                  tableRows.slice(0, n);
                return ordered;
              };
              return result;
            },
          };
          return chain;
        },
      };
    },
  };
  return db as unknown as Db;
}

describe("task w31-c: plan-results aggregate pin (Promise.all wave collapse moves zero numbers)", () => {
  it("ranked rows/averages/perCriterion/perDropdown/recusals are byte-identical, draft evaluation excluded (DEC-873), tie broken by count-desc", async () => {
    const plan = makePlan({
      criteria: [
        { id: "c1", label: "Quality", kind: "rating", weight: 1 },
        { id: "decision", label: "Decision", kind: "dropdown", options: ["advance", "reject"] },
      ],
    });

    const db = fakePinDb({
      event: [{ recordPrefix: "S" }],
      submission: [
        { id: "sub-1", seq: 1, title: "Talk A", status: "pending" },
        { id: "sub-2", seq: 2, title: "Talk B", status: "accepted" },
        { id: "sub-3", seq: 3, title: "Talk C", status: "pending" },
      ],
      evaluation: [
        // sub-1: two submitted evals -- average (4+2)/2 = 3, count 2.
        { submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 4, decision: "advance" }), submittedAt: 1000 },
        { submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 2, decision: "reject" }), submittedAt: 1001 },
        // sub-2: one submitted eval -- average 3, count 1. Ties sub-1 on
        // average; sub-1's higher count (2 > 1) must rank it first.
        { submissionId: "sub-2", scoresJson: JSON.stringify({ c1: 3, decision: "advance" }), submittedAt: 1002 },
        // sub-3: a DRAFT (submittedAt null) with a high score that must
        // NEVER enter the aggregate (DEC-873). If wrongly included, sub-3's
        // average would be 5 and it would rank first instead of last.
        { submissionId: "sub-3", scoresJson: JSON.stringify({ c1: 5, decision: "advance" }), submittedAt: null },
      ],
      // sub-3 is recused by one reviewer -- a plan-scoped recusal count,
      // independent of the (zero, because its only eval is a draft) eval count.
      reviewRecusal: [{ id: "recusal-1", submissionId: "sub-3", userId: "reviewer-1" }],
    });

    // DEC-829 w32 amendment split buildResults into rank + hydrate; the pin
    // is on the COMPOSED pipeline, which must still produce byte-identical
    // rows to the pre-split sequential code.
    const rows = await hydrateResultsRows({ var: { db } }, plan, await rankPlanResults({ var: { db } }, plan, 1));

    expect(rows).toEqual([
      {
        submissionId: "sub-1",
        // Post-eval amendment: the SCORE rank rides the ranked row.
        // sub-1 and sub-2 share an average but differ on count, so
        // they hold distinct positions -- 1 and 2, not a tie.
        rank: 1,
        ref: "S-001",
        title: "Talk A",
        count: 2,
        average: 3,
        perCriterion: { c1: 3 },
        perDropdown: { decision: { counts: { advance: 1, reject: 1 }, modal: "advance" } },
        status: "pending",
        speakers: [],
        trackNames: [],
        recusals: 0,
      },
      {
        submissionId: "sub-2",
        rank: 2,
        ref: "S-002",
        title: "Talk B",
        count: 1,
        average: 3,
        perCriterion: { c1: 3 },
        perDropdown: { decision: { counts: { advance: 1, reject: 0 }, modal: "advance" } },
        status: "accepted",
        speakers: [],
        trackNames: [],
        recusals: 0,
      },
      {
        submissionId: "sub-3",
        rank: 3,
        ref: "S-003",
        title: "Talk C",
        count: 0,
        average: 0,
        perCriterion: { c1: 0 },
        perDropdown: { decision: { counts: { advance: 0, reject: 0 }, modal: null } },
        status: "pending",
        speakers: [],
        trackNames: [],
        recusals: 1,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// (b) concurrency fake db: every `.from(table)` statement's terminal await
// point is lazily memoized (so N synchronous chain calls -- .where()/
// .orderBy()/.limit() -- before the one real `await` still register as ONE
// statement, not N), and that single resolution is delayed on a timer while
// incrementing/decrementing a shared in-flight counter. If buildResults'
// independent reads fire as one Promise.all wave, several of these delayed
// statements are in flight at once; if they were still a sequential
// waterfall, in-flight would never exceed 1.
// ---------------------------------------------------------------------------
function makeConcurrencyDb(rowsByTable: Map<unknown, unknown[]>, delayMs: number, tracker: { inFlight: number; max: number }) {
  function lazyChain(getRows: () => unknown[]) {
    let promise: Promise<unknown[]> | undefined;
    function ensurePromise(): Promise<unknown[]> {
      if (!promise) {
        tracker.inFlight++;
        tracker.max = Math.max(tracker.max, tracker.inFlight);
        promise = new Promise<unknown[]>((resolve) => {
          setTimeout(() => {
            tracker.inFlight--;
            resolve(getRows());
          }, delayMs);
        });
      }
      return promise;
    }
    const chain: {
      innerJoin: (t?: unknown, c?: unknown) => typeof chain;
      leftJoin: (t?: unknown, c?: unknown) => typeof chain;
      where: (c?: unknown) => typeof chain;
      orderBy: (...args: unknown[]) => typeof chain;
      limit: (n: number) => Promise<unknown[]>;
      then: Promise<unknown[]>["then"];
    } = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => ensurePromise().then((rows) => rows.slice(0, n)),
      then: (onFulfilled, onRejected) => ensurePromise().then(onFulfilled, onRejected),
    };
    return chain;
  }

  return {
    select(_cols?: unknown) {
      return {
        from(table: unknown) {
          const rows = rowsByTable.get(table) ?? [];
          return lazyChain(() => rows);
        },
      };
    },
  } as unknown as Db;
}

describe("task w31-c: the plan-results read issues its independent reads as a concurrent Promise.all wave (DEC-338 wave-31 amendment)", () => {
  it("has more than one statement in flight at once, not a strictly sequential waterfall", async () => {
    const plan = makePlan();
    const tracker = { inFlight: 0, max: 0 };
    const db = makeConcurrencyDb(
      new Map<unknown, unknown[]>([
        [schema.event, [{ recordPrefix: "S" }]],
        [schema.submission, [{ id: "sub-1", seq: 1, title: "Talk A", status: "pending" }]],
        [schema.evaluation, [{ submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 4 }) }]],
        [schema.reviewRecusal, []],
        [schema.submissionTrack, []],
        [schema.participant, []],
      ]),
      15,
      tracker,
    );

    // Post-DEC-829-w32 the wave lives in rankPlanResults (submissions +
    // evaluations); hydration's own wave is covered by
    // test/review-results-hydration-scope.test.ts.
    const rows = await rankPlanResults({ var: { db } }, plan, 1);

    expect(rows).toHaveLength(1);
    expect(tracker.max).toBeGreaterThan(1);
  });
});
