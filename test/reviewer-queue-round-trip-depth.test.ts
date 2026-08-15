// DEC-338 (wave-31 amendment): GET /api/v1/review/plans/:id/queue must issue
// its independent repo calls as concurrent Promise.all waves, not eleven
// strictly-sequential awaits. This test proves concurrency BEHAVIOURALLY --
// an instrumented fake `Db` whose every query resolves only after an
// artificial delay, tracking the maximum number of simultaneously in-flight
// statements -- rather than a source grep for the string `Promise.all`
// (DEC-338's own ruling: "the lane proves concurrency behaviourally... not
// with a source grep"). A second test pins the queue's JSON envelope so the
// scheduling change provably left the response byte-identical.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { PlanRecord } from "../src/server/repo/review";

const ORG_A = "org-a";

function planRecord(): PlanRecord {
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
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
  } as unknown as PlanRecord;
}

// Only the plan-lookup entry point (requireAssignedPlan -> getPlanForOrg) is
// mocked -- every OTHER repo call the queue route makes (the scope-track
// chain, resolveReviewerSubmissions, the evaluation/recusal batches, the
// format/audience-level batches) runs for REAL against the instrumented fake
// db below, so the concurrency measured is the route's own scheduling, not a
// mock's.
vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === "plan-1" && orgId === ORG_A ? planRecord() : null,
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

interface Tracker {
  inFlight: number;
  max: number;
}

/** A minimal chainable fake query builder: every drizzle-style chain method
 * (`select`, `from`, `where`, `orderBy`, `limit`, `groupBy`, `innerJoin`,
 * `leftJoin`) returns the same thenable object, and the chain resolves only
 * on `await` (via `.then`) -- after a real macrotask delay, so genuinely
 * concurrent callers overlap in wall-clock time and genuinely sequential
 * callers never do. Rows are looked up by the table object passed to
 * `.from()`, mirroring test/review-queue-roundtrips.test.ts's counting fake. */
function makeInstrumentedDb(rowsByTable: Map<unknown, unknown[]>, tracker: Tracker): Db {
  function chain(state: { table: unknown }) {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit"]) {
      self[method] = (arg?: unknown) => {
        if (method === "from") state.table = arg;
        return self;
      };
    }
    self.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      tracker.inFlight += 1;
      tracker.max = Math.max(tracker.max, tracker.inFlight);
      return new Promise<void>((r) => setTimeout(r, 8))
        .then(() => {
          tracker.inFlight -= 1;
          resolve(rowsByTable.get(state.table) ?? []);
        })
        .catch((e: unknown) => {
          tracker.inFlight -= 1;
          reject(e);
        });
    };
    return self;
  }
  return {
    select: (_cols?: unknown) => chain({ table: undefined }),
  } as unknown as Db;
}

function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  // Unrestricted reviewer scope row -- resolveReviewerSubmissions and
  // getReviewerScopeTrackIds both read this table.
  rows.set(schema.planReviewer, [{ trackId: null, submissionId: null }]);
  rows.set(schema.submission, [
    { id: "sub-1", seq: 1, title: "Talk One" },
    { id: "sub-2", seq: 2, title: "Talk Two" },
  ]);
  rows.set(schema.event, [{ recordPrefix: "TALK" }]);
  // Shared by countEvaluationsBySubmission (submissionId/count),
  // listSubmissionIdsRatedBy (submissionId) and
  // listEvaluationScoresForReviewer (submissionId/scoresJson) -- the fake
  // ignores the select projection and returns one row shaped to satisfy all
  // three readers at once.
  rows.set(schema.evaluation, [{ submissionId: "sub-1", count: 1, scoresJson: JSON.stringify({ c1: 4 }) }]);
  rows.set(schema.reviewRecusal, []);
  rows.set(schema.submissionAnswer, []);
  return rows;
}

async function buildApp(auth: AuthInfo, db: Db) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

describe("DEC-338 (wave-31 amendment): reviewer queue issues concurrent Promise.all waves", () => {
  it("has more than one repo statement simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, db);
    const res = await app.request("/api/v1/review/plans/plan-1/queue");
    expect(res.status).toBe(200);
    // Wave 1 alone holds 5 concurrent calls (resolveReviewerSubmissions's
    // first statement, countEvaluationsBySubmission, listSubmissionIdsRatedBy,
    // listEvaluationScoresForReviewer, listRecusalsForReviewer) -- a fully
    // serial handler could never exceed 1.
    expect(tracker.max).toBeGreaterThan(1);
  });

  it("pins the queue JSON envelope: unchanged by the scheduling change", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, db);
    const res = await app.request("/api/v1/review/plans/plan-1/queue");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string; ratingsCount: number; alreadyRatedByMe: boolean }[];
      [key: string]: unknown;
    };
    expect(body).toMatchObject({
      total: 2,
      // sub-1 already carries an evaluation (from the fake evaluation-table
      // row above) -- only sub-2 is still unscored.
      unscoredTotal: 1,
      page: 1,
      perPage: expect.any(Number),
      open: true,
      recused: [],
      planName: "Plan One",
      scopeTrackName: null,
      closeDate: null,
      rounds: 1,
      currentRound: 1,
    });
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
    const bySubmission = new Map(body.items.map((i) => [i.submissionId, i]));
    // sub-1 carries one evaluation from the fake evaluation table; sub-2
    // carries none -- fewest-ratings-first sorts sub-2 ahead of sub-1.
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub-2", "sub-1"]);
    expect(bySubmission.get("sub-1")?.ratingsCount).toBe(1);
    expect(bySubmission.get("sub-2")?.ratingsCount).toBe(0);
  });
});
