// DEC-212 (wave-34 amendment): completeness is a NUMERIC test, not a
// presence test -- numericScoresOrNull is the ONE function that decides both
// whether a scorecard is "complete enough to have a score" and produces the
// arithmetic-safe record itself, so the two can never disagree. Unlike
// numericScoresFor (the write-adjacent sibling, which throws), this one
// degrades to null: it backs the organiser's unbounded historical read
// (src/routes/review/evaluations.ts), where one corrupt row years old must
// never 500 the whole list.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { numericScoresOrNull } from "../src/domain/evaluation/scores-json";
import type { EvaluationCriterion } from "../src/domain/evaluation/scoring";
import * as evaluationsRepo from "../src/server/repo/review/evaluations";

describe("numericScoresOrNull", () => {
  const criteria: EvaluationCriterion[] = [
    { id: "clarity", label: "Clarity", weight: 1 },
    { id: "impact", label: "Impact", weight: 2 },
  ];

  it("returns the fully-numeric record when every criterion has a finite number", () => {
    const scores = { clarity: 4, impact: 3 };
    expect(numericScoresOrNull(scores, criteria)).toEqual({ clarity: 4, impact: 3 });
  });

  it("returns null when a criterion is missing from scores", () => {
    const scores = { clarity: 4 };
    expect(numericScoresOrNull(scores, criteria)).toBeNull();
  });

  it("returns null when a criterion's value is a string (a dropdown option leaked under a rating id)", () => {
    const scores = { clarity: 4, impact: "Strong" };
    expect(numericScoresOrNull(scores, criteria)).toBeNull();
  });

  it("returns null when a criterion's value is NaN or Infinity-shaped (non-finite)", () => {
    expect(numericScoresOrNull({ clarity: NaN, impact: 3 }, criteria)).toBeNull();
    expect(numericScoresOrNull({ clarity: Number.POSITIVE_INFINITY, impact: 3 }, criteria)).toBeNull();
    expect(numericScoresOrNull({ clarity: Number.NEGATIVE_INFINITY, impact: 3 }, criteria)).toBeNull();
  });

  it("returns null when the criteria list is empty", () => {
    expect(numericScoresOrNull({ clarity: 4 }, [])).toBeNull();
  });

  it("never throws", () => {
    expect(() => numericScoresOrNull({}, criteria)).not.toThrow();
    expect(() => numericScoresOrNull({ clarity: "not a number" }, criteria)).not.toThrow();
  });

  it("ignores a key present in scores but absent from criteria", () => {
    const scores = { clarity: 4, impact: 3, track_fit: "Strong" };
    expect(numericScoresOrNull(scores, criteria)).toEqual({ clarity: 4, impact: 3 });
  });
});

const ORG_A = "org-a";
const SUBMISSION_ID = "sub-1";

const corruptRow = {
  planId: "plan-1",
  planName: "Round 1 review",
  round: 1,
  reviewerName: "Jamie Reviewer",
  // A dropdown-shaped string stored under a rating criterion id -- the
  // exact corruption the module header warns about. Presence-only
  // completeness (the old `complete` boolean) would have let this reach
  // computeWeightedScore's `score * weight` and thrown, 500ing the read.
  scores: { c1: "Strong" },
  comment: "Looks solid.",
  submittedAt: 1_700_000_000_000,
};

const PLAN_CRITERIA = new Map([
  [
    "plan-1",
    {
      criteria: [{ id: "c1", label: "Clarity", kind: "rating" as const, weight: 1 }],
      roundCriteriaJson: null,
      scale: { min: 1, max: 5 },
    },
  ],
]);

// Hoisted to module scope (not inside describe): vi.mock factories are
// hoisted above all other module code, so a factory may only close over
// bindings that are themselves at module scope by the time it runs.
vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
    "../src/server/repo/submissions",
  );
  return {
    ...actual,
    getSubmissionOwnership: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID ? { eventId: "event-1", orgId: ORG_A } : null,
    ),
  };
});

vi.mock("../src/server/repo/review/evaluations", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/evaluations")>(
    "../src/server/repo/review/evaluations",
  );
  return {
    ...actual,
    listEvaluationsForSubmission: vi.fn(async () => [corruptRow]),
    listPlanCriteriaByIds: vi.fn(async () => PLAN_CRITERIA),
  };
});

vi.mock("../src/server/repo/review/reviewers", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/reviewers")>(
    "../src/server/repo/review/reviewers",
  );
  return {
    ...actual,
    countAssignedReviewersForSubmission: vi.fn(async () => 1),
  };
});

vi.mock("../src/server/repo/review/plans", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review/plans")>(
    "../src/server/repo/review/plans",
  );
  return {
    ...actual,
    getPlanForOrg: vi.fn(async () => null),
  };
});

describe("DEC-212 (wave-34): GET /api/v1/submissions/:id/evaluations degrades to score: null on a corrupt row instead of 500ing", () => {
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

  it("returns 200 with score: null on the corrupt row, not a 500", async () => {
    vi.mocked(evaluationsRepo.listEvaluationsForSubmission).mockResolvedValue([corruptRow]);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ score: number | null; scores: Record<string, unknown> }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.score).toBeNull();
    // DEC-212: the display projection (`scores` on the response) still
    // carries the raw value untouched -- tolerance belongs to the display
    // reader, never to the arithmetic.
    expect(body.items[0]!.scores).toEqual({ c1: "Strong" });
  });
});
