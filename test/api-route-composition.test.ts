// Regression for the w8-d walkthrough's out-of-area defect: eventsRoutes,
// contactsRoutes, and portalConfigRoutes each registered a blanket
// `.use("*", requireOrganizer)`. Hono does not rewrite a bare "*" pattern
// with the mount prefix when composed via app.route(), so once multiple
// sub-apps share the same mount prefix ("/api/v1" here, per src/index.ts)
// that wildcard matches every request in the fully-assembled app -- not
// just this router's own routes -- incorrectly 403ing non-organizer
// sessions (reviewer, speaker-via-bearer) hitting sibling sub-apps like
// /api/v1/me and /api/v1/review/*. No test imported the fully-assembled
// app before, which is why this went uncaught (see task-w8-d's commit
// body). This test mounts multiple real sub-apps at the same prefix, the
// same way src/index.ts does, to catch any future reintroduction of a
// blanket wildcard on an organizer-only (or any role-gated) sub-app.

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
  };
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
    "../src/server/repo/contacts",
  );
  return {
    ...actual,
    listContactsForOrg: vi.fn(async () => ({ items: [], total: 0 })),
  };
});

const { eventsRoutes } = await import("../src/routes/api/events");
const { contactsRoutes } = await import("../src/routes/api/contacts");
const { portalConfigRoutes } = await import("../src/routes/api/portal-config");
const { meRoutes } = await import("../src/routes/me");

function buildApp(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    // meRoutes queries db for the user's email; stub just enough of the
    // drizzle chain shape it awaits.
    c.set("db", {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ email: "reviewer@example.com" }],
          }),
        }),
      }),
    } as unknown as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  // Mirrors src/index.ts's mount order: eventsRoutes/contactsRoutes/
  // portalConfigRoutes (all organizer-gated) and meRoutes (role-agnostic)
  // sharing the "/api/v1" prefix.
  app.route("/api/v1", eventsRoutes);
  app.route("/api/v1", contactsRoutes);
  app.route("/api/v1", portalConfigRoutes);
  app.route("/", meRoutes);
  return app;
}

describe("api sub-app composition under a shared /api/v1 prefix", () => {
  it("does not let an organizer-only sub-app's gate leak onto a sibling sub-app's routes", async () => {
    const reviewerAuth: AuthInfo = { userId: "u-1", role: "reviewer", orgId: "org-1" };
    const app = buildApp(reviewerAuth);

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe("reviewer");
  });

  it("still gates the organizer-only sub-app's own routes for a non-organizer", async () => {
    const reviewerAuth: AuthInfo = { userId: "u-1", role: "reviewer", orgId: "org-1" };
    const app = buildApp(reviewerAuth);

    const res = await app.request("/api/v1/events");
    expect(res.status).toBe(403);
  });

  it("still allows an organizer through the organizer-only sub-app's own routes", async () => {
    const organizerAuth: AuthInfo = { userId: "u-2", role: "organizer", orgId: "org-1" };
    const app = buildApp(organizerAuth);

    const res = await app.request("/api/v1/contacts");
    expect(res.status).toBe(200);
  });
});
