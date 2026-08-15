// DEC-338 (wave-32 ruling, landed wave-33): GET /api/v1/plans/:id/progress
// must issue its independent repo calls as concurrent Promise.all waves, not
// eight strictly-sequential awaits. This test proves concurrency
// BEHAVIOURALLY -- an instrumented fake `Db` whose every query resolves only
// after an artificial delay, tracking the maximum number of simultaneously
// in-flight statements -- rather than a source grep for the string
// `Promise.all` (mirrors test/reviewer-queue-round-trip-depth.test.ts). A
// second test pins the progress endpoint's JSON envelope so the scheduling
// change provably left the response byte-identical.

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

// Only the plan-lookup entry point (requireOwnedPlan -> getPlanForOrg) is
// mocked -- every OTHER repo call the progress route makes (reviewer rows,
// evaluated pairs, plan-filtered submissions, recusals, users, track names,
// display names) runs for REAL against the instrumented fake db below, so
// the concurrency measured is the route's own scheduling, not a mock's.
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
 * (`select`, `from`, `where`, `orderBy`, `limit`, `innerJoin`, `leftJoin`)
 * returns the same thenable object, and the chain resolves only on `await`
 * (via `.then`) -- after a real macrotask delay, so genuinely concurrent
 * callers overlap in wall-clock time and genuinely sequential callers never
 * do. Rows are looked up by the table object passed to `.from()`, mirroring
 * test/reviewer-queue-round-trip-depth.test.ts's instrumented fake. */
function makeInstrumentedDb(rowsByTable: Map<unknown, unknown[]>, tracker: Tracker): Db {
  function chain(state: { table: unknown }) {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "selectDistinct", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit"]) {
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
    selectDistinct: (_cols?: unknown) => chain({ table: undefined }),
  } as unknown as Db;
}

function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  // Unrestricted reviewer scope row for the plan's single reviewer.
  rows.set(schema.planReviewer, [
    { id: "pr-1", planId: "plan-1", userId: "u1", trackId: null, submissionId: null },
  ]);
  // listPlanFilteredSubmissions' event lookup (record prefix) and its
  // unfiltered submission read -- kept empty so the internal trackId
  // sub-read is skipped, isolating the wave-1/wave-2 concurrency being
  // measured here rather than that helper's own internal fan-out.
  rows.set(schema.event, [{ orgId: ORG_A, recordPrefix: "TALK" }]);
  rows.set(schema.submission, []);
  rows.set(schema.evaluation, []);
  rows.set(schema.reviewRecusal, []);
  // Wave-2 reads: getUsersByIds + batchUserDisplayNames both read schema.user
  // (different projections of the same row); track ids stay empty (the
  // reviewer row above is unrestricted), so getTrackNamesByIds never queries
  // schema.track at all.
  rows.set(schema.user, [{ id: "u1", userId: "u1", orgId: ORG_A, email: "u1@example.com", contactId: null }]);
  rows.set(schema.contact, []);
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

describe("DEC-338 (wave-33 landing): plan progress issues concurrent Promise.all waves", () => {
  it("has at least 4 repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, db);
    const res = await app.request("/api/v1/plans/plan-1/progress");
    expect(res.status).toBe(200);
    // Wave 1 alone holds 4 concurrent statements (listReviewerRowsForPlan,
    // listEvaluatedPairsForPlan, listPlanFilteredSubmissions' first
    // statement, listRecusalsForPlan) -- a fully serial handler could never
    // exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(4);
  });

  it("pins the progress JSON envelope: unchanged by the scheduling change", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, db);
    const res = await app.request("/api/v1/plans/plan-1/progress");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      items: [
        {
          userId: "u1",
          email: "u1@example.com",
          name: null,
          assigned: 0,
          completed: 0,
          recused: 0,
          trackName: null,
        },
      ],
      total: 1,
      page: 1,
      perPage: expect.any(Number),
      round: 1,
      submissionsInScope: 0,
    });
  });
});
