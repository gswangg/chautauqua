// DEC-027 wave-38 amendment: closes the bearer-token privilege escalation on
// org-user credential routes. Drives the real usersRoutes sub-app with a
// bearer-authenticated context (auth.viaBearer === true, role organizer) and
// asserts requireCookieSession refuses POST /api/v1/users and POST
// /api/v1/users/:id/reset-password with 403 forbidden, while a
// cookie-session organizer still gets through. Repo/mailer mocking pattern
// copied from test/users-create-email-validation.test.ts's buildApp().

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const createdUser = { id: "user-1", orgId: ORG_A, email: "new@org.test", role: "reviewer", contactId: null, createdAt: 0 };
const targetUser = { id: "target-1", orgId: ORG_A, email: "target@org.test", role: "reviewer", contactId: null, createdAt: 0, passwordHash: "old-hash" };

vi.mock("../src/server/repo/users", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
  return {
    ...actual,
    listOrgUsers: vi.fn(async () => []),
    countOrgUsers: vi.fn(async () => 0),
    createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
      ...createdUser,
      orgId: input.orgId,
      email: input.email,
      role: input.role,
    })),
    getOrgUserById: vi.fn(async () => targetUser),
    updateUserPasswordHash: vi.fn(async () => {}),
    deleteUserSessions: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getAnchorEventForOrg: vi.fn(async () => undefined),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
  };
});

vi.mock("../src/auth/password-reset", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/password-reset")>("../src/auth/password-reset");
  return {
    ...actual,
    revokeResetTokenForUser: vi.fn(async () => {}),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo | undefined) {
  const { usersRoutes } = await import("../src/routes/api/users");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { KV: { get: async () => null, put: async () => {}, delete: async () => {} } } as never;
    await next();
  });
  app.route("/", usersRoutes);
  return app;
}

const bearerOrganizer: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A, viaBearer: true };
const cookieOrganizer: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

describe("DEC-027 wave-38 amendment: bearer containment on credential routes", () => {
  it("POST /api/v1/users: 403 forbidden for a bearer-authenticated organizer", async () => {
    const app = await buildApp(bearerOrganizer);
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("POST /api/v1/users: 201 for a cookie-session organizer", async () => {
    const app = await buildApp(cookieOrganizer);
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);
  });

  it("POST /api/v1/users/:id/reset-password: 403 forbidden for a bearer-authenticated organizer", async () => {
    const app = await buildApp(bearerOrganizer);
    const res = await app.request("/api/v1/users/target-1/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("POST /api/v1/users/:id/reset-password: 200 for a cookie-session organizer", async () => {
    const app = await buildApp(cookieOrganizer);
    const res = await app.request("/api/v1/users/target-1/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});
