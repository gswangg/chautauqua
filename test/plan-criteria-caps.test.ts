// DEC-422 (amendment, wave 2) regression coverage for task w2-d: the plan
// editor's criteria cap (MAX_PLAN_CRITERIA), a criterion id's length cap,
// and a dropdown criterion's option-count/option-length caps were
// previously enforced ONLY by the SPA (app/src/pages/review/PlanEditor.tsx's
// local `MAX_CRITERIA = 7`) -- the server accepted anything. This exercises
// src/routes/review/shared.ts's parseCriteriaList through both callers:
// POST .../plans (base criteria) and PATCH .../plans/:id (roundCriteria
// override). Repo calls are mocked (no D1/wrangler dependency in stage 1),
// same pattern as test/plan-criteria-guard.test.ts and test/round-criteria.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_PLAN_CRITERIA, MAX_CRITERION_OPTIONS, MIN_CRITERION_OPTIONS } from "../src/domain/evaluation";
// DEC-422 amendment: the refusal copy is the ONE cap grammar from
// cap-copy.ts, so these assertions compose the expected string the same way
// the route does rather than hand-writing a second copy of the prose.
import { overCapCountMessage } from "../src/domain/cap-copy";

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
    rounds: 2,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    timezone: "UTC",
    ...overrides,
  };
}

let plan = makePlan();

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
    listRoundsWithEvaluations: vi.fn(async () => []),
    countEvaluationsByRound: vi.fn(async () => ({})),
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

function ratingCriterion(id: string) {
  return { id, label: id, kind: "rating", weight: 1 };
}

async function createPlan(body: Record<string, unknown>) {
  const app = await buildApp(organizer);
  return app.request(`/api/v1/events/${plan.eventId}/plans`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

async function patchPlan(body: Record<string, unknown>) {
  const app = await buildApp(organizer);
  return app.request(`/api/v1/plans/${plan.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("DEC-422 (amendment, wave 2): parseCriteriaList enforces MAX_PLAN_CRITERIA server-side", () => {
  it("POST base criteria at MAX_PLAN_CRITERIA is accepted", async () => {
    const criteria = Array.from({ length: MAX_PLAN_CRITERIA }, (_, i) => ratingCriterion(`c${i}`));
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(201);
  });

  it("POST base criteria exceeding MAX_PLAN_CRITERIA is refused with a 400", async () => {
    const criteria = Array.from({ length: MAX_PLAN_CRITERIA + 1 }, (_, i) => ratingCriterion(`c${i}`));
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.criteria).toBe(
      overCapCountMessage(MAX_PLAN_CRITERIA + 1, MAX_PLAN_CRITERIA, "criterion", "criteria"),
    );
  });

  it("PATCH roundCriteria override exceeding MAX_PLAN_CRITERIA is refused with a 400, under its own roundCriteria.<round> key", async () => {
    const criteria = Array.from({ length: MAX_PLAN_CRITERIA + 1 }, (_, i) => ratingCriterion(`c${i}`));
    const res = await patchPlan({ roundCriteria: { "2": criteria } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.["roundCriteria.2"]).toBe(
      overCapCountMessage(MAX_PLAN_CRITERIA + 1, MAX_PLAN_CRITERIA, "criterion", "criteria"),
    );
    // base plan.criteria error key must never collide with a round override's key
    expect(body.error.fields?.criteria).toBeUndefined();
  });

  it("POST rejects a criterion id longer than MAX_NAME_LENGTH", async () => {
    const criteria = [ratingCriterion("c".repeat(500))];
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(400);
  });

  it("POST rejects a dropdown criterion with more than MAX_CRITERION_OPTIONS options", async () => {
    const options = Array.from({ length: MAX_CRITERION_OPTIONS + 1 }, (_, i) => `opt-${i}`);
    const criteria = [{ id: "d1", label: "Dropdown", kind: "dropdown", options }];
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.criteria).toContain(
      overCapCountMessage(MAX_CRITERION_OPTIONS + 1, MAX_CRITERION_OPTIONS, "option"),
    );
  });

  it("POST rejects a dropdown criterion option longer than MAX_NAME_LENGTH", async () => {
    const criteria = [{ id: "d1", label: "Dropdown", kind: "dropdown", options: ["ok", "x".repeat(500)] }];
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(400);
  });

  it("PATCH roundCriteria at exactly MAX_PLAN_CRITERIA is accepted", async () => {
    const criteria = Array.from({ length: MAX_PLAN_CRITERIA }, (_, i) => ratingCriterion(`c${i}`));
    const res = await patchPlan({ roundCriteria: { "2": criteria } });
    expect(res.status).toBe(200);
  });

  // DEC-422 (amendment, wave 2, Scale-or-Choice v12 ruling): "an
  // organiser-defined list of 2-6 options" -- MIN_CRITERION_OPTIONS is the
  // other half of the bound MAX_CRITERION_OPTIONS already covered above.
  it("POST rejects a dropdown criterion with fewer than MIN_CRITERION_OPTIONS options", async () => {
    const options = Array.from({ length: MIN_CRITERION_OPTIONS - 1 }, (_, i) => `opt-${i}`);
    const criteria = [{ id: "d1", label: "Dropdown", kind: "dropdown", options }];
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.criteria).toBe(
      `criterion "d1" (dropdown) requires at least ${MIN_CRITERION_OPTIONS} options`,
    );
  });

  it("POST accepts a dropdown criterion at exactly MIN_CRITERION_OPTIONS options", async () => {
    const options = Array.from({ length: MIN_CRITERION_OPTIONS }, (_, i) => `opt-${i}`);
    const criteria = [{ id: "d1", label: "Dropdown", kind: "dropdown", options }];
    const res = await createPlan({ name: "Plan", scale: { min: 1, max: 5 }, criteria });
    expect(res.status).toBe(201);
  });
});
