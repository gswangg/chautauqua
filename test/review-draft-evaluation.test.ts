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
    maxEvaluations: null as number | null,
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
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) =>
      userId === "rev-1" || userId === "rev-2" ? [plan.id] : [],
    ),
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
    // DEC-873 (wave 46 amendment): mirrors the real repo's
    // submittedEvaluationCondition() -- a draft (submittedAt null) never
    // enters ratingsCount, alreadyRatedByMe, or myScore.
    countEvaluationsBySubmission: vi.fn(async (_db: unknown, planId: string, round: number) => {
      const counts = new Map<string, number>();
      for (const e of store) {
        if (e.planId === planId && e.round === round && e.submittedAt !== null) {
          counts.set(e.submissionId, (counts.get(e.submissionId) ?? 0) + 1);
        }
      }
      return counts;
    }),
    listSubmissionIdsRatedBy: vi.fn(async (_db: unknown, planId: string, round: number, reviewerId: string) =>
      new Set(
        store
          .filter(
            (e) =>
              e.planId === planId && e.round === round && e.reviewerId === reviewerId && e.submittedAt !== null,
          )
          .map((e) => e.submissionId),
      ),
    ),
    listEvaluationScoresForReviewer: vi.fn(
      async (_db: unknown, planId: string, round: number, reviewerId: string) =>
        new Map(
          store
            .filter(
              (e) =>
                e.planId === planId && e.round === round && e.reviewerId === reviewerId && e.submittedAt !== null,
            )
            .map((e) => [e.submissionId, e.scores]),
        ),
    ),
    resolveReviewerSubmissions: vi.fn(async () => [submission]),
    getEvaluation: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, reviewerId: string, round: number) =>
        store.find(
          (e) => e.planId === planId && e.submissionId === submissionId && e.reviewerId === reviewerId && e.round === round,
        ) ?? null,
    ),
    // DEC-873 (wave 46 amendment): matches the real repo's
    // submittedEvaluationCondition() -- another reviewer's unsubmitted
    // draft must never count against maxEvaluations (reviewer.ts:361).
    countEvaluationsForSubmission: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, round: number) =>
        store.filter(
          (e) => e.planId === planId && e.submissionId === submissionId && e.round === round && e.submittedAt !== null,
        ).length,
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
    getReviewerScopeTrackIds: vi.fn(async () => []),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
  };
});

// DEC-596: the organiser's per-submission evaluations route
// (src/routes/review/evaluations.ts) imports getSubmissionOwnership and
// listEvaluationsForSubmission directly (not through the repo/review
// index), so those modules need their own mocks here, store-backed just
// like the reviewer-facing mocks above.
vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
    "../src/server/repo/submissions",
  );
  return {
    ...actual,
    getSubmissionOwnership: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === submission.id ? { eventId: plan.eventId, orgId: ORG_A } : null,
    ),
  };
});

// DEC-596: the organiser's evaluations route also reads the ASSIGNED-
// reviewer denominator (countAssignedReviewersForSubmission), imported
// directly from repo/review/reviewers (not through the repo/review index
// mocked above) — stub it here so the route doesn't hit the bare fake db.
// This file's draft-exclusion assertion is unaffected: the real
// listEvaluationsForSubmission's submittedEvaluationCondition() filter is
// what excludes drafts, mirrored by the store-backed mock below.
vi.mock("../src/server/repo/review/reviewers", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/reviewers")>(
    "../src/server/repo/review/reviewers",
  );
  return {
    ...actual,
    countAssignedReviewersForSubmission: vi.fn(async () => 2),
  };
});

vi.mock("../src/server/repo/review/evaluations", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/evaluations")>(
    "../src/server/repo/review/evaluations",
  );
  return {
    ...actual,
    // DEC-873 (wave 46 amendment): the organiser's Reviews section shows
    // only recorded (submittedAt not null) evaluations -- a draft is never
    // visible to the organiser.
    listEvaluationsForSubmission: vi.fn(async (_db: unknown, submissionId: string) =>
      store
        .filter((e) => e.submissionId === submissionId && e.submittedAt !== null)
        .map((e) => ({
          planId: e.planId,
          planName: plan.name,
          round: e.round,
          reviewerName: e.reviewerId,
          scores: e.scores,
          comment: e.comment,
          submittedAt: e.submittedAt,
        })),
    ),
    listPlanCriteriaByIds: vi.fn(async () => new Map([[plan.id, { criteria: plan.criteria, roundCriteriaJson: null, scale: plan.scale }]])),
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
  plan.maxEvaluations = null;
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
const reviewerB: AuthInfo = { userId: "rev-2", role: "reviewer", orgId: ORG_A };

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

// DEC-873 (wave 46 amendment): the read-side leak -- countEvaluationsForSubmission,
// countEvaluationsBySubmission, listSubmissionIdsRatedBy, listEvaluationScoresForReviewer,
// and listEvaluationsForSubmission must all exclude a draft (submittedAt
// null) row, just like listEvaluationScoresForPlan/listEvaluatedPairsForPlan
// already did since wave 27. See src/server/repo/review/evaluations.ts's
// submittedEvaluationCondition().
describe("DEC-873 (wave 46 amendment): draft evaluations never leak through a read-side aggregate", () => {
  it("reviewer B's unsubmitted draft does not count against maxEvaluations and does not block reviewer A's submit", async () => {
    plan.maxEvaluations = 1;
    const reviewerBApp = await buildApp(reviewerB);
    const draft = await reviewerBApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {}, draft: true }),
    });
    expect(draft.status).toBe(200);
    expect(store).toHaveLength(1);
    expect(store[0]?.submittedAt).toBeNull();

    // Prior to the wave 46 fix, countEvaluationsForSubmission counted this
    // draft row too, so reviewer A's own first submit would wrongly 409
    // against a maxEvaluations=1 cap that no one had actually filled yet.
    const reviewerAApp = await buildApp(reviewer);
    const submit = await reviewerAApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 5 } }),
    });
    expect(submit.status).toBe(200);
    expect(store).toHaveLength(2);
  });

  it("a draft does not raise ratingsCount nor remove the submission from another reviewer's queue", async () => {
    const reviewerBApp = await buildApp(reviewerB);
    await reviewerBApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {}, draft: true }),
    });
    expect(store[0]?.submittedAt).toBeNull();

    const reviewerAApp = await buildApp(reviewer);
    const queue = await reviewerAApp.request(`/api/v1/review/plans/${plan.id}/queue`);
    expect(queue.status).toBe(200);
    const queueBody = (await queue.json()) as {
      items: { submissionId: string; ratingsCount: number; alreadyRatedByMe: boolean; myScore: number | null }[];
    };
    const item = queueBody.items.find((i) => i.submissionId === submission.id);
    expect(item).toBeDefined();
    // ratingsCount must not count reviewer B's draft (J4 fewest-ratings-first
    // relies on this being a count of RECORDED evaluations).
    expect(item?.ratingsCount).toBe(0);
    // The reviewer's own draft leaves alreadyRatedByMe false and myScore null.
    expect(item?.alreadyRatedByMe).toBe(false);
    expect(item?.myScore).toBeNull();
  });

  it("a reviewer's own draft leaves alreadyRatedByMe false and myScore null in their own queue", async () => {
    const reviewerApp = await buildApp(reviewer);
    await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {}, draft: true }),
    });

    const queue = await reviewerApp.request(`/api/v1/review/plans/${plan.id}/queue`);
    const queueBody = (await queue.json()) as {
      items: { submissionId: string; alreadyRatedByMe: boolean; myScore: number | null }[];
    };
    const item = queueBody.items.find((i) => i.submissionId === submission.id);
    expect(item?.alreadyRatedByMe).toBe(false);
    expect(item?.myScore).toBeNull();
  });

  it("the organiser's per-submission evaluations list excludes a reviewer's draft", async () => {
    const reviewerApp = await buildApp(reviewer);
    // Reviewer A submits (recorded); reviewer B only drafts (not recorded).
    await reviewerApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 3 } }),
    });
    const reviewerBApp = await buildApp(reviewerB);
    await reviewerBApp.request(`/api/v1/review/plans/${plan.id}/evaluations/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: {}, draft: true }),
    });
    expect(store).toHaveLength(2);

    const organizerApp = await buildApp(organizer);
    const res = await organizerApp.request(`/api/v1/submissions/${submission.id}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { reviewerName: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.reviewerName).toBe("rev-1");
  });
});
