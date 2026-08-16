// DEC-949 (wave 27 amendment, wired per task-w29-d): revokeResetTokenForUser
// is now called from the OTHER two password-change paths — POST
// /account/password (src/routes/account.tsx) and POST /claim/:token
// (src/routes/auth.tsx) — not just consumeResetToken's own delete inside
// POST /reset/:token. This file exercises both call sites at the route
// level: an outstanding reset grant for a user must not survive either
// route's success path.
//
// Self-contained (deliberately not extending test/account-password.test.ts
// or test/claim.test.ts) to stay clear of task-w29-a's concurrent edits to
// the rate-limiter admission blocks at the top of both handlers.

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { hashPassword } from "../src/auth/password";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { createResetToken, readResetToken, resetIndexKey } from "../src/auth/password-reset";
import type { KVStore } from "../src/auth/password-reset";
import type { AppEnv } from "../src/server/env";

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

  has(key: string): boolean {
    return this.store.has(key);
  }
}

const EMAIL = "speaker@example.test";
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

// -----------------------------------------------------------------------
// POST /account/password
// -----------------------------------------------------------------------

describe("POST /account/password revokes any outstanding reset grant (DEC-949)", () => {
  type Row = Record<string, unknown>;

  function makeFakeDb() {
    const state: { users: Row[]; sessions: Row[]; rateLimits: Row[] } = { users: [], sessions: [], rateLimits: [] };
    const colKeyOf = (table: unknown, col: unknown): string => {
      for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
        if (value === col) return key;
      }
      throw new Error("unmapped column");
    };
    const tableOf = (table: unknown): Row[] => {
      if (table === schema.user) return state.users;
      if (table === schema.authSession) return state.sessions;
      if (table === schema.rateLimit) return state.rateLimits;
      if (table === schema.org) return [];
      throw new Error("unexpected table");
    };
    const COLUMN_TABLES = new Map<unknown, unknown>();
    for (const t of [schema.user, schema.authSession, schema.rateLimit]) {
      for (const col of Object.values(t as unknown as Record<string, unknown>)) {
        if (col && typeof col === "object" && "name" in (col as object)) COLUMN_TABLES.set(col, t);
      }
    }
    const JOINED = Symbol("joined");
    type JoinedRow = { [JOINED]: Map<unknown, Row> };
    const isJoined = (row: Row | JoinedRow): row is JoinedRow => JOINED in (row as object);
    const valueOf = (row: Row | JoinedRow, col: unknown): unknown => {
      if (isJoined(row)) {
        const side = row[JOINED].get(COLUMN_TABLES.get(col));
        return side ? side[colKeyOf(COLUMN_TABLES.get(col), col)] : undefined;
      }
      return (row as Row)[colKeyOf(COLUMN_TABLES.get(col), col)];
    };
    function matches(cond: unknown, row: Row | JoinedRow): boolean {
      const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
      const chunkLiteral = (chunk: unknown): string | null => {
        if (chunk && typeof chunk === "object" && "value" in (chunk as object)) {
          const v = (chunk as { value: unknown }).value;
          if (Array.isArray(v) && typeof v[0] === "string") return v[0];
        }
        return null;
      };
      if (chunkLiteral(chunks[0]) === "(") {
        const inner = (chunks[1] as { queryChunks: unknown[] }).queryChunks;
        const results: boolean[] = [];
        let joiner: "and" | "or" = "and";
        for (const part of inner) {
          const literal = chunkLiteral(part);
          if (literal === " and ") {
            joiner = "and";
            continue;
          }
          if (literal === " or ") {
            joiner = "or";
            continue;
          }
          results.push(matches(part, row));
        }
        return joiner === "and" ? results.every(Boolean) : results.some(Boolean);
      }
      const column = chunks[1];
      const operator = chunkLiteral(chunks[2]) ?? " = ";
      const rawValue = chunks[3];
      const value = COLUMN_TABLES.has(rawValue)
        ? valueOf(row, rawValue)
        : rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
          ? (rawValue as { value: unknown }).value
          : rawValue;
      const actual = valueOf(row, column);
      if (operator === " <= ") return (actual as number | string | Date) <= (value as number | string | Date);
      if (operator === " >= ") return (actual as number | string | Date) >= (value as number | string | Date);
      return actual === value;
    }
    const db = {
      select(fields?: Record<string, unknown>) {
        return {
          from(table: unknown) {
            const limitFrom = (matched: (Row | JoinedRow)[]) => ({
              limit(n: number) {
                return Promise.resolve(
                  matched.slice(0, n).map((r) => {
                    if (!fields) return { ...(r as Row) };
                    const out: Row = {};
                    for (const [key, col] of Object.entries(fields)) out[key] = valueOf(r, col);
                    return out;
                  }),
                );
              },
            });
            return {
              where(cond: unknown) {
                return limitFrom(tableOf(table).filter((r) => matches(cond, r)));
              },
              orderBy() {
                return limitFrom(tableOf(table));
              },
              innerJoin(joinTable: unknown, on: unknown) {
                const joined: JoinedRow[] = [];
                for (const left of tableOf(table)) {
                  for (const right of tableOf(joinTable)) {
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
                    state.rateLimits.push({ ...row });
                    return [{ count: row.count }];
                  },
                  then: (resolve: (v: undefined) => void) => {
                    if (existing) existing.count = (existing.count as number) + 1;
                    else state.rateLimits.push({ ...row });
                    resolve(undefined);
                  },
                }),
              };
            }
            tableOf(table).push({ ...row });
            return Promise.resolve();
          },
        };
      },
      update(table: unknown) {
        return {
          set(patch: Row) {
            return {
              where(cond: unknown) {
                for (const r of tableOf(table)) if (matches(cond, r)) Object.assign(r, patch);
                return Promise.resolve();
              },
            };
          },
        };
      },
      delete(table: unknown) {
        return {
          where(cond: unknown) {
            const rows = tableOf(table);
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

  function buildApp(db: AppEnv["Variables"]["db"], kv: InMemoryKV) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.use("*", sessionLoader);
    app.route("/", authRoutes);
    app.route("/", accountRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
    return { app, env };
  }

  async function login(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
    const csrfRes = await app.request("/login", {}, env);
    const setCookie = csrfRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error("no csrf cookie on /login");
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: match[1]!, email: EMAIL, password: OLD_PASSWORD });
    const res = await app.request(
      "/login",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `${CSRF_COOKIE_NAME}=${match[1]}` },
        body: form.toString(),
      },
      env,
    );
    const loginSetCookie = res.headers.get("set-cookie") ?? "";
    const sessionMatch = loginSetCookie.match(/chq_session=([^;]+)/);
    if (!sessionMatch) throw new Error("no chq_session cookie on login response");
    return `chq_session=${sessionMatch[1]}`;
  }

  async function getAccountCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, sessionCookie: string) {
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
  ) {
    const form = new URLSearchParams({
      [CSRF_COOKIE_NAME]: csrf,
      current: OLD_PASSWORD,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    return app.request(
      "/account/password",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `${sessionCookie}; ${csrfCookie}` },
        body: form.toString(),
      },
      env,
    );
  }

  it("a live reset grant for the user is dead after a successful password change", async () => {
    const { db, state } = makeFakeDb();
    const user = await seedUser(state);
    const kv = new InMemoryKV();
    const resetToken = await createResetToken(kv, user.id);
    // Sanity: the grant is live before the change.
    await expect(readResetToken(kv, resetToken)).resolves.toEqual({ userId: user.id });

    const { app, env } = buildApp(db, kv);
    const sessionCookie = await login(app, env);
    const { csrf, csrfCookie } = await getAccountCsrf(app, env, sessionCookie);
    const res = await postPasswordChange(app, env, sessionCookie, csrf, csrfCookie);
    expect(res.status).toBe(200);

    await expect(readResetToken(kv, resetToken)).resolves.toBeNull();
    expect(kv.has(resetIndexKey(user.id))).toBe(false);
  });

  it("a user with no outstanding grant completes the change unchanged", async () => {
    const { db, state } = makeFakeDb();
    const user = await seedUser(state);
    const kv = new InMemoryKV();
    const { app, env } = buildApp(db, kv);
    const sessionCookie = await login(app, env);
    const { csrf, csrfCookie } = await getAccountCsrf(app, env, sessionCookie);
    const res = await postPasswordChange(app, env, sessionCookie, csrf, csrfCookie);
    expect(res.status).toBe(200);
    expect(kv.has(resetIndexKey(user.id))).toBe(false);
  });
});

// -----------------------------------------------------------------------
// POST /claim/:token
// -----------------------------------------------------------------------

describe("POST /claim/:token revokes any outstanding reset grant for the newly-claimed user (DEC-949)", () => {
  const CONTACT_ID = "ct_1";
  const ORG_ID = "org_1";
  const CONTACT_EMAIL = "speaker@example.test";
  // With crypto.getRandomValues mocked (below) to fill 20-byte arrays with
  // 0x01, newId()'s base32 alphabet index 1 is 'b' — 20 chars of it.
  const DETERMINISTIC_USER_ID = "b".repeat(20);

  type Row = Record<string, unknown>;

  function makeFakeDb(opts: { contacts: unknown[]; users: unknown[] }) {
    const state = { contacts: [...opts.contacts], users: [...opts.users] as Row[], sessions: [] as Row[] };
    const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
    return {
      db: {
        select() {
          return {
            from(table: unknown) {
              const rowsFor = () => {
                if (table === schema.contact) return Promise.resolve(state.contacts);
                if (table === schema.user) return Promise.resolve(state.users);
                if (table === schema.rateLimit) return Promise.resolve([]);
                throw new Error("unexpected table in fake db select");
              };
              return {
                where() {
                  // findAccountUserIds' user select ends in .orderBy (DEC-456
                  // wave-71 amendment); the others end in .limit.
                  return { limit: rowsFor, orderBy: rowsFor };
                },
              };
            },
          };
        },
        insert(table: unknown) {
          return {
            values(row: Row) {
              if (table === schema.rateLimit) {
                const vals = row as { key: string; count: number; expiresAt: number };
                return {
                  onConflictDoUpdate: () => ({
                    returning: async () => {
                      const existing = rateLimitRows.get(vals.key);
                      if (existing) {
                        existing.count += 1;
                        return [{ count: existing.count }];
                      }
                      rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
                      return [{ count: vals.count }];
                    },
                    then: (resolve: (v: undefined) => void) => {
                      const existing = rateLimitRows.get(vals.key);
                      if (existing) existing.count += 1;
                      else rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
                      resolve(undefined);
                    },
                  }),
                };
              }
              if (table === schema.user) state.users.push(row);
              if (table === schema.authSession) state.sessions.push(row);
              return Promise.resolve();
            },
          };
        },
        delete(table: unknown) {
          return {
            where() {
              return Promise.resolve();
            },
          };
        },
        // DEC-949 (wave 46 amendment): POST /claim/:token now issues
        // refundScopedLimit (db.update) once the token resolves.
        update(table: unknown) {
          return {
            set() {
              return {
                where() {
                  if (table === schema.rateLimit) return Promise.resolve();
                  throw new Error("unexpected table in fake db update");
                },
              };
            },
          };
        },
      } as unknown as AppEnv["Variables"]["db"],
      state,
    };
  }

  function buildApp(db: AppEnv["Variables"]["db"], kv: InMemoryKV) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
    return { app, env };
  }

  async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, path: string) {
    const res = await app.request(path, {}, env);
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
    return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a live reset grant for the resulting userId is dead after a successful claim", async () => {
    // Make newId() deterministic (20-byte draws only) so a reset grant can
    // be pre-seeded under the userId the claim route is about to mint.
    const original = crypto.getRandomValues.bind(crypto);
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((arr: ArrayBufferView) => {
      if (arr instanceof Uint8Array && arr.length === 20) {
        arr.fill(1);
        return arr;
      }
      return original(arr as never);
    }) as typeof crypto.getRandomValues);

    const { db, state } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
    });
    const kv = new InMemoryKV();
    // Seed a live reset grant under the userId claim is about to mint.
    const resetToken = await createResetToken(kv, DETERMINISTIC_USER_ID);
    await expect(readResetToken(kv, resetToken)).resolves.toEqual({ userId: DETERMINISTIC_USER_ID });

    const { app, env } = buildApp(db, kv);
    // createClaimToken draws 32 bytes, unaffected by the 20-byte mock.
    const { createClaimToken } = await import("../src/auth/claim");
    const claimToken = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${claimToken}`);
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, password: "a-valid-password" });
    const res = await app.request(
      `/claim/${claimToken}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");
    expect(state.users[0]?.id).toBe(DETERMINISTIC_USER_ID);

    await expect(readResetToken(kv, resetToken)).resolves.toBeNull();
    expect(kv.has(resetIndexKey(DETERMINISTIC_USER_ID))).toBe(false);
  });

  it("a claim with no outstanding grant for the resulting userId completes unchanged", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
    });
    const kv = new InMemoryKV();
    const { app, env } = buildApp(db, kv);
    const { createClaimToken } = await import("../src/auth/claim");
    const claimToken = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${claimToken}`);
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, password: "a-valid-password" });
    const res = await app.request(
      `/claim/${claimToken}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");
  });
});
