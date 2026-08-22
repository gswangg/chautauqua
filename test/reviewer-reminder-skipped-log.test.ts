// DEC-238 (wave-132 amendment): the reviewer-reminder path
// (src/routes/review/plans-progress.ts POST /api/v1/plans/:id/remind) must
// write the comms-history row its own `skipped` count promises -- mirrors
// src/routes/comms/send.ts:279-299's per-skipped-recipient write through
// the SAME d1EmailLogWriter, carrying the SAME batchId the fan-out uses.
// Mocking technique follows test/review-remind-dedupe.test.ts: a stand-in
// email_log array the mocked loadRecentlySent reads from, plus a mocked
// d1EmailLogWriter that records every write call so this test can assert on
// the skipped row's shape directly (status/batchId/bodyText/contactId).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { dedupeKey } from "../src/domain/comms-dedupe";

const ORG_A = "org-a";

const planRecord = {
  id: "plan-1",
  eventId: "event-1",
  name: "Laggard Plan",
  instructions: null,
  openDate: null,
  closeDate: null,
  filters: null,
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
  rounds: 1,
  currentRound: 1,
  maxEvaluations: null,
};

const SUBMISSIONS = [{ id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] }];

const REVIEWER_ROWS = [
  { id: "pr-1", planId: planRecord.id, userId: "rev-1", trackId: null, submissionId: null },
  { id: "pr-2", planId: planRecord.id, userId: "rev-2", trackId: null, submissionId: null },
];

const USERS = [
  { userId: "rev-1", email: "rev1@example.test" },
  { userId: "rev-2", email: "rev2@example.test" },
];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
    getUsersByIds: vi.fn(async () => USERS),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    batchUserDisplayNames: vi.fn(
      async () =>
        new Map([
          ["rev-1", "Reviewer One"],
          ["rev-2", "Reviewer Two"],
        ]),
    ),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
    getTrackNamesByIds: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string) => ({ id: eventId, name: "Event One" })),
  };
});

// Stand-in prior email_log rows the mocked repo.loadRecentlySent reads from
// -- pre-seeded (not sent through this test's own call) so exactly ONE of
// the two reviewers is inside the dedupe window when the single POST
// /remind call under test fires.
const REMINDER_SUBJECT = `Reminder: ${planRecord.name} review queue`;
let priorSentRows: { eventId: string; toEmail: string; subject: string; bodyText: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(
      async (
        _db: unknown,
        eventId: string,
        keys: { email: string; subject: string; body: string }[],
        cutoffMs: number,
      ) => {
        const map = new Map<string, number>();
        for (const row of priorSentRows) {
          if (row.eventId !== eventId) continue;
          if (row.sentAt < cutoffMs) continue;
          const hit = keys.some(
            (k) =>
              k.email.trim().toLowerCase() === row.toEmail.trim().toLowerCase() &&
              k.subject === row.subject &&
              k.body === row.bodyText,
          );
          if (!hit) continue;
          const key = dedupeKey(row.toEmail, row.subject, row.bodyText);
          const existing = map.get(key);
          if (existing === undefined || row.sentAt > existing) map.set(key, row.sentAt);
        }
        return map;
      },
    ),
  };
});

const sendMock = vi.fn(
  async (_input: { to: { email: string; name: string }; subject: string; text: string; batchId: string }) => {},
);

type LoggedWrite = {
  eventId: string;
  contactId: string | null;
  templateId: string | null | undefined;
  batchId: string | null | undefined;
  toEmail: string;
  toName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  provider: string;
  status: string;
  sentAt: number;
};
let writtenRows: LoggedWrite[] = [];
const writeMock = vi.fn(async (row: LoggedWrite) => {
  writtenRows.push(row);
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: sendMock })),
    d1EmailLogWriter: vi.fn(() => ({ write: writeMock })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  priorSentRows = [];
  writtenRows = [];
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

async function buildApp(auth: AuthInfo) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { DEV_MODE: "1" } as never;
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

describe("DEC-238 (wave-132 amendment): POST /api/v1/plans/:id/remind writes a skipped email_log row", () => {
  it("writes exactly one status:skipped row, matching the sent recipient's body, batch and eventId, with contactId null", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    // DEC-936 (wave-17 amendment): the dedupe key now includes the rendered
    // body, so `priorSentRows`' bodyText must be BYTE-IDENTICAL to what
    // production's reminderText(laggard) renders for rev-1's shape (one
    // assignment, zero completed -- the same shape rev-2 has). A dry-run
    // call (nothing in the window yet) captures that exact string from the
    // real send, rather than this test re-deriving the formula itself.
    const warmup = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(warmup.status).toBe(200);
    const warmupRev1Call = sendMock.mock.calls.find(
      (call) => (call[0] as { to: { email: string } }).to.email === "rev1@example.test",
    )!;
    const rev1BodyText = (warmupRev1Call[0] as { text: string }).text;
    vi.clearAllMocks();
    writtenRows = [];

    // rev-1 already got this exact reminder 40s ago -- inside the dedupe
    // window -- so this call must report it skipped, not sent.
    priorSentRows = [
      { eventId: planRecord.eventId, toEmail: "rev1@example.test", subject: REMINDER_SUBJECT, bodyText: rev1BodyText, sentAt: t0 - 40_000 },
    ];

    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[]; sent: number; skipped: number; failed: unknown[]; remaining: number };
    expect(body.skipped).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.reminded).toEqual(["rev-2"]);

    // Exactly one send went out (to rev-2, the non-skipped laggard).
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentCall = sendMock.mock.calls[0]![0] as { to: { email: string }; text: string; batchId: string };
    expect(sentCall.to.email).toBe("rev2@example.test");

    // Exactly one email_log row was written for the skipped recipient.
    expect(writeMock).toHaveBeenCalledTimes(1);
    const skippedRow = writtenRows[0]!;
    expect(skippedRow.status).toBe("skipped");
    expect(skippedRow.toEmail).toBe("rev1@example.test");
    expect(skippedRow.contactId).toBeNull();
    expect(skippedRow.eventId).toBe(planRecord.eventId);
    expect(skippedRow.subject).toBe(REMINDER_SUBJECT);
    expect(skippedRow.bodyHtml).toBe("");
    expect(skippedRow.provider).toBe("none");
    // Same batchId as the fan-out send -- the comms history groups the
    // whole send (sent + skipped) into one batch.
    expect(skippedRow.batchId).toBe(sentCall.batchId);
    // Both reviewers have the identical assigned/completed shape (one
    // assignment, zero completed), so the skipped row's body must be
    // byte-identical to the text the sent recipient's body template
    // produces for that same shape.
    expect(skippedRow.bodyText).toBe(sentCall.text);
  });

  it("negative control: with nothing in the dedupe window, no skipped row is written", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    vi.setSystemTime(1_700_000_000_000);
    priorSentRows = [];

    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number };
    expect(body.sent).toBe(2);
    expect(body.skipped).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(writeMock).not.toHaveBeenCalled();
  });
});
