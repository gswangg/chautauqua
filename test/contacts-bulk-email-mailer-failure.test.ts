// DEC-238 class 2 (organizer-triggered batch): POST /contacts/bulk-email
// must not abort the whole send when one recipient's mailer.send() throws —
// every other recipient still gets sent, and the response reports a
// structured {sent, failed} summary (never a 500). Mirrors the mocking
// pattern in test/contacts-bulk-email-preview-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";
import { listEmailBatches } from "../src/server/repo/email";
import type { Db } from "../src/server/context";

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

const GOOD_CONTACT = contactRow({ id: "ct_good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" });
const BAD_CONTACT = contactRow({ id: "ct_bad", firstName: "Grace", lastName: "Hopper", email: "bad@example.com" });
const BAD_CONTACT_2 = contactRow({ id: "ct_bad2", firstName: "Kay", lastName: "McNulty", email: "bad2@example.com" });
const BAD_CONTACT_3 = contactRow({ id: "ct_bad3", firstName: "Betty", lastName: "Holberton", email: "bad3@example.com" });

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return [GOOD_CONTACT, BAD_CONTACT, BAD_CONTACT_2, BAD_CONTACT_3].filter((c) => ids.includes(c.id));
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

// DEC-238 wave-14 amendment: bulk-email now reads loadRecentlySent before
// sending — this test's fake db has no real D1 to query, so stub the reader
// to report nothing recently sent (this test is not exercising the dedupe
// window; see test/contacts-bulk-email-dedupe.test.ts for that).
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return { ...actual, loadRecentlySent: vi.fn(async () => new Map()) };
});

vi.mock("../src/auth/claim", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/claim")>("../src/auth/claim");
  return {
    ...actual,
    createClaimToken: vi.fn(async () => "tok123"),
  };
});

const mailerSendMock = vi.fn(async (message: { to: string }) => {
  if (message.to.startsWith("bad")) {
    throw new Error("simulated provider rejection");
  }
});
// DEC-923/DEC-996 (amendment wave 57): makeMailer returns a REAL
// EmailBindingMailer over a fake send_email binding + the test's
// insert-recording db, so the mailer is the sole author of the 'failed'
// email_log rows (no route-level duplicate).
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  const { EmailBindingMailer } = await import("../src/mail/email-binding");
  return {
    ...actual,
    makeMailer: vi.fn((db: unknown) => {
      const log = actual.d1EmailLogWriter(db as never);
      const binding = { send: (message: unknown) => mailerSendMock(message as { to: string }) };
      return new EmailBindingMailer(binding, log, { email: "noreply@example.com", name: "Chautauqua" }, (_from, to) => ({ to }));
    }),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");

/** DEC-766: the catch block now also writes a 'failed' email_log row via
 * d1EmailLogWriter, so `db` needs an insert() double even in tests that only
 * care about the response shape. Records every insert() call. */
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

describe("POST /contacts/bulk-email — partial mailer failure (DEC-238 class 2)", () => {
  it("never 500s; sends the good recipient, reports the bad one in 'failed'", async () => {
    const { db } = fakeDbWithInsertLog();
    const app = buildApp(db);
    const res = await postJson(app, "/contacts/bulk-email", {
      contactIds: ["ct_good", "ct_bad"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sent: number;
      failed: { email: string; message: string }[];
      items: unknown[];
    };
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("bad@example.com");
    expect(body.failed[0]?.message).toContain("simulated provider rejection");
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
  });

  // DEC-766: a fully-failed batch still gets one email_log row per attempted
  // recipient, all sharing the batch's one batchId — otherwise the batch is
  // invisible in comms history (a '0 total' send that never happened).
  it("writes a 'failed' email_log row for every recipient when the whole batch is rejected, sharing one batchId", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = buildApp(db);
    const res = await postJson(app, "/contacts/bulk-email", {
      contactIds: ["ct_bad", "ct_bad2", "ct_bad3"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: { email: string }[] };
    expect(body.sent).toBe(0);
    expect(body.failed).toHaveLength(3);

    const failedRows = inserts.filter((v) => v.status === "failed");
    expect(failedRows).toHaveLength(3);
    expect(new Set(failedRows.map((r) => r.batchId)).size).toBe(1);
    expect(failedRows.map((r) => r.toEmail).sort()).toEqual(["bad2@example.com", "bad3@example.com", "bad@example.com"]);
    for (const row of failedRows) {
      expect(row.eventId).toBe("ev1");
      expect(row.provider).toBe("cloudflare");
    }

    // listEmailBatches groups by COALESCE(batch_id, id) with no special
    // casing for status — the 3 'failed' rows just written collapse into
    // one batch row with statusCounts { failed: 3 }, the same way a fully-
    // 'sent' batch does (test/email-log-batches.test.ts).
    const batchId = failedRows[0].batchId as string;
    function fakeQueryDb(responses: unknown[]): Db {
      let cursor = 0;
      function chain(): any {
        const obj: any = {};
        const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
        for (const m of passthrough) obj[m] = () => obj;
        obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
          const value = responses[cursor];
          cursor += 1;
          return Promise.resolve(value).then(resolve, reject);
        };
        return obj;
      }
      return { select: () => chain() } as unknown as Db;
    }

    const queryDb = fakeQueryDb([
      [{ batchKey: batchId, subject: "Hi {speaker_name}", sentAt: failedRows[0].sentAt }],
      [{ count: 1 }],
      [{ batchKey: batchId, status: "failed", n: 3 }],
    ]);
    const result = await listEmailBatches(queryDb, { eventId: "ev1", page: 1, perPage: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.statusCounts).toEqual({ failed: 3 });
  });
});

// DEC-547 amendment (wave 43): makeMailer NEVER throws — it always returns a
// Mailer (DevSinkMailer/EmailBindingMailer/UnconfiguredMailer), reading only the
// pure mailConfigStatus(env) predicate. The wave-50 removal of the dead
// try/catch around makeMailer() in src/routes/api/contacts/bulk-email.ts
// (that block could never fire — see DEC-397's amendment) makes the old
// "makeMailer() itself throws" scenario here untestable-because-impossible;
// that test case is deleted rather than kept asserting unreachable code.
