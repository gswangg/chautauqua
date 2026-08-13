// DEC-489: every public embed knob must behave identically on a surface's
// HTML page and its .json twin. The knob table is fixed by DEC-489:
//   sessions   = trackId, limit, fields, accent
//   speakers/gallery = q, limit, accent
//   agenda/schedule  = day, accent
// This file asserts HTML/.json parity for the paging/filtering knobs (limit,
// day). DEC-594 (EMB-5) closed a gap in the original DEC-489 knob table:
// `day` is now ALSO honored on the sessions surface (an accepted param must
// never silently no-op just because it wasn't in the original table) — it
// still isn't advertised in sessions' Show-more link, since sessions has no
// day-scoped "show more" concept. Reuses the fake-db-chain harness
// established in test/public.test.ts / test/public-embed-config.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    // DEC-768: a ?day=-filtered agenda/schedule also asks for the full day
    // list (getPublicScheduleDayCounts), which groups by schedule_slot.day.
    groupBy: () => chain,
    orderBy: () => chain,
    // DEC-548: getPublicAgenda ends its count(*) subquery build with .as().
    as: () => chain,
    limit: async (n: number) => rows.slice(0, n),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Walks a drizzle condition tree collecting bound scalar values (mirrors
// test/public-agenda-bounds.test.ts's walkCondition) so the agenda fake below
// can honor a WHERE it can't otherwise see.
function boundValues(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 12 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.value === "string") out.push(n.value);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...boundValues(c, seen, depth + 1));
  }
  return out;
}

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {
      /* no-op */
    },
    async delete() {
      /* no-op */
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

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
  brandingJson: JSON.stringify({ accentColor: "#123456" }),
};

function mountApp(db: unknown) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

// -- speakers/gallery: `limit` -------------------------------------------
// getPublicSpeakers issues selectDistinct (id page, bounded by
// boundedRowLimit) + select (count, unbounded) + select (hydration rows for
// the page's ids, unbounded).
const SPEAKERS = Array.from({ length: 5 }, (_, i) => ({
  contactId: `c${i + 1}`,
  firstName: "First",
  lastName: `Last${i + 1}`,
}));

function buildSpeakersApp() {
  let selectCall = 0;
  const idRows = SPEAKERS.map((s) => ({ contactId: s.contactId }));
  const countRows = [{ total: SPEAKERS.length }];
  const hydrationRows = SPEAKERS.map((s) => ({
    contactId: s.contactId,
    firstName: s.firstName,
    lastName: s.lastName,
    title: null,
    company: null,
    headshotUrl: null,
    bio: null,
    submissionId: `sub-${s.contactId}`,
    submissionTitle: `Talk for ${s.contactId}`,
  }));
  const db = {
    select: (_fields?: unknown) => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall % 2 === 0) return makeChain(countRows); // count query
      return makeChain(hydrationRows); // hydration query
    },
    selectDistinct: () => makeChain(idRows),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

describe("DEC-489: speakers/gallery `limit` behaves identically on HTML and .json", () => {
  it("speakers?limit=3 returns 3 items on both the HTML page and the .json twin", async () => {
    installFakeCaches();
    const htmlApp = buildSpeakersApp();
    const htmlRes = await htmlApp.request("/embed/conf/speakers?limit=3", {}, TEST_ENV);
    const html = await htmlRes.text();
    expect(html).toContain("3 of 5 speakers");

    installFakeCaches();
    const jsonApp = buildSpeakersApp();
    const jsonRes = await jsonApp.request("/embed/conf/speakers.json?limit=3", {}, TEST_ENV);
    const body = (await jsonRes.json()) as { items: unknown[]; total: number; perPage: number };
    expect(body.items.length).toBe(3);
    expect(body.total).toBe(5);
    expect(body.perPage).toBe(3);
  });

  it("gallery?limit=3 returns 3 items on both the HTML page and the .json twin", async () => {
    installFakeCaches();
    const htmlApp = buildSpeakersApp();
    const htmlRes = await htmlApp.request("/embed/conf/gallery?limit=3", {}, TEST_ENV);
    const html = await htmlRes.text();
    expect(html).toContain("3 of 5 speakers");

    installFakeCaches();
    const jsonApp = buildSpeakersApp();
    const jsonRes = await jsonApp.request("/embed/conf/gallery.json?limit=3", {}, TEST_ENV);
    const body = (await jsonRes.json()) as { items: unknown[]; total: number; perPage: number };
    expect(body.items.length).toBe(3);
    expect(body.total).toBe(5);
  });

  it("a configured speakers embed carries `limit` forward on its Show-more link", async () => {
    installFakeCaches();
    const app = buildSpeakersApp();
    const res = await app.request("/embed/conf/speakers?limit=2", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('name="limit" value="2"');
    expect(html).toContain("limit=2&amp;page=2");
  });
});

// -- agenda/schedule: `day` ------------------------------------------------
// Two agenda items on two distinct days.
// DEC-804: the HTML dispatch (renderSurfaceContent) now calls getPublicTracks
// once to feed the search form's track <select> — the plain .json feed
// (getSurfaceFeedPage) does NOT call it, so `forJson` controls whether this
// fake's select() sequence includes that extra call.
function buildAgendaApp(forJson = false) {
  let selectCall = 0;
  const SESSION_ROWS = [
    { id: "sub1", seq: 1, title: "Talk 1", description: "d", icsSequence: 0 },
    { id: "sub2", seq: 2, title: "Talk 2", description: "d", icsSequence: 0 },
  ];
  const AGENDA_ROWS = [
    { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" },
    { submissionId: "sub2", day: "2026-08-11", startMin: 540, endMin: 600, roomId: "room1" },
  ];
  // The event's own range is deliberately WIDER than the two agenda days, so
  // slotWithinEventRange's gte/lte bind 2026-08-09/2026-08-12 and any *other*
  // date-shaped value in the WHERE can only have come from DEC-548's added
  // eq(schedule_slot.day, params.day).
  const AGENDA_EVENT_ROW = { ...EVENT_ROW, startDate: "2026-08-09", endDate: "2026-08-12" };
  // DEC-548 moved the ?day= filter out of a post-hoc JS .filter() and into the
  // SQL WHERE, so this fake has to apply it itself -- otherwise it would hand
  // back both days no matter what was asked for and the parity assertions
  // below would be testing the mock, not the route.
  let matched = AGENDA_ROWS;
  function agendaChain() {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (cond: unknown) => {
        const day = boundValues(cond).find(
          (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v !== AGENDA_EVENT_ROW.startDate && v !== AGENDA_EVENT_ROW.endDate,
        );
        matched = day ? AGENDA_ROWS.filter((r) => r.day === day) : AGENDA_ROWS;
        return chain;
      },
      orderBy: () => chain,
      as: () => chain,
      limit: async (n: number) => matched.slice(0, n),
      then: (resolve: (v: unknown[]) => void) => resolve(matched),
    };
    return chain;
  }
  const db = {
    select: () => {
      selectCall += 1;
      const offset = forJson ? 0 : 2;
      if (selectCall === 1) return makeChain([AGENDA_EVENT_ROW]); // getPublicEventBySlug
      if (!forJson && selectCall === 2) return makeChain([]); // DEC-804 getPublicTracks (search form's track <select>, HTML dispatch only)
      if (!forJson && selectCall === 3) return makeChain([]); // DEC-851 getPublicFormatOptions (search form's format <select>, HTML dispatch only)
      // DEC-548: the unwindowed count(*) over the same filtered join, read
      // after selectDistinct's .where() has already narrowed `matched`.
      if (selectCall === 2 + offset) return makeChain([{ count: matched.length }]);
      if (selectCall === 3 + offset) return makeChain([{ id: "room1", name: "Main Hall" }]); // roomRows
      if (selectCall === 4 + offset) return makeChain(SESSION_ROWS); // hydrateSessions subRows
      if (selectCall === 5 + offset) return makeChain([]); // hydrateSessions trackRows
      if (selectCall === 6 + offset) return makeChain([]); // hydrateSessions speakerRows
      return makeChain([]); // hydrateSessions EMB-01 slotRows (unused by agenda grid)
    },
    selectDistinct: () => agendaChain(),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

describe("DEC-489: agenda/schedule `day` behaves identically on HTML and .json", () => {
  it("agenda?day=<d> renders only that day's HTML section", async () => {
    installFakeCaches();
    const app = buildAgendaApp();
    const res = await app.request("/embed/conf/agenda?day=2026-08-10", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("chq-agenda-sub1");
    expect(html).not.toContain("chq-agenda-sub2");
  });

  it("agenda.json?day=<d> returns only that day's items and reports the filtered total", async () => {
    installFakeCaches();
    const app = buildAgendaApp(true);
    const res = await app.request("/embed/conf/agenda.json?day=2026-08-10", {}, TEST_ENV);
    const body = (await res.json()) as { items: Array<{ submissionId: string }>; total: number };
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub1"]);
    expect(body.total).toBe(1);
  });

  it("schedule.json?day=<d> agrees with schedule's HTML filtering", async () => {
    installFakeCaches();
    const htmlApp = buildAgendaApp();
    const htmlRes = await htmlApp.request("/embed/conf/schedule?day=2026-08-11", {}, TEST_ENV);
    const html = await htmlRes.text();
    // DEC-602: /schedule renders the itinerary list (`chq-agenda-list-<id>`),
    // never the room-column grid's blocks (`chq-agenda-<id>`) — assert the
    // day filter against the markup /schedule actually emits.
    expect(html).toContain("chq-agenda-list-sub2");
    expect(html).not.toContain("chq-agenda-list-sub1");

    installFakeCaches();
    const jsonApp = buildAgendaApp(true);
    const jsonRes = await jsonApp.request("/embed/conf/schedule.json?day=2026-08-11", {}, TEST_ENV);
    const body = (await jsonRes.json()) as { items: Array<{ submissionId: string }>; total: number };
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub2"]);
    expect(body.total).toBe(1);
  });
});

// -- sessions: `day` IS honored (DEC-594/EMB-5), never advertised in the
// Show-more link (sessions has no day-scoped "show more" concept) ---------
// DEC-634: `day` is now a SQL-level predicate (innerJoin schedule_slot) on
// getVisibleSubmissionIdsOrdered/countVisibleSubmissions, not a post-page
// `.filter()` in the route — so, mirroring test/public-agenda-event-range
// .test.ts's convention, the fake below is built PER requested day and
// already reflects what the real SQL predicate would have returned (only
// sub1 is "scheduled" on 2026-08-10; every other day yields zero rows),
// rather than returning every row unconditionally and relying on a JS
// filter downstream.
function buildSessionsApp(day: string | null) {
  let selectCall = 0;
  const ALL_ROWS = Array.from({ length: 5 }, (_, i) => ({
    id: `sub${i + 1}`,
    seq: i + 1,
    title: `Talk ${i + 1}`,
    description: "A description long enough to show up in the card body.",
    icsSequence: 0,
  }));
  const matchingRows = day === null ? ALL_ROWS : day === "2026-08-10" ? ALL_ROWS.slice(0, 1) : [];
  const SLOT_ROWS =
    day === "2026-08-10" || day === null
      ? [{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomName: null }]
      : [];
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([]); // getPublicRooms (DEC-774)
      if (selectCall === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
      if (selectCall === 5) return makeChain(matchingRows); // hydrateSessions subRows
      if (selectCall === 6) return makeChain([]); // hydrateSessions trackRows
      if (selectCall === 7) return makeChain([]); // hydrateSessions speakerRows
      if (selectCall === 8) return makeChain(SLOT_ROWS); // hydrateSessions EMB-01 slotRows
      if (selectCall === 9) return makeChain([]); // hydrateSessions EMB-01/EMB-08 formatRows
      return makeChain([{ count: matchingRows.length }]); // countVisibleSubmissions (day-scoped)
    },
    selectDistinct: () => makeChain(matchingRows.map((s) => ({ id: s.id, title: s.title }))),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

describe("DEC-594/DEC-634 (EMB-5): sessions?day= filters by scheduled day, URL still doesn't advertise it", () => {
  it("sessions?day=<d> renders only the session scheduled on that day", async () => {
    installFakeCaches();
    const withDayApp = buildSessionsApp("2026-08-10");
    const withDay = await withDayApp.request("/embed/conf/sessions?day=2026-08-10", {}, TEST_ENV);
    const html = await withDay.text();
    expect(html).toContain('id="chq-session-sub1"');
    expect(html).not.toContain('id="chq-session-sub2"');
  });

  it("sessions?day=<unscheduled day> renders no sessions", async () => {
    installFakeCaches();
    const app = buildSessionsApp("2026-08-11");
    const res = await app.request("/embed/conf/sessions?day=2026-08-11", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain('id="chq-session-sub1"');
    expect(html).toContain("0 of 0 sessions");
  });

  it("sessions emits no day param in its Show-more link, even when one was supplied", async () => {
    installFakeCaches();
    const app = buildSessionsApp("2026-08-10");
    const res = await app.request("/embed/conf/sessions?day=2026-08-10&limit=1", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain('name="day"');
    expect(html).not.toContain("day=");
  });
});
