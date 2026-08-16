// DEC-962 (wave-63 amendment): "a repo write reachable from a
// speaker-authenticated route carries its own scope ... never a caller's
// memory". These are repo-level (real in-memory SQLite, no repo mocks)
// tests, deliberately calling the four fixed writers DIRECTLY — bypassing
// the upstream assertOwnAssignmentOr403 / getParticipantScope route checks
// entirely — to prove the WHERE clause itself, not the caller's discipline,
// is what refuses a foreign id. Route-level "still 403s" coverage for one
// of these lives in test/portal-task-write-scope-route.test.ts; this file
// is the "AND writes zero rows even if the guard above it were gone" half.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { saveTaskFormResponse, saveTaskFileCompletion } from "../src/server/repo/portal/tasks";
import { setInviteStatus } from "../src/server/repo/portal/invitations";
import { updateAssignmentStatus } from "../src/server/repo/tasks/crud";

const DDL = `
create table task_assignment (
  id text primary key,
  task_id text,
  contact_id text,
  status text not null default 'pending',
  completed_at integer,
  completed_by text,
  response_json text,
  file_id text,
  last_reminded_at integer,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  invite_status text not null default 'none',
  updated_at integer
);
create table submission (
  id text primary key,
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

describe("DEC-962 wave-63: portal repo writers scope on contactId in the WHERE, not just the caller's check", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('assign-1', 'task-1', 'ct-owner', 'pending', 0, 0)`,
      )
      .run();
    sqlite.prepare(`insert into submission (id, updated_at) values ('sub-1', 0)`).run();
    sqlite
      .prepare(`insert into participant (id, submission_id, contact_id, invite_status) values ('part-1', 'sub-1', 'ct-owner', 'invited')`)
      .run();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("saveTaskFormResponse writes zero rows for a foreign contactId", async () => {
    await saveTaskFormResponse(db, "assign-1", "ct-attacker", '{"a":"b"}');
    const rows = sqlite.prepare(`select response_json from task_assignment where id = 'assign-1'`).all();
    expect(rows).toEqual([{ response_json: null }]);

    // Positive control: the real owner's write DOES land.
    await saveTaskFormResponse(db, "assign-1", "ct-owner", '{"a":"b"}');
    const after = sqlite.prepare(`select response_json from task_assignment where id = 'assign-1'`).all();
    expect(after).toEqual([{ response_json: '{"a":"b"}' }]);
  });

  it("saveTaskFileCompletion writes zero rows for a foreign contactId", async () => {
    await saveTaskFileCompletion(db, "assign-1", "ct-attacker", "file-1");
    const rows = sqlite.prepare(`select file_id from task_assignment where id = 'assign-1'`).all();
    expect(rows).toEqual([{ file_id: null }]);

    await saveTaskFileCompletion(db, "assign-1", "ct-owner", "file-1");
    const after = sqlite.prepare(`select file_id from task_assignment where id = 'assign-1'`).all();
    expect(after).toEqual([{ file_id: "file-1" }]);
  });

  it("updateAssignmentStatus with scopeContactId writes zero rows for a foreign contactId", async () => {
    await expect(
      updateAssignmentStatus(db, "assign-1", "complete", "u-attacker", new Date(1000), "ct-attacker"),
    ).rejects.toThrow();
    const rows = sqlite.prepare(`select status from task_assignment where id = 'assign-1'`).all();
    expect(rows).toEqual([{ status: "pending" }]);

    // Positive control + backward-compat: no scopeContactId still updates
    // (organizer callers keep their existing, event-scoped-upstream behavior).
    await updateAssignmentStatus(db, "assign-1", "complete", "u-owner", new Date(2000));
    const after = sqlite.prepare(`select status from task_assignment where id = 'assign-1'`).all();
    expect(after).toEqual([{ status: "complete" }]);
  });

  it("setInviteStatus writes zero rows for a foreign contactId", async () => {
    await setInviteStatus(db, "part-1", "ct-attacker", "accepted", "sub-1");
    const rows = sqlite.prepare(`select invite_status from participant where id = 'part-1'`).all();
    expect(rows).toEqual([{ invite_status: "invited" }]);

    await setInviteStatus(db, "part-1", "ct-owner", "accepted", "sub-1");
    const after = sqlite.prepare(`select invite_status from participant where id = 'part-1'`).all();
    expect(after).toEqual([{ invite_status: "accepted" }]);
  });
});
