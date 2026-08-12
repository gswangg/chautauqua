// DEC-460/DEC-461: bounds the three review-area list endpoints that used to
// return every row with a cosmetic {page:1,perPage:items.length} envelope --
// GET /api/v1/events/:eventId/plans, GET /api/v1/plans/:id/reviewers, and
// GET /api/v1/review/plans (both its organizer and reviewer branches). Repo
// calls are mocked (same pattern as test/review-results-sort-page.test.ts)
// so these are pure route-level paging tests, no D1/wrangler dependency in
// stage 1. Also covers the SAFETY-CRITICAL invariant that
// files-authz.ts:153's unpaged `listPlansForEvent(db, eventId)` call
// (reviewerCanAccessSubmissionFile) keeps seeing every plan, never just a
// first page, since a paged read there would silently weaken a reviewer's
// file-access check.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PlanRecord } from "../src/server/repo/review";

const ORG_A = "org-a";
const EVENT_ID = "event-1";

function makePlan(n: number): PlanRecord {
  return {
    id: `plan-${String(n).padStart(4, "0")}`,
    eventId: EVENT_ID,
    name: `Plan ${n}`,
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: n,
    updatedAt: n,
  };
}

// 250 plans for the event -- enough to prove a real ceiling is enforced (the
// default perPage is 200) and to exercise a page-2 offset.
const ALL_PLANS: PlanRecord[] = Array.from({ length: 250 }, (_, i) => makePlan(i + 1));
const plansById = new Map(ALL_PLANS.map((p) => [p.id, p]));

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      orgId === ORG_A ? (plansById.get(planId) ?? null) : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => plansById.get(planId) ?? null),
    listPlansForEvent: vi.fn(async (_db: unknown, eventId: string, page?: { limit: number; offset: number }) => {
      const rows = eventId === EVENT_ID ? ALL_PLANS : [];
      return page ? rows.slice(page.offset, page.offset + page.limit) : rows;
    }),
    countPlansForEvent: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_ID ? ALL_PLANS.length : 0)),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) =>
      userId === "rev-1" ? ALL_PLANS.map((p) => p.id) : [],
    ),
    listReviewerRowsForPlan: vi.fn(
      async (_db: unknown, planId: string, page?: { limit: number; offset: number }) => {
        const rows = Array.from({ length: 250 }, (_, i) => ({
          id: `pr-${planId}-${String(i + 1).padStart(4, "0")}`,
          planId,
          userId: `user-${i + 1}`,
          trackId: null,
          submissionId: null,
        }));
        return page ? rows.slice(page.offset, page.offset + page.limit) : rows;
      },
    ),
    countReviewerRowsForPlan: vi.fn(async () => 250),
    getUsersByIds: vi.fn(async (_db: unknown, userIds: string[]) =>
      userIds.map((userId) => ({ userId, email: `${userId}@example.com` })),
    ),
    // Overridden per-test below (files-authz regression); default false so
    // other suites (which don't touch reviewerCanAccessSubmissionFile) are
    // unaffected.
    isSubmissionInReviewerScope: vi.fn(async () => false),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === EVENT_ID && orgId === ORG_A ? { id: eventId, orgId } : null,
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

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };
const reviewer: AuthInfo = { userId: "rev-1", role: "reviewer", orgId: ORG_A };

interface Envelope {
  items: unknown[];
  total: number;
  page: number;
  perPage: number;
}

describe("DEC-460/461: GET /api/v1/events/:eventId/plans", () => {
  it("clamps a huge ?perPage to at most 200", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/plans?perPage=100000`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
  });

  it("uses the 200 default for an invalid ?perPage", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/plans?perPage=abc`);
    const body = (await res.json()) as Envelope;
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBe(200);
  });

  it("?page=2 offsets past the first page", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/plans?page=2&perPage=200`);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe(ALL_PLANS.at(200)!.id);
  });

  it("reports the true total, not items.length", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/plans?perPage=10`);
    const body = (await res.json()) as Envelope;
    expect(body.total).toBe(250);
    expect(body.items.length).toBe(10);
  });
});

describe("DEC-460/461: GET /api/v1/plans/:id/reviewers", () => {
  const planId = ALL_PLANS.at(0)!.id;

  it("clamps a huge ?perPage to at most 200", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${planId}/reviewers?perPage=100000`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
  });

  it("uses the 200 default for an invalid ?perPage", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${planId}/reviewers?perPage=abc`);
    const body = (await res.json()) as Envelope;
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBe(200);
  });

  it("?page=2 offsets past the first page", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${planId}/reviewers?page=2&perPage=200`);
    const body = (await res.json()) as { items: { userId: string }[] };
    expect(body.items[0]?.userId).toBe("user-201");
  });

  it("reports the true total, not items.length", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${planId}/reviewers?perPage=10`);
    const body = (await res.json()) as Envelope;
    expect(body.total).toBe(250);
    expect(body.items.length).toBe(10);
  });
});

describe("DEC-460/461: GET /api/v1/review/plans (organizer branch)", () => {
  it("clamps a huge ?perPage to at most 200 and reports the true total", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/review/plans?eventId=${EVENT_ID}&perPage=100000`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
    expect(body.total).toBe(250);
  });

  it("uses the 200 default for an invalid ?perPage", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/review/plans?eventId=${EVENT_ID}&perPage=abc`);
    const body = (await res.json()) as Envelope;
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBe(200);
  });

  it("?page=2 offsets past the first page", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/review/plans?eventId=${EVENT_ID}&page=2&perPage=200`);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe(ALL_PLANS.at(200)!.id);
  });
});

describe("DEC-460/461(e): GET /api/v1/review/plans (reviewer branch, blessed JS-slice exception)", () => {
  it("clamps a huge ?perPage to at most 200 and still reports the true total", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans?perPage=100000`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
    expect(body.total).toBe(250);
  });

  it("uses the 200 default for an invalid ?perPage", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans?perPage=abc`);
    const body = (await res.json()) as Envelope;
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBe(200);
  });

  it("?page=2 offsets past the first page of the sorted id set", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/plans?page=2&perPage=200`);
    const body = (await res.json()) as { items: { id: string }[] };
    const sortedIds = [...ALL_PLANS.map((p) => p.id)].sort();
    expect(body.items[0]?.id).toBe(sortedIds[200]);
  });
});

describe("DEC-461(b) regression: files-authz.ts:153's unpaged listPlansForEvent call still sees every plan", () => {
  it("reviewerCanAccessSubmissionFile finds a plan beyond what a 200-row first page would contain", async () => {
    const { reviewerCanAccessSubmissionFile } = await import("../src/server/repo/files-authz");
    const reviewModule = (await import("../src/server/repo/review")) as unknown as {
      isSubmissionInReviewerScope: ReturnType<typeof vi.fn>;
      listPlansForEvent: ReturnType<typeof vi.fn>;
    };
    // The only in-scope submission is covered by plan-0250, at index 249 --
    // well past a first 200-row page. The fake db satisfies
    // reviewerCanAccessSubmissionFile's own db.select() call (the
    // plan_reviewer/evaluation_plan join for assignedPlanIds); the mocked
    // listPlansForEvent (top of this file) stands in for its unpaged
    // `listPlansForEvent(db, eventId)` call at files-authz.ts:153.
    const assignedRows = ALL_PLANS.map((p) => ({ planId: p.id }));
    let selectCall = 0;
    const fakeDb = {
      select: () => {
        selectCall += 1;
        const chain = {
          from: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve(assignedRows),
        };
        return chain;
      },
    } as unknown as import("../src/server/context").Db;

    reviewModule.isSubmissionInReviewerScope.mockImplementation(
      async (_db: unknown, plan: PlanRecord, _userId: string, submissionId: string) =>
        plan.id === "plan-0250" && submissionId === "sub-far",
    );

    const allowed = await reviewerCanAccessSubmissionFile(fakeDb, "rev-1", EVENT_ID, "sub-far");
    expect(allowed).toBe(true);
    expect(selectCall).toBe(1);
    // files-authz.ts:153 must call listPlansForEvent with NO page arg (the
    // SAFETY-CRITICAL invariant this task must not violate).
    expect(reviewModule.listPlansForEvent).toHaveBeenCalledWith(fakeDb, EVENT_ID);
  });
});
