// DEC-180 (wave-29 amendment) / DEC-948 / DEC-004: the login/forgot/
// password-change limiters moved from peek-then-conditionally-increment
// (a read-then-write race: two concurrent requests can both peek under the
// cap before either writes) to consume-then-refund — checkAndIncrementScopedLimit
// spends one unit of budget atomically at admission time, and callers that
// want a failures-only budget give the unit back with refundScopedLimit
// (itself a single `count = count - 1 where count > 0` statement, never a
// select first).
//
// (a) runs against a real in-memory SQLite engine (same technique as
// test/rate-limit.test.ts) so the actual D1 upsert executes, proving
// concurrent admission is still exactly `max`. (b)-(e) exercise the real
// POST /login and POST /forgot handlers end-to-end against a small fake db
// that evaluates real drizzle eq()/and()/gt() condition trees, so the
// refund's atomic UPDATE statement is exercised for real, not stubbed away.
// (f) is a source-grep scan proving the deleted peekScopedLimit export left
// no call site behind.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { checkAndIncrementScopedLimit } from "../src/server/repo/rate-limit";
import type { Db } from "../src/server/context";
import { hashPassword } from "../src/auth/password";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { loginIdentityKey } from "../src/routes/auth-helpers";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

// ---------------------------------------------------------------------
// (a) concurrent admission against a real D1-shaped SQLite engine.
// ---------------------------------------------------------------------

const DDL = `
create table rate_limit (
  key text primary key,
  count integer not null,
  expires_at integer not null
);
`;

function makeSqliteDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

describe("checkAndIncrementScopedLimit: N concurrent admissions at the cap", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeSqliteDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("many concurrent callers past the cap: exactly `max` are admitted", async () => {
    const now = 1_000_000;
    const cap = 5;
    const n = 20;
    const results = await Promise.all(
      Array.from({ length: n }, () =>
        checkAndIncrementScopedLimit(db, "login-user", "concurrent@example.test", now, { windowSeconds: 900, max: cap }),
      ),
    );
    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBe(cap);
  });
});

// ---------------------------------------------------------------------
// (b)-(d) end-to-end POST /login against a fake db that evaluates real
// drizzle condition trees (eq/and/gt), so the refund's atomic UPDATE runs
// for real.
// ---------------------------------------------------------------------

type Row = Record<string, unknown>;

function chunkLiteral(chunk: unknown): string | null {
  if (chunk && typeof chunk === "object" && "value" in (chunk as object)) {
    const v = (chunk as { value: unknown }).value;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return null;
}

function columnName(col: unknown): string | undefined {
  if (col && typeof col === "object" && "name" in (col as object)) {
    return (col as { name: string }).name;
  }
  return undefined;
}

/** Evaluates a real drizzle eq()/and()/gt() condition tree against a plain
 * row keyed by column name, so the fake db exercises the SAME statement
 * shape the repo issues (including refundScopedLimit's `and(eq, gt)`). */
function matches(cond: unknown, row: Row): boolean {
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
  const column = columnName(chunks[1]);
  const operator = chunkLiteral(chunks[2]) ?? " = ";
  const rawValue = chunks[3];
  const value = rawValue && typeof rawValue === "object" && "value" in (rawValue as object) ? (rawValue as { value: unknown }).value : rawValue;
  const actual = column ? row[column] : undefined;
  if (operator === " > ") return (actual as number) > (value as number);
  if (operator === " <= ") return (actual as number) <= (value as number);
  return actual === value;
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

const EMAIL = "atomicity-user@example.test";
const PASSWORD = "correct-password-123";

async function buildApp() {
  const passwordHash = await hashPassword(PASSWORD);
  const users: Row[] = [{ id: "u_1", orgId: "org_1", email: EMAIL, passwordHash, role: "organizer", contactId: null }];
  const rateLimits: Row[] = [];

  const db = {
    select() {
      return {
        from(table: unknown) {
          return {
            where(cond: unknown) {
              const rows = table === schema.user ? users : table === schema.rateLimit ? rateLimits : [];
              return { limit: (n: number) => Promise.resolve(rows.filter((r) => matches(cond, r)).slice(0, n)) };
            },
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
          if (table === schema.rateLimit) {
            const existing = rateLimits.find((r) => r.key === row.key);
            const upsert = () => {
              if (existing) existing.count = (existing.count as number) + 1;
              else rateLimits.push({ ...row });
              return (existing ? existing.count : (rateLimits.find((r) => r.key === row.key) as Row).count) as number;
            };
            return {
              onConflictDoUpdate: () => ({
                returning: async () => [{ count: upsert() }],
              }),
            };
          }
          return Promise.resolve();
        },
      };
    },
    update(table: unknown) {
      return {
        set(_patch: unknown) {
          return {
            where(cond: unknown) {
              if (table === schema.rateLimit) {
                for (const r of rateLimits) {
                  if (matches(cond, r)) (r.count as number), (r.count = (r.count as number) - 1);
                }
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
            const remaining = rateLimits.filter((r) => !matches(cond, r));
            rateLimits.length = 0;
            rateLimits.push(...remaining);
          }
          return Promise.resolve();
        },
      };
    },
  } as unknown as AppEnv["Variables"]["db"];

  const kv = new InMemoryKV();
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env, rateLimits };
}

function bucketCount(rateLimits: Row[], scope: string, id: string): number {
  // windowStart is 0 for `now = loginNow` computed inside the handler at a
  // real wall-clock time, so match by scope/id substring instead of
  // recomputing the exact windowStart.
  const row = rateLimits.find((r) => typeof r.key === "string" && (r.key as string).startsWith(`ratelimit:${scope}:${id}:`));
  return (row?.count as number | undefined) ?? 0;
}

async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
  const res = await app.request("/login", {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function postLogin(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, fields: { email: string; password: string }) {
  const { csrf, cookie } = await getCsrf(app, env);
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email: fields.email, password: fields.password });
  return app.request(
    "/login",
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
    env,
  );
}

describe("POST /login: consume-then-refund leaves the expected bucket counts", () => {
  it("(b) a successful login leaves both buckets at their pre-request counts (reset/refunded back to zero)", async () => {
    const { app, env, rateLimits } = await buildApp();
    const res = await postLogin(app, env, { email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(302);
    expect(bucketCount(rateLimits, "login-user", loginIdentityKey(EMAIL, "unknown"))).toBe(0);
    expect(bucketCount(rateLimits, "login-ip", "unknown")).toBe(0);
  });

  it("(c) a failed login costs exactly one from each bucket", async () => {
    const { app, env, rateLimits } = await buildApp();
    const res = await postLogin(app, env, { email: EMAIL, password: "wrong" });
    expect(res.status).toBe(401);
    expect(bucketCount(rateLimits, "login-user", loginIdentityKey(EMAIL, "unknown"))).toBe(1);
    expect(bucketCount(rateLimits, "login-ip", "unknown")).toBe(1);
  });

  it("(d) an ip-denied login leaves the user bucket unchanged (refunded back to its pre-request count)", async () => {
    const { app, env, rateLimits } = await buildApp();
    // Exhaust the IP bucket (max 100) with attempts against OTHER emails so
    // only the shared IP bucket is anywhere near its cap, then make one more
    // request for EMAIL: the user bucket should admit (count 1) and then be
    // refunded back to 0 once the IP check denies it.
    for (let i = 0; i < 100; i++) {
      await postLogin(app, env, { email: `other-${i}@example.test`, password: "wrong" });
    }
    expect(bucketCount(rateLimits, "login-ip", "unknown")).toBe(100);

    const res = await postLogin(app, env, { email: EMAIL, password: "wrong" });
    expect(res.status).toBe(429);
    expect(bucketCount(rateLimits, "login-user", loginIdentityKey(EMAIL, "unknown"))).toBe(0);
  });
});

// ---------------------------------------------------------------------
// (e) POST /forgot costs one whether or not the email exists.
// ---------------------------------------------------------------------

describe("POST /forgot: atomic spend regardless of account existence", () => {
  async function buildForgotApp() {
    const passwordHash = await hashPassword(PASSWORD);
    const users: Row[] = [{ id: "u_1", orgId: "org_1", email: EMAIL, passwordHash, role: "organizer", contactId: null }];
    const rateLimits: Row[] = [];
    const events: Row[] = [];

    const db = {
      select() {
        return {
          from(table: unknown) {
            const rows = table === schema.user ? users : table === schema.rateLimit ? rateLimits : table === schema.event ? events : [];
            return {
              where(cond: unknown) {
                const filtered = rows.filter((r) => matches(cond, r));
                return {
                  limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                  orderBy: () => ({
                    limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                    then: (resolve: (v: Row[]) => void) => resolve(filtered),
                  }),
                };
              },
              orderBy: () => ({
                limit: (n: number) => Promise.resolve(rows.slice(0, n)),
                then: (resolve: (v: Row[]) => void) => resolve(rows),
              }),
            };
          },
        };
      },
      insert(table: unknown) {
        return {
          values(row: Row) {
            if (table === schema.rateLimit) {
              const existing = rateLimits.find((r) => r.key === row.key);
              const upsert = () => {
                if (existing) existing.count = (existing.count as number) + 1;
                else rateLimits.push({ ...row });
                return (existing ? existing.count : (rateLimits.find((r) => r.key === row.key) as Row).count) as number;
              };
              return { onConflictDoUpdate: () => ({ returning: async () => [{ count: upsert() }] }) };
            }
            return Promise.resolve();
          },
        };
      },
      update() {
        return { set: () => ({ where: () => Promise.resolve() }) };
      },
      delete() {
        return { where: () => Promise.resolve() };
      },
    } as unknown as AppEnv["Variables"]["db"];

    const kv = new InMemoryKV();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: "http://127.0.0.1:8787" };
    return { app, env, rateLimits };
  }

  async function getForgotCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
    const res = await app.request("/forgot", {}, env);
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /forgot`);
    return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
  }

  async function postForgot(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, email: string) {
    const { csrf, cookie } = await getForgotCsrf(app, env);
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email });
    return app.request(
      "/forgot",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
      env,
    );
  }

  it("costs one unit whether the email belongs to an account or not, and never refunds it", async () => {
    const known = await buildForgotApp();
    const knownRes = await postForgot(known.app, known.env, EMAIL);
    expect(knownRes.status).toBe(200);
    expect(bucketCount(known.rateLimits, "forgot", EMAIL)).toBe(1);

    const unknown = await buildForgotApp();
    const UNKNOWN_EMAIL = "nobody@example.test";
    const unknownRes = await postForgot(unknown.app, unknown.env, UNKNOWN_EMAIL);
    expect(unknownRes.status).toBe(200);
    expect(bucketCount(unknown.rateLimits, "forgot", UNKNOWN_EMAIL)).toBe(1);
  });
});

// ---------------------------------------------------------------------
// (f) source scan: the deleted peekScopedLimit export left no call site.
// ---------------------------------------------------------------------

describe("source scan: no route references the deleted peek/increment shims", () => {
  it("no file under src/routes/ contains the token peekScopedLimit or incrementScopedLimit", () => {
    const routesDir = path.join(__dirname, "..", "src", "routes");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const contents = readFileSync(full, "utf8");
          if (/\bpeekScopedLimit\b/.test(contents) || /\bincrementScopedLimit\b/.test(contents)) {
            offenders.push(full);
          }
        }
      }
    }
    walk(routesDir);
    expect(offenders).toEqual([]);
  });

  it("src/server/repo/rate-limit.ts no longer exports peekScopedLimit or incrementScopedLimit", () => {
    const repoSource = readFileSync(path.join(__dirname, "..", "src", "server", "repo", "rate-limit.ts"), "utf8");
    expect(repoSource).not.toMatch(/export\s+async\s+function\s+peekScopedLimit/);
    expect(repoSource).not.toMatch(/export\s+async\s+function\s+incrementScopedLimit/);
    expect(repoSource).toMatch(/export\s+async\s+function\s+refundScopedLimit/);
  });
});
