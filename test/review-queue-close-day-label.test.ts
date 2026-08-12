// DEC-522 route-level regression: GET /api/v1/review/plans/:id/queue must
// treat the plan's closeDate as a DAY LABEL, expanded through the owning
// event's timezone (plan.timezone), not a bare UTC-midnight instant. A plan
// set to close 2027-03-01 for a Pacific-timezone event stays open through
// end-of-day Pacific on 2027-03-01 -- the queue endpoint must not silently
// return { items: [], total: 0, open: false } while the close day is still
// in progress locally. Mocking pattern mirrors test/review-queue-shape.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

// Day label 2027-03-01 (UTC midnight), America/Los_Angeles event.
const CLOSE_DATE = Date.UTC(2027, 2, 1);

const planRecord = {
  id: "plan-1",
  eventId: "event-1",
  name: "Plan One",
  instructions: null,
  openDate: null,
  closeDate: CLOSE_DATE,
  filters: null,
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
  rounds: 1,
  currentRound: 1,
  maxEvaluations: null,
  timezone: "America/Los_Angeles",
};

const SUBMISSIONS = [{ id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] }];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    listEvaluationsForPlan: vi.fn(async () => []),
    listCompletedPairsForPlan: vi.fn(async () => []),
    countEvaluationsBySubmission: vi.fn(async () => new Map()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
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

describe("DEC-522: reviewer queue open/close day-label gating", () => {
  it("is non-empty on the close day itself (2027-03-01T23:00Z, still 15:00 local Pacific)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2027, 2, 1, 23, 0, 0));

    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; open: boolean };
    expect(body.open).not.toBe(false);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it("is empty/closed the instant after end-of-day Pacific on the close day (2027-03-02T08:00:01Z)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2027, 2, 2, 8, 0, 1));

    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; open: boolean };
    expect(body.open).toBe(false);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });
});
