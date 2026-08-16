// DEC-238 class 2 coverage: POST /api/v1/plans/:id/remind is an
// organizer-triggered batch send. A single reviewer's mail failure must not
// 500 the whole run -- the route catches per-recipient and returns a
// structured 200 {reminded, sent, failed} summary. Repo/mail calls are
// mocked so this is a pure route-level contract test (no D1/wrangler
// dependency in stage 1), mirroring test/review-idor.test.ts's pattern.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const planRecord = {
  id: "plan-1",
  eventId: "event-1",
  name: "Plan One",
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
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    // DEC-271 (task w5-c): no recusals in these fixtures.
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: planRecord.id, userId: "rev-ok", trackId: null, submissionId: null },
      { id: "pr-2", planId: planRecord.id, userId: "rev-bad", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [
      { userId: "rev-ok", email: "ok@example.test" },
      { userId: "rev-bad", email: "bad@example.test" },
    ]),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
  };
});

const sendMock = vi.fn(async (input: { to: { email: string } }) => {
  if (input.to.email === "bad@example.test") throw new Error("mailer exploded");
});

// B9 (DEC-037 amendment, wave 27): the remind route now looks up the owning
// event's name for the shell's wordmark/footer via getEventForOrg -- mocked
// here since this test's db is a bare `{}` fake (no drizzle behind it).
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === planRecord.eventId && orgId === ORG_A ? { id: eventId, name: "Plan Event" } : null,
    ),
  };
});

// DEC-238 (wave-66 amendment): POST /plans/:id/remind now consults
// loadRecentlySent before sending -- this file's db stub is `{}`, so the
// real reader would throw; return an always-empty map (nothing is ever
// "recently sent" in this fixture) so the dedupe check is a no-op here.
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(async () => new Map()),
  };
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

describe("DEC-238: POST /api/v1/plans/:id/remind mailer-failure taxonomy", () => {
  it("200s with a structured {sent, failed} summary when one recipient's send throws", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      reminded: string[];
      sent: number;
      failed: { email: string; message: string }[];
    };
    expect(body.reminded).toEqual(["rev-ok"]);
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("bad@example.test");
    expect(body.failed[0]?.message).toContain("mailer exploded");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  // DEC-547 (wave-43 amendment) + DEC-707 (wave-61 amendment): makeMailer is
  // now total -- it never throws (a misconfigured environment returns an
  // UnconfiguredMailer whose .send() fails per-recipient instead). The
  // route's former defensive try/catch around the makeMailer(...) call was
  // therefore dead code and has been removed; a misconfigured environment
  // now surfaces through the SAME per-recipient try/catch exercised by the
  // "one recipient's send throws" case above, via UnconfiguredMailer.send
  // (DEC-923), not a separate construction-time guard.
});
