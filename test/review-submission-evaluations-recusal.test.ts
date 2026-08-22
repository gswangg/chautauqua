// DEC-271 wave-34 amendment: the submission-detail Reviews read
// (listEvaluationsForSubmission, src/server/repo/review/evaluations.ts) had
// no recusal anti-join, while its sibling on the SAME response
// (countAssignedReviewersForSubmission,
// src/server/repo/review/reviewers.ts:292-308) already deletes recused
// (planId,userId) pairs from `assigned`. A reviewer who scores and then
// declares a conflict made items.length > assigned: the organiser's Reviews
// panel showed more reviews than the reviewers it said were assigned, and
// the retracted score rendered as live.
//
// This pins the fix end-to-end against a real (in-memory) SQLite engine via
// node:sqlite + drizzle's sqlite-proxy driver -- the same technique
// test/compose-recipient-dedup-sqlite.test.ts uses -- seeding one plan, one
// submission, two reviewers both submitted, one of them recused. Asserts
// listEvaluationsForSubmission returns exactly 1 row and that its length is
// <= countAssignedReviewersForSubmission for the same (submission, plan): the
// invariant DEC-271 restores, because both halves of the response now filter
// on the identical review_recusal anti-join predicate.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { listEvaluationsForSubmission } from "../src/server/repo/review/evaluations";
import { countAssignedReviewersForSubmission } from "../src/server/repo/review/reviewers";
import type { Db } from "../src/server/context";

const DDL = `
create table evaluation_plan (
  id text primary key,
  event_id text not null,
  name text not null,
  instructions text,
  open_date integer,
  close_date integer,
  filters_json text,
  anonymized integer not null default 0,
  anonymized_at integer,
  scale_json text not null,
  criteria_json text not null,
  rounds integer not null default 1,
  round_criteria_json text,
  current_round integer not null default 1,
  created_at integer not null,
  updated_at integer not null
);
create table plan_reviewer (
  id text primary key,
  plan_id text not null,
  user_id text not null,
  track_id text,
  submission_id text,
  created_at integer not null,
  updated_at integer not null
);
create table evaluation (
  id text primary key,
  plan_id text not null,
  submission_id text not null,
  reviewer_id text not null,
  round integer not null default 1,
  scores_json text not null,
  comment text,
  submitted_at integer,
  created_at integer not null,
  updated_at integer not null
);
create table review_recusal (
  id text primary key,
  plan_id text not null,
  submission_id text not null,
  user_id text not null,
  reason text,
  created_at integer not null
);
create table submission_track (
  submission_id text not null,
  track_id text not null,
  created_at integer not null,
  primary key (submission_id, track_id)
);
create table user (
  id text primary key,
  org_id text not null,
  email text not null,
  name text,
  password_hash text not null,
  role text not null,
  contact_id text,
  created_at integer not null,
  updated_at integer not null
);
create table contact (
  id text primary key,
  org_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  created_at integer not null,
  updated_at integer not null
);
`;

const T0 = 1_700_000_000_000;
const ORG = "org-a";
const EVENT = "ev_recusal";
const PLAN = "plan_1";
const SUBMISSION = "sub_1";

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

describe("listEvaluationsForSubmission anti-joins review_recusal (DEC-271 wave-34 amendment)", () => {
  it("a recused reviewer's submitted score is excluded, restoring items.length <= assigned", async () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into evaluation_plan (id, event_id, name, scale_json, criteria_json, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(PLAN, EVENT, "Talk Review", JSON.stringify({ min: 1, max: 5 }), JSON.stringify([]), T0, T0);

    sqlite
      .prepare(
        `insert into user (id, org_id, email, password_hash, role, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("user_alice", ORG, "alice@example.com", "x", "reviewer", T0, T0);
    sqlite
      .prepare(
        `insert into user (id, org_id, email, password_hash, role, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("user_bob", ORG, "bob@example.com", "x", "reviewer", T0, T0);

    // Both reviewers assigned to the whole plan (trackId/submissionId null = all).
    sqlite
      .prepare(
        `insert into plan_reviewer (id, plan_id, user_id, created_at, updated_at)
         values (?, ?, ?, ?, ?)`,
      )
      .run("pr_alice", PLAN, "user_alice", T0, T0);
    sqlite
      .prepare(
        `insert into plan_reviewer (id, plan_id, user_id, created_at, updated_at)
         values (?, ?, ?, ?, ?)`,
      )
      .run("pr_bob", PLAN, "user_bob", T0, T0);

    // Both reviewers submitted an evaluation for this submission.
    sqlite
      .prepare(
        `insert into evaluation (id, plan_id, submission_id, reviewer_id, round, scores_json, submitted_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("eval_alice", PLAN, SUBMISSION, "user_alice", 1, JSON.stringify({}), T0, T0, T0);
    sqlite
      .prepare(
        `insert into evaluation (id, plan_id, submission_id, reviewer_id, round, scores_json, submitted_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("eval_bob", PLAN, SUBMISSION, "user_bob", 1, JSON.stringify({}), T0, T0, T0);

    // Bob later recuses himself from this submission -- a retraction, not
    // just a queue filter (DEC-271 wave-110 amendment).
    sqlite
      .prepare(
        `insert into review_recusal (id, plan_id, submission_id, user_id, created_at)
         values (?, ?, ?, ?, ?)`,
      )
      .run("recusal_bob", PLAN, SUBMISSION, "user_bob", T0);

    const items = await listEvaluationsForSubmission(db, SUBMISSION, PLAN);
    const assigned = await countAssignedReviewersForSubmission(db, EVENT, SUBMISSION, PLAN);

    expect(items).toHaveLength(1);
    expect(items[0]?.reviewerName).toContain("alice@example.com");
    expect(assigned).toBe(1);
    expect(items.length).toBeLessThanOrEqual(assigned);
  });
});
