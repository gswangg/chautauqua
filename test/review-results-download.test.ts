// DEC-425 (wave-64 amendment) regression coverage for task w64-b: GET
// /api/v1/plans/:id/results?format=csv is a download and must name its
// file, same as every other CSV/ICS/ZIP download in src/**. Harness pattern
// copied from test/review-results-ratingless.test.ts (mocked repo, no
// D1/wrangler dependency in stage 1) -- that file is NOT edited.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function makePlan() {
  return {
    id: "plan-1",
    eventId: "event-1",
    name: "Plan One",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "quality", label: "Quality", kind: "rating" }],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    timezone: "UTC",
  };
}

const plan = makePlan();
const submission = { id: "sub-1", ref: "S-1", title: "Talk", description: null, trackIds: [], status: "pending" };

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
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    listPlansForEvent: vi.fn(async () => [plan]),
    listPlanFilteredSubmissions: vi.fn(async () => [submission]),
    listSpeakerNamesForSubmissions: vi.fn(async () => new Map()),
    listTrackNamesForSubmissions: vi.fn(async () => new Map()),
    resolveReviewerSubmissions: vi.fn(async () => [submission]),
    listPlanIdsForReviewer: vi.fn(async () => []),
    listReviewerRowsForPlan: vi.fn(async () => []),
    getUsersByIds: vi.fn(async () => []),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluationScoresForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    getEvaluation: vi.fn(async () => null),
    countEvaluationsForSubmission: vi.fn(async () => 0),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      submissionId === submission.id && eventId === plan.eventId ? submission : null,
    ),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === plan.eventId && orgId === ORG_A ? { id: eventId, orgId } : null,
    ),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
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

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

describe("DEC-425 (wave 64): results CSV download names its file", () => {
  it("GET /api/v1/plans/:id/results?format=csv answers text/csv with attachment;filename=\"results.csv\"", async () => {
    const organizerApp = await buildApp(organizer);
    const csvRes = await organizerApp.request(`/api/v1/plans/${plan.id}/results?format=csv`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    const disposition = csvRes.headers.get("content-disposition");
    expect(disposition).toBeTruthy();
    expect(disposition).toContain("attachment");
    expect(disposition).toContain('filename="results.csv"');
  });
});
