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
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    listEvaluationsForPlan: vi.fn(async () => [
      { submissionId: "sub-1", reviewerId: "someone-else", round: 1 },
    ]),
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
    };
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
});
