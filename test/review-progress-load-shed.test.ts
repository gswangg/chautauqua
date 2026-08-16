// DEC-351/DEC-449 regression coverage: /plans/:id/progress and
// /plans/:id/remind must stop loading every evaluation row of the round --
// they source per-reviewer completed counts from
// repo.listEvaluatedPairsForPlan (DEC-707 wave-3 amendment: folded against
// each reviewer's own resolved-assigned set) instead of
// repo.listEvaluationsForPlan (full scored rows, which /results genuinely
// needs per DEC-345). This test asserts the
// wire response is byte-identical to the pre-fix shape for a plan with two
// reviewers, one recusal, and one reviewer at 2-of-3 completed, and that
// repo.listEvaluationsForPlan is never called by either route. Harness
// pattern copied from test/review-recusal.test.ts and
// test/review-remind-mailer-failure.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const plan = {
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
  roundCriteria: null,
  maxEvaluations: null,
};

const SUB_1 = { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] };
const SUB_2 = { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] };
const SUB_3 = { id: "sub-3", ref: "S-003", title: "Talk Three", description: null, trackIds: [] };
const SUBMISSIONS = [SUB_1, SUB_2, SUB_3];

// rev-1: unrestricted, recused from sub-3 -- assigned = 2 (sub-1, sub-2),
// completed 0.
// rev-2: unrestricted, no recusal -- assigned = 3, completed 2 (sub-1, sub-2)
// i.e. 2-of-3 completed.
const REVIEWER_ROWS = [
  { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
  { id: "pr-2", planId: plan.id, userId: "rev-2", trackId: null, submissionId: null },
];
const USERS = [
  { userId: "rev-1", email: "rev1@org.test" },
  { userId: "rev-2", email: "rev2@org.test" },
];
const RECUSALS = [{ id: "rc-1", planId: plan.id, submissionId: SUB_3.id, userId: "rev-1", reason: "conflict", createdAt: 1 }];
const EVALUATED_PAIRS = [
  { reviewerId: "rev-2", submissionId: SUB_1.id },
  { reviewerId: "rev-2", submissionId: SUB_2.id },
];

const listEvaluationsForPlan = vi.fn(async () => {
  throw new Error("listEvaluationsForPlan must not be called by /progress or /remind (DEC-351)");
});
const listEvaluatedPairsForPlan = vi.fn(async (_db: unknown, planId: string, round: number) =>
  planId === plan.id && round === plan.currentRound ? EVALUATED_PAIRS : [],
);

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
    getUsersByIds: vi.fn(async () => USERS),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    listRecusalsForPlan: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? RECUSALS : [])),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    listEvaluationsForPlan,
    listEvaluatedPairsForPlan,
  };
});

const sendMock = vi.fn(async () => {});

// B9 (DEC-037 amendment, wave 27): POST /remind names the event in the email
// shell's wordmark/footer, so the route makes one owned event lookup. This
// harness sets db to {} and mocks every repo module the route touches, so the
// events module has to be mocked here too or the real query hits the stub db.
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string) => ({ id: eventId, name: "Event One" })),
  };
});

// DEC-238 (wave-66 amendment): POST /plans/:id/remind now consults
// loadRecentlySent before sending -- this file's db stub is `{}`, so the
// real reader would throw; return an always-empty map so the dedupe check
// is a no-op here.
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

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

describe("DEC-351: /progress and /remind load-shedding is wire-identical", () => {
  it("GET /progress returns the pre-fix wire shape without calling listEvaluationsForPlan", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/progress`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { userId: string; email: string; assigned: number; completed: number; recused: number }[];
      total: number;
      page: number;
      perPage: number;
      round: number;
    };
    const byUser = new Map(body.items.map((i) => [i.userId, i]));
    expect(byUser.get("rev-1")).toEqual({
      userId: "rev-1",
      email: "rev1@org.test",
      name: null,
      assigned: 2,
      completed: 0,
      recused: 1,
      trackName: null,
    });
    expect(byUser.get("rev-2")).toEqual({
      userId: "rev-2",
      email: "rev2@org.test",
      name: null,
      assigned: 3,
      completed: 2,
      recused: 0,
      trackName: null,
    });
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    // DEC-466/DEC-461(e): /progress is now bounded (was the cosmetic
    // perPage: items.length shape) -- an absent ?perPage resolves to the
    // site default of 200 (MAX_PER_PAGE), not the item count.
    expect(body.perPage).toBe(200);
    expect(body.round).toBe(1);

    expect(listEvaluationsForPlan).not.toHaveBeenCalled();
    expect(listEvaluatedPairsForPlan).toHaveBeenCalledWith(expect.anything(), plan.id, plan.currentRound);
  });

  it("POST /remind returns the pre-fix {reminded, sent, failed} shape without calling listEvaluationsForPlan", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/remind`, {
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
    // Both reviewers are behind (rev-1: 0/2, rev-2: 2/3) so both are reminded.
    expect(new Set(body.reminded)).toEqual(new Set(["rev-1", "rev-2"]));
    expect(body.sent).toBe(2);
    expect(body.failed).toEqual([]);

    expect(listEvaluationsForPlan).not.toHaveBeenCalled();
    expect(listEvaluatedPairsForPlan).toHaveBeenCalledWith(expect.anything(), plan.id, plan.currentRound);
  });
});
