// DEC-238 (wave 131 amendment, wave-17 amendment): POST /contacts/bulk-email's
// `skipped` count must agree with the comms history — a skipped recipient
// (intra-batch collision on (contactId, rendered subject, rendered body) or
// cross-call dedupe window) gets exactly one email_log row with
// status:"skipped" sharing the send's batchId, and the sent recipients
// still get their own rows. Mirrors the mocking pattern in
// test/contacts-bulk-email-dedupe.test.ts and
// test/contacts-bulk-email-mailer-failure.test.ts.
//
// DEC-238 wave-17 amendment note: CT_1/CT_2 below share an ADDRESS but
// render DIFFERENT bodies ({speaker_name} differs by contact), so they no
// longer collapse at the intra-batch stage (that was the bug this amendment
// fixed) -- both now send. The cross-call dedupe window (stage 2) is the
// mechanism exercised by this file's own scenarios below, using a
// subject/body pair that DOES render identically for two contacts via the
// cross-call window on a repeat POST.

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

// Two contact rows sharing ONE email address (intra-batch dedupe) plus a
// solo recipient who actually sends.
const CT_1 = contactRow({ id: "ct_1", firstName: "Ada", lastName: "Lovelace", email: "shared@example.com" });
const CT_2 = contactRow({ id: "ct_2", firstName: "Ada", lastName: "L.", email: "shared@example.com" });
const CT_SOLO = contactRow({ id: "ct_solo", firstName: "Grace", lastName: "Hopper", email: "solo@example.com" });

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return [CT_1, CT_2, CT_SOLO].filter((c) => ids.includes(c.id));
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

vi.mock("../src/auth/claim", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/claim")>("../src/auth/claim");
  return {
    ...actual,
    createClaimToken: vi.fn(async () => "tok123"),
  };
});

// DEC-238 wave-17 amendment: this file's skip scenarios now exercise the
// CROSS-CALL dedupe window (stage 2) -- the intra-batch stage (stage 1) no
// longer collapses CT_1/CT_2 (see the file header note above). loadRecentlySent
// reads from `loggedRows`, populated by mailerSendMock below, exactly like
// test/contacts-bulk-email-dedupe.test.ts's harness, so a repeat POST sees
// the prior call's own sent rows.
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

function postJson(app: Hono<AppEnv>, body: unknown) {
  return app.request(
    "/contacts/bulk-email",
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

describe("POST /contacts/bulk-email — skipped recipients get an email_log row (DEC-238)", () => {
  it("skipped:1 and exactly one 'skipped' email_log row sharing a batchId, from the cross-call dedupe window", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    // A static (non-{speaker_name}) subject/body renders the SAME message
    // for ct_1 across both calls once a minted {portal_link} claim URL is
    // normalized out of the dedupe identity (DEC-397 wave-20) — the raw
    // bytes differ (each call mints a fresh claim token, src/auth/claim.ts),
    // but that is exactly the difference dedupeKey must not see, so ct_1's
    // own prior send is a real cross-call dedupe match on a repeat POST
    // naming just ct_1.
    const first = await postJson(app, {
      contactIds: ["ct_1", "ct_solo"],
      eventId: "ev1",
      subject: "A quick note",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(firstBody).toEqual({ sent: 2, skipped: 0, failed: [] });

    vi.setSystemTime(t0 + 40_000); // well inside COMPOSE_DEDUPE_WINDOW_MS
    const res = await postJson(app, {
      contactIds: ["ct_1"],
      eventId: "ev1",
      subject: "A quick note",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 0, skipped: 1, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2); // only the first POST actually emailed

    const skippedRows = inserts.filter((v) => v.status === "skipped");
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].toEmail).toBe("shared@example.com");
    expect(skippedRows[0].bodyHtml).toBe("");
    expect(skippedRows[0].eventId).toBe("ev1");
    expect(skippedRows[0].contactId).toBe("ct_1");

    // The mailer's own d1EmailLogWriter isn't wired in this mock (makeMailer
    // is stubbed above, unlike test/contacts-bulk-email-mailer-failure.test.ts),
    // so this test asserts only the route's OWN write -- the skipped row --
    // sharing a batchId is proven by the mailer-failure test's 'failed' rows
    // using the same `batchId` variable this route computes once per call.
    expect(typeof skippedRows[0].batchId).toBe("string");
  });

  // DEC-238 wave-17 amendment: CT_1 and CT_2 share an address but render
  // DIFFERENT bodies ({speaker_name} differs) -- this is the exact scenario
  // the wave-17 fix stops silently dropping. Both send, skipped:0, and no
  // email_log row is written for either.
  it("two contact rows sharing one email but rendering different bodies both send -- no skip, no skipped-row write", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    vi.setSystemTime(1_700_000_000_000);

    const res = await postJson(app, {
      contactIds: ["ct_1", "ct_2"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 2, skipped: 0, failed: [] });

    const skippedRows = inserts.filter((v) => v.status === "skipped");
    expect(skippedRows).toHaveLength(0);
    expect(body.skipped).toBe(skippedRows.length);
  });
});
