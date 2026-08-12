// EMB-15 (DEC-289): public JSON + iCal feeds for the embed surfaces. Same
// fake-db-chain harness as test/public.test.ts (no local sqlite/D1 test
// driver wired up — see package.json); route/query-gate visibility itself
// is covered by test/public-invite-visibility.test.ts's source scan of
// visibleSessionConditions()/visibleSubmissionConditions() plus this file's
// "route only returns what the repo hands it" regression below.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { buildSurfaceFeed, agendaIcsEvents } from "../src/routes/public/feeds";
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

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
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
    // DEC-502: the repo's selectDistinct returns the CUMULATIVE prefix a
    // real bounded LIMIT would (here: all 15 rows, since boundedRowLimit(2,
    // 12)=24 exceeds the total) — the route itself must slice out just the
    // page-2 window (the last 3 rows) from that.
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
        // 2: hydrateSessions subRows
        if (selectCall === 2) {
          return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
        }
        // 3: hydrateSessions trackRows
        if (selectCall === 3) return makeChain([]);
        // 4: hydrateSessions speakerRows
        if (selectCall === 4) return makeChain([]);
        // 5: hydrateSessions slotRows
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

// DEC-502: the repo calls behind sessions/speakers/gallery return a
// CUMULATIVE prefix (bare LIMIT, no OFFSET — see boundedRowLimit), which is
// correct for the HTML show-more list but wrong for a paged JSON feed. These
// fakes simulate that by returning the same full N-row set regardless of the
// requested page/limit (worst case: every page "sees" the whole cumulative
// set the repo would have accumulated by then) so the assertions below can
// only pass if getSurfaceFeedPage itself slices to the single requested
// window rather than trusting the repo's shape.
describe("GET /embed/:eventSlug/*.json single-page window (DEC-502)", () => {
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
            })),
          );
        }
        if (selectCall === 3) return makeChain([]); // trackRows
        if (selectCall === 4) return makeChain([]); // speakerRows
        if (selectCall === 5) return makeChain([]); // slotRows
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
      const app = surface === "sessions" ? buildCumulativeSessionsApp() : buildCumulativeSpeakersApp();
      for (const page of [1, 2, 3]) {
        const body = await fetchItems(app, `/embed/conf/${surface}.json?page=${page}&limit=12`);
        expect(body.items.length).toBeLessThanOrEqual(body.perPage);
      }
    }
  });

  it("a page past the end returns items: [] with the true total (honest empty page, not an error)", async () => {
    const sessionsPast = await fetchItems(buildCumulativeSessionsApp(), "/embed/conf/sessions.json?page=3&limit=12");
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
        if (selectCall === 3) {
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
        if (selectCall === 4) return makeChain([]); // trackRows (hydrate)
        if (selectCall === 5) return makeChain([]); // speakerRows
        if (selectCall === 6) return makeChain([]); // slotRows
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
        icsSequence: 3,
        tracks: [],
        speakers: [],
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
  function buildIcsApp() {
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
    const agendaRes = await buildIcsApp().request("/e/conf/agenda.ics", {}, TEST_ENV);
    expect(agendaRes.status).toBe(200);
    expect(agendaRes.headers.get("Content-Type")).toContain("text/calendar");
    expect(agendaRes.headers.get("Content-Disposition")).toContain('filename="conf-agenda.ics"');
    const agendaBody = await agendaRes.text();
    expect(agendaBody).toContain("BEGIN:VCALENDAR");
    const agendaUid = agendaBody.match(/UID:([^\r\n]+)/)?.[1];
    expect(agendaUid).toBeTruthy();

    installFakeCaches();
    const scheduleRes = await buildIcsApp().request("/e/conf/schedule.ics?ids=sub1", {}, TEST_ENV);
    const scheduleBody = await scheduleRes.text();
    const scheduleUid = scheduleBody.match(/UID:([^\r\n]+)/)?.[1];

    expect(agendaUid).toBe(scheduleUid);
  });
});
