// DEC-509 wave-30 amendment regression coverage: an evaluation plan's
// `filters` write door (POST/PATCH in src/routes/review/plans-crud.ts) must
// refuse everything its read door (parsePlanFilters,
// src/domain/evaluation/plan-json.ts) would later throw on. Before this
// task, both doors cast `body.filters` with zero validation, so
// `{"trackIds":"t1"}` (a string, not an array) wrote a filters_json that
// made every subsequent read of the plan (GET, results, reviewer queue, and
// the repair PATCH itself) throw PlanJsonError forever -- a permanently
// bricked plan. Mocking pattern mirrors
// test/review-plan-numeric-validation.test.ts (no D1/wrangler dependency in
// stage 1).

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
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    listPlansForEvent: vi.fn(async () => [plan]),
    countPlansForEvent: vi.fn(async () => 1),
    countEvaluationsByRound: vi.fn(async () => ({})),
    createPlan: vi.fn(async (_db: unknown, eventId: string, input: Record<string, unknown>) => ({
      ...makePlan(),
      eventId,
      ...input,
    })),
    updatePlan: vi.fn(async (_db: unknown, planId: string, patch: Record<string, unknown>) => {
      // Mirrors the real repo's drizzle .set() semantics: an explicit
      // `undefined` value means "column untouched", not "clear the column".
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      plan = { ...plan, ...defined } as typeof plan;
      return plan;
    }),
    planHasEvaluations: vi.fn(async () => false),
    listRoundsWithEvaluations: vi.fn(async () => []),
    countSubmittedEvaluationsForPlan: vi.fn(async () => 0),
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

function basePlanBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "New Plan",
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    ...overrides,
  };
}

describe("DEC-509 wave-30 amendment: POST /api/v1/events/:eventId/plans filters write door", () => {
  it('filters={"trackIds":"t1"} (string, not array) -> 400 under fields.filters, nothing persisted', async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody({ filters: { trackIds: "t1" } })),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.filters).toBeTruthy();

    const { createPlan } = await import("../src/server/repo/review");
    expect(createPlan).not.toHaveBeenCalled();
  });

  for (const value of [["t1"], "t1", 5]) {
    it(`filters=${JSON.stringify(value)} (non-object) -> 400 under fields.filters`, async () => {
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify(basePlanBody({ filters: value })),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.filters).toBeTruthy();
    });
  }

  it('filters={"trackIds":["t1"]} -> 201, round-trips through toPlanRecord unchanged', async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody({ filters: { trackIds: ["t1"] } })),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toEqual({ trackIds: ["t1"] });
  });

  it("filters=null -> 201, stored as null", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody({ filters: null })),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toBeNull();
  });

  it("filters omitted -> 201, stored as null", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toBeNull();
  });

  it('filters={} (trackIds omitted) -> 201, legal per the read door (parsePlanFilters returns {} for undefined trackIds)', async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody({ filters: {} })),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toEqual({});
  });
});

describe("DEC-509 wave-30 amendment: PATCH /api/v1/plans/:id filters write door -- the plan is never bricked", () => {
  it('PATCH filters={"trackIds":"t1"} -> 400 under fields.filters, and a subsequent GET of the plan still succeeds', async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ filters: { trackIds: "t1" } }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.filters).toBeTruthy();

    const { updatePlan } = await import("../src/server/repo/review");
    expect(updatePlan).not.toHaveBeenCalled();

    // The plan must NOT be bricked: the (rejected) bad write never reached
    // the repo, so the plan's stored filters_json is still whatever it was
    // before -- a subsequent GET succeeds, not a 500.
    const getRes = await app.request(`/api/v1/plans/${plan.id}`);
    expect(getRes.status).toBe(200);
  });

  for (const value of [["t1"], "t1", 5]) {
    it(`PATCH filters=${JSON.stringify(value)} (non-object) -> 400 under fields.filters`, async () => {
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ filters: value }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.filters).toBeTruthy();
    });
  }

  it('PATCH filters={"trackIds":["t1"]} -> 200, round-trips through toPlanRecord unchanged', async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ filters: { trackIds: ["t1"] } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toEqual({ trackIds: ["t1"] });
  });

  it("PATCH filters=null -> 200, cleared", async () => {
    plan = makePlan({ filters: { trackIds: ["t1"] } });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ filters: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toBeNull();
  });

  it("PATCH filters omitted (patching only name) -> 200, filters unchanged", async () => {
    plan = makePlan({ filters: { trackIds: ["t1"] } });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { filters: unknown; name: string };
    expect(body.filters).toEqual({ trackIds: ["t1"] });
    expect(body.name).toBe("Renamed");
  });

  it('PATCH filters={} (trackIds omitted) -> 200, legal per the read door', async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ filters: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { filters: unknown };
    expect(body.filters).toEqual({});
  });
});

describe("unit: assertPlanFiltersShape is the single predicate shared by both doors", () => {
  it("parsePlanFilters and validatePlanFiltersInput agree on every case", async () => {
    const { parsePlanFilters, validatePlanFiltersInput, PlanJsonError, PlanFiltersShapeError } = await import(
      "../src/domain/evaluation/plan-json"
    );

    // Legal shapes agree.
    expect(parsePlanFilters(JSON.stringify({ trackIds: ["a"] }), "p1")).toEqual(
      validatePlanFiltersInput({ trackIds: ["a"] }),
    );
    expect(parsePlanFilters(JSON.stringify({}), "p1")).toEqual(validatePlanFiltersInput({}));
    expect(parsePlanFilters(null, "p1")).toBeNull();
    expect(validatePlanFiltersInput(null)).toBeNull();

    // Illegal shape rejected by both, same underlying detail.
    expect(() => parsePlanFilters(JSON.stringify({ trackIds: "t1" }), "p1")).toThrow(PlanJsonError);
    expect(() => validatePlanFiltersInput({ trackIds: "t1" })).toThrow(PlanFiltersShapeError);
  });
});
