// w42-b (DEC-626/DEC-020): public CFP submit gets two cheap body-free guards
// ahead of `parseBody` (same-origin check, per-IP rate limit) and its
// answer-file write becomes one committed unit -- every file lands in R2
// BEFORE any row exists, and any failure in the DB write phase deletes the
// R2 objects it wrote plus the submission row it created (reusing the admin
// session-delete cascade, src/server/repo/submission-delete.ts), then
// rethrows.
//
// Covers:
//  - a cross-origin POST (Origin header naming a different host) never
//    parses the body -- CSRF-failure page, 400, empty answers.
//  - a same-origin POST with a STALE csrf cookie still re-renders with the
//    submitter's answers intact (DEC-626 survives the guard reordering).
//  - the answer-file put streams (file.stream()), never file.arrayBuffer().
//  - upsertSubmissionAnswers throwing mid-write triggers: the R2 object put
//    earlier gets deleted, and the submission cascade-delete helper is
//    invoked for exactly the submission id this request minted.

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
    // DEC-072 (wave-58 amendment): a failure past the budget spend now
    // refunds it via db.update(...).set(...).where(...) before rethrowing
    // -- a no-op stub so that refund doesn't throw here.
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

function fakeFilesBucket() {
  const puts: { key: string; body: unknown; contentType?: string }[] = [];
  const deletes: string[] = [];
  const bucket = {
    async put(key: string, body: unknown, opts?: { httpMetadata?: { contentType?: string } }) {
      puts.push({ key, body, contentType: opts?.httpMetadata?.contentType });
    },
    async get() {
      return null;
    },
    // FileStore.delete delegates to deleteMany (src/server/context.ts), so
    // R2Bucket.delete is always invoked with an array — even for a single
    // key. Flatten so `deletes` stays a flat list of keys.
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        deletes.push(key);
      }
    },
  } as unknown as R2Bucket;
  return { bucket, puts, deletes };
}

const CSRF_TOKEN = "test-csrf-token";

function submitForm(opts: { origin?: string; referer?: string; csrfCookie?: string; file?: boolean } = {}) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, opts.csrfCookie ?? CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", "ada@example.com");
  if (opts.file) {
    form.set("field__slides_file", new File(["hello"], "slides.pdf", { type: "application/pdf" }));
  }
  form.set("trackIds", "track-1");
  const headers: Record<string, string> = { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` };
  if (opts.origin) headers.Origin = opts.origin;
  if (opts.referer) headers.Referer = opts.referer;
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers,
    body: form,
  });
}

afterEach(() => {
  vi.doUnmock("../src/server/repo/submit");
  vi.doUnmock("../src/server/repo/submission-delete");
  vi.resetModules();
});

describe("public submit same-origin guard (w42-b, DEC-626/DEC-020)", () => {
  it("a cross-origin POST (Origin names a different host) never parses the body: CSRF page, 400, empty answers", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    const req = submitForm({ origin: "https://evil.example" });
    const res = await app.request(req, undefined, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    // The body was never parsed -- none of the submitter's typed values leak.
    expect(body).not.toContain("My great talk");
    expect(body).not.toContain("Ada");
    expect(body).toContain("your answers are still here");
  });

  it("a same-origin POST (matching Origin) with a STALE csrf cookie still re-renders with the submitter's answers intact", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    // Origin matches the request host, but the double-submit form token
    // doesn't match the cookie -- DEC-626's keep-what-you-typed behavior.
    const req = submitForm({ origin: "http://local", csrfCookie: "stale-mismatched-token" });
    const res = await app.request(req, undefined, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("My great talk");
    expect(body).toContain("your answers are still here");
  });

  it("a same-origin POST via Referer fallback (no Origin header) passes the guard and completes a normal submit", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    // Same select queue shape test/submit-hidden-file-field.test.ts uses for
    // a full successful submit: event, form, fields, tracks,
    // findContactByEmail (none), createSubmission's seq readback,
    // findAccountUserId.
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    // Referer matches the request host; the double-submit cookie/form token
    // both equal CSRF_TOKEN so this makes it all the way through to a
    // successful submit -- proof the guard didn't reject it.
    const req = submitForm({ referer: "http://local/submit/test-conf" });
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: fakeFilesBucket().bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200);
  });
});

describe("public submit answer-file write is one committed unit (w42-b)", () => {
  it("streams the file to R2 (file.stream(), not file.arrayBuffer())", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket, puts } = fakeFilesBucket();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    const req = submitForm({ file: true });
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200);
    expect(puts).toHaveLength(1);
    const firstPut = puts[0];
    if (!firstPut) throw new Error("expected exactly one R2 put");
    expect(firstPut.key).toMatch(/^sub\/pending\//);
    expect(typeof (firstPut.body as ReadableStream).getReader).toBe("function");
  });

  it("upsertSubmissionAnswers throwing mid-write deletes the R2 object it put and cascade-deletes the submission row it created", async () => {
    const commitSubmissionDeleteSpy = vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => ids.length);

    vi.doMock("../src/server/repo/submission-delete", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submission-delete")>(
        "../src/server/repo/submission-delete",
      );
      return { ...actual, commitSubmissionDelete: commitSubmissionDeleteSpy };
    });
    vi.doMock("../src/server/repo/submit", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submit")>("../src/server/repo/submit");
      return {
        ...actual,
        upsertSubmissionAnswers: vi.fn(async () => {
          throw new Error("boom: simulated write failure");
        }),
      };
    });

    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db, inserts } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket, puts, deletes } = fakeFilesBucket();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    const req = submitForm({ file: true });
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    // The thrown error is not an ApiError -- registerErrorHandler renders it
    // as a loud 500, never a silently-swallowed 200.
    expect(res.status).toBe(500);

    // Exactly one R2 object was put (the answer file), and it was deleted
    // again once the write phase failed -- no orphan.
    expect(puts).toHaveLength(1);
    const firstPut = puts[0];
    if (!firstPut) throw new Error("expected exactly one R2 put");
    expect(deletes).toEqual([firstPut.key]);

    // The submission row this request minted (readable via the insert()
    // call that carried the submission's own id) was handed to the cascade
    // delete helper -- reusing the admin session-delete route's helper
    // rather than a bespoke rollback.
    expect(commitSubmissionDeleteSpy).toHaveBeenCalledTimes(1);
    const submissionInsert = inserts.find((v) => typeof v === "object" && v !== null && "seq" in (v as object));
    if (!submissionInsert) throw new Error("expected a submission insert() call");
    const firstCall = commitSubmissionDeleteSpy.mock.calls[0];
    if (!firstCall) throw new Error("expected commitSubmissionDelete to be called");
    expect(firstCall[2]).toEqual([(submissionInsert as { id: string }).id]);
  });
});
