import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createClaimToken, type KVStore } from "../src/auth/claim";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import { AUTH_RATE_LIMIT_MAX } from "../src/routes/auth-helpers";

// DEC-949 (wave 46 amendment): the per-IP `claim` bucket is a FAILURE
// budget, not an admission gate. Under local wrangler dev every client
// resolves to the literal string "unknown" (src/lib/rate-limit.ts's
// requestIpFromHeaders fallback), so an admission-gate shape shares ONE
// counter across every speaker on the box. These tests never set
// cf-connecting-ip/x-forwarded-for, so every request lands in that same
// "unknown" bucket -- exactly the scenario the fix defends.

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

const CONTACT_ID = "ct_1";
const ORG_ID = "org_1";
const CONTACT_EMAIL = "speaker@example.test";

/** Minimal fake drizzle-style db, mirroring test/claim.test.ts's makeFakeDb
 * but adding an `update` handler for schema.rateLimit (refundScopedLimit)
 * since the failure-budget shape now issues a refund on token resolution. */
function makeFakeDb(opts: { contacts: unknown[]; users: unknown[]; initialRateLimitCount?: number }) {
  const state = { contacts: [...opts.contacts], users: [...opts.users] };
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
          values(row: unknown) {
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
                    // First increment ever seen for this key: simulate a
                    // bucket that already held `initialRateLimitCount`
                    // units from prior (unrelated) requests, then apply
                    // this call's own atomic +1 on top of it -- matching
                    // real checkAndIncrementScopedLimit semantics where
                    // the returned count always reflects THIS call's
                    // increment.
                    const seeded = (opts.initialRateLimitCount ?? 0) + 1;
                    rateLimitRows.set(vals.key, { count: seeded, expiresAt: vals.expiresAt });
                    return [{ count: seeded }];
                  },
                }),
              };
            }
            if (table === schema.user) state.users.push(row);
            return Promise.resolve();
          },
        };
      },
      update(table: unknown) {
        return {
          set(patch: unknown) {
            return {
              where() {
                if (table !== schema.rateLimit) throw new Error("unexpected table in fake db update");
                // refundScopedLimit issues `count = count - 1 where count > 0`
                // against every row -- fine here since exactly one key is
                // ever live per test.
                void patch;
                for (const row of rateLimitRows.values()) {
                  if (row.count > 0) row.count -= 1;
                }
                return Promise.resolve();
              },
            };
          },
        };
      },
      delete(table: unknown) {
        return {
          where() {
            if (table === schema.rateLimit) return Promise.resolve();
            if (table === schema.authSession) return Promise.resolve();
            throw new Error("unexpected table in fake db delete");
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"],
    rateLimitCount: () => [...rateLimitRows.values()][0]?.count ?? 0,
  };
}

function buildApp(db: AppEnv["Variables"]["db"]) {
  const kv = new InMemoryKV();
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
  return { app, kv, env };
}

async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, path: string) {
  const res = await app.request(path, {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

function postClaimForm(
  app: Hono<AppEnv>,
  env: { KV: AppEnv["Bindings"]["KV"] },
  token: string,
  cookie: string,
  fields: Record<string, string>,
) {
  const form = new URLSearchParams(fields);
  return app.request(
    `/claim/${token}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: form.toString(),
    },
    env,
  );
}

describe("POST /claim/:token per-IP bucket is a FAILURE budget (DEC-949 wave 46)", () => {
  it("(a) a VALID token succeeds even though the shared 'unknown' IP bucket is already at max", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
      initialRateLimitCount: AUTH_RATE_LIMIT_MAX,
    });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const res = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");
  });

  it("(b) an UNKNOWN token 429s once the bucket is at max", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
      initialRateLimitCount: AUTH_RATE_LIMIT_MAX,
    });
    const { app, kv, env } = buildApp(db);
    // ExpiredClaimPage (unknown-token GET) never sets a CSRF cookie, so mint
    // one via a real token's GET first -- the CSRF cookie itself is not
    // bound to any particular claim token.
    const realToken = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });
    const { csrf, cookie } = await getCsrf(app, env, `/claim/${realToken}`);
    const res = await postClaimForm(app, env, "bogus-token", cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });

    expect(res.status).toBe(429);
  });

  it("(c) below max, an UNKNOWN token keeps today's not-found behavior AND increments the counter", async () => {
    const { db, rateLimitCount } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
      initialRateLimitCount: 0,
    });
    const { app, kv, env } = buildApp(db);
    const realToken = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });
    const { csrf, cookie } = await getCsrf(app, env, `/claim/${realToken}`);
    const before = rateLimitCount();
    const res = await postClaimForm(app, env, "bogus-token", cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });

    expect(res.status).toBe(404);
    expect(rateLimitCount()).toBe(before + 1);
  });

  it("(d) a VALID token does NOT net-increment the counter (spent then refunded)", async () => {
    const { db, rateLimitCount } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
      initialRateLimitCount: 0,
    });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const before = rateLimitCount();
    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const res = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });

    expect(res.status).toBe(302);
    expect(rateLimitCount()).toBe(before);
  });
});
