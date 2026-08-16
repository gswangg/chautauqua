// DEC-713 (wave 21, amended wave 67): a failed anonymous CFP submit must not
// orphan a CRM contact row. When the DB-write phase throws, the handler must
// delete a contact row THIS REQUEST minted (contactIsFresh) using
// deleteContact, but must NEVER touch a pre-existing contact.
//
// Reuses the fake-db/fake-bucket harness from
// test/public-submit-rollback-order.test.ts.

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
  const inserts: { table: unknown; vals: any }[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        inserts.push({ table, vals });
        return {
          then: (resolve: (v: unknown) => unknown) => Promise.resolve().then(resolve),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
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
  const bucket = {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
  return { bucket };
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
  vi.doUnmock("../src/server/repo/contacts/crud");
  vi.resetModules();
});

describe("public submit rollback deletes a freshly-minted contact (DEC-713, wave 67)", () => {
  it("deletes the contact this request minted when no contact previously existed, and surfaces the original error", async () => {
    const deleteContactSpy = vi.fn(async (_db: unknown, _contactId: string) => {});

    vi.doMock("../src/server/repo/contacts/crud", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts/crud")>(
        "../src/server/repo/contacts/crud",
      );
      return { ...actual, deleteContact: deleteContactSpy };
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
    // selectQueue: event, form, fields, tracks, findContactByEmail (empty =
    // no existing contact -> contactIsFresh), submission seq subquery, ...
    const { db, inserts } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 1 }], []]);
    const { bucket } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const email = "nobody-yet@example.com";
    const req = submitForm(email);
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    // Original failure still surfaces loudly.
    expect(res.status).toBe(500);

    // createContact minted exactly one contact insert for this email --
    // capture its generated id and confirm deleteContact was called with
    // that same id (i.e. the row this request created, not some other row).
    const contactInsert = inserts.find((i) => i.vals?.email === email);
    expect(contactInsert).toBeDefined();
    expect(deleteContactSpy).toHaveBeenCalledTimes(1);
    expect(deleteContactSpy).toHaveBeenCalledWith(expect.anything(), contactInsert!.vals.id);
  });

  it("never deletes a pre-existing contact when the same DB-write failure happens for its email", async () => {
    const deleteContactSpy = vi.fn(async (_db: unknown, _contactId: string) => {});

    vi.doMock("../src/server/repo/contacts/crud", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts/crud")>(
        "../src/server/repo/contacts/crud",
      );
      return { ...actual, deleteContact: deleteContactSpy };
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
    const existingContact = { id: "contact-existing-1", title: "Existing Title", company: "Existing Co", bio: "Existing bio" };
    const { db, inserts } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [existingContact], [{ seq: 1 }], []]);
    const { bucket } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const email = "already-here@example.com";
    const req = submitForm(email);
    const res = await app.request(req, undefined, { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(500);
    // No contact insert happened for a pre-existing contact (DEC-814: the
    // route never writes to an existing contact row either).
    expect(inserts.find((i) => i.vals?.email === email)).toBeUndefined();
    // The contact was never a candidate for deletion.
    expect(deleteContactSpy).not.toHaveBeenCalled();
  });
});
