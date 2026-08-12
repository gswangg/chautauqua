// DEC-439/DEC-440 payload-width regression: the ranked-results endpoint must
// not ship the whole plan over the wire for a page. Recording-fake-db
// pattern copied from test/spec9-invariants.test.ts -- a minimal fake
// drizzle db that only supports the exact chains buildResults' call graph
// uses, and records every table + column-set it's asked to touch.
//
// Three payload-width assertions (task w15-b):
// 1. a results build with no plan track filter never touches
//    schema.submissionTrack (listPlanFilteredSubmissions({withTrackIds:
//    false}) skips query (b) entirely).
// 2. the evaluation read selects exactly {submission_id, scores_json} -- not
//    a bare `select()` (whole row: id/planId/reviewerId/round/comment/
//    timestamps too).
// 3. the ranked rows/averages/perCriterion/perDropdown for a fixture are
//    byte-identical to the pre-change values (buildResults' aggregation
//    logic itself is unchanged -- only its data source is narrower).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { buildResults } from "../src/routes/review/shared";
import type { PlanRecord } from "../src/server/repo/review";
import type { Db } from "../src/server/context";

/**
 * Fake drizzle db supporting only `select(cols).from(table).where(cond)`
 * (optionally `.limit(n)`), backed by a per-table row array. Records every
 * `{table, cols}` pair `select().from()` is asked to touch, in order.
 */
function fakeDb(rows: { event: unknown[]; submission: unknown[]; evaluation: unknown[]; submissionTrack: unknown[] }) {
  const touched: { table: unknown; cols: unknown }[] = [];
  const byTable = new Map<unknown, unknown[]>([
    [schema.event, rows.event],
    [schema.submission, rows.submission],
    [schema.evaluation, rows.evaluation],
    [schema.submissionTrack, rows.submissionTrack],
  ]);

  const db = {
    select(cols?: unknown) {
      return {
        from(table: unknown) {
          touched.push({ table, cols });
          const tableRows = byTable.get(table) ?? [];
          const where = () => {
            const result: Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> } = Promise.resolve(tableRows);
            (result as { limit: (n: number) => Promise<unknown[]> }).limit = async (n: number) => tableRows.slice(0, n);
            return result;
          };
          return { where };
        },
      };
    },
  };
  return { db: db as unknown as Db, touched };
}

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
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
    ...overrides,
  };
}

describe("DEC-439/DEC-440: buildResults payload width", () => {
  it("never touches schema.submissionTrack when the plan has no track filter", async () => {
    const plan = makePlan();
    const { db, touched } = fakeDb({
      event: [{ recordPrefix: "S" }],
      submission: [
        { id: "sub-1", seq: 1, title: "Talk A", status: "pending" },
        { id: "sub-2", seq: 2, title: "Talk B", status: "pending" },
      ],
      evaluation: [],
      submissionTrack: [{ submissionId: "sub-1", trackId: "track-1" }],
    });

    await buildResults({ var: { db } }, plan, 1);

    expect(touched.some((t) => t.table === schema.submissionTrack)).toBe(false);
  });

  it("selects exactly {submissionId, scoresJson} from schema.evaluation, not a whole-row select()", async () => {
    const plan = makePlan();
    const { db, touched } = fakeDb({
      event: [{ recordPrefix: "S" }],
      submission: [{ id: "sub-1", seq: 1, title: "Talk A", status: "pending" }],
      evaluation: [{ submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 4 }) }],
      submissionTrack: [],
    });

    await buildResults({ var: { db } }, plan, 1);

    const evalTouch = touched.find((t) => t.table === schema.evaluation);
    expect(evalTouch).toBeDefined();
    expect(evalTouch?.cols).toBeDefined();
    const colKeys = Object.keys(evalTouch?.cols as Record<string, unknown>).sort();
    expect(colKeys).toEqual(["scoresJson", "submissionId"]);
    // A bare whole-row select() (no column projection) is exactly what this
    // guards against: cols would be undefined instead of a two-key object.
    expect(evalTouch?.cols).not.toBeUndefined();
  });

  it("ranked rows/averages/perCriterion/perDropdown are byte-identical to the pre-change values", async () => {
    const plan = makePlan({
      criteria: [
        { id: "c1", label: "Quality", kind: "rating", weight: 1 },
        { id: "decision", label: "Decision", kind: "dropdown", options: ["advance", "reject"] },
      ],
    });
    const { db } = fakeDb({
      event: [{ recordPrefix: "S" }],
      submission: [
        { id: "sub-1", seq: 1, title: "Talk A", status: "pending" },
        { id: "sub-2", seq: 2, title: "Talk B", status: "accepted" },
      ],
      evaluation: [
        // sub-1: two evals, average (4+2)/2 = 3.
        { submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 4, decision: "advance" }) },
        { submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 2, decision: "reject" }) },
        // sub-2: one eval, average 5 -- ranks first (higher average).
        { submissionId: "sub-2", scoresJson: JSON.stringify({ c1: 5, decision: "advance" }) },
      ],
      submissionTrack: [],
    });

    const rows = await buildResults({ var: { db } }, plan, 1);

    expect(rows).toEqual([
      {
        submissionId: "sub-2",
        ref: "S-002",
        title: "Talk B",
        count: 1,
        average: 5,
        perCriterion: { c1: 5 },
        perDropdown: { decision: { counts: { advance: 1, reject: 0 }, modal: "advance" } },
        status: "accepted",
      },
      {
        submissionId: "sub-1",
        ref: "S-001",
        title: "Talk A",
        count: 2,
        average: 3,
        perCriterion: { c1: 3 },
        perDropdown: { decision: { counts: { advance: 1, reject: 1 }, modal: "advance" } },
        status: "pending",
      },
    ]);
  });
});
