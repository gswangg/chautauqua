// w43-e / DEC-532 amendment: even though the public form now toggles a
// rule-gated field's visibility live as the visitor answers (see
// test/submit-conditional-field-behavior.test.ts and
// test/form-render-rules.test.ts for the client-side proof), the server
// stays the ONLY authority (DEC-132/DEC-973) — a value typed into a
// rule-hidden TEXT field (not just the file-field case DEC-132 already
// covers in test/submit-hidden-file-field.test.ts) must still be stripped
// on POST, and its presence must never block submit even when the visible
// field it's paired with is empty. Mirrors that file's fakeDb/appWithDb
// harness exactly.

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

// Dropdown trigger field ("format") + a required long-text dependent
// ("prereqs") only visible/required when format === "Workshop".
const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "format",
    section: "session",
    kind: "dropdown",
    label: "Format",
    helpText: null,
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["Talk", "Workshop"]),
    ruleJson: null,
  },
  {
    id: "prereqs",
    section: "session",
    kind: "long_text",
    label: "Workshop prerequisites",
    helpText: null,
    required: true,
    position: 3,
    optionsJson: null,
    ruleJson: JSON.stringify({ fieldId: "format", op: "eq", value: "Workshop" }),
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
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
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

function submitForm(opts: { format: string; prereqs?: string }) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("field__format", opts.format);
  if (opts.prereqs !== undefined) {
    form.set("field__prereqs", opts.prereqs);
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

function selectQueueFor() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 3 }], []];
}

async function run(db: AppEnv["Variables"]["db"], req: Request) {
  const app = appWithDb(db);
  const res = await app.request(req, undefined, {
    KV: fakeKv(),
    FILES: fakeFilesBucket(),
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"]);
  return res;
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

describe("public submit: a value typed into a rule-hidden TEXT field is ignored on POST (DEC-532 wave-43 amendment)", () => {
  it("format=Talk (prereqs hidden, required=false effectively): a tampered prereqs value never persists and never blocks submit", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const req = submitForm({ format: "Talk", prereqs: "typed in via devtools while hidden" });
    const res = await run(db, req);

    expect(res.status).toBe(200);
    expect(answerRowsFor(inserts, "prereqs")).toHaveLength(0);
  });

  it("positive control: format=Workshop (prereqs visible+required) with prereqs filled in persists the answer", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const req = submitForm({ format: "Workshop", prereqs: "Bring a laptop with Node 20." });
    const res = await run(db, req);

    expect(res.status).toBe(200);
    const rows = answerRowsFor(inserts, "prereqs");
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].valueJson)).toBe("Bring a laptop with Node 20.");
  });

  it("format=Workshop with prereqs left blank IS blocked (server still enforces required on a VISIBLE field)", async () => {
    const { db } = fakeDb(selectQueueFor());
    const req = submitForm({ format: "Workshop" });
    const res = await run(db, req);

    // Re-renders the form with a validation error rather than a hard crash.
    expect(res.status).toBe(400);
  });
});
