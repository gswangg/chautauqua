// DEC-141 regression coverage: GET /api/v1/events must stay reachable for
// reviewers (previously blanket-403'd by requireOrganizer on "/events" and
// "/events/*" — the P1 reviewer lockout). Every other events/tracks/rooms
// route stays organizer-only. Repo calls are mocked so this is a pure
// route-level access-decision test (no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const eventA = {
  id: "event-a",
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

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    listEventsForOrg: vi.fn(async (_db: unknown, orgId: string) => (orgId === ORG_A ? [eventA] : [])),
    listEventsForReviewer: vi.fn(async (_db: unknown, userId: string, orgId: string) =>
      userId === "rev-assigned" && orgId === ORG_A ? [eventA] : [],
    ),
    countEventsForOrg: vi.fn(async (_db: unknown, orgId: string) => (orgId === ORG_A ? 1 : 0)),
    countEventsForReviewer: vi.fn(async (_db: unknown, userId: string, orgId: string) =>
      userId === "rev-assigned" && orgId === ORG_A ? 1 : 0,
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo | undefined) {
  const { eventsRoutes } = await import("../src/routes/api/events");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", eventsRoutes);
  return app;
}

describe("DEC-141: GET /api/v1/events is reachable by reviewers", () => {
  it("organizer lists their org's events via listEventsForOrg (unchanged)", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toEqual([expect.objectContaining({ id: "event-a" })]);
  });

  it("reviewer with a plan assignment sees exactly the assigned event", async () => {
    const app = await buildApp({ userId: "rev-assigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("event-a");
  });

  it("reviewer without any plan assignments gets an empty list, not 403", async () => {
    const app = await buildApp({ userId: "rev-unassigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<unknown>; total: number };
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("anonymous requests 401", async () => {
    const app = await buildApp(undefined);
    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(401);
  });

  it("speaker cannot list events", async () => {
    const app = await buildApp({ userId: "sp-1", role: "speaker", orgId: ORG_A });
    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(403);
  });
});

describe("DEC-141: reviewers stay locked out of mutation and nested events/tracks/rooms routes", () => {
  it("reviewer 403s on POST /api/v1/events", async () => {
    const app = await buildApp({ userId: "rev-assigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        name: "New Event",
        slug: "new-event",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        timezone: "UTC",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("reviewer 403s on GET /api/v1/events/:eventId (nested route stays organizer-only)", async () => {
    const app = await buildApp({ userId: "rev-assigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${eventA.id}`);
    expect(res.status).toBe(403);
  });

  it("reviewer 403s on GET /api/v1/events/:eventId/tracks", async () => {
    const app = await buildApp({ userId: "rev-assigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${eventA.id}/tracks`);
    expect(res.status).toBe(403);
  });

  it("reviewer 403s on GET /api/v1/events/:eventId/rooms", async () => {
    const app = await buildApp({ userId: "rev-assigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${eventA.id}/rooms`);
    expect(res.status).toBe(403);
  });
});
