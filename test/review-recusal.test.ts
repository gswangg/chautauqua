// DEC-271 (task w5-c, rubric ABS-12) regression coverage: reviewer
// conflict-of-interest / recusal end to end at the route layer. Repo calls
// are mocked with a small stateful fake store (no D1/wrangler dependency in
// stage 1), mirroring test/round-criteria.test.ts's pattern.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";

const plan = {
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
  roundCriteria: null,
  maxEvaluations: null,
  timezone: "UTC",
};

const SUB_1 = { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] };
const SUB_2 = { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] };
const SUBMISSIONS = [SUB_1, SUB_2];

interface FakeRecusal {
  id: string;
  planId: string;
  submissionId: string;
  userId: string;
  reason: string | null;
  createdAt: number;
}

let recusals: FakeRecusal[] = [];
let nextRecusalId = 1;
let evaluations: { id: string; planId: string; submissionId: string; reviewerId: string; round: number; scores: Record<string, number>; comment: string | null }[] = [];

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
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    // Only sub-1/sub-2 (in event-1) exist; "sub-cross-event" simulates a
    // submission from a different event for the existence-hiding checks.
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === plan.eventId && SUBMISSIONS.some((s) => s.id === submissionId)
        ? SUBMISSIONS.find((s) => s.id === submissionId)!
        : null,
    ),
    // rev-1 is in scope for sub-1 only, to exercise out-of-scope 404s.
    isSubmissionInReviewerScope: vi.fn(async (_db: unknown, _plan: unknown, userId: string, submissionId: string) =>
      userId === "rev-1" && submissionId === SUB_1.id,
    ),
    listEvaluationsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      evaluations.filter((e) => e.planId === planId && e.round === round),
    ),
    listCompletedPairsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      evaluations
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ reviewerId: e.reviewerId, submissionId: e.submissionId })),
    ),
    // DEC-346: the queue route sources counts/ratedByMe from these SQL
    // aggregates -- derive them from the same stateful fake store.
    countEvaluationsBySubmission: vi.fn(async (_db: unknown, planId: string, round: number) => {
      const counts = new Map<string, number>();
      for (const e of evaluations) {
        if (e.planId !== planId || e.round !== round) continue;
        counts.set(e.submissionId, (counts.get(e.submissionId) ?? 0) + 1);
      }
      return counts;
    }),
    listSubmissionIdsRatedBy: vi.fn(async (_db: unknown, planId: string, round: number, reviewerId: string) =>
      new Set(
        evaluations
          .filter((e) => e.planId === planId && e.round === round && e.reviewerId === reviewerId)
          .map((e) => e.submissionId),
      ),
    ),
    listEvaluationScoresForReviewer: vi.fn(async (_db: unknown, planId: string, round: number, reviewerId: string) =>
      new Map(
        evaluations
          .filter((e) => e.planId === planId && e.round === round && e.reviewerId === reviewerId)
          .map((e) => [e.submissionId, e.scores]),
      ),
    ),
    getEvaluation: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, reviewerId: string, round: number) =>
        evaluations.find(
          (e) => e.planId === planId && e.submissionId === submissionId && e.reviewerId === reviewerId && e.round === round,
        ) ?? null,
    ),
    countEvaluationsForSubmission: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, round: number) =>
        evaluations.filter((e) => e.planId === planId && e.submissionId === submissionId && e.round === round).length,
    ),
    upsertEvaluation: vi.fn(async (_db: unknown, input: Record<string, unknown>) => {
      const created = { id: `ev-${evaluations.length + 1}`, comment: null, ...input } as (typeof evaluations)[number];
      evaluations.push(created);
      return created;
    }),
    // DEC-271: stateful fake recusal store.
    hasRecusal: vi.fn(async (_db: unknown, planId: string, submissionId: string, userId: string) =>
      recusals.find((r) => r.planId === planId && r.submissionId === submissionId && r.userId === userId) ?? null,
    ),
    createRecusal: vi.fn(
      async (_db: unknown, input: { planId: string; submissionId: string; userId: string; reason: string | null }) => {
        const existing = recusals.find(
          (r) => r.planId === input.planId && r.submissionId === input.submissionId && r.userId === input.userId,
        );
        if (existing) return { recusal: existing, created: false };
        const created: FakeRecusal = { id: `rc-${nextRecusalId++}`, createdAt: Date.now(), ...input };
        recusals.push(created);
        return { recusal: created, created: true };
      },
    ),
    deleteRecusal: vi.fn(async (_db: unknown, planId: string, submissionId: string, userId: string) => {
      const before = recusals.length;
      recusals = recusals.filter((r) => !(r.planId === planId && r.submissionId === submissionId && r.userId === userId));
      return recusals.length < before;
    }),
    listRecusalsForReviewer: vi.fn(async (_db: unknown, planId: string, userId: string) =>
      recusals.filter((r) => r.planId === planId && r.userId === userId),
    ),
    listRecusalsForPlan: vi.fn(async (_db: unknown, planId: string) => recusals.filter((r) => r.planId === planId)),
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
  recusals = [];
  nextRecusalId = 1;
  evaluations = [];
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

describe("DEC-271: reviewer recusal", () => {
  it("POST recusal creates (201) and returns the shaped envelope", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: "I know the speaker" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { recusal: Record<string, unknown> };
    expect(body.recusal).toEqual({
      planId: plan.id,
      submissionId: SUB_1.id,
      userId: "rev-1",
      reason: "I know the speaker",
      createdAt: expect.any(Number),
    });
  });

  it("POST recusal is idempotent: repeating returns 200, not 201", async () => {
    const app = await buildApp(reviewer);
    const first = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: null }),
    });
    expect(first.status).toBe(201);
    const second = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: "changed my mind" }),
    });
    expect(second.status).toBe(200);
    const body = (await second.json()) as { recusal: { reason: string | null } };
    // Idempotent create: the original row (and its original reason) wins.
    expect(body.recusal.reason).toBeNull();
  });

  it("POST rejects a reason over 500 chars", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: "x".repeat(501) }),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE removes an existing recusal (204)", async () => {
    const app = await buildApp(reviewer);
    await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: null }),
    });
    const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(204);
  });

  it("DELETE when no recusal exists 404s (no silent success)", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Recusal not found");
  });

  it("recusing from a submission outside the reviewer's scope 404s (existence-hiding)", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_2.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: null }),
    });
    expect(res.status).toBe(404);
  });

  it("organizer of a different org 404s on recusal create (cross-org)", async () => {
    const app = await buildApp({ userId: "u-other", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: null }),
    });
    expect(res.status).toBe(404);
  });

  it("queue drops a recused submission from items and lists it under the `recused` key", async () => {
    const app = await buildApp(reviewer);
    await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: "conflict" }),
    });
    const res = await app.request(`/api/v1/review/plans/${plan.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string }[];
      recused: { submissionId: string; ref: string; title: string; reason: string | null }[];
    };
    expect(body.items.some((i) => i.submissionId === SUB_1.id)).toBe(false);
    expect(body.items.some((i) => i.submissionId === SUB_2.id)).toBe(true);
    expect(body.recused).toEqual([{ submissionId: SUB_1.id, ref: SUB_1.ref, title: SUB_1.title, reason: "conflict" }]);
  });

  it("PUT evaluations 409s once the reviewer has recused from that submission", async () => {
    const app = await buildApp(reviewer);
    await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: null }),
    });
    const res = await app.request(`/api/v1/review/plans/${plan.id}/evaluations/${SUB_1.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 4 } }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("You have recused yourself from this submission");
  });

  it("progress `assigned` excludes recused submissions and reports `recused` count", async () => {
    const appReviewer = await buildApp(reviewer);
    await appReviewer.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ reason: null }),
    });

    const appOrganizer = await buildApp(organizer);
    const res = await appOrganizer.request(`/api/v1/plans/${plan.id}/progress`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { userId: string; assigned: number; completed: number; recused: number }[] };
    const row = body.items.find((i) => i.userId === "rev-1");
    expect(row).toBeDefined();
    // rev-1 is unrestricted, so assigned would be 2 (sub-1, sub-2) minus the
    // one recused submission.
    expect(row!.assigned).toBe(1);
    expect(row!.recused).toBe(1);
  });
});
