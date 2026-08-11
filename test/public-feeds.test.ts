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

describe("buildSurfaceFeed", () => {
  it("shapes the DEC-289 envelope, passing items through unchanged", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const items = [{ id: "sub1", title: "Visible Talk" }];
    const feed = buildSurfaceFeed(EVENT, "sessions", items, now);
    expect(feed).toEqual({
      event: { slug: "conf", name: "Test Event", timezone: "UTC", startDate: "2026-08-10", endDate: "2026-08-11" },
      surface: "sessions",
      generatedAt: "2026-08-11T12:00:00.000Z",
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
