// w41-e (DEC-358 wave-41 amendment, DEC-069): batch-B falsifiability
// discharge. This file's sole purpose is the two DO-NOT-RE-FILE claims from
// docs/eval-findings.md that (once the cited artifact was actually opened)
// had NO existing test exercising the specific behavior named — every other
// claim assigned to this task cites an existing test directly in
// docs/mandates/w41-falsifiability-batch-b.md and needed no new test here.
// Node-only (no Cloudflare Workers runtime dependency).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { ApiError } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import type { Db } from "../src/server/context";
import { createUser, type CreateUserInput } from "../src/server/repo/users";
import { dedupeKey } from "../src/domain/comms-dedupe";

// ---------------------------------------------------------------------------
// Claim 1: src/server/repo/users.ts:98-129 (createUser) — DEC-552's
// insert-then-select-by-id race guard. The doc comment above createUser
// claims: INSERT with onConflictDoNothing, then a re-select by id; if the
// re-select comes up empty, this call's row lost the race and it throws the
// same ApiError('conflict') the pre-check raises. No existing test reaches
// this branch -- test/users-api.test.ts's only conflict case is caught by
// the earlier pre-insert duplicate-email SELECT, never reaching
// onConflictDoNothing at all. This test drives the race branch directly.
// ---------------------------------------------------------------------------

describe("createUser onConflictDoNothing race guard (DEC-552, src/server/repo/users.ts:98-129)", () => {
  function fakeRaceDb() {
    const db = {
      select() {
        return {
          from(_table: unknown) {
            return {
              where(_cond: unknown) {
                return {
                  // Both the pre-insert dup check and the post-insert
                  // re-select-by-id go through this same shape. Returning
                  // [] for BOTH calls models: (1) no pre-existing row at
                  // dup-check time, then (2) a concurrent insert winning
                  // the onConflictDoNothing race for this exact id before
                  // the re-select runs -- the row this call tried to
                  // create is simply not there under its own id.
                  limit(_n: number) {
                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
        };
      },
      insert(_table: unknown) {
        return {
          values(_row: Record<string, unknown>) {
            return {
              // The real onConflictDoNothing: does not throw, does not
              // insert (another transaction's row already holds the
              // unique email slot) -- just resolves.
              onConflictDoNothing: () => Promise.resolve(),
            };
          },
        };
      },
    };
    return db as unknown as Db;
  }

  it("throws the same ApiError('conflict') as the pre-check when the post-insert re-select comes up empty", async () => {
    const db = fakeRaceDb();
    const input: CreateUserInput = {
      orgId: "org1",
      email: "race@example.com",
      role: "reviewer",
      passwordHash: "hash",
    };

    await expect(createUser(db, input)).rejects.toMatchObject({
      code: "conflict",
      fields: { email: "already in use" },
    });
  });

  it("the thrown error is a genuine ApiError instance, not a generic Error", async () => {
    const db = fakeRaceDb();
    const input: CreateUserInput = {
      orgId: "org1",
      email: "race2@example.com",
      role: "reviewer",
      passwordHash: "hash",
    };
    try {
      await createUser(db, input);
      expect.unreachable("createUser should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});

// ---------------------------------------------------------------------------
// Claim 2: src/routes/comms/send.ts:243-258 (bumpIcsSequences call) --
// RULED DELIBERATE that the bump stays unconditional over every id in
// input.submissionIds even when a submission's only recipient was skipped
// by dedupe. No existing test builds an attachIcs=true batch where a
// submission's sole recipient is deduped/skipped and then asserts the bump
// still ran for that submission's id.
// ---------------------------------------------------------------------------

vi.mock("../src/server/repo/ics-sequence", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/ics-sequence")>(
    "../src/server/repo/ics-sequence",
  );
  return { ...actual, bumpIcsSequences: vi.fn(async () => {}) };
});

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

// sub-1's only recipient sends cleanly; sub-2's only recipient shares the
// exact same address+subject, landing inside COMPOSE_DEDUPE_WINDOW_MS of a
// prior send logged for sub-1's recipient -- so sub-2 is fully skipped
// (zero mailer.send calls for it), while attachIcs is still true for both.
const submissions = [
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
    participants: [{ contactId: "ct-2", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" }],
  },
];

let loggedRows: { eventId: string; toEmail: string; subject: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return { ...actual, getEventForOrg: vi.fn(async () => event) };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async (_db: unknown, _eventId: string, ids: string[]) =>
      submissions.filter((s) => ids.includes(s.id)),
    ),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    // Both submissions are "scheduled" for the DEC-051 preflight so
    // attachIcs=true succeeds for the whole batch.
    loadIcsScheduleData: vi.fn(
      async () =>
        new Map(
          submissions.map((s) => [
            s.id,
            { submissionId: s.id, day: "2026-01-01", startMin: 60, endMin: 90, roomName: "Hall A", icsSequence: 0 },
          ]),
        ),
    ),
    findTemplateById: vi.fn(async () => null),
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
  return {
    KV: kv as unknown as AppEnv["Bindings"]["KV"],
    PUBLIC_BASE_URL: ORIGIN,
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"];
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

describe("send.ts unconditional bumpIcsSequences (DEC-238 wave-3 amendment RULING, src/routes/comms/send.ts:243-258)", () => {
  it("bumps a submission whose ONLY recipient was skipped by cross-call dedupe, same as one that actually sent", async () => {
    const { bumpIcsSequences } = await import("../src/server/repo/ics-sequence");
    const app = await buildCommsApp();
    const kv = new InMemoryKV();

    // First call: sends to grace@example.com under subject "Reminder",
    // logging the row loadRecentlySent will see on the second call.
    const first = await send(app, kv, {
      submissionIds: ["sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
      attachIcs: true,
    });
    expect(first.status).toBe(200);
    vi.mocked(bumpIcsSequences).mockClear();

    // Second call: both sub-1 (fresh recipient, sends) and sub-2 (same
    // recipient+subject within the dedupe window, fully skipped) selected
    // together with attachIcs=true.
    const second = await send(app, kv, {
      submissionIds: ["sub-1", "sub-2"],
      subject: "Reminder",
      bodyText: "Hi {speaker_name}.",
      attachIcs: true,
    });
    expect(second.status).toBe(200);
    const body = (await second.json()) as { sent: number; skipped: { submissionId: string }[]; failed: unknown[] };
    expect(body.sent).toBe(1);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0]!.submissionId).toBe("sub-2");

    // The RULING: bumpIcsSequences is called once for THIS send call, over
    // the full submissionIds set -- including sub-2, whose only recipient
    // never actually received mail this time.
    expect(bumpIcsSequences).toHaveBeenCalledTimes(1);
    const calledIds = vi.mocked(bumpIcsSequences).mock.calls[0]![1] as string[];
    expect(new Set(calledIds)).toEqual(new Set(["sub-1", "sub-2"]));
  });
});
