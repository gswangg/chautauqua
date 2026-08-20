// DEC-929 regression coverage (task w6-f): DESIGN-RULINGS ruling A9's plan
// delete freeze must be enforced server-side, not just as a disabled SPA
// affordance -- a bearer-token organizer is CSRF-exempt, so the SPA's
// disabled attribute alone is not a rule. DELETE /api/v1/plans/:id must
// refuse (409) once repo.planHasEvaluations is true -- the SAME predicate
// the DEC-123 criteria/scale freeze uses, never a second count query -- and
// the refusal must name ruling A9's own alternative (start a new wave).
// Repo calls are mocked (no D1/wrangler dependency in stage 1), same
// pattern as test/plan-criteria-guard.test.ts.

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
    const res = await deletePlanRequest();
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  it("DELETE returns 409 once the plan has one evaluation, and never calls deletePlan", async () => {
    hasEvaluations = true;
    const res = await deletePlanRequest();
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
    expect(deleteCalled).toBe(false);
  });

  it("the 409 body names the new-wave alternative", async () => {
    hasEvaluations = true;
    const res = await deletePlanRequest();
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/new wave/i);
  });
});
