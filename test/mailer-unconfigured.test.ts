// DEC-547 amendment (wave 43): makeMailer must never throw at construction.
// Before this change, an unconfigured deployment (DEV_MODE unset/not "1",
// no RESEND_API_KEY) made makeMailer throw BEFORE any per-recipient
// try/catch could run, so every send path 500'd and wrote no email_log row
// at all -- which is also why a fully-failed batch read '0 total' in Comms
// History. UnconfiguredMailer instead behaves like every other Mailer: log
// the attempt, then throw from send() (caught by callers' existing
// per-recipient catch blocks).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { makeMailer, d1EmailLogWriter } from "../src/server/context";
import { InMemoryEmailLog } from "../src/mail/dev-sink";
import { MailNotConfiguredError } from "../src/mail/types";
import type { RenderedEmail } from "../src/mail/types";

const baseEmail: RenderedEmail = {
  to: { email: "ada@example.com", name: "Ada Lovelace" },
  subject: "Hello",
  text: "body",
  html: "<p>body</p>",
  eventId: "evt_1",
  contactId: "ct_1",
};

describe("makeMailer — unconfigured deployment (DEC-547 amendment)", () => {
  it("never throws at construction with DEV_MODE unset and no RESEND_API_KEY", () => {
    const log = new InMemoryEmailLog();
    const db = { insert: () => ({ values: async () => {} }) } as never;
    expect(() => makeMailer(db, { DEV_MODE: undefined, RESEND_API_KEY: undefined, MAIL_FROM_EMAIL: undefined, MAIL_FROM_NAME: undefined })).not.toThrow();
    void log;
  });

  it("writes one 'failed'/'none' email_log row per attempted recipient and throws MailNotConfiguredError from send()", async () => {
    const log = new InMemoryEmailLog();
    const dbLike = {
      insert: () => ({
        values: async (vals: unknown) => {
          (log as unknown as { rows: unknown[] }).rows.push(vals);
        },
      }),
    };
    const mailer = makeMailer(dbLike as never, {
      DEV_MODE: "0",
      RESEND_API_KEY: undefined,
      MAIL_FROM_EMAIL: undefined,
      MAIL_FROM_NAME: undefined,
    });

    await expect(mailer.send(baseEmail)).rejects.toBeInstanceOf(MailNotConfiguredError);
    await expect(mailer.send({ ...baseEmail, to: { email: "grace@example.com", name: "Grace" } })).rejects.toBeInstanceOf(
      MailNotConfiguredError,
    );

    expect(log.rows).toHaveLength(2);
    for (const row of log.rows) {
      expect(row.status).toBe("failed");
      expect(row.provider).toBe("none");
    }
  });

  it("still selects the dev sink when DEV_MODE is \"1\", regardless of RESEND_API_KEY", async () => {
    const log = new InMemoryEmailLog();
    const rows: unknown[] = [];
    const dbLike = {
      insert: () => ({
        values: async (vals: unknown) => {
          rows.push(vals);
        },
      }),
    };
    const mailer = makeMailer(dbLike as never, { DEV_MODE: "1", RESEND_API_KEY: undefined, MAIL_FROM_EMAIL: undefined, MAIL_FROM_NAME: undefined });
    await mailer.send(baseEmail);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { status: string }).status).toBe("sent");
    expect((rows[0] as { provider: string }).provider).toBe("dev");
    void log;
    void d1EmailLogWriter;
  });
});

// -----------------------------------------------------------------------
// Route-level: compose/send on an unconfigured deployment returns 200 with
// every recipient in `failed`, not a 500.
// -----------------------------------------------------------------------

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
    seq: 1,
    participants: [{ contactId: "ct-good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" }],
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
    loadIcsScheduleData: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  // DEV_MODE unset, no RESEND_API_KEY/MAIL_FROM_EMAIL: makeMailer resolves
  // the real UnconfiguredMailer (no mock needed for this route test).
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
}

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

describe("POST /api/v1/events/:eventId/compose/send — unconfigured mail (DEC-547 amendment)", () => {
  it("returns 200 with every recipient in `failed`, naming the config problem, instead of 500ing", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-good"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: { email: string; message: string }[] };
    expect(body.sent).toBe(0);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("good@example.com");
    expect(body.failed[0]?.message).toMatch(/not configured/i);

    // The unconfigured attempt is still logged (never silently dropped).
    const failedRows = inserts.filter((v) => v.status === "failed" && v.provider === "none");
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].toEmail).toBe("good@example.com");
  });
});
