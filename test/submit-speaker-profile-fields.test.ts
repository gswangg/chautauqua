// DEC-321: the default CFP collects job_title/company/bio (appended,
// optional, to LOCKED_SPEAKER_FIELDS) so J10's public speakers list isn't
// blank for real submitters. A fresh submitter's values land on the new
// contact row and are snapshotted onto the participant
// (titleAtTime/orgAtTime); omitting all three still succeeds since they're
// optional.
//
// DEC-814 supersedes DEC-321(b): an anonymous submission that matches an
// existing contact by email NEVER writes to that contact row (no more
// fill-if-blank). The submitted job title/company are snapshotted only onto
// the participant's titleAtTime/orgAtTime, falling back to the contact's
// stored values when the submitter left a field blank; the bio remains only
// a submission answer and the contact row — including its bio — stays
// byte-identical.
//
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db that
// queues select() rows in call order and records every insert()/update()
// write, mirroring the fakeDb pattern in test/submit-mailer-failure.test.ts.

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

// Matches the appended LOCKED_SPEAKER_FIELDS (job_title/company/bio),
// required: false per DEC-321(a).
const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "job_title", section: "speaker", kind: "text", label: "Job title", helpText: null, required: false, position: 5, optionsJson: null, ruleJson: null },
  { id: "company", section: "speaker", kind: "text", label: "Company", helpText: null, required: false, position: 6, optionsJson: null, ruleJson: null },
  { id: "bio", section: "speaker", kind: "long_text", label: "Speaker bio", helpText: null, required: false, position: 7, optionsJson: null, ruleJson: null },
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
 * records every insert()/update() write. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const updates: any[] = [];
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
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push(vals);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, updates };
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
  // DEV_MODE selects the dev-sink Mailer (src/server/context.ts) so no
  // EMAIL binding is needed.
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

function submitForm(fields: Record<string, string>) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("field__first_name", "Ada");
  form.set("field__last_name", "Lovelace");
  form.set("field__email", "ada@example.com");
  for (const [k, v] of Object.entries(fields)) {
    form.set(`field__${k}`, v);
  }
  form.set("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

/** select() queue for a fresh-contact submit: getEventBySlug, getDefaultForm,
 * getFormFields, getEventTracks, findContactByEmail (none), nextSubmissionSeq
 * (inside createSubmission), findAccountUserId. */
function selectQueueFresh() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ maxSeq: 0 }], []];
}

/** Same shape, but findContactByEmail resolves an existing contact row. */
function selectQueueExisting(existingContact: { id: string; title: string | null; company: string | null; bio: string | null }) {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [existingContact], [{ maxSeq: 1 }], []];
}

describe("public CFP submit collects job_title/company/bio (DEC-321, DEC-814)", () => {
  it("a fresh submitter's profile fields land on the contact and are snapshotted onto the participant", async () => {
    const { db, inserts } = fakeDb(selectQueueFresh());
    const app = appWithDb(db);
    const req = submitForm({ job_title: "Staff Engineer", company: "Acme Corp", bio: "Builds things." });

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);

    const contactInsert = inserts.find((v) => typeof v === "object" && v !== null && "firstName" in v);
    expect(contactInsert).toBeTruthy();
    expect((contactInsert as any).title).toBe("Staff Engineer");
    expect((contactInsert as any).company).toBe("Acme Corp");
    expect((contactInsert as any).bio).toBe("Builds things.");

    const participantInsert = inserts.find((v) => typeof v === "object" && v !== null && "submissionId" in v);
    expect(participantInsert).toBeTruthy();
    expect((participantInsert as any).titleAtTime).toBe("Staff Engineer");
    expect((participantInsert as any).orgAtTime).toBe("Acme Corp");
  });

  it("(DEC-814) a known email leaves the contact byte-identical while the participant carries the submitted values", async () => {
    const existingContact = { id: "contact-1", title: "Principal Engineer", company: "OldCo", bio: "Old bio." };
    const { db, inserts, updates } = fakeDb(selectQueueExisting(existingContact));
    const app = appWithDb(db);
    const req = submitForm({ job_title: "Someone Else's Title", company: "NewCo", bio: "New bio." });

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);

    // DEC-814: an anonymous submission never writes to an existing contact,
    // regardless of what was submitted — no update statement at all.
    expect(updates).toHaveLength(0);

    // No new contact row is created for a repeat submitter either.
    const contactInsert = inserts.find((v) => typeof v === "object" && v !== null && "firstName" in v);
    expect(contactInsert).toBeFalsy();

    // The participant snapshot carries the submitted title/company (DEC-258),
    // not the contact's stored values — but the contact row (and its bio)
    // stays byte-identical to what it was before this submission.
    const participantInsert = inserts.find((v) => typeof v === "object" && v !== null && "submissionId" in v);
    expect(participantInsert).toBeTruthy();
    expect((participantInsert as any).titleAtTime).toBe("Someone Else's Title");
    expect((participantInsert as any).orgAtTime).toBe("NewCo");
    expect(existingContact.title).toBe("Principal Engineer");
    expect(existingContact.company).toBe("OldCo");
    expect(existingContact.bio).toBe("Old bio.");
  });

  it("(DEC-814) a known email with blank submitted fields falls back to the contact's stored values on the participant, without touching the contact", async () => {
    const existingContact = { id: "contact-1", title: "Principal Engineer", company: "OldCo", bio: "Old bio." };
    const { db, inserts, updates } = fakeDb(selectQueueExisting(existingContact));
    const app = appWithDb(db);
    const req = submitForm({});

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);

    expect(updates).toHaveLength(0);

    const participantInsert = inserts.find((v) => typeof v === "object" && v !== null && "submissionId" in v);
    expect((participantInsert as any).titleAtTime).toBe("Principal Engineer");
    expect((participantInsert as any).orgAtTime).toBe("OldCo");
  });

  it("omitting all three profile fields still succeeds (required: false)", async () => {
    const { db, inserts } = fakeDb(selectQueueFresh());
    const app = appWithDb(db);
    const req = submitForm({});

    const res = await app.request(req, undefined, { ...BINDINGS, KV: fakeKv(), FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Thanks for your submission!");

    const contactInsert = inserts.find((v) => typeof v === "object" && v !== null && "firstName" in v);
    expect((contactInsert as any).title).toBeNull();
    expect((contactInsert as any).company).toBeNull();
    expect((contactInsert as any).bio).toBeNull();

    const participantInsert = inserts.find((v) => typeof v === "object" && v !== null && "submissionId" in v);
    expect((participantInsert as any).titleAtTime).toBeNull();
    expect((participantInsert as any).orgAtTime).toBeNull();
  });
});
