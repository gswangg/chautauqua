// DEC-358 wave-39 falsifiability audit: closes the one row from
// docs/eval-findings.md's UNFALSIFIABLE batch that had no exercised check
// anywhere in the tree -- isSubmissionInReviewerScope sharing
// resolveReviewerSubmissions' MAX_REVIEWER_SCOPE_ROWS cap
// (src/server/repo/review/submissions.ts:396-407 vs :241-252). Every OTHER
// call site that imports isSubmissionInReviewerScope (review-idor.test.ts,
// admin-list-bounds-review.test.ts, eval-scorecard-caps.test.ts, etc.) mocks
// it -- none exercise its real cap-refusal, so a revert of the cap check at
// :401-407 would pass every existing test in the tree silently. This test
// asserts the OBSERVABLE behaviour only (the thrown ApiError + its message
// naming the cap), never the query shape, per this task's co-ownership note
// with task-w39-d/e which are editing this file's siblings this same wave.
//
// wave-41 (task-w41-d, DEC-358 amendment): adds a second, unrelated
// falsifiability closure -- scripts/seed.ts's "the seed has ONE clock"
// claim (DEC-591, seed.ts:261-264: SEED_NOW anchors every seeded instant as
// an offset from itself via CHQ_SEED_NOW). No existing test ran the seed
// script under two distinct CHQ_SEED_NOW values and compared the resulting
// output, so a regression that hardcoded an absolute instant instead of an
// offset from SEED_NOW would have passed every existing seed test (which
// only ever runs the script once, under the ambient Date.now()) silently.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSubmissionInReviewerScope } from "../src/server/repo/review/submissions";
import { MAX_REVIEWER_SCOPE_ROWS } from "../src/server/repo/review/reviewers";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";
import type { PlanRecord } from "../src/server/repo/review/plans";

function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
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
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    ...overrides,
  } as PlanRecord;
}

/** Fake db: models the plan_reviewer read (select().from().where().orderBy()
 * .limit(n)) isSubmissionInReviewerScope's cap-refusal reads first, PLUS the
 * follow-on single-submission-scoped lookups
 * (select().from().where().limit(1), no orderBy) its unrestricted/
 * submission-scoped branches issue once the cap read passes -- those return
 * an empty array (submission not found), which is enough for the function
 * to return a boolean without throwing again, so "does not throw" cases can
 * run past the cap check. */
function makeFakeDb(rowCount: number): Db {
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    trackId: null,
    submissionId: `sub-${i}`,
  }));
  return {
    select: (_cols: unknown) => ({
      from: (_table: unknown) => ({
        where: (_cond: unknown) => {
          const chain = {
            orderBy: (..._args: unknown[]) => ({
              limit: (n: number) => Promise.resolve(rows.slice(0, n)),
            }),
            limit: (_n: number) => Promise.resolve([] as unknown[]),
          };
          return chain;
        },
      }),
    }),
  } as unknown as Db;
}

describe("isSubmissionInReviewerScope shares resolveReviewerSubmissions' MAX_REVIEWER_SCOPE_ROWS cap (DEC-439)", () => {
  it("under the cap: does not throw on the plan_reviewer read (resolves to a boolean)", async () => {
    const db = makeFakeDb(3);
    const plan = makePlan();
    const result = await isSubmissionInReviewerScope(db, plan, "user-1", "sub-does-not-exist");
    expect(typeof result).toBe("boolean");
  });

  it("over MAX_REVIEWER_SCOPE_ROWS plan_reviewer rows: refuses loudly naming the cap, never silently truncates", async () => {
    const db = makeFakeDb(MAX_REVIEWER_SCOPE_ROWS + 1);
    const plan = makePlan();
    await expect(isSubmissionInReviewerScope(db, plan, "user-1", "sub-0")).rejects.toBeInstanceOf(ApiError);
    await expect(isSubmissionInReviewerScope(db, plan, "user-1", "sub-0")).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_REVIEWER_SCOPE_ROWS)),
    });
  });

  it("at exactly the cap: does not throw (the +1 overshoot, not the cap itself, trips the refusal)", async () => {
    const db = makeFakeDb(MAX_REVIEWER_SCOPE_ROWS);
    const plan = makePlan();
    await expect(isSubmissionInReviewerScope(db, plan, "user-1", "sub-0")).resolves.toBeDefined();
  });
});

describe("scripts/seed.ts: the seed has ONE clock (DEC-591)", () => {
  const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(SCRIPT_DIR, "..");
  const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

  // Both well before EVENT_START_MS - MIN_LEAD_DAYS (2027-05-12 minus 60
  // days = 2027-03-13), 31 days apart.
  const CLOCK_A = "2027-01-01T00:00:00.000Z";
  const CLOCK_B = "2027-02-01T00:00:00.000Z";
  const DELTA_MS = Date.parse(CLOCK_B) - Date.parse(CLOCK_A);

  function runSeed(seedNowIso: string): string {
    execFileSync("npx", ["tsx", "scripts/seed.ts"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env, CHQ_SEED_NOW: seedNowIso },
    });
    return readFileSync(OUTPUT_PATH, "utf-8");
  }

  // The event row's own created_at is a seeded instant (nextTs(), offset
  // from BASE_TS = SEED_NOW - 120 days) -- this must shift by exactly
  // DELTA_MS between the two runs. Its start_date/end_date/slug are fixture
  // constants (DEC-591 scopes "one clock" to seeded instants only, not the
  // event's own calendar dates) -- these must stay byte-identical.
  function parseEventRow(sql: string): { createdAt: number; updatedAt: number; startDate: string; slug: string } {
    const line = sql.split("\n").find((l) => l.startsWith("INSERT INTO event ("));
    if (!line) throw new Error("no INSERT INTO event line found in seed output");
    const tsMatch = line.match(/, (\d{10,}), (\d{10,})\);\s*$/);
    if (!tsMatch) throw new Error(`could not extract created_at/updated_at from: ${line}`);
    const startDateMatch = line.match(/'(\d{4}-\d{2}-\d{2})'/);
    if (!startDateMatch) throw new Error(`could not extract start_date from: ${line}`);
    const slugMatch = line.match(/'([a-z0-9-]+)', '\d{4}-\d{2}-\d{2}'/);
    if (!slugMatch) throw new Error(`could not extract slug from: ${line}`);
    return {
      createdAt: Number(tsMatch[1]!),
      updatedAt: Number(tsMatch[2]!),
      startDate: startDateMatch[1]!,
      slug: slugMatch[1]!,
    };
  }

  it(
    "shifts every seeded instant by exactly the CHQ_SEED_NOW delta, leaving the event's fixed calendar dates untouched",
    () => {
      const sqlA = runSeed(CLOCK_A);
      const rowA = parseEventRow(sqlA);
      const sqlB = runSeed(CLOCK_B);
      const rowB = parseEventRow(sqlB);

      expect(rowB.createdAt - rowA.createdAt).toBe(DELTA_MS);
      expect(rowB.updatedAt - rowA.updatedAt).toBe(DELTA_MS);
      expect(rowB.startDate).toBe(rowA.startDate);
      expect(rowB.slug).toBe(rowA.slug);
    },
    60_000,
  );

  it("rejects an unparseable CHQ_SEED_NOW loudly instead of silently falling back to Date.now()", () => {
    expect(() =>
      execFileSync("npx", ["tsx", "scripts/seed.ts"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        env: { ...process.env, CHQ_SEED_NOW: "not-a-date" },
      }),
    ).toThrow();
  });
});
