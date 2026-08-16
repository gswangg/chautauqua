// DEC-596: GET /api/v1/submissions/:id/evaluations -- the organiser reads
// the same evaluation the reviewer wrote, org-scoped via getSubmissionOwnership.
// DEC-736: reviewerName is always populated, never null (anonymization hides
// the SPEAKER from the REVIEWER, never the reviewer from the organiser).
// DEC-723: each item carries its own round's criteria + the plan's weighted
// score. Repo calls are mocked so these are pure route-level tests (no
// D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as evaluationsRepo from "../src/server/repo/review/evaluations";
import * as reviewersRepo from "../src/server/repo/review/reviewers";

const ORG_A = "org-a";
const ORG_B = "org-b";
const SUBMISSION_ID = "sub-1";

const namedRow = {
  planId: "plan-1",
  planName: "Round 1 review",
  round: 1,
  reviewerName: "Jamie Reviewer",
  scores: { c1: 4 },
  comment: "Solid proposal, would love more detail on the demo.",
  submittedAt: 1_700_000_000_000,
};

// DEC-736: even a plan configured as anonymized still reports the
// reviewer's identity to the organiser -- there is no anonymized branch
// left to hide it.
const blindPlanRow = {
  planId: "plan-2",
  planName: "Blind review",
  round: 1,
  reviewerName: "blind-reviewer@example.com",
  scores: { c1: 2 },
  comment: "Scope is too broad for the slot.",
  submittedAt: 1_700_000_100_000,
};

const PLAN_CRITERIA = new Map([
  [
    "plan-1",
    {
      criteria: [{ id: "c1", label: "Clarity", kind: "rating" as const, weight: 1 }],
      roundCriteriaJson: null,
      scale: { min: 1, max: 5 },
    },
  ],
  [
    "plan-2",
    {
      criteria: [{ id: "c1", label: "Clarity", kind: "rating" as const, weight: 1 }],
      roundCriteriaJson: null,
      scale: { min: 1, max: 5 },
    },
  ],
]);

vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
    "../src/server/repo/submissions",
  );
  return {
    ...actual,
    getSubmissionOwnership: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID ? { eventId: "event-1", orgId: ORG_A } : null,
    ),
  };
});

vi.mock("../src/server/repo/review/evaluations", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/evaluations")>(
    "../src/server/repo/review/evaluations",
  );
  return {
    ...actual,
    listEvaluationsForSubmission: vi.fn(async (_db: unknown, _submissionId: string, planId?: string) =>
      planId ? [namedRow, blindPlanRow].filter((r) => r.planId === planId) : [namedRow, blindPlanRow],
    ),
    listPlanCriteriaByIds: vi.fn(async () => PLAN_CRITERIA),
  };
});

// DEC-763: getPlanForOrg backs the ?planId= ownership check -- plan-1
// belongs to event-1/ORG_A (the submission's own event/org); plan-9 exists
// but under a different event, so it must 404 rather than silently scope.
// DEC-596: `assigned` is the reviewer-assignment count, computed
// independently of listEvaluationsForSubmission's rows -- mocked separately
// so a test can prove assigned > items.length for an assigned-but-unscored
// reviewer without needing a real DB in this route-level suite (the SQL
// itself is exercised in test/count-assigned-reviewers.test.ts).
vi.mock("../src/server/repo/review/reviewers", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/reviewers")>(
    "../src/server/repo/review/reviewers",
  );
  return {
    ...actual,
    countAssignedReviewersForSubmission: vi.fn(async () => 3),
  };
});

vi.mock("../src/server/repo/review/plans", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/plans")>(
    "../src/server/repo/review/plans",
  );
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) => {
      if (planId === "plan-1" && orgId === ORG_A) return { id: "plan-1", eventId: "event-1" };
      if (planId === "plan-9" && orgId === ORG_A) return { id: "plan-9", eventId: "event-other" };
      return null;
    }),
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

describe("DEC-596/DEC-723/DEC-736: GET /api/v1/submissions/:id/evaluations", () => {
  it("organiser sees the full comment text, reviewer name, criteria, and score for a plan", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        reviewerName: string;
        comment: string | null;
        criteria: Array<{ id: string; label: string; kind: string; weight: number }>;
        score: number | null;
      }>;
      assigned: number;
    };
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      reviewerName: "Jamie Reviewer",
      comment: "Solid proposal, would love more detail on the demo.",
      criteria: [{ id: "c1", label: "Clarity", kind: "rating", weight: 1 }],
      score: 4,
    });
  });

  it("still reports the reviewer's identity for a plan configured as anonymized (DEC-736)", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ reviewerName: string; comment: string | null; score: number | null }> };
    expect(body.items[1]).toMatchObject({
      reviewerName: "blind-reviewer@example.com",
      comment: "Scope is too broad for the slot.",
      score: 2,
    });
  });

  it("score is null when a rating criterion has no value in scores (incomplete review)", async () => {
    vi.mocked(evaluationsRepo.listEvaluationsForSubmission).mockResolvedValue([
      { ...namedRow, scores: {} },
    ]);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    const body = (await res.json()) as { items: Array<{ score: number | null }> };
    expect(body.items[0]!.score).toBeNull();
  });

  it("score is null when the round's criteria have no rating criteria", async () => {
    vi.mocked(evaluationsRepo.listPlanCriteriaByIds).mockResolvedValue(
      new Map([
        [
          "plan-1",
          {
            criteria: [{ id: "c2", label: "Notes", kind: "text" as const }],
            roundCriteriaJson: null,
            scale: { min: 1, max: 5 },
          },
        ],
      ]),
    );
    vi.mocked(evaluationsRepo.listEvaluationsForSubmission).mockResolvedValue([namedRow]);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    const body = (await res.json()) as { items: Array<{ score: number | null; criteria: unknown[] }> };
    expect(body.items[0]!.score).toBeNull();
    expect(body.items[0]!.criteria).toEqual([{ id: "c2", label: "Notes", kind: "text", weight: 0 }]);
  });

  it("404s for an unknown submission", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/does-not-exist/evaluations`);
    expect(res.status).toBe(404);
  });

  it("404s when the submission belongs to a different org (existence-hiding, never 403)", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(404);
  });

  it("DEC-763: ?planId= scopes the disclosure -- plan B's row is absent when scoped, present unscoped", async () => {
    // vi.clearAllMocks() (afterEach) clears call history but not a prior
    // test's mockResolvedValue override -- reinstate the plan-scoping
    // implementation explicitly rather than relying on the factory default.
    vi.mocked(evaluationsRepo.listEvaluationsForSubmission).mockImplementation(
      async (_db: unknown, _submissionId: string, planId?: string) =>
        planId ? [namedRow, blindPlanRow].filter((r) => r.planId === planId) : [namedRow, blindPlanRow],
    );
    vi.mocked(evaluationsRepo.listPlanCriteriaByIds).mockResolvedValue(PLAN_CRITERIA);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });

    const scoped = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations?planId=plan-1`);
    expect(scoped.status).toBe(200);
    const scopedBody = (await scoped.json()) as { items: Array<{ planId: string }> };
    expect(scopedBody.items).toHaveLength(1);
    expect(scopedBody.items[0]!.planId).toBe("plan-1");
    expect(scopedBody.items.some((i) => i.planId === "plan-2")).toBe(false);

    const unscoped = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    const unscopedBody = (await unscoped.json()) as { items: Array<{ planId: string }> };
    expect(unscopedBody.items.map((i) => i.planId)).toEqual(["plan-1", "plan-2"]);
  });

  it("DEC-763: 404s when ?planId= refers to a plan outside the submission's own event", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations?planId=plan-9`);
    expect(res.status).toBe(404);
  });

  it("DEC-763: 404s when ?planId= refers to a plan that doesn't exist / belongs to another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations?planId=does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("DEC-596: `assigned` (reviewer count) rides the envelope and can exceed items.length -- an assigned-but-unscored reviewer is still counted", async () => {
    vi.mocked(reviewersRepo.countAssignedReviewersForSubmission).mockResolvedValue(3);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; assigned: number };
    expect(body.items).toHaveLength(2);
    expect(body.assigned).toBe(3);
    expect(body.assigned).toBeGreaterThan(body.items.length);
  });

  it("DEC-596: passes the submission's own eventId, submissionId, and ?planId= through to countAssignedReviewersForSubmission", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations?planId=plan-1`);
    expect(reviewersRepo.countAssignedReviewersForSubmission).toHaveBeenCalledWith(
      expect.anything(),
      "event-1",
      SUBMISSION_ID,
      "plan-1",
    );
  });

  it("401s when unauthenticated", async () => {
    const { reviewRoutes } = await import("../src/routes/review");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewRoutes);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(401);
  });
});
