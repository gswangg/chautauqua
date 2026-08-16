// DEC-241 amendment (task w1-h): regression pin for the Scale-or-Choice
// aggregation contract. v12 intake section A asked for "a results-math
// test" -- this file pins the arithmetic in the domain (criteria.ts,
// scoring.ts) plus the DEC-123 route guard against a criterion TYPE change,
// so a future edit to any of the three concurrently-in-flight SPA screens
// (ResultsTable, Scorecard, PlanEditor -- all off-limits to this task) can
// never re-litigate what these functions are supposed to compute. This is
// a REGRESSION PIN, not a feature: production code is touched only where an
// assertion below caught a real silent-NaN gap (see scoring.ts).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import {
  criterionWeightShares,
  aggregateDropdownCriterion,
  type DropdownCriterionDef,
} from "../src/domain/evaluation/criteria";
import { computeWeightedScore } from "../src/domain/evaluation/scoring";

describe("criterionWeightShares (DEC-676/DEC-241)", () => {
  it("splits weight ONLY across rating criteria, ignoring dropdown entirely", () => {
    const shares = criterionWeightShares([
      { id: "r1", weight: 3 },
      { id: "r2", weight: 2 },
      { id: "d1" }, // dropdown: no weight field at all
    ]);
    expect(shares).toEqual({ r1: 60, r2: 40 });
    expect(shares).not.toHaveProperty("d1");
    // Never the naive three-way split.
    expect(Object.keys(shares)).toHaveLength(2);
  });

  it("all-dropdown (no weighted criteria at all) yields an empty map", () => {
    const shares = criterionWeightShares([{ id: "d1" }, { id: "d2" }]);
    expect(shares).toEqual({});
  });

  it("a rating criterion with weight 0 gets no entry", () => {
    const shares = criterionWeightShares([
      { id: "r1", weight: 0 },
      { id: "r2", weight: 5 },
    ]);
    expect(shares).toEqual({ r2: 100 });
    expect(shares).not.toHaveProperty("r1");
  });

  it("zero total weight yields an empty map rather than dividing by zero", () => {
    const shares = criterionWeightShares([
      { id: "r1", weight: 0 },
      { id: "r2", weight: 0 },
    ]);
    expect(shares).toEqual({});
    for (const v of Object.values(shares)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("empty criteria list yields an empty map", () => {
    expect(criterionWeightShares([])).toEqual({});
  });
});

describe("computeWeightedScore ignores Choice/dropdown picks (DEC-241)", () => {
  const ratingCriteria = [
    { id: "r1", label: "Relevance", weight: 3 },
    { id: "r2", label: "Depth", weight: 1 },
  ];

  it("a scores map carrying a string value under an id NOT in the (rating-only) criteria list does not perturb the mean or produce NaN", () => {
    // Production callers (reviewer.ts, evaluations.ts, exports/evaluations.ts)
    // filter to rating-only criteria before calling computeWeightedScore --
    // this is the structural mechanism by which a dropdown pick is ignored:
    // its criterion id is simply absent from the list passed in.
    const scoresWithoutDropdown = { r1: 4, r2: 2 };
    const scoresWithDropdown = { r1: 4, r2: 2, d1: "Excellent" as unknown as number };

    const withoutDropdown = computeWeightedScore(scoresWithoutDropdown, ratingCriteria);
    const withDropdown = computeWeightedScore(scoresWithDropdown, ratingCriteria);

    expect(withDropdown).toBe(withoutDropdown);
    expect(Number.isFinite(withDropdown)).toBe(true);
    expect(withDropdown).toBeCloseTo((4 * 3 + 2 * 1) / 4, 10);
  });

  it("a non-numeric value under a RATING criterion id throws rather than silently producing NaN", () => {
    const scores = { r1: "Yes" as unknown as number, r2: 2 };
    expect(() => computeWeightedScore(scores, ratingCriteria)).toThrow(
      /must be a finite number/,
    );
    // Confirm the declared failure mode: it throws, not a NaN return.
    let threw = false;
    try {
      computeWeightedScore(scores, ratingCriteria);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

describe("aggregateDropdownCriterion distribution order (DEC-241)", () => {
  // Declared option order deliberately differs from BOTH alphabetical order
  // and descending-count order, so the test can distinguish all three.
  const criterion: DropdownCriterionDef = {
    id: "fit",
    label: "Fit",
    kind: "dropdown",
    options: ["Zebra", "Middle", "Apple"], // declared order: Zebra, Middle, Apple
  };

  it("counts map follows declared option order, not alphabetical or count order", () => {
    const evals = [
      { scores: { fit: "Apple" } },
      { scores: { fit: "Apple" } },
      { scores: { fit: "Apple" } },
      { scores: { fit: "Middle" } },
      { scores: { fit: "Zebra" } },
    ];
    const { counts, modal } = aggregateDropdownCriterion(evals, criterion);

    // Alphabetical would be Apple, Middle, Zebra.
    // Descending-count would be Apple, Middle, Zebra too (3,1,1) -- so also
    // add a case below where alphabetical and count orders diverge from
    // each other AND from declared order.
    expect(Object.keys(counts)).toEqual(["Zebra", "Middle", "Apple"]);
    expect(counts).toEqual({ Zebra: 1, Middle: 1, Apple: 3 });
    // Modal is still correctly Apple (most votes) despite key order.
    expect(modal).toBe("Apple");
  });

  it("declared, alphabetical, and count orders all disagree with each other", () => {
    // Declared: Zebra, Middle, Apple.
    // Alphabetical: Apple, Middle, Zebra.
    // Count (descending): Middle(3), Zebra(2), Apple(1).
    const evals = [
      { scores: { fit: "Middle" } },
      { scores: { fit: "Middle" } },
      { scores: { fit: "Middle" } },
      { scores: { fit: "Zebra" } },
      { scores: { fit: "Zebra" } },
      { scores: { fit: "Apple" } },
    ];
    const { counts } = aggregateDropdownCriterion(evals, criterion);
    const keyOrder = Object.keys(counts);
    expect(keyOrder).toEqual(["Zebra", "Middle", "Apple"]); // declared order wins
    expect(keyOrder).not.toEqual([...keyOrder].sort()); // not alphabetical
    const byCountDesc = [...keyOrder].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
    expect(keyOrder).not.toEqual(byCountDesc); // not count order either
  });

  it("empty input yields a zeroed counts map in declared order and a null modal", () => {
    const { counts, modal } = aggregateDropdownCriterion([], criterion);
    expect(Object.keys(counts)).toEqual(["Zebra", "Middle", "Apple"]);
    expect(counts).toEqual({ Zebra: 0, Middle: 0, Apple: 0 });
    expect(modal).toBeNull();
  });
});

// --- PATCH /api/v1/plans/:id: DEC-123 refuses a criterion TYPE change once
// evaluations exist. Follows the mocking idiom of
// test/plan-criteria-guard.test.ts (same repo mocks, same authed-organizer
// request builder).

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
    updatePlan: vi.fn(async (_db: unknown, planId: string, patch: Record<string, unknown>) => {
      plan = { ...plan, ...patch } as typeof plan;
      return plan;
    }),
    planHasEvaluations: vi.fn(async (_db: unknown, planId: string) => planId === plan.id && hasEvaluations),
    listRoundsWithEvaluations: vi.fn(async () => []),
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

describe("PATCH /api/v1/plans/:id refuses a criterion TYPE change once evaluations exist (DEC-123)", () => {
  it("flipping a criterion from rating to dropdown on a scored plan is refused (409, standard error shape)", async () => {
    hasEvaluations = true;
    const res = await patchPlan({
      criteria: [{ id: "c1", label: "Quality", kind: "dropdown", options: ["Yes", "No"] }],
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("conflict");
    expect(typeof body.error.message).toBe("string");
  });

  it("an identical (no-op) PATCH still passes through as 200 on the same scored plan", async () => {
    hasEvaluations = true;
    const res = await patchPlan({
      criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    });
    expect(res.status).toBe(200);
  });
});
