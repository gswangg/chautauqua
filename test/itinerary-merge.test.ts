// DEC-555: the schedule surface's ?day= filter (DEC-489) means any given
// page of the itinerary picker only renders (and can only toggle) a subset
// of the full stored itinerary. Persisting `currentIds()` alone silently
// wipes every pick from every other day. mergeItinerarySelection is the ONE
// pure implementation of the fix — this file unit-tests it directly, then
// asserts the real page ships that exact implementation (via .toString())
// rather than a hand-written JS twin.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { MAX_ITINERARY_IDS, mergeItinerarySelection } from "../src/lib/itinerary";

describe("mergeItinerarySelection (DEC-555)", () => {
  it("a day-2 toggle preserves day-1 picks not rendered on this page", () => {
    const stored = ["day1-a", "day1-b"];
    const renderedIds = ["day2-a", "day2-b"]; // only day 2 is on this page
    const checkedIds = ["day2-a"]; // user just checked day2-a
    expect(mergeItinerarySelection(stored, renderedIds, checkedIds)).toEqual(["day1-a", "day1-b", "day2-a"]);
  });

  it("unchecking a rendered id removes it", () => {
    const stored = ["a", "b"];
    const renderedIds = ["a", "b"];
    const checkedIds = ["a"]; // b was unchecked
    expect(mergeItinerarySelection(stored, renderedIds, checkedIds)).toEqual(["a"]);
  });

  it("an unrendered stored id survives regardless of checkedIds", () => {
    const stored = ["other-day-1", "other-day-2"];
    const renderedIds = ["this-day-1"];
    const checkedIds: string[] = []; // nothing checked on this page at all
    expect(mergeItinerarySelection(stored, renderedIds, checkedIds)).toEqual(["other-day-1", "other-day-2"]);
  });

  it("dedupes across kept + appended ids", () => {
    const stored = ["a", "b"];
    const renderedIds = ["b", "c"];
    const checkedIds = ["b", "c"];
    const result = mergeItinerarySelection(stored, renderedIds, checkedIds);
    expect(result).toEqual(["a", "b", "c"]);
    expect(new Set(result).size).toBe(result.length);
  });

  it("preserves order: kept-unrendered ids first (original order), then newly checked ids (checkedIds order)", () => {
    const stored = ["z", "y", "x"];
    const renderedIds = ["y"]; // only 'y' is on this page
    const checkedIds = ["y", "q"]; // 'y' re-checked, 'q' newly checked
    expect(mergeItinerarySelection(stored, renderedIds, checkedIds)).toEqual(["z", "x", "y", "q"]);
  });

  it("never exceeds MAX_ITINERARY_IDS", () => {
    const stored = Array.from({ length: MAX_ITINERARY_IDS }, (_, i) => `stored-${i}`);
    const renderedIds = ["r1", "r2"];
    const checkedIds = ["r1", "r2"];
    const result = mergeItinerarySelection(stored, renderedIds, checkedIds);
    expect(result.length).toBe(MAX_ITINERARY_IDS);
  });
});

describe("DEC-555: the schedule page ships the one implementation, not a copy", () => {
  it("the emitted <script> contains mergeItinerarySelection.toString() verbatim", async () => {
    vi.resetModules();
    vi.doMock("../src/server/repo/public", async () => {
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
      ];
      return {
        ...actual,
        getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
        // DEC-804: the agenda/schedule dispatch also loads getPublicTracks to
        // feed the search form's track <select> — stub it alongside the rest.
        getPublicTracks: vi.fn(async () => []),
        // DEC-851: getPublicFormatOptions is now loaded alongside getPublicTracks.
        getPublicFormatOptions: vi.fn(async () => []),
        // DEC-022 amendment (wave 63): the schedule dispatch also loads
        // getPublicBreaksByDay -- stub it the same way, for the same reason
        // (this test's synthetic `db` ({}) is never touched by a real
        // drizzle select).
        getPublicBreaksByDay: vi.fn(async () => new Map()),
        getPublicAgenda: vi.fn(async () => ({ items: AGENDA, total: AGENDA.length })),
        getPublicAgendaByIds: vi.fn(async (_db: unknown, _event: unknown, ids: string[]) =>
          AGENDA.filter((item) => ids.includes(item.submissionId)),
        ),
      };
    });

    const { publicRoutes } = await import("../src/routes/public");
    const { registerErrorHandler } = await import("../src/server/http");
    type AppEnv = import("../src/server/env").AppEnv;
    type KVStore = import("../src/lib/draft").KVStore;

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

    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", {} as AppEnv["Variables"]["db"]);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", publicRoutes);
    const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };

    const res = await app.request("/e/conf/schedule", undefined, env);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain(mergeItinerarySelection.toString());
    expect(html).toContain("__chqMerge");
    vi.doUnmock("../src/server/repo/public");
  });
});
