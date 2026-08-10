// Pure-helper tests for the public surfaces (J10/DEC-022). Route/query-gate
// verification happens against wrangler dev per DEC-012 — this covers the
// extracted pure logic (itinerary id parsing/storage key, the timezone
// conversion used by schedule.ics), plus EMB-01/EMB-02/EMB-07 route/repo
// coverage below using the fake-db-chain pattern established in
// test/headshot-gate.test.ts and test/agenda-room-ownership.test.ts (no
// local sqlite/D1 test driver is wired up — see package.json).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { itineraryStorageKey, parseItineraryIds } from "../src/lib/itinerary";
import { zonedMinutesToUtc } from "../src/lib/timezone";
import { publicRoutes } from "../src/routes/public";
import { getPublicSessions, type PublicEvent } from "../src/server/repo/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

describe("itineraryStorageKey", () => {
  it("namespaces by event slug", () => {
    expect(itineraryStorageKey("my-event")).toBe("chq_itinerary_my-event");
  });
});

describe("parseItineraryIds", () => {
  it("returns [] for missing/empty input", () => {
    expect(parseItineraryIds(undefined)).toEqual([]);
    expect(parseItineraryIds(null)).toEqual([]);
    expect(parseItineraryIds("")).toEqual([]);
  });

  it("splits, trims, and dedupes while preserving order", () => {
    expect(parseItineraryIds("a, b,a , c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty segments", () => {
    expect(parseItineraryIds("a,,b,")).toEqual(["a", "b"]);
  });
});

describe("zonedMinutesToUtc", () => {
  it("converts a wall-clock time in a fixed-offset-like zone (UTC) directly", () => {
    // 09:00 (540 min) on 2026-08-10 in UTC is exactly that instant in UTC.
    const d = zonedMinutesToUtc("2026-08-10", 540, "UTC");
    expect(d.toISOString()).toBe("2026-08-10T09:00:00.000Z");
  });

  it("applies a fixed negative offset (America/New_York, EDT = UTC-4 in August)", () => {
    // 09:00 wall-clock in New York in August (EDT, UTC-4) is 13:00 UTC.
    const d = zonedMinutesToUtc("2026-08-10", 540, "America/New_York");
    expect(d.toISOString()).toBe("2026-08-10T13:00:00.000Z");
  });

  it("applies a fixed negative offset in winter (America/New_York, EST = UTC-5)", () => {
    // 09:00 wall-clock in New York in January (EST, UTC-5) is 14:00 UTC.
    const d = zonedMinutesToUtc("2026-01-10", 540, "America/New_York");
    expect(d.toISOString()).toBe("2026-01-10T14:00:00.000Z");
  });

  it("handles a positive offset zone (Asia/Tokyo, UTC+9)", () => {
    // 09:00 wall-clock in Tokyo is 00:00 UTC the same day.
    const d = zonedMinutesToUtc("2026-08-10", 540, "Asia/Tokyo");
    expect(d.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("throws loudly on a malformed day string", () => {
    expect(() => zonedMinutesToUtc("not-a-day", 0, "UTC")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// EMB-01 / EMB-02 / EMB-07: fake-db-chain harness
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Walks a drizzle SQL condition tree, collecting referenced column names and
// bound values (see test/agenda-room-ownership.test.ts for the eq()-based
// original). like()'s bound value shows up as a bare string leaf directly
// inside queryChunks (not wrapped in an object with a `.value` property the
// way eq()'s Param is) — so, unlike the original, this walk also captures
// primitive leaves found while iterating queryChunks arrays.
function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 12 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) {
      if (c !== null && typeof c !== "object") {
        out.push(`val:${JSON.stringify(c)}`);
      } else {
        out.push(...walkCondition(c, seen, depth + 1));
      }
    }
  }
  return out;
}

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

// publicRoutes' /e/* and /embed/* GETs run through publicCacheMiddleware
// (DEC-083), which requires c.env.KV and the Workers `caches.default`
// global — neither exists under vitest's node environment (see
// test/pubcache.test.ts's fakeKv/fakeCache for the established pure-fake
// pattern this mirrors). A permanently-empty cache (match always undefined)
// keeps these route tests exercising the real render path every time.
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

describe("SessionCard schedule rendering (EMB-01: date/time + room)", () => {
  function buildApp() {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: getPublicTracks
        if (selectCall === 2) return makeChain([]);
        // 3: hydrateSessions subRows
        if (selectCall === 3) {
          return makeChain([
            { id: "sub1", seq: 1, title: "Scheduled Talk", description: null, icsSequence: 0 },
            { id: "sub2", seq: 2, title: "Unscheduled Talk", description: null, icsSequence: 0 },
          ]);
        }
        // 4: hydrateSessions trackRows
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions speakerRows
        if (selectCall === 5) return makeChain([]);
        // 6: hydrateSessions slotRows (EMB-01) — only sub1 has a slot
        return makeChain([
          { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomName: "Main Hall" },
        ]);
      },
      selectDistinct: () =>
        makeChain([
          { id: "sub1", title: "Scheduled Talk" },
          { id: "sub2", title: "Unscheduled Talk" },
        ]),
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

  function cardFragment(html: string, submissionId: string): string {
    const start = html.indexOf(`id="chq-session-${submissionId}"`);
    expect(start).toBeGreaterThan(-1);
    const nextCard = html.indexOf('id="chq-session-', start + 1);
    return html.slice(start, nextCard === -1 ? undefined : nextCard);
  }

  it("shows formatted time + room for a scheduled session", async () => {
    const app = buildApp();
    installFakeCaches();
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain("chq-session-when");
    expect(fragment).toContain("9:00 AM");
    expect(fragment).toContain("10:00 AM");
    expect(fragment).toContain("Main Hall");
  });

  it("omits date/time/room entirely for an unscheduled session (no dash pile)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub2");
    expect(fragment).not.toContain("chq-session-when");
  });
});

describe("EMB-02: keyword search (q) server-side substring filter", () => {
  function captureWhere(q: string | null) {
    let captured: unknown;
    const db = {
      selectDistinct: () => makeChain([], (cond) => (captured = cond)),
    } as unknown as AppEnv["Variables"]["db"];
    return { db, getCaptured: () => captured };
  }

  it("builds a WHERE that ANDs the search condition with the full visibility gate (never bypasses it)", async () => {
    const { db, getCaptured } = captureWhere("Ada");
    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "Ada" });
    const tokens = walkCondition(getCaptured());
    // visibility gate columns still present alongside the search condition
    expect(tokens).toContain("col:status");
    expect(tokens).toContain('val:"accepted"');
    expect(tokens).toContain("col:content_status");
    expect(tokens).toContain('val:"approved"');
    expect(tokens).toContain("col:visible");
    // search condition: title OR first_name OR last_name, parameterized
    expect(tokens).toContain("col:title");
    expect(tokens).toContain("col:first_name");
    expect(tokens).toContain("col:last_name");
    expect(tokens).toContain('val:"%Ada%"');
  });

  it("omits the search condition entirely when q is absent", async () => {
    const { db, getCaptured } = captureWhere(null);
    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: null });
    const tokens = walkCondition(getCaptured());
    expect(tokens).not.toContain('val:"%Ada%"');
    // visibility gate is still present without a search term
    expect(tokens).toContain('val:"accepted"');
  });
});

describe("AgendaContent / ScheduleContent day switcher (EMB-07)", () => {
  function buildApp(surface: "agenda" | "schedule") {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: getPublicAgenda's room lookup
        if (selectCall === 2) return makeChain([{ id: "room1", name: "Main Hall" }]);
        // 3: hydrateSessions subRows
        if (selectCall === 3) {
          return makeChain([
            { id: "sub1", seq: 1, title: "Day One Talk", description: null, icsSequence: 0 },
            { id: "sub2", seq: 2, title: "Day Two Talk", description: null, icsSequence: 0 },
          ]);
        }
        // 4: hydrateSessions trackRows
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions speakerRows
        if (selectCall === 5) return makeChain([]);
        // 6: hydrateSessions slotRows
        return makeChain([]);
      },
      selectDistinct: () =>
        makeChain([
          { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" },
          { submissionId: "sub2", day: "2026-08-11", startMin: 540, endMin: 600, roomId: "room1" },
        ]),
    } as unknown as AppEnv["Variables"]["db"];

    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", publicRoutes);
    installFakeCaches();
    return app.request(`/e/conf/${surface}`, {}, TEST_ENV);
  }

  it("agenda renders one day-switcher link per seeded event day, anchored to that day's section", async () => {
    const res = await buildApp("agenda");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="#chq-day-2026-08-10"');
    expect(html).toContain('href="#chq-day-2026-08-11"');
    expect(html).toContain('id="chq-day-2026-08-10"');
    expect(html).toContain('id="chq-day-2026-08-11"');
  });

  it("schedule surface also renders the day switcher", async () => {
    const res = await buildApp("schedule");
    const html = await res.text();
    expect(html).toContain('href="#chq-day-2026-08-10"');
    expect(html).toContain('href="#chq-day-2026-08-11"');
  });
});
