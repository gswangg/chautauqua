// DEC-635 (amendment, wave 50): POST /api/v1/plans/:id/remind reads its
// optional body through readOptionalJsonBody (src/server/http.ts). A
// syntactically invalid body must land on the house 400 `invalid` envelope
// (never an uncaught SyntaxError -> 500 `internal`), and an absent body must
// still succeed with the default scope -- that path is load-bearing (the
// landing page's tertiary "remind everyone incomplete" link posts no body).
// Harness mirrors test/review-remind-scope.test.ts.

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

const REVIEWER_ROWS = [
  { id: "pr-1", planId: planRecord.id, userId: "rev-not-started", trackId: null, submissionId: null },
];
const USERS = [{ userId: "rev-not-started", email: "not-started@example.test" }];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
    getUsersByIds: vi.fn(async () => USERS),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    listPlanFilteredSubmissions: vi.fn(async () => []),
  };
});

const sendMock = vi.fn(async () => {});

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

describe("DEC-635 amendment: POST /api/v1/plans/:id/remind optional body guard", () => {
  it("a syntactically invalid body returns 400 {error:{code:'invalid'}}, not a 500", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });

  it("an absent body still succeeds with the default scope", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(200);
  });
});
