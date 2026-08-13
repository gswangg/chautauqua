// DEC-422: POST /submit/:eventSlug/save-draft is an otherwise-unmetered KV
// write path — it must carry the same per-IP scoped limiter the sibling
// final-submit handler already has (scope 'draft', windowSeconds 3600, max
// 60), and every string answer must be bound to its field-kind cap
// (MAX_LONG_TEXT_LENGTH for 'long_text', MAX_TEXT_LENGTH otherwise) before
// it ever reaches saveDraft. Mounts the real publicSubmitRoutes sub-app
// against a minimal fake db, mirroring test/submit-draft-notice.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";
import { scopedRateLimitKey } from "../src/lib/rate-limit";
import type { AppEnv } from "../src/server/env";

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
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "abstract", section: "session", kind: "long_text", label: "Abstract", helpText: null, required: false, position: 1, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

// DEC-948: checkAndIncrementScopedLimit now upserts a rate_limit row via D1
// instead of writing to KV. `rateLimitSeed` lets a test pre-seed a row's
// count (mirroring the old fakeKv pre-seed pattern) so the atomic
// increment's returned count can actually cross the cap.
function fakeDb(selectQueue: unknown[][], rateLimitSeed?: Record<string, { count: number; expiresAt: number }>) {
  let call = 0;
  const rateLimitRows = new Map(Object.entries(rateLimitSeed ?? {}));
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: { key: string; count: number; expiresAt: number }) => ({
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
      }),
    }),
    delete: () => ({ where: async () => {} }),
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv(seed?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  const puts: Array<{ key: string; value: string }> = [];
  const kv = {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
      puts.push({ key, value });
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return { kv, puts };
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

function draftRequest(fields: Record<string, string>) {
  const form = new URLSearchParams();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
    },
    body: form.toString(),
  } as const;
}

describe("POST /submit/:eventSlug/save-draft — DEC-422 field caps", () => {
  it("rejects an over-cap answer with 400 and never writes to KV", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "x".repeat(MAX_TEXT_LENGTH + 1) }),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Title");
    // the per-IP rate-limit counter is allowed to write; the draft record
    // itself (key prefix 'draft:') must never be written.
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(false);
  });

  it("rejects an over-cap long_text answer at the long-text cap boundary", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({
        field__title: "ok",
        field__abstract: "x".repeat(MAX_LONG_TEXT_LENGTH + 1),
      }),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(false);
  });

  it("saves a draft whose answer is exactly at the cap", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "x".repeat(MAX_TEXT_LENGTH) }),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(302);
    // one put for the draft KV write, one for the rate-limit counter.
    expect(puts.length).toBeGreaterThan(0);
  });
});

describe("POST /submit/:eventSlug/save-draft — DEC-422 per-IP rate limit", () => {
  it("limits the 61st draft save from the same IP within the window", async () => {
    // The route computes its window against the real Date.now() at request
    // time, so the seeded key must use the same clock.
    const windowStart = Math.floor(Date.now() / (3600 * 1000)) * 3600 * 1000;
    const key = scopedRateLimitKey("draft", "9.9.9.9", windowStart);
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]], {
      [key]: { count: 60, expiresAt: windowStart + 3600 * 1000 },
    });
    const app = appWithDb(db);
    const { kv } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      {
        ...draftRequest({ field__title: "ok" }),
        headers: {
          ...draftRequest({ field__title: "ok" }).headers,
          "cf-connecting-ip": "9.9.9.9",
        },
      },
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    // DEC-626: csrfForm-guarded routes mark the request htmlSurface, so a
    // thrown ApiError renders a minimal HTML page (not the JSON envelope).
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toMatch(/Too many/i);
  });
});
