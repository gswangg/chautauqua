// DEC-238 (wave-8 amendment, sha efb77e4a): the comms history row must agree
// with the send report about skipped recipients. Mirrors
// test/comms-send-dedupe.test.ts's mocking technique (repo/comms +
// repo/tasks/reminders + server/context.makeMailer mocked; a fake db that
// records every insert() so this test can assert the SAME single insert
// owner (d1EmailLogWriter) is used for the skipped row).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import * as schema from "../src/db/schema";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";
const EVENT_ID = "evt-1";

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
  id: EVENT_ID,
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

// A speaker with two accepted talks, same address, rendered with a subject
// that carries no per-submission merge field — this is the intra-batch
// "duplicate_in_batch" stage exercised by comms-send-dedupe.test.ts, reused
// here because it is the cheapest way to produce a `skipped` entry without
// needing a second call across the window.
const twoTalkSubmissions = [
  {
    id: "sub-1",
    title: "On Engines",
    seq: 1,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
  {
    id: "sub-2",
    title: "On Difference Engines",
    seq: 2,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
];

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return { ...actual, getEventForOrg: vi.fn(async () => event) };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => twoTalkSubmissions),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    loadIcsScheduleData: vi.fn(async () => new Map()),
    findTemplateById: vi.fn(async () => null),
    // No prior 'sent' rows — this route call's own intra-batch dedupe is
    // exercised on a fresh window, per invariant 1 below.
    loadRecentlySent: vi.fn(async () => new Map<string, number>()),
  };
});

vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return { ...actual, listOutstandingForEvent: vi.fn(async () => []) };
});

const sentMails: { to: string; subject: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (attempt: { to: { email: string }; subject: string }) => {
        sentMails.push({ to: attempt.to.email, subject: attempt.subject });
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: ORIGIN };
}

// A minimal fake db whose insert() records every row passed to values(),
// tagged with the table it was called against — the real d1EmailLogWriter
// (src/server/context.ts) is left un-mocked, so this exercises the SAME
// single insert owner every other mailer implementation uses.
type InsertedRow = { table: unknown; row: Record<string, unknown> };
function fakeDb(inserted: InsertedRow[]) {
  const db = {
    insert: (table: unknown) => ({
      values: async (row: Record<string, unknown>) => {
        inserted.push({ table, row });
      },
    }),
  };
  return db as never;
}

async function buildCommsApp(inserted: InsertedRow[]) {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", fakeDb(inserted));
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

async function send(app: Hono<AppEnv>, kv: KVStore, body: Record<string, unknown>) {
  return app.request(
    `${ORIGIN}/api/v1/events/${EVENT_ID}/compose/send`,
    { method: "POST", headers: { "content-type": "application/json", "x-chq-csrf": "1" }, body: JSON.stringify(body) },
    withEnv(kv),
  );
}

describe("POST /api/v1/events/:eventId/compose/send — skipped rows land in email_log (DEC-238 wave-8 amendment)", () => {
  it("writes exactly one status='skipped' email_log row per skip, sharing the batch's batchId, through d1EmailLogWriter", async () => {
    const inserted: InsertedRow[] = [];
    const app = await buildCommsApp(inserted);
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: { reason: string }[]; failed: unknown[] };
    expect(body.sent).toBe(1);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0]).toMatchObject({ reason: "duplicate_in_batch" });

    const skippedRows = inserted.filter((r) => r.table === schema.emailLog && r.row.status === "skipped");
    expect(skippedRows).toHaveLength(1);
    const sentRows = inserted.filter((r) => r.table === schema.emailLog && r.row.status === "sent");
    // The mailer itself is mocked in this file (it doesn't write email_log),
    // so only the route's own skipped-row write lands here — this asserts
    // the route wrote exactly the skipped count the response reports, no
    // more, no fewer.
    expect(sentRows).toHaveLength(0);

    const row = skippedRows[0]!.row;
    expect(row.eventId).toBe(EVENT_ID);
    expect(typeof row.batchId).toBe("string");
    expect(row.batchId).not.toBe("");
    expect(row.provider).toBe("none");
    expect(row.toEmail).toBe("ada@example.com");
    // Invariant 2: no claim token is minted for a skipped recipient — the
    // stored body is the UNMINTED render and must contain no portal-link
    // substitution.
    expect(String(row.bodyText)).not.toContain("{portal_link}");
    expect(String(row.bodyText)).not.toMatch(/\/claim\//);
  });

  it("invariant 1: a skipped row's status never satisfies loadRecentlySent's status='sent' filter, so it cannot itself cause a second skip", async () => {
    // loadRecentlySent is mocked in this file, but its real implementation
    // (src/server/repo/comms.ts) is documented to filter status = 'sent' —
    // this test asserts the row this route writes for a skip is literally
    // status: 'skipped', the only contract loadRecentlySent's WHERE clause
    // needs to hold for that invariant to be true.
    const inserted: InsertedRow[] = [];
    const app = await buildCommsApp(inserted);
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    await send(app, kv, { submissionIds: ["sub-1", "sub-2"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    const skippedRows = inserted.filter((r) => r.table === schema.emailLog && r.row.status === "skipped");
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0]!.row.status).not.toBe("sent");
  });
});
