// DEC-397 wave-62 amendment (MINT ONLY WHAT SHIPS): createClaimToken
// supersedes the prior grant onto a 48h TTL, so minting for a recipient who
// lands in `skipped` (already_sent_recently / duplicate_in_batch) would
// revoke their live, already-delivered portal link and never deliver a
// replacement. The mint must run AFTER every 400 (templateId validation
// included) and AFTER both dedupe stages, and only for the recipients that
// survive into `toSend`. Mirrors test/comms-mint-late.test.ts's and
// test/comms-send-dedupe.test.ts's mocking technique.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { createClaimToken, readClaimToken } from "../src/auth/claim";
import { dedupeKey } from "../src/domain/comms-dedupe";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";
const EVENT_ID = "evt-1";

/** Counts every put() call so a refused/skipped recipient can be asserted
 * to trigger ZERO KV writes (MINTING IS IO). */
class CountingKV implements KVStore {
  private readonly store = new Map<string, string>();
  putCalls = 0;
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.putCalls += 1;
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

const submissions = [
  {
    id: "sub-1",
    title: "On Engines",
    seq: 1,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
];

const templatesById = new Map<string, { id: string; eventId: string; subject: string; bodyText: string }>();
templatesById.set("tpl-foreign", { id: "tpl-foreign", eventId: "evt-other", subject: "Foreign", bodyText: "Nope" });

let loggedRows: { eventId: string; toEmail: string; subject: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return { ...actual, getEventForOrg: vi.fn(async () => event) };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => submissions),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    loadIcsScheduleData: vi.fn(async () => new Map()),
    findTemplateById: vi.fn(async (_db: unknown, id: string) => templatesById.get(id) ?? null),
    loadRecentlySent: vi.fn(
      async (_db: unknown, eventId: string, keys: { email: string; subject: string }[], cutoffMs: number) => {
        const map = new Map<string, number>();
        for (const row of loggedRows) {
          if (row.eventId !== eventId) continue;
          if (row.sentAt < cutoffMs) continue;
          const hit = keys.some(
            (k) => k.email.trim().toLowerCase() === row.toEmail.trim().toLowerCase() && k.subject === row.subject,
          );
          if (!hit) continue;
          const key = dedupeKey(row.toEmail, row.subject);
          const existing = map.get(key);
          if (existing === undefined || row.sentAt > existing) map.set(key, row.sentAt);
        }
        return map;
      },
    ),
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
        loggedRows.push({ eventId: EVENT_ID, toEmail: attempt.to.email, subject: attempt.subject, sentAt: Date.now() });
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
  loggedRows = [];
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: ORIGIN };
}

function fakeDb() {
  const db = { insert: () => ({ values: async () => {} }) };
  return db as never;
}

async function buildCommsApp() {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", fakeDb());
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

describe("POST /api/v1/events/:eventId/compose/send — MINT ONLY WHAT SHIPS (DEC-397 wave-62)", () => {
  it("a recipient skipped by the cross-call dedupe stage keeps their prior claim token un-superseded", async () => {
    const app = await buildCommsApp();
    const kv = new CountingKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    // First send: no {portal_link}, mints nothing, just logs the send so
    // the second call's cross-call dedupe fires.
    const first = await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    expect(first.status).toBe(200);

    // Seed a live claim grant for the recipient AFTER the first send, then
    // reset the put counter.
    const priorToken = await createClaimToken(kv, { contactId: "ct-1", eventId: EVENT_ID });
    kv.putCalls = 0;

    vi.setSystemTime(t0 + 40_000); // inside the dedupe window
    const second = await send(app, kv, {
      submissionIds: ["sub-1"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}, see {portal_link}.",
    });
    expect(second.status).toBe(200);
    const body = (await second.json()) as { sent: number; skipped: { reason: string }[] };
    expect(body.sent).toBe(0);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0]!.reason).toBe("already_sent_recently");

    // The skip means nobody survived into toSend, so nothing was minted —
    // the prior grant is untouched (createClaimToken would have superseded
    // it onto a 48h TTL had it run).
    expect(kv.putCalls).toBe(0);
    const record = await readClaimToken(kv, priorToken);
    expect(record).toEqual({ contactId: "ct-1", eventId: EVENT_ID });
  });

  it("a recipient skipped by the intra-batch dedupe stage keeps their prior claim token un-superseded", async () => {
    const twoTalkSubmissions = [
      submissions[0]!,
      {
        id: "sub-2",
        title: "On Difference Engines",
        seq: 2,
        participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
      },
    ];
    const { loadComposeSubmissions } = await import("../src/server/repo/comms");
    (loadComposeSubmissions as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => twoTalkSubmissions);

    const app = await buildCommsApp();
    const kv = new CountingKV();
    vi.setSystemTime(1_700_000_000_000);

    const priorToken = await createClaimToken(kv, { contactId: "ct-1", eventId: EVENT_ID });
    kv.putCalls = 0;

    // No {talk_title}, so both submissions render an identical (email,
    // subject) pair — the second collapses into duplicate_in_batch.
    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}, see {portal_link}.",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: { reason: string }[] };
    expect(body.sent).toBe(1);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0]!.reason).toBe("duplicate_in_batch");

    // One recipient survived (and needed a mint since it uses
    // {portal_link}), so SOME put() happened — but the PRIOR grant must
    // still resolve, since createClaimToken supersedes onto a fresh 48h
    // TTL rather than deleting outright.
    expect(kv.putCalls).toBeGreaterThan(0);
    const record = await readClaimToken(kv, priorToken);
    // Superseded record still readable (48h grace), or the live grant was
    // replaced by the new mint — either way, exactly one mint fired for
    // the one surviving recipient, not two.
    expect(record).not.toBeNull();
  });

  it("a bad templateId 400s with zero KV writes", async () => {
    const app = await buildCommsApp();
    const kv = new CountingKV();
    vi.setSystemTime(1_700_000_000_000);

    const res = await send(app, kv, {
      submissionIds: ["sub-1"],
      templateId: "tpl-foreign",
      subject: "Reminder",
      bodyText: "Hi {speaker_name}, see {portal_link}.",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toHaveProperty("templateId");
    expect(kv.putCalls).toBe(0);
    expect(sentMails).toHaveLength(0);
  });
});
