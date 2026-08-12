// DEC-523 regression: portal-config.ts's `/events/*` wildcard was the exact
// forbidden shape events.ts documents — it also matches the bare
// `/api/v1/events` list route DEC-141 keeps reviewer-reachable, and it was
// inert only because src/index.ts mounts eventsRoutes before
// portalConfigRoutes. This test mounts the sub-apps in the ADVERSARIAL
// (reversed) order — portalConfigRoutes before eventsRoutes — because the
// gate must not depend on mount order.

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
    listEventsForOrg: vi.fn(async () => []),
    countEventsForOrg: vi.fn(async () => 0),
    listEventsForReviewer: vi.fn(async () => []),
    countEventsForReviewer: vi.fn(async () => 0),
    getEventForOrg: vi.fn(async () => ({ id: "evt-1", orgId: "org-1" })),
  };
});

vi.mock("../src/server/repo/portal-config", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-config")>(
    "../src/server/repo/portal-config",
  );
  return {
    ...actual,
    listResourcesForEvent: vi.fn(async () => []),
    countResourcesForEvent: vi.fn(async () => 0),
  };
});

const { eventsRoutes } = await import("../src/routes/api/events");
const { portalConfigRoutes } = await import("../src/routes/api/portal-config");

function buildApp(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as unknown as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  // Adversarial order relative to src/index.ts: portalConfigRoutes mounted
  // BEFORE eventsRoutes, to prove the DEC-141 gate does not depend on
  // mount order.
  app.route("/api/v1", portalConfigRoutes);
  app.route("/api/v1", eventsRoutes);
  return app;
}

describe("portal-config / events mount order (DEC-523)", () => {
  it("lets a reviewer through the DEC-141 bare events list route even mounted after portal-config", async () => {
    const reviewerAuth: AuthInfo = { userId: "u-1", role: "reviewer", orgId: "org-1" };
    const app = buildApp(reviewerAuth);

    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(200);
  });

  it("still gates portal-config's own organizer-only route for a reviewer", async () => {
    const reviewerAuth: AuthInfo = { userId: "u-1", role: "reviewer", orgId: "org-1" };
    const app = buildApp(reviewerAuth);

    const res = await app.request("/api/v1/events/evt-1/resources");
    expect(res.status).toBe(403);
  });

  it("lets an organizer through both the events list route and portal-config's organizer-only route", async () => {
    const organizerAuth: AuthInfo = { userId: "u-2", role: "organizer", orgId: "org-1" };
    const app = buildApp(organizerAuth);

    const eventsRes = await app.request("/api/v1/events");
    expect(eventsRes.status).toBe(200);

    const resourcesRes = await app.request("/api/v1/events/evt-1/resources");
    expect(resourcesRes.status).toBe(200);
  });
});
