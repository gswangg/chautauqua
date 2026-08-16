// DEC-346 (wave-74 amendment): the cap filter at src/routes/review/
// reviewer.ts:242 (needsMoreRatings) can silently empty or shorten a
// reviewer's queue -- indistinguishable from a broken assignment without a
// count. `cappedOut` is scopedActionable.length - queueItems.length, both
// already-resolved arrays -- no new query. The PUT refusal for a
// deep-linked capped submission must say the same thing in the same words.
// Mirrors test/review-queue-totals.test.ts's and test/eval-scorecard-caps
// .test.ts's mocking patterns.

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
  roundCriteria: null,
  roundMeta: null,
  maxEvaluations: 2,
  anonymizedAt: null,
  createdAt: 0,
  updatedAt: 0,
  timezone: "UTC",
};

// 5 scoped submissions: 3 already carry 2 ratings each (at the cap) and are
// not rated by this reviewer, so the cap filter drops them; 2 have 0 ratings
// and stay actionable.
const SUBMISSIONS = Array.from({ length: 5 }, (_, i) => ({
  id: `sub-${i}`,
  ref: `S-${i}`,
  title: `Talk ${i}`,
  description: null,
  trackIds: [],
}));

const cappedIds = new Set(["sub-0", "sub-1", "sub-2"]);

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === planRecord.id ? planRecord : null)),
    listPlanIdsForReviewer: vi.fn(async () => [planRecord.id]),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === planRecord.eventId ? { id: submissionId, ref: "S-x", title: "Talk" } : null,
    ),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    countEvaluationsBySubmission: vi.fn(
      async () => new Map(SUBMISSIONS.map((s) => [s.id, cappedIds.has(s.id) ? 2 : 0])),
    ),
    countEvaluationsForSubmission: vi.fn(async (_db: unknown, _planId: string, submissionId: string) =>
      cappedIds.has(submissionId) ? 2 : 0,
    ),
    getEvaluation: vi.fn(async () => null),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
    getReviewerScopeTrackIds: vi.fn(async () => []),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
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

describe("DEC-346 (wave-74 amendment): reviewer queue cappedOut", () => {
  it("reports cappedOut as scopedActionable.length - queueItems.length, never a new query", async () => {
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; cappedOut: number };
    expect(body.items.length).toBe(2);
    expect(body.cappedOut).toBe(3);
  });

  it("reports cappedOut 0 on the closed-plan early return for a reviewer", async () => {
    const closedPlan = { ...planRecord, id: "plan-closed", closeDate: 1 };
    // Auth below is role: "reviewer", so requireAssignedPlan resolves via
    // getPlanById + listPlanIdsForReviewer -- getPlanForOrg is the
    // organizer-only branch and must NOT be given a mockImplementationOnce
    // here, or it sits queued and silently misfires the NEXT test that
    // actually calls it (an organizer request).
    const { getPlanById, listPlanIdsForReviewer } = await import("../src/server/repo/review");
    vi.mocked(getPlanById).mockImplementationOnce(async (_db, planId) =>
      planId === closedPlan.id ? (closedPlan as never) : null,
    );
    vi.mocked(listPlanIdsForReviewer).mockResolvedValueOnce([closedPlan.id]);
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${closedPlan.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cappedOut: number; items: unknown[] };
    expect(body.cappedOut).toBe(0);
    expect(body.items).toEqual([]);
  });
});

describe("DEC-346 (wave-74 amendment): capped-out PUT refusal matches the queue's own wording", () => {
  it("PUT /evaluations/:submissionId refuses a saturated submission with the queue's 'full set of reviews' sentence", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/evaluations/sub-0`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 3 } }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("This submission already has its full set of reviews");
  });
});
