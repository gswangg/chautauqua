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
    listEvaluationsForSubmission: vi.fn(async () => [namedRow, blindPlanRow]),
    listPlanCriteriaByIds: vi.fn(async () => PLAN_CRITERIA),
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

  it("403s when the submission belongs to a different org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(403);
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
