// DEC-147 amendment (wave 8, task w8-c) route coverage: PATCH/POST
// /api/v1/plans validate the optional `roundMeta` map exactly like
// `roundCriteria` (bounded key range, bounded name, ms-epoch-or-null
// dates), refusing malformed input with the standard
// {error:{code,message,fields}} shape. Repo calls are mocked (no D1/
// wrangler dependency in stage 1), same pattern as
// test/plan-criteria-caps.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_NAME_LENGTH } from "../src/forms/validate";

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
    roundMeta: null,
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

async function patchPlan(body: Record<string, unknown>) {
  const app = await buildApp(organizer);
  return app.request(`/api/v1/plans/${plan.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

async function createPlan(body: Record<string, unknown>) {
  const app = await buildApp(organizer);
  return app.request(`/api/v1/events/${plan.eventId}/plans`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("DEC-147 amendment (wave 8, task w8-c): roundMeta validation", () => {
  it("PATCH accepts a well-formed roundMeta entry and it round-trips on the record", async () => {
    const res = await patchPlan({ roundMeta: { "2": { name: "Final round", opensAt: 1000, closesAt: 2000 } } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { roundMeta: Record<string, unknown> };
    expect(body.roundMeta).toEqual({ "2": { name: "Final round", opensAt: 1000, closesAt: 2000 } });
  });

  it("PATCH refuses a round key outside [1, rounds] with a 400 under the roundMeta field", async () => {
    const res = await patchPlan({ roundMeta: { "9": { name: "Nope" } } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roundMeta).toMatch(/integer between 1 and/);
  });

  it("PATCH refuses a non-integer round key", async () => {
    const res = await patchPlan({ roundMeta: { "not-a-number": { name: "Nope" } } });
    expect(res.status).toBe(400);
  });

  it("PATCH refuses a name longer than MAX_NAME_LENGTH", async () => {
    const res = await patchPlan({ roundMeta: { "2": { name: "x".repeat(MAX_NAME_LENGTH + 1) } } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roundMeta).toMatch(/at most/);
  });

  it("PATCH refuses a non-numeric opensAt", async () => {
    const res = await patchPlan({ roundMeta: { "2": { opensAt: "not-a-date" } } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roundMeta).toMatch(/opensAt must be a ms-epoch integer/);
  });

  it("PATCH refuses opensAt after closesAt on the same entry", async () => {
    const res = await patchPlan({ roundMeta: { "2": { opensAt: 2000, closesAt: 1000 } } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roundMeta).toMatch(/opensAt must be before or equal to closesAt/);
  });

  it("PATCH accepts null to clear all round meta overrides", async () => {
    plan = makePlan({ roundMeta: { "2": { name: "Final round" } } });
    const res = await patchPlan({ roundMeta: null });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { roundMeta: unknown };
    expect(body.roundMeta).toBeNull();
  });

  it("PATCH round meta is not blocked by the DEC-213 criteria freeze on an evaluated round", async () => {
    const { listRoundsWithEvaluations, planHasEvaluations } = vi.mocked(
      await import("../src/server/repo/review"),
    );
    planHasEvaluations.mockResolvedValue(true);
    listRoundsWithEvaluations.mockResolvedValue([1]);
    const res = await patchPlan({ roundMeta: { "1": { name: "Renamed round 1" } } });
    expect(res.status).toBe(200);
  });

  it("POST accepts roundMeta on plan creation", async () => {
    const res = await createPlan({
      name: "Plan",
      scale: { min: 1, max: 5 },
      criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
      rounds: 3,
      roundMeta: { "2": { name: "Semifinal" }, "3": { name: "Final" } },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { roundMeta: Record<string, unknown> };
    expect(body.roundMeta).toEqual({ "2": { name: "Semifinal" }, "3": { name: "Final" } });
  });
});
