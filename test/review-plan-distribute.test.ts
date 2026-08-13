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

let plan = makePlan();
let reviewerRows: { id: string; planId: string; userId: string; trackId: string | null; submissionId: string | null }[] = [
  { id: "pr-1", planId: "plan-1", userId: "rev-1", trackId: null, submissionId: null },
  { id: "pr-2", planId: "plan-1", userId: "rev-2", trackId: null, submissionId: null },
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
    addReviewer: vi.fn(async (_db: unknown, planId: string, input: { userId: string; submissionId?: string | null }) => {
      if (planId !== plan.id) throw new Error("unknown plan");
      const row = { id: `new-${addedRows.length}`, planId, userId: input.userId, trackId: null, submissionId: input.submissionId ?? null };
      addedRows.push({ userId: input.userId, submissionId: input.submissionId ?? null });
      reviewerRows.push(row);
      return row;
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  plan = makePlan();
  reviewerRows = [
    { id: "pr-1", planId: "plan-1", userId: "rev-1", trackId: null, submissionId: null },
    { id: "pr-2", planId: "plan-1", userId: "rev-2", trackId: null, submissionId: null },
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

describe("GET /api/v1/plans/:id/assignments/distribute/preview (DEC-786)", () => {
  it("returns the pairs a distribute call would add, with names resolved via batchUserDisplayNames, and writes nothing", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute/preview`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { userId: string; reviewerName: string; submissionId: string; submissionRef: string; submissionTitle: string }[];
      perReviewer: { userId: string; name: string; added: number; total: number }[];
    };
    expect(body.items).toEqual([
      { userId: "rev-1", reviewerName: "Ada Lovelace", submissionId: "sub-1", submissionRef: "SES-001", submissionTitle: "Talk One" },
      { userId: "rev-2", reviewerName: "Grace Hopper", submissionId: "sub-2", submissionRef: "SES-002", submissionTitle: "Talk Two" },
    ]);
    expect(body.perReviewer).toEqual([
      { userId: "rev-1", name: "Ada Lovelace", added: 1, total: 1 },
      { userId: "rev-2", name: "Grace Hopper", added: 1, total: 1 },
    ]);
    // Nothing written.
    expect(reviewerRows.length).toBe(2);
    expect(addedRows.length).toBe(0);
  });

  it("requires the organizer role", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute/preview`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/plans/:id/assignments/distribute (DEC-786)", () => {
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
