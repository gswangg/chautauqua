// DEC-713 amendment (wave 51): DELETE /api/v1/resources/:resourceId
// (src/routes/api/portal-config.ts) is the THIRD call site converted to the
// wave-50 committed-delete shape -- the file row deletes FIRST, then the R2
// object is deleted in a try/catch that logs and swallows a failure. Runs
// against a real in-memory SQLite engine (same technique as
// test/plan-delete-cascade.test.ts) so the actual repo queries are
// exercised, not a hand-simulated row shape; only the FileStore (R2) port is
// faked.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { portalConfigRoutes } from "../src/routes/api/portal-config";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";

const DDL = `
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
create table resource (
  id text primary key,
  event_id text,
  kind text,
  title text,
  content text,
  file_id text,
  position integer,
  created_at integer,
  updated_at integer
);
create table file (
  id text primary key,
  submission_id text,
  kind text,
  filename text,
  r2_key text,
  size_bytes integer,
  content_type text,
  previous_file_id text,
  version_no integer,
  uploaded_by_contact_id text,
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

const orgId = "org-1";
const eventId = "event-1";
const resourceId = "resource-1";
const fileId = "file-1";
const r2Key = "resources/file-1.pdf";

function seed(sqlite: DatabaseSync): void {
  const now = Date.now();
  sqlite.exec(`insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
    values ('${eventId}', '${orgId}', 'Event One', 'event-one', '2026-01-01', '2026-01-02', 'UTC', 'SES', ${now}, ${now})`);
  sqlite.exec(`insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, created_at, updated_at)
    values ('${fileId}', null, 'resource', 'handout.pdf', '${r2Key}', 100, 'application/pdf', ${now}, ${now})`);
  sqlite.exec(`insert into resource (id, event_id, kind, title, content, file_id, position, created_at, updated_at)
    values ('${resourceId}', '${eventId}', 'file', 'Handout', null, '${fileId}', 0, ${now}, ${now})`);
}

function buildApp(db: Db, files: R2Bucket) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const auth: AuthInfo = { userId: "org-user-1", role: "organizer", orgId };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    c.env = { ...(c.env ?? {}), FILES: files } as never;
    await next();
  });
  app.route("/api/v1", portalConfigRoutes);
  return app;
}

async function callDelete(app: Hono<AppEnv>) {
  return app.request(`/api/v1/resources/${resourceId}`, {
    method: "DELETE",
    headers: { "x-chq-csrf": "1" },
  });
}

describe("DELETE /resources/:resourceId — committed-delete order (DEC-713 amendment wave 51)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seed(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("commits the file-row delete even when store.delete throws, and still returns 204", async () => {
    // R2Bucket.delete accepts a single key or an array -- makeFileStore's
    // FileStore.delete delegates to deleteMany([key]), so the underlying
    // R2Bucket sees an array here even though the route calls store.delete
    // with a single key.
    const deleteCalls: string[][] = [];
    const files = {
      async get() {
        return null;
      },
      async put() {},
      async delete(keys: string | string[]) {
        deleteCalls.push(Array.isArray(keys) ? keys : [keys]);
        throw new Error("simulated R2 failure");
      },
    } as unknown as R2Bucket;

    const app = buildApp(db, files);
    const res = await callDelete(app);

    expect(res.status).toBe(204);
    expect(deleteCalls).toEqual([[r2Key]]);

    const rows = sqlite.prepare("select id from file where id = ?").all(fileId);
    expect(rows).toEqual([]);
    const resourceRows = sqlite.prepare("select id from resource where id = ?").all(resourceId);
    expect(resourceRows).toEqual([]);
  });

  it("never calls store.delete when the file-row delete itself throws", async () => {
    const deleteCalls: string[] = [];
    const files = {
      async get() {
        return null;
      },
      async put() {},
      async delete(key: string) {
        deleteCalls.push(key);
      },
    } as unknown as R2Bucket;

    // Force ONLY the file-row DELETE to fail (not the read) -- a trigger
    // that raises on DELETE FROM file leaves getFileForDelete's SELECT
    // untouched, so this isolates deleteFileRow's write specifically.
    const app = buildApp(db, files);
    sqlite.exec(`
      create trigger file_delete_fails before delete on file
      begin
        select raise(abort, 'simulated file-row delete failure');
      end;
    `);

    const res = await callDelete(app);
    expect(res.status).toBe(500);
    expect(deleteCalls).toEqual([]);
  });
});
