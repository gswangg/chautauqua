// DEC-467/DEC-454 coverage: POST /api/v1/users obeys the one canonical
// email rule (src/domain/email.ts normalizeEmail/isValidEmail), not a
// private trim().toLowerCase() + MAX_NAME_LENGTH check. Route-level, repo
// mocked, mirrors test/users-api.test.ts's buildApp() pattern.

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
    listOrgUsers: vi.fn(async () => []),
    countOrgUsers: vi.fn(async () => 0),
    createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
      ...createdUser,
      orgId: input.orgId,
      email: input.email,
      role: input.role,
    })),
    getOrgUserById: vi.fn(actual.getOrgUserById),
    updateUserPasswordHash: vi.fn(actual.updateUserPasswordHash),
    deleteUserSessions: vi.fn(actual.deleteUserSessions),
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

async function postUser(email: string) {
  const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
  const res = await app.request("/api/v1/users", {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ email, role: "reviewer" }),
  });
  return res;
}

describe("POST /api/v1/users email validation (DEC-467/DEC-454)", () => {
  const invalid = ["bob@", "bob", "  ", "a@b", "a".repeat(300) + "@example.com"];

  for (const raw of invalid) {
    it(`400s on ${JSON.stringify(raw)} with fields.email set and no repo.createUser call`, async () => {
      const usersRepo = await import("../src/server/repo/users");
      const res = await postUser(raw);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.email).toBeDefined();
      expect(usersRepo.createUser).not.toHaveBeenCalled();
    });
  }

  it("normalizes '  Bob@Example.COM ' to 'bob@example.com' and passes it to createUser", async () => {
    const usersRepo = await import("../src/server/repo/users");
    const res = await postUser("  Bob@Example.COM ");
    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe("bob@example.com");
    expect(usersRepo.createUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "bob@example.com" }),
    );
  });
});

describe("DEC-467: contacts.ts dedup keys unchanged by the normalizeEmail swap", () => {
  it("still groups contacts by case-insensitive trimmed email", async () => {
    const { findDuplicateGroups } = await import("../src/domain/contacts");
    const groups = findDuplicateGroups([
      { id: "1", email: "  Foo@Bar.com ", firstName: "A", lastName: "One" },
      { id: "2", email: "foo@bar.com", firstName: "B", lastName: "Two" },
      { id: "3", email: "unrelated@example.com", firstName: "C", lastName: "Three" },
    ]);
    // DEC-800: groups are now {contactIds, reason} candidates -- the email
    // grouping key itself is what DEC-467 pins here, and it is unchanged.
    expect(groups).toEqual([{ contactIds: ["1", "2"], reason: "email" }]);
  });
});
