// DEC-829 (wave-32 amendment, task w32-b): GET /api/v1/review/plans/:id/queue
// must hydrate format/audienceLevel/identities over the EMITTED rows only
// (the page slice plus any recused rows), never over the reviewer's whole
// scope. Proven with an instrumented fake `Db` for the population-wide reads
// (resolveReviewerSubmissions, evaluation counts, recusals) and spies on the
// three display readers (listFormatLabelsBySubmission,
// listAudienceLevelLabelsBySubmission, listSpeakerIdentitiesForSubmissions)
// that record the length of the id array they're called with.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { PlanRecord } from "../src/server/repo/review";

const ORG_A = "org-a";

function planRecord(overrides: Partial<PlanRecord> = {}): PlanRecord {
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
    ...overrides,
  } as unknown as PlanRecord;
}

const formatCalls: number[] = [];
const audienceCalls: number[] = [];
const identityCalls: number[] = [];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === "plan-1" && orgId === ORG_A ? currentPlan : null,
    ),
    // Spies that record the id-array length passed in, then delegate a
    // trivial (empty-value) map rather than exercising the real SQL path --
    // what's under test here is the SCOPE of the call, not the label lookup
    // itself (that's covered by test/reviewer-audience-level.test.ts and
    // test/review-queue-anonymized-titles.test.ts).
    listFormatLabelsBySubmission: vi.fn(async (_db: unknown, ids: string[]) => {
      formatCalls.push(ids.length);
      return new Map(ids.map((id) => [id, `format-${id}`]));
    }),
    listAudienceLevelLabelsBySubmission: vi.fn(async (_db: unknown, ids: string[]) => {
      audienceCalls.push(ids.length);
      return new Map(ids.map((id) => [id, `audience-${id}`]));
    }),
    listSpeakerIdentitiesForSubmissions: vi.fn(async (_db: unknown, ids: string[]) => {
      identityCalls.push(ids.length);
      return new Map(
        ids.map((id) => [id, [{ name: `Speaker ${id}`, email: `${id}@example.com`, company: null }]]),
      );
    }),
  };
});

let currentPlan: PlanRecord = planRecord();

afterEach(() => {
  vi.clearAllMocks();
  formatCalls.length = 0;
  audienceCalls.length = 0;
  identityCalls.length = 0;
});

/** Same minimal chainable fake query builder as
 * test/reviewer-queue-round-trip-depth.test.ts -- rows looked up by the
 * table object passed to `.from()`, resolving synchronously (no artificial
 * delay needed for this test: it asserts SCOPE, not concurrency). */
function makeFakeDb(rowsByTable: Map<unknown, unknown[]>): Db {
  function chain(state: { table: unknown }) {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit"]) {
      self[method] = (arg?: unknown) => {
        if (method === "from") state.table = arg;
        return self;
      };
    }
    self.then = (resolve: (v: unknown) => void) => {
      return Promise.resolve(rowsByTable.get(state.table) ?? []).then(resolve);
    };
    return self;
  }
  return {
    select: (_cols?: unknown) => chain({ table: undefined }),
  } as unknown as Db;
}

// 5 submissions in the reviewer's scope -- large enough that a bounded
// hydration wave (perPage=2 + 1 recused = 3) is provably smaller than the
// full scope (5).
function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  rows.set(schema.planReviewer, [{ trackId: null, submissionId: null }]);
  rows.set(schema.submission, [
    { id: "sub-1", seq: 1, title: "Talk One" },
    { id: "sub-2", seq: 2, title: "Talk Two" },
    { id: "sub-3", seq: 3, title: "Talk Three" },
    { id: "sub-4", seq: 4, title: "Talk Four" },
    { id: "sub-5", seq: 5, title: "Talk Five" },
  ]);
  rows.set(schema.event, [{ recordPrefix: "TALK" }]);
  // No evaluations yet -- every submission is unscored, ratingsCount 0.
  rows.set(schema.evaluation, []);
  // sub-5 is recused -- must still be hydrated even though it's outside the
  // 2-row page.
  rows.set(schema.reviewRecusal, [
    { id: "recusal-1", planId: "plan-1", submissionId: "sub-5", userId: "u1", reason: "conflict of interest", createdAt: new Date(0) },
  ]);
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

describe("DEC-829 (wave-32 amendment): reviewer queue hydrates emitted rows, not the scope", () => {
  it("bounds the display readers' id-array length by perPage + recused.length, not the scope size", async () => {
    currentPlan = planRecord();
    const db = makeFakeDb(buildRowsByTable());
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, db);
    const res = await app.request("/api/v1/review/plans/plan-1/queue?perPage=2");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; recused: unknown[]; total: number };
    // Scope is 5 submissions; page 1 of perPage=2 plus the one recused row
    // (sub-5) bounds the hydration wave at 3 -- never 5 (the scope size).
    expect(body.total).toBe(4); // 5 scoped minus the 1 recused (DEC-271)
    expect(body.items).toHaveLength(2);
    expect(body.recused).toHaveLength(1);

    expect(formatCalls).toEqual([3]);
    expect(audienceCalls).toEqual([3]);
    // Non-anonymized plan: listSpeakerIdentitiesForSubmissions is never
    // called at all (short-circuited to Promise.resolve(new Map())).
    expect(identityCalls).toEqual([]);
    for (const n of formatCalls) {
      expect(n).toBeLessThan(5); // strictly less than the full scope size
    }
  });

  it("hydrates and redacts titles on both the actionable half and the recused half of an anonymized plan", async () => {
    currentPlan = planRecord({ anonymized: true });
    const db = makeFakeDb(buildRowsByTable());
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A }, db);
    const res = await app.request("/api/v1/review/plans/plan-1/queue?perPage=2");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string; title: string }[];
      recused: { submissionId: string; title: string }[];
    };

    // identitiesFor("sub-1") includes "Speaker sub-1" -- the fake title
    // "Talk One" doesn't literally contain that name, so redactIdentity
    // leaves it byte-identical; what matters here is that the hydration
    // call happened (identityCalls non-empty) and every emitted row's
    // title passed through maybeRedactTitle without throwing.
    expect(identityCalls).toEqual([3]);
    expect(body.items.map((i) => i.submissionId)).toEqual(["sub-1", "sub-2"]);
    expect(body.recused).toEqual([
      {
        submissionId: "sub-5",
        ref: expect.any(String),
        title: "Talk Five",
        reason: "conflict of interest",
        format: "format-sub-5",
        audienceLevel: "audience-sub-5",
      },
    ]);
    expect(body.items[0].title).toBe("Talk One");
  });
});
