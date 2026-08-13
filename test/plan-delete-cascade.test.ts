// DEC-929: plan deletion names what it destroys. countPlanDeleteImpact must
// tally reviewers/evaluations(submitted+draft)/recusals with one grouped
// query per table, and deletePlan must actually delete every one of those
// rows -- including review_recusal, which the pre-DEC-929 deletePlan left
// orphaned. Runs against a real in-memory SQLite engine (same technique as
// test/file-version-identity.test.ts) so the actual repo queries are
// exercised, not a hand-simulated row shape.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { countPlanDeleteImpact, deletePlan } from "../src/server/repo/review/plans";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";

const DDL = `
create table evaluation_plan (
  id text primary key,
  event_id text,
  name text,
  instructions text,
  open_date integer,
  close_date integer,
  filters_json text,
  anonymized integer,
  anonymized_at integer,
  scale_json text,
  criteria_json text,
  rounds integer,
  current_round integer,
  round_criteria_json text,
  max_evaluations integer,
  created_at integer,
  updated_at integer
);
create table plan_reviewer (
  id text primary key,
  plan_id text,
  user_id text,
  track_id text,
  submission_id text,
  created_at integer,
  updated_at integer
);
create table evaluation (
  id text primary key,
  plan_id text,
  submission_id text,
  reviewer_id text,
  round integer,
  scores_json text,
  comment text,
  submitted_at integer,
  created_at integer,
  updated_at integer
);
create table review_recusal (
  id text primary key,
  plan_id text,
  submission_id text,
  user_id text,
  reason text,
  created_at integer
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

describe("plan deletion names what it destroys (DEC-929)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const planId = "plan-1";
  const otherPlanId = "plan-2";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    const now = Date.now();
    sqlite.exec(`insert into evaluation_plan
      (id, event_id, name, scale_json, criteria_json, rounds, current_round, created_at, updated_at)
      values ('${planId}', 'event-1', 'Plan One', '{}', '[]', 1, 1, ${now}, ${now}),
             ('${otherPlanId}', 'event-1', 'Plan Two', '{}', '[]', 1, 1, ${now}, ${now})`);

    // Two distinct reviewers on plan-1 (one with two assignment rows --
    // distinct userId, not row count, is what "reviewers" must mean).
    for (const [id, userId] of [
      [newId(), "reviewer-a"],
      [newId(), "reviewer-a"],
      [newId(), "reviewer-b"],
    ]) {
      sqlite.exec(
        `insert into plan_reviewer (id, plan_id, user_id, created_at, updated_at) values ('${id}', '${planId}', '${userId}', ${now}, ${now})`,
      );
    }
    // One reviewer on the OTHER plan -- must never leak into plan-1's counts.
    sqlite.exec(
      `insert into plan_reviewer (id, plan_id, user_id, created_at, updated_at) values ('${newId()}', '${otherPlanId}', 'reviewer-c', ${now}, ${now})`,
    );

    // Mixed submitted/draft evaluations on plan-1: 2 submitted, 1 draft.
    sqlite.exec(`insert into evaluation
      (id, plan_id, submission_id, reviewer_id, round, scores_json, submitted_at, created_at, updated_at)
      values
      ('${newId()}', '${planId}', 'sub-1', 'reviewer-a', 1, '{}', ${now}, ${now}, ${now}),
      ('${newId()}', '${planId}', 'sub-2', 'reviewer-a', 1, '{}', ${now}, ${now}, ${now}),
      ('${newId()}', '${planId}', 'sub-3', 'reviewer-b', 1, '{}', NULL, ${now}, ${now})`);
    // A different plan's evaluation, must not leak in.
    sqlite.exec(`insert into evaluation
      (id, plan_id, submission_id, reviewer_id, round, scores_json, submitted_at, created_at, updated_at)
      values ('${newId()}', '${otherPlanId}', 'sub-9', 'reviewer-c', 1, '{}', ${now}, ${now}, ${now})`);

    // Two recusals on plan-1.
    sqlite.exec(`insert into review_recusal (id, plan_id, submission_id, user_id, created_at) values
      ('${newId()}', '${planId}', 'sub-1', 'reviewer-a', ${now}),
      ('${newId()}', '${planId}', 'sub-3', 'reviewer-b', ${now})`);
    sqlite.exec(
      `insert into review_recusal (id, plan_id, submission_id, user_id, created_at) values ('${newId()}', '${otherPlanId}', 'sub-9', 'reviewer-c', ${now})`,
    );
  });

  afterEach(() => {
    sqlite.close();
  });

  it("countPlanDeleteImpact tallies reviewers/evaluations/recusals scoped to one plan", async () => {
    const impact = await countPlanDeleteImpact(db, planId);
    expect(impact).toEqual({
      reviewers: 2, // distinct userId, not the 3 plan_reviewer rows
      evaluationsSubmitted: 2,
      evaluationsDraft: 1,
      recusals: 2,
    });
  });

  it("counts zero for a plan with nothing recorded against it", async () => {
    const impact = await countPlanDeleteImpact(db, "no-such-plan");
    expect(impact).toEqual({ reviewers: 0, evaluationsSubmitted: 0, evaluationsDraft: 0, recusals: 0 });
  });

  it("deletePlan removes every row across all four owned tables, leaving the other plan's rows intact", async () => {
    await deletePlan(db, planId);

    const remainingPlan = sqlite.prepare("select id from evaluation_plan where id = ?").all(planId);
    expect(remainingPlan).toHaveLength(0);
    const remainingReviewers = sqlite.prepare("select id from plan_reviewer where plan_id = ?").all(planId);
    expect(remainingReviewers).toHaveLength(0);
    const remainingEvaluations = sqlite.prepare("select id from evaluation where plan_id = ?").all(planId);
    expect(remainingEvaluations).toHaveLength(0);
    const remainingRecusals = sqlite.prepare("select id from review_recusal where plan_id = ?").all(planId);
    expect(remainingRecusals).toHaveLength(0);

    // The other plan's rows across all four tables survive untouched.
    const otherPlan = sqlite.prepare("select id from evaluation_plan where id = ?").all(otherPlanId);
    expect(otherPlan).toHaveLength(1);
    const otherReviewers = sqlite.prepare("select id from plan_reviewer where plan_id = ?").all(otherPlanId);
    expect(otherReviewers).toHaveLength(1);
    const otherEvaluations = sqlite.prepare("select id from evaluation where plan_id = ?").all(otherPlanId);
    expect(otherEvaluations).toHaveLength(1);
    const otherRecusals = sqlite.prepare("select id from review_recusal where plan_id = ?").all(otherPlanId);
    expect(otherRecusals).toHaveLength(1);
  });
});
