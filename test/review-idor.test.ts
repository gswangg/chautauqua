// DEC-039 regression coverage: the reviewer surface (/api/v1/review/*) must
// scope organizer access to their own org, never trusting a bare planId/
// eventId path/query param. Repo calls are mocked so these are pure
// route-level access-decision tests (no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";

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
    // getPlanForOrg is org-scoped: only returns the plan when orgId matches
    // the fixture's "owning" org (ORG_A). This is what requireAssignedPlan
    // must call for the organizer branch.
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    // getPlanById is intentionally UN-scoped (repo-internal helper) so we
    // can assert route handlers never rely on it directly for organizer
    // access decisions.
    getPlanById: vi.fn(async (_db: unknown, planId: string) =>
      planId === planRecord.id ? planRecord : null,
    ),
    listPlansForEvent: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === planRecord.eventId ? [planRecord] : [],
    ),
    listPlanIdsForReviewer: vi.fn(async () => []),
    resolveReviewerSubmissions: vi.fn(async () => []),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === planRecord.eventId ? { id: submissionId, ref: "S-1", title: "Talk" } : null,
    ),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    listEvaluationsForPlan: vi.fn(async () => []),
    getEvaluation: vi.fn(async () => null),
    upsertEvaluation: vi.fn(async (_db: unknown, input: unknown) => input),
    listReviewerRowsForPlan: vi.fn(async (_db: unknown, planId: string) =>
      planId === planRecord.id ? [{ id: "pr-1", planId: planRecord.id, userId: "rev-1", trackId: null, submissionId: null }] : [],
    ),
    getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
    getReviewerRowById: vi.fn(async (_db: unknown, reviewerId: string) =>
      reviewerId === "pr-1" ? { id: "pr-1", planId: planRecord.id, userId: "rev-1", trackId: null, submissionId: null } : null,
    ),
    removeReviewerById: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === planRecord.eventId && orgId === ORG_A ? { id: eventId, orgId } : null,
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

describe("DEC-039: reviewer-surface plan access is org-scoped", () => {
  it("GET /api/v1/plans/:id (producer, requireOwnedPlan) 404s for an organizer of another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/plans/${planRecord.id}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/review/plans/:id/queue 404s for an organizer of another org (was previously getPlanById-only, cross-org leak)", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/review/plans/:id/queue succeeds for the owning org's organizer", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
  });

  it("GET /api/v1/review/submissions/:id 404s for an organizer of another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    expect(res.status).toBe(404);
  });

  it("PUT /api/v1/review/plans/:planId/evaluations/:submissionId 404s for an organizer of another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(
      `/api/v1/review/plans/${planRecord.id}/evaluations/sub-1`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ scores: { c1: 5 } }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/review/plans requires eventId for organizers", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/review/plans");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });

  it("GET /api/v1/review/plans?eventId=... 404s when the event belongs to another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/review/plans?eventId=${planRecord.eventId}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/review/plans?eventId=... succeeds and lists plans for the owning org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans?eventId=${planRecord.eventId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(planRecord.id);
  });
});

describe("DEC-043/044: reviewer-row management (GET list + DELETE by row id)", () => {
  it("GET /api/v1/plans/:id/reviewers 404s for an organizer of another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/reviewers`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/plans/:id/reviewers lists reviewer rows joined to email for the owning org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/reviewers`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; userId: string; email: string }> };
    expect(body.items).toEqual([{ id: "pr-1", userId: "rev-1", email: "rev1@org.test", trackId: null, submissionId: null }]);
  });

  it("DELETE /api/v1/plans/:id/reviewers/:reviewerId 404s for an organizer of another org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/reviewers/pr-1`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/v1/plans/:id/reviewers/:reviewerId 404s when the row belongs to a different plan", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/reviewers/not-a-row`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/v1/plans/:id/reviewers/:reviewerId removes the row for the owning org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/reviewers/pr-1`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(204);
  });
});
