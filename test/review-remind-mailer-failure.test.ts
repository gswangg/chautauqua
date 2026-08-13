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
    listCompletedPairsForPlan: vi.fn(async () => []),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
  };
});

const sendMock = vi.fn(async (input: { to: { email: string } }) => {
  if (input.to.email === "bad@example.test") throw new Error("mailer exploded");
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

  // DEC-547 (w43-b): makeMailer itself throws when the environment isn't
  // configured for sending — that's a config-level failure, not a
  // per-recipient one, so the per-recipient try inside the loop can never
  // catch it. The route must guard the construction too: a 200 envelope
  // reporting every laggard as 'failed', never a 500.
  it("200s with every laggard reported 'failed' when makeMailer itself throws (misconfigured env)", async () => {
    const { makeMailer } = await import("../src/server/context");
    vi.mocked(makeMailer).mockImplementation(() => {
      throw new Error("RESEND_API_KEY is not configured");
    });
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
    expect(body.sent).toBe(0);
    expect(body.reminded).toEqual([]);
    expect(body.failed).toHaveLength(2);
    expect(body.failed.map((f) => f.email).sort()).toEqual(["bad@example.test", "ok@example.test"]);
    for (const f of body.failed) expect(f.message).toContain("RESEND_API_KEY is not configured");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
