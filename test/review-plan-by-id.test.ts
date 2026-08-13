// DEC-819 regression: GET /api/v1/review/plans/:id -- the plan-scoped
// reviewer queue route (ReviewerQueue.tsx) fetches this to head the page
// with the plan's own name. Scoping mirrors /review/plans/:id/queue
// (requireAssignedPlan): the assigned reviewer sees it, an unassigned
// reviewer or a foreign organizer gets a 404 (existence-hiding), never a
// 403 that would leak the plan's existence.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";

const plan = {
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
  maxEvaluations: null,
  timezone: "UTC",
};

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "rev-1" ? [plan.id] : [])),
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

const organizerA: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };
const organizerB: AuthInfo = { userId: "org-user-b", role: "organizer", orgId: ORG_B };
const assignedReviewer: AuthInfo = { userId: "rev-1", role: "reviewer", orgId: ORG_A };
const unassignedReviewer: AuthInfo = { userId: "rev-2", role: "reviewer", orgId: ORG_A };

describe("DEC-819: GET /api/v1/review/plans/:id", () => {
  it("an assigned reviewer gets the plan (including its name)", async () => {
    const app = await buildApp(assignedReviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; name: string };
    expect(body.id).toBe(plan.id);
    expect(body.name).toBe("Plan One");
  });

  it("the owning organizer gets the plan too", async () => {
    const app = await buildApp(organizerA);
    const res = await app.request(`/api/v1/review/plans/${plan.id}`);
    expect(res.status).toBe(200);
  });

  it("an unassigned reviewer gets 404, not the plan", async () => {
    const app = await buildApp(unassignedReviewer);
    const res = await app.request(`/api/v1/review/plans/${plan.id}`);
    expect(res.status).toBe(404);
  });

  it("a foreign-org organizer gets 404, not the plan", async () => {
    const app = await buildApp(organizerB);
    const res = await app.request(`/api/v1/review/plans/${plan.id}`);
    expect(res.status).toBe(404);
  });
});
