// DEC-851 / DEC-489 (wave-12 amendment): one filter contract for the public
// agenda/schedule surfaces — the HTML page (dispatch.tsx, NORMATIVE) and its
// .json/.xml twins must all read the same enumerated knob set:
// ['trackId','day','q','accent'] (no format, no roomId, no limit, no
// fields).
//
// DEC-851's wave-64 amendment narrowed the ROW-SET half of that claim for the
// two itinerary surfaces: /agenda and /schedule HIGHLIGHT by track and
// ignore ?format= entirely on the HTML page. DEC-489's wave-12 amendment
// found the .json/.xml twins had drifted from that same HTML page (still
// applying trackId/format as SQL-level predicates it never threads) and
// re-declared the twins to match the HTML page exactly, since the HTML
// reader is normative: trackId is a highlight (never filters `items`/
// `total`), and `format` isn't an agenda facet on either reader.
//
// DEC-768's wave-67 amendment further narrows the /agenda HTML page's own
// default: it now renders ONE day at a time (the first day with scheduled
// sessions), while its .json/.xml twins are unchanged and still answer for
// the WHOLE event unless ?day= is given. So the generic "HTML row count ==
// .json total" parity claim below no longer holds for /agenda at its
// no-day-given default (`qs: ""` and `qs: "?q=talk"`) — those two cases are
// asserted separately, against the day-scoped expectation, with the feed's
// whole-event `total` kept as a contrasting figure rather than deleted.
// Every other case (`?day=`, which already pinned a single day pre-
// amendment, and every `sessions`/`schedule` case) is untouched.
//
// Repo functions (getPublicSessions/getPublicAgenda) are mocked here to a
// deterministic in-memory filter — the SQL-level predicate itself is
// already covered by test/public-format.test.ts, test/public-day-filter.
// test.ts and test/public-agenda-schedule-filters.test.ts. This file's job
// is the WIRING: does every route that claims to answer the same query
// actually pass the same knobs down to the repo call.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
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

const TRACK_A = { id: "trk-a", name: "Track A", color: null };
const TRACK_B = { id: "trk-b", name: "Track B", color: null };

// A raw fixture describing each row's trackId/format/day/title, filtered
// in-memory the same way the real SQL predicate would filter it.
const RAW_SESSIONS = [
  { id: "s1", trackId: "trk-a", format: "talk", day: "2026-08-10", title: "Keynote Alpha" },
  { id: "s2", trackId: "trk-b", format: "workshop", day: "2026-08-10", title: "Session Beta" },
  { id: "s3", trackId: "trk-a", format: "workshop", day: "2026-08-11", title: "Gamma Talk" },
];

// vi.mock's factory is hoisted above these consts, so the mocks referenced
// inside it must be created via vi.hoisted (mirrors vitest's documented
// pattern for a mock whose calls need inspecting after the fact).
const { getPublicSessionsMock, getPublicAgendaMock } = vi.hoisted(() => {
  const RAW = [
    { id: "s1", trackId: "trk-a", format: "talk", day: "2026-08-10", title: "Keynote Alpha" },
    { id: "s2", trackId: "trk-b", format: "workshop", day: "2026-08-10", title: "Session Beta" },
    { id: "s3", trackId: "trk-a", format: "workshop", day: "2026-08-11", title: "Gamma Talk" },
  ];
  function filterRawInner(opts: { trackId?: string | null; format?: string | null; day?: string | null; q?: string | null }) {
    return RAW.filter((r) => {
      if (opts.trackId && r.trackId !== opts.trackId) return false;
      if (opts.format && r.format !== opts.format) return false;
      if (opts.day && r.day !== opts.day) return false;
      if (opts.q && !r.title.toLowerCase().includes(opts.q.toLowerCase())) return false;
      return true;
    });
  }
  return {
    getPublicSessionsMock: vi.fn(
      async (
        _db: unknown,
        _event: unknown,
        opts: { trackId?: string | null; format?: string | null; day?: string | null; q?: string | null },
      ) => {
        const items = filterRawInner(opts).map((r) => ({
          id: r.id,
          ref: `SES-${r.id}`,
          title: r.title,
          description: null,
          icsSequence: 0,
          tracks: [{ id: r.trackId, name: r.trackId, color: null }],
          speakers: [],
          day: r.day,
          startMin: 540,
          endMin: 600,
          roomName: null,
          format: r.format,
        }));
        return { items, total: items.length };
      },
    ),
    getPublicAgendaMock: vi.fn(
      async (
        _db: unknown,
        _event: unknown,
        params?: { trackId?: string | null; format?: string | null; day?: string | null; q?: string | null },
      ) => {
        const items = filterRawInner(params ?? {}).map((r) => ({
          submissionId: r.id,
          ref: `SES-${r.id}`,
          title: r.title,
          description: null,
          day: r.day,
          startMin: 540,
          endMin: 600,
          roomId: "room1",
          roomName: "Room A",
          roomPosition: 1,
          icsSequence: 0,
          tracks: [{ id: r.trackId, name: r.trackId, color: null }],
          speakers: [],
          format: r.format,
        }));
        return { items, total: items.length };
      },
    ),
  };
});

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicSessions: getPublicSessionsMock,
    getPublicAgenda: getPublicAgendaMock,
    getPublicAgendaByIds: vi.fn(async () => []),
    getPublicTracks: vi.fn(async () => [TRACK_A, TRACK_B]),
    getPublicFormatOptions: vi.fn(async () => ["talk", "workshop"]),
    getPublicRooms: vi.fn(async () => []),
    getPublicScheduleDayCounts: vi.fn(async () => [
      { day: "2026-08-10", count: 2 },
      { day: "2026-08-11", count: 1 },
    ]),
    getPublicBreaksByDay: vi.fn(async () => new Map()),
    getPublicCfpWindow: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

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

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

async function jsonTotal(app: Hono<AppEnv>, path: string): Promise<number> {
  const res = await app.request(path, {}, TEST_ENV);
  const body = (await res.json()) as { total: number };
  return body.total;
}

// Counts rendered session/agenda-row markers in the HTML page for a given
// surface, so the HTML total can be compared to the .json twin's reported
// `total` without depending on the "Showing the first N of M" copy (which
// only appears once truncated).
function countHtmlRows(html: string, surface: "sessions" | "agenda" | "schedule"): number {
  if (surface === "sessions") return (html.match(/id="chq-session-/g) ?? []).length;
  // task-w1-d (DEC-555 amendment): /schedule renders its own row markup
  // (data-submission-id="<id>" on .chq-pub-schedule-row), never
  // AgendaItemList's chq-agenda-list-<id>.
  if (surface === "schedule") return (html.match(/class="chq-pub-schedule-row"/g) ?? []).length;
  return (html.match(/id="chq-agenda-list-/g) ?? []).length;
}

describe("DEC-851: one filter contract — HTML dispatch and the .json feed agree on `total` for every knob", () => {
  const cases: { surface: "sessions" | "agenda" | "schedule"; qs: string }[] = [
    { surface: "sessions", qs: "" },
    { surface: "sessions", qs: "?trackId=trk-a" },
    { surface: "sessions", qs: "?format=talk" },
    { surface: "sessions", qs: "?day=2026-08-10" },
    { surface: "sessions", qs: "?q=talk" },
    // DEC-851's wave-64 amendment supersedes the parity claim for exactly
    // two knobs on exactly two surfaces: on /agenda and /schedule `trackId`
    // is a render-level HIGHLIGHT (never a predicate) and `format` is not an
    // agenda facet at all, so the HTML page there deliberately renders MORE
    // rows than the filtered feed. Those four cases are asserted separately
    // below; day/q/no-knob parity is untouched by the amendment.
    //
    // DEC-768's wave-67 amendment further removes `{ surface: "agenda", qs:
    // "" }` and `{ surface: "agenda", qs: "?q=talk" }` from this generic
    // loop (see the file-header comment above) — asserted separately below
    // against the day-scoped expectation instead.
    { surface: "agenda", qs: "?day=2026-08-10" },
    { surface: "schedule", qs: "" },
    { surface: "schedule", qs: "?day=2026-08-10" },
    { surface: "schedule", qs: "?q=talk" },
  ];

  for (const { surface, qs } of cases) {
    it(`${surface}${qs} — HTML page row count matches .json twin's total`, async () => {
      installFakeCaches();
      const app = buildApp();
      const htmlRes = await app.request(`/e/conf/${surface}${qs}`, {}, TEST_ENV);
      const html = await htmlRes.text();
      installFakeCaches();
      const total = await jsonTotal(app, `/embed/conf/${surface}.json${qs}`);
      expect(countHtmlRows(html, surface)).toBe(total);
    });
  }
});

// DEC-768 (wave 67 amendment): the two cases the amendment pulled out of the
// generic loop above — /agenda's no-day-given default now renders only the
// first day with sessions (2026-08-10: s1 + s2), while the .json twin's
// `total` stays a whole-event figure (unaffected by the amendment, per its
// own ruling that only the two HTML surfaces changed). The two totals are
// deliberately DIFFERENT now; both are asserted so the divergence is pinned
// rather than silently reintroduced.
describe("DEC-768 (wave 67 amendment): /agenda's single-day default vs the .json twin's whole-event total", () => {
  it("qs=\"\" — the HTML page renders only the first day's rows; the .json twin's total stays the whole-event count", async () => {
    installFakeCaches();
    const app = buildApp();
    const htmlRes = await app.request("/e/conf/agenda", {}, TEST_ENV);
    const html = await htmlRes.text();
    installFakeCaches();
    const jsonTotalValue = await jsonTotal(app, "/embed/conf/agenda.json");
    const firstDayCount = RAW_SESSIONS.filter((r) => r.day === "2026-08-10").length;
    expect(countHtmlRows(html, "agenda")).toBe(firstDayCount);
    expect(jsonTotalValue).toBe(RAW_SESSIONS.length);
    expect(countHtmlRows(html, "agenda")).toBeLessThan(jsonTotalValue);
  });

  it("qs=\"?q=talk\" — the search narrows the FIRST day's rows (0 matches there), while the .json twin's total searches the whole event (1 match, on the second day)", async () => {
    installFakeCaches();
    const app = buildApp();
    const htmlRes = await app.request("/e/conf/agenda?q=talk", {}, TEST_ENV);
    const html = await htmlRes.text();
    installFakeCaches();
    const jsonTotalValue = await jsonTotal(app, "/embed/conf/agenda.json?q=talk");
    // "Gamma Talk" (s3) is the only q=talk match, and it lives on
    // 2026-08-11 — the day AFTER the default first day, so the HTML page
    // (scoped to 2026-08-10) shows zero matches while the whole-event .json
    // feed still finds it.
    expect(countHtmlRows(html, "agenda")).toBe(0);
    expect(jsonTotalValue).toBe(1);
    expect(html).toContain("No sessions match your search");
  });
});

describe("DEC-489 (wave-12 amendment): /embed/:slug/agenda.json?trackId= no longer filters — it matches the HTML page's highlight", () => {
  it("a trackId-'filtered' .json total EQUALS the unfiltered total (highlight, not filter, on both readers)", async () => {
    installFakeCaches();
    const app = buildApp();
    const unfilteredTotal = await jsonTotal(app, "/embed/conf/agenda.json");
    installFakeCaches();
    const withTrackIdTotal = await jsonTotal(app, "/embed/conf/agenda.json?trackId=trk-a");
    expect(withTrackIdTotal).toBe(unfilteredTotal);
  });

  // DEC-851 wave-64 amendment established the HTML page's own highlight
  // behavior; DEC-489's wave-12 amendment re-declared the .json/.xml twins
  // to mirror it exactly, since the HTML reader is normative. Both readers
  // now render every row of the day in view regardless of ?trackId=.
  it("the HTML page and the .json twin render the SAME row count at the identical query — trackId highlights on both, filters neither", async () => {
    installFakeCaches();
    const app = buildApp();
    const htmlRes = await app.request("/e/conf/agenda?day=2026-08-10&trackId=trk-a", {}, TEST_ENV);
    const html = await htmlRes.text();
    installFakeCaches();
    const jsonTotalValue = await jsonTotal(app, "/embed/conf/agenda.json?day=2026-08-10&trackId=trk-a");
    const day10Count = RAW_SESSIONS.filter((r) => r.day === "2026-08-10").length;
    expect(countHtmlRows(html, "agenda")).toBe(day10Count);
    expect(jsonTotalValue).toBe(day10Count);
  });

  it("neither reader honors ?format= at all (not an agenda facet) on both itinerary surfaces", async () => {
    // DEC-768 wave-67 amendment: /agenda's default view is scoped to the
    // first day with sessions (2 of the 3 RAW_SESSIONS, both on
    // 2026-08-10); /schedule is untouched and still lists every day.
    const expectedBySurface = { agenda: RAW_SESSIONS.filter((r) => r.day === "2026-08-10").length, schedule: RAW_SESSIONS.length };
    for (const surface of ["agenda", "schedule"] as const) {
      installFakeCaches();
      const app = buildApp();
      const htmlRes = await app.request(`/e/conf/${surface}?format=talk`, {}, TEST_ENV);
      const html = await htmlRes.text();
      expect(countHtmlRows(html, surface)).toBe(expectedBySurface[surface]);

      // The .json twin is unpaged and unscoped to a single day (DEC-768's
      // amendment only touched the HTML /agenda default) -- ?format= is
      // ignored there too, so its total stays the whole-event count.
      installFakeCaches();
      const jsonTotalValue = await jsonTotal(app, `/embed/conf/${surface}.json?format=talk`);
      expect(jsonTotalValue).toBe(RAW_SESSIONS.length);
    }
  });
});

describe("DEC-489 (wave-12 amendment): the .json/.xml feed twins never thread trackId or format into getPublicAgenda for agenda/schedule", () => {
  it("agenda.json/.xml call getPublicAgenda with day/q only, mirroring dispatch.tsx exactly", async () => {
    installFakeCaches();
    const app = buildApp();
    getPublicAgendaMock.mockClear();
    await app.request("/embed/conf/agenda.json?trackId=trk-a&format=talk&q=talk", {}, TEST_ENV);
    const jsonCallParams = getPublicAgendaMock.mock.calls.at(-1)?.[2];
    expect(jsonCallParams).toEqual({ day: null, q: "talk" });

    installFakeCaches();
    getPublicAgendaMock.mockClear();
    await app.request("/embed/conf/agenda.xml?trackId=trk-a&format=talk&q=talk", {}, TEST_ENV);
    const xmlCallParams = getPublicAgendaMock.mock.calls.at(-1)?.[2];
    expect(xmlCallParams).toEqual({ day: null, q: "talk" });
  });

  it("schedule.xml also drops trackId and format", async () => {
    installFakeCaches();
    const app = buildApp();
    getPublicAgendaMock.mockClear();
    await app.request("/embed/conf/schedule.xml?trackId=trk-a&format=workshop", {}, TEST_ENV);
    const xmlCallParams = getPublicAgendaMock.mock.calls.at(-1)?.[2];
    expect(xmlCallParams).toEqual({ day: null, q: null });
  });
});

describe("DEC-489 (wave-12 amendment, revised DEC-851 wave-55 amendment): EMBED_KNOBS_BY_SURFACE pins the corrected set for agenda/schedule", () => {
  it("agenda lists trackId(highlight), day, q, accent — never format, roomId, limit or fields", async () => {
    const { EMBED_KNOBS_BY_SURFACE, trackKnobMode } = await import("../app/src/pages/settings/embedSnippet");
    const expected = ["trackId", "day", "q", "accent"];
    expect([...EMBED_KNOBS_BY_SURFACE.agenda].sort()).toEqual([...expected].sort());
    expect(EMBED_KNOBS_BY_SURFACE.agenda).not.toContain("roomId");
    expect(EMBED_KNOBS_BY_SURFACE.agenda).not.toContain("fields");
    expect(EMBED_KNOBS_BY_SURFACE.agenda).not.toContain("format");
    expect(EMBED_KNOBS_BY_SURFACE.agenda).not.toContain("limit");
    expect(trackKnobMode("agenda")).toBe("highlight");
  });

  // DEC-851 (wave-55 amendment): schedule lost trackId entirely -- no
  // reader honors it (ScheduleContent never read the highlight prop, the
  // .json/.xml feed twin never threaded it into getPublicAgenda).
  it("schedule lists only day, q, accent — never trackId, format, roomId, limit or fields", async () => {
    const { EMBED_KNOBS_BY_SURFACE } = await import("../app/src/pages/settings/embedSnippet");
    const expected = ["day", "q", "accent"];
    expect([...EMBED_KNOBS_BY_SURFACE.schedule].sort()).toEqual([...expected].sort());
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("trackId");
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("roomId");
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("fields");
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("format");
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("limit");
  });
});
