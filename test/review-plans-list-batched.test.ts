// DEC-829 (wave-33 amendment, task w33-b): GET /api/v1/review/plans'
// reviewer branch used to resolve its page with
// Promise.all(pagedIds.map((id) => repo.getPlanById(db, id))) -- one
// SELECT+JOIN per id, up to MAX_PER_PAGE=200 statements for one view. This
// test proves the fix BEHAVIOURALLY (an instrumented fake `Db` that counts
// every statement issued), not with a source grep: for a 200-id assigned-
// plan set the number of statements issued to resolve the page is exactly
// one per chunkIds batch (3, since ID_CHUNK_SIZE=90 -> 90+90+20), never one
// per id. A second assertion pins the response envelope.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

const REVIEWER = "reviewer-1";
const PLAN_IDS = Array.from({ length: 200 }, (_, i) => `plan-${String(i).padStart(3, "0")}`);

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listPlanIdsForReviewer: vi.fn(async (_db: unknown, userId: string) => (userId === REVIEWER ? PLAN_IDS : [])),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

interface Counter {
  statements: number;
}

/** A minimal chainable fake query builder mirroring
 * test/reviewer-queue-round-trip-depth.test.ts's instrumented fake: every
 * drizzle-style chain method returns the same thenable, and each `.then`
 * (one per issued statement) increments `counter.statements` before
 * resolving with a fixed row set for evaluation_plan's join shape --
 * `inArray`'s actual argument is not respected (the fake doesn't filter),
 * so a batch of 90/90/20 ids still returns the full plan/timezone row set
 * each call, letting listPlansByIds's own id-order + missing-id-skip logic
 * do the real work under test. */
function makeInstrumentedDb(counter: Counter): Db {
  const planRows = PLAN_IDS.map((id, i) => ({
    plan: {
      id,
      eventId: "event-1",
      name: `Plan ${i}`,
      instructions: null,
      openDate: null,
      closeDate: null,
      filtersJson: null,
      anonymized: false,
      scaleJson: JSON.stringify({ min: 1, max: 5 }),
      criteriaJson: JSON.stringify([]),
      rounds: 1,
      currentRound: 1,
      roundCriteriaJson: null,
      roundMetaJson: null,
      maxEvaluations: null,
      anonymizedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    timezone: "UTC",
  }));

  function chain() {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit"]) {
      self[method] = () => self;
    }
    self.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      counter.statements += 1;
      return Promise.resolve()
        .then(() => resolve(planRows))
        .catch((e: unknown) => reject(e));
    };
    return self;
  }
  return {
    select: () => chain(),
  } as unknown as Db;
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

describe("DEC-829 (wave-33 amendment): reviewer landing page batches plan reads", () => {
  it("issues exactly one statement per chunkIds batch (3 for 200 ids), never one per id", async () => {
    const counter: Counter = { statements: 0 };
    const db = makeInstrumentedDb(counter);
    const app = await buildApp({ userId: REVIEWER, role: "reviewer", orgId: "org-a" }, db);
    const res = await app.request("/api/v1/review/plans");
    expect(res.status).toBe(200);
    expect(counter.statements).toBe(3);
  });

  it("pins the response envelope: total, page, perPage and item ordering unchanged", async () => {
    const counter: Counter = { statements: 0 };
    const db = makeInstrumentedDb(counter);
    const app = await buildApp({ userId: REVIEWER, role: "reviewer", orgId: "org-a" }, db);
    const res = await app.request("/api/v1/review/plans");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[]; total: number; page: number; perPage: number };
    expect(body.total).toBe(200);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(200);
    expect(body.items).toHaveLength(200);
    // Deterministic sorted-id order (DEC-461(e)'s blessed JS-slice) is
    // preserved by the batch reader's own input-order-preservation contract.
    expect(body.items.map((i) => i.id)).toEqual(PLAN_IDS);
  });
});
