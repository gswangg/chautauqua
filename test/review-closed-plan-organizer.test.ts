// DEC-018 (wave-58 amendment): a closed review plan must admit an organizer
// to the queue the same way it already admits them to the per-submission
// detail route (:320 in src/routes/review/reviewer.ts) -- the queue's
// early-return at :154 used to gate every role identically, contradicting
// its own sibling and its own comment ("Organizers are exempt (same as the
// queue)"). This test asserts the two routes now agree on who is admitted,
// and that the queue's `open` flag stays truthful (never flipped to true for
// a closed plan) while `viewerIsOrganizer` is server-set and threaded
// through the shared shapeQueueEnvelope shaper on both branches.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const CLOSED_PLAN = {
  id: "plan-closed",
  eventId: "event-1",
  name: "Closed Plan",
  instructions: null,
  // well in the past -- plan is closed.
  openDate: Date.UTC(2020, 0, 1),
  closeDate: Date.UTC(2020, 0, 2),
  filters: null,
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
  rounds: 1,
  currentRound: 1,
  maxEvaluations: null,
  timezone: "UTC",
};

const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] },
];

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
      planId === CLOSED_PLAN.id && orgId === ORG_A ? CLOSED_PLAN : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === CLOSED_PLAN.id ? CLOSED_PLAN : null)),
    listPlanIdsForReviewer: vi.fn(async () => [CLOSED_PLAN.id]),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    countEvaluationsBySubmission: vi.fn(async () => new Map()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
    getReviewerScopeTrackIds: vi.fn(async () => []),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
    listSpeakerIdentitiesForSubmissions: vi.fn(async () => new Map()),
    getSubmissionSummaryInEvent: vi.fn(async () => ({
      id: "sub-1",
      ref: "S-001",
      title: "Talk One",
      description: null,
      trackIds: [],
    })),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    getEvaluation: vi.fn(async () => null),
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

describe("DEC-018 (wave-58 amendment): closed-plan queue admits organizers", () => {
  it("gives an organizer full queue rows on a closed plan, with open:false and viewerIsOrganizer:true", async () => {
    const app = await buildApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${CLOSED_PLAN.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string }[];
      open: boolean;
      viewerIsOrganizer: boolean;
    };
    expect(body.open).toBe(false);
    expect(body.viewerIsOrganizer).toBe(true);
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub-1"]);
  });

  it("gives a reviewer an empty queue on a closed plan, with open:false and viewerIsOrganizer:false", async () => {
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${CLOSED_PLAN.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: unknown[];
      open: boolean;
      viewerIsOrganizer: boolean;
    };
    expect(body.items).toEqual([]);
    expect(body.open).toBe(false);
    expect(body.viewerIsOrganizer).toBe(false);
  });

  it("agrees with the closed-plan detail route on who is admitted", async () => {
    const orgApp = await buildApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
    const orgDetailRes = await orgApp.request(
      `/api/v1/review/submissions/sub-1?planId=${CLOSED_PLAN.id}`,
    );
    expect(orgDetailRes.status).toBe(200);

    const reviewerApp = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const reviewerDetailRes = await reviewerApp.request(
      `/api/v1/review/submissions/sub-1?planId=${CLOSED_PLAN.id}`,
    );
    expect(reviewerDetailRes.status).toBe(409);
  });
});
