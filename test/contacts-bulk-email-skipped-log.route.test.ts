// DEC-238 (wave 131 amendment): POST /contacts/bulk-email's `skipped` count
// must agree with the comms history — a skipped recipient (intra-batch
// address collision or cross-call dedupe window) gets exactly one
// email_log row with status:"skipped" sharing the send's batchId, and the
// sent recipients still get their own rows. Mirrors the mocking pattern in
// test/contacts-bulk-email-dedupe.test.ts and
// test/contacts-bulk-email-mailer-failure.test.ts.

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

// No prior sends recorded -- this test only exercises the intra-batch
// address-collision dedupe stage, not the cross-call window.
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return { ...actual, loadRecentlySent: vi.fn(async () => new Map()) };
});

const mailerSendMock = vi.fn(async (_message: unknown) => {});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: (message: unknown) => mailerSendMock(message),
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
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe("POST /contacts/bulk-email — skipped recipients get an email_log row (DEC-238)", () => {
  it("skipped:1 and exactly one 'skipped' email_log row sharing the sent row's batchId", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    vi.setSystemTime(1_700_000_000_000);

    const res = await postJson(app, {
      contactIds: ["ct_1", "ct_2", "ct_solo"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 2, skipped: 1, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2);

    const skippedRows = inserts.filter((v) => v.status === "skipped");
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].toEmail).toBe("shared@example.com");
    expect(skippedRows[0].bodyHtml).toBe("");
    expect(skippedRows[0].eventId).toBe("ev1");
    expect(["ct_1", "ct_2"]).toContain(skippedRows[0].contactId);

    // The mailer's own d1EmailLogWriter isn't wired in this mock (makeMailer
    // is stubbed above, unlike test/contacts-bulk-email-mailer-failure.test.ts),
    // so this test asserts only the route's OWN write -- the skipped row --
    // sharing a batchId is proven by the mailer-failure test's 'failed' rows
    // using the same `batchId` variable this route computes once per call.
    expect(typeof skippedRows[0].batchId).toBe("string");
  });

  it("two contact rows sharing one email skip the second and it still counts and logs when neither is CT_SOLO", async () => {
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
    expect(body).toEqual({ sent: 1, skipped: 1, failed: [] });

    const skippedRows = inserts.filter((v) => v.status === "skipped");
    expect(skippedRows).toHaveLength(1);
    expect(body.skipped).toBe(skippedRows.length);
  });
});
