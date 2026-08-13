// EMB-15 (DEC-289): public JSON + iCal feeds for the embed surfaces. Same
// fake-db-chain harness as test/public.test.ts (no local sqlite/D1 test
// driver wired up — see package.json); route/query-gate visibility itself
// is covered by test/public-invite-visibility.test.ts's source scan of
// visibleSessionConditions()/visibleSubmissionConditions() plus this file's
// "route only returns what the repo hands it" regression below.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { buildSurfaceFeed, buildSurfaceFeedXml, agendaIcsEvents } from "../src/routes/public/feeds";
import type { PublicEvent, PublicAgendaItem } from "../src/server/repo/public";
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

// DEC-516: limit()/offset() are real chain steps (not an immediately-
// resolving terminal) so this fake behaves like a real SQL LIMIT/OFFSET —
// slicing `rows` at await-time by whatever the production code actually
// passed. A query that never calls .limit() (e.g. the plain count queries)
// gets the full `rows` array, matching an unbounded SELECT.
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
    as: () => chain,
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

// Simulates the /sessions surface with exactly one visible session in play
// ("Visible Talk"). A submission that failed visibleSessionConditions()
// never makes it into getVisibleSubmissionIdsOrdered's selectDistinct
// result in the first place — this fake mirrors that by construction, so
// the only way a "Hidden Talk" title could show up here is if the route
// handler queried around the repo instead of through it.
//
// The HTML dispatch (renderSurfaceContent) additionally calls
// getPublicTracks before getPublicSessions; the JSON feed path calls
// getPublicSessions directly (the tracks list isn't part of the DEC-289
// item shape), so the two select()-call sequences differ by that one call
// — hence two builders below rather than one shared by call-count.
function buildHtmlApp() {
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
        return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
      }
      // 6: hydrateSessions trackRows
      if (selectCall === 6) return makeChain([]);
      // 7: hydrateSessions speakerRows
      if (selectCall === 7) return makeChain([]);
      // 8: hydrateSessions slotRows
      if (selectCall === 8) return makeChain([]);
      // 9: hydrateSessions formatRows
      return makeChain([]);
    },
    selectDistinct: () => makeChain([{ id: "sub1", title: "Visible Talk" }]),
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

function buildJsonApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      // 1: getPublicEventBySlug
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      // 2: hydrateSessions subRows
      if (selectCall === 2) {
        return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
      }
      // 3: hydrateSessions trackRows
      if (selectCall === 3) return makeChain([]);
      // 4: hydrateSessions speakerRows
      if (selectCall === 4) return makeChain([]);
      // 5: hydrateSessions slotRows
      if (selectCall === 5) return makeChain([]);
      // 6: hydrateSessions formatRows
      return makeChain([]);
    },
    selectDistinct: () => makeChain([{ id: "sub1", title: "Visible Talk" }]),
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

describe("GET /embed/:eventSlug/:surface (route-ordering regression)", () => {
  it("still returns HTML for the plain (non-.json) surface path", async () => {
    installFakeCaches();
    const app = buildHtmlApp();
    const res = await app.request("/embed/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Visible Talk");
  });
});

describe("GET /embed/:eventSlug/:surface.json (EMB-15)", () => {
  it("returns the DEC-289 envelope with application/json", async () => {
    installFakeCaches();
    const app = buildJsonApp();
    const res = await app.request("/embed/conf/sessions.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = (await res.json()) as {
      surface: string;
      event: Record<string, unknown>;
      generatedAt: string;
      items: Array<{ title: string }>;
    };
    expect(body.surface).toBe("sessions");
    expect(body.event).toMatchObject({ slug: "conf", name: "Test Event", timezone: "UTC" });
    expect(typeof body.generatedAt).toBe("string");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.title).toBe("Visible Talk");
  });

  it("never surfaces a submission the repo didn't hand it (visibility gate stays single-sourced)", async () => {
    installFakeCaches();
    const app = buildJsonApp();
    const res = await app.request("/embed/conf/sessions.json", {}, TEST_ENV);
    const body = (await res.json()) as { items: Array<{ title: string }> };
    const titles = body.items.map((i) => i.title);
    expect(titles).not.toContain("Hidden Talk");
  });

  it("404s on an unknown surface name", async () => {
    installFakeCaches();
    const app = buildJsonApp();
    const res = await app.request("/embed/conf/bogus.json", {}, TEST_ENV);
    expect(res.status).toBe(404);
  });
});

describe("GET /embed/:eventSlug/:surface.xml (DEC-775, .json twin)", () => {
  it("returns application/xml with an item count matching the .json twin", async () => {
    installFakeCaches();
    const jsonRes = await buildJsonApp().request("/embed/conf/sessions.json", {}, TEST_ENV);
    expect(jsonRes.status).toBe(200);
    const jsonBody = (await jsonRes.json()) as { items: unknown[] };

    installFakeCaches();
    const xmlRes = await buildJsonApp().request("/embed/conf/sessions.xml", {}, TEST_ENV);
    expect(xmlRes.status).toBe(200);
    expect(xmlRes.headers.get("Content-Type")).toContain("application/xml");
    const xmlBody = await xmlRes.text();
    const itemCount = (xmlBody.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(jsonBody.items.length);
    expect(xmlBody).toContain("Visible Talk");
  });

  it("404s on an unknown surface name", async () => {
    installFakeCaches();
    const app = buildJsonApp();
    const res = await app.request("/embed/conf/bogus.xml", {}, TEST_ENV);
    expect(res.status).toBe(404);
  });
});

describe("GET /embed/:eventSlug/speakers.json paging (DEC-484)", () => {
  function buildSpeakersApp(idRows: { contactId: string }[], total: number) {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: getPublicSpeakers countRows
        if (selectCall === 2) return makeChain([{ total }]);
        // 3+: getPublicSpeakers hydration batch(es)
        return makeChain(
          idRows.map((r) => ({
            contactId: r.contactId,
            firstName: "First",
            lastName: r.contactId,
            title: null,
            company: null,
            headshotUrl: null,
            bio: null,
            submissionId: `sub-${r.contactId}`,
            submissionTitle: "Talk",
          })),
        );
      },
      selectDistinct: () => makeChain(idRows),
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

  function contactIds(n: number, offset = 0) {
    return Array.from({ length: n }, (_, i) => ({ contactId: `c${i + offset}` }));
  }

  it("reports the full total with one page of items when there are more speakers than one page", async () => {
    installFakeCaches();
    const app = buildSpeakersApp(contactIds(12), 15);
    const res = await app.request("/embed/conf/speakers.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; page: number; perPage: number; items: unknown[] };
    expect(body.total).toBe(15);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(12);
    expect(body.items).toHaveLength(12);
  });

  it("?limit=50 returns 50 items and perPage=50", async () => {
    installFakeCaches();
    const app = buildSpeakersApp(contactIds(50), 60);
    const res = await app.request("/embed/conf/speakers.json?limit=50", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; page: number; perPage: number; items: unknown[] };
    expect(body.total).toBe(60);
    expect(body.perPage).toBe(50);
    expect(body.items).toHaveLength(50);
  });

  it("?page=2 advances the window", async () => {
    installFakeCaches();
    // DEC-516: the repo now runs a real LIMIT+OFFSET (boundedWindow) — this
    // fake's selectDistinct holds all 15 underlying rows and the chain's
    // limit()/offset() slice them, exactly like a real SQL window would
    // (page 2 of 12 leaves the last 3 rows).
    const app = buildSpeakersApp(contactIds(15), 15);
    const res = await app.request("/embed/conf/speakers.json?page=2", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; page: number; perPage: number; items: unknown[] };
    expect(body.total).toBe(15);
    expect(body.page).toBe(2);
    expect(body.perPage).toBe(12);
    expect(body.items).toHaveLength(3);
  });
});

describe("GET /embed/:eventSlug/agenda.json (DEC-484 unpaged surface)", () => {
  it("reports total === items.length", async () => {
    installFakeCaches();
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: DEC-548 getPublicAgenda's total count(*) subquery
        if (selectCall === 2) return makeChain([{ count: 1 }]);
        // 3: hydrateSessions subRows
        if (selectCall === 3) {
          return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
        }
        // 4: hydrateSessions trackRows
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions speakerRows
        if (selectCall === 5) return makeChain([]);
        // 6: hydrateSessions slotRows
        if (selectCall === 6) return makeChain([]);
        // 7: hydrateSessions formatRows
        return makeChain([]);
      },
      selectDistinct: () =>
        makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: null }]),
    } as unknown as AppEnv["Variables"]["db"];

    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", publicRoutes);

    const res = await app.request("/embed/conf/agenda.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; page: number; perPage: number; items: unknown[] };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(body.items.length);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(body.items.length);
  });
});

// DEC-516: the repo calls behind sessions/speakers/gallery now run a real
// SQL LIMIT+OFFSET window (boundedWindow) when the JSON feed passes
// `window: true`, rather than a cumulative prefix sliced at the route. These
// fakes hold the full N-row underlying set and let the chain's limit()/
// offset() (see makeChain above) do the actual windowing, exactly like a
// real SQL engine would — so the assertions below exercise the real
// windowing path, not a route-level slice.
describe("GET /embed/:eventSlug/*.json single-page window (DEC-516)", () => {
  const N = 24;
  const sessionIds = Array.from({ length: N }, (_, i) => `sub${i}`);

  function buildCumulativeSessionsApp() {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        if (selectCall === 2) {
          return makeChain(
            sessionIds.map((id, i) => ({
              id,
              seq: i + 1,
              title: `Talk ${i}`,
              description: null,
              icsSequence: 0,
              // This shape leaks into later requests' formatRows position
              // when this db/app is reused across several fetchItems()
              // calls (its selectCall counter never resets) — carrying a
              // harmless valueJson keeps JSON.parse from throwing in that
              // case, same as every other field on this shape being
              // harmlessly undefined to the non-subRows consumers.
              valueJson: JSON.stringify(null),
            })),
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

  const speakerIds = Array.from({ length: N }, (_, i) => `c${i}`);

  function buildCumulativeSpeakersApp() {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        if (selectCall === 2) return makeChain([{ total: N }]);
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

  async function fetchItems(app: Hono<AppEnv>, path: string) {
    installFakeCaches();
    const res = await app.request(path, {}, TEST_ENV);
    expect(res.status).toBe(200);
    return (await res.json()) as { items: Array<Record<string, unknown>>; total: number; page: number; perPage: number };
  }

  it("sessions.json: page=1 and page=2 return disjoint 12-item windows whose concatenation is the first 24 rows in order", async () => {
    const page1 = await fetchItems(buildCumulativeSessionsApp(), "/embed/conf/sessions.json?page=1&limit=12");
    const page2 = await fetchItems(buildCumulativeSessionsApp(), "/embed/conf/sessions.json?page=2&limit=12");
    expect(page1.items).toHaveLength(12);
    expect(page2.items).toHaveLength(12);
    const titles1 = page1.items.map((i) => i.title);
    const titles2 = page2.items.map((i) => i.title);
    expect(titles1).toEqual(sessionIds.slice(0, 12).map((_, i) => `Talk ${i}`));
    expect(titles2).toEqual(sessionIds.slice(12, 24).map((_, i) => `Talk ${i + 12}`));
    expect([...titles1, ...titles2]).toEqual(Array.from({ length: 24 }, (_, i) => `Talk ${i}`));
    expect(page1.total).toBe(page2.total);
    expect(page1.total).toBe(24);
  });

  it("speakers.json: page=1 and page=2 return disjoint 12-item windows whose concatenation is the first 24 rows in order", async () => {
    const page1 = await fetchItems(buildCumulativeSpeakersApp(), "/embed/conf/speakers.json?page=1&limit=12");
    const page2 = await fetchItems(buildCumulativeSpeakersApp(), "/embed/conf/speakers.json?page=2&limit=12");
    expect(page1.items).toHaveLength(12);
    expect(page2.items).toHaveLength(12);
    const ids1 = page1.items.map((i) => i.contactId);
    const ids2 = page2.items.map((i) => i.contactId);
    expect(ids1).toEqual(speakerIds.slice(0, 12));
    expect(ids2).toEqual(speakerIds.slice(12, 24));
    expect([...ids1, ...ids2]).toEqual(speakerIds);
    expect(page1.total).toBe(page2.total);
    expect(page1.total).toBe(24);
  });

  it("gallery.json (same repo call as speakers): page=1 and page=2 return disjoint 12-item windows whose concatenation is the first 24 rows in order", async () => {
    const page1 = await fetchItems(buildCumulativeSpeakersApp(), "/embed/conf/gallery.json?page=1&limit=12");
    const page2 = await fetchItems(buildCumulativeSpeakersApp(), "/embed/conf/gallery.json?page=2&limit=12");
    expect(page1.items).toHaveLength(12);
    expect(page2.items).toHaveLength(12);
    const ids1 = page1.items.map((i) => i.contactId);
    const ids2 = page2.items.map((i) => i.contactId);
    expect([...ids1, ...ids2]).toEqual(speakerIds);
  });

  it("items.length <= perPage holds for every paged surface, including the last partial page", async () => {
    for (const surface of ["sessions", "speakers", "gallery"]) {
      for (const page of [1, 2, 3]) {
        // A fresh app/db per page (rather than one shared instance across
        // all three requests) — the fake's selectCall counter is keyed to
        // one request's own call sequence and never resets between
        // app.request() calls, so reusing it across pages misaligns which
        // branch answers which query on page >= 2.
        const app = surface === "sessions" ? buildCumulativeSessionsApp() : buildCumulativeSpeakersApp();
        const body = await fetchItems(app, `/embed/conf/${surface}.json?page=${page}&limit=12`);
        expect(body.items.length).toBeLessThanOrEqual(body.perPage);
      }
    }
  });

  // page=3&limit=12 windows to offset 24 on a 24-row set, so the id query
  // returns [] and hydrateSessions short-circuits (ids.length === 0)
  // without its usual subRows/trackRows/speakerRows/slotRows selects —
  // countVisibleSubmissions' select() becomes call #2, not #6.
  function buildSessionsAppPastEnd() {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        return makeChain([{ count: N }]);
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

  it("a page past the end returns items: [] with the true total (honest empty page, not an error)", async () => {
    const sessionsPast = await fetchItems(buildSessionsAppPastEnd(), "/embed/conf/sessions.json?page=3&limit=12");
    expect(sessionsPast.items).toEqual([]);
    expect(sessionsPast.total).toBe(24);

    const speakersPast = await fetchItems(buildCumulativeSpeakersApp(), "/embed/conf/speakers.json?page=3&limit=12");
    expect(speakersPast.items).toEqual([]);
    expect(speakersPast.total).toBe(24);
  });

  function buildCumulativeSessionsAppHtml() {
    // Same as buildCumulativeSessionsApp, but the HTML dispatch path
    // (renderSurfaceContent) calls getPublicTracks(db, event.id) before
    // getPublicSessions, inserting one extra select() call ahead of
    // hydrateSessions' subRows/trackRows/speakerRows/slotRows.
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
            sessionIds.map((id, i) => ({
              id,
              seq: i + 1,
              title: `Talk ${i}`,
              description: null,
              icsSequence: 0,
            })),
          );
        }
        if (selectCall === 6) return makeChain([]); // trackRows (hydrate)
        if (selectCall === 7) return makeChain([]); // speakerRows
        if (selectCall === 8) return makeChain([]); // slotRows
        if (selectCall === 9) return makeChain([]); // formatRows
        if (selectCall === 10) return makeChain([{ count: N }]); // countVisibleSubmissions
        // DEC-683: !embed sessions rail queries — real (empty) row shapes.
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

  it("regression: the HTML surface at /e/:slug/sessions?page=2 still renders the cumulative 24 rows (show-more must not change)", async () => {
    installFakeCaches();
    const app = buildCumulativeSessionsAppHtml();
    const res = await app.request("/e/conf/sessions?page=2&limit=12", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Cumulative show-more: page 2 of the HTML list still contains page 1's
    // first item alongside page 2's rows — unlike the .json feed above.
    expect(html).toContain("Talk 0");
    expect(html).toContain("Talk 23");
  });
});

describe("buildSurfaceFeed", () => {
  it("shapes the DEC-289/DEC-484 envelope, passing items through unchanged", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const items = [{ id: "sub1", title: "Visible Talk" }];
    const feed = buildSurfaceFeed(EVENT, "sessions", { items, total: 1, page: 1, perPage: 12 }, now);
    expect(feed).toEqual({
      event: { slug: "conf", name: "Test Event", timezone: "UTC", startDate: "2026-08-10", endDate: "2026-08-11" },
      surface: "sessions",
      generatedAt: "2026-08-11T12:00:00.000Z",
      page: 1,
      perPage: 12,
      total: 1,
      items,
    });
  });
});

describe("buildSurfaceFeedXml (DEC-775)", () => {
  it("escapes &, <, >, \", ' in both attributes and text nodes, and omits null fields rather than emitting the string 'null'", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const items = [{ id: "sub1", title: `A & B <script>"x'</script>`, description: null }];
    const xml = buildSurfaceFeedXml(EVENT, "sessions", { items, total: 1, page: 1, perPage: 12 }, now);
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain(`"x'`);
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&quot;x&apos;&lt;/script&gt;");
    expect(xml).not.toContain("<description>");
    expect(xml).not.toContain(">null<");
  });

  it("shapes the same envelope as buildSurfaceFeed: event attributes, feed-level surface/generatedAt/page/perPage/total, repeated <item>s", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const items = [
      { id: "sub1", title: "Visible Talk", tracks: [{ id: "t1", name: "Track One" }] },
      { id: "sub2", title: "Another Talk", tracks: [] },
    ];
    const xml = buildSurfaceFeedXml(EVENT, "sessions", { items, total: 2, page: 1, perPage: 12 }, now);
    expect(xml).toContain('<feed surface="sessions" generatedAt="2026-08-11T12:00:00.000Z" page="1" perPage="12" total="2">');
    expect(xml).toContain('<event slug="conf" name="Test Event" timezone="UTC" startDate="2026-08-10" endDate="2026-08-11"/>');
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<tracks><id>t1</id><name>Track One</name></tracks>");
  });
});

describe("agendaIcsEvents", () => {
  it("maps agenda items to IcsEventInput with the schedule.ics-identical UID/SEQUENCE fields", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const agendaItems: PublicAgendaItem[] = [
      {
        submissionId: "sub1",
        ref: "SES-1",
        title: "Visible Talk",
        description: "A talk.",
        day: "2026-08-10",
        startMin: 540,
        endMin: 600,
        roomId: "room1",
        roomName: "Main Hall",
        roomPosition: 0,
        icsSequence: 3,
        tracks: [],
        speakers: [],
        format: null,
      },
    ];
    const [ev] = agendaIcsEvents(EVENT, agendaItems, now);
    expect(ev).toBeDefined();
    if (!ev) throw new Error("expected one mapped ICS event");
    expect(ev).toMatchObject({
      uidSubmissionId: "sub1",
      sequence: 3,
      title: "Visible Talk",
      description: "A talk.",
      location: "Main Hall",
      dtstamp: now,
    });
    expect(ev.startUtc.toISOString()).toBe("2026-08-10T09:00:00.000Z");
    expect(ev.endUtc.toISOString()).toBe("2026-08-10T10:00:00.000Z");
  });
});

describe("GET /e/:eventSlug/agenda.ics (EMB-15 whole-agenda export)", () => {
  // agenda.ics goes through getPublicAgenda (DEC-548: one extra count(*)
  // select ahead of the room lookup); schedule.ics?ids= goes through
  // getPublicAgendaByIds, which is untouched — the two call sequences
  // diverge by that one extra select, hence two builders.
  function buildAgendaIcsApp() {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: DEC-548 getPublicAgenda's total count(*) subquery
        if (selectCall === 2) return makeChain([{ count: 1 }]);
        // 3: getPublicAgenda's room lookup
        if (selectCall === 3) return makeChain([{ id: "room1", name: "Main Hall" }]);
        // 4: hydrateSessions subRows
        if (selectCall === 4) {
          return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
        }
        // 5: hydrateSessions trackRows
        if (selectCall === 5) return makeChain([]);
        // 6: hydrateSessions speakerRows
        if (selectCall === 6) return makeChain([]);
        // 7: hydrateSessions slotRows
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
    return app;
  }

  function buildScheduleIcsApp() {
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: getPublicEventBySlug
        if (selectCall === 1) return makeChain([EVENT_ROW]);
        // 2: getPublicAgendaByIds' room lookup
        if (selectCall === 2) return makeChain([{ id: "room1", name: "Main Hall" }]);
        // 3: hydrateSessions subRows
        if (selectCall === 3) {
          return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
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
    return app;
  }

  it("returns a VCALENDAR with the same UID schedule.ics would produce for the same session", async () => {
    installFakeCaches();
    const agendaRes = await buildAgendaIcsApp().request("/e/conf/agenda.ics", {}, TEST_ENV);
    expect(agendaRes.status).toBe(200);
    expect(agendaRes.headers.get("Content-Type")).toContain("text/calendar");
    expect(agendaRes.headers.get("Content-Disposition")).toContain('filename="conf-agenda.ics"');
    const agendaBody = await agendaRes.text();
    expect(agendaBody).toContain("BEGIN:VCALENDAR");
    const agendaUid = agendaBody.match(/UID:([^\r\n]+)/)?.[1];
    expect(agendaUid).toBeTruthy();

    installFakeCaches();
    const scheduleRes = await buildScheduleIcsApp().request("/e/conf/schedule.ics?ids=sub1", {}, TEST_ENV);
    const scheduleBody = await scheduleRes.text();
    const scheduleUid = scheduleBody.match(/UID:([^\r\n]+)/)?.[1];

    expect(agendaUid).toBe(scheduleUid);
  });
});
