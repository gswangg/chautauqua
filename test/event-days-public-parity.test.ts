// DEC-277 (wave 60 amendment): /sessions' day-index rail and /agenda's day
// switcher must list the SAME calendar-day set for the event, even when the
// FIRST day has zero scheduled sessions. Before this change,
// src/routes/public/sessions.tsx derived its rail from the event's full
// date range while src/routes/public/dispatch.tsx derived /agenda's
// switcher from `dayCounts` (scheduled days only) -- a 3-day event with an
// unscheduled first day showed 3 days on /sessions and 2 on /agenda.
// Mirrors the vi.mock(../src/server/repo/public) pattern established in
// test/public-page-headings.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

// Day 1 (08-10) has zero scheduled sessions; days 2-3 have one each.
const DAY_COUNTS = [
  { day: "2026-08-11", count: 1 },
  { day: "2026-08-12", count: 1 },
];

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicTracks: vi.fn(async () => []),
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => DAY_COUNTS),
    getPublicBreaksByDay: vi.fn(async () => new Map()),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";

class InMemoryKV implements KVStore {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

class InMemoryCache {
  private store = new Map<string, Response>();
  async match(request: Request) {
    return this.store.get(request.url);
  }
  async put(request: Request, response: Response) {
    this.store.set(request.url, response);
  }
}

(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

describe("DEC-277 (wave 60 amendment): /sessions rail and /agenda switcher agree on the event's day set", () => {
  it("/e/conf/sessions' day-index rail lists all 3 days, including the unscheduled first day at '0 sessions'", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/sessions");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const day of ["2026-08-10", "2026-08-11", "2026-08-12"]) {
      expect(html).toContain(`?day=${day}`);
    }
    // The unscheduled first day still reads "0 sessions" rather than
    // vanishing from the rail (DayIndexRailSection's own contract).
    const rows = [...html.matchAll(/<a href="\/e\/conf\/agenda\?day=([^"]+)">[^<]*<\/a>\s*<span class="chq-pub-rail-day-count">([^<]*)<\/span>/g)];
    const byDay = new Map(rows.map((m) => [m[1], m[2]]));
    expect(byDay.get("2026-08-10")).toBe("0 sessions");
  });

  it("/e/conf/agenda's day switcher lists the SAME 3 days as /sessions' rail (DaySwitcher pills)", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/agenda");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-day-switcher"');
    for (const day of ["2026-08-10", "2026-08-11", "2026-08-12"]) {
      expect(html).toContain(`?day=${day}`);
    }
  });

  it("/e/conf/agenda's DEFAULT active day is still the first day that has sessions (unaffected by the switcher fix)", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/agenda");
    expect(res.status).toBe(200);
    const html = await res.text();
    // '2026-08-11' (first day WITH sessions) carries aria-current, not
    // '2026-08-10' (first calendar day of the event, which has none).
    expect(html).toMatch(/href="\/e\/conf\/agenda\?day=2026-08-11[^"]*"\s+aria-current="page"/);
    expect(html).not.toMatch(/href="\/e\/conf\/agenda\?day=2026-08-10[^"]*"\s+aria-current="page"/);
  });
});
