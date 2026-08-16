// DEC-082/DEC-087 regression coverage for task w2-a: the end-to-end
// multi-round lifecycle (rate in round 1 -> advance -> queue re-offers round
// 2 -> PUT creates a second evaluation row -> results aggregate per round),
// plus the validation edges DEC-087 pins. Repo calls are mocked (no D1/
// wrangler dependency in stage 1) -- same pattern as test/rounds.test.ts,
// but this file additionally asserts that every call site now passes the
// DEC-087-required `round` argument to repo.listEvaluationsForPlan, and
// exercises the repo's own round-scoped upsert/unique-index semantics via
// an in-memory fake store rather than a route-level round re-filter.

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
    rounds: 2,
    currentRound: 1,
    maxEvaluations: null,
    timezone: "UTC",
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

// In-memory store standing in for the `evaluation` table, enforcing the same
// unique index as the real schema: (planId, submissionId, reviewerId, round).
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
    listPlansForEvent: vi.fn(async () => [plan]),
    createPlan: vi.fn(async (_db: unknown, eventId: string, input: Record<string, unknown>) => ({
      ...makePlan(),
      eventId,
      ...input,
    })),
    updatePlan: vi.fn(async (_db: unknown, planId: string, patch: Record<string, unknown>) => {
      plan = { ...plan, ...patch } as typeof plan;
      return plan;
    }),
    advancePlanRound: vi.fn(async (_db: unknown, planId: string) => {
      if (planId !== plan.id) throw new Error("unknown plan");
      const { ApiError } = await import("../src/server/http");
      if (plan.currentRound >= plan.rounds) {
        throw new ApiError("conflict", `Plan is already at its final round (${plan.rounds})`);
      }
      plan = { ...plan, currentRound: plan.currentRound + 1 };
      return plan;
    }),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listPlanFilteredSubmissions: vi.fn(async () => [submission]),
    listSpeakerNamesForSubmissions: vi.fn(async () => new Map()),
    listTrackNamesForSubmissions: vi.fn(async () => new Map()),
    resolveReviewerSubmissions: vi.fn(async () => [submission]),
    // DEC-087: real round-scoped filtering, exercising the unique-index
    // semantics via the in-memory store rather than a caller-side re-filter.
    listEvaluationsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store.filter((e) => e.planId === planId && e.round === round),
    ),
    // DEC-439: buildResults' payload-narrow read (submissionId + scores only).
    listEvaluationScoresForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ submissionId: e.submissionId, scores: e.scores })),
    ),
    listEvaluatedPairsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ reviewerId: e.reviewerId, submissionId: e.submissionId })),
    ),
    // DEC-346: the queue route sources counts/ratedByMe from these SQL
    // aggregates -- backed here by the same in-memory store so the fake stays
    // consistent with listEvaluationsForPlan.
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
    // DEC-211: the PUT evaluations route resolves the submission inside the
    // plan's event before anything else, so the fake repo must answer it.
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      submissionId === submission.id && eventId === plan.eventId ? submission : null,
    ),
    // DEC-845: the queue envelope's scopeTrackName resolution -- no track
    // scoping in this fixture set.
    getReviewerScopeTrackIds: vi.fn(async () => []),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    // DEC-857: no format answers in this fixture set.
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    // DEC-986 (task w6-i): the queue route now also batches the
    // audience-level answer through this same repo module -- no
    // audience-level answers in this fixture set.
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
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

// DEC-238 (wave-66 amendment): POST /plans/:id/remind now consults
// loadRecentlySent before sending -- this file's db stub is `{}`, so the
// real reader would throw; return an always-empty map so the dedupe check
// is a no-op here.
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(async () => new Map()),
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
    c.env = { DEV_MODE: "1" } as never;
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };
const reviewer: AuthInfo = { userId: "rev-1", role: "reviewer", orgId: ORG_A };

describe("multi-round lifecycle (task w2-a)", () => {
  it("rate in round 1, advance, queue re-offers the submission for round 2, PUT creates a second row", async () => {
    const reviewerApp = await buildApp(reviewer);

    // Round 1: rate.
    const putR1 = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 5 } }),
    });
    expect(putR1.status).toBe(200);
    expect(store).toHaveLength(1);
    expect(store[0]?.round).toBe(1);

    // DEC-561: the queue keeps the already-rated item (sunk to the bottom,
    // alreadyRatedByMe: true) instead of erasing it.
    const queueR1 = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/queue`);
    const queueR1Body = (await queueR1.json()) as { items: { submissionId: string; alreadyRatedByMe: boolean }[] };
    expect(queueR1Body.items).toHaveLength(1);
    expect(queueR1Body.items[0]).toMatchObject({ submissionId: submission.id, alreadyRatedByMe: true });

    // Organizer advances the plan to round 2.
    const organizerApp = await buildApp(organizer);
    const advance = await organizerApp.request(`/api/v1/plans/${plan.id}/advance-round`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(advance.status).toBe(200);
    const advanced = (await advance.json()) as { currentRound: number };
    expect(advanced.currentRound).toBe(2);
    expect(plan.currentRound).toBe(2);

    // Queue re-offers the submission for round 2 (round-1 rating doesn't count).
    const queueR2 = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/queue`);
    const queueR2Body = (await queueR2.json()) as { items: { submissionId: string }[] };
    expect(queueR2Body.items.map((i) => i.submissionId)).toEqual([submission.id]);

    // PUT in round 2 creates a SECOND evaluation row -- the unique index is
    // (plan, submission, reviewer, round), so round 1's row is untouched.
    const putR2 = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 2 } }),
    });
    expect(putR2.status).toBe(200);
    expect(store).toHaveLength(2);
    expect(store.find((e) => e.round === 1)?.scores.c1).toBe(5);
    expect(store.find((e) => e.round === 2)?.scores.c1).toBe(2);
  });

  it("results ?round=1 vs ?round=2 aggregate separately", async () => {
    store = [
      { id: "ev-1", planId: plan.id, submissionId: submission.id, reviewerId: "rev-1", round: 1, scores: { c1: 5 }, comment: null },
      { id: "ev-2", planId: plan.id, submissionId: submission.id, reviewerId: "rev-1", round: 2, scores: { c1: 2 }, comment: null },
    ];
    const app = await buildApp(organizer);

    const r1 = await app.request(`/api/v1/plans/${plan.id}/results?round=1`);
    const r1Body = (await r1.json()) as { items: { average: number; count: number }[] };
    expect(r1Body.items[0]?.average).toBe(5);
    expect(r1Body.items[0]?.count).toBe(1);

    const r2 = await app.request(`/api/v1/plans/${plan.id}/results?round=2`);
    const r2Body = (await r2.json()) as { items: { average: number; count: number }[] };
    expect(r2Body.items[0]?.average).toBe(2);
    expect(r2Body.items[0]?.count).toBe(1);
  });

  it("advance-round past the plan's rounds count 409s", async () => {
    plan = makePlan({ rounds: 2, currentRound: 2 });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/advance-round`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
  });

  it("PATCH rejects rounds below currentRound as invalid", async () => {
    plan = makePlan({ rounds: 3, currentRound: 2 });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ rounds: 1 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.rounds).toBeTruthy();
  });

  it("create rounds: 0 is invalid", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${plan.eventId}/plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        name: "New plan",
        scale: { min: 1, max: 5 },
        criteria: [{ id: "c1", label: "Q", kind: "rating", weight: 1 }],
        rounds: 0,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.rounds).toBeTruthy();
  });

  it("every listEvaluationScoresForPlan call site passes the DEC-087-required round arg", async () => {
    const repo = await import("../src/server/repo/review");
    const app = await buildApp(organizer);
    await app.request(`/api/v1/plans/${plan.id}/progress`);
    await app.request(`/api/v1/plans/${plan.id}/results`);
    await app.request(`/api/v1/plans/${plan.id}/remind`, { method: "POST", headers: { "x-chq-csrf": "1" } });
    // DEC-346: the reviewer queue no longer calls listEvaluationsForPlan --
    // it sources counts/ratedByMe from countEvaluationsBySubmission/
    // listSubmissionIdsRatedBy instead. DEC-351/DEC-449: /progress and
    // /remind no longer call listEvaluationsForPlan either -- they source
    // per-reviewer evaluated pairs from listEvaluatedPairsForPlan (folded
    // against each reviewer's own resolved-assigned set, DEC-707 wave-3
    // amendment; asserted below). Only /results (buildResults, DEC-345/
    // DEC-439) still needs the scored rows, now via the payload-narrow
    // listEvaluationScoresForPlan.
    const reviewerApp = await buildApp(reviewer);
    await reviewerApp.request(`/api/v1/review/plans/${plan.id}/queue`);

    const calls = (repo.listEvaluationScoresForPlan as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    for (const call of calls) {
      expect(typeof call[2]).toBe("number");
    }

    // DEC-351/DEC-449/DEC-707 (wave-3 amendment): /progress and /remind's
    // replacement call site also carries the DEC-087 round arg -- narrowing
    // what's fetched must not weaken the round-scoping assertion (DEC-329).
    const countCalls = (repo.listEvaluatedPairsForPlan as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(countCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of countCalls) {
      expect(typeof call[2]).toBe("number");
    }
  });
});
