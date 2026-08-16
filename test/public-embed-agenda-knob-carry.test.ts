// DEC-489 (wave-54 amendment), part 2 of 2 -- agenda/schedule's declared
// `accent` knob (src/lib/embed-knobs.ts) must survive a visitor's first
// click inside a branded /embed/... iframe. Before this wave the day
// switcher, the track-highlight Clear link/form and the schedule surface's
// "Browse all sessions" out-link all rebuilt their href/action from the
// request's own trackId/day/q alone, silently dropping ?accent= and
// reverting the iframe to the event's stored default on the very next
// navigation. Harness mirrors test/public-agenda-schedule-filters.test.ts's
// buildSurfaceApp/buildScheduleApp db.select() call-order fakes (no local
// sqlite/D1 test driver is wired up -- see package.json).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { PublicEvent } from "../src/server/repo/public";
import * as schema from "../src/db/schema";

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
} satisfies PublicEvent;

const AGENDA_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-11", startMin: 540, endMin: 600, roomId: "room1" },
];
const TRACKS = [{ id: "trk-a", name: "Track A", color: null }];

function sessionRow(id: string, title: string) {
  return { id, seq: 1, title, description: "A description.", icsSequence: 0 };
}

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

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: (table?: unknown) => (table === schema.scheduleBreak ? emptyChain() : chain),
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    as: () => chain,
    limit: async (n?: number) => (typeof n === "number" ? rows.slice(0, n) : rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function emptyChain() {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    as: () => chain,
    limit: async () => [],
    then: (resolve: (v: unknown[]) => void) => resolve([]),
  };
  return chain;
}

// Mirrors test/public-agenda-schedule-filters.test.ts's buildSurfaceApp
// (agenda dispatch: getPublicTracks, getPublicScheduleDayCounts,
// getPublicAgenda's count, getPublicBreaksByDay, roomRows, then
// hydrateSessions' four selects).
function buildAgendaApp(day: string) {
  let selectCall = 0;
  const rows = AGENDA_ROWS.filter((r) => r.day === day);
  const sessionRows = rows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain(TRACKS); // getPublicTracks
      if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: 1 }, { day: "2026-08-11", count: 1 }]); // getPublicScheduleDayCounts
      if (selectCall === 4) return makeChain([{ count: rows.length }]); // getPublicAgenda total
      if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 6) return makeChain(rows.length > 0 ? [{ id: "room1", name: "Alpha" }] : []); // roomRows
      if (selectCall === 7) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 8) return makeChain([]); // trackRows
      if (selectCall === 9) return makeChain([]); // speakerRows
      if (selectCall === 10) return makeChain([]); // slotRows
      return makeChain([]); // formatRows
    },
    selectDistinct: () => makeChain(rows),
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

// Mirrors buildScheduleApp (no ?day=): getPublicTracks, getPublicAgenda's
// count, getPublicBreaksByDay, roomRows, then hydrateSessions' four selects.
function buildScheduleApp() {
  let selectCall = 0;
  const rows = AGENDA_ROWS;
  const sessionRows = rows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain(TRACKS); // getPublicTracks
      if (selectCall === 3) return makeChain([{ count: rows.length }]); // getPublicAgenda total
      if (selectCall === 4) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 5) return makeChain(rows.length > 0 ? [{ id: "room1", name: "Alpha" }] : []); // roomRows
      if (selectCall === 6) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 7) return makeChain([]); // trackRows
      if (selectCall === 8) return makeChain([]); // speakerRows
      if (selectCall === 9) return makeChain([]); // slotRows
      return makeChain([]); // formatRows
    },
    selectDistinct: () => makeChain(rows),
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

describe("DEC-489 (wave-54 amendment): agenda's out-links carry ?accent= inside /embed", () => {
  it("the day-switcher pills and the track-highlight Clear link both carry ?accent=", async () => {
    installFakeCaches();
    const app = buildAgendaApp("2026-08-10");
    const res = await app.request("/embed/conf/agenda?accent=ff0000&day=2026-08-10&trackId=trk-a", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Day switcher: the other day's pill (2026-08-11) is an out-link (no
    // #chq-day- fragment, since only 2026-08-10 is rendered) that must
    // still carry accent alongside day/trackId.
    expect(html).toContain('href="/embed/conf/agenda?day=2026-08-11&amp;trackId=trk-a&amp;accent=ff0000"');
    // Track-highlight Clear link.
    expect(html).toContain('class="chq-pub-select-clear" href="/embed/conf/agenda?day=2026-08-10&amp;accent=ff0000">Clear</a>');
    // The track-highlight <form>'s own hidden accent input (normalized by
    // parseAccent, which keeps the leading '#' -- the query-string href
    // above strips it via embedKnobQuery, matching saved-embed.tsx's
    // existing redirect-gate convention).
    expect(html).toContain('<input type="hidden" name="accent" value="#ff0000"');
  });

  it("the equivalent /e/ (full-chrome) request carries no accent anywhere", async () => {
    installFakeCaches();
    const app = buildAgendaApp("2026-08-10");
    const res = await app.request("/e/conf/agenda?day=2026-08-10&trackId=trk-a", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("accent=");
    expect(html).not.toContain('name="accent"');
  });
});

describe("DEC-489 (wave-54 amendment): schedule's internal out-link carries ?accent= inside /embed", () => {
  it("the Browse all sessions link carries accent through the sessions surface's own declared knobs", async () => {
    installFakeCaches();
    const app = buildScheduleApp();
    const res = await app.request("/embed/conf/schedule?accent=ff0000", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="/embed/conf/sessions?accent=ff0000"');
  });

  it("the equivalent /e/ request's Browse link carries no accent", async () => {
    installFakeCaches();
    const app = buildScheduleApp();
    const res = await app.request("/e/conf/schedule", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('href="/e/conf/sessions"');
    expect(html).not.toContain("accent=");
  });
});
