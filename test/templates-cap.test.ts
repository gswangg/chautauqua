// DEC-660 wave-23 amendment: POST /api/v1/events/:eventId/templates refuses
// at MAX_EMAIL_TEMPLATES_PER_EVENT (src/domain/email-templates.ts) BEFORE
// writing -- the template mint door had no bound of any kind before this
// cap existed. Enforced at the repo layer (createTemplate in
// src/server/repo/comms.ts) via the existing countTemplates, the same
// read-then-refuse idiom src/server/repo/participants.ts uses. Real sqlite
// db (same shape as test/api-tokens-cap.test.ts), not a mocked repo layer,
// since the guard lives inside createTemplate itself.

import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { templatesRoutes } from "../src/routes/comms/templates";
import { MAX_EMAIL_TEMPLATES_PER_EVENT } from "../src/domain/email-templates";
import { overCapCountMessage } from "../src/domain/cap-copy";
import { newId } from "../src/domain/ids";

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
create table email_template (
  id text primary key,
  event_id text,
  name text,
  subject text,
  body_text text,
  body_html text,
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

const ORG_A = "org-a";
const AUTH_A: AuthInfo = { userId: "u-a", role: "organizer", orgId: ORG_A };

async function seedEvent(db: Db, id: string, orgId: string) {
  const now = new Date(1000);
  await db.insert(schema.event).values({
    id,
    orgId,
    name: "Event",
    slug: `event-${id}`,
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    timezone: "UTC",
    recordPrefix: "SES",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedTemplates(db: Db, eventId: string, count: number) {
  const now = new Date(1000);
  for (let i = 0; i < count; i++) {
    await db.insert(schema.emailTemplate).values({
      id: newId(),
      eventId,
      name: `Template ${i}`,
      subject: `Subject ${i}`,
      bodyText: `Body ${i}`,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function appWithAuth(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    c.set("auth", auth);
    await next();
  });
  app.route("/", templatesRoutes);
  return app;
}

function createRequest(eventId: string, name: string) {
  return new Request(`http://local/api/v1/events/${eventId}/templates`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ name, subject: "Subject", bodyText: "Body" }),
  });
}

describe("POST /api/v1/events/:eventId/templates (DEC-660 wave-23 cap)", () => {
  let db: Db;
  const EVENT_A = "event-a";
  const EVENT_B = "event-b";

  beforeEach(async () => {
    db = makeTestDb();
    await seedEvent(db, EVENT_A, ORG_A);
    await seedEvent(db, EVENT_B, ORG_A);
  });

  it("refuses at MAX_EMAIL_TEMPLATES_PER_EVENT with the house envelope, message counting against the limit, writing nothing", async () => {
    await seedTemplates(db, EVENT_A, MAX_EMAIL_TEMPLATES_PER_EVENT);

    const res = await appWithAuth(db, AUTH_A).fetch(createRequest(EVENT_A, "One too many"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain(
      overCapCountMessage(MAX_EMAIL_TEMPLATES_PER_EVENT + 1, MAX_EMAIL_TEMPLATES_PER_EVENT, "template"),
    );

    const rows = (await db.select().from(schema.emailTemplate)).filter((r) => r.eventId === EVENT_A);
    expect(rows.length).toBe(MAX_EMAIL_TEMPLATES_PER_EVENT);
  });

  it("still creates and 201s one below the cap", async () => {
    await seedTemplates(db, EVENT_A, MAX_EMAIL_TEMPLATES_PER_EVENT - 1);

    const res = await appWithAuth(db, AUTH_A).fetch(createRequest(EVENT_A, "Last one"));
    expect(res.status).toBe(201);

    const rows = (await db.select().from(schema.emailTemplate)).filter((r) => r.eventId === EVENT_A);
    expect(rows.length).toBe(MAX_EMAIL_TEMPLATES_PER_EVENT);
  });

  it("is event-scoped: a second event at cap does not block the first event from creating", async () => {
    await seedTemplates(db, EVENT_B, MAX_EMAIL_TEMPLATES_PER_EVENT);
    await seedTemplates(db, EVENT_A, 1);

    const res = await appWithAuth(db, AUTH_A).fetch(createRequest(EVENT_A, "Event A template"));
    expect(res.status).toBe(201);

    const rowsA = (await db.select().from(schema.emailTemplate)).filter((r) => r.eventId === EVENT_A);
    expect(rowsA.length).toBe(2);
  });
});
