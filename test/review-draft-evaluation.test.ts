// DEC-873 (wave 27 amendment) regression coverage for task w27-g: a draft
// PUT (`draft: true`) leaves submittedAt null, is excluded from progress's
// completed count and from the results weighted-mean, and a subsequent
// non-draft submit stamps submittedAt and enters both. A draft PUT against
// an already-submitted row 400s rather than silently un-submitting it.
// Repo calls are mocked with an in-memory fake store, same pattern as
// test/review-rounds.test.ts.

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

const plan = makePlan();

interface FakeEvaluation {
  id: string;
  planId: string;
  submissionId: string;
  reviewerId: string;
  round: number;
  scores: Record<string, number | string>;
  comment: string | null;
  submittedAt: number | null;
}

let store: FakeEvaluation[] = [];
let nextId = 1;

const submission = { id: "sub-1", ref: "S-1", title: "Talk", description: null, trackIds: [] };

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
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listPlanFilteredSubmissions: vi.fn(async () => [submission]),
    listSpeakerNamesForSubmissions: vi.fn(async () => new Map()),
    listTrackNamesForSubmissions: vi.fn(async () => new Map()),
    // DEC-873 (wave 27 amendment): only a SUBMITTED pair (submittedAt not
    // null) counts toward a reviewer's completed total.
    listEvaluatedPairsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store
        .filter((e) => e.planId === planId && e.round === round && e.submittedAt !== null)
        .map((e) => ({ reviewerId: e.reviewerId, submissionId: e.submissionId })),
    ),
    // DEC-873 (wave 27 amendment): only a SUBMITTED row enters the results
    // weighted-mean read.
    listEvaluationScoresForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      store
        .filter((e) => e.planId === planId && e.round === round && e.submittedAt !== null)
        .map((e) => ({ submissionId: e.submissionId, scores: e.scores })),
    ),
    countEvaluationsBySubmission: vi.fn(async () => new Map()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
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
    // DEC-873 (wave 27 amendment): mirrors the real repo's draft handling --
    // draft writes never stamp submittedAt, non-draft writes always do.
    upsertEvaluation: vi.fn(
      async (_db: unknown, input: Omit<FakeEvaluation, "id" | "submittedAt"> & { draft?: boolean }) => {
        const submittedAt = input.draft ? null : Date.now();
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
          existing.submittedAt = submittedAt;
          return existing;
        }
        const created: FakeEvaluation = { id: `ev-${nextId++}`, ...input, comment: input.comment ?? null, submittedAt };
        store.push(created);
        return created;
      },
    ),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      submissionId === submission.id && eventId === plan.eventId ? submission : null,
    ),
    getReviewerScopeTrackId: vi.fn(async () => null),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
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

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
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

describe("draft evaluations (DEC-873 wave 27 amendment, task w27-g)", () => {
  it("a draft PUT with partial scores leaves submittedAt null and does not count toward progress or results", async () => {
    const reviewerApp = await buildApp(reviewer);

    // No scores at all -- a draft accepts a fully empty scores object.
    const put = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {}, draft: true }),
    });
    expect(put.status).toBe(200);
    const putBody = (await put.json()) as { submittedAt: number | null };
    expect(putBody.submittedAt).toBeNull();
    expect(store).toHaveLength(1);
    expect(store[0]?.submittedAt).toBeNull();

    const organizerApp = await buildApp(organizer);

    const progress = await organizerApp.request(`/api/v1/plans/${plan.id}/progress`);
    const progressBody = (await progress.json()) as { items: { completed: number }[] };
    expect(progressBody.items[0]?.completed).toBe(0);

    const results = await organizerApp.request(`/api/v1/plans/${plan.id}/results`);
    const resultsBody = (await results.json()) as { items: { count: number }[] };
    expect(resultsBody.items[0]?.count).toBe(0);
  });

  it("a submit after a draft stamps submittedAt and counts toward progress and results", async () => {
    const reviewerApp = await buildApp(reviewer);

    await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {}, draft: true }),
    });
    expect(store[0]?.submittedAt).toBeNull();

    const submit = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 4 } }),
    });
    expect(submit.status).toBe(200);
    const submitBody = (await submit.json()) as { submittedAt: number | null };
    expect(submitBody.submittedAt).not.toBeNull();
    expect(store).toHaveLength(1);
    expect(store[0]?.submittedAt).not.toBeNull();

    const organizerApp = await buildApp(organizer);
    const progress = await organizerApp.request(`/api/v1/plans/${plan.id}/progress`);
    const progressBody = (await progress.json()) as { items: { completed: number }[] };
    expect(progressBody.items[0]?.completed).toBe(1);

    const results = await organizerApp.request(`/api/v1/plans/${plan.id}/results`);
    const resultsBody = (await results.json()) as { items: { count: number; average: number }[] };
    expect(resultsBody.items[0]?.count).toBe(1);
    expect(resultsBody.items[0]?.average).toBe(4);
  });

  it("a draft PUT against an already-submitted evaluation 400s rather than un-submitting it", async () => {
    const reviewerApp = await buildApp(reviewer);

    const submit = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 3 } }),
    });
    expect(submit.status).toBe(200);
    const submittedAtAfterSubmit = store[0]?.submittedAt;
    expect(submittedAtAfterSubmit).not.toBeNull();

    const draftOverSubmitted = await reviewerApp.request(
      `/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ scores: { c1: 1 }, draft: true }),
      },
    );
    expect(draftOverSubmitted.status).toBe(400);
    const errBody = (await draftOverSubmitted.json()) as { error: { code: string; message: string } };
    expect(errBody.error.message).toMatch(/submitted/i);

    // Never a silent un-submit: the row's submittedAt and scores are
    // untouched.
    expect(store).toHaveLength(1);
    expect(store[0]?.submittedAt).toBe(submittedAtAfterSubmit);
    expect(store[0]?.scores).toEqual({ c1: 3 });
  });

  it("a non-draft submit with missing scores is still rejected (completeness check unchanged)", async () => {
    const reviewerApp = await buildApp(reviewer);
    const res = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {} }),
    });
    expect(res.status).toBe(400);
    expect(store).toHaveLength(0);
  });
});
