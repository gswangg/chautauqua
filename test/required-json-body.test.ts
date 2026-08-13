// DEC-635 (amendment, wave 52): readJsonBody is the guarded reader for
// REQUIRED request bodies (readOptionalJsonBody's twin for optional ones).
// These tests prove a malformed body to a converted route lands on the
// house 400 `invalid` envelope, not an uncaught SyntaxError producing a
// generic 500 `internal` -- one representative route per touched file.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    isSlugTaken: vi.fn(async () => false),
    getEventForOrg: vi.fn(async () => ({
      id: "evt-1",
      orgId: "org-1",
      name: "Existing Event",
      slug: "existing-event",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      location: null,
      timezone: "UTC",
      recordPrefix: "EV",
      branding: null,
      createdAt: 0,
      updatedAt: 0,
    })),
  };
});

vi.mock("../src/server/repo/portal-config", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-config")>(
    "../src/server/repo/portal-config",
  );
  return {
    ...actual,
    getPortalSettingsForEvent: vi.fn(async () => null),
  };
});

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listPlansForEvent: vi.fn(async () => []),
    countPlansForEvent: vi.fn(async () => 0),
  };
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: "org-1" };

function buildApp(routes: unknown, prefix: string, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as unknown as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route(prefix, routes as never);
  return app;
}

describe("readJsonBody: malformed body returns 400 invalid, never 500 internal", () => {
  it("api/events.ts POST /events (event create)", async () => {
    const { eventsRoutes } = await import("../src/routes/api/events");
    const app = buildApp(eventsRoutes, "/api/v1", organizerAuth);

    const res = await app.request("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{not valid json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });

  it("api/portal-config.ts PUT /events/:eventId/portal-settings", async () => {
    const { portalConfigRoutes } = await import("../src/routes/api/portal-config");
    const app = buildApp(portalConfigRoutes, "/api/v1", organizerAuth);

    const res = await app.request("/api/v1/events/evt-1/portal-settings", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });

  it("review/plans-crud.ts POST /events/:eventId/plans (plan create)", async () => {
    const { reviewPlansCrudRoutes } = await import("../src/routes/review/plans-crud");
    const app = buildApp(reviewPlansCrudRoutes, "/", organizerAuth);

    const res = await app.request("/api/v1/events/evt-1/plans", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "[1, 2]",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });
});
