// DEC-948 (amendment, task w27-f): POST /login and POST /account/password
// used to gate on a read-only peekScopedLimit, then only call
// incrementScopedLimit AFTER the (real, ~100k-iteration PBKDF2) password
// derivation confirmed a failure. That's a read-then-write race: N
// concurrent requests for the same identity all peek the SAME
// pre-increment count (none of them has incremented yet, because the
// increment only happens after the slow derivation), so all N reach the
// derivation and all N are allowed through, regardless of how far past the
// cap N is. checkAndIncrementScopedLimit collapses check+increment into one
// atomic D1 upsert issued BEFORE the derivation, so concurrent callers land
// on distinct counts and exactly `max` of them ever get past the gate.
//
// A SERIAL test (issuing requests one at a time, awaiting each) cannot see
// this bug at all: serial requests never share a "pre-increment" window in
// the first place, so peek-then-increment and check-and-increment produce
// identical serial results. Only firing every request through Promise.all
// (so they interleave at the real `await crypto.subtle.deriveBits(...)`
// yield points inside verifyPassword) exercises the race.
//
// Fake db copied/trimmed from test/account-password.test.ts's harness:
// dispatches by table reference identity and evaluates the real drizzle
// eq()/and() condition trees the routes build, including the atomic
// rate_limit upsert shape (existing-row lookup happens synchronously at
// `.values()` call time, matching how a real DB session would see a
// consistent snapshot per statement).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { hashPassword } from "../src/auth/password";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { loginIdentityKey } from "../src/routes/auth-helpers";
import type { AppEnv } from "../src/server/env";

// DEC-072 wave-54 amendment: no request in this file sets cf-connecting-ip
// or x-forwarded-for, so requestIpFromHeaders resolves every request's IP
// to "unknown" -- the identity bucket key is loginIdentityKey(EMAIL,
// "unknown"), not the bare EMAIL.
const TEST_IP = "unknown";

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
  ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
]);

function colKey(col: unknown): string {
  const key = COLUMN_KEYS.get(col);
  if (!key) throw new Error("unmapped column in fake db test helper");
  return key;
}

const COLUMN_TABLES = new Map<unknown, unknown>();
function buildTableMap(table: Record<string, unknown>, tableRef: unknown, into: Map<unknown, unknown>) {
  for (const col of Object.values(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) into.set(col, tableRef);
  }
  return into;
}
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

function chunkLiteral(chunk: unknown): string | null {
  if (chunk && typeof chunk === "object" && "value" in (chunk as object)) {
    const v = (chunk as { value: unknown }).value;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return null;
}

function matches(cond: unknown, row: Row | JoinedRow): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
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
    // getHubOrg (orderBy().limit(), no where()) — always empty here, so
    // loadSingleEventContext short-circuits before ever querying schema.event.
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
            // DEC-948: the atomic upsert (insert ... on conflict(key) do
            // update set count = count + 1 returning count). The
            // pre-existing-row lookup happens right here, synchronously, at
            // `.values()` call time — matching a real DB statement's
            // single-snapshot semantics — so this fake exercises the SAME
            // atomicity guarantee the production D1 statement provides.
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

const EMAIL = "concurrent@example.test";
const PASSWORD = "correct-password-123";
const AUTH_RATE_LIMIT_MAX = 20;

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
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function getCsrf(
  app: Hono<AppEnv>,
  env: { KV: AppEnv["Bindings"]["KV"] },
  path = "/login",
  extraHeaders: Record<string, string> = {},
) {
  const res = await app.request(path, { headers: extraHeaders }, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie on ${path}`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

function postLogin(
  app: Hono<AppEnv>,
  env: { KV: AppEnv["Bindings"]["KV"] },
  csrf: string,
  csrfCookie: string,
  fields: { email: string; password: string },
) {
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, ...fields });
  return app.request(
    "/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
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

describe("DEC-948 amendment: POST /login rate budget is atomic under concurrency", () => {
  it(`fires ${AUTH_RATE_LIMIT_MAX + 5} concurrent wrong-password attempts for one email: exactly ${AUTH_RATE_LIMIT_MAX} are non-429, and the stored count equals every request made`, async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const N = AUTH_RATE_LIMIT_MAX + 5;
    const csrfPairs = await Promise.all(Array.from({ length: N }, () => getCsrf(app, env)));
    const responses = await Promise.all(
      csrfPairs.map(({ csrf, cookie }) => postLogin(app, env, csrf, cookie, { email: EMAIL, password: "wrong-password" })),
    );

    const non429 = responses.filter((r) => r.status !== 429).length;
    // The read-then-write (peek/increment) shape this replaces would have
    // let every one of the N concurrent requests read the same
    // pre-increment count and pass — i.e. non429 === N, not
    // AUTH_RATE_LIMIT_MAX. A serial loop can never distinguish the two
    // shapes (see file header); only this concurrent fan-out can.
    expect(non429).toBe(AUTH_RATE_LIMIT_MAX);

    const userBucket = state.rateLimits.find((r) =>
      (r.key as string).startsWith(`ratelimit:login-user:${loginIdentityKey(EMAIL, TEST_IP)}:`),
    );
    expect(userBucket).toBeDefined();
    // Every one of the N concurrent requests incremented exactly once —
    // the atomic upsert never lets two callers land on the same count.
    expect(userBucket!.count).toBe(N);
  });

  it("a successful login still leaves the per-email budget cleared, but does not reset the per-IP bucket", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    // Rack up a few failures first (below the cap).
    for (let i = 0; i < 5; i++) {
      const { csrf, cookie } = await getCsrf(app, env);
      const res = await postLogin(app, env, csrf, cookie, { email: EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    const { csrf, cookie } = await getCsrf(app, env);
    const success = await postLogin(app, env, csrf, cookie, { email: EMAIL, password: PASSWORD });
    expect(success.status).toBe(302);

    const userBucket = state.rateLimits.find((r) =>
      (r.key as string).startsWith(`ratelimit:login-user:${loginIdentityKey(EMAIL, TEST_IP)}:`),
    );
    expect(userBucket).toBeUndefined();

    // DEC-948 amendment: the per-IP bucket is a source budget, not a
    // per-identity failures-only one — it stays consumed by successes and
    // is never reset.
    const ipBucket = state.rateLimits.find((r) => (r.key as string).startsWith("ratelimit:login-ip:"));
    expect(ipBucket).toBeDefined();
    expect(ipBucket!.count).toBe(6);
  });
});

describe("DEC-948 amendment: POST /account/password rate budget is atomic under concurrency", () => {
  it(`fires ${AUTH_RATE_LIMIT_MAX + 5} concurrent wrong-current-password attempts: exactly ${AUTH_RATE_LIMIT_MAX} are non-429, and the stored count equals every request made`, async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state);
    const { app, env } = buildApp(db);

    const { csrf: loginCsrf, cookie: loginCookie } = await getCsrf(app, env);
    const loginRes = await postLogin(app, env, loginCsrf, loginCookie, { email: EMAIL, password: PASSWORD });
    expect(loginRes.status).toBe(302);
    const sessionCookie = sessionCookieFrom(loginRes);

    const N = AUTH_RATE_LIMIT_MAX + 5;
    const csrfPairs = await Promise.all(
      Array.from({ length: N }, () => getCsrf(app, env, "/account/password", { cookie: sessionCookie })),
    );
    const responses = await Promise.all(
      csrfPairs.map(({ csrf, cookie }) =>
        postPasswordChange(app, env, sessionCookie, csrf, cookie, {
          current: "totally-wrong",
          next: "new-password-456",
          confirm: "new-password-456",
        }),
      ),
    );

    const non429 = responses.filter((r) => r.status !== 429).length;
    expect(non429).toBe(AUTH_RATE_LIMIT_MAX);

    const userBucket = state.rateLimits.find((r) => (r.key as string).startsWith("ratelimit:password-change:u_1:"));
    expect(userBucket).toBeDefined();
    expect(userBucket!.count).toBe(N);
  });
});
