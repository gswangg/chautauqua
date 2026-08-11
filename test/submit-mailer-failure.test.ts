// DEC-237/DEC-238: production CFP submit 500'd when the confirmation-email
// send failed after the submission row was already persisted — a retry from
// the speaker then duplicated the submission. The send is now best-effort
// (src/routes/public/submit.tsx): a throwing mailer must not stop the
// confirmation page from rendering, and the failed attempt is still logged
// to email_log with status 'error' (EmailBindingMailer's own contract).
//
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db that
// queues select() rows in call order and records every insert(), mirroring
// the fakeDb pattern in test/submit-hidden-file-field.test.ts. env.EMAIL is a
// stub whose send() always throws and env.DEV_MODE is false, so
// server/context.ts's makeMailer selects EmailBindingMailer (not the dev
// sink) — that mailer logs an 'error' email_log row via its EmailLogWriter
// and rethrows, and the route's try/catch around mailer.send swallows it.

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

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every insert() write (including email_log rows written by
 * EmailBindingMailer via d1EmailLogWriter). */
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
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
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

/** Structural EmailSender stub whose send() always throws — exercises the
 * EmailBindingMailer branch of server/context.ts's makeMailer (env.EMAIL set
 * + DEV_MODE false), not the dev sink. */
function throwingEmailBinding() {
  return {
    async send() {
      throw new Error("simulated provider outage");
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

function submitForm() {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
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

/** select() queue for a successful submit: getEventBySlug, getDefaultForm,
 * getFormFields, getEventTracks, findContactByEmail, nextSubmissionSeq
 * (inside createSubmission), findUserByEmail. */
function selectQueueFor() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ maxSeq: 0 }], []];
}

describe("public submit: mailer failure is best-effort (DEC-237/DEC-238)", () => {
  it("returns the confirmation page, persists the submission, and logs an 'error' email_log row when the mailer throws", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const app = appWithDb(db);
    const req = submitForm();

    const res = await app.request(req, undefined, {
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
      EMAIL: throwingEmailBinding(),
      // DEV_MODE is typed as an optional string (src/server/env.ts); leaving
      // it unset (falsy) is what makeMailer treats as "not dev mode" so it
      // selects EmailBindingMailer over the dev sink.
      MAIL_FROM_EMAIL: "noreply@example.com",
      MAIL_FROM_NAME: "Chautauqua",
    } as unknown as AppEnv["Bindings"]);

    // Confirmation page, not a 500 — the send failure must not surface as an
    // error response to the speaker.
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Thanks for your submission!");

    // The submission row itself was persisted regardless of the mail outcome.
    const submissionInserts = inserts.filter(
      (v) => typeof v === "object" && v !== null && !Array.isArray(v) && "title" in (v as object),
    );
    expect(submissionInserts).toHaveLength(1);
    expect((submissionInserts[0] as any).title).toBe("My great talk");

    // EmailBindingMailer logs the failed attempt with status 'error' before
    // rethrowing (src/mail/email-binding.ts) — the route's try/catch around
    // mailer.send swallows that rethrow.
    const emailLogInserts = inserts.filter(
      (v) => typeof v === "object" && v !== null && !Array.isArray(v) && "toEmail" in (v as object),
    );
    expect(emailLogInserts).toHaveLength(1);
    expect((emailLogInserts[0] as any).status).toBe("error");
    expect((emailLogInserts[0] as any).toEmail).toBe("ada@example.com");
    expect((emailLogInserts[0] as any).provider).toBe("cloudflare-email");
  });
});
