// DEC-271 (wave-110 amendment): a recusal retracts the score from every
// downstream read. DESIGN-RULINGS.md row 18 fixes the ComposeWizard caption
// "Only submitted, non-recused reviews are merged" -- this file proves the
// CODE now matches it at both read sites named in the task:
//
// (a) src/server/repo/comms.ts's listFeedbackCommentsForSubmissions must
//     never merge a recused reviewer's comment into an outbound send, even
//     though the reviewer submitted it (and recused only afterward -- legal,
//     src/routes/review/recusals.ts places no evaluation check on recusing).
// (b) src/server/repo/review/evaluations.ts's listEvaluationScoresForPlan
//     (the resolver that feeds shared.ts's rankPlanResults ->
//     aggregateSubmission) must exclude that same score from the plan mean,
//     so the ranked-results mean matches the mean of the remaining
//     (non-recused) reviewers, not the raw submitted set.
//
// Both fakes below implement a REAL left-join-is-null anti-join against a
// review_recusal fixture (matching on planId/submissionId/reviewerId==
// userId) rather than a no-op -- unlike the byte-identical pinning fakes in
// test/plan-results-aggregate-pin.test.ts and test/review-results-
// payload.test.ts (whose fixtures have no recused SUBMITTED row to exercise
// this path), so this file is the one that actually falsifies the anti-join.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { listFeedbackCommentsForSubmissions } from "../src/server/repo/comms";
import { listEvaluationScoresForPlan } from "../src/server/repo/review/evaluations";
import { aggregateSubmission } from "../src/domain/evaluation/scoring";
import type { EvaluationCriterion } from "../src/domain/evaluation/scoring";
import { numericScoresFor } from "../src/domain/evaluation/scores-json";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";

const PLAN_ID = "plan-1";
const ROUND = 1;
const SUBMISSION_ID = "sub-1";

// reviewer-A submitted an evaluation WITH a comment, then recused.
// reviewer-B submitted an evaluation WITH a comment and never recused.
const EVALUATIONS = [
  {
    id: "eval-A",
    planId: PLAN_ID,
    round: ROUND,
    submissionId: SUBMISSION_ID,
    reviewerId: "reviewer-A",
    comment: "A's comment -- must never merge or count",
    scoresJson: JSON.stringify({ c1: 4 }),
    submittedAt: 1000,
    createdAt: 1,
  },
  {
    id: "eval-B",
    planId: PLAN_ID,
    round: ROUND,
    submissionId: SUBMISSION_ID,
    reviewerId: "reviewer-B",
    comment: "B's comment -- the only one left",
    scoresJson: JSON.stringify({ c1: 2 }),
    submittedAt: 1001,
    createdAt: 2,
  },
];

const RECUSALS = [{ id: "recusal-A", planId: PLAN_ID, submissionId: SUBMISSION_ID, userId: "reviewer-A" }];

/** A real (not no-op) left-join-is-null anti-join fake: `leftJoin` against
 * schema.reviewRecusal actually filters the evaluation rows in scope by
 * matching (planId, submissionId, reviewerId == userId) against the
 * RECUSALS fixture, then `where`/`orderBy`/`limit` operate on that narrowed
 * set -- so a test asserting on the OUTPUT is asserting on the anti-join
 * actually running, not on a hand-filtered fixture. */
function fakeAntiJoinDb(): Db {
  return {
    select() {
      return {
        from(table: unknown) {
          let rows = table === schema.evaluation ? [...EVALUATIONS] : [];
          const chain = {
            leftJoin(joinTable: unknown) {
              if (table === schema.evaluation && joinTable === schema.reviewRecusal) {
                rows = rows.filter(
                  (r) =>
                    !RECUSALS.some(
                      (rec) => rec.planId === r.planId && rec.submissionId === r.submissionId && rec.userId === r.reviewerId,
                    ),
                );
              }
              return chain;
            },
            where() {
              const filtered = rows.filter((r) => r.submittedAt !== null);
              const result: any = Promise.resolve(filtered);
              result.limit = async (n: number) => filtered.slice(0, n);
              result.orderBy = (..._args: unknown[]) => {
                const ordered = [...filtered].sort(
                  (a, b) => a.submissionId.localeCompare(b.submissionId) || a.id.localeCompare(b.id),
                );
                const orderedResult: any = Promise.resolve(ordered);
                orderedResult.limit = async (n: number) => ordered.slice(0, n);
                return orderedResult;
              };
              return result;
            },
          };
          return chain;
        },
      };
    },
  } as unknown as Db;
}

/** Same anti-join, shaped for listFeedbackCommentsForSubmissions'
 * {submissionId, comment, submittedAt} projection over schema.evaluation. */
function fakeAntiJoinCommsDb(): AppEnv["Variables"]["db"] {
  return {
    select() {
      return {
        from(table: unknown) {
          let rows = table === schema.evaluation ? [...EVALUATIONS] : [];
          const chain = {
            leftJoin(joinTable: unknown) {
              if (table === schema.evaluation && joinTable === schema.reviewRecusal) {
                rows = rows.filter(
                  (r) =>
                    !RECUSALS.some(
                      (rec) => rec.planId === r.planId && rec.submissionId === r.submissionId && rec.userId === r.reviewerId,
                    ),
                );
              }
              return chain;
            },
            where() {
              const filtered = rows.filter((r) => r.submittedAt !== null);
              return {
                orderBy: () => ({
                  then: (resolve: (v: unknown[]) => void) =>
                    resolve(
                      [...filtered]
                        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
                        .map((r) => ({ submissionId: r.submissionId, comment: r.comment, submittedAt: r.submittedAt })),
                    ),
                }),
              };
            },
          };
          return chain;
        },
      };
    },
  } as unknown as AppEnv["Variables"]["db"];
}

describe("DEC-271: a recusal retracts the score from every downstream read", () => {
  it("comms merge: a recused reviewer's comment is never merged, even though they submitted it before recusing", async () => {
    const db = fakeAntiJoinCommsDb();
    const map = await listFeedbackCommentsForSubmissions(db, [SUBMISSION_ID], { planId: PLAN_ID, round: ROUND });
    expect(map.get(SUBMISSION_ID)).toEqual(["B's comment -- the only one left"]);
  });

  it("ranked-results mean: the recused reviewer's score is excluded, matching the mean of the remaining reviewers", async () => {
    const db = fakeAntiJoinDb();
    const scoreRows = await listEvaluationScoresForPlan(db, PLAN_ID, ROUND);

    // Only reviewer-B's row should survive the anti-join.
    expect(scoreRows).toEqual([{ submissionId: SUBMISSION_ID, scores: { c1: 2 } }]);

    const criteria: EvaluationCriterion[] = [{ id: "c1", label: "Quality", weight: 1 }];
    const evals = scoreRows
      .filter((r) => r.submissionId === SUBMISSION_ID)
      .map((r) => ({ scores: numericScoresFor(r.scores, criteria, r.submissionId) }));
    const agg = aggregateSubmission(evals, criteria);

    // The mean of the remaining (non-recused) reviewers is exactly
    // reviewer-B's own score -- not the (4+2)/2 = 3 it would be if
    // reviewer-A's recused score still counted.
    expect(agg.count).toBe(1);
    expect(agg.average).toBe(2);
  });
});
