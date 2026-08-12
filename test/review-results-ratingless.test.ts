// DEC-212 regression coverage for task w22-b: a rating-less scorecard (all
// criteria are 'dropdown', no 'rating' criteria) must not 500 the results
// endpoint or its CSV. Before the fix, buildResults -> aggregateSubmission
// called computeWeightedScore per-eval with an empty rating-criteria list,
// which throws by design (an invariant guard, not a bug) -- the domain fix
// is a short-circuit in aggregateSubmission itself when criteria.length===0.
// Harness pattern copied from test/review-rounds.test.ts (mocked repo, no
// D1/wrangler dependency in stage 1).

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
    // Rating-less scorecard: a single 'dropdown' criterion, no 'rating' kind.
    criteria: [{ id: "decision", label: "Decision", kind: "dropdown", options: ["advance", "reject"] }],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    timezone: "UTC",
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
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
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
    // DEC-211: the PUT evaluations route resolves the submission inside the
    // plan's event before anything else, so the fake repo must answer it.
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
const reviewer: AuthInfo = { userId: "rev-1", role: "reviewer", orgId: ORG_A };

describe("DEC-212: rating-less scorecard results (task w22-b)", () => {
  it("GET results 200s with count 1 / average 0 after one dropdown-only evaluation", async () => {
    const reviewerApp = await buildApp(reviewer);

    const put = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { decision: "advance" } }),
    });
    expect(put.status).toBe(200);
    expect(store).toHaveLength(1);

    const organizerApp = await buildApp(organizer);
    const results = await organizerApp.request(`/api/v1/plans/${plan.id}/results`);
    expect(results.status).toBe(200);
    const body = (await results.json()) as { items: { count: number; average: number; perCriterion: Record<string, number> }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.count).toBe(1);
    expect(body.items[0]?.average).toBe(0);
    expect(body.items[0]?.perCriterion).toEqual({});
  });

  it("GET results?format=csv 200s with no per-criterion columns", async () => {
    const reviewerApp = await buildApp(reviewer);
    await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { decision: "reject" } }),
    });

    const organizerApp = await buildApp(organizer);
    const csvRes = await organizerApp.request(`/api/v1/plans/${plan.id}/results?format=csv`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    const csv = await csvRes.text();
    const [header, ...dataLines] = csv.trim().split(/\r?\n/);
    // No rating criteria, so no rating columns -- but DEC-241 adds one CSV
    // column per dropdown option, so the sole 'decision' criterion appears
    // as its two option columns instead of a rating column.
    expect(header).toBe("ref,title,count,average,Decision: advance,Decision: reject");
    expect(dataLines[0]).toBe("S-1,Talk,1,0,0,1");
  });
});
