// w11-c: addReviewers (src/server/repo/review/reviewers.ts) must be
// idempotent on the plan_reviewer scope key (userId, trackId, submissionId)
// -- there is no unique index (SQLite treats NULLs as distinct, so an index
// would miss the (userId, null, null) broad-scope repeat), so the writer
// itself must dedupe and pre-read. Runs against a real in-memory SQLite
// engine (same technique as test/plan-delete-cascade.test.ts) so the actual
// chunked pre-read/insert queries are exercised, not a hand-simulated shape.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { addReviewers } from "../src/server/repo/review/reviewers";
import type { Db } from "../src/server/context";

const DDL = `
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

describe("addReviewers is idempotent on the plan_reviewer scope key (w11-c)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const planId = "plan-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("repeating the same track-scope POST leaves exactly one row and returns it", async () => {
    const first = await addReviewers(db, planId, [{ userId: "rev-1", trackId: "track-a", submissionId: null }]);
    expect(first).toHaveLength(1);
    const firstRowId = first[0]?.id;

    const second = await addReviewers(db, planId, [{ userId: "rev-1", trackId: "track-a", submissionId: null }]);
    expect(second).toHaveLength(1);
    expect(second[0]?.id).toBe(firstRowId);

    const rows = sqlite.prepare("select id from plan_reviewer where plan_id = ?").all(planId);
    expect(rows).toHaveLength(1);
  });

  it('["SES-014", "<internal id>"] resolved to the same submission yields one row', async () => {
    // Simulating the route resolving both a ref and the internal id to the
    // same submissionId (DEC-623 aliasing) BEFORE calling addReviewers --
    // the writer itself also guards this for direct callers.
    const created = await addReviewers(db, planId, [
      { userId: "rev-1", trackId: null, submissionId: "sub-14" },
      { userId: "rev-1", trackId: null, submissionId: "sub-14" },
    ]);
    expect(created).toHaveLength(1);
    const rows = sqlite.prepare("select id from plan_reviewer where plan_id = ? and submission_id = ?").all(planId, "sub-14");
    expect(rows).toHaveLength(1);
  });

  it("a genuinely new pair still inserts", async () => {
    await addReviewers(db, planId, [{ userId: "rev-1", trackId: "track-a", submissionId: null }]);
    const created = await addReviewers(db, planId, [{ userId: "rev-2", trackId: "track-a", submissionId: null }]);
    expect(created).toHaveLength(1);
    expect(created[0]?.userId).toBe("rev-2");
    const rows = sqlite.prepare("select id from plan_reviewer where plan_id = ?").all(planId);
    expect(rows).toHaveLength(2);
  });

  it("a mixed array of one existing and one new pair inserts exactly one and returns both", async () => {
    const [existingRow] = await addReviewers(db, planId, [{ userId: "rev-1", trackId: "track-a", submissionId: null }]);
    expect(existingRow).toBeDefined();

    const result = await addReviewers(db, planId, [
      { userId: "rev-1", trackId: "track-a", submissionId: null }, // already exists
      { userId: "rev-1", trackId: "track-b", submissionId: null }, // new
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(existingRow?.id);
    expect(result[0]?.trackId).toBe("track-a");
    expect(result[1]?.trackId).toBe("track-b");
    expect(result[1]?.id).not.toBe(existingRow?.id);

    const rows = sqlite.prepare("select id from plan_reviewer where plan_id = ?").all(planId);
    expect(rows).toHaveLength(2);
  });
});
