// DEC-596: countAssignedReviewersForSubmission (src/server/repo/review/reviewers.ts)
// backs the organiser "Reviews · N of M in" header's denominator, which must
// count ASSIGNED reviewers, never evaluation rows -- an assigned-but-unscored
// reviewer must still be counted. Driven against a REAL in-memory SQLite
// engine (node:sqlite + drizzle-orm/sqlite-proxy, same technique as
// test/cross-org-reviewer-probe.test.ts) so the SQL itself is exercised, not
// a mocked resolver.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { countAssignedReviewersForSubmission } from "../src/server/repo/review/reviewers";

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
  round_meta_json text,
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
create table submission_track (
  submission_id text,
  track_id text,
  created_at integer
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

function makeTestDb(): Db {
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
  return db as unknown as Db;
}

const NOW = new Date("2026-01-01T00:00:00Z");
const EVENT_ID = "event-1";
const SUBMISSION_ID = "submission-1";
const PLAN_ID = "plan-1";
const SCALE_JSON = JSON.stringify({ min: 1, max: 5 });
const CRITERIA_JSON = JSON.stringify([{ id: "c1", label: "Quality", kind: "rating", weight: 1 }]);

async function seedPlan(db: Db): Promise<void> {
  await db.insert(schema.evaluationPlan).values({
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: "Plan One",
    scaleJson: SCALE_JSON,
    criteriaJson: CRITERIA_JSON,
    rounds: 1,
    currentRound: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe("DEC-596: countAssignedReviewersForSubmission", () => {
  it("counts an assigned-but-unscored reviewer, so the denominator is not the evaluations count", async () => {
    const db = makeTestDb();
    await seedPlan(db);
    // Reviewer assigned to this submission specifically, but has never
    // submitted an evaluation row.
    await db.insert(schema.planReviewer).values({
      id: "pr-1",
      planId: PLAN_ID,
      userId: "user-1",
      trackId: null,
      submissionId: SUBMISSION_ID,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const assigned = await countAssignedReviewersForSubmission(db, EVENT_ID, SUBMISSION_ID);
    expect(assigned).toBe(1);
  });

  it("counts an all-scope (unrestricted) reviewer as covering this submission", async () => {
    const db = makeTestDb();
    await seedPlan(db);
    await db.insert(schema.planReviewer).values({
      id: "pr-1",
      planId: PLAN_ID,
      userId: "user-1",
      trackId: null,
      submissionId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const assigned = await countAssignedReviewersForSubmission(db, EVENT_ID, SUBMISSION_ID);
    expect(assigned).toBe(1);
  });

  it("counts a track-scoped reviewer whose track matches this submission's own track", async () => {
    const db = makeTestDb();
    await seedPlan(db);
    await db.insert(schema.submissionTrack).values({
      submissionId: SUBMISSION_ID,
      trackId: "track-a",
      createdAt: NOW,
    });
    await db.insert(schema.planReviewer).values({
      id: "pr-1",
      planId: PLAN_ID,
      userId: "user-1",
      trackId: "track-a",
      submissionId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    // A different track-scoped reviewer, not on this submission's track --
    // must not be counted.
    await db.insert(schema.planReviewer).values({
      id: "pr-2",
      planId: PLAN_ID,
      userId: "user-2",
      trackId: "track-b",
      submissionId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const assigned = await countAssignedReviewersForSubmission(db, EVENT_ID, SUBMISSION_ID);
    expect(assigned).toBe(1);
  });

  it("excludes a reviewer who has recused from this (plan, submission)", async () => {
    const db = makeTestDb();
    await seedPlan(db);
    await db.insert(schema.planReviewer).values({
      id: "pr-1",
      planId: PLAN_ID,
      userId: "user-1",
      trackId: null,
      submissionId: SUBMISSION_ID,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(schema.reviewRecusal).values({
      id: "recusal-1",
      planId: PLAN_ID,
      submissionId: SUBMISSION_ID,
      userId: "user-1",
      reason: "Conflict of interest",
      createdAt: NOW,
    });

    const assigned = await countAssignedReviewersForSubmission(db, EVENT_ID, SUBMISSION_ID);
    expect(assigned).toBe(0);
  });

  it("does not double-count the same (plan, userId) pair covered by two matching scope rows", async () => {
    const db = makeTestDb();
    await seedPlan(db);
    await db.insert(schema.planReviewer).values([
      { id: "pr-1", planId: PLAN_ID, userId: "user-1", trackId: null, submissionId: null, createdAt: NOW, updatedAt: NOW },
      {
        id: "pr-2",
        planId: PLAN_ID,
        userId: "user-1",
        trackId: null,
        submissionId: SUBMISSION_ID,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    const assigned = await countAssignedReviewersForSubmission(db, EVENT_ID, SUBMISSION_ID);
    expect(assigned).toBe(1);
  });
});
