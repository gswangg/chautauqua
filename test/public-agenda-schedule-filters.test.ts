// DEC-783: /agenda and /schedule honour ?q= and ?trackId= as SQL-level
// predicates on getPublicAgenda (never a post-fetch JS filter — `items` and
// `total` must see the identical predicate, or the "Showing the first N of
// M" line lies), composed with ?day=, and DaySwitcher's out-links preserve
// the active q/trackId across a day jump. Also covers the per-row Save/Saved
// state span (replacing the old static "Add to itinerary" label) and the
// /schedule time sub-header that groups rows sharing a start minute.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { getPublicAgenda } from "../src/server/repo/public";
import type { PublicEvent } from "../src/server/repo/public";
import type { Db } from "../src/server/context";

const EVENT: PublicEvent = {
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

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 10 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

describe("getPublicAgenda (DEC-783): q/trackId are SQL predicates, not a post-fetch filter", () => {
  it("threads trackId into the count query's WHERE (via the submissionTrack join)", async () => {
    let capturedCountWhere: unknown;
    let capturedRowsWhere: unknown;
    let call = 0;
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (cond: unknown) => {
        call += 1;
        if (call === 1) capturedCountWhere = cond;
        else capturedRowsWhere = cond;
        return chain;
      },
      orderBy: () => chain,
      as: () => chain,
      limit: async () => [],
      then: (resolve: (v: unknown[]) => void) => resolve([]),
    };
    const db = {
      selectDistinct: () => chain,
      select: () => ({ from: () => ({ then: (r: (v: unknown[]) => void) => r([{ count: 0 }]) }) }),
    } as unknown as Db;

    await getPublicAgenda(db, EVENT, { trackId: "trk-a" });

    const tokens = walkCondition(capturedCountWhere);
    expect(tokens).toContain("col:track_id");
    expect(tokens).toContain(`val:${JSON.stringify("trk-a")}`);
  });

  it("threads q into the WHERE as a title/name LIKE condition", async () => {
    let capturedWhere: unknown;
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (cond: unknown) => {
        capturedWhere = capturedWhere ?? cond;
        return chain;
      },
      orderBy: () => chain,
      as: () => chain,
      limit: async () => [],
      then: (resolve: (v: unknown[]) => void) => resolve([]),
    };
    const db = {
      selectDistinct: () => chain,
      select: () => ({ from: () => ({ then: (r: (v: unknown[]) => void) => r([{ count: 0 }]) }) }),
    } as unknown as Db;

    await getPublicAgenda(db, EVENT, { q: "keynote" });

    const tokens = walkCondition(capturedWhere);
    expect(tokens).toContain("col:title");
  });
});

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

// Two sessions on day A ("2026-08-10") sharing a start time (grouped by the
// time sub-header) plus a third on day B. FULL_AGENDA_ROWS represents what
// getPublicAgenda would return with NO filter; FILTERED_ROWS is what it
// would return once the real SQL trackId/q predicate has already scoped the
// join at the source (same division of labor as public-day-filter.test.ts:
// the fake mirrors the predicate having already run, it does not re-
// implement SQL LIKE/eq matching itself).
const FULL_AGENDA_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-10", startMin: 540, endMin: 570, roomId: "room2" },
  { submissionId: "sub3", day: "2026-08-10", startMin: 660, endMin: 720, roomId: "room1" },
];
const FILTERED_ROWS = FULL_AGENDA_ROWS.filter((r) => r.submissionId === "sub1");

function sessionRow(id: string, title: string) {
  return { id, seq: 1, title, description: "A description.", icsSequence: 0 };
}

// Mirrors test/public-embed-config.test.ts's buildAgendaApp harness (same
// getPublicAgenda call sequence: selectDistinct() for the count subquery,
// select() for count(*), selectDistinct() for the windowed scan, select()
// for roomRows, then hydrateSessions' four select() calls) but pre-scoped as
// if the SQL trackId/q/day predicate has already run — proving the ROUTE
// wiring (items + total from the SAME set) is correct once the predicate has
// done its job.
function buildScheduleApp(rows: typeof FULL_AGENDA_ROWS) {
  let selectCall = 0;
  const sessionRows = rows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // DEC-804 getPublicTracks (search form's track <select>)
      if (selectCall === 3) return makeChain([]); // DEC-851 getPublicFormatOptions (search form's format <select>)
      if (selectCall === 4) return makeChain([{ count: rows.length }]); // DEC-548 total
      if (selectCall === 5) return makeChain(rows.length > 0 ? [{ id: "room1", name: "Alpha" }, { id: "room2", name: "Beta" }] : []); // roomRows
      if (selectCall === 6) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 7) return makeChain([]); // trackRows
      if (selectCall === 8) return makeChain([]); // speakerRows
      if (selectCall === 9) return makeChain([]); // slotRows (unused by agenda grid)
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

describe("/e/:eventSlug/schedule?trackId= (DEC-783)", () => {
  it("a filtered request shrinks BOTH the rendered row set and `total` together", async () => {
    installFakeCaches();
    const unfiltered = await buildScheduleApp(FULL_AGENDA_ROWS).request("/e/conf/schedule", {}, TEST_ENV);
    const unfilteredHtml = await unfiltered.text();
    expect(unfilteredHtml).toContain("chq-agenda-list-sub1");
    expect(unfilteredHtml).toContain("chq-agenda-list-sub2");
    expect(unfilteredHtml).toContain("chq-agenda-list-sub3");

    installFakeCaches();
    const filtered = await buildScheduleApp(FILTERED_ROWS).request("/e/conf/schedule?trackId=trk-a", {}, TEST_ENV);
    const filteredHtml = await filtered.text();
    expect(filteredHtml).toContain("chq-agenda-list-sub1");
    expect(filteredHtml).not.toContain("chq-agenda-list-sub2");
    expect(filteredHtml).not.toContain("chq-agenda-list-sub3");
    // A row set of 1 (below FULL_AGENDA_ROWS.length) never trips the
    // "Showing the first N of M" line into disagreement — total mirrors the
    // SAME filtered set, not the unfiltered count.
    expect(filteredHtml).not.toContain("Showing the first");
  });

  it("composes ?day= with ?trackId= (both narrow together)", async () => {
    installFakeCaches();
    const app = buildScheduleApp(FILTERED_ROWS);
    const res = await app.request("/e/conf/schedule?day=2026-08-10&trackId=trk-a", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("chq-agenda-list-sub1");
    expect(html).not.toContain("chq-agenda-list-sub2");
  });

  it("DaySwitcher out-links preserve the active trackId/q across a day jump", async () => {
    installFakeCaches();
    // Only day A is rendered (activeDay filter applied); getPublicScheduleDayCounts
    // (allDays) reports both days, so the switcher must render an out-link
    // for day B that is NOT dropped from the a11y tree.
    let selectCall = 0;
    const sessionRows = FILTERED_ROWS.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
    const db = {
      select: () => {
        selectCall += 1;
        if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
        if (selectCall === 2) return makeChain([]); // DEC-804 getPublicTracks
        if (selectCall === 3) return makeChain([]); // DEC-851 getPublicFormatOptions
        if (selectCall === 4) return makeChain([{ count: FILTERED_ROWS.length }]); // DEC-548 total
        if (selectCall === 5) return makeChain([{ id: "room1", name: "Alpha" }]); // roomRows
        if (selectCall === 6) return makeChain(sessionRows); // hydrateSessions subRows
        if (selectCall === 7) return makeChain([]); // trackRows
        if (selectCall === 8) return makeChain([]); // speakerRows
        if (selectCall === 9) return makeChain([]); // slotRows
        if (selectCall === 10) return makeChain([]); // formatRows
        // getPublicScheduleDayCounts (allDays, since ?day= was passed)
        return makeChain([
          { day: "2026-08-10", count: 1 },
          { day: "2026-08-11", count: 1 },
        ]);
      },
      selectDistinct: () => makeChain(FILTERED_ROWS),
    } as unknown as AppEnv["Variables"]["db"];

    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", publicRoutes);

    const res = await app.request("/e/conf/schedule?day=2026-08-10&trackId=trk-a&q=keynote", {}, TEST_ENV);
    const html = await res.text();
    // day B isn't rendered on this page, so its pill must be an out-link
    // carrying the SAME trackId/q forward, not a bare ?day= href.
    expect(html).toContain('href="/e/conf/schedule?day=2026-08-11&amp;trackId=trk-a&amp;q=keynote"');
  });

  it("DEC-835: on the unfiltered default view, every day pill still carries a real ?day= href (never a bare #chq-day-<day> anchor)", async () => {
    installFakeCaches();
    // Two days, both rendered on this unfiltered page.
    const twoDayRows = [
      ...FULL_AGENDA_ROWS,
      { submissionId: "sub4", day: "2026-08-11", startMin: 540, endMin: 600, roomId: "room1" },
    ];
    const app = buildScheduleApp(twoDayRows);
    const res = await app.request("/e/conf/schedule", {}, TEST_ENV);
    const html = await res.text();
    const pillHrefs = [...html.matchAll(/class="chq-pub-day-pill[^"]*" href="([^"]*)"/g)].map((m) => m[1]!);
    expect(pillHrefs.length).toBe(2);
    for (const href of pillHrefs) {
      expect(href.startsWith("#")).toBe(false);
      expect(href).toMatch(/^\/e\/conf\/schedule\?day=2026-08-1[01]#chq-day-2026-08-1[01]$/);
    }
    // the #chq-day-<day> section ids are still present for in-page anchoring
    expect(html).toContain('id="chq-day-2026-08-10"');
    expect(html).toContain('id="chq-day-2026-08-11"');
  });
});

describe("/schedule row control (DEC-783): a checked row names its state", () => {
  it("renders the DEC-683 Save/Saved span pair, not a static 'Add to itinerary' label", async () => {
    installFakeCaches();
    const app = buildScheduleApp(FULL_AGENDA_ROWS);
    const res = await app.request("/e/conf/schedule", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-save-off"');
    expect(html).toContain('class="chq-pub-save-on"');
    expect(html).toContain("Saved");
    expect(html).not.toContain("Add to itinerary");
  });
});

describe("/schedule groups rows sharing a start time under a time sub-header (DEC-783)", () => {
  it("inserts one sub-header for the two sessions starting at 540 and none extra for the lone 660 session", async () => {
    installFakeCaches();
    const app = buildScheduleApp(FULL_AGENDA_ROWS);
    const res = await app.request("/e/conf/schedule", {}, TEST_ENV);
    const html = await res.text();
    const subheadCount = (html.match(/chq-pub-schedule-time-subhead/g) ?? []).length;
    // Two distinct start-time groups (540, 660) -> exactly two sub-headers,
    // even though 540 has two rows sharing it.
    expect(subheadCount).toBe(2);
    // The sub-header renders formatMinutes' label for the shared start.
    expect(html).toContain("9:00 AM");
  });
});

// DEC-804: /agenda and /schedule render the SAME search-and-track control
// the sessions list already answers via ?q=/?trackId= (DEC-783 made both
// real server-side predicates here). Built on the SAME db.select() call
// sequence as buildScheduleApp above, but with real track rows at position
// 2 (getPublicTracks) and a `surface` switch so the same harness can mount
// either /agenda or /embed/.../agenda.
function buildSurfaceApp(
  surface: "agenda" | "schedule",
  rows: typeof FULL_AGENDA_ROWS,
  tracks: { id: string; name: string; color: string | null }[],
  formatOptionsRow: { optionsJson: string | null }[] = [],
) {
  let selectCall = 0;
  const sessionRows = rows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain(tracks); // DEC-804 getPublicTracks
      if (selectCall === 3) return makeChain(formatOptionsRow); // DEC-851 getPublicFormatOptions
      if (selectCall === 4) return makeChain([{ count: rows.length }]); // DEC-548 total
      if (selectCall === 5) return makeChain(rows.length > 0 ? [{ id: "room1", name: "Alpha" }, { id: "room2", name: "Beta" }] : []); // roomRows
      if (selectCall === 6) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 7) return makeChain([]); // trackRows
      if (selectCall === 8) return makeChain([]); // speakerRows
      if (selectCall === 9) return makeChain([]); // slotRows (unused by agenda grid)
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

const TRACKS = [{ id: "trk-a", name: "Track A", color: null }];

describe("/agenda and /schedule render the DEC-804 search-and-track form", () => {
  it("/agenda's form carries the current q/trackId as values", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("agenda", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/e/conf/agenda?q=keynote&trackId=trk-a", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('<form method="get" action="/e/conf/agenda" role="search">');
    expect(html).toContain('<input type="search" name="q" value="keynote"');
    // DEC-919: track narrowing is the shared pill-bar idiom, not a <select>.
    expect(html).toContain('class="chq-pub-pill" href="/e/conf/agenda?trackId=trk-a&amp;q=keynote" aria-current="true">Track A</a>');
    // DEC-851: no format options configured for this event -> no format
    // pill bar renders (never a control the server has nothing to offer).
    expect(html).not.toContain('Format filters');
  });

  it("/schedule's form carries the current q/trackId as values", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("schedule", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/e/conf/schedule?q=keynote&trackId=trk-a", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('<form method="get" action="/e/conf/schedule" role="search">');
    expect(html).toContain('<input type="search" name="q" value="keynote"');
    // DEC-919: track narrowing is the shared pill-bar idiom, not a <select>.
    expect(html).toContain('class="chq-pub-pill" href="/e/conf/schedule?trackId=trk-a&amp;q=keynote" aria-current="true">Track A</a>');
    expect(html).not.toContain('Format filters');
  });

  it("carries the active ?day= forward as a hidden input, so filtering never jumps the reader off their day", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("schedule", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/e/conf/schedule?day=2026-08-10", {}, TEST_ENV);
    const html = await res.text();
    const formMatch = html.match(/<form method="get" action="\/e\/conf\/schedule" role="search">[\s\S]*?<\/form>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch![0]).toContain('<input type="hidden" name="day" value="2026-08-10"/>');
  });

  it("the embed variant's form action stays under /embed", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("agenda", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/embed/conf/agenda", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('<form method="get" action="/embed/conf/agenda" role="search">');
    expect(html).not.toContain('action="/e/conf/agenda"');
  });
});
