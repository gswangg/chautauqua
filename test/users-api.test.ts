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
    countOrgUsers: vi.fn(async (_db: unknown, orgId: string, role?: string) => {
      if (orgId !== ORG_A) return 0;
      const all = [createdUser, { ...createdUser, id: "user-2", role: "organizer" }];
      return (role ? all.filter((u) => u.role === role) : all).length;
    }),
    createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
      ...createdUser,
      orgId: input.orgId,
      email: input.email,
      role: input.role,
    })),
    // DEC-215 reset-password helpers: default to the real implementations
    // (wrapped in vi.fn so individual tests can still override them), rather
    // than hardcoded stubs — the reset-password describe block below relies
    // on the real drizzle where()/and() clauses running against its fake db.
    getOrgUserById: vi.fn(actual.getOrgUserById),
    updateUserPasswordHash: vi.fn(actual.updateUserPasswordHash),
    deleteUserSessions: vi.fn(actual.deleteUserSessions),
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

  // DEC-239 wire-shape contract: PlanEditor's ReviewerOption (app/src/pages/
  // review/types.ts) reads {id,email,role} -- an earlier `userId` mismatch
  // here posted `undefined` as the reviewer assignment's userId ("User not
  // found" bug, docs/eval-findings.md Section B).
  it("items contain exactly the {id,email,role,contactId,createdAt} keys the SPA's ReviewerOption reads", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users?role=reviewer");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(typeof item.id).toBe("string");
      expect((item.id as string).length).toBeGreaterThan(0);
      expect(typeof item.email).toBe("string");
      expect(typeof item.role).toBe("string");
      expect(Object.keys(item).sort()).toEqual(["contactId", "createdAt", "email", "id", "orgId", "role"]);
      // must NOT be shaped with a `userId` key -- that's the bug this guards.
      expect(item.userId).toBeUndefined();
    }
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
    const body = (await res.json()) as { id: string; email: string; role: string; password: string; welcomeEmail: string };
    expect(body.email).toBe("new@org.test");
    expect(body.role).toBe("reviewer");
    expect(body.password).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);
    // DEC-238 (wave 65 amendment): this org has no events (mocked
    // getAnchorEventForOrg returns undefined above), so no welcome notice
    // was attempted.
    expect(body.welcomeEmail).toBe("not_sent_no_event");
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

// -----------------------------------------------------------------------
// DEC-215: POST /api/v1/users/:id/reset-password — org-user password
// re-issue. Exercises the real (unmocked) repo helpers against a small
// in-memory fake db that evaluates real drizzle eq()/and() conditions,
// mirroring test/account-password.test.ts's approach, plus the real
// /login route so the old/new password swap is verified end to end.
// -----------------------------------------------------------------------

describe("POST /api/v1/users/:id/reset-password", () => {
  type Row = Record<string, unknown>;

  function buildColumnMap(table: Record<string, unknown>): Map<unknown, string> {
    const map = new Map<unknown, string>();
    for (const [key, col] of Object.entries(table)) {
      if (col && typeof col === "object" && "name" in (col as object)) {
        map.set(col, key);
      }
    }
    return map;
  }

  const COLUMN_KEYS = new Map<unknown, string>([
    ...buildColumnMap(schema.user as unknown as Record<string, unknown>),
    ...buildColumnMap(schema.authSession as unknown as Record<string, unknown>),
    // DEC-948: the login door's rate limiter now reads/writes a D1
    // rate_limit row instead of KV.
    ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
  ]);

  function colKey(col: unknown): string {
    const key = COLUMN_KEYS.get(col);
    if (!key) throw new Error("unmapped column in fake db test helper");
    return key;
  }

  function unwrap(rawValue: unknown): unknown {
    return rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
      ? (rawValue as { value: unknown }).value
      : rawValue;
  }

  // DEC-276 (wave 63): auth is now a single innerJoin (auth_session ⋈ user),
  // so the fake db has to resolve a column against the correct side of a
  // joined row — schema.user.id and schema.authSession.id share the key "id".
  function buildTableMap(table: Record<string, unknown>, tableRef: unknown, into: Map<unknown, unknown>) {
    for (const col of Object.values(table)) {
      if (col && typeof col === "object" && "name" in (col as object)) into.set(col, tableRef);
    }
    return into;
  }

  const COLUMN_TABLES = new Map<unknown, unknown>();
  for (const t of [schema.user, schema.authSession, schema.rateLimit]) {
    buildTableMap(t as unknown as Record<string, unknown>, t, COLUMN_TABLES);
  }

  const JOINED = Symbol("joined");
  type JoinedRow = { [JOINED]: Map<unknown, Row> };

  function isJoined(row: Row | JoinedRow): row is JoinedRow {
    return JOINED in row;
  }

  function valueOf(row: Row | JoinedRow, col: unknown): unknown {
    if (isJoined(row)) {
      const side = row[JOINED].get(COLUMN_TABLES.get(col));
      return side ? side[colKey(col)] : undefined;
    }
    return (row as Row)[colKey(col)];
  }

  // Evaluates a real drizzle eq()/and() condition tree against a row.
  // Recurses into any nested queryChunks-bearing chunk so and(eq, eq)
  // works without hardcoding AND's chunk layout.
  function evalCond(cond: unknown, row: Row | JoinedRow): boolean {
    const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
    if (COLUMN_KEYS.has(chunks[1])) {
      // A join condition compares two columns (eq(a.x, b.y)).
      if (COLUMN_TABLES.has(chunks[3])) return valueOf(row, chunks[1]) === valueOf(row, chunks[3]);
      // inArray()'s chunks[3] is an array of Param values (DEC-865:
      // getOrgUserById now scopes by inArray(role, ORG_USER_ROLES)); eq()'s
      // chunks[3] is a single Param.
      if (Array.isArray(chunks[3])) {
        const values = (chunks[3] as unknown[]).map(unwrap);
        return values.includes(valueOf(row, chunks[1]));
      }
      return valueOf(row, chunks[1]) === unwrap(chunks[3]);
    }
    let any = false;
    let result = true;
    for (const chunk of chunks) {
      if (chunk && typeof chunk === "object" && Array.isArray((chunk as { queryChunks?: unknown }).queryChunks)) {
        any = true;
        result = result && evalCond(chunk, row);
      }
    }
    if (!any) throw new Error("evalCond: no matchable condition found in fake db test helper");
    return result;
  }

  function project(row: Row | JoinedRow, fields?: Record<string, unknown>): Row {
    if (!fields) return { ...(row as Row) };
    const out: Row = {};
    for (const [key, col] of Object.entries(fields)) out[key] = valueOf(row, col);
    return out;
  }

  function makeFakeDb() {
    const state: { users: Row[]; sessions: Row[]; rateLimits: Row[] } = { users: [], sessions: [], rateLimits: [] };
    function rowsFor(table: unknown): Row[] {
      if (table === schema.user) return state.users;
      if (table === schema.authSession) return state.sessions;
      if (table === schema.rateLimit) return state.rateLimits;
      // DEC-740: the login door also queries getHubOrg (orderBy().limit(),
      // no where()) -- always empty here, so loadSingleEventContext
      // short-circuits before ever querying schema.event.
      if (table === schema.org) return [];
      throw new Error("unexpected table in fake db test helper");
    }
    const db = {
      select(fields?: Record<string, unknown>) {
        return {
          from(table: unknown) {
            const limitFrom = (matched: (Row | JoinedRow)[]) => ({
              limit(n: number) {
                return Promise.resolve(matched.slice(0, n).map((r) => project(r, fields)));
              },
            });
            return {
              where(cond: unknown) {
                return limitFrom(rowsFor(table).filter((r) => evalCond(cond, r)));
              },
              orderBy() {
                return limitFrom(rowsFor(table));
              },
              innerJoin(joinTable: unknown, on: unknown) {
                const joined: JoinedRow[] = [];
                for (const left of rowsFor(table)) {
                  for (const right of rowsFor(joinTable)) {
                    const row: JoinedRow = {
                      [JOINED]: new Map([
                        [table, left],
                        [joinTable, right],
                      ]),
                    };
                    if (evalCond(on, row)) joined.push(row);
                  }
                }
                return {
                  where(cond: unknown) {
                    return limitFrom(joined.filter((r) => evalCond(cond, r)));
                  },
                };
              },
            };
          },
        };
      },
      insert(table: unknown) {
        return {
          values(row: Row) {
            // DEC-948: checkAndIncrementScopedLimit's atomic upsert (insert
            // ... on conflict(key) do update set count = count + 1
            // returning count) against the rate_limit table -- a real
            // push-only insert would wrongly reject a second attempt
            // against the same window.
            if (table === schema.rateLimit) {
              const existing = state.rateLimits.find((r) => r.key === row.key);
              return {
                onConflictDoUpdate: () => ({
                  returning: async () => {
                    if (existing) {
                      existing.count = (existing.count as number) + 1;
                      return [{ count: existing.count }];
                    }
                    const inserted = { ...row };
                    state.rateLimits.push(inserted);
                    return [{ count: inserted.count }];
                  },
                  then: (resolve: (v: undefined) => void) => {
                    if (existing) existing.count = (existing.count as number) + 1;
                    else state.rateLimits.push({ ...row });
                    resolve(undefined);
                  },
                }),
              };
            }
            rowsFor(table).push({ ...row });
            return Promise.resolve();
          },
        };
      },
      update(table: unknown) {
        return {
          set(patch: Row) {
            return {
              where(cond: unknown) {
                for (const r of rowsFor(table)) {
                  if (evalCond(cond, r)) Object.assign(r, patch);
                }
                return Promise.resolve();
              },
            };
          },
        };
      },
      delete(table: unknown) {
        return {
          where(cond: unknown) {
            const rows = rowsFor(table);
            const remaining = rows.filter((r) => !evalCond(cond, r));
            rows.length = 0;
            rows.push(...remaining);
            return Promise.resolve();
          },
        };
      },
    };
    return { db: db as unknown as AppEnv["Variables"]["db"], state };
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

  const TARGET_EMAIL = "reviewer-reset@example.test";
  const OLD_PASSWORD = "old-password-999";
  const ORG_B = "org-b";

  async function seedTargetUser(state: { users: Row[] }, orgId = ORG_A) {
    const { hashPassword } = await import("../src/auth/password");
    const passwordHash = await hashPassword(OLD_PASSWORD);
    const user = {
      id: "target-user-1",
      orgId,
      email: TARGET_EMAIL,
      passwordHash,
      role: "reviewer",
      contactId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.users.push(user);
    return user;
  }

  async function useRealResetHelpers() {
    const usersRepo = await import("../src/server/repo/users");
    const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
    vi.mocked(usersRepo.getOrgUserById).mockImplementation(actual.getOrgUserById);
    vi.mocked(usersRepo.updateUserPasswordHash).mockImplementation(actual.updateUserPasswordHash);
    vi.mocked(usersRepo.deleteUserSessions).mockImplementation(actual.deleteUserSessions);
  }

  async function buildFullApp(db: AppEnv["Variables"]["db"]) {
    const { sessionLoader } = await import("../src/server/middleware");
    const { authRoutes } = await import("../src/routes/auth");
    const { usersRoutes: freshUsersRoutes } = await import("../src/routes/api/users");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.use("*", sessionLoader);
    app.route("/", authRoutes);
    app.route("/", freshUsersRoutes);
    const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
    return { app, env };
  }

  async function login(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, email: string, password: string) {
    const csrfRes = await app.request("/login", {}, env);
    const setCookie = csrfRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error("no csrf cookie on /login");
    const csrf = match[1]!;
    const cookie = `${CSRF_COOKIE_NAME}=${csrf}`;
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email, password });
    return app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
      env,
    );
  }

  function sessionCookieFrom(res: Response): string {
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/chq_session=([^;]+)/);
    if (!match) throw new Error("no chq_session cookie on response");
    return `chq_session=${match[1]}`;
  }

  it("re-issues a well-formed password; old password stops working, new one logs in", async () => {
    await useRealResetHelpers();

    const { db, state } = makeFakeDb();
    await seedTargetUser(state);
    const { app, env } = await buildFullApp(db);

    const organizerApp = new Hono<AppEnv>();
    registerErrorHandler(organizerApp);
    organizerApp.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", { userId: "org-admin", role: "organizer", orgId: ORG_A });
      await next();
    });
    const { usersRoutes: freshUsersRoutes } = await import("../src/routes/api/users");
    organizerApp.route("/", freshUsersRoutes);

    const oldLoginBefore = await login(app, env, TARGET_EMAIL, OLD_PASSWORD);
    expect(oldLoginBefore.status).toBe(302);

    const resetRes = await organizerApp.request(
      `/api/v1/users/${state.users[0]!.id}/reset-password`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: "{}",
      },
      env,
    );
    expect(resetRes.status).toBe(200);
    const body = (await resetRes.json()) as { id: string; email: string; role: string; password: string };
    expect(body.email).toBe(TARGET_EMAIL);
    expect(body.role).toBe("reviewer");
    expect(body.password).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);

    const oldLoginAfter = await login(app, env, TARGET_EMAIL, OLD_PASSWORD);
    expect(oldLoginAfter.status).toBe(401);

    const newLogin = await login(app, env, TARGET_EMAIL, body.password);
    expect(newLogin.status).toBe(302);
  });

  it("revokes the target user's existing sessions", async () => {
    await useRealResetHelpers();

    const { db, state } = makeFakeDb();
    await seedTargetUser(state);
    const { app, env } = await buildFullApp(db);

    const targetLogin = await login(app, env, TARGET_EMAIL, OLD_PASSWORD);
    expect(targetLogin.status).toBe(302);
    const targetSessionCookie = sessionCookieFrom(targetLogin);
    expect(state.sessions).toHaveLength(1);

    const organizerApp = new Hono<AppEnv>();
    registerErrorHandler(organizerApp);
    organizerApp.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", { userId: "org-admin", role: "organizer", orgId: ORG_A });
      await next();
    });
    const { usersRoutes: freshUsersRoutes } = await import("../src/routes/api/users");
    organizerApp.route("/", freshUsersRoutes);

    const resetRes = await organizerApp.request(
      `/api/v1/users/${state.users[0]!.id}/reset-password`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: "{}",
      },
      env,
    );
    expect(resetRes.status).toBe(200);
    expect(state.sessions).toHaveLength(0);

    // The now-revoked session cookie no longer authenticates.
    const authedApp = new Hono<AppEnv>();
    registerErrorHandler(authedApp);
    authedApp.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    const { sessionLoader, requireReviewer } = await import("../src/server/middleware");
    authedApp.use("*", sessionLoader);
    authedApp.get("/api/v1/whoami", requireReviewer, (c) => c.json({ ok: true }));
    const whoamiRes = await authedApp.request("/api/v1/whoami", { headers: { cookie: targetSessionCookie } });
    expect(whoamiRes.status).toBe(401);
  });

  it("404s for an unknown or cross-org target id", async () => {
    await useRealResetHelpers();
    const { db, state } = makeFakeDb();
    await seedTargetUser(state, ORG_B);

    const organizerApp = new Hono<AppEnv>();
    registerErrorHandler(organizerApp);
    organizerApp.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", { userId: "org-admin", role: "organizer", orgId: ORG_A });
      await next();
    });
    const { usersRoutes: freshUsersRoutes } = await import("../src/routes/api/users");
    organizerApp.route("/", freshUsersRoutes);

    const crossOrgRes = await organizerApp.request(`/api/v1/users/${state.users[0]!.id}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(crossOrgRes.status).toBe(404);

    const unknownRes = await organizerApp.request(`/api/v1/users/does-not-exist/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(unknownRes.status).toBe(404);
  });

  it("403s for a reviewer caller", async () => {
    const app = await buildApp({ userId: "u1", role: "reviewer", orgId: ORG_A });
    const res = await app.request("/api/v1/users/target-user-1/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  it("400s without the CSRF header", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/users/target-user-1/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
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

    // DEC-948: the login door's rate limiter now reads/writes a D1
    // rate_limit row instead of KV.
    const rateLimits = new Map<string, { count: number; expiresAt: number }>();
    function extractEqValue(cond: unknown): unknown {
      const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
      const raw = chunks[3];
      return raw && typeof raw === "object" && "value" in (raw as object) ? (raw as { value: unknown }).value : raw;
    }

    // DEC-180 (wave-29 amendment): refundScopedLimit's where clause is
    // `and(eq(key, ...), gt(count, 0))` -- a nested condition tree, not
    // extractEqValue's flat eq() shape. Recursively hunts for the
    // `{ name: "key" }` chunk and reads the value two slots later.
    function findKeyValue(cond: unknown): string | undefined {
      if (!cond || typeof cond !== "object") return undefined;
      const chunks = (cond as { queryChunks?: unknown[] }).queryChunks;
      if (!Array.isArray(chunks)) return undefined;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        if (c && typeof c === "object" && (c as { name?: unknown }).name === "key") {
          const raw = chunks[i + 2];
          return raw && typeof raw === "object" && "value" in (raw as object) ? ((raw as { value: unknown }).value as string) : (raw as string);
        }
      }
      for (const c of chunks) {
        const found = findKeyValue(c);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    const db = {
      select(cols?: unknown) {
        return {
          from(table: unknown) {
            return {
              where(cond: unknown) {
                return {
                  limit(_n: number) {
                    if (table === schema.rateLimit) {
                      const key = extractEqValue(cond);
                      const row = rateLimits.get(key as string);
                      return Promise.resolve(row ? [{ count: row.count }] : []);
                    }
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
              // DEC-552 amendment (findings wave 14): createUser's INSERT is
              // now itself the ON CONFLICT DO NOTHING authority (see
              // src/server/repo/users.ts) -- this fake mirrors that shape by
              // skipping the push when the email already collides
              // case-insensitively, then chains the same well-formed thenable
              // whether or not onConflictDoNothing() gets called.
              const collides = rows.some(
                (r) => (r.email as string).toLowerCase() === (row.email as string).toLowerCase(),
              );
              const settle = () => {
                if (!collides) {
                  rows.push({ ...row });
                  lastInsertedId = row.id as string;
                } else {
                  lastInsertedId = row.id as string;
                }
                pendingByIdLookup = true;
                return Promise.resolve();
              };
              return {
                onConflictDoNothing: () => settle(),
                then: (resolve: (v: void) => void, reject?: (e: unknown) => void) => settle().then(resolve, reject),
              };
            } else if (table === schema.authSession) {
              sessions.push({ ...row });
              return Promise.resolve();
            } else if (table === schema.rateLimit) {
              const key = row.key as string;
              const existing = rateLimits.get(key);
              return {
                onConflictDoUpdate: () => ({
                  returning: async () => {
                    if (existing) {
                      existing.count += 1;
                      return [{ count: existing.count }];
                    }
                    rateLimits.set(key, { count: row.count as number, expiresAt: row.expiresAt as number });
                    return [{ count: row.count }];
                  },
                  then: (resolve: (v: undefined) => void) => {
                    if (existing) existing.count += 1;
                    else rateLimits.set(key, { count: row.count as number, expiresAt: row.expiresAt as number });
                    resolve(undefined);
                  },
                }),
              };
            } else {
              throw new Error("unexpected insert table");
            }
          },
        };
      },
      update(table: unknown) {
        return {
          set(_patch: unknown) {
            return {
              where(cond: unknown) {
                if (table === schema.rateLimit) {
                  const key = findKeyValue(cond);
                  const row = key ? rateLimits.get(key) : undefined;
                  if (row && row.count > 0) row.count -= 1;
                }
                return Promise.resolve();
              },
            };
          },
        };
      },
      delete(table: unknown) {
        return {
          where(cond: unknown) {
            if (table === schema.rateLimit) {
              rateLimits.delete(extractEqValue(cond) as string);
              return Promise.resolve();
            }
            // DEC-994: minting a session first revokes every existing
            // auth_session row for that user (session rotation on login).
            if (table === schema.authSession) {
              const userId = extractEqValue(cond) as string;
              for (let i = sessions.length - 1; i >= 0; i -= 1) {
                if (sessions[i]!.userId === userId) sessions.splice(i, 1);
              }
              return Promise.resolve();
            }
            throw new Error("unexpected delete table");
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
