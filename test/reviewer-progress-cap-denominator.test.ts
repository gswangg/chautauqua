// DEC-707 (wave-74 amendment): a plan's per-submission evaluation cap
// (maxEvaluations) must be honored in the reviewer PROGRESS denominator,
// exactly like it already is in the actionable queue
// (src/routes/review/reviewer.ts's needsMoreRatings filter). Without this,
// a reviewer assigned a submission that OTHER reviewers have already
// saturated reads completed < assigned forever -- reviewerProgressState
// never returns 'done', and POST /plans/:id/remind nags them on every send.
//
// This scenario cannot be built from the seed (scripts/seed.ts:1359-1369
// deliberately sets the cap above every seeded count), so this harness
// constructs it directly. Mocked repo/mailer, mirrors
// test/review-remind-recusal.test.ts's harness pattern (no D1/wrangler
// dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { assignedExcludingSaturated, needsMoreRatings } from "../src/domain/evaluation";

const ORG_A = "org-a";

function planWithCap(maxEvaluations: number | null) {
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
    maxEvaluations,
  };
}

// S is saturated: 2 submitted evaluations (from rev-b, rev-c) against a
// cap of 2. T is untouched. Reviewer rev-a is assigned both.
const SUBMISSIONS = [
  { id: "sub-s", ref: "S-001", title: "Saturated Talk", description: null, trackIds: [] },
  { id: "sub-t", ref: "S-002", title: "Open Talk", description: null, trackIds: [] },
];

const REVIEWER_ROWS = [
  { id: "pr-a", planId: "plan-1", userId: "rev-a", trackId: null, submissionId: null },
  { id: "pr-b", planId: "plan-1", userId: "rev-b", trackId: null, submissionId: null },
  { id: "pr-c", planId: "plan-1", userId: "rev-c", trackId: null, submissionId: null },
];

const USERS = [
  { userId: "rev-a", email: "a@example.test" },
  { userId: "rev-b", email: "b@example.test" },
  { userId: "rev-c", email: "c@example.test" },
];

let evaluatedPairs: { reviewerId: string; submissionId: string }[] = [
  { reviewerId: "rev-b", submissionId: "sub-s" },
  { reviewerId: "rev-c", submissionId: "sub-s" },
];

let currentPlan = planWithCap(2);

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
      planId === currentPlan.id && orgId === ORG_A ? currentPlan : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
    getUsersByIds: vi.fn(async () => USERS),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => evaluatedPairs),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
  };
});

const sentTo: string[] = [];
const sendMock = vi.fn(async (input: { to: { email: string } }) => {
  sentTo.push(input.to.email);
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string) => ({ id: eventId, name: "Event One" })),
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: sendMock })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentTo.length = 0;
  evaluatedPairs = [
    { reviewerId: "rev-b", submissionId: "sub-s" },
    { reviewerId: "rev-c", submissionId: "sub-s" },
  ];
  currentPlan = planWithCap(2);
});

async function buildApp(auth: AuthInfo) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { DEV_MODE: "1" } as never;
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

async function getProgressFor(userId: string) {
  const app = await buildApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
  const res = await app.request(`/api/v1/plans/${currentPlan.id}/progress`, {
    headers: { "content-type": "application/json" },
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    items: { userId: string; assigned: number; completed: number }[];
  };
  const row = body.items.find((r) => r.userId === userId);
  expect(row).toBeDefined();
  return row!;
}

async function postRemind() {
  const app = await buildApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
  const res = await app.request(`/api/v1/plans/${currentPlan.id}/remind`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: "{}",
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { reminded: string[]; sent: number };
}

describe("DEC-707 (wave-74): assignedExcludingSaturated (pure core)", () => {
  it("removes a saturated submission the reviewer has not rated, keeps one they have", () => {
    const assigned = [{ id: "sub-s" }, { id: "sub-t" }];
    const ratingsBySubmissionId = new Map([["sub-s", 2]]);
    const kept = assignedExcludingSaturated(assigned, ratingsBySubmissionId, new Set(), 2);
    expect(kept.map((i) => i.id)).toEqual(["sub-t"]);
  });

  it("keeps a saturated submission this reviewer already rated (completed <= assigned invariant)", () => {
    const assigned = [{ id: "sub-s" }, { id: "sub-t" }];
    const ratingsBySubmissionId = new Map([["sub-s", 2]]);
    const kept = assignedExcludingSaturated(assigned, ratingsBySubmissionId, new Set(["sub-s"]), 2);
    expect(kept.map((i) => i.id)).toEqual(["sub-s", "sub-t"]);
  });

  it("with no cap, returns assigned unchanged (byte-identical, regression pin)", () => {
    const assigned = [{ id: "sub-s" }, { id: "sub-t" }];
    const kept = assignedExcludingSaturated(assigned, new Map([["sub-s", 2]]), new Set(), undefined);
    expect(kept).toEqual(assigned);
  });

  it("delegates to needsMoreRatings rather than re-typing the cap comparison", () => {
    expect(needsMoreRatings({ ratingsCount: 2 }, 2)).toBe(false);
    expect(needsMoreRatings({ ratingsCount: 1 }, 2)).toBe(true);
  });
});

describe("DEC-707 (wave-74): GET /plans/:id/progress honors the cap", () => {
  it("excludes a submission saturated by other reviewers from assigned, before this reviewer rates anything", async () => {
    const row = await getProgressFor("rev-a");
    expect(row.assigned).toBe(1);
    expect(row.completed).toBe(0);
  });

  it("after rev-a rates the open submission, assigned/completed both reflect the un-saturated one", async () => {
    evaluatedPairs = [
      { reviewerId: "rev-b", submissionId: "sub-s" },
      { reviewerId: "rev-c", submissionId: "sub-s" },
      { reviewerId: "rev-a", submissionId: "sub-t" },
    ];
    const row = await getProgressFor("rev-a");
    expect(row.assigned).toBe(1);
    expect(row.completed).toBe(1);
  });

  it("a reviewer who rated a now-saturated submission keeps it counted (completed <= assigned)", async () => {
    // rev-b is assigned both submissions (unrestricted scope): sub-s stays
    // because rev-b already rated it, sub-t stays because it is not
    // saturated -- so assigned is both, completed is the one rev-b rated.
    const row = await getProgressFor("rev-b");
    expect(row.assigned).toBeGreaterThanOrEqual(row.completed);
    expect(row.assigned).toBe(2);
    expect(row.completed).toBe(1);
  });

  it("maxEvaluations: null leaves every number byte-identical to the uncapped fold", async () => {
    currentPlan = planWithCap(null);
    const row = await getProgressFor("rev-a");
    // rev-a is assigned both sub-s and sub-t regardless of saturation when
    // there is no cap.
    expect(row.assigned).toBe(2);
    expect(row.completed).toBe(0);
  });
});

describe("DEC-707 (wave-74): POST /plans/:id/remind honors the cap", () => {
  it("does not remind a reviewer whose only remaining assignment is saturated by others", async () => {
    evaluatedPairs = [
      { reviewerId: "rev-b", submissionId: "sub-s" },
      { reviewerId: "rev-c", submissionId: "sub-s" },
      { reviewerId: "rev-a", submissionId: "sub-t" },
    ];
    const body = await postRemind();
    expect(body.reminded).not.toContain("rev-a");
    expect(sentTo).not.toContain("a@example.test");
  });

  it("reminds a reviewer with a genuinely open (un-saturated) assignment", async () => {
    const body = await postRemind();
    expect(body.reminded).toContain("rev-a");
    expect(sentTo).toContain("a@example.test");
  });
});
