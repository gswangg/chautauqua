// DEC-238 wave-17 amendment: POST /contacts/bulk-email/preview must run the
// SAME planBulkEmailSends dedupe plan (over the WHOLE recipient set, not
// just the capped items list) that POST /contacts/bulk-email is about to
// run, so a subsequent send can never contradict what preview promised.
// This is the identical divergence DEC-238 wave-60 closed for
// src/routes/comms/preview.ts, closed here for the CRM bulk path. Mirrors
// test/contacts-bulk-email-dedupe.test.ts's loggedRows-backed
// repo.loadRecentlySent mock and test/contacts-bulk-email-preview-route.
// test.ts's contact/event mocking.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";
import { dedupeKey } from "../src/domain/comms-dedupe";

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

// 7 solo-address contacts -- more than BULK_EMAIL_PREVIEW_LIMIT (5), so the
// preview response's `items` array is capped while `willSend`/`skipped`
// must still cover the WHOLE batch.
const ALL_CONTACTS: ContactRow[] = Array.from({ length: 7 }, (_, i) =>
  contactRow({ id: `ct_${i + 1}`, firstName: `Speaker${i + 1}`, lastName: "Test" }),
);

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return ALL_CONTACTS.filter((c) => ids.includes(c.id));
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
      orgId === "org1" && eventId === "ev1" ? { id: "ev1", name: "DevCon", startDate: "2027-03-01", endDate: "2027-03-03", location: "Moscone West, San Francisco" } : null,
    ),
  };
});

vi.mock("../src/auth/claim", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/claim")>("../src/auth/claim");
  return { ...actual, createClaimToken: vi.fn(async () => "tok123") };
});

// Stand-in email_log rows -- the mocked repo.loadRecentlySent reader below
// reads from this array, so preview and a following send see the SAME
// snapshot a real D1-backed reader would.
let loggedRows: { eventId: string; toEmail: string; subject: string; bodyText: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(
      async (_db: unknown, eventId: string, keys: { email: string; subject: string; body: string }[], cutoffMs: number) => {
        const map = new Map<string, number>();
        // DEC-397 (this wave's amendment): mirror the REAL reader
        // (src/server/repo/comms.ts loadRecentlySent) exactly -- build the
        // wanted set through dedupeKey and match each row's own dedupeKey
        // against it. A hand-rolled field-by-field comparison here would
        // bypass dedupeKey's claim-link normalization and so make this
        // double disagree with production about who is already-sent.
        const wantedKeys = new Set(keys.map((k) => dedupeKey(k.email, k.subject, k.body)));
        for (const row of loggedRows) {
          if (row.eventId !== eventId) continue;
          if (row.sentAt < cutoffMs) continue;
          const key = dedupeKey(row.toEmail, row.subject, row.bodyText);
          if (!wantedKeys.has(key)) continue;
          const existing = map.get(key);
          if (existing === undefined || row.sentAt > existing) map.set(key, row.sentAt);
        }
        return map;
      },
    ),
  };
});

const mailerSendMock = vi.fn(async (message: { to: { email: string }; subject: string; text: string }) => {
  loggedRows.push({
    eventId: "ev1",
    toEmail: message.to.email,
    subject: message.subject,
    bodyText: message.text,
    sentAt: Date.now(),
  });
});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: (message: unknown) => mailerSendMock(message as { to: { email: string }; subject: string; text: string }),
    })),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");

function fakeDbWithInsertLog() {
  const inserts: any[] = [];
  const db = { insert: () => ({ values: async (vals: unknown) => { inserts.push(vals); } }) };
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

function postJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: {}, PUBLIC_BASE_URL: "https://events.example.com" },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  loggedRows = [];
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe("preview vs send agreement (DEC-238 wave-17 amendment)", () => {
  it("preview's willSend/skipped for the WHOLE batch equal what a subsequent send reports, with items capped", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    // Prime the cross-call dedupe window: ct_1 already has a "recent" send
    // for this exact subject, so both preview and send must report it
    // skipped, not counted toward willSend.
    loggedRows.push({
      eventId: "ev1",
      toEmail: "ct_1@example.com",
      subject: "Hi all",
      // DEC-936 wave-17 widened the cross-call key to (email, subject,
      // body), so the primed row must carry the body the planner keys on.
      // email_log stores what was actually SHIPPED, so this row is the
      // RENDERED body -- {event_name} -> "DevCon", {portal_link} -> the
      // claim URL a PRIOR call minted for ct_1. planBulkEmailSends keys the
      // current call on the UNMINTED preflight render (DEC-397 wave-50/62,
      // portal_link = .../claim/example-one-time-link), so the two bodies
      // are deliberately NOT byte-equal: dedupeKey's normalizeMintedClaimLinks
      // (DEC-397 this wave) is the single owner that collapses both
      // /claim/<token> paths to one placeholder and lets the window match.
      // The token below is a plausible base64url mint, deliberately NOT the
      // "tok123" this file's createClaimToken mock returns -- a stale mint
      // from an earlier call is exactly the case the window must catch.
      bodyText: "See you at DevCon: https://events.example.com/claim/hK3q_lZ8vN-Ta1BxQe7Ry0dGmS4pC2wJ",
      sentAt: t0 - 1_000,
    });

    const contactIds = ALL_CONTACTS.map((c) => c.id); // 7 contacts

    const previewRes = await postJson(app, "/contacts/bulk-email/preview", {
      contactIds,
      eventId: "ev1",
      subject: "Hi all",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(previewRes.status).toBe(200);
    const previewBody = (await previewRes.json()) as { items: unknown[]; willSend: number; skipped: number };

    // items stays capped at BULK_EMAIL_PREVIEW_LIMIT (5) even though the
    // batch has 7 recipients.
    expect(previewBody.items).toHaveLength(5);
    // willSend/skipped cover the WHOLE 7-recipient batch: ct_1 is the one
    // already-recently-sent skip, the other 6 will send.
    expect(previewBody).toMatchObject({ willSend: 6, skipped: 1 });

    // Preview must mint nothing (DEC-397) and write no email_log row.
    expect(inserts).toHaveLength(0);

    const sendRes = await postJson(app, "/contacts/bulk-email", {
      contactIds,
      eventId: "ev1",
      subject: "Hi all",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(sendRes.status).toBe(200);
    const sendBody = (await sendRes.json()) as { sent: number; skipped: number; failed: unknown[] };

    // Preview and send can never disagree.
    expect(sendBody.sent).toBe(previewBody.willSend);
    expect(sendBody.skipped).toBe(previewBody.skipped);
    expect(sendBody).toEqual({ sent: 6, skipped: 1, failed: [] });
  });
});
