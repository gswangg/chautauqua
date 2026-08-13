// DEC-709 coverage for task w17-b: POST /api/v1/plans/:id/waves. A locked
// plan (current round has submitted evaluations) opens a new, editable
// round whose starting criteria are a byte-identical copy of the frozen
// round's -- and the frozen round's own criteria are left untouched.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const FROZEN_CRITERIA = [
  { id: "c1", label: "Relevance", kind: "rating", weight: 3 },
  { id: "c2", label: "Depth", kind: "rating", weight: 2 },
];

interface FakePlan {
  id: string;
  eventId: string;
  name: string;
  instructions: string | null;
  openDate: number | null;
  closeDate: number | null;
  filters: null;
  anonymized: boolean;
  scale: { min: number; max: number };
  criteria: typeof FROZEN_CRITERIA;
  rounds: number;
  currentRound: number;
  roundCriteria: Record<string, unknown> | null;
  maxEvaluations: number | null;
  timezone: string;
}

function makePlan(overrides: Partial<FakePlan> = {}): FakePlan {
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
    criteria: FROZEN_CRITERIA,
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    timezone: "UTC",
    ...overrides,
  };
}

let plan = makePlan();
let submittedCountForRound = 0;

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
    countSubmittedEvaluationsForRound: vi.fn(async (_db: unknown, planId: string, round: number) =>
      planId === plan.id && round === plan.currentRound ? submittedCountForRound : 0,
    ),
    startNewWave: vi.fn(
      async (
        _db: unknown,
        planId: string,
        input: { newRound: number; roundCriteria: Record<string, unknown> },
      ) => {
        if (planId !== plan.id) throw new Error("unknown plan");
        plan = {
          ...plan,
          rounds: input.newRound,
          currentRound: input.newRound,
          roundCriteria: input.roundCriteria,
        };
        return plan;
      },
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  plan = makePlan();
  submittedCountForRound = 0;
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

describe("POST /api/v1/plans/:id/waves (DEC-709)", () => {
  it("400s naming the reason when the current round has no submitted evaluations", async () => {
    submittedCountForRound = 0;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/waves`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toMatch(/no submitted evaluations/i);
  });

  it("locked plan -> new wave: rounds/currentRound advance and the new round's criteria are a byte-identical, independently editable copy", async () => {
    submittedCountForRound = 7;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/waves`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rounds: number;
      currentRound: number;
      criteria: unknown[];
      roundCriteria: Record<string, unknown[]>;
    };
    expect(body.rounds).toBe(2);
    expect(body.currentRound).toBe(2);
    // The new round's criteria are byte-identical to what round 1 (the
    // frozen round) resolved to...
    expect(body.roundCriteria["2"]).toEqual(FROZEN_CRITERIA);
    // ...but the previous round's own criteria (plan.criteria, still what
    // round 1 resolves to via criteriaForRound's fallback) are untouched --
    // starting a new wave never rewrites history.
    expect(body.criteria).toEqual(FROZEN_CRITERIA);
  });
});
