// DEC-786 coverage for task w3-e: GET/POST /api/v1/plans/:id/assignments/
// distribute(/preview). The preview writes nothing and reports exactly the
// pairs the apply call would add; apply writes exactly those pairs.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

interface FakePlan {
  id: string;
  eventId: string;
  name: string;
  instructions: string | null;
  openDate: number | null;
  closeDate: number | null;
  filters: null;
  anonymized: boolean;
  scale: { min: number; max: number };
  criteria: unknown[];
  rounds: number;
  currentRound: number;
  roundCriteria: null;
  maxEvaluations: number | null;
}

function makePlan(overrides: Partial<FakePlan> = {}): FakePlan {
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
    roundCriteria: null,
    maxEvaluations: 1,
    ...overrides,
  };
}

const SUBMISSIONS = [
  { id: "sub-1", ref: "SES-001", title: "Talk One", trackIds: [], status: "pending" },
  { id: "sub-2", ref: "SES-002", title: "Talk Two", trackIds: [], status: "pending" },
];

// Amendment (wave 52): an all-null (trackId AND submissionId both null,
// i.e. 'All submissions') row now resolves as ALREADY covering every
// submission (resolveAssignments, src/domain/evaluation.ts) -- distribute
// proposes nothing for scope that already covers everything. These fixture
// rows instead point at a submission outside the 2-submission SUBMISSIONS
// set below: broad for ELIGIBILITY (no trackId row at all) but zero real
// resolved coverage among sub-1/sub-2, reproducing the "freshly added,
// unscoped reviewer" shape these tests exercise.
let plan = makePlan();
let reviewerRows: { id: string; planId: string; userId: string; trackId: string | null; submissionId: string | null }[] = [
  { id: "pr-1", planId: "plan-1", userId: "rev-1", trackId: null, submissionId: "sub-elsewhere" },
  { id: "pr-2", planId: "plan-1", userId: "rev-2", trackId: null, submissionId: "sub-elsewhere" },
];
let recusals: { planId: string; submissionId: string; userId: string; reason: string | null; createdAt: number }[] = [];
let addedRows: { userId: string; submissionId: string | null }[] = [];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => reviewerRows),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
    listRecusalsForPlan: vi.fn(async () => recusals),
    batchUserDisplayNames: vi.fn(async (_db: unknown, userIds: string[]) => {
      const names: Record<string, string> = { "rev-1": "Ada Lovelace", "rev-2": "Grace Hopper" };
      return new Map(userIds.map((id) => [id, names[id] ?? null]));
    }),
    getUsersByIds: vi.fn(async (_db: unknown, userIds: string[]) =>
      userIds.map((id) => ({ userId: id, email: `${id}@example.com` })),
    ),
    addReviewers: vi.fn(
      async (_db: unknown, planId: string, inputs: { userId: string; trackId?: string | null; submissionId?: string | null }[]) => {
        if (planId !== plan.id) throw new Error("unknown plan");
        const rows = inputs.map((input) => {
          const row = { id: `new-${addedRows.length}`, planId, userId: input.userId, trackId: input.trackId ?? null, submissionId: input.submissionId ?? null };
          addedRows.push({ userId: input.userId, submissionId: input.submissionId ?? null });
          reviewerRows.push(row);
          return row;
        });
        return rows;
      },
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  plan = makePlan();
  reviewerRows = [
    { id: "pr-1", planId: "plan-1", userId: "rev-1", trackId: null, submissionId: "sub-elsewhere" },
    { id: "pr-2", planId: "plan-1", userId: "rev-2", trackId: null, submissionId: "sub-elsewhere" },
  ];
  recusals = [];
  addedRows = [];
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

describe("GET /api/v1/plans/:id/assignments/distribute/preview (DEC-786/DEC-840)", () => {
  it("returns the pairs a distribute call would add, with names resolved via batchUserDisplayNames, and writes nothing", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute/preview`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cap: number | null;
      items: { submissionId: string; userId: string }[];
      perReviewer: {
        userId: string;
        name: string;
        trackName: string | null;
        before: number;
        after: number;
        added: number;
        eligible: boolean;
        reason: string | null;
      }[];
      totalAssigned: number;
      shortfall: { submissionId: string; needed: number; reason: string }[];
    };
    expect(body.cap).toBeNull();
    expect(body.items).toEqual([
      { submissionId: "sub-1", userId: "rev-1" },
      { submissionId: "sub-2", userId: "rev-2" },
    ]);
    expect(body.perReviewer).toEqual([
      { userId: "rev-1", name: "Ada Lovelace", trackName: null, before: 0, after: 1, added: 1, eligible: true, reason: null },
      { userId: "rev-2", name: "Grace Hopper", trackName: null, before: 0, after: 1, added: 1, eligible: true, reason: null },
    ]);
    expect(body.totalAssigned).toBe(2);
    expect(body.shortfall).toEqual([]);
    // Nothing written.
    expect(reviewerRows.length).toBe(2);
    expect(addedRows.length).toBe(0);
  });

  it("requires the organizer role", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute/preview`);
    expect(res.status).toBe(403);
  });

  it("DEC-824/DEC-840: a cap of 1 leaves the second submission a shortfall, and the preview echoes the cap it used", async () => {
    // 2 reviews needed per submission, but only 2 reviewers total each
    // capped at 1 -- sub-1 consumes both reviewers' whole capacity, so
    // sub-2 is an honest shortfall rather than a silent under-fill.
    plan.maxEvaluations = 2;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute/preview?cap=1`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cap: number | null;
      totalAssigned: number;
      shortfall: { submissionId: string; ref: string; title: string; trackName: string | null; needed: number; reason: string }[];
    };
    expect(body.cap).toBe(1);
    expect(body.totalAssigned).toBe(2);
    expect(body.shortfall).toEqual([
      { submissionId: "sub-2", ref: "SES-002", title: "Talk Two", trackName: null, needed: 2, reason: "cap_reached" },
    ]);
  });

  it("DEC-824/DEC-840: rejects a non-positive-integer cap loudly, naming the field", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute/preview?cap=0`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("cap");
  });
});

describe("POST /api/v1/plans/:id/assignments/distribute (DEC-786/DEC-840)", () => {
  it("applies exactly the pairs the preview computed", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: number };
    expect(body.created).toBe(2);
    expect(addedRows).toEqual([
      { userId: "rev-1", submissionId: "sub-1" },
      { userId: "rev-2", submissionId: "sub-2" },
    ]);
  });

  it("DEC-840: honours a JSON {cap} body identically to the preview's ?cap query", async () => {
    plan.maxEvaluations = 2;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1", "content-type": "application/json" },
      body: JSON.stringify({ cap: 1 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: number };
    // capped at 1 each: only sub-1 gets fully staffed (2 reviewers x 1 pair).
    expect(body.created).toBe(2);
    expect(addedRows).toEqual([
      { userId: "rev-1", submissionId: "sub-1" },
      { userId: "rev-2", submissionId: "sub-1" },
    ]);
  });

  it("is idempotent: a second call proposes nothing new once the first has applied", async () => {
    const app = await buildApp(organizer);
    await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    const res2 = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { created: number };
    expect(body2.created).toBe(0);
  });
});
