import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "../src/auth/password";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

// DEC-004 (wave 58 amendment): a login attempt for an unknown email must pay
// the SAME PBKDF2 cost as a known one -- no branch may short-circuit before
// the KDF, or wall-clock timing becomes an account-enumeration oracle.

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

// DEC-948-style: extract the RHS value out of a real drizzle eq(col, value)
// condition tree (unwrapping the Param wrapper) so the rate_limit fake below
// can key its store by the same value peekScopedLimit/incrementScopedLimit
// actually filter on.
function extractEqValue(cond: unknown): unknown {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  const raw = chunks[3];
  return raw && typeof raw === "object" && "value" in (raw as object) ? (raw as { value: unknown }).value : raw;
}

const EMAIL = "known-user@example.test";
const PASSWORD = "correct-password-123";

function normalizeBody(html: string, email: string): string {
  return html.replace(email, "EMAIL_PLACEHOLDER").replace(/name="chq_csrf" value="[^"]*"/, 'name="chq_csrf" value="CSRF_PLACEHOLDER"');
}

async function buildApp() {
  const passwordHash = await hashPassword(PASSWORD);
  const users = [
    {
      id: "u_1",
      orgId: "org_1",
      email: EMAIL,
      passwordHash,
      role: "organizer",
      contactId: null,
    },
  ];
  const rateLimits = new Map<string, { count: number; expiresAt: number }>();
  const db = {
    select() {
      return {
        from(table: unknown) {
          let whereCond: unknown;
          const chain: any = {
            where(cond: unknown) {
              whereCond = cond;
              return chain;
            },
            orderBy: () => chain,
            limit() {
              if (table === schema.user) {
                const key = extractEqValue(whereCond);
                return Promise.resolve(users.filter((u) => u.email === key));
              }
              if (table === schema.org) return Promise.resolve([]);
              if (table === schema.rateLimit) {
                const key = extractEqValue(whereCond);
                const row = rateLimits.get(key as string);
                return Promise.resolve(row ? [{ count: row.count }] : []);
              }
              throw new Error("unexpected table in fake db select");
            },
          };
          return chain;
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: any) {
          if (table === schema.authSession) {
            return Promise.resolve();
          }
          if (table === schema.rateLimit) {
            const existing = rateLimits.get(row.key);
            return {
              onConflictDoUpdate: () => ({
                returning: async () => {
                  if (existing) {
                    existing.count += 1;
                    return [{ count: existing.count }];
                  }
                  rateLimits.set(row.key, { count: row.count, expiresAt: row.expiresAt });
                  return [{ count: row.count }];
                },
                then: (resolve: (v: undefined) => void) => {
                  if (existing) existing.count += 1;
                  else rateLimits.set(row.key, { count: row.count, expiresAt: row.expiresAt });
                  resolve(undefined);
                },
              }),
            };
          }
          return Promise.resolve();
        },
      };
    },
    delete(table: unknown) {
      return {
        where(cond: unknown) {
          if (table === schema.rateLimit) {
            const key = extractEqValue(cond);
            rateLimits.delete(key as string);
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
  return { app, env };
}

async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
  const res = await app.request("/login", {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function postLogin(
  app: Hono<AppEnv>,
  env: { KV: AppEnv["Bindings"]["KV"] },
  fields: { email: string; password: string },
) {
  const { csrf, cookie } = await getCsrf(app, env);
  const form = new URLSearchParams({
    [CSRF_COOKIE_NAME]: csrf,
    email: fields.email,
    password: fields.password,
  });
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

describe("login timing oracle closed (DEC-004 wave 58 amendment)", () => {
  let deriveBitsSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deriveBitsSpy = vi.spyOn(crypto.subtle as unknown as Record<string, (...args: unknown[]) => unknown>, "deriveBits") as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    deriveBitsSpy.mockRestore();
  });

  it("runs the same number of KDF derivations for a known email as an unknown one, both wrong-password, both 401, identical bodies", async () => {
    const { app, env } = await buildApp();

    deriveBitsSpy.mockClear();
    const known = await postLogin(app, env, { email: EMAIL, password: "wrong-password" });
    expect(known.status).toBe(401);
    const knownCallCount = deriveBitsSpy.mock.calls.length;
    const knownBody = normalizeBody(await known.text(), EMAIL);

    deriveBitsSpy.mockClear();
    const unknown = await postLogin(app, env, { email: "nobody@example.test", password: "wrong-password" });
    expect(unknown.status).toBe(401);
    const unknownCallCount = deriveBitsSpy.mock.calls.length;
    const unknownBody = normalizeBody(await unknown.text(), "nobody@example.test");

    expect(knownCallCount).toBeGreaterThan(0);
    expect(unknownCallCount).toBe(knownCallCount);
    expect(unknownBody).toBe(knownBody);
  });
});

describe("DUMMY_PASSWORD_HASH (DEC-004 wave 58 amendment)", () => {
  it("resolves false against any password, never throws", async () => {
    await expect(verifyPassword("anything", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword("", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword("correct-password-123", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
