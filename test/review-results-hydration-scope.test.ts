// DEC-829 (w32 amendment): HYDRATION IS PER-PAGE. GET /api/v1/plans/:id/
// results must rank the WHOLE population, then hydrate (speakers/track
// names/recusals) only the page it actually returns -- CSV export is the one
// caller allowed to hydrate every ranked row, since its byte content is
// every row in sort order. This test instruments repo.listSpeakerNames
// ForSubmissions/listTrackNamesForSubmissions (the two DEC-703 hydration
// reads) to record the id-array length each call is handed, then asserts:
// the JSON page path never hands hydration more than `perPage` ids, and the
// CSV path hands it every ranked row.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PlanRecord } from "../src/server/repo/review";

const ORG_A = "org-a";
const PLAN_ID = "plan-1";

// 5 ranked submissions -- enough to prove a perPage=2 page never sees the
// other 3 ids at hydration time.
const SUBMISSION_COUNT = 5;

function planRecord(): PlanRecord {
  return {
    id: PLAN_ID,
    eventId: "event-1",
    name: "Plan One",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    anonymizedAt: null,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    roundMeta: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
  } as unknown as PlanRecord;
}

function fakeSubmissions() {
  return Array.from({ length: SUBMISSION_COUNT }, (_, i) => ({
    id: `sub-${i + 1}`,
    ref: `S-00${i + 1}`,
    title: `Talk ${i + 1}`,
    status: "pending",
  }));
}

interface HydrationCall {
  reader: string;
  idCount: number;
}

let hydrationCalls: HydrationCall[];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === PLAN_ID && orgId === ORG_A ? planRecord() : null,
    ),
    // Rank-phase reads: fixed population, decreasing average so ref order is
    // predictable (sub-1 highest average, sub-5 lowest).
    listPlanFilteredSubmissions: vi.fn(async () => fakeSubmissions()),
    listEvaluationScoresForPlan: vi.fn(async () =>
      fakeSubmissions().map((sub, i) => ({
        submissionId: sub.id,
        scores: { c1: SUBMISSION_COUNT - i },
      })),
    ),
    // Hydration-phase reads: instrumented to record the id-array length each
    // call receives.
    listSpeakerNamesForSubmissions: vi.fn(async (_db: unknown, ids: string[]) => {
      hydrationCalls.push({ reader: "speakers", idCount: ids.length });
      return new Map(ids.map((id) => [id, [`Speaker for ${id}`]]));
    }),
    listTrackNamesForSubmissions: vi.fn(async (_db: unknown, ids: string[]) => {
      hydrationCalls.push({ reader: "trackNames", idCount: ids.length });
      return new Map(ids.map((id) => [id, [`Track for ${id}`]]));
    }),
    listRecusalsForPlan: vi.fn(async () => []),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  hydrationCalls = [];
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

describe("DEC-829 (w32 amendment): plan results hydration scope", () => {
  it("JSON page path hydrates only the page's own rows, never the whole ranked population", async () => {
    hydrationCalls = [];
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${PLAN_ID}/results?perPage=2&page=1`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(2);
    // total still counts the WHOLE ranked set, not the page.
    expect(body.total).toBe(SUBMISSION_COUNT);

    expect(hydrationCalls.length).toBeGreaterThan(0);
    for (const call of hydrationCalls) {
      expect(call.idCount).toBeLessThanOrEqual(2);
    }
  });

  it("CSV export hydrates every ranked row, in sort order, never a truncated page", async () => {
    hydrationCalls = [];
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${PLAN_ID}/results?format=csv`);
    expect(res.status).toBe(200);
    const csv = await res.text();
    const lines = csv.trim().split("\n");
    // header + one row per submission.
    expect(lines).toHaveLength(SUBMISSION_COUNT + 1);

    expect(hydrationCalls.length).toBeGreaterThan(0);
    for (const call of hydrationCalls) {
      expect(call.idCount).toBe(SUBMISSION_COUNT);
    }
  });
});
