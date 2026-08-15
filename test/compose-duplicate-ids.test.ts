// DEC-182 amendment regression: parseBoundedIdArray is the ONE place bulk
// ids become a set. Before the fix, a submissionId repeated across the
// ID_CHUNK_SIZE=90 chunk boundary (src/lib/chunk.ts) survived into
// loadComposeSubmissions unchanged, which issues one `inArray` per 90-id
// chunk (src/server/repo/comms.ts) — a duplicate id straddling two chunks
// came back as two rows, fanned out into two recipient rows via
// expandRecipients (src/domain/compose.ts), and the same speaker was
// mailed twice with `sent` over-reporting the distinct-recipient count.
//
// This test drives the real POST /compose/send route with a submissionIds
// array of 91 raw entries: 90 distinct ids (sub-0..sub-89) plus a repeat of
// sub-0 appended at the end — sub-0 sits in chunk 1 (indices 0-89) while its
// duplicate lands at index 90, the first entry of chunk 2. It asserts
// loadComposeSubmissions (which now sees only the deduped array coming out
// of parseBoundedIdArray) is called with exactly 90 ids, that exactly one
// email is sent to the speaker behind sub-0, and that `sent` equals the
// distinct-recipient count (90), not 91.

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

// 90 distinct submissions, one participant each — sub-0's speaker is the one
// whose id gets duplicated across the chunk boundary in the request body.
const DISTINCT_COUNT = 90;
const distinctSubmissions = Array.from({ length: DISTINCT_COUNT }, (_, i) => ({
  id: `sub-${i}`,
  title: `Talk ${i}`,
  seq: i + 1,
  participants: [
    { contactId: `ct-${i}`, firstName: "Speaker", lastName: `${i}`, email: `speaker${i}@example.com` },
  ],
}));

let loadComposeSubmissionsCalls: string[][] = [];

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
    // Mirrors the real repo contract (server/repo/comms.ts): returns one row
    // per requested id, chunked internally in production. Here we just
    // record what ids the route actually asked for, post-dedupe.
    loadComposeSubmissions: vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => {
      loadComposeSubmissionsCalls.push(ids);
      const byId = new Map(distinctSubmissions.map((s) => [s.id, s]));
      return ids.map((id) => {
        const row = byId.get(id);
        if (!row) throw new Error(`test fixture missing submission ${id}`);
        return row;
      });
    }),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    loadIcsScheduleData: vi.fn(async () => new Map()),
    // DEC-238 wave-3 amendment: this file's fakeDb has no .select() —
    // stubbed so the new dedupe-partition read (unrelated to this file's
    // duplicate-id scope) doesn't 500 before reaching the mailer.
    loadRecentlySent: vi.fn(async () => new Map()),
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

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; text: string }) => {
        sentMails.push(mail);
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
  loadComposeSubmissionsCalls = [];
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: ORIGIN };
}

async function buildCommsApp() {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

function composeBody(submissionIds: string[]) {
  return JSON.stringify({
    submissionIds,
    subject: "Update on {talk_title}",
    bodyText: "Hi {speaker_name}, see you at DevCon.",
  });
}

describe("POST /api/v1/events/:eventId/compose/send — duplicate id across chunk boundary (DEC-182)", () => {
  it("dedupes before loadComposeSubmissions, mails the repeated speaker once, and reports the distinct sent count", async () => {
    const distinctIds = distinctSubmissions.map((s) => s.id);
    // 91 raw ids: sub-0..sub-89 (chunk 1, indices 0-89) then sub-0 again at
    // index 90 — the first slot of what would be chunk 2.
    const rawIds = [...distinctIds, "sub-0"];
    expect(rawIds).toHaveLength(DISTINCT_COUNT + 1);

    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(rawIds),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { sent: number; failed: unknown[] };
    expect(payload.failed).toEqual([]);
    expect(payload.sent).toBe(DISTINCT_COUNT);

    // The repo layer never sees the raw duplicated array — parseBoundedIdArray
    // dedupes it first, so exactly one call with exactly 90 ids, no repeats.
    expect(loadComposeSubmissionsCalls).toHaveLength(1);
    const calledWith = loadComposeSubmissionsCalls[0]!;
    expect(calledWith).toHaveLength(DISTINCT_COUNT);
    expect(new Set(calledWith).size).toBe(DISTINCT_COUNT);

    // The speaker behind sub-0 (whose id was duplicated in the request) was
    // mailed exactly once, not twice.
    const toSpeaker0 = sentMails.filter((m) => m.to.email === "speaker0@example.com");
    expect(toSpeaker0).toHaveLength(1);
    expect(sentMails).toHaveLength(DISTINCT_COUNT);
  });
});
