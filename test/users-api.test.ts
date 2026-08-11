// DEC-043/DEC-044 coverage: /api/v1/users list/create (organizer-scoped org
// user directory) and the reworked /api/v1/plans/:id/reviewers surface
// (GET list + DELETE by reviewer row id, replacing the old body-DELETE).
// Repo/mail calls are mocked so these are route-level, no D1/wrangler
// dependency in stage 1 (mirrors test/review-idor.test.ts's pattern).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";

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

// DEC-199: the email-case lockout bug. These tests exercise the REAL
// repo.createUser (via mockImplementation delegating to the actual
// export, not the hardcoded stub above) against an in-memory fake db, so
// the lowercase-normalization + case-insensitive-conflict invariants are
// verified end to end, plus the real (unmocked) /login route to prove the
// regression the bug caused is fixed.
describe("DEC-199 email case normalization + login regression", () => {
  function makeFakeUsersDb() {
    const rows: Array<Record<string, unknown>> = [];
    const sessions: Array<Record<string, unknown>> = [];
    let nextDupCheckEmail: string | null = null;
    let pendingByIdLookup = false;
    let lastInsertedId: string | null = null;
    let nextLoginEmail: string | null = null;

    const db = {
      select(cols?: unknown) {
        return {
          from(table: unknown) {
            return {
              where(_cond: unknown) {
                return {
                  limit(_n: number) {
                    if (table !== schema.user) throw new Error("unexpected table in fake db select");
                    const isDupCheckProjection =
                      !!cols && typeof cols === "object" && Object.keys(cols as object).length === 1 && "id" in (cols as object);
                    if (isDupCheckProjection) {
                      if (nextDupCheckEmail === null) throw new Error("nextDupCheckEmail not set before select");
                      const email = nextDupCheckEmail;
                      return Promise.resolve(rows.filter((r) => (r.email as string).toLowerCase() === email.toLowerCase()));
                    }
                    if (pendingByIdLookup) {
                      pendingByIdLookup = false;
                      return Promise.resolve(rows.filter((r) => r.id === lastInsertedId));
                    }
                    if (nextLoginEmail === null) throw new Error("nextLoginEmail not set before select");
                    return Promise.resolve(rows.filter((r) => r.email === nextLoginEmail));
                  },
                };
              },
            };
          },
        };
      },
      insert(table: unknown) {
        return {
          values(row: Record<string, unknown>) {
            if (table === schema.user) {
              rows.push({ ...row });
              lastInsertedId = row.id as string;
              pendingByIdLookup = true;
            } else if (table === schema.authSession) {
              sessions.push({ ...row });
            } else {
              throw new Error("unexpected insert table");
            }
            return Promise.resolve();
          },
        };
      },
    };

    return {
      db: db as unknown as AppEnv["Variables"]["db"],
      rows,
      sessions,
      setDupCheckEmail(email: string) {
        nextDupCheckEmail = email;
      },
      setLoginEmail(email: string) {
        nextLoginEmail = email;
      },
    };
  }

  class InMemoryKV {
    private readonly store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async put(key: string, value: string): Promise<void> {
      this.store.set(key, value);
    }
    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  async function useRealCreateUser() {
    const usersRepo = await import("../src/server/repo/users");
    const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
    vi.mocked(usersRepo.createUser).mockImplementation(actual.createUser);
  }

  it("(a) POST /api/v1/users with mixed-case email returns 201 with lowercased email; the stored row is lowercase", async () => {
    await useRealCreateUser();
    const dbHandle = makeFakeUsersDb();
    dbHandle.setDupCheckEmail("mixedcase@example.com");
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, dbHandle.db);
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "MixedCase@Example.COM", role: "organizer" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe("mixedcase@example.com");
    expect(dbHandle.rows).toHaveLength(1);
    expect(dbHandle.rows[0]?.email).toBe("mixedcase@example.com");
  });

  it("(b) the one-time password from account creation logs in with the lowercase email (302 to /admin)", async () => {
    await useRealCreateUser();
    const dbHandle = makeFakeUsersDb();
    dbHandle.setDupCheckEmail("caselogin@example.com");
    const usersApp = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, dbHandle.db);
    const createRes = await usersApp.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "CaseLogin@Example.com", role: "organizer" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { email: string; password: string };
    expect(created.email).toBe("caselogin@example.com");

    const { authRoutes } = await import("../src/routes/auth");
    const authApp = new Hono<AppEnv>();
    registerErrorHandler(authApp);
    authApp.use("*", async (c, next) => {
      c.set("db", dbHandle.db);
      await next();
    });
    authApp.route("/", authRoutes);
    const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };

    const csrfRes = await authApp.request("/login", {}, env);
    const setCookie = csrfRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
    const csrf = match[1]!;
    const cookie = `${CSRF_COOKIE_NAME}=${csrf}`;

    dbHandle.setLoginEmail("caselogin@example.com");
    const form = new URLSearchParams({
      [CSRF_COOKIE_NAME]: csrf,
      email: "caselogin@example.com",
      password: created.password,
    });
    const loginRes = await authApp.request(
      "/login",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: form.toString(),
      },
      env,
    );
    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.get("location")).toBe("/admin");
  });

  it("(c) creating 'alice@example.com' then 'ALICE@Example.com' yields a 409 conflict", async () => {
    await useRealCreateUser();
    const dbHandle = makeFakeUsersDb();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, dbHandle.db);

    dbHandle.setDupCheckEmail("alice@example.com");
    const firstRes = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "alice@example.com", role: "reviewer" }),
    });
    expect(firstRes.status).toBe(201);

    dbHandle.setDupCheckEmail("alice@example.com");
    const secondRes = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "ALICE@Example.com", role: "reviewer" }),
    });
    expect(secondRes.status).toBe(409);
    expect(dbHandle.rows).toHaveLength(1);
  });
});
