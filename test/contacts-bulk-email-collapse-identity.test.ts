// DEC-238 wave-17 amendment (CRM bulk-email — collapse identity is the
// CONTACT, and preview counts what send will do): route-level coverage for
// the two defects the amendment fixes.
//
// (a) POST /contacts/bulk-email's intra-batch collapse was keyed on the
//     rendered (trimmed, lower-cased) address. contact.email carries only a
//     NON-UNIQUE index (src/db/schema/org.ts) — two distinct contact rows
//     can share one address (duplicate-merge's exact target state, reached
//     through src/server/repo/import/sessionboard.ts's externalRef-keyed
//     create). The second contact never got their own {portal_link} claim
//     and was written to email_log as status:'skipped'. Fixed: the key is
//     now (contactId, rendered subject, rendered body) — since contactIds
//     are already deduped upstream (parseBoundedIdArray), two DIFFERENT
//     contacts never collapse into one send.
//
// (b) POST /contacts/bulk-email/preview rendered only the first
//     BULK_EMAIL_PREVIEW_LIMIT contacts and returned `{ items }` only — it
//     never ran the two-stage dedupe planner, so its implied count could
//     disagree with what the send then actually did. Fixed: preview now
//     renders the WHOLE batch, runs the SAME planBulkEmailSends the send
//     runs, and returns willSend/skipped for the full batch alongside the
//     still-capped `items` — while remaining side-effect-free (zero KV
//     mints, zero email_log writes).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";

function contactRow(overrides: Partial<ContactRow> & { id: string }): ContactRow {
  return {
    orgId: "org1",
    firstName: "First",
    lastName: "Last",
    email: `${overrides.id}@example.com`,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// Two contact rows sharing ONE email address (duplicate-merge's exact
// target state) — a real name each, so their rendered {speaker_name} (and
// therefore body) differ even before {portal_link} is considered.
const CT_1 = contactRow({ id: "ct_1", firstName: "Ada", lastName: "Lovelace", email: "shared@example.com" });
const CT_2 = contactRow({ id: "ct_2", firstName: "Grace", lastName: "Hopper", email: "shared@example.com" });

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return [CT_1, CT_2].filter((c) => ids.includes(c.id));
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: (...args: Parameters<typeof findContactsForOrgMock>) => findContactsForOrgMock(...args),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      orgId === "org1" && eventId === "ev1" ? { id: "ev1", name: "DevCon" } : null,
    ),
  };
});

// No prior sends recorded -- these tests exercise the intra-batch stage and
// the preview/send parity, not the cross-call window (see
// test/contacts-bulk-email-dedupe.test.ts for that).
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return { ...actual, loadRecentlySent: vi.fn(async () => new Map()) };
});

const mailerSendMock = vi.fn(async (_message: unknown) => {});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: (message: unknown) => mailerSendMock(message) })),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");

function fakeDbWithInsertLog() {
  const inserts: unknown[] = [];
  const db = {
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
  };
  return { db: db as never, inserts };
}

function buildApp(db: never) {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", contactsRoutes);
  return app;
}

/** A fake KV that records every put() so a test can assert "zero mints". */
function countingKv() {
  const puts: unknown[] = [];
  return { kv: { put: (...args: unknown[]) => puts.push(args), get: () => null, delete: () => {} }, puts };
}

function postJson(app: Hono<AppEnv>, path: string, body: unknown, kv: unknown) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: kv, PUBLIC_BASE_URL: "https://events.example.com" },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

const REQUEST_BODY = {
  contactIds: ["ct_1", "ct_2"],
  eventId: "ev1",
  subject: "Hi {speaker_name}",
  bodyText: "See you at {event_name}: {portal_link}",
};

describe("POST /contacts/bulk-email — collapse identity is the contact, not the address (DEC-238 wave-17 amendment)", () => {
  it("two contacts sharing one address with {portal_link} in the body — BOTH send, skipped===0", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    const { kv } = countingKv();
    vi.setSystemTime(1_700_000_000_000);

    const res = await postJson(app, "/contacts/bulk-email", REQUEST_BODY, kv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 2, skipped: 0, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
    expect(inserts.filter((v: any) => v.status === "skipped")).toHaveLength(0); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
});

describe("POST /contacts/bulk-email/preview — willSend/skipped match the send for the same inputs (DEC-238 wave-17 amendment)", () => {
  it("preview's willSend/skipped equal what the send then reports", async () => {
    const previewApp = buildApp(fakeDbWithInsertLog().db);
    const { kv: previewKv } = countingKv();

    const previewRes = await postJson(previewApp, "/contacts/bulk-email/preview", REQUEST_BODY, previewKv);
    expect(previewRes.status).toBe(200);
    const previewBody = (await previewRes.json()) as { items: unknown[]; willSend: number; skipped: number };
    expect(previewBody.willSend).toBe(2);
    expect(previewBody.skipped).toBe(0);

    const { db: sendDb } = fakeDbWithInsertLog();
    const sendApp = buildApp(sendDb);
    const { kv: sendKv } = countingKv();
    const sendRes = await postJson(sendApp, "/contacts/bulk-email", REQUEST_BODY, sendKv);
    expect(sendRes.status).toBe(200);
    const sendBody = (await sendRes.json()) as { sent: number; skipped: number };

    expect(previewBody.willSend).toBe(sendBody.sent);
    expect(previewBody.skipped).toBe(sendBody.skipped);
  });

  it("preview writes no email_log row and mints no claim token", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    const { kv, puts } = countingKv();

    const res = await postJson(app, "/contacts/bulk-email/preview", REQUEST_BODY, kv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { bodyText: string }[]; willSend: number; skipped: number };
    expect(body.willSend).toBe(2);
    expect(body.skipped).toBe(0);
    expect(body.items).toHaveLength(2);
    // DEC-397: preview never mints -- the fixed placeholder token renders.
    for (const item of body.items) {
      expect(item.bodyText).toContain("/claim/example-one-time-link");
    }
    expect(puts).toHaveLength(0);
    expect(mailerSendMock).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });
});
