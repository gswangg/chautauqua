// w10-e / DEC-422 wave-10 amendment: the per-event saved-view cap predicate
// is AUTHORSHIP, not visibility. Before this fix, MAX_SAVED_VIEWS_PER_EVENT
// shared views authored by one organiser permanently locked every colleague
// in the org out of creating a view -- they could not create one (the cap
// counted rows they didn't author) and could not delete anyone else's row
// (DEC-975 delete gate is author-or-forbidden). This file exercises the
// authorship predicate directly against countSavedViewsCreatedBy and end to
// end through the POST route with two distinct authors in the same org.

import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { viewsRoutes } from "../src/routes/api/views";
import { createSavedView, countSavedViews, countSavedViewsCreatedBy } from "../src/server/repo/views";
import { MAX_SAVED_VIEWS_PER_EVENT } from "../src/domain/saved-views";

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
const AUTHOR_A: AuthInfo = { userId: "u-a", role: "organizer", orgId: ORG };
const AUTHOR_B: AuthInfo = { userId: "u-b", role: "organizer", orgId: ORG };

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

function createRequest(name: string, shared: boolean) {
  return new Request(`http://local/api/v1/events/${EVENT_ID}/views`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ name, config: CONFIG, shared }),
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

describe("saved-view cap predicate is authorship (DEC-422 wave-10 amendment)", () => {
  let db: Db;

  beforeEach(async () => {
    db = makeTestDb();
    await insertEvent(db);
  });

  it("organiser B can still create a view when A alone authored MAX shared views", async () => {
    for (let i = 0; i < MAX_SAVED_VIEWS_PER_EVENT; i++) {
      await createSavedView(db, EVENT_ID, `A's view ${i}`, CONFIG, AUTHOR_A.userId, true);
    }

    // A's rows fill the visibility-scoped total for anyone in the org...
    expect(await countSavedViews(db, EVENT_ID, AUTHOR_B.userId)).toBe(MAX_SAVED_VIEWS_PER_EVENT);
    // ...but B has authored none, so B is not capped out.
    expect(await countSavedViewsCreatedBy(db, EVENT_ID, AUTHOR_B.userId)).toBe(0);

    const res = await appWithAuth(db, AUTHOR_B).fetch(createRequest("B's first view", false));
    expect(res.status).toBe(201);

    const rows = await db.select().from(schema.savedView);
    expect(rows.length).toBe(MAX_SAVED_VIEWS_PER_EVENT + 1);
  });

  it("refuses B once B's OWN views reach the cap, with the authorship-scoped copy", async () => {
    for (let i = 0; i < MAX_SAVED_VIEWS_PER_EVENT; i++) {
      await createSavedView(db, EVENT_ID, `B's view ${i}`, CONFIG, AUTHOR_B.userId, false);
    }

    const res = await appWithAuth(db, AUTHOR_B).fetch(createRequest("One too many", false));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toBe(
      `You already have the maximum of ${MAX_SAVED_VIEWS_PER_EVENT} saved views on this event.`,
    );

    const rows = await db.select().from(schema.savedView);
    expect(rows.length).toBe(MAX_SAVED_VIEWS_PER_EVENT);
  });

  it("A's shared views remain listable/countable through countSavedViews unchanged", async () => {
    for (let i = 0; i < 3; i++) {
      await createSavedView(db, EVENT_ID, `A's view ${i}`, CONFIG, AUTHOR_A.userId, true);
    }
    // Visibility-scoped count (DEC-904/DEC-461) still sees all 3 shared rows
    // for any viewer in the org -- unchanged by the authorship-only cap.
    expect(await countSavedViews(db, EVENT_ID, AUTHOR_A.userId)).toBe(3);
    expect(await countSavedViews(db, EVENT_ID, AUTHOR_B.userId)).toBe(3);
    // The cap predicate for A herself now also reads 3 (she authored them).
    expect(await countSavedViewsCreatedBy(db, EVENT_ID, AUTHOR_A.userId)).toBe(3);
    // But B, who authored none, is not capped by A's rows.
    expect(await countSavedViewsCreatedBy(db, EVENT_ID, AUTHOR_B.userId)).toBe(0);
  });
});
