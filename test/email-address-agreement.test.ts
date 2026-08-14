// DEC-454 amendment (wave 24): email intake must accept only what the mail
// serializer will send unchanged. src/mail/email-binding.ts's `addressValue`
// strips the same character class src/domain/email.ts's ADDRESS_FORBIDDEN_RE
// now rejects at intake -- this file asserts the two stay in agreement so a
// stored/displayed/logged address is never a different mailbox than the one
// actually mailed.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { isValidEmail, normalizeEmail } from "../src/domain/email";
import { addressValue } from "../src/mail/email-binding";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";

const HOSTILE = [
  "a,b@c.com",
  "a<b@c.com",
  "a>b@c.com",
  "a;b@c.com",
  'a"b@c.com',
  "a\\b@c.com",
  "a\rb@c.com",
];

const LEGITIMATE = [
  "a+tag@sub.example.com",
  "first.last@example.co.uk",
  `${"x".repeat(64)}@example.com`, // 64-char local part, exactly at the cap
];

describe("DEC-454 amendment (wave 24): intake rejects every hostile spelling addressValue would otherwise strip", () => {
  it.each(HOSTILE)("isValidEmail(%j) is false", (candidate) => {
    expect(isValidEmail(candidate)).toBe(false);
  });
});

describe("DEC-454 amendment (wave 24): the serializer is a no-op on anything intake accepted", () => {
  it.each(LEGITIMATE)("addressValue(normalizeEmail(%j)) === normalizeEmail(%j)", (candidate) => {
    expect(isValidEmail(candidate)).toBe(true);
    const normalized = normalizeEmail(candidate);
    expect(addressValue(normalized)).toBe(normalized);
  });
});

// -- route-level: public CFP submit --------------------------------------

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

const CSRF_TOKEN = "test-csrf-token";

function submitForm(email: string) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", email);
  form.set("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`, Origin: "http://local" },
    body: form,
  });
}

describe("public CFP submit rejects a hostile address at the field level (DEC-454 amendment, wave 24)", () => {
  it("a,b@c.com returns the field-level validation error and never creates a contact", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    // Only the first two selects (event, form) plus fields/tracks are
    // queued -- findContactByEmail is the NEXT select after validation, so
    // if the field-level guard didn't short-circuit before it, the select
    // queue would run dry and the route would throw/500 instead of 400.
    const { db, inserts } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    const req = submitForm("a,b@c.com");
    const res = await app.request(req, undefined, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("must be a valid email address");
    // The only insert that ran is the per-IP rate-limit counter (write (b),
    // ahead of body parsing) -- no contact or submission row was created by
    // the field-level guard rejecting the address.
    expect(inserts).toHaveLength(1);
  });
});
