// DEC-460/DEC-461: the four event/org config-list endpoints (GET /events,
// GET /events/:eventId/tracks, GET /events/:eventId/rooms,
// GET /events/:eventId/resources) previously returned every row with a
// cosmetic {page:1, perPage: items.length || 1} envelope. This locks the
// route-level bound: perPage clamps to <=200 (default 200, not the general
// DEC-013 default of 50), page offsets, and `total` always reports the true
// row count rather than items.length. Repo calls are mocked (no D1 test
// harness in stage 1 — see test/events-reviewer-access.test.ts), so the
// mocks assert the route computed the correct { limit, offset } page param
// and that clamping/defaulting happens before the repo call.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_A = "event-a";
const TOTAL_ROWS = 450; // > MAX_PER_PAGE so a full page never equals total

const eventA = {
  id: EVENT_A,
  orgId: ORG_A,
  name: "Event A",
  slug: "event-a",
  startDate: "2026-06-01",
  endDate: "2026-06-03",
  location: null,
  timezone: "UTC",
  recordPrefix: "A",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

function itemsFor(page: { limit: number; offset: number } | undefined, total: number) {
  if (!page) return Array.from({ length: total }, (_, i) => ({ id: `row-${i}` }));
  const remaining = Math.max(0, total - page.offset);
  const count = Math.min(page.limit, remaining);
  return Array.from({ length: count }, (_, i) => ({ id: `row-${page.offset + i}` }));
}

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === EVENT_A && orgId === ORG_A ? eventA : null,
    ),
    listEventsForOrg: vi.fn(async (_db: unknown, orgId: string, page?: { limit: number; offset: number }) =>
      orgId === ORG_A ? itemsFor(page, TOTAL_ROWS) : [],
    ),
    countEventsForOrg: vi.fn(async (_db: unknown, orgId: string) => (orgId === ORG_A ? TOTAL_ROWS : 0)),
    listEventsForReviewer: vi.fn(async () => []),
    countEventsForReviewer: vi.fn(async () => 0),
    listTracksForEvent: vi.fn(async (_db: unknown, eventId: string, page?: { limit: number; offset: number }) =>
      eventId === EVENT_A ? itemsFor(page, TOTAL_ROWS) : [],
    ),
    countTracksForEvent: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_A ? TOTAL_ROWS : 0)),
    listRoomsForEvent: vi.fn(async (_db: unknown, eventId: string, page?: { limit: number; offset: number }) =>
      eventId === EVENT_A ? itemsFor(page, TOTAL_ROWS) : [],
    ),
    countRoomsForEvent: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_A ? TOTAL_ROWS : 0)),
  };
});

vi.mock("../src/server/repo/portal-config", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-config")>(
    "../src/server/repo/portal-config",
  );
  return {
    ...actual,
    listResourcesForEvent: vi.fn(async (_db: unknown, eventId: string, page?: { limit: number; offset: number }) =>
      eventId === EVENT_A ? itemsFor(page, TOTAL_ROWS) : [],
    ),
    countResourcesForEvent: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_A ? TOTAL_ROWS : 0)),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const organizerAuth: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A } as AuthInfo;

async function buildEventsApp() {
  const { eventsRoutes } = await import("../src/routes/api/events");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", eventsRoutes);
  return app;
}

async function buildPortalConfigApp() {
  const { portalConfigRoutes } = await import("../src/routes/api/portal-config");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", portalConfigRoutes);
  return app;
}

interface Envelope {
  items: unknown[];
  total: number;
  page: number;
  perPage: number;
}

const ENDPOINTS: Array<{ name: string; buildApp: () => Promise<Hono<AppEnv>>; path: string }> = [
  { name: "GET /api/v1/events", buildApp: buildEventsApp, path: "/api/v1/events" },
  {
    name: "GET /api/v1/events/:eventId/tracks",
    buildApp: buildEventsApp,
    path: `/api/v1/events/${EVENT_A}/tracks`,
  },
  {
    name: "GET /api/v1/events/:eventId/rooms",
    buildApp: buildEventsApp,
    path: `/api/v1/events/${EVENT_A}/rooms`,
  },
  {
    name: "GET /api/v1/events/:eventId/resources",
    buildApp: buildPortalConfigApp,
    path: `/api/v1/events/${EVENT_A}/resources`,
  },
];

for (const { name, buildApp, path } of ENDPOINTS) {
  describe(`DEC-460/DEC-461 bounds: ${name}`, () => {
    it("perPage=100000 clamps to at most 200 items", async () => {
      const app = await buildApp();
      const res = await app.request(`${path}?perPage=100000`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Envelope;
      expect(body.perPage).toBe(200);
      expect(body.items.length).toBeLessThanOrEqual(200);
    });

    it("perPage=abc (non-numeric) uses the 200 default", async () => {
      const app = await buildApp();
      const res = await app.request(`${path}?perPage=abc`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Envelope;
      expect(body.perPage).toBe(200);
      expect(body.items.length).toBe(200);
    });

    it("no perPage supplied also defaults to 200 (not the general 50)", async () => {
      const app = await buildApp();
      const res = await app.request(path);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Envelope;
      expect(body.perPage).toBe(200);
      expect(body.items.length).toBe(200);
    });

    it("page=2 offsets into the second page", async () => {
      const app = await buildApp();
      const res = await app.request(`${path}?page=2&perPage=200`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Envelope;
      expect(body.page).toBe(2);
      // row-200 is the first row of page 2 given TOTAL_ROWS=450, perPage=200
      expect((body.items[0] as { id: string }).id).toBe("row-200");
      expect(body.items.length).toBe(200);
    });

    it("total reports the full row count, never items.length", async () => {
      const app = await buildApp();
      const res = await app.request(`${path}?perPage=10`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Envelope;
      expect(body.total).toBe(TOTAL_ROWS);
      expect(body.items.length).toBe(10);
      expect(body.total).not.toBe(body.items.length);
    });
  });
}
