// DEC-924 amendment (wave 47): POST /api/v1/plans/:id/assignments/distribute
// writes its created pairs through ONE set-based addReviewers() call
// (chunked only for the D1 bound-parameter ceiling, DEC-528) instead of a
// per-assignment addReviewer() loop -- src/routes/review/plans-distribute.ts
// no longer imports the retired singular addReviewer at all.
//
// This test exercises the REAL src/server/repo/review/reviewers.ts
// addReviewers/chunkRowsForInsert against a fake db that counts INSERT
// statements, so a regression back to a per-row loop shows up as an
// insert-call count equal to the assignment count instead of the chunk
// count.

import { execSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

interface FakePlan {
  id: string;
  eventId: string;
  name: string;
  instructions: string | null;
  openDate: number | null;
  closeDate: number | null;
  filters: null;
  anonymized: boolean;
  scale: { min: number; max: number };
  criteria: unknown[];
  rounds: number;
  currentRound: number;
  roundCriteria: null;
  maxEvaluations: number | null;
}

function makePlan(overrides: Partial<FakePlan> = {}): FakePlan {
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
    maxEvaluations: 3,
    ...overrides,
  };
}

// 3 reviewers x 12 submissions x maxEvaluations(3) = 36 assignments -- the
// design frame's own example size, well above the 12-row-per-chunk
// (floor((100-10)/7) columns) chunkRowsForInsert produces for this row shape.
const REVIEWER_USER_IDS = ["rev-1", "rev-2", "rev-3"];
const SUBMISSION_COUNT = 12;
const SUBMISSIONS = Array.from({ length: SUBMISSION_COUNT }, (_, i) => ({
  id: `sub-${i + 1}`,
  ref: `SES-${String(i + 1).padStart(3, "0")}`,
  title: `Talk ${i + 1}`,
  trackIds: [] as string[],
  status: "pending",
}));

const plan = makePlan();

// Amendment (wave 52): an all-null (trackId AND submissionId both null,
// i.e. 'All submissions') plan_reviewer row now resolves (via
// resolveAssignments, src/domain/evaluation.ts) as ALREADY covering every
// submission -- distribute proposes nothing for a plan scope alone already
// covers. To keep exercising the chunked-insert path with a real created
// set, these reviewer rows instead point at a submission OUTSIDE the test
// fixture's 12-submission set (broad for ELIGIBILITY -- no trackId row at
// all -- but zero real resolved coverage among SUBMISSIONS), reproducing
// the same "fresh pool, round-robin everything" shape the old all-null
// fixture intended.
vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () =>
      REVIEWER_USER_IDS.map((userId, i) => ({
        id: `pr-existing-${i}`,
        planId: plan.id,
        userId,
        trackId: null,
        submissionId: "sub-outside-fixture",
      })),
    ),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
    listRecusalsForPlan: vi.fn(async () => []),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

// A minimal drizzle-shaped fake db: insert(...).values(rows) records exactly
// ONE call per batch (chunkRowsForInsert already sliced `rows`), and the
// select-back after the insert loop returns whatever has been inserted --
// addReviewers issues that select ONCE, keyed to the ids it just generated,
// so returning every row inserted so far is equivalent for a single
// addReviewers() call.
function makeCountingDb() {
  const insertCalls: unknown[][] = [];
  const insertedRows: Record<string, unknown>[] = [];
  const db = {
    insert: () => ({
      values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const batch = Array.isArray(rows) ? rows : [rows];
        insertCalls.push(batch);
        insertedRows.push(...batch);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(insertedRows),
      }),
    }),
  };
  return { db, insertCalls, insertedRows };
}

async function buildApp(auth: AuthInfo, db: unknown) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db as never);
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

describe("DEC-924 amendment (wave 47): distribute apply writes are set-based", () => {
  it("issues O(chunks) plan_reviewer INSERTs, not O(assignments), for 36 created pairs", async () => {
    const { db, insertCalls, insertedRows } = makeCountingDb();
    const app = await buildApp(organizer, db);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: number };
    expect(body.created).toBe(REVIEWER_USER_IDS.length * SUBMISSIONS.length);
    expect(body.created).toBeGreaterThanOrEqual(30);

    // O(chunks): rowsPerChunk = floor((100-10)/7) = 12, so 36 rows -> 3
    // batches -- nowhere near one INSERT per assignment.
    expect(insertCalls.length).toBeLessThan(body.created);
    expect(insertCalls.length).toBe(3);

    // Every inserted row is exactly one of the pairs computeDistribution
    // (via distributeAssignments) previewed: the userId/submissionId set and
    // count match, order aside.
    const insertedPairs = insertedRows
      .map((r) => `${r.userId as string}::${r.submissionId as string}`)
      .sort();
    const expectedPairs: string[] = [];
    for (const sub of SUBMISSIONS) {
      for (const userId of REVIEWER_USER_IDS) expectedPairs.push(`${userId}::${sub.id}`);
    }
    expect(insertedPairs.length).toBe(expectedPairs.length);
    expect(insertedPairs).toEqual(expectedPairs.slice().sort());
  });

  it("still 201s with created: 0 for the empty-set case (no reviewers assigned to the plan)", async () => {
    const { reviewRoutes: _unused } = await import("../src/routes/review");
    void _unused;
    const repo = await import("../src/server/repo/review");
    vi.mocked(repo.listReviewerRowsForPlan).mockResolvedValueOnce([]);
    const { db, insertCalls } = makeCountingDb();
    const app = await buildApp(organizer, db);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: number };
    expect(body.created).toBe(0);
    expect(insertCalls.length).toBe(0);
  });

  it("amendment (wave 52): an all-null ('All submissions') reviewer pool already covers every submission -- 201s with created: 0, no inserts", async () => {
    const repo = await import("../src/server/repo/review");
    vi.mocked(repo.listReviewerRowsForPlan).mockResolvedValueOnce(
      REVIEWER_USER_IDS.map((userId, i) => ({
        id: `pr-broad-${i}`,
        planId: plan.id,
        userId,
        trackId: null,
        submissionId: null,
      })),
    );
    const { db, insertCalls } = makeCountingDb();
    const app = await buildApp(organizer, db);
    const res = await app.request(`/api/v1/plans/${plan.id}/assignments/distribute`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: number };
    // 3 broad reviewers already resolve as covering every submission
    // (maxEvaluations 3 == reviewer pool size) -- nothing left to propose.
    expect(body.created).toBe(0);
    expect(insertCalls.length).toBe(0);
  });
});

describe("DEC-924 amendment (wave 47): the retired singular addReviewer is not re-addable by habit", () => {
  it("the identifier addReviewer( appears nowhere under src/", () => {
    let output = "";
    try {
      output = execSync("grep -rn 'addReviewer(' src/", { cwd: process.cwd(), encoding: "utf8" });
    } catch (err) {
      // grep exits 1 (no matches) -- that is the PASSING case.
      const e = err as { status?: number; stdout?: string };
      if (e.status === 1) {
        output = "";
      } else {
        throw err;
      }
    }
    // Every remaining hit must be the plural addReviewers( -- filter those
    // out and assert nothing else remains.
    const stray = output
      .split("\n")
      .filter((line) => line.length > 0 && !line.includes("addReviewers("));
    expect(stray).toEqual([]);
  });
});
