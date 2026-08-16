import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  createClaimToken,
  readClaimToken,
  consumeClaimToken,
  hashClaimToken,
  claimKvKey,
  claimIndexKey,
  SUPERSEDED_GRACE_SECONDS,
} from "../src/auth/claim";
import type { KVStore } from "../src/auth/claim";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  readonly putOpts = new Map<string, { expirationTtl?: number }>();
  readonly putCalls: Array<{ key: string; opts?: { expirationTtl?: number } }> = [];

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    if (opts) this.putOpts.set(key, opts);
    this.putCalls.push({ key, opts });
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

// DEC-949 (wave 18 amendment): a grant is SINGLE-ACTIVE per (contactId,
// eventId) — the newest mint's hash becomes canonical in the index — but a
// mint SUPERSEDES rather than instantly revokes: the prior grant's record
// keeps working for a bounded SUPERSEDED_GRACE_SECONDS (48h) overlap.
describe("single-active claim grant with a superseded-grace overlap (DEC-949)", () => {
  it("minting a second grant for the same (contactId, eventId) moves the index to the new hash, but the first token stays readable with a re-put SUPERSEDED_GRACE_SECONDS TTL, while the second works", async () => {
    const kv = new InMemoryKV();
    const first = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const firstHash = await hashClaimToken(first);
    const second = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });

    expect(second).not.toBe(first);

    // Index now points at the newer grant.
    await expect(kv.get(claimIndexKey("c1", "e1"))).resolves.toBe(await hashClaimToken(second));

    // The first token's record was re-put (not deleted) with the grace TTL.
    await expect(readClaimToken(kv, first)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
    expect(kv.putOpts.get(claimKvKey(firstHash))?.expirationTtl).toBe(SUPERSEDED_GRACE_SECONDS);

    await expect(readClaimToken(kv, second)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("consuming the superseded token during the grace window still leaves the newer grant's index untouched", async () => {
    const kv = new InMemoryKV();
    const first = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const second = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const secondHash = await hashClaimToken(second);

    // consumeClaimToken only deletes the index when it still points at the
    // hash being consumed (src/auth/claim.ts) — since the index now points
    // at `second`, consuming the superseded `first` must leave it alone.
    await expect(consumeClaimToken(kv, first)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
    await expect(kv.get(claimIndexKey("c1", "e1"))).resolves.toBe(secondHash);
    await expect(readClaimToken(kv, second)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("minting a grant when the index points at an already-gone prior record (consumed/expired) does not throw and performs no re-put", async () => {
    const kv = new InMemoryKV();
    const first = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const firstHash = await hashClaimToken(first);
    // Simulate the record having already expired/been consumed out from
    // under the index (leave the index dangling, pointing at a dead hash).
    await kv.delete(claimKvKey(firstHash));

    const putCallsBefore = kv.putCalls.length;
    const second = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });

    // No re-put happened for the already-gone prior key: exactly two puts
    // occurred (new record + moved index), neither targeting firstHash's key.
    const newPuts = kv.putCalls.slice(putCallsBefore);
    expect(newPuts).toHaveLength(2);
    expect(newPuts.some((p) => p.key === claimKvKey(firstHash))).toBe(false);
    await expect(readClaimToken(kv, second)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("a grant for a different event is untouched", async () => {
    const kv = new InMemoryKV();
    const forEventA = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await createClaimToken(kv, { contactId: "c1", eventId: "e2" });

    await expect(readClaimToken(kv, forEventA)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("a grant for a different contact is untouched", async () => {
    const kv = new InMemoryKV();
    const forC1 = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await createClaimToken(kv, { contactId: "c2", eventId: "e1" });

    await expect(readClaimToken(kv, forC1)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("consuming deletes both the record key and the index key", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const hash = await hashClaimToken(token);

    expect(kv.has(claimKvKey(hash))).toBe(true);
    expect(kv.has(claimIndexKey("c1", "e1"))).toBe(true);

    await consumeClaimToken(kv, token);

    expect(kv.has(claimKvKey(hash))).toBe(false);
    expect(kv.has(claimIndexKey("c1", "e1"))).toBe(false);
  });

});

// DEC-949 (wave 34 amendment): redaction of claim/reset URLs moved to
// src/auth/credential-urls.ts (redactCredentialUrls) — see
// test/credential-url-redaction.scan.test.ts and
// test/comms-email-log-detail.test.ts for coverage.

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
    const state = { contacts: [...opts.contacts], users: [...opts.users], sessions: [] as unknown[] };
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
              // DEC-994: POST /claim/:token now mints its session through
              // issueSession, which deletes+inserts schema.authSession.
              if (table === schema.authSession) state.sessions.push(row);
              return Promise.resolve();
            },
          };
        },
        delete(table: unknown) {
          return {
            where() {
              if (table === schema.rateLimit) return Promise.resolve();
              // DEC-994: issueSession always deletes existing sessions for
              // the user before inserting — a brand-new claimed user has
              // none, so this is a no-op here.
              if (table === schema.authSession) return Promise.resolve();
              throw new Error("unexpected table in fake db delete");
            },
          };
        },
        // DEC-949 (wave 46 amendment): POST /claim/:token now issues
        // refundScopedLimit (db.update) once the token resolves, giving
        // back the unit spent by checkAndIncrementScopedLimit above.
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

// DEC-064 (wave-66 amendment): the write phase reorder — insert first,
// consume the KV grant only after a successful insert. A unique-constraint
// failure on the insert must not burn the token, and a `false` consume
// after a winning insert must not be fatal.
describe("POST /claim/:token write-phase reorder (route-level, DEC-064 wave-66 amendment)", () => {
  const CONTACT_ID = "ct_2";
  const ORG_ID = "org_2";
  const CONTACT_EMAIL = "amendment-speaker@example.test";

  class UniqueViolation extends Error {
    constructor() {
      super("UNIQUE constraint failed: user.email");
    }
  }

  /** Fake drizzle-style db whose schema.user insert enforces email
   * uniqueness SYNCHRONOUSLY at `.values()` call time (mirroring the
   * atomic-upsert fakes in test/auth-rate-limit-atomicity.test.ts), so two
   * concurrent claim requests racing through the same await-laden pipeline
   * land on a real, deterministic winner/loser split instead of both
   * silently succeeding. `insertBehavior` lets a test script a transient
   * failure on the Nth insert call. */
  function makeFakeDb(opts: { contact: { id: string; orgId: string; email: string }; insertBehavior?: (attempt: number) => "ok" | "transient" }) {
    const state = { users: [] as Array<{ id: string; email: string; contactId: string | null }>, sessions: [] as unknown[] };
    const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
    let insertAttempt = 0;
    return {
      db: {
        select() {
          return {
            from(table: unknown) {
              return {
                where(cond: unknown) {
                  return {
                    limit() {
                      if (table === schema.contact) return Promise.resolve([opts.contact]);
                      if (table === schema.user) {
                        // findAccountUserId's or(contactId eq, lower(email) eq) —
                        // real filtering so the concurrency test's loser sees the
                        // winner's freshly-inserted row once it lands.
                        void cond;
                        const match = state.users.find(
                          (u) => u.contactId === opts.contact.id || u.email.toLowerCase() === opts.contact.email.toLowerCase(),
                        );
                        return Promise.resolve(match ? [{ id: match.id }] : []);
                      }
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
              if (table === schema.user) {
                insertAttempt += 1;
                const behavior = opts.insertBehavior ? opts.insertBehavior(insertAttempt) : "ok";
                if (behavior === "transient") {
                  return Promise.reject(new Error("D1 transient: connection reset"));
                }
                const vals = row as { id: string; email: string; contactId: string | null };
                const collision = state.users.find((u) => u.email.toLowerCase() === vals.email.toLowerCase());
                if (collision) {
                  return Promise.reject(new UniqueViolation());
                }
                // Synchronous commit at call time, matching the atomic-upsert
                // fakes' documented "single-snapshot" shape.
                state.users.push(vals);
                return Promise.resolve();
              }
              if (table === schema.authSession) {
                state.sessions.push(row);
                return Promise.resolve();
              }
              throw new Error("unexpected table in fake db insert");
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

  it("a transient insert failure leaves the token readable, and a retry with the same link succeeds", async () => {
    const contact = { id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL };
    const { db } = makeFakeDb({ contact, insertBehavior: (attempt) => (attempt === 1 ? "transient" : "ok") });
    const kv = new InMemoryKV();
    const { app, env } = buildApp(db, kv);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const failedRes = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });
    expect(failedRes.status).toBe(500);

    // The token was never consumed by the failed attempt (insert ran before
    // the KV consume, and threw before reaching it).
    await expect(readClaimToken(kv, token)).resolves.toEqual({
      contactId: CONTACT_ID,
      eventId: "ev_1",
    });

    const { csrf: csrf2, cookie: cookie2 } = await getCsrf(app, env, `/claim/${token}`);
    const retryRes = await postClaimForm(app, env, token, cookie2, {
      [CSRF_COOKIE_NAME]: csrf2,
      password: "a-valid-password",
    });
    expect(retryRes.status).toBe(302);
    expect(retryRes.headers.get("location")).toBe("/portal");
    await expect(readClaimToken(kv, token)).resolves.toBeNull();
  });

  it("two concurrent claims on one token produce exactly one user and one /login redirect", async () => {
    const contact = { id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL };
    const { db, state } = makeFakeDb({ contact });
    const kv = new InMemoryKV();
    const { app, env } = buildApp(db, kv);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const [first, second] = await Promise.all([getCsrf(app, env, `/claim/${token}`), getCsrf(app, env, `/claim/${token}`)]);

    const [resA, resB] = await Promise.all([
      postClaimForm(app, env, token, first.cookie, { [CSRF_COOKIE_NAME]: first.csrf, password: "a-valid-password" }),
      postClaimForm(app, env, token, second.cookie, { [CSRF_COOKIE_NAME]: second.csrf, password: "a-valid-password" }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one request creates the account (302 -> /portal); the other
    // loses the unique-email race on the insert and is answered with the
    // same /login redirect DEC-014's pre-check returns.
    expect(statuses).toEqual([302, 302]);
    const locations = [resA.headers.get("location"), resB.headers.get("location")].sort();
    expect(locations).toEqual(["/login", "/portal"]);
    expect(state.users).toHaveLength(1);
  });

  it("the happy path ends in a session cookie plus the /portal redirect", async () => {
    const contact = { id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL };
    const { db, state } = makeFakeDb({ contact });
    const kv = new InMemoryKV();
    const { app, env } = buildApp(db, kv);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const res = await postClaimForm(app, env, token, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      password: "a-valid-password",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");
    expect(res.headers.get("set-cookie")).toContain("chq_session=");
    expect(state.users).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    await expect(readClaimToken(kv, token)).resolves.toBeNull();
  });
});
