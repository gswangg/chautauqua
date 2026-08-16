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

// w15-c: a speaker with TWO accepted talks — same contact/address, a
// second submission. Used to exercise the intra-batch dedupe stage.
const twoTalkSubmissions = [
  submissions[0]!,
  {
    id: "sub-2",
    title: "On Difference Engines",
    seq: 2,
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

let currentSubmissions: typeof submissions = submissions;

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => currentSubmissions),
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
  currentSubmissions = submissions;
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

async function preview(app: Hono<AppEnv>, kv: KVStore, body: Record<string, unknown>) {
  return app.request(
    `${ORIGIN}/api/v1/events/${EVENT_ID}/compose/preview`,
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

describe("POST /api/v1/events/:eventId/compose/send — intra-batch dedupe (DEC-238 wave-15 amendment)", () => {
  it("two rendered recipients sharing an address AND an identical subject mail once, and the second reports duplicate_in_batch with no retryAtIso", async () => {
    currentSubmissions = twoTalkSubmissions;
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    // Subject has no {talk_title} merge field, so both of Ada's submissions
    // render the identical (email, subject) pair inside ONE call.
    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sent: number;
      skipped: { email: string; reason: string; retryAtIso?: string }[];
      failed: unknown[];
    };
    expect(body.sent).toBe(1);
    expect(body.failed).toEqual([]);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0]).toMatchObject({ email: "ada@example.com", reason: "duplicate_in_batch" });
    expect(body.skipped[0]).not.toHaveProperty("retryAtIso");
    expect(sentMails).toHaveLength(1);
  });

  it("the same address with two DIFFERENT rendered subjects (per-submission {talk_title}) mails both", async () => {
    currentSubmissions = twoTalkSubmissions;
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "About your talk: {talk_title}",
      bodyText: "Hi {speaker_name}.",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: unknown[]; failed: unknown[] };
    expect(body.sent).toBe(2);
    expect(body.skipped).toEqual([]);
    expect(body.failed).toEqual([]);
    expect(sentMails).toHaveLength(2);
    expect(new Set(sentMails.map((m) => m.subject))).toEqual(
      new Set(["About your talk: On Engines", "About your talk: On Difference Engines"]),
    );
  });

  it("intra-batch dedupe runs BEFORE the cross-call window check — a within-window prior send still yields exactly one skip, not two", async () => {
    currentSubmissions = twoTalkSubmissions;
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    expect(sentMails).toHaveLength(1);

    vi.setSystemTime(t0 + 40_000);
    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
    });
    const body = (await res.json()) as {
      sent: number;
      skipped: { reason: string }[];
      failed: unknown[];
    };
    expect(body.sent).toBe(0);
    // sub-2 collapses into sub-1's identical render (duplicate_in_batch);
    // the SURVIVING sub-1 entry then hits the cross-call window from the
    // first request (already_sent_recently) — one skip per stage, not a
    // second already_sent_recently for the already-collapsed entry.
    expect(body.skipped.map((s) => s.reason).sort()).toEqual(["already_sent_recently", "duplicate_in_batch"]);
    expect(sentMails).toHaveLength(1);
  });
});

describe("POST /api/v1/events/:eventId/compose/preview — plan summary matches send (wave-60, DEC-238, P1 cluster 4)", () => {
  it("preview's plan.willSend/plan.skipped exactly matches what a subsequent send actually does, for the same input", async () => {
    currentSubmissions = twoTalkSubmissions;
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    // First, an out-of-band send that will make one address+subject
    // "recently sent" for the next preview/send pair.
    await send(app, kv, { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." });
    expect(sentMails).toHaveLength(1);
    sentMails.length = 0;

    vi.setSystemTime(t0 + 40_000);
    const body = { submissionIds: ["sub-1", "sub-2"], subject: "Reminder", bodyText: "Hi {speaker_name}." };

    const previewRes = await preview(app, kv, body);
    expect(previewRes.status).toBe(200);
    const previewBody = (await previewRes.json()) as {
      items: { willSend: boolean; skipReason?: string; retryAtIso?: string; submissionId: string }[];
      plan: { willSend: number; skipped: { submissionId: string; reason: string }[] };
    };
    // sub-2 collapses into sub-1's identical render (duplicate_in_batch);
    // sub-1 itself is still inside the window from the out-of-band send
    // above (already_sent_recently) — nothing should send.
    expect(previewBody.plan.willSend).toBe(0);
    expect(previewBody.plan.skipped.map((s) => s.reason).sort()).toEqual([
      "already_sent_recently",
      "duplicate_in_batch",
    ]);
    expect(previewBody.items.every((i) => i.willSend === false)).toBe(true);

    const sendRes = await send(app, kv, body);
    const sendBody = (await sendRes.json()) as { sent: number; skipped: { reason: string }[]; failed: unknown[] };
    expect(sendBody.sent).toBe(previewBody.plan.willSend);
    expect(sendBody.skipped.map((s) => s.reason).sort()).toEqual(
      previewBody.plan.skipped.map((s) => s.reason).sort(),
    );
    expect(sentMails).toHaveLength(0);
  });

  it("preview's plan.willSend matches the raw send count when nothing collides", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();
    vi.setSystemTime(1_700_000_000_000);

    const body = { submissionIds: ["sub-1"], subject: "Reminder", bodyText: "Hi {speaker_name}." };
    const previewRes = await preview(app, kv, body);
    const previewBody = (await previewRes.json()) as { items: unknown[]; plan: { willSend: number; skipped: unknown[] } };
    expect(previewBody.plan.willSend).toBe(1);
    expect(previewBody.plan.skipped).toEqual([]);
    expect(previewBody.items).toHaveLength(1);

    const sendRes = await send(app, kv, body);
    const sendBody = (await sendRes.json()) as { sent: number };
    expect(sendBody.sent).toBe(previewBody.plan.willSend);
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
