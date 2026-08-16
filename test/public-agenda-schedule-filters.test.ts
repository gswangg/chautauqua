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
import * as schema from "../src/db/schema";

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
    // NOTE (task w6-e, noUnusedLocals cleanup): the second where() call's
    // condition used to be captured here unread. It plausibly should also
    // be walked and asserted (the rows-query WHERE, mirroring the count
    // query's assertion below) -- not added here since inventing that
    // assertion is outside this task's scope. Flagged in the task report.
    let capturedCountWhere: unknown;
    let call = 0;
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (cond: unknown) => {
        call += 1;
        if (call === 1) capturedCountWhere = cond;
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
// DEC-774/DEC-851 (wave-55 amendment): dispatch.tsx's schedule case issues
// its reads as ONE Promise.all wave: [getPublicTracks,
// getPublicAgenda(query.day), getPublicBreaksByDay(query.day)] -- no
// getPublicScheduleDayCounts read at all, regardless of ?day=, since its
// only consumer (the dead `allDays` prop) was deleted. getPublicAgenda's
// own count(*) subquery (its first counted select) fires in the same
// synchronous burst as getPublicBreaksByDay's one-shot select, ahead of
// getPublicAgenda's rows query/room lookup/hydrateSessions cascade (which
// only resume one microtask later). See
// test/public-surface-round-trip-depth.test.ts for the behavioural proof.
function buildScheduleApp(rows: typeof FULL_AGENDA_ROWS, _withDay = false) {
  let selectCall = 0;
  const sessionRows = rows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      // DEC-851 (wave 64 amendment): getPublicFormatOptions is no longer
      // called at all for agenda/schedule (format isn't an agenda facet).
      if (selectCall === 2) return makeChain([]); // DEC-804 getPublicTracks (track-highlight <select>)
      if (selectCall === 3) return makeChain([{ count: rows.length }]); // DEC-548 total
      // getPublicBreaksByDay -- table-routed to [] regardless of the value
      // returned here (see makeChain's `.from(schema.scheduleBreak)` check
      // below), so whichever slot it lands in is harmless.
      if (selectCall === 4) return makeChain([]);
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

// DEC-022 amendment (wave 63): getPublicBreaksByDay's select is routed by
// .from(schema.scheduleBreak) rather than this harness's positional
// selectCall counters (see the sibling comment in test/public-embed-
// config.test.ts) -- always resolves an empty, harmless break set.
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

// task-w1-d (DEC-555 amendment, wave 1): /schedule was rebuilt to frame
// 10--12 -- no DaySwitcher, no ?trackId= highlight form, no time sub-header
// (those were dropped: none appear in the frame). The suite below now only
// proves the ONE thing that still holds post-rebuild: every candidate row
// still renders server-side (data-submission-id in the markup) regardless
// of ?trackId=, because filtering to the SAVED subset is a client-only
// concern (DEC-555 -- picks live in localStorage, never a query param).
describe("/e/:eventSlug/schedule?trackId= (task w1-d): every candidate row still renders server-side", () => {
  it("?trackId= never drops a candidate row from the markup", async () => {
    installFakeCaches();
    const unfiltered = await buildScheduleApp(FULL_AGENDA_ROWS).request("/e/conf/schedule", {}, TEST_ENV);
    const unfilteredHtml = await unfiltered.text();
    expect(unfilteredHtml).toContain('data-submission-id="sub1"');
    expect(unfilteredHtml).toContain('data-submission-id="sub2"');
    expect(unfilteredHtml).toContain('data-submission-id="sub3"');

    installFakeCaches();
    const highlighted = await buildScheduleApp(FULL_AGENDA_ROWS).request("/e/conf/schedule?trackId=trk-a", {}, TEST_ENV);
    const highlightedHtml = await highlighted.text();
    expect(highlightedHtml).toContain('data-submission-id="sub1"');
    expect(highlightedHtml).toContain('data-submission-id="sub2"');
    expect(highlightedHtml).toContain('data-submission-id="sub3"');
  });

  it("?day= still narrows on its own (getPublicAgenda's own predicate, unrelated to the client-side saved filter)", async () => {
    installFakeCaches();
    const app = buildScheduleApp(FILTERED_ROWS, true);
    const res = await app.request("/e/conf/schedule?day=2026-08-10&trackId=trk-a", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-submission-id="sub1"');
  });
});

describe("/schedule row control (task w1-d): a checked row is named Remove, never Save/Saved", () => {
  it("renders the .chq-itinerary-toggle checkbox wrapped in a Remove label", async () => {
    installFakeCaches();
    const app = buildScheduleApp(FULL_AGENDA_ROWS);
    const res = await app.request("/e/conf/schedule", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('class="chq-itinerary-toggle" value="sub1"');
    expect(html).toContain('<label class="chq-pub-schedule-remove">');
    expect(html).toContain("Remove");
  });
});

// DEC-804/DEC-851 (wave 64 amendment): /agenda and /schedule render the
// SAME search-and-track-highlight control. Built on a similar db.select()
// call sequence as buildScheduleApp above, but with real track rows at
// position 2 (getPublicTracks) and a `surface` switch so the same harness
// can mount either /agenda or /embed/.../agenda. getPublicFormatOptions is
// no longer called for these two surfaces at all. Only the "agenda" arm is
// exercised by this file's tests, so only that numbering is implemented.
//
// DEC-774 wave-34 amendment: dispatch.tsx's agenda case issues exactly TWO
// Promise.all waves -- wave 1 is [getPublicTracks,
// getPublicScheduleDayCounts] (both single-select, landing at slots 2/3);
// wave 2 is [getPublicAgenda(effectiveDay), getPublicBreaksByDay
// (effectiveDay)], concurrent, so getPublicAgenda's own count(*) subquery
// and getPublicBreaksByDay's one-shot select land in the same synchronous
// burst (slots 4/5), ahead of getPublicAgenda's rows query/room lookup/
// hydrateSessions cascade. See test/public-surface-round-trip-depth.test.ts
// for the behavioural proof.
function buildSurfaceApp(surface: "agenda" | "schedule", rows: typeof FULL_AGENDA_ROWS, tracks: { id: string; name: string; color: string | null }[]) {
  if (surface !== "agenda") throw new Error("buildSurfaceApp only implements the agenda numbering");
  let selectCall = 0;
  const sessionRows = rows.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain(tracks); // DEC-804 getPublicTracks
      if (selectCall === 3) return makeChain([]); // getPublicScheduleDayCounts
      if (selectCall === 4) return makeChain([{ count: rows.length }]); // DEC-548 total
      if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 6) return makeChain(rows.length > 0 ? [{ id: "room1", name: "Alpha" }, { id: "room2", name: "Beta" }] : []); // roomRows
      if (selectCall === 7) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 8) return makeChain([]); // trackRows
      if (selectCall === 9) return makeChain([]); // speakerRows
      if (selectCall === 10) return makeChain([]); // slotRows (unused by agenda grid)
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

describe("/agenda and /schedule render the DEC-851 (wave 64 amendment) search-and-highlight form", () => {
  it("/agenda's form carries the current q as a value and the current trackId as the select's selected option", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("agenda", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/e/conf/agenda?q=keynote&trackId=trk-a", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('<form class="chq-pub-searchform" method="get" action="/e/conf/agenda" role="search">');
    expect(html).toContain('<input class="chq-pub-search" id="chq-pub-search-q" type="search" name="q" value="keynote"');
    // DEC-851 (wave 64 amendment): track narrowing is a <select> now, not a
    // pill bar -- no filter pill for a track exists on this surface at all.
    expect(html).not.toContain('class="chq-pub-pill"');
    // DEC-851 amendment (wave 5): the control inverts dark (near-black fill,
    // cream text) once a track is set -- .chq-pub-select-active is the
    // second class carrying that, added alongside the base .chq-pub-select.
    expect(html).toContain('<select class="chq-pub-select chq-pub-select-active" id="chq-pub-highlight-track" name="trackId"');
    expect(html).toContain('<option value="trk-a" selected="">Track A</option>');
    // A Clear link appears beside the select once a track is active.
    expect(html).toContain('class="chq-pub-select-clear" href="/e/conf/agenda?q=keynote">Clear</a>');
    // format is not an agenda facet at all: no chip, no <select>, no param.
    expect(html).not.toContain('Format filters');
    expect(html).not.toContain('name="format"');
  });

  // task-w1-d (DEC-555 amendment): /schedule dropped this search-and-
  // highlight form entirely -- none of it appears in frame 10--12. See
  // test/public-agenda-geometry.test.ts's "does not render the dropped
  // day-pill row, picks-only checkbox or highlight control on /schedule".

  it("with no trackId active, the select has no Clear link and no option is selected", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("agenda", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/e/conf/agenda", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain('<a class="chq-pub-select-clear"');
    expect(html).toContain('<option value="trk-a">Track A</option>');
  });

  it("carries the active ?day= forward as a hidden input on /agenda, so filtering never jumps the reader off their day", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("agenda", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/e/conf/agenda?day=2026-08-10", {}, TEST_ENV);
    const html = await res.text();
    const formMatch = html.match(/<form class="chq-pub-searchform" method="get" action="\/e\/conf\/agenda" role="search">[\s\S]*?<\/form>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch![0]).toContain('<input type="hidden" name="day" value="2026-08-10"/>');
  });

  it("the embed variant's form action stays under /embed", async () => {
    installFakeCaches();
    const app = buildSurfaceApp("agenda", FULL_AGENDA_ROWS, TRACKS);
    const res = await app.request("/embed/conf/agenda", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('<form class="chq-pub-searchform" method="get" action="/embed/conf/agenda" role="search">');
    expect(html).not.toContain('action="/e/conf/agenda"');
  });
});
