// DEC-766: every send ATTEMPT writes an email_log row; failure is a status,
// not an absence. Isolated from test/comms-send-mailer-failure.test.ts
// because that file's loadComposeSubmissions mock always returns both its
// fixtures regardless of submissionIds — this file's fixture is entirely
// bad recipients, so the whole batch fails and every attempted row must
// still land in email_log sharing one batchId (a '0 total' history for a
// batch that never wrote a row is exactly the gap DEC-766 closes).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { listEmailBatches } from "../src/server/repo/email";
import type { Db } from "../src/server/context";

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

// Every recipient in this fixture is doomed — the point of this test is a
// batch that's entirely rejected.
const allBadSubmissions = [
  {
    id: "sub-bad-1",
    title: "On Failure 1",
    seq: 1,
    participants: [{ contactId: "ct-bad-1", firstName: "Grace", lastName: "Hopper", email: "bad1@example.com" }],
  },
  {
    id: "sub-bad-2",
    title: "On Failure 2",
    seq: 2,
    participants: [{ contactId: "ct-bad-2", firstName: "Kay", lastName: "McNulty", email: "bad2@example.com" }],
  },
  {
    id: "sub-bad-3",
    title: "On Failure 3",
    seq: 3,
    participants: [{ contactId: "ct-bad-3", firstName: "Betty", lastName: "Holberton", email: "bad3@example.com" }],
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
    loadComposeSubmissions: vi.fn(async () => allBadSubmissions),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    // DEC-912: buildRenderTargets now unconditionally loads schedule data
    // for `scheduled` — unrelated to this file's failed-send-audit scope.
    loadIcsScheduleData: vi.fn(async () => new Map()),
    // DEC-238 wave-3 amendment: this file's fakeDb has no .select() —
    // stubbed so the new dedupe-partition read (unrelated to this file's
    // failed-send-audit scope) doesn't 500 before reaching the mailer.
    loadRecentlySent: vi.fn(async () => new Map()),
  };
});

// DEC-792: stub the batched outstanding-task lookup used by buildRenderTargets
// for {task_list}/{due_date}.
vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

// DEC-923/DEC-996 (amendment wave 57): makeMailer must return a REAL
// EmailBindingMailer (over a throwing send_email binding and the test's own
// insert-recording db) so this test proves the mailer is the SOLE author of
// the 3 'failed' rows — not a route-level logFailedSend duplicate.
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  const { EmailBindingMailer } = await import("../src/mail/email-binding");
  return {
    ...actual,
    makeMailer: vi.fn((db: unknown) => {
      const binding = {
        send: vi.fn(async () => {
          throw new Error("simulated total provider outage");
        }),
      };
      const log = actual.d1EmailLogWriter(db as never);
      return new EmailBindingMailer(binding, log, { email: "noreply@example.com", name: "Chautauqua" }, (_from, to, raw) => ({ to, raw }));
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return {
    KV: kv as unknown as AppEnv["Bindings"]["KV"],
    PUBLIC_BASE_URL: "https://events.example.com",
  };
}

/** Records every insert() call — the double email_log's d1EmailLogWriter
 * writes through, without needing a real D1/SQLite engine (no such engine
 * is wired into this repo's unit tests; see test/submit-mailer-failure.test.ts
 * for the sibling pattern). */
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

describe("POST /api/v1/events/:eventId/compose/send — every recipient rejected (DEC-766)", () => {
  it("writes an N-row 'failed' email_log batch instead of leaving the batch absent", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-bad-1", "sub-bad-2", "sub-bad-3"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: { email: string }[] };
    expect(body.sent).toBe(0);
    expect(body.failed).toHaveLength(3);

    const failedRows = inserts.filter((v) => v.status === "failed");
    expect(failedRows).toHaveLength(3);
    expect(new Set(failedRows.map((r) => r.batchId)).size).toBe(1);
    expect(failedRows.map((r) => r.toEmail).sort()).toEqual([
      "bad1@example.com",
      "bad2@example.com",
      "bad3@example.com",
    ]);
    for (const row of failedRows) {
      expect(row.eventId).toBe("evt-1");
    }

    // listEmailBatches groups by COALESCE(batch_id, id) with no special
    // casing for status — the 3 'failed' rows just written collapse into
    // one batch row with statusCounts { failed: 3 }.
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
      [{ batchKey: batchId, subject: "Update on {talk_title}", sentAt: failedRows[0].sentAt }],
      [{ count: 1 }],
      [{ batchKey: batchId, status: "failed", n: 3 }],
    ]);
    const result = await listEmailBatches(queryDb, { eventId: "evt-1", page: 1, perPage: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.statusCounts).toEqual({ failed: 3 });
  });
});
