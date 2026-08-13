// DEC-457: rate-limit keys must never carry unbounded external input. A
// caller-supplied id (email, x-forwarded-for) that's arbitrarily long could
// otherwise crash the limiter with a 5xx instead of degrading gracefully.
// boundRateLimitId caps the id portion of scopedRateLimitKey's output;
// these tests prove the bound holds both at the unit level and through
// real routes.
//
// DEC-948: the counter itself moved from KV to a D1 `rate_limit` row keyed
// by that same scopedRateLimitKey — the fake db below records every
// rate_limit upsert (mirroring the old kv.puts assertions) rather than a
// KVStore fake, since that's where an oversized key would now land.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  MAX_RATE_LIMIT_ID_BYTES,
  boundRateLimitId,
  scopedRateLimitKey,
} from "../src/lib/rate-limit";
import { authRoutes } from "../src/routes/auth";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { createClaimToken } from "../src/auth/claim";
import type { KVStore } from "../src/auth/claim";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";

const KV_MAX_KEY_BYTES = 512;

function utf8Len(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** DEC-948: minimal fake of src/server/repo/rate-limit.ts's atomic upsert
 * (insert ... on conflict do update ... returning count) plus the prune
 * delete, keyed by the row's own `key` column so a real over-length key
 * still round-trips (an in-memory Map that silently accepted an oversized
 * key would hide the bug DEC-457 fixes, same rationale as the deleted
 * ThrowingKV fake). `keys` records every key written, mirroring the old
 * kv.puts assertions below. */
function makeRateLimitFakeMethods() {
  const rows = new Map<string, { count: number; expiresAt: number }>();
  const keys: string[] = [];
  return {
    keys,
    insert: () => ({
      values: (vals: { key: string; count: number; expiresAt: number }) => {
        keys.push(vals.key);
        return {
          onConflictDoUpdate: () => ({
            returning: async () => {
              const existing = rows.get(vals.key);
              if (existing) {
                existing.count += 1;
                return [{ count: existing.count }];
              }
              rows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
              return [{ count: vals.count }];
            },
            then: (resolve: (v: undefined) => void) => {
              const existing = rows.get(vals.key);
              if (existing) existing.count += 1;
              else rows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
              resolve(undefined);
            },
          }),
        };
      },
    }),
    delete: () => ({ where: async () => {} }),
  };
}

describe("DEC-457: boundRateLimitId (unit)", () => {
  it("returns ids at or under the cap unchanged", () => {
    const id = "a".repeat(MAX_RATE_LIMIT_ID_BYTES);
    expect(boundRateLimitId(id)).toBe(id);
  });

  it("a 5,000-char id produces a bounded key <= 512 UTF-8 bytes", () => {
    const id = "z".repeat(5000);
    const key = scopedRateLimitKey("submit", id, 1_000_000);
    expect(utf8Len(key)).toBeLessThanOrEqual(KV_MAX_KEY_BYTES);
  });

  it("two distinct 5,000-char ids produce distinct keys", () => {
    const idA = "a".repeat(5000);
    const idB = `${"a".repeat(4999)}b`;
    const keyA = scopedRateLimitKey("submit", idA, 1_000_000);
    const keyB = scopedRateLimitKey("submit", idB, 1_000_000);
    expect(keyA).not.toBe(keyB);
  });

  it("a normal email produces byte-for-byte the same key as before the change", () => {
    const key = scopedRateLimitKey("login-user", "alice@example.com", 42);
    expect(key).toBe("ratelimit:login-user:alice@example.com:42");
  });

  it("bounds a 200-char string of 4-byte emoji", () => {
    const id = "\u{1F600}".repeat(200); // 200 chars, 4 bytes each = 800 bytes
    expect(utf8Len(id)).toBe(800);
    const key = scopedRateLimitKey("submit", id, 1_000_000);
    expect(utf8Len(key)).toBeLessThanOrEqual(KV_MAX_KEY_BYTES);
  });
});

/** Mirrors the real claim-token KV store's 512-UTF-8-byte key cap by
 * throwing — an in-memory Map that silently accepts oversized keys would
 * not catch a regression of DEC-457's bound. Still used for claim-token
 * storage (unrelated to the DEC-948 rate-limit counter, which now lives in
 * the fake db's rate_limit table via makeRateLimitFakeMethods). */
class ThrowingKV implements KVStore {
  private readonly store = new Map<string, string>();

  private assertKeyBounded(key: string) {
    if (utf8Len(key) > KV_MAX_KEY_BYTES) {
      throw new Error(`KV key exceeds ${KV_MAX_KEY_BYTES} UTF-8 bytes: ${key.length} chars`);
    }
  }

  async get(key: string): Promise<string | null> {
    this.assertKeyBounded(key);
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.assertKeyBounded(key);
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.assertKeyBounded(key);
    this.store.delete(key);
  }
}

describe("DEC-457: POST /login with an oversized email", () => {
  async function buildApp() {
    const rateLimitFake = makeRateLimitFakeMethods();
    const db = {
      select() {
        return {
          from(table: unknown) {
            // DEC-740: the login door also queries getHubOrg
            // (orderBy().limit(), no where()) -- schema.org always resolves
            // empty here so loadSingleEventContext short-circuits.
            const limitFrom = () => ({
              limit() {
                if (table === schema.user) return Promise.resolve([]);
                if (table === schema.org) return Promise.resolve([]);
                // DEC-948: peekScopedLimit's read-only select, always empty
                // here (this fake never pre-seeds a row).
                if (table === schema.rateLimit) return Promise.resolve([]);
                throw new Error("unexpected table in fake db select");
              },
            });
            return {
              where: limitFrom,
              orderBy: limitFrom,
            };
          },
        };
      },
      insert: rateLimitFake.insert,
      delete: rateLimitFake.delete,
    } as unknown as AppEnv["Variables"]["db"];

    const kv = new ThrowingKV();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
    return { app, kv, env, rateLimitKeys: rateLimitFake.keys };
  }

  it("returns 401 (not 5xx) and still increments the limiter", async () => {
    const { app, env, rateLimitKeys } = await buildApp();
    const getRes = await app.request("/login", {}, env);
    const setCookie = getRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error("no csrf cookie set on GET /login");
    const csrf = match[1]!;
    const cookie = `${CSRF_COOKIE_NAME}=${csrf}`;

    const oversizedEmail = `${"a".repeat(1000)}@example.com`;
    const form = new URLSearchParams({
      [CSRF_COOKIE_NAME]: csrf,
      email: oversizedEmail,
      password: "wrong",
    });
    const res = await app.request(
      "/login",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: form.toString(),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(rateLimitKeys.some((k) => k.startsWith("ratelimit:login-user:"))).toBe(true);
  });
});

describe("DEC-457: POST /claim/:token with an oversized x-forwarded-for", () => {
  it("is not 5xx", async () => {
    const kv = new ThrowingKV();
    const rateLimitFake = makeRateLimitFakeMethods();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", { insert: rateLimitFake.insert, delete: rateLimitFake.delete } as unknown as AppEnv["Variables"]["db"]);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };

    const token = await createClaimToken(kv, { contactId: "ct_1", eventId: "ev_1" });

    const getRes = await app.request(`/claim/${token}`, {}, env);
    const setCookie = getRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error("no csrf cookie set on GET /claim/:token");
    const csrf = match[1]!;
    const cookie = `${CSRF_COOKIE_NAME}=${csrf}`;

    const oversizedXff = "9".repeat(4000);
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, password: "short" });
    const res = await app.request(
      `/claim/${token}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
          "x-forwarded-for": oversizedXff,
        },
        body: form.toString(),
      },
      env,
    );

    expect(res.status).toBeLessThan(500);
    expect(rateLimitFake.keys.some((k) => k.startsWith("ratelimit:claim:"))).toBe(true);
  });
});

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: new Date(Date.UTC(2026, 11, 1)),
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  {
    id: "title",
    section: "session",
    kind: "text",
    label: "Title",
    helpText: null,
    required: true,
    position: 0,
    optionsJson: null,
    ruleJson: null,
  },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const rateLimitFake = makeRateLimitFakeMethods();
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: rateLimitFake.insert,
    delete: rateLimitFake.delete,
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], rateLimitKeys: rateLimitFake.keys };
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

function formRequest(fields: Record<string, string>, extraHeaders: Record<string, string> = {}) {
  const form = new URLSearchParams();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
      ...extraHeaders,
    },
    body: form.toString(),
  } as const;
}

describe("DEC-457: POST /submit/:eventSlug with an oversized x-forwarded-for", () => {
  it("is not 5xx and the submit limiter still counts", async () => {
    const { db, rateLimitKeys } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const kv = new ThrowingKV();
    const oversizedXff = "8".repeat(4000);

    const res = await app.request(
      "/submit/test-conf",
      formRequest({}, { "x-forwarded-for": oversizedXff }),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBeLessThan(500);
    expect(rateLimitKeys.some((k) => k.startsWith("ratelimit:submit:"))).toBe(true);
  });
});

describe("DEC-457: POST /submit/:eventSlug/save-draft with an oversized x-forwarded-for", () => {
  it("is not 5xx", async () => {
    const { db, rateLimitKeys } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const kv = new ThrowingKV();
    const oversizedXff = "7".repeat(4000);

    const res = await app.request(
      "/submit/test-conf/save-draft",
      formRequest({ field__title: "ok" }, { "x-forwarded-for": oversizedXff }),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBeLessThan(500);
    expect(rateLimitKeys.some((k) => k.startsWith("ratelimit:draft:"))).toBe(true);
  });
});
