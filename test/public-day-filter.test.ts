// DEC-634: ?day= on the public sessions surface (list + .json feed) is now a
// SQL-level predicate on getVisibleSubmissionIdsOrdered/countVisibleSubmissions
// (an innerJoin on schedule_slot via dayFilterJoinCondition, honoring the
// SAME event-window rule as slotWithinEventRange/DEC-318) instead of a
// post-pagination `.filter()` in the route. This file has two halves:
//  1. a unit-level capture of the innerJoin condition passed to both the id
//     query and the count query, proving `day` reaches the SAME predicate
//     LIMIT/OFFSET and COUNT both see (mirrors test/public-agenda-event-
//     range.test.ts's walkCondition convention — no local sqlite/D1 test
//     driver is wired up, so WHERE/JOIN conditions are captured and walked
//     rather than executed);
//  2. HTTP-level windowing tests (mirrors test/public-feed-window.test.ts's
//     makeChain, which honors limit()/offset() for real) proving that once
//     the repo has already scoped rows to a day (as the real SQL predicate
//     would), page 2 of a day-filtered feed returns the NEXT window rather
//     than nothing, and `total` is the day's full count, not a page size.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { getPublicSessions } from "../src/server/repo/public";
import type { PublicEvent } from "../src/server/repo/public";
import type { Db } from "../src/server/context";
import { PUBLIC_PER_PAGE } from "../src/server/repo/public/bounds";

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

const DAY_A = "2026-08-10";

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

describe("getPublicSessions (DEC-634): day is a SQL predicate, not a post-page sieve", () => {
  it("threads `day` into the id query's innerJoin condition", async () => {
    let capturedJoinCond: unknown;
    const db = {
      selectDistinct: () => {
        const chain: any = {
          from: () => chain,
          leftJoin: () => chain,
          innerJoin: (_table: unknown, cond: unknown) => {
            capturedJoinCond = cond;
            return chain;
          },
          where: () => chain,
          orderBy: () => chain,
          limit: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve([]),
        };
        return chain;
      },
      select: () => {
        const chain: any = {
          from: () => chain,
          leftJoin: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve([{ count: 0 }]),
        };
        return chain;
      },
    } as unknown as Db;

    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, day: DAY_A });

    const tokens = walkCondition(capturedJoinCond);
    expect(tokens).toContain("col:day");
    expect(tokens).toContain(`val:${JSON.stringify(DAY_A)}`);
    // slotWithinEventRange's own bound travels along in the SAME condition.
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.startDate)}`);
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.endDate)}`);
  });

  it("threads `day` into the count query's innerJoin condition too — SAME predicate as the id query", async () => {
    let capturedCountJoinCond: unknown;
    const db = {
      selectDistinct: () => {
        const chain: any = {
          from: () => chain,
          leftJoin: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve([]),
        };
        return chain;
      },
      select: () => {
        const chain: any = {
          from: () => chain,
          leftJoin: () => chain,
          innerJoin: (_table: unknown, cond: unknown) => {
            capturedCountJoinCond = cond;
            return chain;
          },
          where: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve([{ count: 0 }]),
        };
        return chain;
      },
    } as unknown as Db;

    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, day: DAY_A });

    const tokens = walkCondition(capturedCountJoinCond);
    expect(tokens).toContain("col:day");
    expect(tokens).toContain(`val:${JSON.stringify(DAY_A)}`);
  });
});

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

// 15 sessions on DAY_A (more than PUBLIC_PER_PAGE=12) + 5 on DAY_B — as the
// real SQL day predicate would already have scoped rows to a single day,
// these fakes are pre-scoped per-request the same way test/public-agenda-
// event-range.test.ts's convention documents ("the real SQL excludes the
// out-of-range row at the source — the fake mirrors that by never handing
// it back").
const DAY_A_IDS = Array.from({ length: 15 }, (_, i) => `a${i}`);
const DAY_A_TITLES = DAY_A_IDS.map((id, i) => `DayA-${i}-${id}`);

function makeWindowChain(rows: unknown[]) {
  let lim: number | undefined;
  let off = 0;
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: (n: number) => {
      lim = n;
      return chain;
    },
    offset: (n: number) => {
      off = n;
      return chain;
    },
    then: (resolve: (v: unknown[]) => void) => {
      const end = lim === undefined ? undefined : off + lim;
      resolve(rows.slice(off, end));
    },
  };
  return chain;
}

// Builds a fake db whose id-query/count-query already reflect the DAY_A-only
// scope (as the real DEC-634 SQL predicate would produce) — proving the
// route/repo wiring (window math, `total`, item hydration) is correct once
// the predicate has done its job, same division of labor as public-feed-
// window.test.ts.
function buildSessionsAppDayA() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) {
        return makeWindowChain([
          {
            id: "ev1",
            orgId: "org1",
            name: "Test Event",
            slug: "conf",
            startDate: EVENT.startDate,
            endDate: EVENT.endDate,
            location: null,
            timezone: "UTC",
            recordPrefix: "SES",
            brandingJson: null,
          },
        ]); // getPublicEventBySlug
      }
      if (selectCall === 2) {
        return makeWindowChain(
          DAY_A_IDS.map((id, i) => ({
            id,
            seq: i + 1,
            title: DAY_A_TITLES[i],
            description: null,
            icsSequence: 0,
          })),
        );
      }
      if (selectCall === 3) return makeWindowChain([]); // trackRows
      if (selectCall === 4) return makeWindowChain([]); // speakerRows
      if (selectCall === 5) return makeWindowChain([]); // slotRows
      if (selectCall === 6) return makeWindowChain([]); // formatRows
      return makeWindowChain([{ count: DAY_A_IDS.length }]); // countVisibleSubmissions (DAY_A-scoped)
    },
    selectDistinct: () => makeWindowChain(DAY_A_IDS.map((id, i) => ({ id, title: DAY_A_TITLES[i] }))),
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

// HTML dispatch inserts one extra select() (getPublicTracks) ahead of
// hydrateSessions' own calls, matching buildSessionsAppHtml's convention in
// test/public-feed-window.test.ts.
function buildSessionsAppDayAHtml() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) {
        return makeWindowChain([
          {
            id: "ev1",
            orgId: "org1",
            name: "Test Event",
            slug: "conf",
            startDate: EVENT.startDate,
            endDate: EVENT.endDate,
            location: null,
            timezone: "UTC",
            recordPrefix: "SES",
            brandingJson: null,
          },
        ]);
      }
      if (selectCall === 2) return makeWindowChain([]); // getPublicTracks
      if (selectCall === 3) return makeWindowChain([]); // getPublicRooms (DEC-774)
      if (selectCall === 4) return makeWindowChain([]); // getPublicFormatOptions (DEC-774)
      if (selectCall === 5) {
        return makeWindowChain(
          DAY_A_IDS.map((id, i) => ({
            id,
            seq: i + 1,
            title: DAY_A_TITLES[i],
            description: null,
            icsSequence: 0,
          })),
        );
      }
      if (selectCall === 6) return makeWindowChain([]); // trackRows
      if (selectCall === 7) return makeWindowChain([]); // speakerRows
      if (selectCall === 8) return makeWindowChain([]); // slotRows
      if (selectCall === 9) return makeWindowChain([]); // formatRows
      if (selectCall === 10) return makeWindowChain([{ count: DAY_A_IDS.length }]); // countVisibleSubmissions
      // DEC-683: dispatch.tsx's !embed sessions case also fetches these two
      // rail queries — real row shapes here (never the count-shaped
      // fallback) so DayIndexRailSection's formatDay(d.day) never sees an
      // undefined day.
      if (selectCall === 11) return makeWindowChain([]); // getPublicScheduleDayCounts
      return makeWindowChain([]); // getPublicCfpWindow (no default form)
    },
    selectDistinct: () => makeWindowChain(DAY_A_IDS.map((id, i) => ({ id, title: DAY_A_TITLES[i] }))),
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

describe("/e/:eventSlug/sessions?day= (DEC-634)", () => {
  it("returns only that day's sessions, and total is the day's full count (not the page window)", async () => {
    installFakeCaches();
    const app = buildSessionsAppDayAHtml();
    const res = await app.request(`/e/conf/sessions?day=${DAY_A}&limit=${PUBLIC_PER_PAGE}`, {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Only PUBLIC_PER_PAGE rendered on page 1, but the reported total is the
    // day's full 15 — never derived from items.length.
    expect(html).toContain(`${PUBLIC_PER_PAGE} of ${DAY_A_IDS.length} sessions`);
    for (let i = 0; i < PUBLIC_PER_PAGE; i++) expect(html).toContain(DAY_A_TITLES[i]);
  });
});

describe("/embed/:eventSlug/sessions.json?day= (DEC-634)", () => {
  async function fetchJson(app: Hono<AppEnv>, path: string) {
    installFakeCaches();
    const res = await app.request(path, {}, TEST_ENV);
    expect(res.status).toBe(200);
    return (await res.json()) as { items: Array<Record<string, unknown>>; total: number; page: number; perPage: number };
  }

  it("total equals the day's full count, not the count within one page", async () => {
    const body = await fetchJson(
      buildSessionsAppDayA(),
      `/embed/conf/sessions.json?day=${DAY_A}&page=1&limit=${PUBLIC_PER_PAGE}`,
    );
    expect(body.total).toBe(DAY_A_IDS.length);
    expect(body.items.length).toBe(PUBLIC_PER_PAGE);
  });

  it("page 2 of a day-filtered list returns the NEXT window, not nothing", async () => {
    const page1 = await fetchJson(
      buildSessionsAppDayA(),
      `/embed/conf/sessions.json?day=${DAY_A}&page=1&limit=${PUBLIC_PER_PAGE}`,
    );
    const page2 = await fetchJson(
      buildSessionsAppDayA(),
      `/embed/conf/sessions.json?day=${DAY_A}&page=2&limit=${PUBLIC_PER_PAGE}`,
    );
    expect(page1.items.length).toBe(PUBLIC_PER_PAGE);
    // 15 total, 12 per page -> page 2 has the remaining 3, never empty.
    expect(page2.items.length).toBe(DAY_A_IDS.length - PUBLIC_PER_PAGE);
    expect(page2.items.length).toBeGreaterThan(0);
    const ids1 = new Set(page1.items.map((i) => i.id));
    const ids2 = new Set(page2.items.map((i) => i.id));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });
});
