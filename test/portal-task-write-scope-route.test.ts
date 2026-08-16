// DEC-962 (wave-63 amendment): "a repo write reachable from a
// speaker-authenticated route carries its own scope, and the population is
// read from the import graph". POST /portal/tasks/:assignmentId/complete
// already refused a foreign assignment upstream (assertOwnAssignmentOr403);
// this test proves BOTH halves against a REAL (in-memory) SQLite database,
// no repo mocks: the request still 403s, AND the underlying task_assignment
// row is untouched — i.e. updateAssignmentStatus's new scopeContactId
// predicate (src/server/repo/tasks/crud.ts) really does refuse the write in
// its own WHERE, not merely in the caller's discipline (same shape as the
// wave-58 files-content-status.ts fix this DEC amendment mirrors).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { portalTasksRoutes } from "../src/routes/portal/tasks";

const DDL = `
create table event (
  id text primary key,
  org_id text,
  name text
);
create table task (
  id text primary key,
  event_id text,
  kind text,
  title text,
  form_id text,
  deliverable_kind text
);
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

describe("POST /portal/tasks/:assignmentId/complete refuses a foreign assignment in BOTH layers (DEC-962 wave-63)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    sqlite.prepare(`insert into event (id, org_id, name) values ('event-1', 'org-1', 'Arbitrary Con')`).run();
    sqlite.prepare(`insert into task (id, event_id, kind, title) values ('task-1', 'event-1', 'general', 'Sign a thing')`).run();
    // Owned by ct-owner, not the requesting speaker (ct-attacker).
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('assign-1', 'task-1', 'ct-owner', 'pending', 0, 0)`,
      )
      .run();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("still 403s AND writes zero rows", async () => {
    const attackerAuth: AuthInfo = { userId: "u-attacker", role: "speaker", orgId: "org-1", contactId: "ct-attacker" };
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", attackerAuth);
      c.set("db", db);
      await next();
    });
    app.route("/portal", portalTasksRoutes);

    const form = new URLSearchParams();
    form.set("chq_csrf", "tok-1");
    const res = await app.request("/portal/tasks/assign-1/complete", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "chq_csrf=tok-1",
      },
      body: form.toString(),
    });

    expect(res.status).toBe(403);

    const rows = sqlite.prepare(`select status, completed_at, completed_by from task_assignment where id = 'assign-1'`).all();
    expect(rows).toEqual([{ status: "pending", completed_at: null, completed_by: null }]);
  });

  it("the assignment's own contact can still complete it (positive control)", async () => {
    const ownerAuth: AuthInfo = { userId: "u-owner", role: "speaker", orgId: "org-1", contactId: "ct-owner" };
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ownerAuth);
      c.set("db", db);
      await next();
    });
    app.route("/portal", portalTasksRoutes);

    const form = new URLSearchParams();
    form.set("chq_csrf", "tok-1");
    const res = await app.request("/portal/tasks/assign-1/complete", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "chq_csrf=tok-1",
      },
      body: form.toString(),
    });

    expect(res.status).toBe(302);
    const rows = sqlite.prepare(`select status from task_assignment where id = 'assign-1'`).all();
    expect(rows).toEqual([{ status: "complete" }]);
  });
});
