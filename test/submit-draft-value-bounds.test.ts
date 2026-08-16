// DEC-422 (wave-54 amendment): the anonymous save-draft cap loop previously
// bounded only string answers and skipped every other shape, so an
// unauthenticated POST could persist an arbitrarily large `trackIds` array
// into a 30-day KV record (bounded only by the 100 MB body ceiling). This
// bounds SIZE only: a trackIds array over MAX_SUBMISSION_TRACK_IDS entries,
// or any entry over MAX_TEXT_LENGTH, is refused with a 400 + banner and the
// draft is never persisted. It deliberately does not validate trackId
// membership (task-w49-h already ruled that not owed on the draft path).
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db,
// mirroring test/submit-draft-limits.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { MAX_TEXT_LENGTH } from "../src/forms/validate";
import { MAX_SUBMISSION_TRACK_IDS } from "../src/domain/ids";
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
// instead of writing to KV.
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
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

function fakeKv() {
  const store = new Map<string, string>();
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

function draftRequest(fields: Record<string, string>, trackIds: string[], ip: string) {
  const form = new URLSearchParams();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  for (const id of trackIds) form.append("trackIds", id);
  return {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
      "cf-connecting-ip": ip,
    },
    body: form.toString(),
  } as const;
}

describe("POST /submit/:eventSlug/save-draft — DEC-422 trackIds shape bound", () => {
  it("refuses a trackIds array over MAX_SUBMISSION_TRACK_IDS entries with 400 and never writes to KV", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();
    const trackIds = Array.from({ length: MAX_SUBMISSION_TRACK_IDS + 1 }, (_, i) => `t${i}`);

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "ok" }, trackIds, "10.0.0.1"),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toMatch(/too many/i);
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(false);
  });

  it("refuses a trackIds entry over MAX_TEXT_LENGTH with 400 and never writes to KV", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();
    const overLong = "x".repeat(MAX_TEXT_LENGTH + 1);

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "ok" }, [overLong], "10.0.0.2"),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(false);
  });

  it("saves an ordinary draft with a small trackIds selection, 302s and writes", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const res = await app.request(
      "/submit/test-conf/save-draft",
      draftRequest({ field__title: "ok" }, ["track-1"], "10.0.0.3"),
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("?draft=saved");
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(true);
  });
});
