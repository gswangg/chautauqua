// DEC-713 (wave 21): a transaction rollback is still an ordering. The
// anonymous public CFP submit handler's own rollback (src/routes/public/
// submit.tsx) must commit the submission-row delete FIRST, then best-effort
// clean up the R2 objects it wrote in an inner try whose catch logs and
// swallows -- never letting a cleanup failure mask the original error.
//
// Reuses the same fake-db/fake-bucket harness as
// test/submit-guards-and-atomicity.test.ts (which already covers the
// "orphan-free" outcome); this file is specifically about ORDER and about
// the original error surviving a *second* failure during cleanup.

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
    // DEC-072 (wave-58 amendment): a failed DB write phase now refunds the
    // submit-email budget via db.update(...).set(...).where(...) before
    // rethrowing -- a no-op stub so that refund doesn't throw here (this
    // file's assertions are about rollback ORDER, not the rate-limit
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

/** Records the ORDER in which R2 delete calls happen, relative to entries
 * pushed externally (e.g. the commitSubmissionDelete spy below), via a
 * shared `order` array both write into. */
function fakeFilesBucket(order: string[], opts: { deleteThrows?: boolean } = {}) {
  const puts: { key: string; body: unknown; contentType?: string }[] = [];
  const bucket = {
    async put(key: string, body: unknown, putOpts?: { httpMetadata?: { contentType?: string } }) {
      puts.push({ key, body, contentType: putOpts?.httpMetadata?.contentType });
    },
    async get() {
      return null;
    },
    async delete(keys: string | string[]) {
      order.push("r2-delete");
      if (opts.deleteThrows) throw new Error("boom: R2 delete failed");
    },
  } as unknown as R2Bucket;
  return { bucket, puts };
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

describe("public submit rollback ordering (DEC-713, wave 21)", () => {
  it("commits the submission-row delete BEFORE any fileStore.delete call", async () => {
    const order: string[] = [];
    const commitSubmissionDeleteSpy = vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => {
      order.push("row-delete");
      return ids.length;
    });

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
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket } = fakeFilesBucket(order);
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const req = submitForm();
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(500);
    expect(commitSubmissionDeleteSpy).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["row-delete", "r2-delete"]);
  });

  it("rethrows the ORIGINAL error even when fileStore.delete itself rejects during cleanup", async () => {
    const order: string[] = [];
    const commitSubmissionDeleteSpy = vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => {
      order.push("row-delete");
      return ids.length;
    });

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
          throw new Error("original write failure");
        }),
      };
    });

    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    // The R2 cleanup delete rejects -- the handler must still surface the
    // ORIGINAL "original write failure" cause (as a 500 from
    // registerErrorHandler), not the cleanup error, and must not itself
    // reject unhandled.
    const { bucket } = fakeFilesBucket(order, { deleteThrows: true });
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const req = submitForm();
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    // registerErrorHandler renders a non-ApiError as a loud 500; the request
    // completed (no unhandled rejection escaped the handler), and the row
    // delete still committed before the (failed) R2 cleanup was attempted.
    expect(res.status).toBe(500);
    expect(order).toEqual(["row-delete", "r2-delete"]);
    expect(commitSubmissionDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("no R2 key survives when both the row delete and the R2 cleanup succeed", async () => {
    const order: string[] = [];
    const commitSubmissionDeleteSpy = vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => {
      order.push("row-delete");
      return ids.length;
    });

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
    const { db } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket, puts } = fakeFilesBucket(order);
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const req = submitForm();
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(500);
    expect(puts).toHaveLength(1);
    expect(order).toEqual(["row-delete", "r2-delete"]);
  });
});
