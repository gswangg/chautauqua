// DEC-936 (wave-22 amendment): an .ics attachment is per-submission composed
// content. One speaker (one contactId) with TWO accepted submissions and a
// STATIC subject+body (no PER_SUBMISSION_MERGE_VARS token spent) must still
// get two distinct calendar invites when attachIcs is true — previously
// expandRecipients' contact-collapse (DEC-936 wave-19) and planComposeSends'
// stage-1 dedupeKey(email, subject) (DEC-238 wave-15) both silently dropped
// the second session's invite. Mirrors test/comms-send-dedupe.test.ts's
// mocking technique (repo/comms + repo/tasks/reminders + server/context
// mocked; no real D1 wired in).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

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

// One speaker (ct-1), TWO accepted submissions — the same shape
// test/comms-send-dedupe.test.ts's twoTalkSubmissions uses.
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

const icsScheduleMap = new Map([
  ["sub-1", { submissionId: "sub-1", day: "2026-01-01", startMin: 540, endMin: 570, roomName: "Main Hall", icsSequence: 0 }],
  ["sub-2", { submissionId: "sub-2", day: "2026-01-01", startMin: 600, endMin: 630, roomName: "Main Hall", icsSequence: 0 }],
]);

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
    loadIcsScheduleData: vi.fn(async () => icsScheduleMap),
    loadRecentlySent: vi.fn(async () => new Map<string, number>()),
  };
});

vi.mock("../src/server/repo/ics-sequence", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/ics-sequence")>("../src/server/repo/ics-sequence");
  return { ...actual, bumpIcsSequences: vi.fn(async () => {}) };
});

vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return { ...actual, listOutstandingForEvent: vi.fn(async () => []) };
});

const sentMails: { to: string; subject: string; icsFilename?: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (attempt: { to: { email: string }; subject: string; ics?: { filename: string } }) => {
        sentMails.push({ to: attempt.to.email, subject: attempt.subject, icsFilename: attempt.ics?.filename });
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
  vi.setSystemTime(1_700_000_000_000);
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: ORIGIN, DEV_MODE: "1" };
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

describe("POST /api/v1/events/:eventId/compose/send — .ics attachment is per-submission composed content (DEC-936 wave-22 amendment)", () => {
  it("attachIcs:true — a speaker with two accepted sessions and a STATIC subject/body gets 2 sent, 0 skipped, and two DISTINCT chq-<submissionId>.ics filenames", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();

    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder", // no {talk_title}/{session_time}/{feedback}
      bodyText: "Hi {speaker_name}.",
      attachIcs: true,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: unknown[]; failed: unknown[] };
    expect(body.sent).toBe(2);
    expect(body.skipped).toEqual([]);
    expect(body.failed).toEqual([]);
    expect(sentMails).toHaveLength(2);
    expect(new Set(sentMails.map((m) => m.icsFilename))).toEqual(
      new Set(["chq-sub-1.ics", "chq-sub-2.ics"]),
    );
  });

  it("attachIcs:false — the SAME static-subject input still collapses to 1 sent with one named duplicate_in_batch skip (unchanged DEC-936 wave-19/21 behaviour)", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();

    const res = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
      attachIcs: false,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sent: number;
      skipped: { email: string; submissionId: string; reason: string; retryAtIso?: string }[];
      failed: unknown[];
    };
    expect(body.sent).toBe(1);
    expect(body.failed).toEqual([]);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0]).toMatchObject({
      email: "ada@example.com",
      submissionId: "sub-2",
      reason: "duplicate_in_batch",
    });
    expect(body.skipped[0]).not.toHaveProperty("retryAtIso");
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]?.icsFilename).toBeUndefined();
  });
});
