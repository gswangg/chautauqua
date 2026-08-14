// DEC-022 amendment (wave 63): schedule breaks -- repo scoping/ordering/cap
// + route validation (day-in-range, startMin/durationMin bounds, label
// length, the per-event cap) + event scoping across orgs. Real in-memory
// node:sqlite + drizzle-orm's sqlite-proxy driver against the real schema
// (mirrors test/api-views.test.ts's makeTestDb pattern) so both the repo
// layer and the mounted Hono route are exercised against real SQL, not a
// hand-rolled fake.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { breaksRoutes } from "../src/routes/api/breaks";
import {
  countBreaksForEvent,
  createBreak,
  deleteBreak,
  getBreakForEvent,
  listBreaksForEvent,
  MAX_BREAKS_PER_EVENT,
} from "../src/server/repo/breaks";

const DDL = `
create table event (
  id text primary key,
  org_id text not null,
  name text not null,
  slug text not null,
  start_date text not null,
  end_date text not null,
  location text,
  timezone text not null,
  record_prefix text not null default 'SES',
  branding_json text,
  created_at integer,
  updated_at integer
);
create table schedule_break (
  id text primary key,
  event_id text not null,
  day text not null,
  label text not null,
  location text,
  start_min integer not null,
  duration_min integer not null,
  created_at integer not null,
  updated_at integer not null
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

function seedEvent(sqlite: DatabaseSync, id: string, orgId: string, startDate: string, endDate: string): void {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, location, timezone, record_prefix, branding_json, created_at, updated_at)
       values (?, ?, 'Event', ?, ?, ?, null, 'UTC', 'SES', null, 0, 0)`,
    )
    .run(id, orgId, id, startDate, endDate);
}

// ---------------------------------------------------------------------------
// Repo layer
// ---------------------------------------------------------------------------

describe("src/server/repo/breaks.ts", () => {
  it("lists breaks ordered day asc, start_min asc, id asc, scoped to the event", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    seedEvent(sqlite, "event-b", "org-a", "2027-01-01", "2027-01-03");

    await createBreak(db, "event-a", { day: "2027-01-02", label: "Lunch", location: "Foyer", startMin: 720, durationMin: 60 });
    await createBreak(db, "event-a", { day: "2027-01-01", label: "Coffee", location: null, startMin: 615, durationMin: 15 });
    await createBreak(db, "event-a", { day: "2027-01-01", label: "Early coffee", location: null, startMin: 500, durationMin: 15 });
    // A different event's break must never leak into event-a's list.
    await createBreak(db, "event-b", { day: "2027-01-01", label: "Other event's lunch", location: null, startMin: 600, durationMin: 30 });

    const items = await listBreaksForEvent(db, "event-a");
    expect(items.map((b) => b.label)).toEqual(["Early coffee", "Coffee", "Lunch"]);
    expect(items.every((b) => b.eventId === "event-a")).toBe(true);

    const dayFiltered = await listBreaksForEvent(db, "event-a", "2027-01-01");
    expect(dayFiltered.map((b) => b.label)).toEqual(["Early coffee", "Coffee"]);

    expect(await countBreaksForEvent(db, "event-a")).toBe(3);
    expect(await countBreaksForEvent(db, "event-b")).toBe(1);
  });

  it("refuses loudly rather than silently truncating past MAX_BREAKS_PER_EVENT", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-01");
    for (let i = 0; i < MAX_BREAKS_PER_EVENT + 1; i++) {
      await createBreak(db, "event-a", { day: "2027-01-01", label: `Break ${i}`, location: null, startMin: i, durationMin: 1 });
    }
    await expect(listBreaksForEvent(db, "event-a")).rejects.toThrow(/more than 200 breaks/);
  });

  it("getBreakForEvent/deleteBreak round-trip", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-01");
    const created = await createBreak(db, "event-a", { day: "2027-01-01", label: "Coffee", location: null, startMin: 600, durationMin: 15 });

    expect(await getBreakForEvent(db, created.id)).toEqual({ eventId: "event-a" });
    expect(await getBreakForEvent(db, "nonexistent")).toBeNull();

    await deleteBreak(db, created.id);
    expect(await getBreakForEvent(db, created.id)).toBeNull();
    expect(await countBreaksForEvent(db, "event-a")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Route layer
// ---------------------------------------------------------------------------

function appWithDbAndAuth(db: Db, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", breaksRoutes);
  return app;
}

function postRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

const ORGANIZER_A: AuthInfo = { userId: "u-a", role: "organizer", orgId: "org-a" };
const ORGANIZER_B: AuthInfo = { userId: "u-b", role: "organizer", orgId: "org-b" };

describe("POST /api/v1/events/:eventId/breaks", () => {
  it("creates a break within the event's date range", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-02", label: "Lunch", location: "Foyer", startMin: 720, durationMin: 60 }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { day: string; label: string };
    expect(body.day).toBe("2027-01-02");
    expect(body.label).toBe("Lunch");
    expect(await countBreaksForEvent(db, "event-a")).toBe(1);
  });

  it("refuses a day outside the event's [startDate, endDate] window (DEC-318 rule)", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-02-01", label: "Lunch", location: null, startMin: 720, durationMin: 60 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.day).toBeDefined();
  });

  // DEC-417 (merge-train repair, wave 63): isDayWithinEventRange compares
  // LEXICALLY, so on a multi-day event "2027-01-02" + junk sorts inside the
  // window and used to reach the DB unbounded -- the SQLITE_TOOBIG class.
  // isIsoDay (src/server/repo/agenda.ts, shared with isValidSlotInput) pins
  // the shape, and therefore the length, before the range check runs.
  it.each([
    ["a lexically in-range day with a megabyte of junk appended", `2027-01-02${"9".repeat(100_000)}`],
    ["a non-ISO shape", "Jan 2 2027"],
    ["an unpadded day", "2027-1-2"],
    ["a non-string", 20270102],
  ])("refuses %s, naming the day field", async (_label, day) => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day, label: "Lunch", startMin: 720, durationMin: 60 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.day).toBeDefined();
    expect(await countBreaksForEvent(db, "event-a")).toBe(0);
  });

  it("refuses a missing label, naming the field", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "", startMin: 600, durationMin: 15 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.label).toBeDefined();
  });

  it("refuses out-of-bounds startMin/durationMin, naming both fields", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "Coffee", startMin: -1, durationMin: 0 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.startMin).toBeDefined();
    expect(body.error.fields?.durationMin).toBeDefined();
  });

  it("refuses once the event is already at MAX_BREAKS_PER_EVENT", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-01");
    for (let i = 0; i < MAX_BREAKS_PER_EVENT; i++) {
      await createBreak(db, "event-a", { day: "2027-01-01", label: `Break ${i}`, location: null, startMin: i, durationMin: 1 });
    }
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "One too many", startMin: 1000, durationMin: 1 }),
    );
    expect(res.status).toBe(400);
  });

  it("refuses a cross-org event (object-level ownership check)", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_B);
    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "Lunch", startMin: 720, durationMin: 60 }),
    );
    expect(res.status).toBe(403);
  });

  it("401s with no session, and requires the csrf header", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");

    const noAuthApp = appWithDbAndAuth(db, undefined);
    const noAuthRes = await noAuthApp.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "Lunch", startMin: 720, durationMin: 60 }),
    );
    expect(noAuthRes.status).toBe(401);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const noCsrfRes = await app.request(
      new Request("http://local/api/v1/events/event-a/breaks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: "2027-01-01", label: "Lunch", startMin: 720, durationMin: 60 }),
      }),
    );
    expect(noCsrfRes.status).toBe(400);
  });
});

describe("GET /api/v1/events/:eventId/breaks", () => {
  it("returns only the requesting org's event's breaks, day-filterable", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    await createBreak(db, "event-a", { day: "2027-01-01", label: "Coffee", location: null, startMin: 600, durationMin: 15 });
    await createBreak(db, "event-a", { day: "2027-01-02", label: "Lunch", location: "Foyer", startMin: 720, durationMin: 60 });

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(new Request("http://local/api/v1/events/event-a/breaks"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { label: string }[] };
    expect(body.items.map((b) => b.label)).toEqual(["Coffee", "Lunch"]);

    const filtered = await app.request(new Request("http://local/api/v1/events/event-a/breaks?day=2027-01-02"));
    const filteredBody = (await filtered.json()) as { items: { label: string }[] };
    expect(filteredBody.items.map((b) => b.label)).toEqual(["Lunch"]);
  });

  // DEC-461(a)/DEC-488 (merge-train repair, wave 63): a cap-bounded list GET
  // still ships the full envelope, and perPage is the real per-request
  // ceiling (MAX_BREAKS_PER_EVENT) -- never `items.length || 1`, which
  // DEC-466 killed. test/list-envelope-enumeration.test.ts grades this site
  // mechanically; this asserts the wire shape it grades.
  it("ships the DEC-461(a) envelope with MAX_BREAKS_PER_EVENT as perPage", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    await createBreak(db, "event-a", { day: "2027-01-01", label: "Coffee", location: null, startMin: 600, durationMin: 15 });

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(new Request("http://local/api/v1/events/event-a/breaks"));
    const body = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(MAX_BREAKS_PER_EVENT);
  });
});

describe("DELETE /api/v1/breaks/:id", () => {
  it("deletes an owned break", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const created = await createBreak(db, "event-a", { day: "2027-01-01", label: "Coffee", location: null, startMin: 600, durationMin: 15 });

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(
      new Request(`http://local/api/v1/breaks/${created.id}`, { method: "DELETE", headers: { "x-chq-csrf": "1" } }),
    );
    expect(res.status).toBe(200);
    expect(await getBreakForEvent(db, created.id)).toBeNull();
  });

  it("404s on an unknown id, 403s on a break owned by a different org", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const created = await createBreak(db, "event-a", { day: "2027-01-01", label: "Coffee", location: null, startMin: 600, durationMin: 15 });

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const missing = await app.request(
      new Request("http://local/api/v1/breaks/nonexistent", { method: "DELETE", headers: { "x-chq-csrf": "1" } }),
    );
    expect(missing.status).toBe(404);

    const crossOrgApp = appWithDbAndAuth(db, ORGANIZER_B);
    const forbidden = await crossOrgApp.request(
      new Request(`http://local/api/v1/breaks/${created.id}`, { method: "DELETE", headers: { "x-chq-csrf": "1" } }),
    );
    expect(forbidden.status).toBe(403);
    // Still there -- a rejected cross-org delete must never touch the row.
    expect(await getBreakForEvent(db, created.id)).not.toBeNull();
  });
});
