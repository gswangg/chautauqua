// DEC-147/DEC-148 regression coverage for task w2-a: per-round criteria
// overrides and the free-text criterion kind, end to end at the route layer.
// Repo calls are mocked (no D1/wrangler dependency in stage 1) -- same
// pattern as test/review-rounds.test.ts and test/plan-criteria-guard.test.ts.

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
    criteria: [
      { id: "c1", label: "Quality", kind: "rating", weight: 1 },
      { id: "notes", label: "Notes", kind: "text", required: false },
    ],
    rounds: 2,
    currentRound: 1,
    roundCriteria: {
      "2": [
        { id: "c2", label: "Round 2 quality", kind: "rating", weight: 2 },
        { id: "flag", label: "Escalation reason", kind: "text", required: true },
      ],
    },
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
    createPlan: vi.fn(async (_db: unknown, eventId: string, input: Record<string, unknown>) => ({
      ...makePlan(),
      eventId,
      ...input,
    })),
    updatePlan: vi.fn(async (_db: unknown, planId: string, patch: Record<string, unknown>) => {
      plan = { ...plan, ...patch } as typeof plan;
      return plan;
    }),
    planHasEvaluations: vi.fn(async () => false),
    advancePlanRound: vi.fn(async (_db: unknown, planId: string) => {
      if (planId !== plan.id) throw new Error("unknown plan");
      plan = { ...plan, currentRound: plan.currentRound + 1 };
      return plan;
    }),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
    listPlanFilteredSubmissions: vi.fn(async () => [submission]),
    resolveReviewerSubmissions: vi.fn(async () => [submission]),
    getSubmissionSummaryInEvent: vi.fn(async () => submission),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    isSubmissionInReviewerScope: vi.fn(async () => true),
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

describe("round-scoped criteria + free-text criterion (task w2-a)", () => {
  it("GET /api/v1/plans/:id returns the roundCriteria map", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { roundCriteria: Record<string, unknown> };
    expect(body.roundCriteria).toEqual(plan.roundCriteria);
  });

  it("POST create validates roundCriteria the same way as base criteria (rating needs weight > 0)", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        name: "New plan",
        scale: { min: 1, max: 5 },
        criteria: [{ id: "c1", label: "Q", kind: "rating", weight: 1 }],
        rounds: 2,
        roundCriteria: { "2": [{ id: "c2", label: "Bad", kind: "rating", weight: 0 }] },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.["roundCriteria.2"]).toBeTruthy();
  });

  it("POST create rejects a round key outside [1, rounds]", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        name: "New plan",
        scale: { min: 1, max: 5 },
        criteria: [{ id: "c1", label: "Q", kind: "rating", weight: 1 }],
        rounds: 2,
        roundCriteria: { "5": [{ id: "c2", label: "Ok", kind: "rating", weight: 1 }] },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roundCriteria).toBeTruthy();
  });

  it("PATCH accepts a valid roundCriteria map and it round-trips on GET", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        roundCriteria: { "2": [{ id: "c2", label: "Round 2", kind: "rating", weight: 5 }] },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { roundCriteria: Record<string, unknown> };
    expect(body.roundCriteria).toEqual({ "2": [{ id: "c2", label: "Round 2", kind: "rating", weight: 5 }] });
  });

  it("GET /api/v1/review/submissions/:id returns criteria resolved for the plan's active round (base, round 1)", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/submissions/${submission.id}?planId=${plan.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { criteria: { id: string }[] };
    expect(body.criteria.map((c) => c.id)).toEqual(["c1", "notes"]);
  });

  it("GET /api/v1/review/submissions/:id returns the round-2 override once the plan advances", async () => {
    const organizerApp = await buildApp(organizer);
    await organizerApp.request(`/api/v1/plans/${plan.id}/advance-round`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(plan.currentRound).toBe(2);

    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/submissions/${submission.id}?planId=${plan.id}`);
    const body = (await res.json()) as { criteria: { id: string }[] };
    expect(body.criteria.map((c) => c.id)).toEqual(["c2", "flag"]);
  });

  it("PUT evaluations validates against round 1's base criteria (round 1 has no override)", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 4, notes: "" } }),
    });
    expect(res.status).toBe(200);
    expect(store[0]?.scores).toEqual({ c1: 4, notes: "" });
  });

  it("PUT evaluations in round 1 rejects scores keyed to the round-2 override criteria", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c2: 5, flag: "x" } }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT evaluations after advancing to round 2 validates against the round-2 override, including the required text criterion", async () => {
    const organizerApp = await buildApp(organizer);
    await organizerApp.request(`/api/v1/plans/${plan.id}/advance-round`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });

    const app = await buildApp(reviewer);

    // Missing the required 'flag' text criterion (empty string) is rejected.
    const bad = await app.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c2: 3, flag: "" } }),
    });
    expect(bad.status).toBe(400);
    const badBody = (await bad.json()) as { error: { fields?: Record<string, string> } };
    expect(badBody.error.fields?.flag).toBeTruthy();

    // A non-empty text response roundtrips through the evaluation store.
    const ok = await app.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c2: 3, flag: "content mismatch" } }),
    });
    expect(ok.status).toBe(200);
    expect(store.find((e) => e.round === 2)?.scores).toEqual({ c2: 3, flag: "content mismatch" });
  });

  it("results aggregate round 1 and round 2 against their own resolved rating criteria", async () => {
    store = [
      { id: "ev-1", planId: plan.id, submissionId: submission.id, reviewerId: "rev-1", round: 1, scores: { c1: 4, notes: "" }, comment: null },
      { id: "ev-2", planId: plan.id, submissionId: submission.id, reviewerId: "rev-1", round: 2, scores: { c2: 3, flag: "ok" }, comment: null },
    ];
    const app = await buildApp(organizer);

    const r1 = await app.request(`/api/v1/plans/${plan.id}/results?round=1`);
    const r1Body = (await r1.json()) as { items: { average: number; perCriterion: Record<string, number> }[] };
    expect(r1Body.items[0]?.average).toBe(4);
    expect(r1Body.items[0]?.perCriterion).toEqual({ c1: 4 });

    const r2 = await app.request(`/api/v1/plans/${plan.id}/results?round=2`);
    const r2Body = (await r2.json()) as { items: { average: number; perCriterion: Record<string, number> }[] };
    expect(r2Body.items[0]?.average).toBe(3);
    expect(r2Body.items[0]?.perCriterion).toEqual({ c2: 3 });
  });
});
