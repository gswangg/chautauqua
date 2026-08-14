// DEC-919: one filter idiom on every public list surface. Before this
// change /sessions rendered a GET search form + pill navs, /schedule
// rendered a GET form whose track/format axes were <select> dropdowns
// (narrowing needed a submit), and /speakers/gallery rendered a third,
// differently-labelled search form with no filter axes at all. Every
// surface now renders the shared PublicSearchBox/PublicFilterBar pair
// (src/routes/public/filters.tsx) and none writes its own copy.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";

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

const TWO_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-11", startMin: 540, endMin: 600, roomId: "room1" },
];
const TRACKS = [{ id: "trk-a", name: "Track A", color: null }];

function buildScheduleApp() {
  let selectCall = 0;
  const sessionRows = TWO_ROWS.map((r) => sessionRow(r.submissionId, `Talk ${r.submissionId}`));
  const db = {
    select: () => {
      selectCall += 1;
      // DEC-851 (wave 64 amendment): getPublicFormatOptions is no longer
      // called at all for agenda/schedule (format isn't an agenda facet).
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain(TRACKS); // getPublicTracks
      if (selectCall === 3) return makeChain([{ count: TWO_ROWS.length }]); // total
      if (selectCall === 4) return makeChain([{ id: "room1", name: "Alpha" }]); // roomRows
      if (selectCall === 5) return makeChain(sessionRows); // hydrateSessions subRows
      if (selectCall === 6) return makeChain([]); // trackRows
      if (selectCall === 7) return makeChain([]); // speakerRows
      if (selectCall === 8) return makeChain([]); // slotRows
      return makeChain([]); // formatRows
    },
    selectDistinct: () => makeChain(TWO_ROWS),
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

function buildSimpleApp(rowsBySelect: unknown[][]) {
  let selectCall = 0;
  const db = {
    select: () => {
      const rows = rowsBySelect[selectCall] ?? [];
      selectCall += 1;
      return makeChain(rows);
    },
    selectDistinct: () => makeChain([]),
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

// Extracts the exact `<form ...role="search">...</form>` block so the three
// surfaces' search-box markup can be compared byte-for-byte modulo the
// action/hidden-field attributes each surface is allowed to vary.
function searchForm(html: string): string {
  const m = html.match(/<form class="chq-pub-searchform"[^>]*role="search">[\s\S]*?<\/form>/);
  if (!m) throw new Error("no search form found in: " + html);
  return m[0];
}

describe("DEC-919: one filter idiom on every public surface", () => {
  it("sessions, schedule and speakers all emit the same compact-input search-box markup (DEC-919 wave 40 amendment: visually-hidden label/button, one placeholder)", async () => {
    installFakeCaches();
    const sessionsApp = buildSimpleApp([
      [EVENT_ROW], // getPublicEventBySlug
      [], // getPublicTracks
      [], // getPublicFormatOptions
      [{ id: "room1", name: "Alpha" }], // roomRows for filter chips
      [{ count: 0 }], // total
    ]);
    const sessionsRes = await sessionsApp.request("/e/conf/sessions", {}, TEST_ENV);
    const sessionsHtml = await sessionsRes.text();

    installFakeCaches();
    const scheduleRes = await buildScheduleApp().request("/e/conf/schedule", {}, TEST_ENV);
    const scheduleHtml = await scheduleRes.text();

    installFakeCaches();
    const speakersApp = buildSimpleApp([
      [EVENT_ROW], // getPublicEventBySlug
      [{ count: 0 }], // total
      [], // speaker rows
    ]);
    const speakersRes = await speakersApp.request("/e/conf/speakers", {}, TEST_ENV);
    const speakersHtml = await speakersRes.text();

    const sessionsForm = searchForm(sessionsHtml);
    const scheduleForm = searchForm(scheduleHtml);
    const speakersForm = searchForm(speakersHtml);

    // Same visually-hidden label, same compact input shape, same
    // visually-hidden button text, everywhere (DEC-919 wave 40 amendment).
    for (const form of [sessionsForm, scheduleForm, speakersForm]) {
      expect(form).toContain('<label class="chq-visually-hidden" for="chq-pub-search-q">Search</label>');
      expect(form).toContain('<input class="chq-pub-search" id="chq-pub-search-q" type="search" name="q"');
      expect(form).toContain('placeholder="Search"');
      expect(form).toContain('<button class="chq-visually-hidden" type="submit">Search</button>');
      // DEC-919: the old speakers-only "Search by name" label is gone.
      expect(form).not.toContain("Search by name");
    }
  });

  // DEC-851 (wave 64 amendment) supersedes this describe's original DEC-919
  // claim for /schedule specifically: track is a render-level HIGHLIGHT on
  // /agenda and /schedule now, never a pill-bar filter — the <select> half
  // of the old ItinerarySearchForm is back (a different control than the
  // pre-DEC-919 <select>, but a real select nonetheless), and no
  // .chq-pub-filter-bar/.chq-pub-pill renders for track on these two
  // surfaces at all.
  it("/e/:slug/schedule renders a track-highlight <select> with its active value selected (no pill-bar narrowing)", async () => {
    installFakeCaches();
    const res = await buildScheduleApp().request("/e/conf/schedule?trackId=trk-a", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain('class="chq-pub-filter-bar"');
    expect(html).not.toContain('class="chq-pub-pill"');
    expect(html).toContain('<select class="chq-pub-select" id="chq-pub-highlight-track" name="trackId"');
    expect(html).toContain('<option value="trk-a" selected="">Track A</option>');
  });

  it("picking a track on /schedule preserves ?day= and ?q= as hidden fields on the highlight form, and on the Clear link", async () => {
    installFakeCaches();
    const res = await buildScheduleApp().request("/e/conf/schedule?day=2026-08-10&q=keynote&trackId=trk-a", {}, TEST_ENV);
    const html = await res.text();
    const formMatch = html.match(/<form class="chq-pub-track-highlight"[^>]*>[\s\S]*?<\/form>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch![0]).toContain('<input type="hidden" name="day" value="2026-08-10"/>');
    expect(formMatch![0]).toContain('<input type="hidden" name="q" value="keynote"/>');
    expect(html).toContain('class="chq-pub-select-clear" href="/e/conf/schedule?day=2026-08-10&amp;q=keynote">Clear</a>');
  });
});

// v7 filter bar ("one idiom, four surfaces"): sessions renders every facet
// as a compact auto-submitting <select> beside the search box (no pill
// navs), and an active-filter line — count + removable chip + Clear — that
// exists ONLY when a filter is set.
describe("v7 sessions filter bar: selects + active-filter line", () => {
  // select() order on /sessions (ids queries use selectDistinct, which the
  // harness feeds [] — hydrate short-circuits): event, tracks, rooms,
  // formatOptions(optionsJson), filtered count, [grandTotal count when a
  // filter is active], dayCounts, cfpWindow.
  const SESSIONS_ROWS = (opts?: { withDayFilter?: boolean }) => {
    const rows: unknown[][] = [
      [EVENT_ROW], // getPublicEventBySlug
      [{ id: "trk-a", name: "Track A", color: null }], // getPublicTracks
      [{ id: "room1", name: "Alpha" }], // getPublicRooms
      [{ optionsJson: JSON.stringify(["Talk (30 min)"]) }], // getPublicFormatOptions
      [{ count: 1 }], // filtered total
    ];
    if (opts?.withDayFilter) rows.push([{ count: 2 }]); // grandTotal count
    rows.push([]); // dayCounts
    rows.push([]); // cfpWindow
    return rows;
  };

  it("renders day/track/format/room selects and NO pill navs on /sessions", async () => {
    installFakeCaches();
    const app = buildSimpleApp(SESSIONS_ROWS());
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    // Two-day event (EVENT_ROW spans 08-10..08-11) → the day facet renders.
    expect(html).toContain('name="day"');
    for (const name of ["trackId", "format", "roomId"]) {
      expect(html).toMatch(new RegExp(`<select class="chq-pub-select"[^>]*name="${name}"[^>]*onchange="this.form.submit\\(\\)"`));
    }
    expect(html).toContain("<option value=\"\">All days</option>");
    expect(html).toContain("<option value=\"\">All tracks</option>");
    // The pill-bar idiom is dead on sessions (v7).
    expect(html).not.toContain("chq-pub-filter-bar");
    // At rest the active-filter line spends nothing.
    expect(html).not.toContain('class="chq-pub-activefilters"');
  });

  it("renders the active-filter line (count, removable chip, Clear) when ?day= is set", async () => {
    installFakeCaches();
    const app = buildSimpleApp(SESSIONS_ROWS({ withDayFilter: true }));
    const res = await app.request("/e/conf/sessions?day=2026-08-10", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-activefilters"');
    expect(html).toContain("1 of 2 sessions");
    // The chip clears ONLY its own axis and the day select shows its value.
    expect(html).toMatch(/class="chq-pub-activefilters-chip" href="\/e\/conf\/sessions"/);
    expect(html).toContain('class="chq-pub-activefilters-clear"');
    expect(html).toMatch(/name="day"[\s\S]*?<option value="2026-08-10" selected/);
  });
});
