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
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    as: () => chain,
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
        // 3: getPublicRooms (DEC-774)
        if (selectCall === 3) return makeChain([]);
        // 4: getPublicFormatOptions (DEC-774)
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions subRows
        if (selectCall === 5) {
          return makeChain([
            { id: "sub1", seq: 1, title: "Scheduled Talk", description: null, icsSequence: 0 },
            { id: "sub2", seq: 2, title: "Unscheduled Talk", description: null, icsSequence: 0 },
          ]);
        }
        // 6: hydrateSessions trackRows
        if (selectCall === 6) return makeChain([]);
        // 7: hydrateSessions speakerRows
        if (selectCall === 7) return makeChain([]);
        // 8: hydrateSessions slotRows (EMB-01) — only sub1 has a slot
        if (selectCall === 8) {
          return makeChain([
            { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomName: "Main Hall" },
          ]);
        }
        // 9: hydrateSessions formatRows
        return makeChain([]);
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

  function rowOpenTag(html: string, submissionId: string): string {
    const idIdx = html.indexOf(`id="chq-session-${submissionId}"`);
    expect(idIdx).toBeGreaterThan(-1);
    const tagStart = html.lastIndexOf("<div", idIdx);
    const tagEnd = html.indexOf(">", idIdx);
    return html.slice(tagStart, tagEnd + 1);
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

  it("DEC-698: still emits an empty .chq-pub-session-when gutter cell for an unscheduled session (no dash pile, no TBD prose) so the row keeps its 126px 1fr auto column count", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub2");
    const whenMatch = fragment.match(/<div class="chq-pub-session-when"[^>]*>([\s\S]*?)<\/div>/);
    expect(whenMatch).not.toBeNull();
    expect((whenMatch as RegExpMatchArray)[1]!.trim()).toBe("");
    expect(fragment).not.toContain("9:00 AM");
    expect(fragment).not.toContain("Main Hall");
    expect(whenMatch![0]).not.toMatch(/TBD|TBC|—/);
  });

  it("DEC-698: every session row has the same element-cell count whether scheduled or unscheduled", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const scheduled = cardFragment(html, "sub1");
    const unscheduled = cardFragment(html, "sub2");
    // top-level direct-child cells of each row: chq-pub-session-when + chq-pub-session-body (+ optional action).
    const cellCount = (frag: string) =>
      (frag.match(/class="chq-pub-session-when"/g) ?? []).length +
      (frag.match(/class="chq-pub-session-body"/g) ?? []).length;
    expect(cellCount(scheduled)).toBe(1 + 1);
    expect(cellCount(unscheduled)).toBe(1 + 1);
    expect(rowOpenTag(html, "sub1")).toContain('class="chq-pub-session-row"');
    expect(rowOpenTag(html, "sub2")).toContain('class="chq-pub-session-row"');
    expect(rowOpenTag(html, "sub1")).not.toContain("chq-pub-session-row-notime");
    expect(rowOpenTag(html, "sub2")).not.toContain("chq-pub-session-row-notime");
  });

  it("DEC-698: drops the .chq-pub-session-when cell entirely and switches to the notime row modifier when the time field is off", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions?fields=track,speaker,description,format", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).not.toContain("chq-pub-session-when");
    expect(rowOpenTag(html, "sub1")).toContain("chq-pub-session-row-notime");
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
        // 2: DEC-804 getPublicTracks (search form's track <select>)
        if (selectCall === 2) return makeChain([]);
        // 3: DEC-851 getPublicFormatOptions (search form's format <select>)
        if (selectCall === 3) return makeChain([]);
        // 4: DEC-548 getPublicAgenda's total count(*) subquery
        if (selectCall === 4) return makeChain([{ count: 2 }]);
        // 5: getPublicAgenda's room lookup
        if (selectCall === 5) return makeChain([{ id: "room1", name: "Main Hall" }]);
        // 6: hydrateSessions subRows
        if (selectCall === 6) {
          return makeChain([
            { id: "sub1", seq: 1, title: "Day One Talk", description: null, icsSequence: 0 },
            { id: "sub2", seq: 2, title: "Day Two Talk", description: null, icsSequence: 0 },
          ]);
        }
        // 7: hydrateSessions trackRows
        if (selectCall === 7) return makeChain([]);
        // 8: hydrateSessions speakerRows
        if (selectCall === 8) return makeChain([]);
        // 9: hydrateSessions slotRows
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

  // DEC-835: the day a visitor is reading is in the URL — every pill emits
  // a real `?day=<day>` href (never a bare `#chq-day-<day>` anchor), with
  // the `#chq-day-<day>` section id still present for in-page anchoring.
  it("agenda renders one day-switcher link per seeded event day, with a real ?day= href and anchored to that day's section", async () => {
    const res = await buildApp("agenda");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="/e/conf/agenda?day=2026-08-10#chq-day-2026-08-10"');
    expect(html).toContain('href="/e/conf/agenda?day=2026-08-11#chq-day-2026-08-11"');
    expect(html).toContain('id="chq-day-2026-08-10"');
    expect(html).toContain('id="chq-day-2026-08-11"');
  });

  it("schedule surface also renders the day switcher with a real ?day= href", async () => {
    const res = await buildApp("schedule");
    const html = await res.text();
    expect(html).toContain('href="/e/conf/schedule?day=2026-08-10#chq-day-2026-08-10"');
    expect(html).toContain('href="/e/conf/schedule?day=2026-08-11#chq-day-2026-08-11"');
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
    // DEC-782: `day` routes through the card's shared formatDay helper
    // (src/lib/event-time.ts's formatEventDay) — a weekday-named calendar
    // date, never the raw 'YYYY-MM-DD' interpolated directly.
    expect(sessionTimeLabel("2027-05-12", 540, 600)).toBe("Wed, May 12, 2027, 9:00 AM–10:00 AM");
  });
});

// ---------------------------------------------------------------------------
// DEC-683: sessions list + rail (Your schedule / day index / Call for
// papers) + per-row Save control. Closed both ways in /embed.
// ---------------------------------------------------------------------------

describe("DEC-683: sessions rail + Save control", () => {
  const FUTURE_CLOSE = Date.UTC(2099, 0, 1);
  const PAST_CLOSE = Date.UTC(2000, 0, 1);

  function buildApp(opts: { embed: boolean; closeDate: number | null }) {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: getPublicTracks
        if (selectCall === 2) return makeChain([]);
        // 3: getPublicRooms (DEC-774)
        if (selectCall === 3) return makeChain([]);
        // 4: getPublicFormatOptions (DEC-774)
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions subRows
        if (selectCall === 5) {
          return makeChain([{ id: "sub1", seq: 1, title: "Scheduled Talk", description: null, icsSequence: 0 }]);
        }
        // 6: hydrateSessions trackRows
        if (selectCall === 6) return makeChain([]);
        // 7: hydrateSessions speakerRows
        if (selectCall === 7) return makeChain([]);
        // 8: hydrateSessions slotRows
        if (selectCall === 8) {
          return makeChain([
            { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomName: "Main Hall" },
          ]);
        }
        // 9: hydrateSessions formatRows
        if (selectCall === 9) return makeChain([]);
        // 10: countVisibleSubmissions
        if (selectCall === 10) return makeChain([{ count: 1 }]);
        // 11: getPublicScheduleDayCounts (only reached when !embed)
        if (selectCall === 11) {
          return makeChain([
            { day: "2026-08-10", count: 2 },
            { day: "2026-08-11", count: 1 },
          ]);
        }
        // 12: getPublicCfpWindow (only reached when !embed) — form.open_date/
        // close_date are timestamp_ms columns, so drizzle hands back Date
        // objects, not raw numbers.
        return makeChain([{ openDate: null, closeDate: opts.closeDate === null ? null : new Date(opts.closeDate) }]);
      },
      selectDistinct: () => makeChain([{ id: "sub1", title: "Scheduled Talk" }]),
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

  it("renders all three rail sections on /e/<slug>/sessions", async () => {
    installFakeCaches();
    const app = buildApp({ embed: false, closeDate: FUTURE_CLOSE });
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    // 1: Your schedule
    expect(html).toContain('class="chq-pub-sessions-rail"');
    expect(html).toContain('id="chq-ics-count"');
    expect(html).toContain('id="chq-ics-link"');
    // 2: day index, linking to /e/<slug>/agenda?day=YYYY-MM-DD
    expect(html).toContain('href="/e/conf/agenda?day=2026-08-10"');
    expect(html).toContain('href="/e/conf/agenda?day=2026-08-11"');
    expect(html).toContain("2 sessions");
    // 3: Call for papers, open window
    expect(html).toContain("Call for papers");
    expect(html).toContain('href="/submit/conf"');
    expect(html).toContain("Submit a talk");
  });

  it("renders a Save checkbox per row", async () => {
    installFakeCaches();
    const app = buildApp({ embed: false, closeDate: FUTURE_CLOSE });
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-save"');
    expect(html).toContain('class="chq-itinerary-toggle"');
    expect(html).toContain('value="sub1"');
    expect(html).toContain('class="chq-pub-save-off"');
    expect(html).toContain('class="chq-pub-save-on"');
  });

  it("the CFP card is absent when the window is closed", async () => {
    installFakeCaches();
    const app = buildApp({ embed: false, closeDate: PAST_CLOSE });
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("Call for papers");
    expect(html).not.toContain("Submit a talk");
    // the rest of the rail still renders
    expect(html).toContain('class="chq-pub-sessions-rail"');
  });

  it("/embed/<slug>/sessions renders none of the rail/Save and emits no href outside /embed", async () => {
    installFakeCaches();
    const app = buildApp({ embed: true, closeDate: FUTURE_CLOSE });
    const res = await app.request("/embed/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Assertions target rendered MARKUP (element context), not bare class
    // names — the <style> block legitimately defines .chq-pub-sessions-rail
    // etc. for every surface regardless of embed, so a bare substring check
    // would false-negative against the stylesheet text itself.
    expect(html).not.toContain('<aside class="chq-pub-sessions-rail"');
    expect(html).not.toContain('class="chq-itinerary-toggle"');
    expect(html).not.toContain('id="chq-ics-link"');
    expect(html).not.toContain('id="chq-ics-count"');
    expect(html).not.toContain('class="chq-pub-save"');
    expect(html).not.toContain("Call for papers");
    expect(html).not.toContain("Submit a talk");
    // DEC-672: chromeless surface is closed both ways -- no href may point
    // at the full-chrome /e/... surface or at /submit/...
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const href of hrefs) {
      expect(href.startsWith("/e/") || href.startsWith("/submit/")).toBe(false);
    }
  });
});

describe("getPublicScheduleDayCounts (DEC-683)", () => {
  it("returns a grouped, day-ordered session count per day", async () => {
    let capturedWhere: unknown;
    const db = {
      select: () =>
        makeChain(
          [
            { day: "2026-08-10", count: 2 },
            { day: "2026-08-11", count: 1 },
          ],
          (cond) => (capturedWhere = cond),
        ),
    } as unknown as AppEnv["Variables"]["db"];
    const { getPublicScheduleDayCounts } = await import("../src/server/repo/public/agenda");
    const rows = await getPublicScheduleDayCounts(db as any, EVENT);
    expect(rows).toEqual([
      { day: "2026-08-10", count: 2 },
      { day: "2026-08-11", count: 1 },
    ]);
    // the session visibility gate is still ANDed into the query
    const tokens = walkCondition(capturedWhere);
    expect(tokens).toContain('val:"accepted"');
    expect(tokens).toContain('val:"approved"');
  });
});
