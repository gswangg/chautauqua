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
      roomPosition: 0,
      icsSequence: 0,
      tracks: [],
      speakers: [],
      format: null,
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
      roomPosition: 0,
      icsSequence: 0,
      tracks: [],
      speakers: [],
      format: null,
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
      roomPosition: 1,
      icsSequence: 0,
      tracks: [],
      speakers: [],
      format: null,
    },
  ];

  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicAgenda: vi.fn(async () => ({ items: AGENDA, total: AGENDA.length })),
    // DEC-310: schedule.ics now scopes its query to the requested ids
    // rather than hydrating the whole agenda — mirror that filtering here
    // so this end-to-end round-trip test still exercises real id handling.
    getPublicAgendaByIds: vi.fn(async (_db: unknown, _event: unknown, ids: string[]) =>
      AGENDA.filter((item) => ids.includes(item.submissionId)),
    ),
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

    // DEC-584: the phone list and the desktop grid each render their own
    // .chq-itinerary-toggle for every session (one is display:none at a
    // time, both stay in the DOM), so the raw scrape now legitimately
    // contains the same submission id twice — dedupe the same way
    // ItineraryScript's `allRenderedIds` does before treating it as "the
    // set of rendered ids".
    const rawIds = [...html.matchAll(/class="chq-itinerary-toggle" value="([^"]+)"/g)].map((m) => m[1]!);
    expect(rawIds.length).toBeGreaterThan(0);
    expect(rawIds.length).toBe(new Set(rawIds).size * 2); // exactly two copies (desktop + phone) of each id
    const ids = [...new Set(rawIds)];

    const icsRes = await app.request(`/e/conf/schedule.ics?ids=${ids.join(",")}`);

    expect(icsRes.status).toBe(200);
    const ics = await icsRes.text();

    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(ids.length);

    const summaries = [...ics.matchAll(/SUMMARY:(.+)\r?\n/g)].map((m) => m[1]!.trim());
    expect(summaries.sort()).toEqual(["Session A", "Session B", "Session C"].sort());

    // DEC-168: public itinerary export is METHOD:PUBLISH with an ORGANIZER
    // but never an ATTENDEE (no per-recipient RSVP for an anonymous export).
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toMatch(/ORGANIZER;CN="[^"]*":mailto:/);
    expect(ics).not.toContain("ATTENDEE");
  });

  it("shows a live picked count next to the download link", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/schedule");
    const html = await res.text();
    expect(html).toMatch(/id="chq-ics-count"/);
  });
});

describe("DEC-323: bare schedule.ics (no ?ids=) publishes the whole agenda", () => {
  it("emits one VEVENT per agenda item, with UIDs matching agenda.ics", async () => {
    const app = buildApp();

    const scheduleIcsRes = await app.request("/e/conf/schedule.ics");
    expect(scheduleIcsRes.status).toBe(200);
    const scheduleIcs = await scheduleIcsRes.text();

    const scheduleVeventCount = (scheduleIcs.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(scheduleVeventCount).toBe(3);

    const agendaIcsRes = await app.request("/e/conf/agenda.ics");
    expect(agendaIcsRes.status).toBe(200);
    const agendaIcs = await agendaIcsRes.text();

    const uidsOf = (ics: string) => [...ics.matchAll(/UID:(.+)\r?\n/g)].map((m) => m[1]!.trim()).sort();
    expect(uidsOf(scheduleIcs)).toEqual(uidsOf(agendaIcs));

    const summaries = [...scheduleIcs.matchAll(/SUMMARY:(.+)\r?\n/g)].map((m) => m[1]!.trim());
    expect(summaries.sort()).toEqual(["Session A", "Session B", "Session C"].sort());
  });
});
