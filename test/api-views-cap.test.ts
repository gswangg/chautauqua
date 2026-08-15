// DEC-422/w2-f: saved views were unbounded in three directions --
// config_json's `q`/`trackId`/`columns` (isValidSavedViewConfig) and the
// per-event view collection (unpaged into ViewTabs.tsx). This file covers
// the per-event POST refusal at MAX_SAVED_VIEWS_PER_EVENT; the config
// bound cases live alongside the rest of isValidSavedViewConfig's tests in
// test/api-views.test.ts.

import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { viewsRoutes } from "../src/routes/api/views";
import { createSavedView } from "../src/server/repo/views";
import { MAX_SAVED_VIEWS_PER_EVENT } from "../src/domain/saved-views";
import { overCapCountMessage } from "../src/domain/cap-copy";

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
const AUTHOR: AuthInfo = { userId: "u-author", role: "organizer", orgId: ORG };

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

function createRequest(name: string) {
  return new Request(`http://local/api/v1/events/${EVENT_ID}/views`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ name, config: CONFIG, shared: false }),
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

describe("POST /events/:eventId/views (DEC-422 per-event cap)", () => {
  let db: Db;

  beforeEach(async () => {
    db = makeTestDb();
    await insertEvent(db);
  });

  it("refuses at MAX_SAVED_VIEWS_PER_EVENT with the house envelope, before createSavedView", async () => {
    for (let i = 0; i < MAX_SAVED_VIEWS_PER_EVENT; i++) {
      await createSavedView(db, EVENT_ID, `View ${i}`, CONFIG, AUTHOR.userId, false);
    }

    const res = await appWithAuth(db, AUTHOR).fetch(createRequest("One too many"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    // DEC-422 amendment: the ONE cap grammar from src/domain/cap-copy.ts,
    // never the terse bare-number grammar -- same shape as the already-full
    // form-fields refusal (test/forms-field-options-cap.test.ts).
    expect(body.error.fields?.name).toBe(
      overCapCountMessage(MAX_SAVED_VIEWS_PER_EVENT + 1, MAX_SAVED_VIEWS_PER_EVENT, "saved view"),
    );

    const rows = await db.select().from(schema.savedView);
    expect(rows.length).toBe(MAX_SAVED_VIEWS_PER_EVENT);
  });

  it("allows creation one below the cap", async () => {
    for (let i = 0; i < MAX_SAVED_VIEWS_PER_EVENT - 1; i++) {
      await createSavedView(db, EVENT_ID, `View ${i}`, CONFIG, AUTHOR.userId, false);
    }

    const res = await appWithAuth(db, AUTHOR).fetch(createRequest("Last one"));
    expect(res.status).toBe(201);

    const rows = await db.select().from(schema.savedView);
    expect(rows.length).toBe(MAX_SAVED_VIEWS_PER_EVENT);
  });
});
