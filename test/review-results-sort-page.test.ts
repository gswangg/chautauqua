// DEC-345: GET /api/v1/plans/:id/results gains server-side sort + paging.
// Order of operations is normative: buildResults -> buildResultsRows ranking
// (average desc, count desc) -> sortResultsRows over the WHOLE set when
// ?sort= is present -> slice the page. Pagination without moving the sort
// server-side would sort one page and mis-rank the rest (DEC-341's bug
// class on the content worklist) -- this suite exercises exactly that.
// Harness pattern copied from test/review-results-ratingless.test.ts (mocked
// repo, no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

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
  criteria: [{ id: "quality", label: "Quality", kind: "rating", weight: 1 }],
  rounds: 1,
  currentRound: 1,
  maxEvaluations: null,
};

// Three submissions, deliberately seeded so a naive "sort the page after
// paging" implementation would misrank: ranked (unsorted) order by
// average desc is C(5), A(4), B(3); alphabetically by ref it's A, B, C.
const submissions = [
  { id: "sub-a", ref: "A-1", title: "Alpha", description: null, trackIds: [], status: "pending" },
  { id: "sub-b", ref: "B-2", title: "Bravo", description: null, trackIds: [], status: "accepted" },
  { id: "sub-c", ref: "C-3", title: "Charlie", description: null, trackIds: [], status: "pending" },
];

const evaluations = [
  { id: "ev-a", planId: plan.id, submissionId: "sub-a", reviewerId: "rev-1", round: 1, scores: { quality: 4 }, comment: null },
  { id: "ev-b", planId: plan.id, submissionId: "sub-b", reviewerId: "rev-1", round: 1, scores: { quality: 3 }, comment: null },
  { id: "ev-c", planId: plan.id, submissionId: "sub-c", reviewerId: "rev-1", round: 1, scores: { quality: 5 }, comment: null },
];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    listPlanFilteredSubmissions: vi.fn(async () => submissions),
    listEvaluationsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      evaluations.filter((e) => e.planId === planId && e.round === round),
    ),
    listEvaluationScoresForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      evaluations
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ submissionId: e.submissionId, scores: e.scores })),
    ),
    listCompletedPairsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
      evaluations
        .filter((e) => e.planId === planId && e.round === round)
        .map((e) => ({ reviewerId: e.reviewerId, submissionId: e.submissionId })),
    ),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === plan.eventId && orgId === ORG_A ? { id: eventId, orgId } : null,
    ),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
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

describe("DEC-345: results sort + paging", () => {
  it("defaults to the average-desc/count-desc ranking, page 1, real envelope values", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/results`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { ref: string }[]; total: number; page: number; perPage: number };
    expect(body.items.map((r) => r.ref)).toEqual(["C-3", "A-1", "B-2"]);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
  });

  it("sorts by ref ascending when ?sort=ref&dir=asc, overriding the ranked order", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/results?sort=ref&dir=asc`);
    const body = (await res.json()) as { items: { ref: string }[] };
    expect(body.items.map((r) => r.ref)).toEqual(["A-1", "B-2", "C-3"]);
  });

  it("sorts by rating criterion, requiring criterionId", async () => {
    const app = await buildApp(organizer);
    const badRes = await app.request(`/api/v1/plans/${plan.id}/results?sort=rating`);
    expect(badRes.status).toBe(400);

    const res = await app.request(`/api/v1/plans/${plan.id}/results?sort=rating&criterionId=quality&dir=asc`);
    const body = (await res.json()) as { items: { ref: string }[] };
    expect(body.items.map((r) => r.ref)).toEqual(["B-2", "A-1", "C-3"]);
  });

  it("pages the SORTED whole set, not a per-page re-sort (DEC-341 bug class)", async () => {
    const app = await buildApp(organizer);
    const page1 = await app.request(`/api/v1/plans/${plan.id}/results?sort=ref&dir=asc&page=1&perPage=2`);
    const page1Body = (await page1.json()) as { items: { ref: string }[]; total: number; page: number; perPage: number };
    expect(page1Body.items.map((r) => r.ref)).toEqual(["A-1", "B-2"]);
    expect(page1Body.total).toBe(3);
    expect(page1Body.page).toBe(1);
    expect(page1Body.perPage).toBe(2);

    const page2 = await app.request(`/api/v1/plans/${plan.id}/results?sort=ref&dir=asc&page=2&perPage=2`);
    const page2Body = (await page2.json()) as { items: { ref: string }[] };
    expect(page2Body.items.map((r) => r.ref)).toEqual(["C-3"]);
  });

  it("?format=csv ignores page/perPage but honours sort/dir, emitting every row", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/results?format=csv&sort=ref&dir=desc&page=1&perPage=1`);
    expect(res.status).toBe(200);
    const csv = await res.text();
    const [, ...dataLines] = csv.trim().split(/\r?\n/);
    expect(dataLines).toHaveLength(3);
    expect(dataLines.map((line) => line.split(",")[0])).toEqual(["C-3", "B-2", "A-1"]);
  });

  // DEC-632/DEC-633: the CSV export and the screen must agree -- a Status
  // column, right after Title, carrying each submission's decision state.
  it("?format=csv gains a Status column right after Title", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/results?format=csv&sort=ref&dir=asc`);
    expect(res.status).toBe(200);
    const csv = await res.text();
    const [header, ...dataLines] = csv.trim().split(/\r?\n/);
    const headerCols = header!.split(",");
    expect(headerCols[0]).toBe("ref");
    expect(headerCols[1]).toBe("title");
    expect(headerCols[2]).toBe("Status");
    const rows = dataLines.map((line) => line.split(","));
    expect(rows.map((r) => r[2])).toEqual(["pending", "accepted", "pending"]);
  });

  it("rejects an unknown sort column", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/results?sort=bogus`);
    expect(res.status).toBe(400);
  });
});
