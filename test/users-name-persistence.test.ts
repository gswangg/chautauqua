// DEC-757 (wave-26 amendment) coverage: POST /api/v1/users accepts OPTIONAL
// firstName/lastName, composes them into the new nullable user.name column,
// and GET /api/v1/users returns it. Same mocked-repo route harness as
// test/email-log-null-contact.test.ts (no live D1 in this test harness).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { RenderedEmail } from "../src/mail/types";
import type * as repo from "../src/server/repo/users";

const ORG_A = "org-a";

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function mockCommonRoutes() {
  vi.doMock("../src/server/repo/events", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
    // DEC-013 (wave 26): the route resolves its email_log anchor via the
    // owned single-row getAnchorEventForOrg, not a listEventsForOrg page --
    // undefined here means "org with no event", so no welcome mail is sent
    // and the account + one-time password still come back 201.
    return { ...actual, getAnchorEventForOrg: vi.fn(async () => undefined) };
  });
  vi.doMock("../src/server/context", async () => {
    const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
    return {
      ...actual,
      makeMailer: vi.fn(() => ({
        send: vi.fn(async (_m: RenderedEmail) => {}),
      })),
    };
  });
}

async function buildApp(createUserImpl: (db: unknown, input: repo.CreateUserInput) => Promise<repo.OrgUserRecord>) {
  vi.doMock("../src/server/repo/users", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
    return { ...actual, createUser: vi.fn(createUserImpl) };
  });
  // registerErrorHandler must come from the SAME freshly-loaded module graph
  // as usersRoutes: vi.resetModules() between tests means a statically
  // imported ApiError class from this test file's top level is a different
  // class object than the one routes/api/users.ts throws against after a
  // reset, and Hono's onError does `err instanceof ApiError` -- a stale
  // reference silently degrades every thrown ApiError to a 500.
  const { usersRoutes } = await import("../src/routes/api/users");
  const { registerErrorHandler } = await import("../src/server/http");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", usersRoutes);
  return app;
}

describe("POST /api/v1/users name persistence (DEC-757)", () => {
  it("composes firstName+lastName into name and persists it via repo.createUser", async () => {
    mockCommonRoutes();
    let capturedInput: repo.CreateUserInput | undefined;
    const app = await buildApp(async (_db, input) => {
      capturedInput = input;
      return {
        id: "user-1",
        orgId: input.orgId,
        email: input.email,
        role: input.role,
        contactId: null,
        name: input.name ?? null,
        createdAt: 0,
      };
    });

    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer", firstName: "Ada ", lastName: " Lovelace" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string | null };
    expect(body.name).toBe("Ada Lovelace");
    expect(capturedInput?.name).toBe("Ada Lovelace");
  });

  it("succeeds with name: null when firstName/lastName are omitted", async () => {
    mockCommonRoutes();
    let capturedInput: repo.CreateUserInput | undefined;
    const app = await buildApp(async (_db, input) => {
      capturedInput = input;
      return {
        id: "user-2",
        orgId: input.orgId,
        email: input.email,
        role: input.role,
        contactId: null,
        name: input.name ?? null,
        createdAt: 0,
      };
    });

    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "no-name@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string | null };
    expect(body.name).toBeNull();
    expect(capturedInput?.name).toBeNull();
  });

  it("returns error.fields.firstName for an over-cap first name (never reaches repo.createUser)", async () => {
    mockCommonRoutes();
    const createUserImpl = vi.fn(async () => {
      throw new Error("createUser must not be called when validation fails");
    });
    const app = await buildApp(createUserImpl);

    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "over-cap@org.test", role: "reviewer", firstName: "x".repeat(201) }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.firstName).toBeDefined();
    expect(createUserImpl).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/users returns name (DEC-757)", () => {
  it("passes through name from listOrgUsers", async () => {
    mockCommonRoutes();
    vi.doMock("../src/server/repo/users", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
      return {
        ...actual,
        listOrgUsers: vi.fn(async () => [
          { id: "u1", orgId: ORG_A, email: "a@org.test", role: "reviewer", contactId: null, name: "Ada Lovelace", createdAt: 0 },
        ]),
        countOrgUsers: vi.fn(async () => 1),
      };
    });
    const { usersRoutes } = await import("../src/routes/api/users");
    const { registerErrorHandler } = await import("../src/server/http");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", usersRoutes);

    const res = await app.request("/api/v1/users");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ name: string | null }> };
    expect(body.items[0]?.name).toBe("Ada Lovelace");
  });
});
