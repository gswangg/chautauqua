// DEC-239 contract coverage: GET /api/v1/review/plans/:id/queue must emit
// {submissionId, ref, title, ratingsCount, alreadyRatedByMe} -- not the raw
// SubmissionSummary row (which keys the id as `id`, not `submissionId`).
// A prior mismatch here rendered "Submissions/undefined" links in the SPA
// (docs/eval-findings.md Section B). Repo calls are mocked so this is a
// pure route-level contract test (no D1/wrangler dependency in stage 1),
// mirroring test/review-idor.test.ts's pattern.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

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
  currentRound: 1,
  maxEvaluations: null,
  timezone: "UTC",
};

const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] },
  { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] },
];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    // DEC-271 (task w5-c): no recusals in these fixtures.
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === planRecord.id ? planRecord : null)),
    listPlanIdsForReviewer: vi.fn(async () => [planRecord.id]),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    listEvaluationsForPlan: vi.fn(async () => [
      { submissionId: "sub-1", reviewerId: "someone-else", round: 1 },
    ]),
    listCompletedPairsForPlan: vi.fn(async () => [
      { submissionId: "sub-1", reviewerId: "someone-else" },
    ]),
    // DEC-346: the queue route now sources counts/ratedByMe from these SQL
    // aggregates instead of listEvaluationsForPlan + a JS reduce.
    countEvaluationsBySubmission: vi.fn(async () => new Map([["sub-1", 1]])),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
    // DEC-845: the queue envelope's scopeTrackName resolution -- no track
    // scoping in these fixtures.
    getReviewerScopeTrackId: vi.fn(async () => null),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    // DEC-857: sub-1 carries a format answer, sub-2 has none.
    listFormatLabelsBySubmission: vi.fn(async () => new Map([["sub-1", "Talk (30 min)"]])),
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

describe("DEC-239: reviewer queue item wire shape", () => {
  it("emits {submissionId, ref, title, ratingsCount, alreadyRatedByMe} keyed by exact SPA field names", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string; ref: string; title: string; ratingsCount: number; alreadyRatedByMe: boolean }[];
      open: boolean;
      recused: unknown[];
    };
    // Open-plan shape is unchanged by the shared-envelope refactor: `open`
    // and `recused` are still present alongside `items`/`total`.
    expect(body.open).toBe(true);
    expect(Array.isArray(body.recused)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(typeof item.submissionId).toBe("string");
      expect(item.submissionId.length).toBeGreaterThan(0);
      expect(typeof item.ref).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.ratingsCount).toBe("number");
      expect(Number.isNaN(item.ratingsCount)).toBe(false);
      expect(typeof item.alreadyRatedByMe).toBe("boolean");
      // must not leak the raw repo row's `id`/`description`/`trackIds` keys
      expect((item as Record<string, unknown>).id).toBeUndefined();
    }
    // sub-1 has one rating (by someone else); sub-2 has none -- fewest-first
    // ordering (buildReviewerQueue) puts sub-2 ahead of sub-1.
    const bySubmission = new Map(body.items.map((i) => [i.submissionId, i]));
    expect(bySubmission.get("sub-2")?.ratingsCount).toBe(0);
    expect(bySubmission.get("sub-1")?.ratingsCount).toBe(1);
  });

  // DEC-561: a reviewer who has already rated one of two in-scope
  // submissions still sees BOTH -- the rated one sinks to the bottom instead
  // of vanishing, and `total` counts both.
  it("keeps an already-rated submission in the queue, sunk to the bottom", async () => {
    const { listSubmissionIdsRatedBy } = await import("../src/server/repo/review");
    vi.mocked(listSubmissionIdsRatedBy).mockResolvedValueOnce(new Set(["sub-1"]));
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string; ratingsCount: number; alreadyRatedByMe: boolean }[];
      total: number;
    };
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub-2", "sub-1"]);
    expect(body.items.find((i) => i.submissionId === "sub-1")?.alreadyRatedByMe).toBe(true);
    expect(body.items.find((i) => i.submissionId === "sub-2")?.alreadyRatedByMe).toBe(false);
    expect(body.total).toBe(2);
  });

  // Reviewer-lockout P0 (docs/eval-findings.md): the Review landing reads
  // `recused.length` on every plan's queue, but the closed-plan early return
  // omitted the key entirely -- crashing the reviewer's only landing page.
  // The closed envelope must carry the same keys as the open one.
  it("includes recused: [] on the closed-plan envelope", async () => {
    const { getPlanById } = await import("../src/server/repo/review");
    vi.mocked(getPlanById).mockResolvedValueOnce({
      ...planRecord,
      openDate: Date.UTC(2020, 0, 1),
      closeDate: Date.UTC(2020, 0, 2),
    } as never);
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; open: boolean; recused: unknown[] };
    expect(body.open).toBe(false);
    expect(body.items).toEqual([]);
    expect(Array.isArray(body.recused)).toBe(true);
    expect(body.recused).toEqual([]);
  });

  // DEC-857: the queue envelope carries `format` -- the stored answer LABEL
  // verbatim, null when the submission has no format answer.
  it("carries format on each queue item, null when unanswered", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string; format: string | null }[];
    };
    const bySubmission = new Map(body.items.map((i) => [i.submissionId, i]));
    expect(bySubmission.get("sub-1")?.format).toBe("Talk (30 min)");
    expect(bySubmission.get("sub-2")?.format).toBeNull();
  });
});
