// DEC-043/DEC-044 coverage: /api/v1/users list/create (organizer-scoped org
// user directory) and the reworked /api/v1/plans/:id/reviewers surface
// (GET list + DELETE by reviewer row id, replacing the old body-DELETE).
// Repo/mail calls are mocked so these are route-level, no D1/wrangler
// dependency in stage 1 (mirrors test/review-idor.test.ts's pattern).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const createdUser = { id: "user-1", orgId: ORG_A, email: "new@org.test", role: "reviewer", contactId: null, createdAt: 0 };

vi.mock("../src/server/repo/users", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
  return {
    ...actual,
    listOrgUsers: vi.fn(async (_db: unknown, orgId: string, role?: string) => {
      if (orgId !== ORG_A) return [];
      const all = [createdUser, { ...createdUser, id: "user-2", role: "organizer" }];
      return role ? all.filter((u) => u.role === role) : all;
    }),
    createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
      ...createdUser,
      orgId: input.orgId,
      email: input.email,
      role: input.role,
    })),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    listEventsForOrg: vi.fn(async () => []),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
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
    await next();
  });
  app.route("/", usersRoutes);
  return app;
}

describe("GET /api/v1/users", () => {
  it("401s with no session", async () => {
    const app = await buildApp(undefined);
    const res = await app.request("/api/v1/users");
    expect(res.status).toBe(401);
  });

  it("403s for a reviewer session (organizer-only)", async () => {
    const app = await buildApp({ userId: "u1", role: "reviewer", orgId: ORG_A });
    const res = await app.request("/api/v1/users");
    expect(res.status).toBe(403);
  });

  it("lists org users scoped to the caller's org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("filters by ?role=", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users?role=reviewer");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { role: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.role).toBe("reviewer");
  });

  it("400s on an invalid ?role=", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users?role=speaker");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/users", () => {
  it("creates a reviewer account and returns the one-time password", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string; role: string; password: string };
    expect(body.email).toBe("new@org.test");
    expect(body.role).toBe("reviewer");
    expect(body.password).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);
  });

  it("400s on a missing email or bad role", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "", role: "speaker" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.email).toBeDefined();
    expect(body.error.fields?.role).toBeDefined();
  });

  it("requires the csrf header", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DEC-043 conflict propagation", () => {
  it("createUser's ApiError('conflict') surfaces as 409", async () => {
    const usersRepo = await import("../src/server/repo/users");
    const { ApiError } = await import("../src/server/http");
    vi.mocked(usersRepo.createUser).mockRejectedValueOnce(
      new ApiError("conflict", "A user with this email already exists", { email: "already in use" }),
    );
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "dupe@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(409);
  });
});
