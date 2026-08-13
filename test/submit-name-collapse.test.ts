// DEC-986 (wave 45 amendment): the public CFP asks for ONE "Name" control,
// closing the wave-40 amendment's deferred name-collapse
// (src/routes/public/submit-views.tsx used to render First name|Last name
// as two locked FormFieldDefs). Underneath, first_name/last_name are still
// real columns (DEC-016) — the POST handler
// (src/routes/public/submit.tsx) splits the single submitted string on the
// LAST run of whitespace before validateAnswers runs, and the derived
// last_name is exempt from the required check (only the single control
// carries required-ness).
//
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db,
// mirroring the fakeDb pattern in test/submit-speaker-profile-fields.test.ts.

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

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
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
          then: (resolve: (v: undefined) => void) => resolve(undefined),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    update: () => ({
      set: () => ({ where: async () => {} }),
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

function fakeFilesBucket(): R2Bucket {
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
const BINDINGS = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

function submitForm(name: string) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", name);
  form.set("field__email", "speaker@example.com");
  form.set("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

function selectQueueFresh() {
  // getEventBySlug, getDefaultForm, getFormFields, getEventTracks,
  // findContactByEmail (none), nextSubmissionSeq, findAccountUserId.
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 3 }], []];
}

async function submitAndGetContact(name: string) {
  const { db, inserts } = fakeDb(selectQueueFresh());
  const app = appWithDb(db);
  const req = submitForm(name);
  const res = await app.request(req, undefined, {
    ...BINDINGS,
    KV: fakeKv(),
    FILES: fakeFilesBucket(),
  } as unknown as AppEnv["Bindings"]);
  const contactInsert = inserts.find((v) => typeof v === "object" && v !== null && "firstName" in v);
  return { res, contactInsert: contactInsert as { firstName: string; lastName: string } | undefined };
}

describe("GET /submit/:eventSlug — single Name control (DEC-986 wave 45 amendment)", () => {
  it("renders exactly one Name input, and neither locked speaker field id as its own input", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db.db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();

    // Exactly one control named "speaker_name".
    const nameInputs = [...body.matchAll(/<input[^>]*name="speaker_name"[^>]*>/g)];
    expect(nameInputs).toHaveLength(1);
    expect(nameInputs[0]![0]).toContain('autocomplete="name"');

    // Neither locked field id appears as its own input.
    expect(body).not.toContain('name="field__first_name"');
    expect(body).not.toContain('name="field__last_name"');
    expect(body).not.toContain(">First name<");
    expect(body).not.toContain(">Last name<");
    expect(body).toContain(">Name<");
  });

  it("names the mechanism (set a password on an emailed link) without promising account creation", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db.db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    const body = await res.text();

    expect(body).not.toContain("creates your speaker portal account");
    expect(body).not.toContain("create an account");
    expect(body).toContain("set a password");
    expect(body).toContain("Already have an account? <a href=\"/login\">Sign in to the speaker portal</a>");
  });
});

describe("POST /submit/:eventSlug — name split (DEC-986 wave 45 amendment)", () => {
  it("'Ada Lovelace' splits into first/last on the last run of whitespace", async () => {
    const { res, contactInsert } = await submitAndGetContact("Ada Lovelace");
    expect(res.status).toBe(200);
    expect(contactInsert?.firstName).toBe("Ada");
    expect(contactInsert?.lastName).toBe("Lovelace");
  });

  it("'Prince' (single token) lands entirely in first_name, no validation error, contact created", async () => {
    const { res, contactInsert } = await submitAndGetContact("Prince");
    expect(res.status).toBe(200);
    expect(contactInsert?.firstName).toBe("Prince");
    expect(contactInsert?.lastName).toBe("");
  });

  it("'Mary Anne Van Der Berg' splits on the LAST whitespace run only", async () => {
    const { res, contactInsert } = await submitAndGetContact("Mary Anne Van Der Berg");
    expect(res.status).toBe(200);
    expect(contactInsert?.firstName).toBe("Mary Anne Van Der");
    expect(contactInsert?.lastName).toBe("Berg");
  });

  it("an empty name is a 400 with the field error under the single control, not a generic 'required'", async () => {
    const { db } = fakeDb(selectQueueFresh());
    const app = appWithDb(db);
    const req = submitForm("");

    const res = await app.request(req, undefined, {
      ...BINDINGS,
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Enter your name");
  });

  it("an errored POST (e.g. missing title) repopulates the single control from what was typed", async () => {
    const { db } = fakeDb(selectQueueFresh());
    const app = appWithDb(db);
    const form = new FormData();
    form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
    // Title omitted -> validation fails on an unrelated field.
    form.set("field__description", "A talk about things.");
    form.set("speaker_name", "Ada Lovelace");
    form.set("field__email", "speaker@example.com");
    form.set("trackIds", "track-1");
    const req = new Request("http://local/submit/test-conf", {
      method: "POST",
      headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
      body: form,
    });

    const res = await app.request(req, undefined, {
      ...BINDINGS,
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(400);
    const body = await res.text();
    const nameInputs = [...body.matchAll(/<input[^>]*name="speaker_name"[^>]*>/g)];
    expect(nameInputs).toHaveLength(1);
    expect(nameInputs[0]![0]).toContain('value="Ada Lovelace"');
  });
});
