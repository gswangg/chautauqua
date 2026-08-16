// DEC-245 (supersedes the w1-i re-render approach): POST
// /submit/:eventSlug/save-draft redirects to ?draft=saved, and the
// following GET renders a distinct "Draft saved" banner above the form.
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db,
// mirroring the fakeDb pattern in test/submit-hidden-file-field.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { draftCookieName, draftKvKey, hashDraftToken } from "../src/lib/draft";
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
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
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

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    // DEC-948: checkAndIncrementScopedLimit now upserts a rate_limit row via
    // D1 instead of writing to KV; a minimal always-under-cap fake is enough
    // since these tests don't assert on rate-limit state.
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: async () => [{ count: 1 }],
          then: (resolve: (v: undefined) => void) => resolve(undefined),
        }),
      }),
    }),
    delete: () => ({ where: async () => {} }),
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
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

describe("POST /submit/:eventSlug/save-draft", () => {
  it("redirects (302) to ?draft=saved rather than re-rendering directly", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);

    const form = new URLSearchParams();
    form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
    form.set("field__title", "My great talk");
    form.set("speaker_name", "Ada");

    const res = await app.request(
      "/submit/test-conf/save-draft",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
        },
        body: form.toString(),
      },
      { KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/submit/test-conf?draft=saved");
  });
});

describe("GET /submit/:eventSlug?draft=saved", () => {
  it("renders a distinct 'Draft saved' confirmation banner above the form", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);

    const res = await app.request(
      "/submit/test-conf?draft=saved",
      { headers: {} },
      { KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Draft saved");
    expect(body).toContain("you can return later to finish and submit");
  });
});

// DEC-014 amendment (wave 10): a malformed/legacy KV blob under the
// submitter's chq_draft_<formId> cookie must never 500 the GET -- it renders
// the empty form with a stated banner instead, and the unusable record is
// deleted so the cookie isn't stuck broken for the rest of the 30-day TTL.
describe("GET /submit/:eventSlug with a malformed draft KV record", () => {
  it("renders 200 with the empty form and a restore-failed banner, not a 500", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const kv = fakeKv();
    const token = "legacy-token";
    const hash = await hashDraftToken(token);
    // Legacy/malformed shape: no trackIds field, and answers is missing
    // entirely -- exactly the crash case this task fixes.
    await kv.put(draftKvKey(hash), JSON.stringify({ formId: "form-1", savedAt: 1 }));

    const res = await app.request(
      "/submit/test-conf",
      { headers: { cookie: `${draftCookieName("form-1")}=${token}` } },
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("restore your saved draft");
    // The unusable record is deleted, not left to keep breaking the cookie.
    expect(await kv.get(draftKvKey(hash))).toBeNull();
  });
});
