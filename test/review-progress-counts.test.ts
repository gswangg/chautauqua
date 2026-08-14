// DEC-707 (wave-3 amendment): the plan-progress envelope's sibling counts
// share ONE predicate -- `completed` is a subset of `assigned`. Prior to
// this fix, GET /plans/:id/progress computed `assigned` from
// resolveAssignments over the plan-filtered set MINUS recusals, while
// `completed` came from an unrestricted per-plan evaluation count that also
// counted evaluations on submissions the reviewer is no longer assigned,
// has recused from, or that the plan's filters no longer select -- the
// '37 of 34 evaluations in' bug (SBEK run-4 P2). This test pins a reviewer
// with evaluations on a RECUSED submission and on a submission OUTSIDE the
// plan's filtered scope: neither may count toward `completed`, and
// `completed <= assigned` holds as an asserted invariant. It also pins the
// wave-72 companion: the envelope carries `submissionsInScope`, the same
// plan-filtered count the route already loads for assignment resolution.
// Mocked repo/mailer, harness pattern copied from
// test/review-progress-load-shed.test.ts.

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

// The plan's filtered scope is 3 submissions (sub-1, sub-2, sub-3);
// sub-4-out-of-scope simulates a submission the plan's own filters no
// longer select (e.g. moved out of an included track) but which still
// carries a stale evaluation row from before that change.
const SUB_1 = { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] };
const SUB_2 = { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] };
const SUB_3 = { id: "sub-3", ref: "S-003", title: "Talk Three", description: null, trackIds: [] };
const SUBMISSIONS = [SUB_1, SUB_2, SUB_3];

// rev-1: unrestricted (assigned to every plan-filtered submission), recused
// from sub-3 -- assigned = 2 (sub-1, sub-2).
const REVIEWER_ROWS = [{ id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null }];
const USERS = [{ userId: "rev-1", email: "rev1@org.test" }];
const RECUSALS = [{ id: "rc-1", planId: plan.id, submissionId: SUB_3.id, userId: "rev-1", reason: "conflict", createdAt: 1 }];

// rev-1 has evaluated: sub-1 (in their assigned set -- counts), sub-3
// (recused -- must NOT count), and sub-4-out-of-scope (not in the plan's
// filtered submissions at all -- must NOT count). A raw per-plan count
// would report completed=3 against assigned=2 -- the '37 of 34' shape.
const EVALUATED_PAIRS = [
  { reviewerId: "rev-1", submissionId: SUB_1.id },
  { reviewerId: "rev-1", submissionId: SUB_3.id },
  { reviewerId: "rev-1", submissionId: "sub-4-out-of-scope" },
];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
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
    listRecusalsForPlan: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? RECUSALS : [])),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    listEvaluatedPairsForPlan: vi.fn(async () => EVALUATED_PAIRS),
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

describe("DEC-707 (wave-3 amendment): completed is a subset of assigned, and submissionsInScope rides the envelope", () => {
  it("a reviewer with evaluations on a recused and an out-of-scope submission reports completed <= assigned, never a raw per-plan count", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/progress`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { userId: string; assigned: number; completed: number; recused: number }[];
      submissionsInScope: number;
    };
    const row = body.items.find((i) => i.userId === "rev-1");
    expect(row).toBeDefined();
    // assigned = sub-1, sub-2 (sub-3 excluded by recusal).
    expect(row!.assigned).toBe(2);
    expect(row!.recused).toBe(1);
    // completed counts ONLY sub-1 -- sub-3 is recused, sub-4-out-of-scope
    // isn't in this reviewer's assigned set at all. A raw per-plan
    // evaluation count would have reported 3 here.
    expect(row!.completed).toBe(1);
    // The invariant DEC-707's wave-3 amendment asserts.
    expect(row!.completed).toBeLessThanOrEqual(row!.assigned);

    // DEC-745 wave-72: the envelope carries submissionsInScope off the same
    // plan-filtered load, zero extra queries.
    expect(body.submissionsInScope).toBe(3);
  });
});
