// DEC-994: session minting is ONE helper (src/server/auth-session.ts,
// issueSession) that revokes every existing auth_session row for a user
// before minting a fresh one — login, the claim/password-set flow and the
// self-service password change all route through it. This exercises the
// three call sites end-to-end against a small in-memory fake db (same shape
// as test/account-password.test.ts and test/claim.test.ts), plus a
// source-grep scan proving no call site inserts an authSession row by hand.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader, requireOrganizer } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { hashPassword } from "../src/auth/password";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { createClaimToken, type KVStore } from "../src/auth/claim";
import type { AppEnv } from "../src/server/env";

// -----------------------------------------------------------------------
// Minimal in-memory fake db: dispatches by table reference identity and
// evaluates real drizzle `eq(column, value)` SQL objects, mirroring
// test/account-password.test.ts's harness.
// -----------------------------------------------------------------------

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
  ...buildColumnMap(schema.contact as unknown as Record<string, unknown>),
  ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
]);

function colKey(col: unknown): string {
  const key = COLUMN_KEYS.get(col);
  if (!key) throw new Error("unmapped column in fake db test helper");
  return key;
}

// DEC-276 (wave 63): auth is now a single innerJoin (auth_session ⋈ user), so
// the fake db has to resolve a column against the correct side of a joined
// row — schema.user.id and schema.authSession.id share the key "id".
function buildTableMap(table: Record<string, unknown>, tableRef: unknown, into: Map<unknown, unknown>) {
  for (const col of Object.values(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) into.set(col, tableRef);
  }
  return into;
}

const COLUMN_TABLES = new Map<unknown, unknown>();
for (const t of [schema.user, schema.authSession, schema.contact, schema.rateLimit]) {
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

function matches(cond: unknown, row: Row | JoinedRow): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  const column = chunks[1];
  const rawValue = chunks[3];
  // A join condition compares two columns (eq(a.x, b.y)); a filter compares a
  // column to a Param-wrapped literal.
  if (COLUMN_TABLES.has(rawValue)) return valueOf(row, column) === valueOf(row, rawValue);
  const value =
    rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
      ? (rawValue as { value: unknown }).value
      : rawValue;
  return valueOf(row, column) === value;
}

function project(row: Row | JoinedRow, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...(row as Row) };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = valueOf(row, col);
  return out;
}

function makeFakeDb() {
  const state: { users: Row[]; sessions: Row[]; contacts: Row[]; rateLimits: Row[] } = {
    users: [],
    sessions: [],
    contacts: [],
    rateLimits: [],
  };
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    if (table === schema.authSession) return state.sessions;
    if (table === schema.contact) return state.contacts;
    if (table === schema.rateLimit) return state.rateLimits;
    // DEC-740: GET /login also queries getHubOrg (orderBy().limit(), no
    // where()) -- always empty here so loadSingleEventContext short-circuits
    // before ever querying schema.event.
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
              return limitFrom(rowsFor(table).filter((r) => matches(cond, r)));
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
                  if (matches(on, row)) joined.push(row);
                }
              }
              return {
                where(cond: unknown) {
                  return limitFrom(joined.filter((r) => matches(cond, r)));
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

class InMemoryKV implements KVStore {
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
const PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

async function seedUser(state: { users: Row[] }) {
  const passwordHash = await hashPassword(PASSWORD);
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
  // Stand-in "protected route" mirroring a real authenticated API route,
  // to check whether a given session cookie still authenticates.
  app.get("/api/v1/events", requireOrganizer, (c) => c.json({ items: [] }));
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, path: string) {
  const res = await app.request(path, {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function login(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, password: string) {
  const { csrf, cookie } = await getCsrf(app, env, "/login");
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email: EMAIL, password });
  return app.request(
    "/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: form.toString(),
    },
    env,
  );
}

function sessionCookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/chq_session=([^;]+)/);
  if (!match) throw new Error("no chq_session cookie on response");
  return `chq_session=${match[1]}`;
}

async function checkAdmin(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, sessionCookie: string) {
  return app.request("/api/v1/events", { headers: { cookie: sessionCookie } }, env);
}

describe("session rotation on login (DEC-994)", () => {
  it("logging in a second time revokes the first cookie; only the newest cookie renders /admin", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const loginA = await login(app, env, PASSWORD);
    expect(loginA.status).toBe(302);
    const cookieA = sessionCookieFrom(loginA);

    // Cookie A works before the second login.
    const preCheck = await checkAdmin(app, env, cookieA);
    expect(preCheck.status).toBe(200);

    const loginB = await login(app, env, PASSWORD);
    expect(loginB.status).toBe(302);
    const cookieB = sessionCookieFrom(loginB);
    expect(cookieB).not.toBe(cookieA);

    // Cookie A (the stolen/stale token) now 401s on the protected route --
    // in the real app sessionLoader clears it and a page route would 302 to
    // /login.
    const checkA = await checkAdmin(app, env, cookieA);
    expect(checkA.status).toBe(401);

    // Cookie B (this login's own cookie) still works.
    const checkB = await checkAdmin(app, env, cookieB);
    expect(checkB.status).toBe(200);

    // Exactly one session row survives -- the login helper deletes before
    // inserting, it does not merely add to the pile.
    expect(state.sessions).toHaveLength(1);
  });
});

describe("issueSession revokes-first contract (DEC-994)", () => {
  it("deletes every existing session for that userId before minting the fresh one", async () => {
    const { db, state } = makeFakeDb();
    const { issueSession } = await import("../src/server/auth-session");
    const { hashToken } = await import("../src/auth/tokens");

    state.sessions.push(
      { id: "old_1", userId: "u_1", tokenHash: "hash-a", expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: "old_2", userId: "u_1", tokenHash: "hash-b", expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      // A different user's session must be left alone -- issueSession scopes
      // its delete to the given userId only.
      { id: "other_user", userId: "u_2", tokenHash: "hash-c", expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    );

    const token = await issueSession(db, "u_1", new Date());

    const u1Sessions = state.sessions.filter((s) => s.userId === "u_1");
    expect(u1Sessions).toHaveLength(1);
    expect(u1Sessions[0]!.tokenHash).toBe(await hashToken(token));
    // The other user's row survived untouched.
    expect(state.sessions.some((s) => s.id === "other_user")).toBe(true);
  });
});

describe("claim/password-set (POST /claim/:token) routes through issueSession (DEC-994)", () => {
  const CONTACT_ID = "ct_1";
  const ORG_ID = "org_1";
  const CONTACT_EMAIL = "new-speaker@example.test";

  it("setting a password from a claim link mints exactly one session for the new user", async () => {
    const { db, state } = makeFakeDb();
    state.contacts.push({ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL });
    const { app, env } = buildApp(db);
    const kv = env.KV as unknown as InMemoryKV;

    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });
    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, password: "a-valid-password" });
    const res = await app.request(
      `/claim/${token}`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: form.toString(),
      },
      env,
    );
    expect(res.status).toBe(302);
    expect(state.sessions).toHaveLength(1);
    const sessionCookie = sessionCookieFrom(res);
    const portalCheck = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
    expect(portalCheck.status).toBe(200);
  });
});

describe("password change leaves the caller with a working session (DEC-994/DEC-200)", () => {
  it("the caller's cookie after a password change still authenticates", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const loginRes = await login(app, env, PASSWORD);
    const sessionCookie = sessionCookieFrom(loginRes);

    // GET /account/password needs the session cookie to render for this user.
    const getRes = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
    expect(getRes.status).toBe(200);
    const setCookie = getRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error("no chq_csrf cookie set on GET /account/password");
    const csrf = match[1]!;
    const csrfCookie = `${CSRF_COOKIE_NAME}=${match[1]}`;

    const form = new URLSearchParams({
      [CSRF_COOKIE_NAME]: csrf,
      current: PASSWORD,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    const changeRes = await app.request(
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
    expect(changeRes.status).toBe(200);
    const freshCookie = sessionCookieFrom(changeRes);

    const check = await checkAdmin(app, env, freshCookie);
    expect(check.status).toBe(200);
    // Exactly one session survives the change -- issueSession revoked the
    // old one and minted exactly one fresh row, not two.
    expect(state.sessions).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------
// Source-grep scan (DEC-994): after this task, issueSession is the ONLY
// place in src/ allowed to `insert(schema.authSession)`.
// -----------------------------------------------------------------------

describe("insert(schema.authSession) enumeration scan (DEC-994)", () => {
  it("appears in exactly one file: src/server/auth-session.ts", () => {
    const srcRoot = path.join(__dirname, "..", "src");
    const hits: string[] = [];
    const NEEDLE = "insert(schema.authSession)";

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          const text = readFileSync(full, "utf8");
          if (text.includes(NEEDLE)) hits.push(full);
        }
      }
    }
    walk(srcRoot);

    expect(hits).toEqual([path.join(srcRoot, "server", "auth-session.ts")]);
  });
});
