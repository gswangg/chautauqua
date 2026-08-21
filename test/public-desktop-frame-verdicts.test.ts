// PUBLIC SSR — desktop (1600) per-frame render verdicts (task w24-h,
// DEC-613 wave-24 amendment). MEASUREMENT ONLY: this file fixes nothing,
// touches no route module and no `*.css.ts`, moves no desktop byte.
//
// HARNESS RULE (DEC-613 wave-24, cited via the DEC_613 registry constant
// below): the exact `vi.mock`-free `Hono<AppEnv>` + `publicRoutes` (and
// `publicSubmitRoutes` where needed) + `registerErrorHandler` +
// `CSRF_COOKIE_NAME` + `app.request(route)` shape
// `test/public-390-frame-verdicts.test.ts` already establishes for this
// surface — copied here unchanged, varying only path and fixture VALUES,
// per `test/public-agenda-rail.test.ts` / `test/submit-name-collapse.test.ts`
// / `test/public-feed-window.test.ts`'s own buildSessionsAppHtml (never a
// sixth mock stack).
//
// FRAMES — docs/design/Chautauqua Public and Portal.dc.html, six desktop
// (1600) frames, one it() per frame: :28 Sessions and agenda, :132 Agenda,
// :249 Agenda · a track highlighted, :680 Speakers · list view, :730
// Speakers · grid view, :779 My schedule · /e/:slug/schedule. :716 (a
// `{{ s.name }}` template interpolation) is excluded from the desktop
// population by test/desktop-frame-ledger.scan.test.ts and is never cited
// here. Each it() opens with a `verbatimLine(<line>, '<exact bytes>')`
// byte-equality receipt copied from public-390-frame-verdicts.test.ts's own
// idiom, dispatches a REAL request, and states MATCHES or DIVERGES in its
// own title with the divergence named — a DIVERGES verdict is a FINDING and
// the file stays GREEN.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { DEC_613, DEC_999 } from "../src/decisions";

// DEC-613 wave-24 amendment (src/decisions-data/part3.ts): "a desktop SSR
// verdict COPIES an existing buildApp harness verbatim -- a fifth mock
// stack is a second vocabulary, and an unreached frame is a more honest
// artefact than a bespoke one". void-referenced so the dependency is
// compile-checked (src/decisions.ts).
void DEC_613;
// DEC-999 (src/decisions-data/part4.ts): "A public agenda block is a
// content-sized box in its own lane; the day grid neither clips a block
// nor lets one lane overrun another" -- verdicted below against
// src/routes/public/css/agenda.css.ts's own stylesheet TEXT, since an SSR
// response carries no computed layout.
void DEC_999;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- a citation that cannot silently
 * rot to a wrong line the way a bare `:line` reference can. Copied from
 * test/public-390-frame-verdicts.test.ts's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// ---------------------------------------------------------------------------
// Shared harness plumbing (copied from test/public-390-frame-verdicts.test.ts
// / test/public-agenda-rail.test.ts / test/public-feed-window.test.ts --
// never a sixth reimplementation, DEC-613).
// ---------------------------------------------------------------------------

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
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

const TEST_ENV = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

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

function mountedApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// /e/conf/sessions -- frame :28 "Sessions and agenda · 1600" (mirrors
// test/public-feed-window.test.ts's buildSessionsAppHtml exactly: event,
// tracks, rooms, formatOptions, dayCounts, cfpWindow, then hydrateSessions'
// own subRows/trackRows/speakerRows/slotRows/formatRows, then the count
// query).
// ---------------------------------------------------------------------------

function buildSessionsApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (selectCall === 2) return makeChain([{ id: "track1", name: "AI Engineering", color: null }]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ id: "room1", name: "Main Hall" }]); // getPublicRooms
      if (selectCall === 4) return makeChain([]); // getPublicFormatOptions
      if (selectCall === 5) return makeChain([{ day: "2026-08-10", count: 2 }]); // getPublicScheduleDayCounts
      if (selectCall === 6) return makeChain([{ openDate: null, closeDate: new Date(Date.now() + 86400000) }]); // getPublicCfpWindow
      if (selectCall === 7) {
        return makeChain([
          { id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 },
          { id: "sub2", seq: 2, title: "Docs That Answer Back", description: null, icsSequence: 0 },
        ]); // hydrateSessions subRows
      }
      if (selectCall === 8) return makeChain([{ submissionId: "sub1", id: "track1", name: "AI Engineering", color: null }]); // trackRows
      if (selectCall === 9) {
        return makeChain([
          { submissionId: "sub1", order: 0, contactId: "c1", firstName: "Priya", lastName: "Raman", title: null, company: null, headshotUrl: null, bio: null },
        ]); // speakerRows
      }
      if (selectCall === 10) return makeChain([]); // slotRows
      if (selectCall === 11) return makeChain([]); // formatRows
      return makeChain([{ count: 2 }]); // countVisibleSubmissions
    },
    selectDistinct: () =>
      makeChain([
        { id: "sub1", title: "Taming 40-Minute CI" },
        { id: "sub2", title: "Docs That Answer Back" },
      ]),
  } as unknown as AppEnv["Variables"]["db"];
  return mountedApp(db);
}

// ---------------------------------------------------------------------------
// /e/conf/agenda -- frame :132 "Agenda · 1600" and frame :249 "Agenda · a
// track highlighted" (?trackId=track1). Mirrors test/public-agenda-rail
// .test.ts's buildApp: event, tracks, dayCounts, agenda-count, breaks, room
// lookup, hydrateSessions subRows/trackRows, then empty tail.
// ---------------------------------------------------------------------------

const SLOT_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 570, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-10", startMin: 600, endMin: 630, roomId: "room1" },
];

function buildAgendaApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([{ id: "track1", name: "AI Engineering", color: null }]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: SLOT_ROWS.length }]); // getPublicScheduleDayCounts
      if (selectCall === 4) return makeChain([{ count: SLOT_ROWS.length }]); // getPublicAgenda count(*)
      if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 6) return makeChain([{ id: "room1", name: "Main Hall", position: 1 }]); // room lookup
      if (selectCall === 7) {
        return makeChain([
          { id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 },
          { id: "sub2", seq: 2, title: "Docs That Answer Back", description: null, icsSequence: 0 },
        ]); // hydrateSessions subRows
      }
      // trackRows -- ties sub1 to track1 so a highlight (frame :249) has a
      // real block to select (TrackHighlightRailSection's own filter
      // predicate, AgendaDayGrid's highlight/muted styling).
      if (selectCall === 8) return makeChain([{ submissionId: "sub1", id: "track1", name: "AI Engineering", color: null }]);
      return makeChain([]); // speakerRows/slotRows/formatRows
    },
    selectDistinct: () => makeChain(SLOT_ROWS),
  } as unknown as AppEnv["Variables"]["db"];
  return mountedApp(db);
}

// ---------------------------------------------------------------------------
// /e/conf/speakers (list, frame :680) and /e/conf/gallery (grid, frame
// :730) -- mirrors test/public-filter-idiom.test.ts's select ordering:
// event, tracks, count(total), speaker rows (getPublicSpeakers' own
// selectDistinct id-query, uncounted, feeds the rows query below it).
// ---------------------------------------------------------------------------

function buildSpeakerSurfaceApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([{ id: "track1", name: "AI Engineering", color: null }]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ total: 2 }]); // getPublicSpeakers count
      return makeChain([
        {
          contactId: "c1",
          firstName: "Priya",
          lastName: "Raman",
          title: "Staff Engineer",
          company: "Latticework Systems",
          headshotUrl: null,
          bio: null,
          submissionId: "sub1",
          submissionTitle: "Taming 40-Minute CI",
        },
        {
          contactId: "c2",
          firstName: "Jordan",
          lastName: "Lee",
          title: "Principal Engineer",
          company: "Overflow Labs",
          headshotUrl: null,
          bio: null,
          submissionId: "sub2",
          submissionTitle: "Docs That Answer Back",
        },
      ]); // getPublicSpeakers rows
    },
    selectDistinct: () => makeChain([{ contactId: "c1" }, { contactId: "c2" }]),
  } as unknown as AppEnv["Variables"]["db"];
  return mountedApp(db);
}

// ---------------------------------------------------------------------------
// /e/conf/schedule -- frame :779 "My schedule · /e/:slug/schedule". Mirrors
// test/public-390-frame-verdicts.test.ts's buildScheduleApp exactly (same
// route, same markup as the 390 frame -- SSR emits identical classes for
// both widths, agenda.css.ts's media query is the only thing that varies).
// ---------------------------------------------------------------------------

function buildScheduleApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ count: 1 }]); // getPublicAgenda count(*)
      if (selectCall === 4) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 5) return makeChain([{ id: "room1", name: "Main Hall" }]); // room lookup
      if (selectCall === 6) {
        return makeChain([{ id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 }]);
      }
      return makeChain([]);
    },
    selectDistinct: () =>
      makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }]),
  } as unknown as AppEnv["Variables"]["db"];
  return mountedApp(db);
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

describe("PUBLIC SSR desktop (1600) frame render verdicts (task w24-h, DEC-613 wave-24 amendment)", () => {
  it("frame :28 Sessions and agenda · 1600 -- DIVERGES (blessed, DEC-593): the nav drops Gallery as a fifth item (a view switch is not a nav destination); everything else -- per-session rows with Save/Saved action, Your schedule / day-index / Call for papers rail -- MATCHES", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:28
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Sessions and agenda · 1600</span>`
    verbatimLine(28, `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Sessions and agenda · 1600</span>`);
    installFakeCaches();
    const res = await buildSessionsApp().request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :39-43 frame's nav: Sessions/Speakers/Agenda/My schedule/Gallery,
    // Sessions marked current. The tree's nav (shell.tsx's NAV_SURFACES,
    // DEC-593 amendment superseding DEC-990's wave-53 nav clause) drops
    // Gallery deliberately -- "a photo-led twin is not a nav destination";
    // it stays reachable only through the /speakers List/Grid toggle
    // (frame :102-108, verdicted separately below). A real, previously-
    // ruled divergence, filed here rather than silently matched.
    expect(html).toContain('class="chq-nav"');
    for (const label of ["Sessions", "Speakers", "Agenda", "My schedule"]) {
      expect(html).toContain(`>${label}</a>`);
    }
    expect(html).not.toContain(">Gallery</a>");
    const sessionsLinkMatch = html.match(/<a href="\/e\/conf\/sessions"[^>]*>Sessions<\/a>/);
    expect(sessionsLinkMatch).toBeTruthy();
    expect(sessionsLinkMatch![0]).toContain('aria-current="page"');

    // :51 search box placeholder -- the sessions-specific literal (DEC-808
    // wave-128 amendment).
    expect(html).toContain('placeholder="Search sessions or speakers…"');

    // :62-70 per-session row: time+room gutter, title/speaker/track+format,
    // Save/Saved action.
    expect(html).toContain('class="chq-pub-session-row"');
    expect(html).toContain("Taming 40-Minute CI");
    expect(html).toContain('class="chq-pub-session-speaker"');
    expect(html).toContain('class="chq-itinerary-toggle"');
    expect(html).toMatch(/>Save<|>Saved</);

    // :50 "Your schedule" rail, :63 day index, :72 "Call for papers".
    expect(html).toContain(">Your schedule</h2>");
    expect(html).toContain('id="chq-ics-link"');
    expect(html).toContain(">Call for papers</h2>");
    expect(html).toContain(">Submit a talk ›</a>");
  });

  it("frame :132 Agenda · 1600 -- MATCHES: day header + Tue/Wed/Thu switcher, time-anchored block grid, Rooms-in-use + Print rail (DEC-999 block anatomy verdicted against agenda.css.ts's own text)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:132
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Agenda · 1600</span>`
    verbatimLine(132, `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Agenda · 1600</span>`);
    installFakeCaches();
    const res = await buildAgendaApp().request("/e/conf/agenda", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :157-161 day header (h1 + count) and the Tue/Wed/Thu day switcher.
    expect(html).toContain('class="chq-pub-surface-title"');
    const dayLinks = [...html.matchAll(/<a href="\/e\/conf\/agenda\?day=[^"]+"/g)];
    expect(dayLinks.length).toBeGreaterThanOrEqual(1);

    // :167-190 the day's time-anchored block grid.
    expect(html).toContain('class="chq-pub-agenda-day-blocks"');
    expect(html).toContain('class="chq-pub-agenda-block"');
    expect(html).toContain("Taming 40-Minute CI");

    // :217 "Rooms in use today" rail, :232 "Print" rail.
    expect(html).toContain("Rooms in use today");
    expect(html).toContain(">Printable programme ›</a>");

    // DEC-999: "a block is a content-sized card ... NO overflow clipping"
    // -- verdicted against src/routes/public/css/agenda.css.ts's own
    // stylesheet TEXT, since jsdom applies no stylesheet and an SSR
    // response carries no computed layout.
    const { AGENDA_CSS } = await import("../src/routes/public/css/agenda.css");
    const blockRuleStart = AGENDA_CSS.indexOf(".chq-pub-agenda-block {");
    expect(blockRuleStart).toBeGreaterThan(-1);
    const blockRule = AGENDA_CSS.slice(blockRuleStart, AGENDA_CSS.indexOf("\n  }", blockRuleStart));
    expect(blockRule).toContain("display: flex");
    expect(blockRule).toContain("flex-direction: column");
    expect(blockRule).not.toContain("overflow");
    expect(blockRule).not.toContain("-webkit-line-clamp");
  });

  it("frame :249 Agenda · a track highlighted -- MATCHES: track-highlight select carries the active track name, Clear link, and the room rail narrows to the highlighted track's own count heading", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:249
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Agenda · a track highlighted</span>`
    verbatimLine(249, `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Agenda · a track highlighted</span>`);
    installFakeCaches();
    const res = await buildAgendaApp().request("/e/conf/agenda?trackId=track1", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :198 highlight is render-level only (DEC-851): the select carries the
    // active track's NAME as its resolved value, and a Clear link appears
    // (frame :199 `Clear`) that this route renders as an escape-hatch out
    // of the highlight state.
    expect(html).toContain('id="chq-pub-highlight-track"');
    expect(html).toMatch(/<option value="track1"[^>]*selected[^>]*>AI Engineering<\/option>/);
    expect(html).toContain(">Clear</a>");

    // :268 "2 in AI Engineering" rail heading -- the rail's own count
    // narrows to the highlighted track (TrackHighlightRailSection), unlike
    // :132's un-highlighted "Rooms in use today".
    expect(html).toContain("in AI Engineering</h2>");
    expect(html).not.toContain("Rooms in use today");

    // :190 highlighted block cards still render as content-sized boxes
    // (DEC-999) -- same .chq-pub-agenda-block class the un-highlighted
    // frame draws, never a second geometry for the highlighted state.
    expect(html).toContain('class="chq-pub-agenda-block');
  });

  it("frame :680 Speakers · list view -- MATCHES: List/Grid toggle with List active, per-speaker rows carrying headshot/name/role and their session titles", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:680
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Speakers · list view</span>`
    verbatimLine(680, `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Speakers · list view</span>`);
    installFakeCaches();
    const res = await buildSpeakerSurfaceApp().request("/e/conf/speakers", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :99-101 h1 + count.
    expect(html).toContain('class="chq-pub-surface-title"');
    // :102-108 List/Grid segmented toggle, List active.
    expect(html).toContain('aria-label="Speaker view"');
    const listOption = html.match(/<a class="chq-pub-view-toggle-option"[^>]*href="[^"]*\/speakers[^"]*"[^>]*>\s*List\s*<\/a>/);
    expect(listOption).toBeTruthy();
    expect(listOption![0]).toContain('aria-current="page"');

    // :715-720 per-speaker row: headshot + name/role + this settled build's
    // real search placeholder (a Cut-2 eval item, closed) -- reads
    // "Search speakers…" at BOTH call sites, per this task's own prior-fix
    // note.
    expect(html).toContain('placeholder="Search speakers…"');
    expect(html).toContain('class="chq-pub-speaker-list-row"');
    expect(html).toContain('class="chq-pub-speaker-list-photo"');
    expect(html).toContain("Priya Raman");
    expect(html).toContain("Staff Engineer, Latticework Systems");
    expect(html).toContain('class="chq-pub-speaker-sessions"');
    expect(html).toContain("Taming 40-Minute CI");
  });

  it("frame :730 Speakers · grid view -- MATCHES: List/Grid toggle with Grid active, photo-led tiles carrying name + company only (no session list, no role)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:730
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Speakers · grid view</span>`
    verbatimLine(730, `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Speakers · grid view</span>`);
    installFakeCaches();
    const res = await buildSpeakerSurfaceApp().request("/e/conf/gallery", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('placeholder="Search speakers…"');
    const gridOption = html.match(/<a class="chq-pub-view-toggle-option"[^>]*href="[^"]*\/gallery[^"]*"[^>]*>\s*Grid\s*<\/a>/);
    expect(gridOption).toBeTruthy();
    expect(gridOption![0]).toContain('aria-current="page"');

    // :761-766 photo-led tile -- name + company ALONE (G13 frame :10--11:
    // the grid tile drops role, unlike the list row above), no session
    // list on the tile (DEC-990 amendment).
    expect(html).toContain('class="chq-pub-speaker-card"');
    expect(html).toContain("Priya Raman");
    expect(html).toContain(">Latticework Systems</p>");
    expect(html).not.toContain('class="chq-pub-speaker-sessions"');
  });

  it("frame :779 My schedule · /e/:slug/schedule -- MATCHES structurally (DIVERGES on the sample byte, same as the 390 twin): h1 + subtitle placeholder, per-row Remove action, Take-it-with-you rail, Download .ics / All sessions dock", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:779
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">My schedule · /e/:slug/schedule</span>`
    verbatimLine(779, `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">My schedule · /e/:slug/schedule</span>`);
    installFakeCaches();
    const res = await buildScheduleApp().request("/e/conf/schedule", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("<h1");
    expect(html).toContain(">My schedule</h1>");
    // :783 draws the SAMPLE state "4 saved · 2 overlaps" -- the SSR
    // response is pre-hydration and renders the JS-fillable placeholder
    // "0 saved · 0 overlaps" instead, the SAME real, honest divergence
    // test/public-390-frame-verdicts.test.ts already files for the 390
    // twin of this exact route (agenda-itinerary-script.tsx's updateLink
    // fills the real counts client-side once localStorage is read) -- not
    // a structural divergence, since the desktop and 390 frames are the
    // SAME markup rendered by the SAME route, only agenda.css.ts's media
    // query differs.
    expect(html).toContain('id="chq-schedule-subtitle"');
    const subtitle = html.split('id="chq-schedule-subtitle"')[1]?.split("</span>")[0] ?? "";
    expect(subtitle).toContain("0 saved · 0 overlaps");

    // :796-805 per-row Remove action (never Save/Saved on this surface).
    expect(html).toContain('class="chq-pub-schedule-row"');
    expect(html).toContain('class="chq-pub-schedule-remove"');
    expect(html).toContain("Taming 40-Minute CI");

    // :811 "Take it with you" rail (desktop-only aside — the 390 frame has
    // no room for it and relies on the dock band alone).
    expect(html).toContain(">Take it with you</h2>");

    // :919-921 dock band -- Download .ics (filled) + All sessions
    // (bordered).
    expect(html).toContain('class="chq-pub-schedule-dock"');
    const dockIcsMatch = html.match(/<a id="chq-ics-link-dock"[^>]*>([^<]*)<\/a>/);
    expect(dockIcsMatch).toBeTruthy();
    expect(dockIcsMatch![1]!.trim()).toBe("Download .ics");
    expect(html).toContain('class="chq-pub-schedule-dock-cross"');
    expect(html).toContain(">All sessions</a>");
  });
});
