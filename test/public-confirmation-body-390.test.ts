// w33-a (DEC-908 wave-33 amendment): the CFP confirmation body is one
// sentence PER ConfirmationState, built on the emailDelivered branch only --
// Chautauqua Public and Portal.dc.html:1083 (fresh), :1132
// (pending-existing-contact), :1155 (has-account). Real `app.request()`
// POSTs to /submit/:eventSlug drive all three states end to end, reusing
// the fakeDb/fakeKv/appWithDb harness test/cfp-confirmation-email-honesty.test.ts
// already built for this exact route (itself borrowed from
// test/submit-mailer-failure.test.ts), mirroring the vi.mock+buildApp idiom
// test/portal-page-headings.test.ts uses for portal routes.
//
// This closes §4 of docs/design/audit/public-submitted-390-v12.md (recorded
// in docs/design/audit/public-confirmation-body-390-v12.md; that file lives
// on unmerged branch v12m-w30-a and is not edited here).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";

// `cloudflare:email` only exists inside workerd -- stub the ambient module
// so the lazy dynamic import in server/context.ts resolves the same way it
// would there, exactly as cfp-confirmation-email-honesty.test.ts does.
vi.mock("cloudflare:email", () => ({
  EmailMessage: class {
    constructor(
      public from: string,
      public to: string,
      public raw: string,
    ) {}
  },
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Mirrors MergePage.frame390.render.test.tsx's
 * own `verbatimLine` (git show v12m-w29-a:app/src/pages/contacts/MergePage.frame390.render.test.tsx). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

describe("v12 frame citations for the three CFP confirmation bodies (DEC-908 wave-33 amendment)", () => {
  it("fresh: Chautauqua Public and Portal.dc.html:1083", () => {
    verbatimLine(
      1083,
      '        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed priya@example.com a portal link. You can edit this talk until 16 Aug.</span>',
    );
  });

  it("pending-existing-contact (email already known): Chautauqua Public and Portal.dc.html:1132", () => {
    verbatimLine(
      1132,
      '        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed dana@example.com a confirmation, with a link to set a password.</span>',
    );
  });

  it("has-account: Chautauqua Public and Portal.dc.html:1155", () => {
    verbatimLine(
      1155,
      '        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed marcus@example.com a confirmation.</span>',
    );
  });
});

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

const FORM_ROW_WITH_CLOSE = { ...FORM_ROW, closeDate: new Date(Date.UTC(2026, 11, 1)) };

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
];

const EXISTING_CONTACT_ROW = { id: "contact-existing", title: null, company: null, bio: null };

const EXISTING_USER_ROW = { id: "user-1", contactId: "contact-existing", email: "speaker@example.com" };

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
      values: (vals: unknown) => ({
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

function submitForm() {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", "speaker@example.com");
  form.append("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

const commonBindings = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  PUBLIC_BASE_URL: "https://events.example.com",
} as const;

async function postAndRenderHtml(selectQueue: unknown[][]): Promise<string> {
  const app = appWithDb(fakeDb(selectQueue));
  const res = await app.request(submitForm(), undefined, {
    KV: fakeKv(),
    FILES: fakeFilesBucket(),
    EMAIL: { send: vi.fn(async () => {}) },
    ...commonBindings,
  } as unknown as AppEnv["Bindings"]);
  expect(res.status).toBe(200);
  return res.text();
}

// select() call order (mirrors cfp-confirmation-email-honesty.test.ts's
// selectQueueFor): getEventBySlug, getDefaultForm, getFormFields,
// getEventTracks, findContactByEmail, createSubmission's seq lookup,
// findAccountUserIds.
function selectQueueFresh(form: unknown = FORM_ROW) {
  return [[EVENT_ROW], [form], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 7 }], []];
}

function selectQueuePendingExistingContact() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [EXISTING_CONTACT_ROW], [{ seq: 7 }], []];
}

function selectQueueHasAccount() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [EXISTING_CONTACT_ROW], [{ seq: 7 }], [EXISTING_USER_ROW]];
}

describe("CFP confirmation body: one sentence per ConfirmationState, real /submit/:eventSlug POST (DEC-908 wave-33 amendment)", () => {
  it("fresh (brand-new contact): 'We emailed <email> a portal link. You can edit this talk until <date>.'", async () => {
    const html = await postAndRenderHtml(selectQueueFresh(FORM_ROW_WITH_CLOSE));
    expect(html).toContain("We emailed speaker@example.com a portal link. You can edit this talk until");
  });

  it("fresh with a null closeDate: renders ONLY the first sentence -- no date is invented", async () => {
    const html = await postAndRenderHtml(selectQueueFresh(FORM_ROW));
    expect(html).toContain("We emailed speaker@example.com a portal link.");
    expect(html).not.toContain("You can edit this talk until");
  });

  it("pending-existing-contact: 'We emailed <email> a confirmation, with a link to set a password.'", async () => {
    const html = await postAndRenderHtml(selectQueuePendingExistingContact());
    expect(html).toContain("We emailed speaker@example.com a confirmation, with a link to set a password.");
  });

  it("has-account: 'We emailed <email> a confirmation.' (no trailing clause)", async () => {
    const html = await postAndRenderHtml(selectQueueHasAccount());
    expect(html).toContain("We emailed speaker@example.com a confirmation.");
    expect(html).not.toContain("a confirmation, with a link");
  });

  it("the retired generic body sentence never renders, on any state", async () => {
    for (const queue of [selectQueueFresh(FORM_ROW_WITH_CLOSE), selectQueuePendingExistingContact(), selectQueueHasAccount()]) {
      const html = await postAndRenderHtml(queue);
      expect(html).not.toContain("emailed a confirmation for");
    }
  });

  it("the retired duplicate 'That email includes a link to set a password.' paragraph never renders", async () => {
    const html = await postAndRenderHtml(selectQueuePendingExistingContact());
    expect(html).not.toContain("That email includes a link to set a password.");
  });

  it("nothing renders between the H1 and the confirmation card (the close-date paragraph above the card is deleted)", async () => {
    const html = await postAndRenderHtml(selectQueueFresh(FORM_ROW_WITH_CLOSE));
    const afterH1 = html.split(/<\/h1>/)[1] ?? "";
    const beforeCard = afterH1.split('class="chq-cfp-confirm-card"')[0] ?? "";
    expect(beforeCard).not.toContain("<p");
  });

  it("'Already have a password? Log in ›' paragraph survives untouched in the pending-existing-contact branch", async () => {
    const html = await postAndRenderHtml(selectQueuePendingExistingContact());
    expect(html).toContain("Already have a password?");
    expect(html).toMatch(/<a href="\/login">Log in/);
  });
});
