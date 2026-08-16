// DEC-123 regression coverage (task w14-m): once any evaluation exists on a
// plan, PATCH /api/v1/plans/:id must refuse a criteria/scale shape change
// (409 conflict) so recorded evaluations can never be orphaned into a
// 500ing results surface (aggregateSubmission's fail-loudly throw in
// src/domain/evaluation.ts, which this guard exists to never reach).
// Identical (deep-equal) values are a no-op and still pass through, so
// full-object PATCHes from the admin SPA keep working. Repo calls are
// mocked (no D1/wrangler dependency in stage 1), same pattern as
// test/review-rounds.test.ts.

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
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    ...overrides,
  };
}

let plan = makePlan();
let hasEvaluations = false;
let evaluatedRounds: number[] = [];

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
    updatePlan: vi.fn(async (_db: unknown, planId: string, patch: Record<string, unknown>) => {
      plan = { ...plan, ...patch } as typeof plan;
      return plan;
    }),
    planHasEvaluations: vi.fn(async (_db: unknown, planId: string) => planId === plan.id && hasEvaluations),
    listRoundsWithEvaluations: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? evaluatedRounds : [])),
    listPlanFilteredSubmissions: vi.fn(async () => []),
    listSpeakerNamesForSubmissions: vi.fn(async () => new Map()),
    listTrackNamesForSubmissions: vi.fn(async () => new Map()),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluationScoresForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
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
  hasEvaluations = false;
  evaluatedRounds = [];
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

async function patchPlan(body: Record<string, unknown>) {
  const app = await buildApp(organizer);
  return app.request(`/api/v1/plans/${plan.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("DEC-123 plan criteria/scale immutability guard (task w14-m)", () => {
  it("replacing criteria on an evaluation-bearing plan returns 409, and results stays 200", async () => {
    hasEvaluations = true;
    const res = await patchPlan({
      criteria: [{ id: "c2", label: "Different", kind: "rating", weight: 1 }],
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
    // Plan is unchanged -- results still 200 (never orphaned).
    const app = await buildApp(organizer);
    const results = await app.request(`/api/v1/plans/${plan.id}/results`);
    expect(results.status).toBe(200);
  });

  it("replacing scale on an evaluation-bearing plan returns 409", async () => {
    hasEvaluations = true;
    const res = await patchPlan({ scale: { min: 0, max: 10 } });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
  });

  it("PATCH with deep-equal criteria (same shape, no-op) is a 200", async () => {
    hasEvaluations = true;
    const res = await patchPlan({
      criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    });
    expect(res.status).toBe(200);
  });

  it("PATCH with deep-equal scale (no-op) is a 200", async () => {
    hasEvaluations = true;
    const res = await patchPlan({ scale: { min: 1, max: 5 } });
    expect(res.status).toBe(200);
  });

  it("PATCH name-only (no criteria/scale keys) is a 200 even with evaluations present", async () => {
    hasEvaluations = true;
    const res = await patchPlan({ name: "Renamed plan" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("Renamed plan");
  });

  it("PATCH criteria on a plan with zero evaluations is a 200", async () => {
    hasEvaluations = false;
    const res = await patchPlan({
      criteria: [{ id: "c2", label: "Different", kind: "rating", weight: 1 }],
    });
    expect(res.status).toBe(200);
  });

  it("PATCH scale on a plan with zero evaluations is a 200", async () => {
    hasEvaluations = false;
    const res = await patchPlan({ scale: { min: 0, max: 10 } });
    expect(res.status).toBe(200);
  });

  // DEC-123 (amendment, wave 2, Scale-or-Choice v12 ruling): the v12
  // ruling's freeze rule is "the plan PATCH refuses a criterion TYPE change
  // once any evaluation exists" -- a kind flip is a criteria shape change
  // like any other, already covered by plans-crud.ts's whole-array
  // deepEqual guard (:157-170); this test exists so a refactor of that
  // guard can never narrow it to skip a kind-only diff.
  it("flipping a criterion's kind from rating to dropdown on an evaluation-bearing plan returns 409", async () => {
    hasEvaluations = true;
    const res = await patchPlan({
      criteria: [{ id: "c1", label: "Quality", kind: "dropdown", options: ["low", "high"] }],
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
  });

  it("editing a Choice criterion's OPTIONS on an unfrozen (zero-evaluation) plan succeeds", async () => {
    plan = makePlan({
      criteria: [{ id: "d1", label: "Choice", kind: "dropdown", options: ["low", "high"] }],
    });
    hasEvaluations = false;
    const res = await patchPlan({
      criteria: [{ id: "d1", label: "Choice", kind: "dropdown", options: ["low", "medium", "high"] }],
    });
    expect(res.status).toBe(200);
  });
});

describe("DEC-213 per-round criteria freeze guard (task w22-c)", () => {
  it("changing a round-1 override when round 1 has evaluations returns 409", async () => {
    plan = makePlan({
      rounds: 2,
      currentRound: 1,
      roundCriteria: { "1": [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }] },
    });
    hasEvaluations = true;
    evaluatedRounds = [1];
    const res = await patchPlan({
      roundCriteria: { "1": [{ id: "c1", label: "Quality Renamed", kind: "rating", weight: 1 }] },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
  });

  it("byte-identical no-op round-1 override on an evaluated round is a 200", async () => {
    plan = makePlan({
      rounds: 2,
      currentRound: 1,
      roundCriteria: { "1": [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }] },
    });
    hasEvaluations = true;
    evaluatedRounds = [1];
    const res = await patchPlan({
      roundCriteria: { "1": [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }] },
    });
    expect(res.status).toBe(200);
  });

  it("adding a round-2 override on a 2-round plan with only round-1 evaluations is a 200", async () => {
    plan = makePlan({
      rounds: 2,
      currentRound: 1,
      roundCriteria: null,
    });
    hasEvaluations = true;
    evaluatedRounds = [1];
    const res = await patchPlan({
      roundCriteria: { "2": [{ id: "c2", label: "Impact", kind: "rating", weight: 1 }] },
    });
    expect(res.status).toBe(200);
  });

  it("clearing roundCriteria (null) when an overridden round has evaluations and resolution would change returns 409", async () => {
    plan = makePlan({
      rounds: 2,
      currentRound: 1,
      roundCriteria: { "1": [{ id: "c1", label: "Round 1 Override", kind: "rating", weight: 1 }] },
    });
    hasEvaluations = true;
    evaluatedRounds = [1];
    const res = await patchPlan({ roundCriteria: null });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
  });
});
