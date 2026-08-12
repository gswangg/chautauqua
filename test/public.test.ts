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
import {
  publicRoutes,
  sessionDetailPath,
  speakerDetailPath,
  isValidFrom,
  parseNameQuery,
  sessionTimeLabel,
} from "../src/routes/public";
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
    expect(fragment).toContain("chq-pub-session-when");
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
    expect(fragment).not.toContain("chq-pub-session-when");
  });
});

describe("EMB-02: keyword search (q) server-side substring filter", () => {
  function captureWhere(q: string | null) {
    let captured: unknown;
    const db = {
      selectDistinct: () => makeChain([], (cond) => (captured = cond)),
      // DEC-418: getPublicSessions now also runs countVisibleSubmissions()
      // (a plain db.select() count(distinct) query) alongside the id query
      // — stubbed here so the count query doesn't blow up; its WHERE isn't
      // what this test cares about (the id query's WHERE, above, is).
      select: () => makeChain([{ count: 0 }]),
    } as unknown as AppEnv["Variables"]["db"];
    return { db, getCaptured: () => captured };
  }

  it("builds a WHERE that ANDs the search condition with the session visibility gate (never bypasses it)", async () => {
    const { db, getCaptured } = captureWhere("Ada");
    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "Ada" });
    const tokens = walkCondition(getCaptured());
    // session visibility gate columns still present alongside the search
    // condition; participant.visible (DEC-274) now lives in the leftJoin's
    // ON condition, not the WHERE clause captured here.
    expect(tokens).toContain("col:status");
    expect(tokens).toContain('val:"accepted"');
    expect(tokens).toContain("col:content_status");
    expect(tokens).toContain('val:"approved"');
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

  // DEC-274: an accepted+content-approved submission with zero participant
  // rows (or all-hidden participants) must still surface publicly, with
  // speakers: [] — the session gate no longer requires a participant join.
  it("getPublicSessions returns a speakerless accepted+content-approved session with speakers: []", async () => {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: hydrateSessions subRows
        if (selectCall === 1) {
          return makeChain([{ id: "sub1", seq: 1, title: "Solo Title Match", description: null, icsSequence: 0 }]);
        }
        // 2: hydrateSessions trackRows
        if (selectCall === 2) return makeChain([]);
        // 3: hydrateSessions speakerRows — zero rows: no participants at all
        if (selectCall === 3) return makeChain([]);
        // 4: hydrateSessions slotRows
        return makeChain([]);
      },
      selectDistinct: () => makeChain([{ id: "sub1", title: "Solo Title Match" }]),
    } as unknown as AppEnv["Variables"]["db"];

    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: null });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe("sub1");
    expect(page.items[0]?.speakers).toEqual([]);
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

// task-w3-g (J10 public browser pass, SPEC §5 "ics UIDs never churn"):
// GET /e/:eventSlug/schedule.ics builds its VEVENT UID from the submission
// id alone (src/mail/ics.ts's uidFor, fed uidSubmissionId — never the
// title), so a title edit between two exports of the same session must
// leave the UID byte-identical while SUMMARY picks up the new title.
// Manually confirmed end-to-end against a live wrangler dev on :8835 (edit
// via the real organizer PATCH route, re-export, diff the UID) per this
// task's browser sweep; this is the vitest regression pinning that
// behavior against the fake-db-chain harness above so it can't regress
// silently.
describe("schedule.ics UID stability across a title change (SPEC §5)", () => {
  function buildIcsApp(title: string) {
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
          return makeChain([{ id: "sub1", seq: 1, title, description: null, icsSequence: 0 }]);
        }
        // 4: hydrateSessions trackRows
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions speakerRows
        if (selectCall === 5) return makeChain([]);
        // 6: hydrateSessions slotRows
        return makeChain([]);
      },
      selectDistinct: () =>
        makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }]),
    } as unknown as AppEnv["Variables"]["db"];

    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", publicRoutes);
    installFakeCaches();
    return app.request("/e/conf/schedule.ics?ids=sub1", {}, TEST_ENV);
  }

  it("keeps the UID identical across a title change, while SUMMARY reflects the new title", async () => {
    const before = await (await buildIcsApp("Original Title")).text();
    const after = await (await buildIcsApp("Renamed Title")).text();

    const uidBefore = before.match(/UID:([^\r\n]+)/)?.[1];
    const uidAfter = after.match(/UID:([^\r\n]+)/)?.[1];
    expect(uidBefore).toBeTruthy();
    expect(uidAfter).toBe(uidBefore);

    expect(before).toContain("SUMMARY:Original Title");
    expect(after).toContain("SUMMARY:Renamed Title");
  });
});

// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13): pure query-param
// parsing / path-building helpers. Query-gate verification (200/404 by
// visibility) lives against wrangler dev per DEC-012 — this repo's vitest
// harness runs in plain node with no D1/miniflare binding (see
// test/resource-file.test.ts), so getPublicSpeakerDetail/getPublicSessionDetail
// themselves aren't exercised here; test/public-invite-visibility.test.ts
// source-scans both for the visibleSubmissionConditions() gate instead.
const event: PublicEvent = {
  id: "evt1",
  orgId: "org1",
  name: "DevFlow Conf",
  slug: "devflow",
  startDate: "2027-05-12",
  endDate: "2027-05-14",
  location: null,
  timezone: "UTC",
  recordPrefix: "DF",
  brandingJson: null,
};

describe("sessionDetailPath / speakerDetailPath (DEC-151 ?from= back-link)", () => {
  it("builds a session detail path with no ?from when omitted", () => {
    expect(sessionDetailPath(event, "sub1")).toBe("/e/devflow/sessions/sub1");
  });

  it("builds a session detail path carrying ?from=<surface>", () => {
    expect(sessionDetailPath(event, "sub1", "agenda")).toBe("/e/devflow/sessions/sub1?from=agenda");
  });

  it("builds a speaker detail path carrying ?from=<surface>", () => {
    expect(speakerDetailPath(event, "contact1", "gallery")).toBe("/e/devflow/speakers/contact1?from=gallery");
  });
});

describe("isValidFrom", () => {
  it("passes through a known surface", () => {
    expect(isValidFrom("gallery", "speakers")).toBe("gallery");
  });

  it("falls back on an unknown/missing surface", () => {
    expect(isValidFrom("not-a-surface", "speakers")).toBe("speakers");
    expect(isValidFrom(undefined, "sessions")).toBe("sessions");
  });
});

describe("parseNameQuery (DEC-151 ?q= name search)", () => {
  it("returns null for missing/empty/whitespace-only input", () => {
    expect(parseNameQuery(undefined)).toBeNull();
    expect(parseNameQuery("")).toBeNull();
    expect(parseNameQuery("   ")).toBeNull();
  });

  it("trims a real query", () => {
    expect(parseNameQuery("  Raman  ")).toBe("Raman");
  });
});

describe("sessionTimeLabel", () => {
  it("returns null when the session is unscheduled", () => {
    expect(sessionTimeLabel(null, null, null)).toBeNull();
  });

  it("formats a scheduled session's day + time range", () => {
    expect(sessionTimeLabel("2027-05-12", 540, 600)).toBe("2027-05-12, 9:00 AM–10:00 AM");
  });
});
