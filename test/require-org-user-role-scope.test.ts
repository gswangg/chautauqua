// DEC-865 (wave 131 amendment): src/server/repo/review/users.ts's
// requireOrgUser was a second copy of the org-user resolution that validated
// orgId alone and never filtered on role -- unlike its sibling
// src/server/repo/users.ts:143 (getOrgUserById), which already scopes
// through ORG_USER_ROLES. This proves requireOrgUser now resolves through
// the SAME vocabulary: an organizer or reviewer in-org succeeds, and a
// same-org speaker-portal-role user is refused not_found -- driven against a
// REAL in-memory SQLite engine (node:sqlite + drizzle-orm/sqlite-proxy over
// hand-written DDL), same technique as test/cross-org-reviewer-probe.test.ts
// and test/rate-limit-atomicity.test.ts, so the assertion is about the real
// query predicate, not a mocked resolver.
//
// The third case additionally proves that when requireOrgUser refuses, the
// caller's plan_reviewer insert never runs -- mirroring the real route
// (src/routes/review/plans-reviewers.ts:118), which awaits requireOrgUser
// before ever touching plan_reviewer.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { requireOrgUser } from "../src/server/repo/review/users";
import { ApiError } from "../src/server/http";

const DDL = `
create table user (
  id text primary key,
  org_id text,
  email text,
  password_hash text,
  role text,
  name text,
  contact_id text,
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

const NOW = new Date("2026-01-01T00:00:00Z");
const ORG = "org-a";
const PLAN = "plan-a";

async function seedUser(db: Db, id: string, role: string) {
  await db.insert(schema.user).values({
    id,
    orgId: ORG,
    email: `${id}@org-a.test`,
    passwordHash: "x",
    role,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

// Mirrors the real route's sequencing (src/routes/review/plans-reviewers.ts:118):
// requireOrgUser is awaited first, and only on success does a plan_reviewer
// row get written.
async function simulateAssignment(db: Db, userId: string): Promise<void> {
  await requireOrgUser(db, userId, ORG);
  await db.insert(schema.planReviewer).values({
    id: `pr-${userId}`,
    planId: PLAN,
    userId,
    trackId: null,
    submissionId: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe("requireOrgUser resolves through ORG_USER_ROLES (DEC-865)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("assigning an organizer succeeds", async () => {
    await seedUser(db, "user-organizer", "organizer");
    await expect(simulateAssignment(db, "user-organizer")).resolves.toBeUndefined();
    const rows = await db.select().from(schema.planReviewer).where(eq(schema.planReviewer.userId, "user-organizer"));
    expect(rows).toHaveLength(1);
  });

  it("assigning a reviewer succeeds", async () => {
    await seedUser(db, "user-reviewer", "reviewer");
    await expect(simulateAssignment(db, "user-reviewer")).resolves.toBeUndefined();
    const rows = await db.select().from(schema.planReviewer).where(eq(schema.planReviewer.userId, "user-reviewer"));
    expect(rows).toHaveLength(1);
  });

  it("assigning a same-org speaker-portal-role user is refused not_found and writes no plan_reviewer row", async () => {
    await seedUser(db, "user-speaker", "speaker");
    let caught: unknown;
    try {
      await simulateAssignment(db, "user-speaker");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("not_found");

    const rows = await db.select().from(schema.planReviewer).where(eq(schema.planReviewer.userId, "user-speaker"));
    expect(rows).toEqual([]);
  });
});
