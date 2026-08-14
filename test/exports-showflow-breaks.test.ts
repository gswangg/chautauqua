// DEC-022 amendment (wave 66): the show-flow export interleaves
// schedule_break rows with sessions (task w66-c). Covers:
//  1) shapeShowflowExport: a break row lands between the two sessions it
//     separates, and carries no ref/speaker/UID.
//  2) the DEC-022 boundary still holds everywhere else: /e/:slug/schedule.ics,
//     /e/:slug/agenda.ics, and the /embed/:slug/*.json|.xml session feeds
//     never contain a break row.
//  3) POST /api/v1/events/:eventId/breaks rejects startMin + durationMin
//     running past midnight, naming durationMin.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { breaksRoutes } from "../src/routes/api/breaks";
import { publicRoutes } from "../src/routes/public";
import { MINUTES_PER_DAY } from "../src/domain/schedule";
import { shapeShowflowExport, type ShowflowExportInput } from "../src/server/repo/exports/showflow";

// ---------------------------------------------------------------------------
// 1) shapeShowflowExport interleaving
// ---------------------------------------------------------------------------

describe("shapeShowflowExport: DEC-022 breaks interleaved with sessions", () => {
  function session(ref: string, startMin: number, seq: number): ShowflowExportInput {
    return {
      ref,
      title: ref,
      description: "",
      day: "2027-01-01",
      startMin,
      endMin: startMin + 30,
      room: "Room A",
      tracks: [],
      speakers: ["Ada Lovelace"],
      deckFile: "",
      deckUrl: "",
      seq,
    };
  }

  it("a break row lands between the two sessions it separates", () => {
    const inputs: ShowflowExportInput[] = [
      session("SES-001", 540, 1), // 09:00
      {
        ref: "",
        title: "Lunch",
        description: "",
        day: "2027-01-01",
        startMin: 600, // 10:00, between SES-001 (09:00) and SES-002 (10:30)
        endMin: 660,
        room: "Foyer",
        tracks: [],
        speakers: [],
        deckFile: "",
        deckUrl: "",
        seq: -1,
        kind: "break",
      },
      session("SES-002", 630, 2), // 10:30
    ];
    const shuffled = [inputs[2]!, inputs[0]!, inputs[1]!];

    const table = shapeShowflowExport(shuffled);
    const titles = table.rows.map((r) => r[1]);
    expect(titles).toEqual(["SES-001", "Lunch", "SES-002"]);
  });

  it("a break row carries no ref/speaker, and is marked kind='break'", () => {
    const table = shapeShowflowExport([
      {
        ref: "",
        title: "Coffee",
        description: "",
        day: "2027-01-01",
        startMin: 570,
        endMin: 585,
        room: "Foyer",
        tracks: [],
        speakers: [],
        deckFile: "",
        deckUrl: "",
        seq: -1,
        kind: "break",
      },
    ]);
    expect(table.header).toEqual(["ref", "title", "description", "day", "start", "end", "room", "tracks", "speakers", "deck_file", "deck_url", "kind"]);
    const [ref, title, , , , , room, , speakers, , , kind] = table.rows[0]!;
    expect(ref).toBe("");
    expect(title).toBe("Coffee");
    expect(room).toBe("Foyer");
    expect(speakers).toBe("");
    expect(kind).toBe("break");
    // No ics UID/ref column exists on this export at all — a break's row
    // never populates the ref column that would otherwise carry one.
  });

  it("a session row is still explicitly marked kind='session'", () => {
    const table = shapeShowflowExport([session("SES-001", 540, 1)]);
    expect(table.rows[0]![table.header.indexOf("kind")]).toBe("session");
  });
});

// ---------------------------------------------------------------------------
// 2) DEC-022 boundary still holds in the public feeds
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {},
    },
  };
}

const TEST_ENV = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

// A count-query result of 0 short-circuits getPublicAgenda/
// getPublicAgendaByIds before any join fetch — sufficient to prove the .ics
// routes never touch schedule_break (they structurally can't: neither
// getPublicAgenda nor getPublicAgendaByIds in src/server/repo/public/
// agenda.ts imports listBreaksForEvent/getPublicBreaksByDay — only the HTML
// agenda page path does). Call order: 1 getPublicEventBySlug (select), 2 the
// agenda's own `count(*)` query (select, after an internal selectDistinct
// subquery that's never awaited directly).
function icsDb(): AppEnv["Variables"]["db"] {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([EVENT_ROW]);
      if (call === 2) return makeChain([{ count: 0 }]);
      throw new Error(`unexpected select() call ${call}`);
    },
    selectDistinct: () => makeChain([]),
  } as unknown as AppEnv["Variables"]["db"];
}

function buildIcsApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", icsDb());
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

describe("DEC-022 boundary: .ics feeds never carry a break row", () => {
  it("GET /e/:slug/schedule.ics has no break's label/location text", async () => {
    installFakeCaches();
    const app = buildIcsApp();
    const res = await app.request("/e/conf/schedule.ics", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("Lunch");
    expect(text).not.toContain("Foyer");
  });

  it("GET /e/:slug/agenda.ics has no break's label/location text", async () => {
    installFakeCaches();
    const app = buildIcsApp();
    const res = await app.request("/e/conf/agenda.ics", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("Lunch");
    expect(text).not.toContain("Foyer");
  });
});

function buildJsonApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      // 1: getPublicEventBySlug
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      // 2: hydrateSessions subRows
      if (selectCall === 2) {
        return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
      }
      // 3: hydrateSessions trackRows
      if (selectCall === 3) return makeChain([]);
      // 4: hydrateSessions speakerRows
      if (selectCall === 4) return makeChain([]);
      // 5: hydrateSessions slotRows
      if (selectCall === 5) return makeChain([]);
      // 6: hydrateSessions formatRows
      return makeChain([]);
    },
    selectDistinct: () => makeChain([{ id: "sub1", title: "Visible Talk" }]),
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

describe("DEC-022 boundary: /embed/:slug/*.json|.xml session feeds never carry a break row", () => {
  it("sessions.json has no non-session item and no break label text", async () => {
    installFakeCaches();
    const app = buildJsonApp();
    const res = await app.request("/embed/conf/sessions.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    const text = JSON.stringify(body);
    expect(text).not.toContain("Lunch");
    for (const item of body.items) {
      expect(item).not.toHaveProperty("kind", "break");
    }
  });

  it("sessions.xml has no break label text", async () => {
    installFakeCaches();
    const app = buildJsonApp();
    const res = await app.request("/embed/conf/sessions.xml", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("Lunch");
  });
});

// ---------------------------------------------------------------------------
// 3) POST /api/v1/events/:eventId/breaks: past-midnight cross-field check
// ---------------------------------------------------------------------------

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

describe("POST /api/v1/events/:eventId/breaks: DEC-022 amendment, a break cannot run past midnight", () => {
  it("400s naming durationMin when startMin + durationMin > MINUTES_PER_DAY, even though each field is individually valid", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    // 1430 + 120 = 1550 > MINUTES_PER_DAY (1440) — a break ending at 25:50.
    const res = await app.request(postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "Late", startMin: 1430, durationMin: 120 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.durationMin).toBeDefined();
    expect(body.error.fields?.startMin).toBeUndefined();
  });

  it("accepts a break ending exactly at midnight (startMin + durationMin === MINUTES_PER_DAY)", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, "event-a", "org-a", "2027-01-01", "2027-01-03");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest("/api/v1/events/event-a/breaks", { day: "2027-01-01", label: "Last call", startMin: MINUTES_PER_DAY - 60, durationMin: 60 }),
    );
    expect(res.status).toBe(201);
  });
});
