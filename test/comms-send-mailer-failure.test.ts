// DEC-238 class 2 (organizer-triggered batch): a bad recipient in a compose
// send must not abort the whole batch or surface a 500 — every other
// recipient still gets sent, and the response reports a structured
// {sent, failed} summary instead. Mirrors the mocking pattern in
// test/compose-full-set.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const event = {
  id: "evt-1",
  orgId: ORG_A,
  name: "DevCon",
  slug: "devcon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  recordPrefix: "DEV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

const existingSubmissions = [
  {
    id: "sub-good",
    title: "On Engines",
    participants: [{ contactId: "ct-good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" }],
  },
  {
    id: "sub-bad",
    title: "On Failure",
    participants: [{ contactId: "ct-bad", firstName: "Grace", lastName: "Hopper", email: "bad@example.com" }],
  },
];

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async () => event),
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => existingSubmissions),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
  };
});

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; text: string }) => {
        if (mail.to.email === "bad@example.com") {
          throw new Error("simulated provider rejection");
        }
        sentMails.push(mail);
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
}

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

async function buildCommsApp(db: never) {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", db);
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

function composeBody(submissionIds: string[]) {
  return JSON.stringify({
    submissionIds,
    subject: "Update on {talk_title}",
    bodyText: "Hi {speaker_name}, see {portal_link}.",
  });
}

describe("POST /api/v1/events/:eventId/compose/send — partial mailer failure (DEC-238 class 2)", () => {
  it("never 500s; sends the good recipient, reports the bad one in 'failed'", async () => {
    const { db } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-good", "sub-bad"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]?.to.email).toBe("good@example.com");

    const body = (await res.json()) as {
      sent: number;
      failed: { email: string; message: string }[];
      items: unknown[];
    };
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("bad@example.com");
    expect(body.failed[0]?.message).toContain("simulated provider rejection");
  });

  // DEC-766: a rejected send still gets an email_log row, so a fully-failed
  // batch is visible in comms history instead of reading as '0 total'. The
  // sole 'sub-bad' recipient in this fixture's failure lands here too — see
  // test/comms-failed-send-audit.test.ts for the multi-recipient/all-fail
  // case (a dedicated fixture, since this file's loadComposeSubmissions mock
  // ignores submissionIds and always returns both fixtures).
  it("writes a 'failed' email_log row for the recipient the mailer rejects", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-good", "sub-bad"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: { email: string }[] };
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);

    const failedRows = inserts.filter((v) => v.status === "failed");
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].toEmail).toBe("bad@example.com");
    expect(failedRows[0].eventId).toBe("evt-1");
    expect(failedRows[0].contactId).toBe("ct-bad");
    expect(typeof failedRows[0].batchId).toBe("string");
    expect(failedRows[0].batchId.length).toBeGreaterThan(0);

    // No row for the recipient that succeeded.
    expect(inserts.some((v) => v.toEmail === "good@example.com")).toBe(false);
  });
});
