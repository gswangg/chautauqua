// DEC-516: the paged public JSON feeds (sessions.json / speakers.json /
// gallery.json) get a real one-page SQL window (LIMIT+OFFSET via
// boundedWindow) instead of a cumulative prefix sliced in the route, while
// the HTML show-more list (which re-fetches "everything through this page"
// on every click) keeps its cumulative behavior unchanged. Same
// fake-db-chain pattern as test/public-feeds.test.ts — makeChain here
// actually honors limit()/offset() so the fake behaves like a real SQL
// window, exercising the production windowing logic rather than a stand-in.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

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

function makeChain(rows: unknown[]) {
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

const N = 30;
const sessionIds = Array.from({ length: N }, (_, i) => `sub${i}`);
const speakerIds = Array.from({ length: N }, (_, i) => `c${i}`);

function buildSessionsApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) {
        return makeChain(
          sessionIds.map((id, i) => ({ id, seq: i + 1, title: `Talk ${i}`, description: null, icsSequence: 0 })),
        );
      }
      if (selectCall === 3) return makeChain([]); // trackRows
      if (selectCall === 4) return makeChain([]); // speakerRows
      if (selectCall === 5) return makeChain([]); // slotRows
      if (selectCall === 6) return makeChain([]); // formatRows
      return makeChain([{ count: N }]); // countVisibleSubmissions
    },
    selectDistinct: () => makeChain(sessionIds.map((id, i) => ({ id, title: `Talk ${i}` }))),
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

// A page whose window lands entirely past the ceiling gets zero ids back
// from the id query, so hydrateSessions short-circuits (ids.length === 0)
// without issuing its usual subRows/trackRows/speakerRows/slotRows selects —
// countVisibleSubmissions' select() becomes call #2, not #6. A distinct
// builder (rather than reusing buildSessionsApp's position-based dispatch)
// keeps that real short-circuit honest instead of hand-waving it away.
function buildSessionsAppPastCeiling() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      return makeChain([{ count: N }]); // countVisibleSubmissions (hydrate short-circuited)
    },
    selectDistinct: () => makeChain(sessionIds.map((id, i) => ({ id, title: `Talk ${i}` }))),
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

// The HTML dispatch path calls getPublicTracks(db, event.id) before
// getPublicSessions, one extra select() ahead of hydrateSessions' own calls.
function buildSessionsAppHtml() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([]); // getPublicRooms (DEC-774)
      if (selectCall === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
      if (selectCall === 5) {
        return makeChain(
          sessionIds.map((id, i) => ({ id, seq: i + 1, title: `Talk ${i}`, description: null, icsSequence: 0 })),
        );
      }
      if (selectCall === 6) return makeChain([]); // trackRows
      if (selectCall === 7) return makeChain([]); // speakerRows
      if (selectCall === 8) return makeChain([]); // slotRows
      if (selectCall === 9) return makeChain([]); // formatRows
      if (selectCall === 10) return makeChain([{ count: N }]); // countVisibleSubmissions
      // DEC-683: !embed sessions rail queries — real (empty) row shapes so
      // DayIndexRailSection/CfpRailSection never see the count-shaped row.
      if (selectCall === 11) return makeChain([]); // getPublicScheduleDayCounts
      return makeChain([]); // getPublicCfpWindow
    },
    selectDistinct: () => makeChain(sessionIds.map((id, i) => ({ id, title: `Talk ${i}` }))),
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

function buildSpeakersApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (selectCall === 2) return makeChain([{ total: N }]); // countRows
      return makeChain(
        speakerIds.map((id, i) => ({
          contactId: id,
          firstName: "First",
          lastName: `Last${i}`,
          title: null,
          company: null,
          headshotUrl: null,
          bio: null,
          submissionId: `sub-${id}`,
          submissionTitle: "Talk",
        })),
      );
    },
    selectDistinct: () => makeChain(speakerIds.map((id) => ({ contactId: id }))),
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

async function fetchJson(app: Hono<AppEnv>, path: string) {
  installFakeCaches();
  const res = await app.request(path, {}, TEST_ENV);
  expect(res.status).toBe(200);
  return (await res.json()) as { items: Array<Record<string, unknown>>; total: number; page: number; perPage: number };
}

describe("DEC-516: /embed/:eventSlug/sessions.json real one-page window", () => {
  it("page 1 and page 2 are disjoint windows", async () => {
    const page1 = await fetchJson(buildSessionsApp(), "/embed/conf/sessions.json?page=1&limit=10");
    const page2 = await fetchJson(buildSessionsApp(), "/embed/conf/sessions.json?page=2&limit=10");
    const ids1 = new Set(page1.items.map((i) => i.id));
    const ids2 = new Set(page2.items.map((i) => i.id));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });

  it("items.length <= perPage on every page", async () => {
    for (const page of [1, 2, 3]) {
      const body = await fetchJson(buildSessionsApp(), `/embed/conf/sessions.json?page=${page}&limit=10`);
      expect(body.items.length).toBeLessThanOrEqual(body.perPage);
    }
  });

  it("total is the full unwindowed count, not the page size", async () => {
    const body = await fetchJson(buildSessionsApp(), "/embed/conf/sessions.json?page=1&limit=10");
    expect(body.total).toBe(N);
  });

  it("a page past the MAX_PUBLIC_ROWS ceiling returns an empty items array with a truthful total", async () => {
    // page is clamped to MAX_PUBLIC_PAGE (100); a large ?limit= pushes
    // offset = (page-1)*limit past MAX_PUBLIC_ROWS (1200) well before the
    // page-number clamp does.
    const body = await fetchJson(buildSessionsAppPastCeiling(), "/embed/conf/sessions.json?page=100&limit=100");
    expect(body.items).toEqual([]);
    expect(body.total).toBe(N);
  });
});

describe("DEC-516: /embed/:eventSlug/speakers.json real one-page window", () => {
  it("page 1 and page 2 are disjoint windows", async () => {
    const page1 = await fetchJson(buildSpeakersApp(), "/embed/conf/speakers.json?page=1&limit=10");
    const page2 = await fetchJson(buildSpeakersApp(), "/embed/conf/speakers.json?page=2&limit=10");
    const ids1 = new Set(page1.items.map((i) => i.contactId));
    const ids2 = new Set(page2.items.map((i) => i.contactId));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });

  it("items.length <= perPage on every page", async () => {
    for (const page of [1, 2, 3]) {
      const body = await fetchJson(buildSpeakersApp(), `/embed/conf/speakers.json?page=${page}&limit=10`);
      expect(body.items.length).toBeLessThanOrEqual(body.perPage);
    }
  });

  it("total is the full unwindowed count, not the page size", async () => {
    const body = await fetchJson(buildSpeakersApp(), "/embed/conf/speakers.json?page=1&limit=10");
    expect(body.total).toBe(N);
  });

  it("a page past the MAX_PUBLIC_ROWS ceiling returns an empty items array with a truthful total", async () => {
    const body = await fetchJson(buildSpeakersApp(), "/embed/conf/speakers.json?page=100&limit=100");
    expect(body.items).toEqual([]);
    expect(body.total).toBe(N);
  });
});

describe("DEC-516: HTML /e/:eventSlug/sessions show-more stays CUMULATIVE", () => {
  it("page 2 of the HTML list is a superset of page 1 (unlike the .json feed)", async () => {
    installFakeCaches();
    const app1 = buildSessionsAppHtml();
    const res1 = await app1.request("/e/conf/sessions?page=1&limit=10", {}, TEST_ENV);
    expect(res1.status).toBe(200);
    const html1 = await res1.text();

    installFakeCaches();
    const app2 = buildSessionsAppHtml();
    const res2 = await app2.request("/e/conf/sessions?page=2&limit=10", {}, TEST_ENV);
    expect(res2.status).toBe(200);
    const html2 = await res2.text();

    // Every session title rendered on page 1 is still present on page 2 —
    // the show-more list re-fetches "everything through this page" every
    // time, so page 2 is page 1's rows plus more, never a disjoint window.
    for (let i = 0; i < 10; i++) {
      expect(html1).toContain(`Talk ${i}`);
      expect(html2).toContain(`Talk ${i}`);
    }
    for (let i = 10; i < 20; i++) {
      expect(html2).toContain(`Talk ${i}`);
    }
  });
});
