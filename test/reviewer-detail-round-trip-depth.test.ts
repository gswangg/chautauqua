// DEC-370 (wave-61 amendment): GET /api/v1/review/submissions/:id (eight
// sequential awaits, six mutually independent) and PUT
// /api/v1/review/plans/:planId/evaluations/:submissionId (four independent
// validation reads run as a ladder) must each collapse into ONE
// settleInDeclarationOrder wave, with refusals still evaluated in exactly
// today's source order. This test proves concurrency BEHAVIOURALLY -- an
// instrumented fake `Db` whose every SELECT resolves only after an
// artificial delay, tracking the maximum number of simultaneously in-flight
// statements -- mirroring test/agenda-round-trip-depth.test.ts and
// test/reviewer-queue-round-trip-depth.test.ts (DEC-338's own ruling: prove
// it behaviourally, never with a source grep).
//
// DEC-211 (wave-61 amendment): an assigned reviewer who is inside the plan's
// event but out of the reviewer's own scope gets a named refusal ('That
// submission is not in your review queue.'); a submission genuinely outside
// the plan's event keeps the existence-hiding 'Submission not found' --
// tested here through the organizer branch, which never runs the reviewer
// scope check at all, so the summary-null refusal is the only one that can
// fire.

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

// Only the plan-lookup entry point (requireAssignedPlan -> getPlanForOrg /
// getPlanById+listPlanIdsForReviewer) is mocked -- every OTHER repo call
// these routes make runs for REAL against the instrumented fake db below, so
// the concurrency measured is the route's own scheduling, not a mock's.
vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === "plan-1" && orgId === ORG_A ? planRecord() : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === "plan-1" ? planRecord() : null)),
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === "u-reviewer" ? ["plan-1"] : [])),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

interface Tracker {
  inFlight: number;
  max: number;
}

/** A minimal chainable fake query builder, identical in shape to
 * test/reviewer-queue-round-trip-depth.test.ts's -- every drizzle-style
 * chain method returns the same thenable object, resolving only on `await`
 * (via `.then`) after a real macrotask delay, so genuinely concurrent
 * callers overlap in wall-clock time and genuinely sequential callers never
 * do. Rows are looked up by the table object passed to `.from()`. */
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
  // PUT .../evaluations upserts via db.insert(...).onConflictDoUpdate(...) --
  // writes are not the thing under test here, so resolve immediately
  // (mirrors test/agenda-round-trip-depth.test.ts's writeChain).
  function writeChain() {
    const self: Record<string, unknown> = {};
    for (const method of ["values", "set", "where", "onConflictDoUpdate", "returning"]) {
      self[method] = () => self;
    }
    self.then = (resolve: (v: unknown) => void) => resolve([]);
    return self;
  }
  return {
    select: (_cols?: unknown) => chain({ table: undefined }),
    insert: (_table?: unknown) => writeChain(),
    update: (_table?: unknown) => writeChain(),
    delete: (_table?: unknown) => writeChain(),
  } as unknown as Db;
}

/** Rows for a submission that genuinely belongs to event-1, with no answers/
 * evaluations/recusals of its own -- the depth tests only need every read to
 * resolve, not any particular payload. */
function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  rows.set(schema.submission, [{ id: "sub-1", eventId: "event-1", seq: 1, title: "Talk One", status: "accepted" }]);
  rows.set(schema.event, [{ recordPrefix: "TALK" }]);
  rows.set(schema.submissionAnswer, []);
  rows.set(schema.participant, []);
  // A pre-existing evaluation row for sub-1/plan-1/every reviewer id used in
  // this file's tests -- both getEvaluation reads in the PUT route (the
  // wave's `existing` and upsertEvaluation's own readback after the write)
  // key off this same fake table, so it must already look like a saved row
  // (non-null submittedAt) for the write path to round-trip cleanly.
  rows.set(schema.evaluation, [
    {
      id: "eval-1",
      planId: "plan-1",
      submissionId: "sub-1",
      reviewerId: "u-org",
      round: 1,
      scoresJson: JSON.stringify({ c1: 3 }),
      comment: null,
      submittedAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ]);
  rows.set(schema.reviewRecusal, []);
  rows.set(schema.planReviewer, [{ trackId: null, submissionId: null }]); // unrestricted scope
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

const ORGANIZER: AuthInfo = { userId: "u-org", role: "organizer", orgId: ORG_A };
const REVIEWER: AuthInfo = { userId: "u-reviewer", role: "reviewer", orgId: ORG_A };

describe("DEC-370 (wave-61 amendment): GET /review/submissions/:id collapses its waterfall", () => {
  it("has 4+ repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp(ORGANIZER, db);
    const res = await app.request("/api/v1/review/submissions/sub-1?planId=plan-1");
    expect(res.status).toBe(200);
    // requireAssignedPlan (getPlanForOrg) is mocked, so it costs no DB
    // round trip. The route's ONE settleInDeclarationOrder wave then starts
    // summary/answers/speakers/format/audienceLevel/myEvaluation/myRecusal
    // together (inScope is skipped for an organizer via a resolved
    // Promise.resolve(true), so it never touches the DB) -- a fully serial
    // handler could never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(4);
  });

  it("assigned reviewer, in-plan's-event but out of scope: 404 'not in your review queue' (DEC-211)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const rows = buildRowsByTable();
    // A per-submission scoped assignment naming a DIFFERENT submission --
    // sub-1 is inside the plan's event but outside this reviewer's scope.
    rows.set(schema.planReviewer, [{ trackId: null, submissionId: "some-other-submission" }]);
    const db = makeInstrumentedDb(rows, tracker);
    const app = await buildApp(REVIEWER, db);
    const res = await app.request("/api/v1/review/submissions/sub-1?planId=plan-1");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("That submission is not in your review queue.");
  });

  it("submission outside the plan's event: 404 'Submission not found' verbatim (existence-hiding preserved)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const rows = buildRowsByTable();
    rows.set(schema.submission, []); // no submission in this event at all
    const db = makeInstrumentedDb(rows, tracker);
    // Organizer role: requireAssignedPlan scopes to org, never runs the
    // reviewer scope check, so the summary-null refusal is the only one
    // that can fire -- proving the message is 'Submission not found', not
    // the new DEC-211 sentence, for a submission that doesn't exist at all.
    const app = await buildApp(ORGANIZER, db);
    const res = await app.request("/api/v1/review/submissions/sub-1?planId=plan-1");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Submission not found");
  });
});

describe("DEC-370 (wave-61 amendment): PUT .../evaluations/:submissionId collapses its ladder", () => {
  async function putEvaluation(auth: AuthInfo, db: Db, scores: Record<string, number> = { c1: 3 }) {
    const app = await buildApp(auth, db);
    return app.request(
      "/api/v1/review/plans/plan-1/evaluations/sub-1",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ scores }),
      },
      {} as unknown as AppEnv["Bindings"],
    );
  }

  it("has 3+ repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const res = await putEvaluation(ORGANIZER, db);
    expect(res.status).toBe(200);
    // requireAssignedPlan is mocked; the route's ONE settleInDeclarationOrder
    // wave then starts inEvent/inScope(skipped, resolved)/recusal/existing
    // together -- a fully serial handler could never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(3);
  });

  it("assigned reviewer, in-plan's-event but out of scope: 404 'not in your review queue' (DEC-211)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const rows = buildRowsByTable();
    rows.set(schema.planReviewer, [{ trackId: null, submissionId: "some-other-submission" }]);
    const db = makeInstrumentedDb(rows, tracker);
    const res = await putEvaluation(REVIEWER, db);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("That submission is not in your review queue.");
  });

  it("submission outside the plan's event: 404 'Submission not found' verbatim, for every role (DEC-211)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const rows = buildRowsByTable();
    rows.set(schema.submission, []);
    const db = makeInstrumentedDb(rows, tracker);
    const res = await putEvaluation(ORGANIZER, db);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Submission not found");
  });
});
