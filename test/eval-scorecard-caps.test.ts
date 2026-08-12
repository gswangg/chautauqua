// DEC-425: caps the last three uncapped free-text write paths -- the
// evaluation.comment field on PUT /api/v1/review/plans/:planId/evaluations/:submissionId
// and the api-token `name` field on POST /api/v1/tokens. Both reuse
// MAX_LONG_TEXT_LENGTH / MAX_NAME_LENGTH from src/forms/validate.ts.
//
// (The other two DEC-425 write paths -- text-criterion scores and upload
// filenames -- are covered directly in test/evaluation.test.ts,
// test/files.test.ts and test/profile.test.ts alongside their siblings.)

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as reviewRepo from "../src/server/repo/review";
import { MAX_LONG_TEXT_LENGTH, MAX_NAME_LENGTH } from "../src/forms/validate";

const ORG_A = "org-a";

const planRecord = {
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
  maxEvaluations: null,
};

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
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) =>
      planId === planRecord.id ? planRecord : null,
    ),
    listPlansForEvent: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === planRecord.eventId ? [planRecord] : [],
    ),
    listPlanIdsForReviewer: vi.fn(async () => []),
    resolveReviewerSubmissions: vi.fn(async () => []),
    isSubmissionInReviewerScope: vi.fn(async () => false),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === planRecord.eventId ? { id: submissionId, ref: "S-1", title: "Talk" } : null,
    ),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    listEvaluationsForPlan: vi.fn(async () => []),
    listCompletedPairsForPlan: vi.fn(async () => []),
    countEvaluationsBySubmission: vi.fn(async () => new Map<string, number>()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    getEvaluation: vi.fn(async () => null),
    countEvaluationsForSubmission: vi.fn(async () => 0),
    upsertEvaluation: vi.fn(async (_db: unknown, input: unknown) => input),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildReviewApp(auth: AuthInfo) {
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

describe("DEC-425: PUT evaluation caps the comment field", () => {
  function putEvaluation(comment: string) {
    return buildReviewApp({ userId: "u1", role: "organizer", orgId: ORG_A }).then((app) =>
      app.request(`/api/v1/review/plans/${planRecord.id}/evaluations/sub-1`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ scores: { c1: 5 }, comment }),
      }),
    );
  }

  it("rejects a comment over MAX_LONG_TEXT_LENGTH with a 400 before reaching upsertEvaluation", async () => {
    const res = await putEvaluation("x".repeat(MAX_LONG_TEXT_LENGTH + 1));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.comment).toBeDefined();
    expect(reviewRepo.upsertEvaluation).not.toHaveBeenCalled();
  });

  it("accepts a comment exactly AT MAX_LONG_TEXT_LENGTH (off-by-one)", async () => {
    const res = await putEvaluation("x".repeat(MAX_LONG_TEXT_LENGTH));
    expect(res.status).toBe(200);
    expect(reviewRepo.upsertEvaluation).toHaveBeenCalledTimes(1);
  });
});

describe("DEC-425: POST /api/v1/tokens caps the name field", () => {
  async function buildTokensApp(auth: AuthInfo) {
    const { tokensRoutes } = await import("../src/routes/api/tokens");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set(
        "db",
        {
          insert: () => ({ values: async () => undefined }),
        } as never,
      );
      await next();
    });
    app.route("/", tokensRoutes);
    return app;
  }

  function postToken(name: string) {
    return buildTokensApp({ userId: "u1", role: "organizer", orgId: ORG_A }).then((app) =>
      app.request("/api/v1/tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ name }),
      }),
    );
  }

  it("rejects a name over MAX_NAME_LENGTH with a 400", async () => {
    const res = await postToken("x".repeat(MAX_NAME_LENGTH + 1));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.name).toBeDefined();
  });

  it("accepts a name exactly AT MAX_NAME_LENGTH (off-by-one)", async () => {
    const res = await postToken("x".repeat(MAX_NAME_LENGTH));
    expect(res.status).toBe(201);
  });
});
