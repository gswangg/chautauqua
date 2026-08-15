// DEC-018 (wave-10 amendment, task w10-d): the review-plan open/close window
// was already enforced on the reviewer queue and the score PUT, but NOT on
// the lone-submission detail GET, recusal POST/DELETE, or the file-download
// authz check (reviewerCanAccessSubmissionFile) — a reviewer could read a
// submission and download its deliverables before the plan opened, or
// indefinitely after it closed. This file exercises the closed gate on all
// four surfaces plus their positive (open / unbounded) counterparts.
//
// Route-layer coverage follows test/review-recusal.test.ts's pattern: a real
// Hono app with src/server/repo/review mocked by a small stateful/lookup
// fake. reviewerCanAccessSubmissionFile is exercised directly against a
// canned-queue fake db, following test/files-authz-anonymized-plan.test.ts's
// makeChain/makeQueueDb pattern.

import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

const ORG_A = "org-a";

// Day-label epoch ms for 2020-01-01 and 2020-01-02 (well in the past relative
// to "now" in these tests, which vitest runs at the real current time).
const PAST_OPEN = Date.UTC(2020, 0, 1);
const PAST_CLOSE = Date.UTC(2020, 0, 2);
// Far future day labels: window not yet open.
const FUTURE_OPEN = Date.UTC(2099, 0, 1);
const FUTURE_CLOSE = Date.UTC(2099, 0, 2);

function makePlan(id: string, openDate: number | null, closeDate: number | null) {
  return {
    id,
    eventId: "event-1",
    name: `Plan ${id}`,
    instructions: null,
    openDate,
    closeDate,
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
}

const CLOSED_PLAN = makePlan("plan-closed", PAST_OPEN, PAST_CLOSE);
const NOT_YET_OPEN_PLAN = makePlan("plan-future", FUTURE_OPEN, FUTURE_CLOSE);
const UNBOUNDED_PLAN = makePlan("plan-unbounded", null, null);
const OPEN_PLAN = makePlan("plan-open", PAST_OPEN, FUTURE_CLOSE);

const PLANS = [CLOSED_PLAN, NOT_YET_OPEN_PLAN, UNBOUNDED_PLAN, OPEN_PLAN];

const SUB_1 = { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] };
const SUBMISSIONS = [SUB_1];

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

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      orgId === ORG_A ? (PLANS.find((p) => p.id === planId) ?? null) : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => PLANS.find((p) => p.id === planId) ?? null),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) =>
      userId === "rev-1" ? PLANS.map((p) => p.id) : [],
    ),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === "event-1" && SUBMISSIONS.some((s) => s.id === submissionId)
        ? SUBMISSIONS.find((s) => s.id === submissionId)!
        : null,
    ),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
    getEvaluation: vi.fn(async () => null),
    hasRecusal: vi.fn(
      async (_db: unknown, planId: string, submissionId: string, userId: string) =>
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
  };
});

afterEach(() => {
  vi.clearAllMocks();
  recusals = [];
  nextRecusalId = 1;
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

describe("DEC-018 (wave-10): review-plan window gates detail GET + recusal writes", () => {
  for (const plan of [CLOSED_PLAN, NOT_YET_OPEN_PLAN]) {
    describe(`window ${plan.id === CLOSED_PLAN.id ? "closed" : "not yet open"}`, () => {
      it("reviewer detail GET 409s with the score-PUT vocabulary", async () => {
        const app = await buildApp(reviewer);
        const res = await app.request(`/api/v1/review/submissions/${SUB_1.id}?planId=${plan.id}`);
        expect(res.status).toBe(409);
        const body = (await res.json()) as { error: { message: string } };
        expect(body.error.message).toBe("This review plan is not currently open");
      });

      it("reviewer recuse (POST) 409s", async () => {
        const app = await buildApp(reviewer);
        const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-chq-csrf": "1" },
          body: JSON.stringify({ reason: null }),
        });
        expect(res.status).toBe(409);
        const body = (await res.json()) as { error: { message: string } };
        expect(body.error.message).toBe("This review plan is not currently open");
      });

      it("reviewer unrecuse (DELETE) 409s", async () => {
        const app = await buildApp(reviewer);
        const res = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
          method: "DELETE",
          headers: { "x-chq-csrf": "1" },
        });
        expect(res.status).toBe(409);
        const body = (await res.json()) as { error: { message: string } };
        expect(body.error.message).toBe("This review plan is not currently open");
      });

      it("organizer detail GET is exempt from the window and still succeeds", async () => {
        const app = await buildApp(organizer);
        const res = await app.request(`/api/v1/review/submissions/${SUB_1.id}?planId=${plan.id}`);
        expect(res.status).toBe(200);
      });
    });
  }

  for (const plan of [OPEN_PLAN, UNBOUNDED_PLAN]) {
    describe(`window ${plan.id === OPEN_PLAN.id ? "open" : "unbounded (null/null)"}`, () => {
      it("reviewer detail GET succeeds", async () => {
        const app = await buildApp(reviewer);
        const res = await app.request(`/api/v1/review/submissions/${SUB_1.id}?planId=${plan.id}`);
        expect(res.status).toBe(200);
      });

      it("reviewer recuse then unrecuse both succeed", async () => {
        const app = await buildApp(reviewer);
        const post = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-chq-csrf": "1" },
          body: JSON.stringify({ reason: null }),
        });
        expect(post.status).toBe(201);
        const del = await app.request(`/api/v1/review/plans/${plan.id}/recusals/${SUB_1.id}`, {
          method: "DELETE",
          headers: { "x-chq-csrf": "1" },
        });
        expect(del.status).toBe(204);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// reviewerCanAccessSubmissionFile: closed-plan candidate is dropped, same as
// the existing anonymized-plan filter. Fake-db queue pattern lifted from
// test/files-authz-anonymized-plan.test.ts.
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function makeQueueDb(responses: unknown[][]): Db {
  let call = 0;
  return {
    select: () => {
      const rows = responses[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  } as unknown as Db;
}

const EVENT_ID = "ev1";
const USER_ID = "user-reviewer-1";
const SUBMISSION_ID = "sub1";
const now = new Date("2026-01-01T00:00:00Z");

function evaluationPlanRow(id: string, openDate: Date | null, closeDate: Date | null) {
  return {
    id,
    eventId: EVENT_ID,
    name: `Plan ${id}`,
    instructions: null,
    openDate,
    closeDate,
    filtersJson: null,
    anonymized: false,
    scaleJson: JSON.stringify({ min: 1, max: 5 }),
    criteriaJson: JSON.stringify([]),
    rounds: 1,
    currentRound: 1,
    roundCriteriaJson: null,
    maxEvaluations: null,
    createdAt: now,
    updatedAt: now,
  };
}

const UNRESTRICTED_ASSIGNMENT_ROW = { trackId: null, submissionId: null };

describe("reviewerCanAccessSubmissionFile — DEC-018 (wave-10): closed plan can't authorise a download", () => {
  it("a plan whose window already closed is dropped from candidatePlans -- false", async () => {
    const { reviewerCanAccessSubmissionFile } = await import("../src/server/repo/files-authz");
    const CLOSED = "plan-closed-file";
    const db = makeQueueDb([
      [{ planId: CLOSED }],
      [{ plan: evaluationPlanRow(CLOSED, new Date("2020-01-01T00:00:00Z"), new Date("2020-01-02T00:00:00Z")), timezone: "UTC" }],
    ]);
    const inScope = await reviewerCanAccessSubmissionFile(
      db,
      USER_ID,
      EVENT_ID,
      SUBMISSION_ID,
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(inScope).toBe(false);
  });

  it("a plan whose window has not opened yet is dropped -- false", async () => {
    const { reviewerCanAccessSubmissionFile } = await import("../src/server/repo/files-authz");
    const FUTURE = "plan-future-file";
    const db = makeQueueDb([
      [{ planId: FUTURE }],
      [{ plan: evaluationPlanRow(FUTURE, new Date("2099-01-01T00:00:00Z"), new Date("2099-01-02T00:00:00Z")), timezone: "UTC" }],
    ]);
    const inScope = await reviewerCanAccessSubmissionFile(
      db,
      USER_ID,
      EVENT_ID,
      SUBMISSION_ID,
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(inScope).toBe(false);
  });

  it("an open (unbounded null/null) plan still authorises -- true", async () => {
    const { reviewerCanAccessSubmissionFile } = await import("../src/server/repo/files-authz");
    const OPEN = "plan-open-file";
    const db = makeQueueDb([
      [{ planId: OPEN }],
      [{ plan: evaluationPlanRow(OPEN, null, null), timezone: "UTC" }],
      [UNRESTRICTED_ASSIGNMENT_ROW],
      [{ id: SUBMISSION_ID }],
    ]);
    const inScope = await reviewerCanAccessSubmissionFile(
      db,
      USER_ID,
      EVENT_ID,
      SUBMISSION_ID,
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(inScope).toBe(true);
  });
});
