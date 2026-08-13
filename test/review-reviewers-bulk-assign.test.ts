// DEC-924 regression coverage: POST /api/v1/plans/:id/reviewers's array
// form (submissionIds: string[]) is one set-based, all-or-nothing request --
// an unknown id or an id outside the plan's own filters_json trackIds
// refuses the ENTIRE request (400, fields.submissionIds naming the
// offending refs) with ZERO plan_reviewer rows written, and a fully valid
// set writes every row through one addReviewers() call and answers 201
// {items, total}. Mocking pattern mirrors test/review-plan-numeric-validation.test.ts
// (no D1/wrangler dependency in stage 1).

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

// SES-1..SES-4 all exist in event-1; SES-1/SES-2 are tagged track-a, the
// rest are tagged track-b.
const SUBMISSIONS: Record<string, { id: string; ref: string }> = {
  "sub-1": { id: "sub-1", ref: "SES-1" },
  "sub-2": { id: "sub-2", ref: "SES-2" },
  "sub-3": { id: "sub-3", ref: "SES-3" },
  "sub-4": { id: "sub-4", ref: "SES-4" },
};
const TRACK_A_SUBMISSIONS = new Set(["sub-1", "sub-2"]);

let writtenRows: { userId: string; trackId: string | null; submissionId: string | null }[] = [];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    requireOrgUser: vi.fn(async (_db: unknown, userId: string) => {
      if (userId !== "rev-1") throw new Error("unknown user in fixture");
      return { role: "reviewer", email: "rev1@org.test" };
    }),
    findSubmissionIdsByRefsOrIds: vi.fn(async (_db: unknown, eventId: string, inputs: string[]) => {
      const map = new Map<string, string>();
      if (eventId !== plan.eventId) return map;
      for (const input of inputs) {
        const bySub = Object.values(SUBMISSIONS).find((s) => s.id === input || s.ref === input);
        if (bySub) map.set(input, bySub.id);
      }
      return map;
    }),
    findSubmissionIdByRefOrId: vi.fn(async (_db: unknown, eventId: string, input: string) => {
      if (eventId !== plan.eventId) return null;
      const bySub = Object.values(SUBMISSIONS).find((s) => s.id === input || s.ref === input);
      return bySub?.id ?? null;
    }),
    submissionsMatchingPlanFilters: vi.fn(async (_db: unknown, _plan: unknown, submissionIds: string[]) => {
      return new Set(submissionIds.filter((id) => TRACK_A_SUBMISSIONS.has(id)));
    }),
    submissionMatchesPlanFilters: vi.fn(async (_db: unknown, _plan: unknown, submissionId: string) =>
      TRACK_A_SUBMISSIONS.has(submissionId),
    ),
    addReviewers: vi.fn(
      async (_db: unknown, planId: string, inputs: { userId: string; trackId?: string | null; submissionId?: string | null }[]) => {
        const rows = inputs.map((input, i) => ({
          id: `pr-${writtenRows.length + i + 1}`,
          planId,
          userId: input.userId,
          trackId: input.trackId ?? null,
          submissionId: input.submissionId ?? null,
        }));
        writtenRows.push(...rows.map((r) => ({ userId: r.userId, trackId: r.trackId, submissionId: r.submissionId })));
        return rows;
      },
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  plan = makePlan();
  writtenRows = [];
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

describe("DEC-924: POST /api/v1/plans/:id/reviewers submissionIds[] array form", () => {
  it("happy path: writes every row through one addReviewers() call, answers 201 {items, total}", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ userId: "rev-1", submissionIds: ["SES-1", "sub-2"] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.total).toBe(2);
    expect(body.items.length).toBe(2);
    expect(writtenRows).toEqual([
      { userId: "rev-1", trackId: null, submissionId: "sub-1" },
      { userId: "rev-1", trackId: null, submissionId: "sub-2" },
    ]);
    const { addReviewers } = await import("../src/server/repo/review");
    // ONE insert call for the whole set, not one per submission.
    expect(vi.mocked(addReviewers).mock.calls.length).toBe(1);
  });

  it("refuses the entire request on an unknown id -- zero writes", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ userId: "rev-1", submissionIds: ["SES-1", "SES-999"] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.submissionIds).toContain("SES-999");
    const { addReviewers } = await import("../src/server/repo/review");
    expect(vi.mocked(addReviewers).mock.calls.length).toBe(0);
    expect(writtenRows.length).toBe(0);
  });

  it("refuses the entire request when one id is outside the plan's own filters_json trackIds -- zero writes", async () => {
    plan = makePlan({ filters: { trackIds: ["track-a"] } });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      // sub-1 is track-a (in scope), sub-3 is track-b (out of scope).
      body: JSON.stringify({ userId: "rev-1", submissionIds: ["sub-1", "sub-3"] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.submissionIds).toContain("sub-3");
    const { addReviewers } = await import("../src/server/repo/review");
    expect(vi.mocked(addReviewers).mock.calls.length).toBe(0);
    expect(writtenRows.length).toBe(0);
  });

  it("the pre-existing single submissionId form is unchanged", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ userId: "rev-1", submissionId: "SES-1" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { submissionId: string };
    expect(body.submissionId).toBe("sub-1");
  });
});
