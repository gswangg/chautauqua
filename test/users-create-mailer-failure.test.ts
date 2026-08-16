// DEC-238: account-creation notice is best-effort — POST /api/v1/users must
// still return 201 with the account + one-time password even when the
// welcome-notice mailer.send() throws. Mirrors the mocking pattern in
// test/users-api.test.ts.

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
    createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
      ...createdUser,
      orgId: input.orgId,
      email: input.email,
      role: input.role,
    })),
  };
});

// An event exists for the org, so the create-user handler attempts the
// best-effort welcome notice send (the anchorEventId branch).
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getAnchorEventForOrg: vi.fn(async () => ({ id: "evt-1", name: "DevCon" })),
  };
});

const mailerSendMock = vi.fn(async () => {
  throw new Error("simulated provider outage");
});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: mailerSendMock })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo | undefined, db: unknown = {} as never) {
  const { usersRoutes } = await import("../src/routes/api/users");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", db as never);
    await next();
  });
  app.route("/", usersRoutes);
  return app;
}

describe("POST /api/v1/users — welcome-notice mailer failure is best-effort (DEC-238)", () => {
  it("still creates the account (201) even though the notice send throws", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string; role: string; password: string; welcomeEmail: string };
    expect(body.email).toBe("new@org.test");
    expect(body.password).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);
    expect(mailerSendMock).toHaveBeenCalledTimes(1);
    // DEC-238 (wave 65 amendment): the mailer threw, so the 201 body must
    // say so rather than pretend the notice sent.
    expect(body.welcomeEmail).toBe("not_sent_failed");
  });
});
