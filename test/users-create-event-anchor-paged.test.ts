// DEC-461/DEC-013 (wave-26 amendment): POST /api/v1/users only needs one row
// (the org's anchor event, by the repo's own desc(startDate)/asc(id)
// ordering) to anchor the welcome notice's email_log.event_id. It must call
// the shared getAnchorEventForOrg helper (LIMIT 1 under the hood — see
// test/anchor-event-contract.test.ts for the ordering/limit contract
// itself), not load every event row in the org. Mirrors the mocking pattern
// in test/users-create-mailer-failure.test.ts.

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

const getAnchorEventForOrgMock = vi.fn(async () => ({ id: "evt-1", name: "DevCon" }));
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getAnchorEventForOrg: getAnchorEventForOrgMock,
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => undefined) })),
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

describe("POST /api/v1/users — event anchor lookup is bounded (DEC-461/DEC-013)", () => {
  it("calls getAnchorEventForOrg once, scoped to the caller's org, not an unbounded listEventsForOrg read", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);
    expect(getAnchorEventForOrgMock).toHaveBeenCalledTimes(1);
    const [, orgId] = getAnchorEventForOrgMock.mock.calls[0]! as unknown as [unknown, string];
    expect(orgId).toBe(ORG_A);
    // DEC-238 (wave 65 amendment): an anchor event exists and the mailer
    // resolved, so the 201 body must report a successful send.
    const body = (await res.json()) as { welcomeEmail: string };
    expect(body.welcomeEmail).toBe("sent");
  });
});
