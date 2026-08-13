import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  createClaimToken,
  readClaimToken,
  consumeClaimToken,
  hashClaimToken,
  claimKvKey,
} from "../src/auth/claim";
import type { KVStore } from "../src/auth/claim";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import * as schema from "../src/db/schema";
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

describe("claim token flow", () => {
  it("creates a token that reads back the stored record", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await expect(readClaimToken(kv, token)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("stores under claim:<sha256(token)>, never the raw token", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const hash = await hashClaimToken(token);
    expect(kv.has(claimKvKey(hash))).toBe(true);
    expect(kv.has(`claim:${token}`)).toBe(false);
  });

  it("readClaimToken does not consume the record", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await readClaimToken(kv, token);
    await expect(readClaimToken(kv, token)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("consumeClaimToken deletes the record after reading it", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await expect(consumeClaimToken(kv, token)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
    await expect(readClaimToken(kv, token)).resolves.toBeNull();
    await expect(consumeClaimToken(kv, token)).resolves.toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const kv = new InMemoryKV();
    await expect(readClaimToken(kv, "nonexistent")).resolves.toBeNull();
    await expect(consumeClaimToken(kv, "nonexistent")).resolves.toBeNull();
  });

  it("issues distinct tokens across calls", async () => {
    const kv = new InMemoryKV();
    const a = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const b = await createClaimToken(kv, { contactId: "c2", eventId: "e1" });
    expect(a).not.toBe(b);
  });
});

// DEC-064 regression: POST /claim/:token must not burn the one-time link on
// a validation failure (short password, duplicate-user redirect) — it may
// only be consumed immediately before the user insert on a real claim.
describe("POST /claim/:token (route-level, DEC-064)", () => {
  const CONTACT_ID = "ct_1";
  const ORG_ID = "org_1";
  const CONTACT_EMAIL = "speaker@example.test";

  /** Minimal fake drizzle-style db: dispatches select/insert by table
   * reference identity (fine here since fixtures never hold >1 row). */
  function makeFakeDb(opts: { contacts: unknown[]; users: unknown[] }) {
    const state = { contacts: [...opts.contacts], users: [...opts.users] };
    const inserted: Array<{ table: unknown; row: unknown }> = [];
    // DEC-948: checkAndIncrementScopedLimit's atomic D1 upsert, keyed by its
    // own `rate_limit` row (not schema.contact/schema.user), so it's
    // dispatched separately from the contact/user state above.
    const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
    return {
      db: {
        select() {
          return {
            from(table: unknown) {
              return {
                where() {
                  return {
                    limit() {
                      if (table === schema.contact) return Promise.resolve(state.contacts);
                      if (table === schema.user) return Promise.resolve(state.users);
                      if (table === schema.rateLimit) return Promise.resolve([]);
                      throw new Error("unexpected table in fake db select");
                    },
                  };
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
              inserted.push({ table, row });
              if (table === schema.user) state.users.push(row);
              return Promise.resolve();
            },
          };
        },
        delete(table: unknown) {
          return {
            where() {
              if (table === schema.rateLimit) return Promise.resolve();
              throw new Error("unexpected table in fake db delete");
            },
          };
        },
      } as unknown as AppEnv["Variables"]["db"],
      inserted,
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

  it("a too-short password is rejected without consuming the token; the link stays claimable", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
    });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const shortRes = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "abc",
    });
    expect(shortRes.status).toBeGreaterThanOrEqual(400);
    expect(shortRes.status).toBeLessThan(500);

    // Link is still claimable: GET still 200, and a valid follow-up POST succeeds.
    const followUpGet = await app.request(`/claim/${token}`, {}, env);
    expect(followUpGet.status).toBe(200);

    const { csrf: csrf2, cookie: cookie2 } = await getCsrf(app, env, `/claim/${token}`);
    const validRes = await postClaimForm(app, env, token, cookie2, {
      [CSRF_COOKIE_NAME]: csrf2,
      password: "a-valid-password",
    });
    expect(validRes.status).toBe(302);
    expect(validRes.headers.get("location")).toBe("/portal");
  });

  it("a second POST with the same (now-consumed) token 404s", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
    });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const firstRes = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });
    expect(firstRes.status).toBe(302);

    // The link is already dead: a second POST (reusing the still-valid CSRF
    // cookie from before the claim) must 404, not silently re-consume.
    const secondRes = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });
    expect([404, 410]).toContain(secondRes.status);
  });

  it("the DEC-014 duplicate-user redirect leaves the token unconsumed", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [{ id: "u_existing", email: CONTACT_EMAIL, role: "speaker" }],
    });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const res = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");

    // Token was never consumed: still readable directly against the KV store.
    await expect(readClaimToken(kv, token)).resolves.toEqual({
      contactId: CONTACT_ID,
      eventId: "ev_1",
    });
  });
});
