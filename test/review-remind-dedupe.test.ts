// DEC-238 (wave-66 amendment): POST /plans/:id/remind reuses the SAME
// compose/send dedupe primitives (loadRecentlySent, dedupeCutoff, dedupeKey)
// keyed on (event, lower(email), the constant per-plan reminder subject) --
// mirrors test/comms-send-dedupe.test.ts's mocking technique (a stand-in
// email_log array that the mocked loadRecentlySent reads from, so a second
// route call sees the first call's "sent" row exactly as a real D1-backed
// reader would).

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

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: planRecord.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@example.test" }]),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    batchUserDisplayNames: vi.fn(async () => new Map()),
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

// Stand-in email_log rows the mocked mailer below writes to — the mocked
// repo.loadRecentlySent reader reads from this array, so a second POST
// /remind call sees the first call's sent row exactly as a real D1-backed
// reader would.
let loggedRows: { eventId: string; toEmail: string; subject: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
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

const sendMock = vi.fn(async (input: { to: { email: string }; subject: string }) => {
  loggedRows.push({ eventId: "event-1", toEmail: input.to.email, subject: input.subject, sentAt: Date.now() });
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: sendMock })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  loggedRows = [];
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

describe("DEC-238 (wave-66 amendment): POST /api/v1/plans/:id/remind dedupe", () => {
  it("two remind calls inside the window mail once and report the second as skipped: 1, sent: 0", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const first = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { reminded: string[]; sent: number; skipped: number; failed: unknown[]; remaining: number };
    expect(firstBody).toEqual({ reminded: ["rev-1"], sent: 1, skipped: 0, failed: [], remaining: 0 });
    expect(sendMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(t0 + 40_000); // 40s later, well inside the 1h window

    const second = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { reminded: string[]; sent: number; skipped: number; failed: unknown[]; remaining: number };
    expect(secondBody).toEqual({ reminded: [], sent: 0, skipped: 1, failed: [], remaining: 0 });
    // No new mail was sent on the second call.
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("a remind call outside the window is NOT skipped", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    vi.setSystemTime(t0 + 60 * 60 * 1000 + 1_000); // just past the 1h window

    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number };
    expect(body).toMatchObject({ sent: 1, skipped: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
