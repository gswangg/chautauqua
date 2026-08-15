// DEC-238 wave-3 amendment (compose/send dedupe) + DEC-846 wave-3 amendment
// (templateId provenance validation). Route-level tests for
// src/routes/comms/send.ts. Mirrors test/comms-mint-late.test.ts's mocking
// technique (repo/comms + repo/tasks/reminders + server/context.makeMailer
// mocked; no real D1 wired in).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { COMPOSE_DEDUPE_WINDOW_MS, dedupeKey } from "../src/domain/comms-dedupe";

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

const submissions = [
  {
    id: "sub-1",
    title: "On Engines",
    seq: 1,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
];

// Stand-in email_log rows written by the mocked mailer below — the mocked
// repo.loadRecentlySent reader below reads from this array, so a second
// route call sees the first call's "sent" row exactly as a real D1-backed
// reader would.
let loggedRows: { eventId: string; toEmail: string; subject: string; sentAt: number }[] = [];

const templatesById = new Map<string, { id: string; eventId: string; subject: string; bodyText: string }>();
templatesById.set("tpl-own", { id: "tpl-own", eventId: EVENT_ID, subject: "From template", bodyText: "Hi {speaker_name}." });
templatesById.set("tpl-foreign", { id: "tpl-foreign", eventId: "evt-other", subject: "Foreign", bodyText: "Nope" });

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

describe("POST /api/v1/events/:eventId/compose/send — dedupe (DEC-238 wave-3 amendment)", () => {
  it("a second send of the same subject to the same address inside the window is skipped, with a retryAtIso an hour after the first send", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const first = await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { sent: number; skipped: unknown[]; failed: unknown[] };
    expect(firstBody).toEqual({ sent: 1, skipped: [], failed: [] });

    vi.setSystemTime(t0 + 40_000); // 40s later, well inside the 1h window
    const second = await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as {
      sent: number;
      skipped: { email: string; name: string; submissionId: string; reason: string; retryAtIso: string }[];
      failed: unknown[];
    };
    expect(secondBody.sent).toBe(0);
    expect(secondBody.failed).toEqual([]);
    expect(secondBody.skipped).toHaveLength(1);
    expect(secondBody.skipped[0]).toMatchObject({
      email: "ada@example.com",
      submissionId: "sub-1",
      reason: "already_sent_recently",
    });
    expect(secondBody.skipped[0]!.retryAtIso).toBe(new Date(t0 + COMPOSE_DEDUPE_WINDOW_MS).toISOString());
    expect(sentMails).toHaveLength(1); // only the first send actually emailed
  });

  it("a changed subject is NOT skipped", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    vi.setSystemTime(t0 + 40_000);
    const res = await send(app, kv, { submissionIds: ["sub-1"], subject: "A different subject", bodyText: "Hi {speaker_name}." });
    const body = (await res.json()) as { sent: number; skipped: unknown[] };
    expect(body.sent).toBe(1);
    expect(body.skipped).toEqual([]);
    expect(sentMails).toHaveLength(2);
  });

  it("a send outside the window is NOT skipped", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    vi.setSystemTime(t0 + COMPOSE_DEDUPE_WINDOW_MS + 1_000);
    const res = await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    const body = (await res.json()) as { sent: number; skipped: unknown[] };
    expect(body.sent).toBe(1);
    expect(body.skipped).toEqual([]);
    expect(sentMails).toHaveLength(2);
  });
});

describe("POST /api/v1/events/:eventId/compose/send — templateId provenance (DEC-846 wave-3 amendment)", () => {
  it("a templateId belonging to another event is refused 400 and nothing is emailed (posted alongside the composer's own subject/bodyText, per DEC-846 wave-3 amendment)", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    const res = await send(app, kv, {
      submissionIds: ["sub-1"],
      templateId: "tpl-foreign",
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toHaveProperty("templateId");
    expect(sentMails).toHaveLength(0);
  });

  it("an unknown templateId is refused 400", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    const res = await send(app, kv, {
      submissionIds: ["sub-1"],
      templateId: "tpl-does-not-exist",
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
    });
    expect(res.status).toBe(400);
    expect(sentMails).toHaveLength(0);
  });

  it("a valid own-event templateId posted alongside subject/bodyText sends using the posted words, and stores the templateId as provenance", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    const res = await send(app, kv, {
      submissionIds: ["sub-1"],
      templateId: "tpl-own",
      subject: "My own subject",
      bodyText: "Hi {speaker_name}, my own words.",
    });
    expect(res.status).toBe(200);
    expect(sentMails).toEqual([{ to: "ada@example.com", subject: "My own subject" }]);
  });
});
