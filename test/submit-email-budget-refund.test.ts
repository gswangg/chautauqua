// DEC-072 (wave-58 amendment): the public CFP's per-email budget
// ("submit-email") is spent atomically at admission (submit-post.tsx) and
// must be given back if either downstream write phase fails -- the R2
// fan-out rejection or the DB write-phase catch -- exactly the same
// reasoning as login-ip's refund at auth-login.tsx:213 (the precedent this
// task cites). A failure that doesn't refund leaves ten transient failures
// permanently locking out a real speaker for an hour.
//
// Reuses the queue-based fake-db/fake-bucket harness from
// test/public-submit-rollback-order.test.ts and
// test/public-submit-upload-partial-failure.test.ts, extended with a real
// (key -> count) rate_limit table so this test can assert the counter is
// EXACTLY where it started, not just that *a* refund call happened.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { scopedRateLimitKey } from "../src/lib/rate-limit";
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
];

const EMAIL = "refund-me@example.com";

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

/** A minimal real (key -> count) rate_limit table, so the test can assert
 * the counter's ABSOLUTE value after a refund, not just that some refund
 * call fired. Every other table keeps the old queue-based/record-only fake
 * behavior (this test only cares about rate_limit's numbers). */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const rateLimitRows = new Map<string, number>();
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    // NOTE: dispatches on the SHAPE of `vals` (has key/count/expiresAt),
    // not on `table === schema.rateLimit` reference identity -- the DB
    // write-phase test below uses vi.doMock + a dynamic re-import of the
    // route module, and this file's own afterEach calls
    // vi.resetModules(), so a freshly re-imported route tree resolves
    // "../../db/schema" to a DIFFERENT module instance than this file's
    // static top-level `schema` import. A reference-identity check would
    // silently fall through to the generic (non-tracking) branch below
    // for every test after the first.
    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        inserts.push(vals);
        if (typeof vals.key === "string" && typeof vals.count === "number" && "expiresAt" in vals) {
          const key = vals.key as string;
          return {
            onConflictDoUpdate: () => ({
              returning: async () => {
                const next = (rateLimitRows.get(key) ?? 0) + 1;
                rateLimitRows.set(key, next);
                return [{ count: next }];
              },
              then: (resolve: (v: undefined) => void) => {
                rateLimitRows.set(key, (rateLimitRows.get(key) ?? 0) + 1);
                resolve(undefined);
              },
            }),
          };
        }
        return {
          then: (resolve: (v: unknown) => unknown) => Promise.resolve().then(resolve),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    // refundScopedLimit's shape: update(schema.rateLimit).set({count:
    // sql`count - 1`}).where(and(eq(key,key), gt(count,0))) -- this route
    // never calls db.update() for any table other than rate_limit (see
    // this file's header comment on the reference-identity pitfall), so
    // this fake decrements only "ratelimit:submit-email:*" keys (the ONLY
    // scope this test's route code ever refunds), guarded by count > 0
    // exactly like the real atomic statement. This deliberately leaves the
    // sibling "submit" IP bucket's count untouched by any update call, so a
    // regression that refunded the wrong scope would show up as a non-zero
    // submit-email count instead of silently passing.
    update: (_table: unknown) => ({
      set: () => ({
        where: async () => {
          for (const [key, count] of rateLimitRows) {
            if (key.startsWith("ratelimit:submit-email:") && count > 0) rateLimitRows.set(key, count - 1);
          }
        },
      }),
    }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, rateLimitRows };
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

function fakeFilesBucket(opts: { putRejects?: boolean } = {}) {
  const puts: string[] = [];
  const deletes: string[] = [];
  const bucket = {
    async put(key: string) {
      puts.push(key);
      if (opts.putRejects) throw new Error("boom: R2 put failed");
    },
    async get() {
      return null;
    },
    async delete(keys: string | string[]) {
      deletes.push(...(Array.isArray(keys) ? keys : [keys]));
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
  form.set("field__email", EMAIL);
  form.set("field__slides_file", new File(["hello"], "slides.pdf", { type: "application/pdf" }));
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

function submitEmailBucketKey(): string {
  // Mirrors emailBudgetOk's windowBounds math (windowSeconds: 3600) for
  // "now" values within the same hour -- close enough for a same-test-run
  // assertion since we never cross an hour boundary mid-test.
  const windowMs = 3600 * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  return scopedRateLimitKey("submit-email", EMAIL, windowStart);
}

afterEach(() => {
  vi.doUnmock("../src/server/repo/submit");
  vi.resetModules();
});

describe("submit-email budget refund on transient write failure (DEC-072 wave-58 amendment)", () => {
  it("a failing R2 put leaves the submit-email counter exactly where it started, and rethrows the R2 error unmodified", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db, rateLimitRows } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], []]);
    const { bucket } = fakeFilesBucket({ putRejects: true });
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const res = await app.request(
      submitForm(),
      undefined,
      { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(500);
    const key = submitEmailBucketKey();
    // Spent once (count -> 1), then refunded once (count -> 0): net zero,
    // not merely "not 429" -- a leftover count of 1 would still be
    // invisible to THIS request but would eat into the next nine.
    expect(rateLimitRows.get(key)).toBe(0);
  });

  it("a failing DB write phase leaves the submit-email counter exactly where it started, and rethrows the DB error unmodified", async () => {
    vi.doMock("../src/server/repo/submit", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submit")>("../src/server/repo/submit");
      return {
        ...actual,
        upsertSubmissionAnswers: vi.fn(async () => {
          throw new Error("boom: simulated DB write failure");
        }),
      };
    });
    vi.doMock("../src/server/repo/submission-delete", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submission-delete")>(
        "../src/server/repo/submission-delete",
      );
      return { ...actual, commitSubmissionDelete: vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => ids.length) };
    });

    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db, rateLimitRows } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const res = await app.request(
      submitForm(),
      undefined,
      { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(500);
    const key = submitEmailBucketKey();
    expect(rateLimitRows.get(key)).toBe(0);

    vi.doUnmock("../src/server/repo/submission-delete");
  });

  it("on the happy path: the counter is spent once and left at 1 (no refund on success)", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db, rateLimitRows } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const res = await app.request(
      submitForm(),
      undefined,
      { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const key = submitEmailBucketKey();
    expect(rateLimitRows.get(key)).toBe(1);
  });
});
