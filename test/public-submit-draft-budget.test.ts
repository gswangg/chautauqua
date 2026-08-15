// DEC-072 amendment: save-draft carries the same per-email budget the
// final-submit handler already documents (scope 'draft-email', windowSeconds
// 3600, max 30) — closing the spoofed-x-forwarded-for gap on the draft path
// too. Runs after the per-field cap loop and before the first KV write, only
// when the submitter has typed an email answer. Mounts the real
// publicSubmitRoutes sub-app against a minimal fake db, mirroring
// test/submit-draft-limits.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
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
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: false, position: 1, optionsJson: null, ruleJson: null },
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
// count so the atomic increment's returned count can actually cross the cap.
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

function draftRequest(fields: Record<string, string>, extraHeaders?: Record<string, string>) {
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

// Each request in these tests comes from a distinct client IP so the
// per-IP budget (scope "draft", max 60) never interferes with the
// per-email budget (scope "draft-email", max 30) under test.
function ipHeader(ip: string) {
  return { "cf-connecting-ip": ip };
}

describe("POST /submit/:eventSlug/save-draft — DEC-072 per-email budget", () => {
  it("refuses the 31st draft save from one email within the window, keeping typed answers", async () => {
    const windowStart = Math.floor(Date.now() / (3600 * 1000)) * 3600 * 1000;
    const key = scopedRateLimitKey("draft-email", "ada@example.com", windowStart);
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]], {
      [key]: { count: 30, expiresAt: windowStart + 3600 * 1000 },
    });
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest(
        { field__title: "My great talk", field__email: "ada@example.com" },
        ipHeader("1.1.1.1"),
      ),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(429);
    const body = await res.text();
    expect(body).toMatch(/Too many drafts saved from ada@example.com/i);
    // the submitter's typed title answer survives into the re-render.
    expect(body).toContain("My great talk");
    // no draft record was written for the refused request.
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(false);
  });

  it("saves a draft with no email answer, skipping the per-email budget entirely", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "No email yet" }, ipHeader("2.2.2.2")),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(302);
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(true);
  });

  it("keeps 'draft-email' and 'submit-email' as distinct buckets", async () => {
    const windowStart = Math.floor(Date.now() / (3600 * 1000)) * 3600 * 1000;
    const draftKey = scopedRateLimitKey("draft-email", "bo@example.com", windowStart);
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]], {
      [draftKey]: { count: 30, expiresAt: windowStart + 3600 * 1000 },
    });
    const app = appWithDb(db);
    const { kv } = fakeKv();

    // Draft budget for bo@example.com is already exhausted...
    const draftRes = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "Draft attempt", field__email: "bo@example.com" }, ipHeader("3.3.3.1")),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );
    expect(draftRes.status).toBe(429);

    // ...but the final-submit "submit-email" bucket for the same address is
    // untouched — a first real submission attempt is not blocked by drafts
    // hammering the address (the request still fails validation here since
    // this is a minimal fixture, but it must NOT be refused with the
    // draft-budget 429/banner).
    const submitRes = await app.request(
      "/submit/test-conf",
      draftRequest({ field__title: "Real submission", field__email: "bo@example.com" }, ipHeader("3.3.3.2")),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );
    const submitBody = await submitRes.text();
    expect(submitBody).not.toMatch(/Too many drafts saved/i);
  });
});
