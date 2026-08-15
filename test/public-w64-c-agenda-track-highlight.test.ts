// DEC-851 (wave 64 amendment): track is a render-level HIGHLIGHT on
// /agenda and /schedule now, never a filter -- every session in the day
// still renders regardless of ?trackId=, the format pill/select is gone
// from these two surfaces entirely (format stays a full filter only on
// /sessions), and the day switcher's out-links still carry the active
// trackId/q forward across a day jump.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

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

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
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

function sessionRow(id: string, title: string) {
  return { id, seq: 1, title, description: "A description.", icsSequence: 0 };
}

// Two sessions on the one rendered day, on two different tracks -- neither
// is dropped from getPublicAgenda's result even though ?trackId= is set,
// because the amendment removed trackId as a SQL predicate on this surface.
const ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-10", startMin: 660, endMin: 720, roomId: "room1" },
];
const TRACKS = [
  { id: "trk-a", name: "Track A", color: null },
  { id: "trk-b", name: "Track B", color: null },
];

// DEC-774 wave-34 amendment: dispatch.tsx's agenda case issues exactly TWO
// Promise.all waves (wave 1: [getPublicTracks, getPublicScheduleDayCounts];
// wave 2: [getPublicAgenda(effectiveDay), getPublicBreaksByDay(effectiveDay)]
// -- concurrent, so getPublicAgenda's own count(*) subquery and
// getPublicBreaksByDay's one-shot select fire in the SAME synchronous
// burst, ahead of getPublicAgenda's rows query/room lookup/hydrateSessions
// cascade). The schedule case issues ONE wave
// ([getPublicTracks, getPublicAgenda(query.day), maybe
// getPublicScheduleDayCounts, getPublicBreaksByDay(query.day)] -- no
// ?day= here, so the day-switcher read is skipped): getPublicAgenda's
// count-subquery and getPublicBreaksByDay's select again land in the same
// burst, ahead of getPublicAgenda's own rows/room/hydrate cascade. See
// test/public-surface-round-trip-depth.test.ts for the behavioural proof.
function buildSurfaceApp(surface: "agenda" | "schedule") {
  let selectCall = 0;
  const sessionRows = ROWS.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      // DEC-851 (wave 64 amendment): getPublicFormatOptions is never called
      // for agenda/schedule -- only getPublicTracks (feeding the highlight
      // <select>) sits ahead of the standard getPublicAgenda call sequence.
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain(TRACKS); // getPublicTracks
      if (surface === "agenda") {
        // wave 1's second read.
        if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: ROWS.length }]); // dayCounts
        // wave 2's burst: agenda's count-subquery, then breaksByDay.
        if (selectCall === 4) return makeChain([{ count: ROWS.length }]); // DEC-548 total
        if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
        if (selectCall === 6) return makeChain([{ id: "room1", name: "Alpha" }]); // roomRows
        if (selectCall === 7) return makeChain(sessionRows); // hydrateSessions subRows
        if (selectCall === 8) return makeChain([]); // trackRows
        if (selectCall === 9) return makeChain([]); // speakerRows
        if (selectCall === 10) return makeChain([]); // slotRows
        return makeChain([]); // formatRows
      }
      // schedule: ONE wave, no ?day= -- the day-switcher read is skipped,
      // so the burst is just [tracks, agenda's count-subquery,
      // breaksByDay].
      if (selectCall === 3) return makeChain([{ count: ROWS.length }]); // DEC-548 total
      if (selectCall === 4) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 5) return makeChain([{ id: "room1", name: "Alpha" }]); // roomRows
      if (selectCall === 6) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 7) return makeChain([]); // trackRows
      if (selectCall === 8) return makeChain([]); // speakerRows
      if (selectCall === 9) return makeChain([]); // slotRows
      return makeChain([]); // formatRows
    },
    selectDistinct: () => makeChain(ROWS),
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

describe("DEC-851 (wave 64 amendment): /agenda and /schedule highlight a track, never filter by one", () => {
  it("/agenda: with ?trackId= set, every session in the day still appears in the markup", async () => {
    installFakeCaches();
    const res = await buildSurfaceApp("agenda").request("/e/conf/agenda?trackId=trk-a", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="chq-agenda-sub1"');
    expect(html).toContain('id="chq-agenda-sub2"');
    expect(html).toContain('id="chq-agenda-list-sub1"');
    expect(html).toContain('id="chq-agenda-list-sub2"');
    // No "Showing the first N of M" undercount line -- both rows rendered.
    expect(html).not.toContain("Showing the first");
  });

  // task-w1-d (DEC-555 amendment): /schedule's rows aren't the highlight-
  // aware AgendaItemList/AgendaDayGrid markup any more -- ?trackId= is not
  // even a knob this surface reads (the highlight control was dropped).
  // Every candidate row still renders server-side though (see
  // public-agenda-schedule-filters.test.ts's "task w1-d" describe).
  it("/schedule: with ?trackId= set, every session in the day still appears in the markup", async () => {
    installFakeCaches();
    const res = await buildSurfaceApp("schedule").request("/e/conf/schedule?trackId=trk-a", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-submission-id="sub1"');
    expect(html).toContain('data-submission-id="sub2"');
    expect(html).not.toContain("Showing the first");
  });

  it("/agenda: no format control (pill bar or <select name=\"format\">) remains", async () => {
    installFakeCaches();
    const res = await buildSurfaceApp("agenda").request("/e/conf/agenda", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("Format filters");
    expect(html).not.toContain('name="format"');
  });

  it("/schedule: no format control (pill bar or <select name=\"format\">) remains", async () => {
    installFakeCaches();
    const res = await buildSurfaceApp("schedule").request("/e/conf/schedule", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("Format filters");
    expect(html).not.toContain('name="format"');
  });

  it("/agenda: the day switcher's out-links still carry the active trackId and q forward", async () => {
    installFakeCaches();
    // Two days so the switcher renders (single-day events render no
    // switcher at all).
    const twoDayRows = [...ROWS, { submissionId: "sub3", day: "2026-08-11", startMin: 540, endMin: 600, roomId: "room1" }];
    let selectCall = 0;
    const sessionRows = twoDayRows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
    const db = {
      select: () => {
        selectCall += 1;
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        if (selectCall === 2) return makeChain(TRACKS);
        // DEC-768 (wave 67 amendment): getPublicScheduleDayCounts -- this is
        // now what feeds the switcher its full day list (it no longer
        // derives one from the rendered items), so BOTH days must appear
        // here or the switcher has nothing to render.
        if (selectCall === 3) {
          return makeChain([
            { day: "2026-08-10", count: 2 },
            { day: "2026-08-11", count: 1 },
          ]);
        }
        // DEC-774 wave-34 amendment: wave 2's burst -- agenda's
        // count-subquery, then getPublicBreaksByDay -- ahead of agenda's
        // own rows/room/hydrate cascade (see buildSurfaceApp's comment
        // above for the full ordering rationale).
        if (selectCall === 4) return makeChain([{ count: twoDayRows.length }]);
        if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
        if (selectCall === 6) return makeChain([{ id: "room1", name: "Alpha" }]);
        if (selectCall === 7) return makeChain(sessionRows);
        if (selectCall === 8) return makeChain([]);
        if (selectCall === 9) return makeChain([]);
        if (selectCall === 10) return makeChain([]);
        return makeChain([]);
      },
      selectDistinct: () => makeChain(twoDayRows),
    } as unknown as AppEnv["Variables"]["db"];
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", publicRoutes);

    const res = await app.request("/e/conf/agenda?trackId=trk-a&q=keynote", {}, TEST_ENV);
    const html = await res.text();
    const pillHrefs = [...html.matchAll(/class="chq-pub-day-pill[^"]*" href="([^"]*)"/g)].map((m) => m[1]!);
    expect(pillHrefs.length).toBeGreaterThan(0);
    for (const href of pillHrefs) {
      expect(href).toContain("trackId=trk-a");
      expect(href).toContain("q=keynote");
    }
  });
});
