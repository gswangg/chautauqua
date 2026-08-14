// DEC-845 amendment (wave 38): the reviewer queue must tell the truth about
// its size past row 200 -- MAX_PER_PAGE. A reviewer scope of 250 actionable
// submissions must report a full 250 as `total`, a true `unscoredTotal`
// computed from the FULL items array (not the page slice), and page 2 must
// return the disjoint remaining 50 rows with an IDENTICAL total/unscoredTotal
// (both are whole-scope facts, not per-page facts). Mirrors
// test/review-queue-shape.test.ts's mocking pattern (repo calls mocked, no
// D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const SCOPE_SIZE = 250;

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
  timezone: "UTC",
};

// 250 actionable submissions, none rated by anyone yet -- buildReviewerQueue
// keeps its input order when every item ties on ratingsCount, so the ids
// below double as the expected queue order.
const SUBMISSIONS = Array.from({ length: SCOPE_SIZE }, (_, i) => ({
  id: `sub-${String(i).padStart(3, "0")}`,
  ref: `S-${String(i).padStart(3, "0")}`,
  title: `Talk ${i}`,
  description: null,
  trackIds: [],
}));

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
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    countEvaluationsBySubmission: vi.fn(async () => new Map()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
    getReviewerScopeTrackId: vi.fn(async () => null),
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

describe("DEC-845 amendment (wave 38): reviewer queue totals past row 200", () => {
  it("page 1 clamps to 200 items but reports total 250 and a true unscoredTotal", async () => {
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string }[];
      total: number;
      unscoredTotal: number;
      page: number;
      perPage: number;
    };
    expect(body.items.length).toBe(200);
    expect(body.total).toBe(SCOPE_SIZE);
    expect(body.unscoredTotal).toBe(SCOPE_SIZE);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(200);
  });

  it("page 2 returns the disjoint remaining 50, with identical total/unscoredTotal", async () => {
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res1 = await app.request(`/api/v1/review/plans/${planRecord.id}/queue?page=1`);
    const body1 = (await res1.json()) as { items: { submissionId: string }[]; total: number; unscoredTotal: number };
    const res2 = await app.request(`/api/v1/review/plans/${planRecord.id}/queue?page=2`);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { items: { submissionId: string }[]; total: number; unscoredTotal: number };

    expect(body2.items.length).toBe(SCOPE_SIZE - 200);
    expect(body2.total).toBe(SCOPE_SIZE);
    expect(body2.unscoredTotal).toBe(SCOPE_SIZE);

    const page1Ids = new Set(body1.items.map((i) => i.submissionId));
    const page2Ids = new Set(body2.items.map((i) => i.submissionId));
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }
    expect(page1Ids.size + page2Ids.size).toBe(SCOPE_SIZE);
  });

  it("unscoredTotal reflects already-rated rows even though they never leave the queue", async () => {
    const { listSubmissionIdsRatedBy } = await import("../src/server/repo/review");
    // The first 60 submissions (by scope order) are already rated by this
    // reviewer -- they stay in the queue (DEC-561) but must not count
    // toward unscoredTotal.
    const ratedIds = new Set(SUBMISSIONS.slice(0, 60).map((s) => s.id));
    vi.mocked(listSubmissionIdsRatedBy).mockResolvedValueOnce(ratedIds);
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; unscoredTotal: number };
    expect(body.total).toBe(SCOPE_SIZE);
    expect(body.unscoredTotal).toBe(SCOPE_SIZE - 60);
  });
});
