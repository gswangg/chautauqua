// DEC-098: closes the contact-takeover hole in the public submit
// confirmation. The claim token is always minted and always emailed in
// both no-user cases, but the claim URL is only ever rendered on screen
// when the contact was freshly created by *this* submit request — a
// pre-existing CRM contact's claim link must never be readable by whoever
// typed that contact's email into the public form. Mounts the real
// publicSubmitRoutes sub-app against a minimal fake db that queues
// select() rows in call order and records every insert(), mirroring the
// fakeDb pattern used by test/api-participants.test.ts / test/headshot-gate.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";

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
        // DEC-948: checkAndIncrementScopedLimit chains
        // .onConflictDoUpdate(...).returning(...) off insert().values(...)
        // for its atomic D1 upsert; plain inserts elsewhere in this route
        // still just await the values() call directly (thenable below). A
        // minimal always-under-cap fake is enough since this test doesn't
        // assert on rate-limit state.
        return {
          then: (resolve: (v: undefined) => void) => resolve(undefined),
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
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

/** Standard select() queue for a successful submit: getEventBySlug,
 * getDefaultForm, getFormFields, getEventTracks, findContactByEmail,
 * nextSubmissionSeq (inside createSubmission), findAccountUserId. */
function selectQueueFor(contactRow: unknown[], userRow: unknown[]) {
  return [
    [EVENT_ROW],
    [FORM_ROW],
    FIELD_ROWS,
    [TRACK_ROW],
    contactRow,
    // Answers createSubmission's post-insert readback, which selects
    // `{ seq: schema.submission.seq }` (src/server/repo/submit.ts) — the
    // key here must be `seq` to match that shape (previously `maxSeq`,
    // which silently returned `undefined` for `submission.seq` since
    // nothing read that field until DEC-862 added the confirmation ref).
    [{ seq: 14 }],
    userRow,
  ];
}

async function run(db: AppEnv["Variables"]["db"], email: string) {
  const app = appWithDb(db);
  const res = await app.request(submitForm(email), undefined, {
    KV: fakeKv(),
    FILES: {} as unknown,
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"]);
  return res;
}

describe("public submit confirmation (DEC-098 claim-link scope)", () => {
  it("fresh contact + no user: renders the /claim/ link on screen (byte-compatible with walkthrough scrapers)", async () => {
    const { db, inserts } = fakeDb(selectQueueFor([], []));
    const res = await run(db, "fresh@example.com");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/href="[^"]*\/claim\/[^"]+"/);

    const emailInsert = inserts.find((v) => typeof v === "object" && v !== null && "toEmail" in v);
    expect(emailInsert).toBeTruthy();
    expect((emailInsert as any).bodyHtml).toMatch(/\/claim\//);
  });

  // DEC-252: the on-page href is relative (never depends on origin
  // inference — under `wrangler dev` with wrangler.jsonc's production
  // `routes`/`custom_domain` entry, an absolute href built from the naive
  // `new URL(c.req.url).origin` would point at the live deployment). Only
  // the emailed copy is an absolute, resolveBaseUrl-derived URL.
  it("fresh contact + no user: the on-page claim href is relative (same-origin), while the emailed link is absolute", async () => {
    const { db, inserts } = fakeDb(selectQueueFor([], []));
    const res = await run(db, "fresh2@example.com");
    const html = await res.text();
    const match = html.match(/href="([^"]*\/claim\/[^"]+)"/);
    expect(match).toBeTruthy();
    expect(match![1]).toMatch(/^\/claim\//);
    expect(match![1]).not.toMatch(/^https?:\/\//);

    const emailInsert = inserts.find((v) => typeof v === "object" && v !== null && "toEmail" in v);
    expect((emailInsert as any).bodyHtml).toMatch(/href="https?:\/\/[^"]*\/claim\//);
  });

  it("pre-existing contact + no user: NO claim URL anywhere in the response HTML, but the emailed content DOES contain it", async () => {
    const { db, inserts } = fakeDb(selectQueueFor([{ id: "existing-contact-1" }], []));
    const res = await run(db, "existing@example.com");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("/claim/");
    // No claim link -> copy instead points at the emailed link + /login.
    expect(html).toContain("/login");
    expect(html).toMatch(/emailed/i);

    const emailInsert = inserts.find((v) => typeof v === "object" && v !== null && "toEmail" in v);
    expect(emailInsert).toBeTruthy();
    expect((emailInsert as any).bodyHtml).toMatch(/\/claim\//);
    expect((emailInsert as any).bodyText).toMatch(/\/claim\//);

    // No contact insert should have happened (the contact already existed).
    const contactInsert = inserts.find((v) => typeof v === "object" && v !== null && "firstName" in v);
    expect(contactInsert).toBeUndefined();
  });

  it("existing user: links /login, no claim URL", async () => {
    // Full (id, contactId, email) user row: findAccountUserIds' map build
    // reads all three (DEC-456 wave-71 amendment).
    const { db, inserts } = fakeDb(
      selectQueueFor([{ id: "existing-contact-1" }], [{ id: "user-1", contactId: "existing-contact-1", email: "hasaccount@example.com" }]),
    );
    const res = await run(db, "hasaccount@example.com");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("/claim/");
    expect(html).toContain('href="/login"');

    const emailInsert = inserts.find((v) => typeof v === "object" && v !== null && "toEmail" in v);
    expect(emailInsert).toBeTruthy();
    // existingUser -> claimUrl stays the /login default, never a claim URL.
    expect((emailInsert as any).bodyHtml).not.toMatch(/\/claim\//);
  });
});
