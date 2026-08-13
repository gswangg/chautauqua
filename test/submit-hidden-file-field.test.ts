// DEC-132: public submit must ignore rule-hidden file fields entirely — no
// upload validation error, no R2 put, no file row, no submission_answer row.
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db that
// queues select() rows in call order and records every insert(), mirroring
// the fakeDb pattern used by test/claim-onscreen-scope.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
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

// Dropdown trigger field + a file field only visible when the dropdown is
// "yes" (DEC-132 rule-hidden file field scenario).
const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "wants_slides",
    section: "session",
    kind: "dropdown",
    label: "Will you share slides?",
    helpText: null,
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["yes", "no"]),
    ruleJson: null,
  },
  {
    id: "slides_file",
    section: "session",
    kind: "file",
    label: "Slides",
    helpText: null,
    required: false,
    position: 3,
    optionsJson: null,
    ruleJson: JSON.stringify({ fieldId: "wants_slides", op: "eq", value: "yes" }),
  },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 6, optionsJson: null, ruleJson: null },
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

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every insert() write. */
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
          // DEC-948: checkAndIncrementScopedLimit chains
          // .onConflictDoUpdate(...).returning(...) for its atomic D1
          // upsert; a minimal always-under-cap fake is enough since this
          // test doesn't assert on rate-limit state.
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
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

/** Records every put() call so tests can assert no R2 write happened for a
 * hidden field's (would-be) upload. */
function fakeFilesBucket() {
  const puts: { key: string; body: unknown; contentType?: string }[] = [];
  const bucket = {
    async put(key: string, body: unknown, opts?: { httpMetadata?: { contentType?: string } }) {
      puts.push({ key, body, contentType: opts?.httpMetadata?.contentType });
    },
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
  return { bucket, puts };
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

function submitForm(opts: { wantsSlides: string; file?: { name: string; content: string; type: string } }) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("field__wants_slides", opts.wantsSlides);
  if (opts.file) {
    form.set("field__slides_file", new File([opts.file.content], opts.file.name, { type: opts.file.type }));
  }
  form.set("field__first_name", "Ada");
  form.set("field__last_name", "Lovelace");
  form.set("field__email", "ada@example.com");
  form.set("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

/** Standard select() queue for a successful submit: getEventBySlug,
 * getDefaultForm, getFormFields, getEventTracks, findContactByEmail,
 * nextSubmissionSeq (inside createSubmission), findAccountUserId. */
function selectQueueFor() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 3 }], []];
}

async function run(db: AppEnv["Variables"]["db"], req: Request, filesBucket: R2Bucket) {
  const app = appWithDb(db);
  const res = await app.request(req, undefined, {
    KV: fakeKv(),
    FILES: filesBucket,
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"]);
  return res;
}

function fileInsertRows(inserts: unknown[]): any[] {
  return inserts.filter((v) => typeof v === "object" && v !== null && "r2Key" in (v as object));
}

function answerRowsFor(inserts: unknown[], fieldId: string): any[] {
  const rows: any[] = [];
  for (const v of inserts) {
    if (Array.isArray(v)) {
      for (const row of v) {
        if (typeof row === "object" && row !== null && "formFieldId" in row && (row as any).formFieldId === fieldId) {
          rows.push(row);
        }
      }
    }
  }
  return rows;
}

describe("public submit hidden file field (DEC-132)", () => {
  it("Case A: hidden file field (dropdown=no) with a file part attached still succeeds, with zero trace of the file", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const { bucket, puts } = fakeFilesBucket();
    const req = submitForm({
      wantsSlides: "no",
      file: { name: "slides.pdf", content: "hello", type: "application/pdf" },
    });
    const res = await run(db, req, bucket);
    expect(res.status).toBe(200);

    expect(fileInsertRows(inserts)).toHaveLength(0);
    expect(answerRowsFor(inserts, "slides_file")).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  it("Case B (positive control): visible file field (dropdown=yes) with a valid file creates a file row and answer", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const { bucket, puts } = fakeFilesBucket();
    const req = submitForm({
      wantsSlides: "yes",
      file: { name: "slides.pdf", content: "hello", type: "application/pdf" },
    });
    const res = await run(db, req, bucket);
    expect(res.status).toBe(200);

    const fileRows = fileInsertRows(inserts);
    expect(fileRows).toHaveLength(1);
    expect(puts).toHaveLength(1);

    const answerRows = answerRowsFor(inserts, "slides_file");
    expect(answerRows).toHaveLength(1);
    expect(JSON.parse(answerRows[0].valueJson)).toBe(fileRows[0].id);
  });

  it("Case C: hidden file field with an INVALID file (bad extension) never produces an error and submit still succeeds", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const { bucket, puts } = fakeFilesBucket();
    const req = submitForm({
      wantsSlides: "no",
      file: { name: "malware.exe", content: "x", type: "application/octet-stream" },
    });
    const res = await run(db, req, bucket);
    expect(res.status).toBe(200);

    expect(fileInsertRows(inserts)).toHaveLength(0);
    expect(answerRowsFor(inserts, "slides_file")).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });
});
