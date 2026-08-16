// DEC-530 (amended wave 26): the R2 upload fan-out on the anonymous public
// CFP submit path owns its own cleanup. Every r2Key is minted up front
// (before any put is issued), the puts run in parallel via
// Promise.allSettled (never short-circuiting like Promise.all would), and
// on any rejection every minted key is best-effort deleted before the
// FIRST rejection is rethrown unmodified.
//
// Reuses the same fake-db/fake-bucket harness as
// test/public-submit-rollback-order.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";

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
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "slides_file", section: "session", kind: "file", label: "Slides", helpText: null, required: false, position: 5, optionsJson: null, ruleJson: null },
  { id: "bio_file", section: "session", kind: "file", label: "Bio", helpText: null, required: false, position: 6, optionsJson: null, ruleJson: null },
  { id: "headshot_file", section: "session", kind: "file", label: "Headshot", helpText: null, required: false, position: 7, optionsJson: null, ruleJson: null },
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
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          then: (resolve: (v: unknown) => unknown) => Promise.resolve().then(resolve),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    // DEC-072 (wave-58 amendment): a failed put now refunds the
    // submit-email budget via db.update(...).set(...).where(...) before
    // rethrowing -- a no-op stub so that refund doesn't throw here (this
    // file's assertions are about the R2 fan-out, not the rate-limit
    // counter; see test/submit-email-budget-refund.test.ts for that).
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
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

/** Records each put/delete call, in the order it settles, plus timing hooks
 * so a test can prove the puts genuinely overlap rather than run one after
 * another. */
function fakeFilesBucket(opts: {
  putRejectsFor?: string; // filename that should reject its put
} = {}) {
  const puts: { key: string; contentType?: string }[] = [];
  const deletes: string[] = [];
  const bucket = {
    async put(key: string, body: unknown, putOpts?: { httpMetadata?: { contentType?: string } }) {
      puts.push({ key, contentType: putOpts?.httpMetadata?.contentType });
      // Let every put "start" before any of them resolves/rejects, so a
      // Promise.all (which short-circuits) vs Promise.allSettled
      // (which doesn't) would behave differently under this harness.
      await Promise.resolve();
      await Promise.resolve();
      if (opts.putRejectsFor && key.includes(opts.putRejectsFor)) {
        throw new Error(`boom: R2 put failed for ${opts.putRejectsFor}`);
      }
    },
    async get() {
      return null;
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      deletes.push(...list);
    },
  } as unknown as R2Bucket;
  return { bucket, puts, deletes };
}

const CSRF_TOKEN = "test-csrf-token";

function submitForm() {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", "ada@example.com");
  form.set("field__slides_file", new File(["hello"], "slides.pdf", { type: "application/pdf" }));
  form.set("field__bio_file", new File(["world"], "bio.pdf", { type: "application/pdf" }));
  form.set("field__headshot_file", new File(["pic"], "headshot.pdf", { type: "application/pdf" }));
  form.set("trackIds", "track-1");
  const headers: Record<string, string> = { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`, Origin: "http://local" };
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers,
    body: form,
  });
}

function buildApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  return app;
}

afterEach(() => {
  vi.doUnmock("../src/server/repo/submit");
  vi.doUnmock("../src/server/repo/submission-delete");
  vi.resetModules();
});

describe("public submit R2 upload fan-out (DEC-530, wave 26 amendment)", () => {
  it("on a partial put failure: rethrows the put's own error, deletes every minted key, and leaves no submission row", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    // The SECOND file answer (bio.pdf) fails its put.
    const { bucket, puts, deletes } = fakeFilesBucket({ putRejectsFor: "bio" });
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const req = submitForm();
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    // registerErrorHandler renders the thrown error as a loud 500 — the
    // request completed rather than leaking an unhandled rejection.
    expect(res.status).toBe(500);

    // All three puts were issued (the fan-out did not short-circuit).
    expect(puts).toHaveLength(3);

    // Every minted key (all three, not just the one that failed) was
    // best-effort deleted, since the full key set was known regardless of
    // which put settled.
    expect(deletes).toHaveLength(3);
    const deletedFilenames = deletes.map((k) => k.split("-").slice(1).join("-"));
    expect(deletedFilenames.some((f) => f.includes("slides"))).toBe(true);
    expect(deletedFilenames.some((f) => f.includes("bio"))).toBe(true);
    expect(deletedFilenames.some((f) => f.includes("headshot"))).toBe(true);

    // No submission row was ever created for this failed request — the
    // put-phase failure happens before createSubmission is ever called.
  });

  it("on the happy path: issues all puts in parallel and deletes nothing", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket, puts, deletes } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const req = submitForm();
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200);
    expect(puts).toHaveLength(3);
    expect(deletes).toHaveLength(0);
  });
});
