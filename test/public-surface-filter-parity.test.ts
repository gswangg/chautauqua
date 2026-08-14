// DEC-851: one filter contract for the public agenda/schedule surfaces — the
// HTML page, its .json twin, its .xml twin and the embed builder's knob
// table must all read the same enumerated knob set: ['trackId','format',
// 'day','q','limit','accent'] (no roomId, no fields).
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
  return (html.match(/id="chq-agenda-list-/g) ?? []).length;
}

describe("DEC-851: one filter contract — HTML dispatch and the .json feed agree on `total` for every knob", () => {
  const cases: { surface: "sessions" | "agenda" | "schedule"; qs: string }[] = [
    { surface: "sessions", qs: "" },
    { surface: "sessions", qs: "?trackId=trk-a" },
    { surface: "sessions", qs: "?format=talk" },
    { surface: "sessions", qs: "?day=2026-08-10" },
    { surface: "sessions", qs: "?q=talk" },
    { surface: "agenda", qs: "" },
    { surface: "agenda", qs: "?trackId=trk-a" },
    { surface: "agenda", qs: "?format=talk" },
    { surface: "agenda", qs: "?day=2026-08-10" },
    { surface: "agenda", qs: "?q=talk" },
    { surface: "schedule", qs: "" },
    { surface: "schedule", qs: "?trackId=trk-a" },
    { surface: "schedule", qs: "?format=talk" },
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

describe("DEC-851: /embed/:slug/agenda.json?trackId= no longer returns the unfiltered agenda", () => {
  it("a trackId-filtered .json total is strictly less than the unfiltered total", async () => {
    installFakeCaches();
    const app = buildApp();
    const unfilteredTotal = await jsonTotal(app, "/embed/conf/agenda.json");
    installFakeCaches();
    const filteredTotal = await jsonTotal(app, "/embed/conf/agenda.json?trackId=trk-a");
    expect(filteredTotal).toBeLessThan(unfilteredTotal);
    expect(filteredTotal).toBe(RAW_SESSIONS.filter((r) => r.trackId === "trk-a").length);
  });

  it("a trackId-filtered .json total matches the HTML page's total for the identical query", async () => {
    installFakeCaches();
    const app = buildApp();
    const htmlRes = await app.request("/e/conf/agenda?trackId=trk-a", {}, TEST_ENV);
    const html = await htmlRes.text();
    installFakeCaches();
    const jsonTotalValue = await jsonTotal(app, "/embed/conf/agenda.json?trackId=trk-a");
    expect(countHtmlRows(html, "agenda")).toBe(jsonTotalValue);
  });
});

describe("DEC-851: the .xml route applies ?format= exactly like the .json route", () => {
  it("threads format into the getPublicAgenda call the same way .json does", async () => {
    installFakeCaches();
    const app = buildApp();
    getPublicAgendaMock.mockClear();
    await app.request("/embed/conf/agenda.json?format=talk", {}, TEST_ENV);
    const jsonCallParams = getPublicAgendaMock.mock.calls.at(-1)?.[2];
    expect(jsonCallParams).toMatchObject({ format: "talk" });

    installFakeCaches();
    getPublicAgendaMock.mockClear();
    await app.request("/embed/conf/agenda.xml?format=talk", {}, TEST_ENV);
    const xmlCallParams = getPublicAgendaMock.mock.calls.at(-1)?.[2];
    expect(xmlCallParams).toMatchObject({ format: "talk" });
  });

  it("schedule.xml also threads format", async () => {
    installFakeCaches();
    const app = buildApp();
    getPublicAgendaMock.mockClear();
    await app.request("/embed/conf/schedule.xml?format=workshop", {}, TEST_ENV);
    const xmlCallParams = getPublicAgendaMock.mock.calls.at(-1)?.[2];
    expect(xmlCallParams).toMatchObject({ format: "workshop" });
  });
});

describe("DEC-851: EMBED_KNOBS_BY_SURFACE pins the same set for agenda/schedule", () => {
  it("agenda and schedule both list trackId, format and q alongside day/limit/accent", async () => {
    const { EMBED_KNOBS_BY_SURFACE } = await import("../app/src/pages/settings/embedSnippet");
    const expected = ["trackId", "format", "day", "q", "limit", "accent"];
    expect([...EMBED_KNOBS_BY_SURFACE.agenda].sort()).toEqual([...expected].sort());
    expect([...EMBED_KNOBS_BY_SURFACE.schedule].sort()).toEqual([...expected].sort());
    expect(EMBED_KNOBS_BY_SURFACE.agenda).not.toContain("roomId");
    expect(EMBED_KNOBS_BY_SURFACE.agenda).not.toContain("fields");
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("roomId");
    expect(EMBED_KNOBS_BY_SURFACE.schedule).not.toContain("fields");
  });
});
