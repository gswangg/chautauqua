import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  createClaimToken,
  readClaimToken,
  consumeClaimToken,
  hashClaimToken,
  claimKvKey,
  claimIndexKey,
  redactClaimUrls,
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

// DEC-949: the organizer-facing disclosure REDACTS every /claim/<token> URL.
describe("redactClaimUrls (DEC-949)", () => {
  it("leaves non-claim text byte-identical", () => {
    const text = "Hi Ada, welcome to DevCon! See you at /agenda and /portal.";
    expect(redactClaimUrls(text)).toBe(text);
  });

  it("kills a real token", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const text = `Set your password: https://example.com/claim/${token}`;
    const redacted = redactClaimUrls(text);
    expect(redacted).not.toContain(token);
    expect(redacted).toBe("Set your password: https://example.com/claim/<redacted>");
  });

  it("redacts multiple occurrences", () => {
    const text = "Link one: /claim/abcdefghijklmnopqrstuvwxyz and again /claim/ABCDEFGHIJKLMNOP12345";
    expect(redactClaimUrls(text)).toBe("Link one: /claim/<redacted> and again /claim/<redacted>");
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
