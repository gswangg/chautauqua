// DEC-509 regression coverage for task w28-b: POST /api/v1/events/:eventId/plans
// and PATCH /api/v1/plans/:id must validate maxEvaluations/openDate/closeDate
// at the route instead of silently coercing bad values (openDate: '2027-01-05'
// -> null, maxEvaluations: 0/-1/1.5 -> stored verbatim). Mocking pattern
// mirrors test/review-rounds.test.ts (no D1/wrangler dependency in stage 1).

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

const submission = { id: "sub-1", ref: "S-1", title: "Talk", description: null, trackIds: [] };
const submission2 = { id: "sub-2", ref: "S-2", title: "Talk 2", description: null, trackIds: [] };

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
    listPlansForEvent: vi.fn(async () => [plan]),
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
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
    listPlanFilteredSubmissions: vi.fn(async () => [submission, submission2]),
    resolveReviewerSubmissions: vi.fn(async () => [submission, submission2]),
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
    countEvaluationsBySubmission: vi.fn(async (_db: unknown, planId: string, round: number) => {
      const counts = new Map<string, number>();
      for (const e of store) {
        if (e.planId !== planId || e.round !== round) continue;
        counts.set(e.submissionId, (counts.get(e.submissionId) ?? 0) + 1);
      }
      return counts;
    }),
    listSubmissionIdsRatedBy: vi.fn(async (_db: unknown, planId: string, round: number, reviewerId: string) => {
      return new Set(
        store
          .filter((e) => e.planId === planId && e.round === round && e.reviewerId === reviewerId)
          .map((e) => e.submissionId),
      );
    }),
    // DEC-831: this reviewer's own scores, keyed by submissionId -- the
    // queue's myScore column.
    listEvaluationScoresForReviewer: vi.fn(async (_db: unknown, planId: string, round: number, reviewerId: string) => {
      return new Map(
        store
          .filter((e) => e.planId === planId && e.round === round && e.reviewerId === reviewerId)
          .map((e) => [e.submissionId, e.scores]),
      );
    }),
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
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      [submission, submission2].find((s) => s.id === submissionId) && eventId === plan.eventId
        ? [submission, submission2].find((s) => s.id === submissionId)
        : null,
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

function basePlanBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "New Plan",
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    ...overrides,
  };
}

const maxEvaluationsCases: { value: unknown; ok: boolean }[] = [
  { value: 0, ok: false },
  { value: -1, ok: false },
  { value: 1.5, ok: false },
  { value: "3", ok: false },
  { value: true, ok: false },
  { value: 2, ok: true },
];

const epochCases: { value: unknown; ok: boolean }[] = [
  { value: "2027-01-05", ok: false },
  { value: true, ok: false },
  { value: 1893456000000, ok: true },
];

describe("DEC-509: POST /api/v1/events/:eventId/plans numeric field validation", () => {
  for (const { value, ok } of maxEvaluationsCases) {
    it(`maxEvaluations=${JSON.stringify(value)} -> ${ok ? "201" : "400"}`, async () => {
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify(basePlanBody({ maxEvaluations: value })),
      });
      if (ok) {
        expect(res.status).toBe(201);
      } else {
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { fields?: Record<string, string> } };
        expect(body.error.fields?.maxEvaluations).toBeTruthy();
      }
    });
  }

  it("maxEvaluations absent -> 201, stored as null", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { maxEvaluations: number | null };
    expect(body.maxEvaluations).toBeNull();
  });

  it("maxEvaluations=null -> 201, stored as null", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(basePlanBody({ maxEvaluations: null })),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { maxEvaluations: number | null };
    expect(body.maxEvaluations).toBeNull();
  });

  for (const key of ["openDate", "closeDate"] as const) {
    for (const { value, ok } of epochCases) {
      it(`${key}=${JSON.stringify(value)} -> ${ok ? "201" : "400"}`, async () => {
        const app = await buildApp(organizer);
        const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-chq-csrf": "1" },
          body: JSON.stringify(basePlanBody({ [key]: value })),
        });
        if (ok) {
          expect(res.status).toBe(201);
          const body = (await res.json()) as Record<string, unknown>;
          expect(body[key]).toBe(value);
        } else {
          // The defect this closes: a bad date string must 400, not silently
          // coerce to null and open the plan immediately.
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { fields?: Record<string, string> } };
          expect(body.error.fields?.[key]).toBeTruthy();
        }
      });
    }

    it(`${key}=null -> 201, stored as null`, async () => {
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify(basePlanBody({ [key]: null })),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body[key]).toBeNull();
    });
  }
});

describe("DEC-509: PATCH /api/v1/plans/:id numeric field validation", () => {
  for (const { value, ok } of maxEvaluationsCases) {
    it(`maxEvaluations=${JSON.stringify(value)} -> ${ok ? "200" : "400"}`, async () => {
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ maxEvaluations: value }),
      });
      if (ok) {
        expect(res.status).toBe(200);
        const body = (await res.json()) as { maxEvaluations: number | null };
        expect(body.maxEvaluations).toBe(value);
      } else {
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { fields?: Record<string, string> } };
        expect(body.error.fields?.maxEvaluations).toBeTruthy();
      }
    });
  }

  it("maxEvaluations absent -> 200, unchanged", async () => {
    plan = makePlan({ maxEvaluations: 5 });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { maxEvaluations: number | null; name: string };
    expect(body.maxEvaluations).toBe(5);
    expect(body.name).toBe("Renamed");
  });

  it("maxEvaluations=null -> 200, cleared", async () => {
    plan = makePlan({ maxEvaluations: 5 });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ maxEvaluations: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { maxEvaluations: number | null };
    expect(body.maxEvaluations).toBeNull();
  });

  for (const key of ["openDate", "closeDate"] as const) {
    for (const { value, ok } of epochCases) {
      it(`${key}=${JSON.stringify(value)} -> ${ok ? "200" : "400"}`, async () => {
        const app = await buildApp(organizer);
        const res = await app.request(`/api/v1/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-chq-csrf": "1" },
          body: JSON.stringify({ [key]: value }),
        });
        if (ok) {
          expect(res.status).toBe(200);
          const body = (await res.json()) as Record<string, unknown>;
          expect(body[key]).toBe(value);
        } else {
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { fields?: Record<string, string> } };
          expect(body.error.fields?.[key]).toBeTruthy();
        }
      });
    }

    it(`${key} absent -> 200, unchanged`, async () => {
      plan = makePlan({ [key]: 1700000000000 });
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ name: "Renamed" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body[key]).toBe(1700000000000);
    });

    it(`${key}=null -> 200, cleared`, async () => {
      plan = makePlan({ [key]: 1700000000000 });
      const app = await buildApp(organizer);
      const res = await app.request(`/api/v1/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ [key]: null }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body[key]).toBeNull();
    });
  }
});

describe("DEC-509: maxEvaluations=2 still caps a reviewer's queue (no regression in reviewer.ts:109)", () => {
  it("queue offers only submissions still needing ratings under the cap", async () => {
    plan = makePlan({ maxEvaluations: 2 });
    // sub-1 already has 2 ratings from other reviewers (at the cap); sub-2 has none.
    store = [
      { id: "ev-1", planId: plan.id, submissionId: submission.id, reviewerId: "rev-2", round: 1, scores: { c1: 5 }, comment: null },
      { id: "ev-2", planId: plan.id, submissionId: submission.id, reviewerId: "rev-3", round: 1, scores: { c1: 4 }, comment: null },
    ];
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { submissionId: string }[] };
    // sub-1 is at its cap (2 ratings by others, none by me) -- excluded.
    // sub-2 has no ratings yet -- still offered.
    expect(body.items.map((i) => i.submissionId)).toEqual([submission2.id]);
  });
});
