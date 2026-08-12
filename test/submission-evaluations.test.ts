// DEC-596: GET /api/v1/submissions/:id/evaluations -- the organiser reads
// the same evaluation the reviewer wrote, org-scoped via getSubmissionOwnership.
// Repo calls are mocked so these are pure route-level tests (no D1/wrangler
// dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as evaluationsRepo from "../src/server/repo/review/evaluations";

const ORG_A = "org-a";
const ORG_B = "org-b";
const SUBMISSION_ID = "sub-1";

const namedRow = {
  planId: "plan-1",
  planName: "Round 1 review",
  round: 1,
  reviewerName: "Jamie Reviewer",
  scores: { c1: 4 },
  comment: "Solid proposal, would love more detail on the demo.",
  submittedAt: 1_700_000_000_000,
};

const anonymizedRow = {
  planId: "plan-2",
  planName: "Blind review",
  round: 1,
  reviewerName: null,
  scores: { c1: 2 },
  comment: "Scope is too broad for the slot.",
  submittedAt: 1_700_000_100_000,
};

vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
    "../src/server/repo/submissions",
  );
  return {
    ...actual,
    getSubmissionOwnership: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID ? { eventId: "event-1", orgId: ORG_A } : null,
    ),
  };
});

vi.mock("../src/server/repo/review/evaluations", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/evaluations")>(
    "../src/server/repo/review/evaluations",
  );
  return {
    ...actual,
    listEvaluationsForSubmission: vi.fn(async () => [namedRow, anonymizedRow]),
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

describe("DEC-596: GET /api/v1/submissions/:id/evaluations", () => {
  it("organiser sees the full comment text and reviewer name for a non-anonymized plan", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ reviewerName: string | null; comment: string | null }> };
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      reviewerName: "Jamie Reviewer",
      comment: "Solid proposal, would love more detail on the demo.",
    });
  });

  it("hides the reviewer name (null) for an evaluation whose plan is anonymized", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ reviewerName: string | null; comment: string | null }> };
    expect(body.items[1]).toMatchObject({
      reviewerName: null,
      comment: "Scope is too broad for the slot.",
    });
  });

  it("404s for an unknown submission", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/does-not-exist/evaluations`);
    expect(res.status).toBe(404);
  });

  it("403s when the submission belongs to a different org", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(403);
  });

  it("401s when unauthenticated", async () => {
    const { reviewRoutes } = await import("../src/routes/review");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewRoutes);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(401);
  });
});
