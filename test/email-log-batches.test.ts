// DEC-603: Comms send history becomes batched with a per-recipient
// drill-in. Two things must hold: (1) a fan-out call mints ONE batchId and
// stamps every recipient's email_log row with it, so a 3-recipient send
// collapses to one batch row; (2) a legacy/NULL-batch row (or a single
// send, which never sets batchId) still appears as its own one-recipient
// batch via COALESCE(batch_id, id). No real SQLite engine is wired into
// these unit tests (see test/migration-parity.test.ts's sibling comment) —
// the fan-out mint is exercised over HTTP against a mocked mailer (same
// pattern as test/contacts-bulk-email-mailer-failure.test.ts), and
// listEmailBatches' grouping/ordering + listEmailLog's batchKey filter are
// exercised against a fake db double that records the drizzle SQL passed to
// .groupBy()/.where(), converted to literal text via SQLiteSyncDialect
// (same technique test/submission-seq.test.ts uses).

import { describe, expect, it, vi } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";

const dialect = new SQLiteSyncDialect();

// ---------------------------------------------------------------------------
// (1) a fan-out call mints one batchId shared by every recipient.
// ---------------------------------------------------------------------------

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

const CONTACTS = [
  contactRow({ id: "ct_a", firstName: "Ada", lastName: "Lovelace", email: "a@example.com" }),
  contactRow({ id: "ct_b", firstName: "Grace", lastName: "Hopper", email: "b@example.com" }),
  contactRow({ id: "ct_c", firstName: "Kay", lastName: "McNulty", email: "c@example.com" }),
];

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: vi.fn(async (_db: unknown, ids: string[], orgId: string) =>
      orgId === "org1" ? CONTACTS.filter((c) => ids.includes(c.id)) : [],
    ),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) =>
      new Map(params.map((p) => [p.contactId, null])),
    ),
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

// DEC-238 wave-14 amendment: bulk-email now reads loadRecentlySent before
// sending — this test's fake db has no real D1 to query, so stub the reader
// to report nothing recently sent (this test is not exercising the dedupe
// window; see test/contacts-bulk-email-dedupe.test.ts for that).
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return { ...actual, loadRecentlySent: vi.fn(async () => new Map()) };
});

const sends: { to: { email: string }; batchId?: string }[] = [];
const mailerSendMock = vi.fn(async (mail: { to: { email: string }; batchId?: string }) => {
  sends.push(mail);
});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: mailerSendMock })),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");
const { listEmailBatches, listEmailLog } = await import("../src/server/repo/email");
type Db = import("../src/server/context").Db;

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
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

describe("POST /contacts/bulk-email mints one batchId per call (DEC-603)", () => {
  it("stamps every recipient in the loop with the same batchId", async () => {
    const app = buildApp();
    const res = await postJson(app, "/contacts/bulk-email", {
      contactIds: ["ct_a", "ct_b", "ct_c"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    expect(mailerSendMock).toHaveBeenCalledTimes(3);
    const batchIds = sends.map((s) => s.batchId);
    expect(batchIds.every((b) => typeof b === "string" && b.length > 0)).toBe(true);
    expect(new Set(batchIds).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (2) listEmailBatches groups a fan-out's rows into one batch row, while a
// legacy/NULL-batch row still appears as its own batch — and listEmailLog's
// batchKey filter matches on the identical COALESCE(batch_id, id) expression
// listEmailBatches groups by.
// ---------------------------------------------------------------------------

function makeFakeDb(responses: unknown[]) {
  let cursor = 0;
  const calls: { method: string; args: unknown[] }[][] = [];
  function chain(): any {
    const log: { method: string; args: unknown[] }[] = [];
    calls.push(log);
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) {
      obj[m] = (...args: unknown[]) => {
        log.push({ method: m, args });
        return obj;
      };
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[cursor];
      cursor += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { db: { select: () => chain() } as unknown as Db, calls };
}

describe("listEmailBatches (DEC-603)", () => {
  it("a 3-recipient send collapses to one batch row; a legacy/NULL-batch row is its own batch", async () => {
    // Row order mirrors what the real GROUP BY COALESCE(batch_id, id) would
    // hand back: one aggregate row per distinct batch key.
    const aggregateRows = [
      { batchKey: "batch-xyz", subject: "You are in!", sentAt: 1_700_000_100_000, recipientCount: 3 },
      { batchKey: "log-legacy-1", subject: "Welcome", sentAt: 1_700_000_000_000, recipientCount: 1 },
    ];
    const countRows = [{ count: 2 }];
    const statusRows = [
      { batchKey: "batch-xyz", status: "sent", n: 3 },
      { batchKey: "log-legacy-1", status: "sent", n: 1 },
    ];
    const { db, calls } = makeFakeDb([aggregateRows, countRows, statusRows]);

    const result = await listEmailBatches(db, { eventId: "ev1", page: 1, perPage: 20 });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      {
        batchKey: "batch-xyz",
        subject: "You are in!",
        sentAt: 1_700_000_100_000,
        statusCounts: { sent: 3 },
      },
      {
        batchKey: "log-legacy-1",
        subject: "Welcome",
        sentAt: 1_700_000_000_000,
        statusCounts: { sent: 1 },
      },
    ]);

    // The main aggregate query groups by the same expression it orders by.
    const mainCall = calls[0]!;
    const groupByCall = mainCall.find((c) => c.method === "groupBy");
    expect(groupByCall).toBeDefined();
    const groupBySql = dialect.sqlToQuery(groupByCall!.args[0] as any).sql;
    expect(groupBySql).toContain("coalesce");
    expect(groupBySql).toContain("batch_id");
  });

  it("listEmailLog's batchKey filter matches on the identical COALESCE(batch_id, id) expression listEmailBatches groups by", async () => {
    const { db: batchDb, calls: batchCalls } = makeFakeDb([[], [{ count: 0 }], []]);
    await listEmailBatches(batchDb, { eventId: "ev1", page: 1, perPage: 20 });
    const groupByCall = batchCalls[0]!.find((c) => c.method === "groupBy")!;
    const groupBySql = dialect.sqlToQuery(groupByCall.args[0] as any).sql;

    const { db: logDb, calls: logCalls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(logDb, { batchKey: "batch-xyz", page: 1, perPage: 20 });
    const whereCall = logCalls[0]!.find((c) => c.method === "where")!;
    const whereSql = dialect.sqlToQuery(whereCall.args[0] as any).sql;

    // Both must reference the exact same COALESCE(batch_id, id) shape, or a
    // batch's aggregate and its drill-in query could silently disagree.
    expect(whereSql).toContain("coalesce");
    expect(whereSql).toContain(groupBySql.match(/coalesce\([^)]*\)/i)?.[0]?.toLowerCase());
  });

  // DEC-686: the per-status tally query used to GROUP BY the whole event and
  // filter the JS result to the page's batchKeys — scanning every batch in
  // the event even for a one-row page. It must now bind the page's own
  // batch keys into the WHERE clause via inArray over BATCH_KEY.
  it("scopes the per-status tally query's WHERE to the page's own batch keys", async () => {
    const aggregateRows = [{ batchKey: "batch-xyz", subject: "You are in!", sentAt: 1_700_000_100_000, recipientCount: 3 }];
    const countRows = [{ count: 5 }];
    const statusRows = [{ batchKey: "batch-xyz", status: "sent", n: 3 }];
    const { db, calls } = makeFakeDb([aggregateRows, countRows, statusRows]);

    await listEmailBatches(db, { eventId: "ev1", page: 1, perPage: 1 });

    // calls[0] = main aggregate query, calls[1] = count query, calls[2] = status tally query.
    const statusCall = calls[2]!;
    const whereCall = statusCall.find((c) => c.method === "where")!;
    const whereSql = dialect.sqlToQuery(whereCall.args[0] as any).sql;
    expect(whereSql).toContain("coalesce");
    expect(whereSql).toContain("in (");
    expect(whereSql).toContain("event_id");
  });
});
