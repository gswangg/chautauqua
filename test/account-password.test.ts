// DEC-200 coverage: self-service password change at GET/POST
// /account/password (src/routes/account.tsx) + the welcome-email password
// strip in POST /api/v1/users (src/routes/api/users.ts). No live D1 in this
// harness (see test/claim.test.ts's note) — a small in-memory fake db
// dispatches by table identity and evaluates the real drizzle `eq()`
// conditions the routes build, so session revocation (delete + reinsert)
// is exercised for real rather than mocked away.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader, requireOrganizer } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { hashPassword } from "../src/auth/password";
import { newSessionToken, hashToken } from "../src/auth/tokens";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";

// -----------------------------------------------------------------------
// Minimal in-memory fake db: dispatches by table reference identity and
// evaluates real drizzle `eq(column, value)` SQL objects against a known
// set of columns the routes under test actually filter on. Good enough for
// single-condition eq() where clauses; not a general SQL emulator.
// -----------------------------------------------------------------------

type Row = Record<string, unknown>;

// Built from the real schema objects (rather than hand-picking a few
// columns) so any select({...}) projection the routes use — not just the
// columns filtered on in a where() clause — resolves correctly.
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

function matches(cond: unknown, row: Row): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  const column = chunks[1];
  const rawValue = chunks[3];
  // drizzle wraps the right-hand side of eq() in a `Param` object rather
  // than passing the primitive through — unwrap it if present.
  const value =
    rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
      ? (rawValue as { value: unknown }).value
      : rawValue;
  return row[colKey(column)] === value;
}

function project(row: Row, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...row };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = row[colKey(col)];
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
          const limitFrom = (matched: Row[]) => ({
            limit(n: number) {
              return Promise.resolve(matched.slice(0, n).map((r) => project(r, fields)));
            },
          });
          return {
            where(cond: unknown) {
              return limitFrom(rowsFor(table).filter((r) => matches(cond, r)));
            },
            orderBy() {
              return limitFrom(rowsFor(table));
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
          // DEC-948: checkAndIncrementScopedLimit's atomic upsert (insert
          // ... on conflict(key) do update set count = count + 1 returning
          // count) against the rate_limit table -- a real push-only insert
          // would wrongly reject a second attempt against the same window.
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
                if (matches(cond, r)) Object.assign(r, patch);
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
          const remaining = rows.filter((r) => !matches(cond, r));
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

const EMAIL = "speaker@example.test";
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

async function seedUser(state: { users: Row[] }) {
  const passwordHash = await hashPassword(OLD_PASSWORD);
  const user = {
    id: "u_1",
    orgId: "org_1",
    email: EMAIL,
    passwordHash,
    role: "organizer",
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.users.push(user);
  return user;
}

function buildApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", authRoutes);
  app.route("/", accountRoutes);
  // Stand-in "protected route" for session-revocation coverage, mirroring
  // the shape of a real authenticated API route without pulling in an
  // unrelated repo module.
  app.get("/api/v1/events", requireOrganizer, (c) => c.json({ items: [] }));
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function getLoginCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
  const res = await app.request("/login", {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("no csrf cookie on /login");
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function login(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, password: string) {
  const { csrf, cookie } = await getLoginCsrf(app, env);
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email: EMAIL, password });
  const res = await app.request(
    "/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: form.toString(),
    },
    env,
  );
  return res;
}

function sessionCookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/chq_session=([^;]+)/);
  if (!match) throw new Error("no chq_session cookie on response");
  return `chq_session=${match[1]}`;
}

async function getAccountCsrf(
  app: Hono<AppEnv>,
  env: { KV: AppEnv["Bindings"]["KV"] },
  sessionCookie: string,
) {
  const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("no csrf cookie on GET /account/password");
  return { csrf: match[1]!, csrfCookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

function postPasswordChange(
  app: Hono<AppEnv>,
  env: { KV: AppEnv["Bindings"]["KV"] },
  sessionCookie: string,
  csrf: string,
  csrfCookie: string,
  fields: { current: string; next: string; confirm: string },
) {
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, ...fields });
  return app.request(
    "/account/password",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${sessionCookie}; ${csrfCookie}`,
      },
      body: form.toString(),
    },
    env,
  );
}

describe("GET/POST /account/password — anonymous", () => {
  it("both redirect 302 to /login", async () => {
    const { db } = makeFakeDb();
    const { app, env } = buildApp(db);

    const getRes = await app.request("/account/password", {}, env);
    expect(getRes.status).toBe(302);
    expect(getRes.headers.get("location")).toBe("/login");

    const postRes = await app.request("/account/password", { method: "POST" }, env);
    expect(postRes.status).toBe(302);
    expect(postRes.headers.get("location")).toBe("/login");
  });
});

describe("POST /account/password — wrong current password", () => {
  it("400s and leaves the stored hash unchanged", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const loginRes = await login(app, env, OLD_PASSWORD);
    expect(loginRes.status).toBe(302);
    const sessionCookie = sessionCookieFrom(loginRes);

    const { csrf, csrfCookie } = await getAccountCsrf(app, env, sessionCookie);
    const res = await postPasswordChange(app, env, sessionCookie, csrf, csrfCookie, {
      current: "totally-wrong",
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Current password is incorrect.");

    // The old password still works.
    const stillWorks = await login(app, env, OLD_PASSWORD);
    expect(stillWorks.status).toBe(302);
  });

  it("400s when the new password and confirmation mismatch", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const loginRes = await login(app, env, OLD_PASSWORD);
    const sessionCookie = sessionCookieFrom(loginRes);
    const { csrf, csrfCookie } = await getAccountCsrf(app, env, sessionCookie);

    const res = await postPasswordChange(app, env, sessionCookie, csrf, csrfCookie, {
      current: OLD_PASSWORD,
      next: NEW_PASSWORD,
      confirm: "does-not-match",
    });
    expect(res.status).toBe(400);
  });

  it("400s when the new password is under 8 characters", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const loginRes = await login(app, env, OLD_PASSWORD);
    const sessionCookie = sessionCookieFrom(loginRes);
    const { csrf, csrfCookie } = await getAccountCsrf(app, env, sessionCookie);

    const res = await postPasswordChange(app, env, sessionCookie, csrf, csrfCookie, {
      current: OLD_PASSWORD,
      next: "short",
      confirm: "short",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /account/password — successful change", () => {
  it("old password now fails login (401), new password succeeds", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const loginRes = await login(app, env, OLD_PASSWORD);
    const sessionCookie = sessionCookieFrom(loginRes);
    const { csrf, csrfCookie } = await getAccountCsrf(app, env, sessionCookie);

    const changeRes = await postPasswordChange(app, env, sessionCookie, csrf, csrfCookie, {
      current: OLD_PASSWORD,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(changeRes.status).toBe(200);
    const changedText = await changeRes.text();
    expect(changedText).toContain("Password changed");

    const oldLogin = await login(app, env, OLD_PASSWORD);
    expect(oldLogin.status).toBe(401);

    const newLogin = await login(app, env, NEW_PASSWORD);
    expect(newLogin.status).toBe(302);
  });

  it("revokes every other session while the response's new cookie keeps this browser signed in", async () => {
    const { db, state } = makeFakeDb();
    const user = await seedUser(state);
    const { app, env } = buildApp(db);

    const login1 = await login(app, env, OLD_PASSWORD);
    const session1 = sessionCookieFrom(login1);

    // DEC-994: session minting now rotates on login, so a second /login for
    // the same user would revoke session1 itself. To exercise "some other
    // live session besides the caller's" we seed session2 directly into the
    // fake db's session table, as if it were a second already-live browser.
    const session2Token = newSessionToken();
    state.sessions.push({
      id: "sess_2",
      userId: user.id,
      tokenHash: await hashToken(session2Token),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const session2 = `chq_session=${session2Token}`;

    // Both sessions currently authenticate against the protected stand-in route.
    const preCheck1 = await app.request("/api/v1/events", { headers: { cookie: session1 } }, env);
    expect(preCheck1.status).toBe(200);
    const preCheck2 = await app.request("/api/v1/events", { headers: { cookie: session2 } }, env);
    expect(preCheck2.status).toBe(200);

    const { csrf, csrfCookie } = await getAccountCsrf(app, env, session1);
    const changeRes = await postPasswordChange(app, env, session1, csrf, csrfCookie, {
      current: OLD_PASSWORD,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(changeRes.status).toBe(200);
    const freshCookie = sessionCookieFrom(changeRes);

    // Session 2 (a different browser) is revoked.
    const postCheck2 = await app.request("/api/v1/events", { headers: { cookie: session2 } }, env);
    expect(postCheck2.status).toBe(401);

    // The old session-1 cookie was deleted too (revoke-all), but the fresh
    // cookie issued on the change response still works.
    const postCheckFresh = await app.request("/api/v1/events", { headers: { cookie: freshCookie } }, env);
    expect(postCheckFresh.status).toBe(200);
  });
});

// -----------------------------------------------------------------------
// Welcome-email password strip (DEC-200) — POST /api/v1/users
// -----------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/v1/users welcome email no longer carries the password", () => {
  it("mentions /account/password but never the returned one-time password", async () => {
    const sends: { text: string }[] = [];

    vi.doMock("../src/server/repo/users", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
      return {
        ...actual,
        listOrgUsers: vi.fn(async () => []),
        createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
          id: "user-1",
          orgId: input.orgId,
          email: input.email,
          role: input.role,
          contactId: null,
          createdAt: 0,
        })),
      };
    });
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        listEventsForOrg: vi.fn(async () => [{ id: "event-1", orgId: "org-a" }]),
      };
    });
    vi.doMock("../src/server/context", async () => {
      const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
      return {
        ...actual,
        makeMailer: vi.fn(() => ({
          send: vi.fn(async (m: { text: string }) => {
            sends.push(m);
          }),
        })),
      };
    });

    const { usersRoutes } = await import("../src/routes/api/users");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", { userId: "u1", role: "organizer", orgId: "org-a" });
      c.set("db", {} as never);
      await next();
    });
    app.route("/", usersRoutes);

    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { password: string };
    expect(body.password).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);

    expect(sends).toHaveLength(1);
    expect(sends[0]!.text).not.toContain(body.password);
    expect(sends[0]!.text).toContain("/account/password");
  });
});
