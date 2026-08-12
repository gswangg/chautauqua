// DEC-241 (ABS-10) coverage for task w1-h: the results endpoint's Average
// stays rating-only when a plan mixes 'rating' and 'dropdown' criteria, and
// each dropdown criterion gets its own perDropdown distribution + modal,
// both in the JSON response and as extra CSV option columns. Harness
// pattern copied from test/review-results-ratingless.test.ts (mocked repo,
// no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function makePlan(overrides: Partial<Record<string, unknown>> = {}) {
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
    // Mixed scorecard: one 'rating' criterion, one 'dropdown' criterion.
    criteria: [
      { id: "quality", label: "Quality", kind: "rating", weight: 1 },
      { id: "length", label: "Talk length", kind: "dropdown", options: ["Too short", "Just right", "Too long"] },
    ],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    ...overrides,
  };
}

let plan = makePlan();

interface FakeEvaluation {
  id: string;
  planId: string;
  submissionId: string;
  reviewerId: string;
  round: number;
  scores: Record<string, number | string>;
  comment: string | null;
}

let store: FakeEvaluation[] = [];
let nextId = 1;

const submission = { id: "sub-1", ref: "S-1", title: "Talk", description: null, trackIds: [] };

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
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    listPlansForEvent: vi.fn(async () => [plan]),
    listPlanFilteredSubmissions: vi.fn(async () => [submission]),
    resolveReviewerSubmissions: vi.fn(async () => [submission]),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) =>
      userId === "rev-1" || userId === "rev-2" ? [plan.id] : [],
    ),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
      { id: "pr-2", planId: plan.id, userId: "rev-2", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [
      { userId: "rev-1", email: "rev1@org.test" },
      { userId: "rev-2", email: "rev2@org.test" },
    ]),
    listEvaluationsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store.filter((e) => e.planId === planId && e.round === round),
    ),
    listEvaluationScoresForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ submissionId: e.submissionId, scores: e.scores })),
    ),
    listCompletedPairsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ reviewerId: e.reviewerId, submissionId: e.submissionId })),
    ),
    getEvaluation: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, reviewerId: string, round: number) =>
        store.find(
          (e) => e.planId === planId && e.submissionId === submissionId && e.reviewerId === reviewerId && e.round === round,
        ) ?? null,
    ),
    countEvaluationsForSubmission: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, round: number) =>
        store.filter((e) => e.planId === planId && e.submissionId === submissionId && e.round === round).length,
    ),
    upsertEvaluation: vi.fn(async (_db: unknown, input: Omit<FakeEvaluation, "id">) => {
      const existing = store.find(
        (e) =>
          e.planId === input.planId &&
          e.submissionId === input.submissionId &&
          e.reviewerId === input.reviewerId &&
          e.round === input.round,
      );
      if (existing) {
        existing.scores = input.scores;
        existing.comment = input.comment ?? null;
        return existing;
      }
      const created: FakeEvaluation = { id: `ev-${nextId++}`, ...input, comment: input.comment ?? null };
      store.push(created);
      return created;
    }),
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
  plan = makePlan();
  store = [];
  nextId = 1;
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
const reviewer1: AuthInfo = { userId: "rev-1", role: "reviewer", orgId: ORG_A };
const reviewer2: AuthInfo = { userId: "rev-2", role: "reviewer", orgId: ORG_A };

async function submitEval(auth: AuthInfo, scores: Record<string, unknown>) {
  const app = await buildApp(auth);
  const res = await app.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ scores }),
  });
  expect(res.status).toBe(200);
}

describe("DEC-241: mixed rating+dropdown results (task w1-h)", () => {
  it("Average ignores the dropdown criterion while perDropdown carries its distribution", async () => {
    await submitEval(reviewer1, { quality: 5, length: "Just right" });
    await submitEval(reviewer2, { quality: 3, length: "Just right" });

    const organizerApp = await buildApp(organizer);
    const results = await organizerApp.request(`/api/v1/plans/${plan.id}/results`);
    expect(results.status).toBe(200);
    const body = (await results.json()) as {
      items: {
        count: number;
        average: number;
        perCriterion: Record<string, number>;
        perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
      }[];
    };
    expect(body.items).toHaveLength(1);
    const row = body.items[0]!;
    // Average is the rating-only weighted mean of 5 and 3 -- unaffected by
    // the dropdown answers.
    expect(row.average).toBe(4);
    expect(row.perCriterion).toEqual({ quality: 4 });
    expect(row.perDropdown.quality).toBeUndefined();
    expect(row.perDropdown["length"]).toEqual({
      counts: { "Too short": 0, "Just right": 2, "Too long": 0 },
      modal: "Just right",
    });
  });

  it("CSV includes one column per dropdown option alongside rating columns", async () => {
    await submitEval(reviewer1, { quality: 5, length: "Too short" });
    await submitEval(reviewer2, { quality: 3, length: "Too long" });

    const organizerApp = await buildApp(organizer);
    const csvRes = await organizerApp.request(`/api/v1/plans/${plan.id}/results?format=csv`);
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    const [header, ...dataLines] = csv.trim().split(/\r?\n/);
    expect(header).toBe(
      "ref,title,count,average,Quality,Talk length: Too short,Talk length: Just right,Talk length: Too long",
    );
    expect(dataLines[0]).toBe("S-1,Talk,2,4,4,1,0,1");
  });
});
