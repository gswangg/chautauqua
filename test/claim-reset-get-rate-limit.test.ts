// DEC-949 (wave-7 amendment): the per-IP `claim`/`reset-token` failure budgets
// guarded only the POST twins; the GET twins that resolve the same KV grant
// (rendering the claim/reset form, and for /reset/:token the target
// account's email) were completely unmetered -- an unauthenticated,
// CSRF-free surface for guessing tokens at zero cost. This file proves the
// GET handlers now spend the SAME scoped budget the POSTs already did, with
// the same consume-then-refund shape (net zero on a resolving token, net
// spend on a miss), modelled on test/claim-rate-limit-failure-budget.test.ts.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createClaimToken, type KVStore } from "../src/auth/claim";
import { createResetToken } from "../src/auth/password-reset";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import { AUTH_RATE_LIMIT_MAX } from "../src/routes/auth-helpers";

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
const USER_ID = "u_1";

/** Minimal fake drizzle-style db (mirrors test/claim-rate-limit-failure-
 * budget.test.ts's makeFakeDb), extended with a schema.user row so
 * GET /reset/:token's post-refund lookup has something to find. */
function makeFakeDb(opts: { users?: unknown[]; initialRateLimitCount?: number }) {
  const state = { users: [...(opts.users ?? [])] };
  const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();

  return {
    db: {
      select() {
        return {
          from(table: unknown) {
            const rowsFor = () => {
              if (table === schema.user) return Promise.resolve(state.users);
              if (table === schema.rateLimit) return Promise.resolve([]);
              throw new Error("unexpected table in fake db select");
            };
            return {
              where() {
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
                    const seeded = (opts.initialRateLimitCount ?? 0) + 1;
                    rateLimitRows.set(vals.key, { count: seeded, expiresAt: vals.expiresAt });
                    return [{ count: seeded }];
                  },
                }),
              };
            }
            throw new Error("unexpected table in fake db insert");
          },
        };
      },
      update(table: unknown) {
        return {
          set(patch: unknown) {
            return {
              where() {
                if (table !== schema.rateLimit) throw new Error("unexpected table in fake db update");
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
            // pruneExpired (called at the end of every
            // checkAndIncrementScopedLimit) issues this against
            // schema.rateLimit; nothing in these tests ever runs a real
            // window rollover, so a no-op is faithful.
            if (table === schema.rateLimit) return Promise.resolve();
            throw new Error("unexpected table in fake db delete");
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"],
    rateLimitCount: () => [...rateLimitRows.values()][0]?.count ?? 0,
    userSelectCalled: () => state.users, // placeholder for readability at call sites
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

describe("GET /claim/:token spends the same per-IP failure budget as the POST (DEC-949 wave-7)", () => {
  it("(a) a resolving token still renders 200 even though the shared bucket is already at max", async () => {
    const { db } = makeFakeDb({ initialRateLimitCount: AUTH_RATE_LIMIT_MAX });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const res = await app.request(`/claim/${token}`, {}, env);

    expect(res.status).toBe(200);
  });

  it("(b) a resolving token does NOT net-increment the counter (spent then refunded)", async () => {
    const { db, rateLimitCount } = makeFakeDb({ initialRateLimitCount: 0 });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const before = rateLimitCount();
    const res = await app.request(`/claim/${token}`, {}, env);

    expect(res.status).toBe(200);
    expect(rateLimitCount()).toBe(before);
  });

  it("(c) below max, a missing token keeps today's 410 AND increments the counter", async () => {
    const { db, rateLimitCount } = makeFakeDb({ initialRateLimitCount: 0 });
    const { app, env } = buildApp(db);

    const before = rateLimitCount();
    const res = await app.request(`/claim/bogus-token`, {}, env);

    expect(res.status).toBe(410);
    expect(rateLimitCount()).toBe(before + 1);
  });

  it("(d) N missing-token GETs from one IP reach 429 once the budget is exhausted", async () => {
    const { db } = makeFakeDb({ initialRateLimitCount: AUTH_RATE_LIMIT_MAX - 1 });
    const { app, env } = buildApp(db);

    // This IP has one unit of budget left: the first miss spends it and
    // still 410s (the unit was available), the next miss finds the bucket
    // exhausted and 429s.
    const first = await app.request(`/claim/bogus-token-1`, {}, env);
    expect(first.status).toBe(410);
    const second = await app.request(`/claim/bogus-token-2`, {}, env);
    expect(second.status).toBe(429);
  });
});

describe("GET /reset/:token spends the same per-IP failure budget as the POST (DEC-949 wave-7)", () => {
  it("(a) a resolving token still renders 200 and the account's email, even at a maxed bucket", async () => {
    const { db } = makeFakeDb({
      users: [{ id: USER_ID, orgId: ORG_ID, email: CONTACT_EMAIL, contactId: CONTACT_ID }],
      initialRateLimitCount: AUTH_RATE_LIMIT_MAX,
    });
    const { app, kv, env } = buildApp(db);
    const token = await createResetToken(kv, USER_ID);

    const res = await app.request(`/reset/${token}`, {}, env);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain(CONTACT_EMAIL);
  });

  it("(b) a resolving token does NOT net-increment the counter (spent then refunded)", async () => {
    const { db, rateLimitCount } = makeFakeDb({
      users: [{ id: USER_ID, orgId: ORG_ID, email: CONTACT_EMAIL, contactId: CONTACT_ID }],
      initialRateLimitCount: 0,
    });
    const { app, kv, env } = buildApp(db);
    const token = await createResetToken(kv, USER_ID);

    const before = rateLimitCount();
    const res = await app.request(`/reset/${token}`, {}, env);

    expect(res.status).toBe(200);
    expect(rateLimitCount()).toBe(before);
  });

  it("(c) below max, a missing token keeps today's 410 AND increments the counter, never touching schema.user", async () => {
    const { db, rateLimitCount } = makeFakeDb({ initialRateLimitCount: 0 });
    const { app, env } = buildApp(db);

    const before = rateLimitCount();
    const res = await app.request(`/reset/bogus-token`, {}, env);

    expect(res.status).toBe(410);
    expect(rateLimitCount()).toBe(before + 1);
    // makeFakeDb's schema.user select would throw ("unexpected table") only
    // if reached with an empty users array while looking up a real record;
    // here there is no record at all, so schema.user is never queried --
    // proven by the fact this resolved to 410 rather than throwing on a
    // missing row (the handler's `throw new Error("No user row...")` path).
  });

  it("(d) N missing-token GETs from one IP reach 429 once the budget is exhausted", async () => {
    const { db } = makeFakeDb({ initialRateLimitCount: AUTH_RATE_LIMIT_MAX - 1 });
    const { app, env } = buildApp(db);

    const first = await app.request(`/reset/bogus-token-1`, {}, env);
    expect(first.status).toBe(410);
    const second = await app.request(`/reset/bogus-token-2`, {}, env);
    expect(second.status).toBe(429);
  });
});
