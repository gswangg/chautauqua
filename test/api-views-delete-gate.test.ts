// DEC-975: the saved-view DELETE gate matches its DEC-904 read gate. A
// private (unshared) view belonging to someone else must answer not_found
// (not forbidden) so its existence isn't confirmed to a viewer who couldn't
// see it in the list; a shared view belonging to someone else still answers
// forbidden (visible, but only its author may delete it); a legacy row with
// a null createdByUserId is org-owned and any organiser may delete it.
//
// Mounts the real viewsRoutes sub-app against a real in-memory SQLite
// engine (node:sqlite + drizzle-orm's sqlite-proxy driver, the
// test/api-views.test.ts pattern) so getSavedViewOwnership's WHERE/JOIN and
// the route's branching are both exercised for real, and row survival is
// asserted by re-reading the row rather than trusting the HTTP status alone.

import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { viewsRoutes } from "../src/routes/api/views";
import { createSavedView } from "../src/server/repo/views";

const DDL = `
create table saved_view (
  id text primary key,
  event_id text,
  name text,
  config_json text,
  created_by_user_id text,
  shared integer not null default 1,
  created_at integer,
  updated_at integer
);
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

const ORG = "org-1";
const EVENT_ID = "event-1";
const CONFIG = { q: "", status: [], trackId: null, sort: "newest", columns: [] };

function appWithAuth(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", viewsRoutes);
  return app;
}

function deleteRequest(id: string) {
  return new Request(`http://local/api/v1/views/${id}`, {
    method: "DELETE",
    headers: { "x-chq-csrf": "1" },
  });
}

async function insertEvent(db: Db) {
  await db.insert(schema.event).values({
    id: EVENT_ID,
    orgId: ORG,
    name: "Test Event",
    slug: "test-event",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    timezone: "UTC",
    recordPrefix: "SES",
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  });
}

async function readRow(db: Db, id: string) {
  const rows = await db.select().from(schema.savedView).where(eqId(id));
  return rows[0];
}

function eqId(id: string) {
  return eq(schema.savedView.id, id);
}

const AUTHOR: AuthInfo = { userId: "u-author", role: "organizer", orgId: ORG };
const OTHER: AuthInfo = { userId: "u-other", role: "organizer", orgId: ORG };

describe("DELETE /api/v1/views/:id (DEC-975 delete gate matches DEC-904 read gate)", () => {
  let db: Db;

  beforeEach(async () => {
    db = makeTestDb();
    await insertEvent(db);
  });

  it("the author deletes their own private view -> 200", async () => {
    const view = await createSavedView(db, EVENT_ID, "Mine", CONFIG, AUTHOR.userId, false);
    const res = await appWithAuth(db, AUTHOR).fetch(deleteRequest(view.id));
    expect(res.status).toBe(200);
    expect(await readRow(db, view.id)).toBeUndefined();
  });

  it("a second organiser deletes another author's private view -> 404, row survives", async () => {
    const view = await createSavedView(db, EVENT_ID, "Author's scratch view", CONFIG, AUTHOR.userId, false);
    const res = await appWithAuth(db, OTHER).fetch(deleteRequest(view.id));
    expect(res.status).toBe(404);
    expect(await readRow(db, view.id)).toBeDefined();
  });

  it("a second organiser deletes a SHARED view authored by someone else -> 403, row survives", async () => {
    const view = await createSavedView(db, EVENT_ID, "Team view", CONFIG, AUTHOR.userId, true);
    const res = await appWithAuth(db, OTHER).fetch(deleteRequest(view.id));
    expect(res.status).toBe(403);
    expect(await readRow(db, view.id)).toBeDefined();
  });

  it("a view with a null createdByUserId (legacy, org-owned) -> any organiser deletes it -> 200", async () => {
    const view = await createSavedView(db, EVENT_ID, "Legacy view", CONFIG, AUTHOR.userId, false);
    // Simulate a pre-DEC-904 row: null author.
    await db.update(schema.savedView).set({ createdByUserId: null }).where(eqId(view.id));

    const res = await appWithAuth(db, OTHER).fetch(deleteRequest(view.id));
    expect(res.status).toBe(200);
    expect(await readRow(db, view.id)).toBeUndefined();
  });
});
