// DEC-354 regression coverage: the reviewer-assignment foreign-key hole is
// closed at both ends. (a) POST /api/v1/plans/:id/reviewers rejects a
// trackId/submissionId that does not name a track/submission of the plan's
// own event, before any plan_reviewer row is written. (b)
// isSubmissionInReviewerScope's per-submission branch is bounded to
// plan.eventId the same way the unrestricted and track branches are.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as reviewRepo from "../src/server/repo/review";

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
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    requireOrgUser: vi.fn(async () => ({ role: "reviewer", email: "rev@org.test" })),
    // "track-cross-event" simulates a track belonging to a different event
    // than planRecord.
    trackExistsInEvent: vi.fn(async (_db: unknown, trackId: string, eventId: string) =>
      eventId === planRecord.eventId && trackId !== "track-cross-event",
    ),
    // "sub-cross-event" simulates a submission belonging to a different
    // event than planRecord.
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === planRecord.eventId && submissionId !== "sub-cross-event"
        ? { id: submissionId, ref: "S-1", title: "Talk" }
        : null,
    ),
    // DEC-623: the route resolves body.submissionId through this rather
    // than getSubmissionSummaryInEvent directly -- mirror the same
    // in-event/cross-event semantics for id-shaped input (no ref parsing
    // needed for this file's cases).
    findSubmissionIdByRefOrId: vi.fn(async (_db: unknown, eventId: string, input: string) =>
      eventId === planRecord.eventId && input !== "sub-cross-event" ? input : null,
    ),
    // DEC-354 (amendment, wave 61): the scopeAdvisory pre-read -- no
    // existing plan_reviewer rows in this fixture, so always empty.
    listReviewerRowsForPlan: vi.fn(async () => []),
    getTrackIdsBySubmissionIds: vi.fn(async () => new Map()),
    addReviewers: vi.fn(async (_db: unknown, planId: string, inputs: unknown[]) =>
      inputs.map((input) => ({
        id: "pr-new",
        planId,
        ...(input as Record<string, unknown>),
      })),
    ),
    // DEC-659 (amendment, wave 55): POST /plans/:id/reviewers now decorates
    // the row it just wrote with the same batched label lookups the GET list
    // uses. This file drives the route with an empty `{}` db, so the three
    // lookups are stubbed here rather than hitting drizzle.
    getUsersByIds: vi.fn(async (_db: unknown, userIds: string[]) =>
      userIds.map((userId) => ({ userId, email: "rev@org.test" })),
    ),
    getTrackNamesByIds: vi.fn(async (_db: unknown, trackIds: string[]) =>
      new Map(trackIds.map((id) => [id, "Track One"])),
    ),
    getSubmissionLabelsByIds: vi.fn(async (_db: unknown, submissionIds: string[]) =>
      new Map(submissionIds.map((id) => [id, { ref: "S-1", title: "Talk" }])),
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
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

function postReviewer(auth: AuthInfo, body: Record<string, unknown>) {
  return buildApp(auth).then((app) =>
    app.request(`/api/v1/plans/${planRecord.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    }),
  );
}

describe("DEC-354: POST reviewers rejects foreign-event track/submission ids", () => {
  it("400s and writes no row for a trackId from a different event", async () => {
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1", trackId: "track-cross-event" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.trackId).toBeDefined();
    expect(vi.mocked(reviewRepo.addReviewers)).not.toHaveBeenCalled();
  });

  it("400s and writes no row for a submissionId from a different event", async () => {
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1", submissionId: "sub-cross-event" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.submissionId).toBeDefined();
    expect(vi.mocked(reviewRepo.addReviewers)).not.toHaveBeenCalled();
  });

  it("succeeds and writes a row for a valid in-event trackId", async () => {
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1", trackId: "track-1" },
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(reviewRepo.addReviewers)).toHaveBeenCalledTimes(1);
  });

  it("succeeds and writes a row for a valid in-event submissionId", async () => {
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1", submissionId: "sub-1" },
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(reviewRepo.addReviewers)).toHaveBeenCalledTimes(1);
  });

  it("succeeds and writes a row with no trackId/submissionId (unrestricted assignment)", async () => {
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1" },
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(reviewRepo.addReviewers)).toHaveBeenCalledTimes(1);
  });
});

describe("DEC-354: isSubmissionInReviewerScope per-submission branch is event-bounded", () => {
  it("returns false for a plan_reviewer row naming a submission from a different event", async () => {
    // Real (unmocked) submissions.ts module — this exercises the repo
    // predicate directly against a fake db.
    const { isSubmissionInReviewerScope } = await vi.importActual<
      typeof import("../src/server/repo/review/submissions")
    >("../src/server/repo/review/submissions");

    const planReviewerRows = [
      { id: "pr-1", planId: planRecord.id, userId: "rev-1", trackId: null, submissionId: "sub-foreign" },
    ];

    // Minimal drizzle-like fake: first select() is the plan_reviewer scope
    // lookup, second is the bounded submission existence check.
    let call = 0;
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => {
            call += 1;
            if (call === 1) {
              // DEC-346 amendment (wave 18): isSubmissionInReviewerScope's
              // own plan_reviewer read is now ordered+capped like its
              // sibling resolveReviewerSubmissions.
              return {
                orderBy: () => ({
                  limit: () => Promise.resolve(planReviewerRows),
                }),
              };
            }
            // Bounded existence check: submission "sub-foreign" does NOT
            // belong to planRecord.eventId, so this returns empty.
            return {
              limit: () => Promise.resolve([]),
            };
          },
        }),
      }),
    };

    const result = await isSubmissionInReviewerScope(
      fakeDb as never,
      planRecord as never,
      "rev-1",
      "sub-foreign",
    );
    expect(result).toBe(false);
  });
});
