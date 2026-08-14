// DEC-124: the no-red error-and-validation-states standard, applied to the
// public CFP submit form (this standard's exemplar frame). A rejected POST
// must render:
//  - a top-of-form summary ("N things need fixing before this can be
//    sent") with exactly one anchor per errored field/problem, each
//    href-ing an id that actually exists somewhere in the rendered HTML
//    (the field/fieldset the anchor points at),
//  - a "Nothing was lost" reassurance line,
//  - an over-length message naming BOTH numbers (what was typed, and how
//    far over the limit that is) rather than the generic "too long",
//  - the track radio group's "must pick one" error using the exemplar
//    copy ("Pick one — a talk needs a track so the right people review
//    it"),
//  - every typed answer surviving the re-render (nothing is lost).
//
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db,
// mirroring the fakeDb pattern in test/submit-speaker-profile-fields.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { MAX_TEXT_LENGTH } from "../src/forms/validate";
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
  { id: "notes", section: "session", kind: "text", label: "Notes for reviewers", helpText: null, required: false, position: 2, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
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
    insert: () => ({
      values: () => ({
        then: (resolve: (v: undefined) => void) => resolve(undefined),
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

// select() queue for the POST handler: getEventBySlug, getDefaultForm,
// getFormFields, getEventTracks.
function selectQueue() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]];
}

const OVER_LENGTH_NOTES = "x".repeat(MAX_TEXT_LENGTH + 50);

function invalidSubmitRequest() {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  // title left blank -> required error.
  form.set("field__title", "");
  form.set("field__description", "A talk about things.");
  form.set("field__notes", OVER_LENGTH_NOTES);
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", "ada@example.com");
  // trackIds omitted entirely -> "Select a track" (rewritten to the
  // exemplar copy).
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

describe("public CFP submit error-and-validation-states standard (DEC-124)", () => {
  it("renders a top-of-form summary with one anchor per problem, each pointing at a rendered field id", async () => {
    const db = fakeDb(selectQueue());
    const app = appWithDb(db);
    const req = invalidSubmitRequest();

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(400);
    const html = await res.text();

    // The summary block itself.
    expect(html).toContain('class="chq-error-summary"');
    expect(html).toContain("things need fixing before this can be sent");
    expect(html).toContain("Nothing was lost. Everything you typed is still below.");

    // Exactly one summary anchor per problem: title (required), notes
    // (over-length), track (must pick one) = 3 problems.
    const anchors = [...html.matchAll(/<a class="chq-error-summary-link" href="#([^"]+)"/g)].map((m) => m[1]);
    expect(anchors).toHaveLength(3);
    // Every anchor's target id actually exists somewhere in the page.
    for (const id of anchors) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("the over-length message names both numbers (typed count and how far over)", async () => {
    const db = fakeDb(selectQueue());
    const app = appWithDb(db);
    const req = invalidSubmitRequest();

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    const html = await res.text();

    const typedCount = OVER_LENGTH_NOTES.length.toLocaleString("en-US");
    const overCount = (OVER_LENGTH_NOTES.length - MAX_TEXT_LENGTH).toLocaleString("en-US");
    expect(html).toContain(typedCount);
    expect(html).toContain(overCount);
    expect(html).toContain("over the");
    expect(html).not.toContain("Too long (max");
  });

  it("the track error reads the exemplar copy, not validateTrackChoice's generic 'Select a track'", async () => {
    const db = fakeDb(selectQueue());
    const app = appWithDb(db);
    const req = invalidSubmitRequest();

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    const html = await res.text();

    expect(html).toContain("Pick one — a talk needs a track so the right people review it");
    expect(html).not.toContain(">Select a track<");
  });

  it("every typed answer survives the re-render (nothing is lost)", async () => {
    const db = fakeDb(selectQueue());
    const app = appWithDb(db);
    const req = invalidSubmitRequest();

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    const html = await res.text();

    expect(html).toContain("A talk about things."); // description
    expect(html).toContain("Ada Lovelace"); // speaker_name
    expect(html).toContain("ada@example.com"); // email
    expect(html).toContain(OVER_LENGTH_NOTES); // notes, unmodified
  });

  it("every errored control carries chq-field-invalid and aria-invalid", async () => {
    const db = fakeDb(selectQueue());
    const app = appWithDb(db);
    const req = invalidSubmitRequest();

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    const html = await res.text();

    // Title (required, blank) is a plain text input rendered via the
    // shared FormFieldsSection/FieldControl (src/views/form-render.tsx).
    const titleInputMatch = html.match(/<input[^>]*name="field__title"[^>]*>/);
    expect(titleInputMatch).toBeTruthy();
    expect(titleInputMatch![0]).toContain("chq-field-invalid");
    expect(titleInputMatch![0]).toContain('aria-invalid="true"');

    // The track radio fieldset gets the invalid class + aria-invalid too.
    expect(html).toMatch(/<fieldset id="chq-cfp-track-choices" class="chq-cfp-fieldset chq-field-invalid" aria-invalid="true"/);
  });
});
