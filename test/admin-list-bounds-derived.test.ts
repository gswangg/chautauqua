// DEC-466 coverage: the three DEC-013 list envelopes the w17-f inventory
// missed -- GET /api/v1/review/plans/:id/queue, GET /api/v1/plans/:id/progress
// and GET /api/v1/contacts/duplicates -- previously returned
// `total: <array>.length, page: 1, perPage: <array>.length || 1`, a cosmetic
// shape with no ceiling. All three assemble their `items` in JS from an
// already-materialized array, so DEC-461(e)'s blessed JS-slice exception
// applies: clampPage + listPerPage, slice the already-ordered array, report
// the FULL array length as `total`. Route-level, repo functions mocked (this
// repo's test harness runs vitest in plain node with no D1/miniflare binding
// — see test/admin-list-bounds-config.test.ts and friends).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PlanRecord } from "../src/server/repo/review";

const ORG_A = "org-a";
const ORGANIZER: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function basePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "plan-1",
    eventId: "event-a",
    name: "Plan",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    anonymizedAt: null,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/review/plans/:id/queue
// ---------------------------------------------------------------------------

describe("GET /api/v1/review/plans/:id/queue (DEC-466/461(e) bounds)", () => {
  const plan = basePlan();
  // Fewest-ratings-first order (buildReviewerQueue): sub-0..sub-4, all with
  // ratingsCount = index, none already rated -- preserves ascending order.
  const submissions = Array.from({ length: 5 }, (_, i) => ({
    id: `sub-${i}`,
    ref: `A-${i}`,
    title: `Submission ${i}`,
    trackIds: [] as string[],
    description: null,
  }));

  async function buildApp() {
    vi.doMock("../src/server/repo/review", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
      return {
        ...actual,
        getPlanForOrg: vi.fn(async () => plan),
        resolveReviewerSubmissions: vi.fn(async () => submissions),
        countEvaluationsBySubmission: vi.fn(async () => new Map(submissions.map((s, i) => [s.id, i]))),
        listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
        listRecusalsForReviewer: vi.fn(async () => []),
      };
    });
    const { reviewReviewerRoutes } = await import("../src/routes/review/reviewer");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewReviewerRoutes);
    return app;
  }

  it("perPage=100000 is clamped to at most 200 (would return all 5 rows unclamped)", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/review/plans/plan-1/queue?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { perPage: number; items: unknown[] };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("perPage=abc falls back to the 200 default", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/review/plans/plan-1/queue?perPage=abc");
    const body = (await res.json()) as { perPage: number };
    expect(body.perPage).toBe(200);
  });

  it("page=2&perPage=2 returns the second slice in fewest-ratings-first order", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/review/plans/plan-1/queue?perPage=2&page=2");
    const body = (await res.json()) as { items: { submissionId: string }[] };
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub-2", "sub-3"]);
  });

  it("total reflects the full queue regardless of the page slice", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/review/plans/plan-1/queue?perPage=2&page=1");
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(5);
    expect(body.items.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/plans/:id/progress
// ---------------------------------------------------------------------------

describe("GET /api/v1/plans/:id/progress (DEC-466/461(e) bounds)", () => {
  const plan = basePlan();
  const users = Array.from({ length: 5 }, (_, i) => ({ userId: `user-${i}`, email: `user-${i}@example.com` }));
  const reviewerRows = users.map((u, i) => ({ id: `rr-${i}`, planId: plan.id, userId: u.userId, trackId: null, submissionId: null }));

  async function buildApp() {
    vi.doMock("../src/server/repo/review", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
      return {
        ...actual,
        getPlanForOrg: vi.fn(async () => plan),
        listReviewerRowsForPlan: vi.fn(async () => reviewerRows),
        getUsersByIds: vi.fn(async () => users),
        batchUserDisplayNames: vi.fn(async () => new Map()),
        listCompletedPairsForPlan: vi.fn(async () => []),
        listPlanFilteredSubmissions: vi.fn(async () => []),
        listRecusalsForPlan: vi.fn(async () => []),
      };
    });
    const { reviewPlansRoutes } = await import("../src/routes/review/plans");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewPlansRoutes);
    return app;
  }

  it("perPage=100000 is clamped to at most 200 (would return all 5 rows unclamped)", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/plans/plan-1/progress?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { perPage: number; items: unknown[] };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("perPage=abc falls back to the 200 default", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/plans/plan-1/progress?perPage=abc");
    const body = (await res.json()) as { perPage: number };
    expect(body.perPage).toBe(200);
  });

  it("page=2&perPage=2 returns the second slice in the preserved `users` order", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/plans/plan-1/progress?perPage=2&page=2");
    const body = (await res.json()) as { items: { userId: string }[] };
    expect(body.items.map((i) => i.userId)).toEqual(["user-2", "user-3"]);
  });

  it("total reflects the full reviewer count regardless of the page slice", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/plans/plan-1/progress?perPage=2&page=1");
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(5);
    expect(body.items.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/contacts/duplicates
// ---------------------------------------------------------------------------

describe("GET /api/v1/contacts/duplicates (DEC-466/461(e) bounds)", () => {
  // findDuplicateGroupsForOrg is mocked directly here (its own DEC-466
  // stable-tiebreak-on-first-contact-id ordering is exercised where the
  // real function lives, not through this route-level mock) -- already in
  // its post-tiebreak order, so this suite only proves the route's own
  // page/perPage slicing preserves whatever order the repo call returns.
  const groupIds = ["c-0", "c-1", "c-2", "c-3", "c-4"];
  const groups = groupIds.map((id) => ({
    contactIds: [id, `${id}-dupe`],
    contacts: [
      { id, firstName: "A", lastName: "B", email: "a@example.com" },
      { id: `${id}-dupe`, firstName: "A", lastName: "B", email: "a@example.com" },
    ],
  }));

  async function buildApp() {
    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
      return {
        ...actual,
        findDuplicateGroupsForOrg: vi.fn(async () => groups),
      };
    });
    const { contactsRoutes } = await import("../src/routes/api/contacts/index");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);
    return app;
  }

  it("perPage=100000 is clamped to at most 200 (would return all 5 groups unclamped)", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/contacts/duplicates?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { perPage: number; items: unknown[] };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("perPage=abc falls back to the 200 default", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/contacts/duplicates?perPage=abc");
    const body = (await res.json()) as { perPage: number };
    expect(body.perPage).toBe(200);
  });

  it("page=2&perPage=2 returns the second slice, order preserved as given by the repo call", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/contacts/duplicates?perPage=2&page=2");
    const body = (await res.json()) as { items: { contactIds: string[] }[] };
    expect(body.items.map((g) => g.contactIds[0])).toEqual(["c-2", "c-3"]);
  });

  it("total reflects the full group count regardless of the page slice", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/contacts/duplicates?perPage=2&page=1");
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(5);
    expect(body.items.length).toBe(2);
  });
});
