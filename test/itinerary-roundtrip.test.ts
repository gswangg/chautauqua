// DEC-140: reproduces the "empty .ics itinerary" bug class end-to-end,
// independent of where the id-space mismatch actually hides (checkbox value
// vs agendaById key, ItineraryScript link-sync, or pubcache serving a
// stale ids-less variant). Renders the real GET /e/:slug/schedule route,
// scrapes every .chq-itinerary-toggle checkbox value out of the actual HTML
// (not a hand-built id list), then requests schedule.ics with exactly those
// ids and asserts every one round-trips to a VEVENT with a matching
// SUMMARY. getPublicAgenda is mocked (no local sqlite/D1 test driver is
// wired up in this repo — see test/agenda-room-ownership.test.ts) but the
// route/rendering/.ics layers under test are all real.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );

  const EVENT: import("../src/server/repo/public").PublicEvent = {
    id: "ev1",
    orgId: "org1",
    name: "Test Event",
    slug: "conf",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    location: null,
    timezone: "UTC",
    recordPrefix: "SES",
    brandingJson: null,
  };

  const AGENDA: import("../src/server/repo/public").PublicAgendaItem[] = [
    {
      submissionId: "sub-a",
      ref: "SES-001",
      title: "Session A",
      description: null,
      day: "2026-08-10",
      startMin: 540,
      endMin: 600,
      roomId: "room-1",
      roomName: "Room 1",
      icsSequence: 0,
      tracks: [],
      speakers: [],
    },
    {
      submissionId: "sub-b",
      ref: "SES-002",
      title: "Session B",
      description: null,
      day: "2026-08-10",
      startMin: 570,
      endMin: 630,
      roomId: "room-1",
      roomName: "Room 1",
      icsSequence: 0,
      tracks: [],
      speakers: [],
    },
    {
      submissionId: "sub-c",
      ref: "SES-003",
      title: "Session C",
      description: null,
      day: "2026-08-10",
      startMin: 660,
      endMin: 720,
      roomId: "room-2",
      roomName: "Room 2",
      icsSequence: 0,
      tracks: [],
      speakers: [],
    },
  ];

  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicAgenda: vi.fn(async () => AGENDA),
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

// publicCacheMiddleware reads caches.default at request time (not import
// time) — stub the Workers-runtime global so /e/* GETs exercise the real
// cache middleware under vitest's node environment.
(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    // Never reached: getPublicEventBySlug/getPublicAgenda are mocked above
    // and don't touch `db`.
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

describe("DEC-140 itinerary id round-trip (schedule HTML -> schedule.ics)", () => {
  it("every rendered checkbox value survives into a matching VEVENT", async () => {
    const app = buildApp();

    const scheduleRes = await app.request("/e/conf/schedule");
    expect(scheduleRes.status).toBe(200);
    const html = await scheduleRes.text();

    const ids = [...html.matchAll(/class="chq-itinerary-toggle" value="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length); // no accidental dupes

    const icsRes = await app.request(`/e/conf/schedule.ics?ids=${ids.join(",")}`);

    expect(icsRes.status).toBe(200);
    const ics = await icsRes.text();

    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(ids.length);

    const summaries = [...ics.matchAll(/SUMMARY:(.+)\r?\n/g)].map((m) => m[1]!.trim());
    expect(summaries.sort()).toEqual(["Session A", "Session B", "Session C"].sort());
  });

  it("shows a live picked count next to the download link", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/schedule");
    const html = await res.text();
    expect(html).toMatch(/id="chq-ics-count"/);
  });
});
