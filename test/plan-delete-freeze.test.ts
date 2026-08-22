// DEC-929 regression coverage (task w6-f; wave-34 amendment task w34-d):
// DESIGN-RULINGS ruling A9's plan delete freeze must be enforced
// server-side, not just as a disabled SPA affordance -- a bearer-token
// organizer is CSRF-exempt, so the SPA's disabled attribute alone is not a
// rule. Wave-34: the freeze keys on a review having LANDED, i.e. a
// SUBMITTED evaluation (repo.countSubmittedEvaluationsForPlan) -- NOT
// repo.planHasEvaluations, which also counts drafts and would permanently
// brick a plan the moment a reviewer pressed Save draft. The refusal must
// name ruling A9's own alternative (start a new wave). Repo calls are
// mocked (no D1/wrangler dependency in stage 1), same pattern as
// test/plan-criteria-guard.test.ts.

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
// hasEvaluations: any evaluation (draft or submitted) -- still the DEC-123
// criteria/scale freeze's own predicate, exercised in plan-criteria-guard's
// tests, not here. submittedEvaluationCount: the DELETE guard's wave-34
// predicate -- a draft-only plan (hasEvaluations true, submittedEvaluationCount
// 0) must stay deletable.
let hasEvaluations = false;
let submittedEvaluationCount = 0;
let deleteCalled = false;

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    planHasEvaluations: vi.fn(async (_db: unknown, planId: string) => planId === plan.id && hasEvaluations),
    countSubmittedEvaluationsForPlan: vi.fn(async (_db: unknown, planId: string) =>
      planId === plan.id ? submittedEvaluationCount : 0,
    ),
    deletePlan: vi.fn(async (_db: unknown, _planId: string) => {
      deleteCalled = true;
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
  hasEvaluations = false;
  submittedEvaluationCount = 0;
  deleteCalled = false;
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

async function deletePlanRequest() {
  const app = await buildApp(organizer);
  return app.request(`/api/v1/plans/${plan.id}`, {
    method: "DELETE",
    headers: { "x-chq-csrf": "1" },
  });
}

describe("DEC-929 server-side plan-delete freeze (task w6-f)", () => {
  it("DELETE succeeds (204) when the plan has no evaluations", async () => {
    hasEvaluations = false;
    submittedEvaluationCount = 0;
    const res = await deletePlanRequest();
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  it("DELETE returns 409 once the plan has one SUBMITTED evaluation, and never calls deletePlan", async () => {
    hasEvaluations = true;
    submittedEvaluationCount = 1;
    const res = await deletePlanRequest();
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
    expect(deleteCalled).toBe(false);
  });

  it("the 409 body names the new-wave alternative", async () => {
    hasEvaluations = true;
    submittedEvaluationCount = 1;
    const res = await deletePlanRequest();
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/new wave/i);
  });
});

describe("DEC-929 wave-34 amendment: the DELETE freeze keys on a LANDED review, never a draft row (task w34-d)", () => {
  it("a plan with exactly one DRAFT evaluation (submitted count 0) returns 204 and is gone", async () => {
    hasEvaluations = true;
    submittedEvaluationCount = 0;
    const res = await deletePlanRequest();
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  it("a plan with one SUBMITTED evaluation still 409s with the unchanged message", async () => {
    hasEvaluations = true;
    submittedEvaluationCount = 1;
    const res = await deletePlanRequest();
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toBe(
      "This plan has recorded evaluations and cannot be deleted -- start a new wave instead",
    );
    expect(deleteCalled).toBe(false);
  });
});
