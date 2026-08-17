// DEC-439/DEC-440/DEC-703 payload-width regression: the ranked-results
// endpoint must not ship the whole plan over the wire for a page. Recording-
// fake-db pattern copied from test/spec9-invariants.test.ts -- a minimal fake
// drizzle db that only supports the exact chains buildResults' call graph
// uses, and records every table + column-set it's asked to touch.
//
// Payload-width assertions (task w15-b, extended by task w16-g):
// 1. a results build with no plan track filter never issues the OLD
//    whole-event trackId scan (listPlanFilteredSubmissions({withTrackIds:
//    false}) skips query (b) entirely) -- distinguished from DEC-703's own
//    page-scoped {submissionId, name} track-name lookup by column shape,
//    since both target schema.submissionTrack.
// 2. the evaluation read selects exactly {submission_id, scores_json} -- not
//    a bare `select()` (whole row: id/planId/reviewerId/round/comment/
//    timestamps too).
// 3. the ranked rows/averages/perCriterion/perDropdown for a fixture are
//    byte-identical to the pre-change values (buildResults' aggregation
//    logic itself is unchanged -- only its data source is narrower).
// 4. DEC-703: speakers/trackNames are resolved via exactly ONE query each
//    (never per-row), and their values land on the right row.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { rankPlanResults, hydrateResultsRows } from "../src/routes/review/shared";
import type { PlanRecord } from "../src/server/repo/review";
import type { Db } from "../src/server/context";

/**
 * Fake drizzle db supporting `select(cols).from(table).innerJoin(table2).
 * where(cond).orderBy(...)` (optionally `.limit(n)`), backed by a per-table
 * row array. innerJoin is a no-op over the FROM table's own preset rows --
 * callers provide the join's OWN combined output as that table's fixture
 * (e.g. rows.participant already carries {submissionId, firstName,
 * lastName} as if joined to contact). Records every `{table, cols}` pair
 * `select().from()`/`.innerJoin()` is asked to touch, in order.
 */
function fakeDb(rows: {
  event: unknown[];
  submission: unknown[];
  evaluation: unknown[];
  submissionTrack: unknown[];
  participant?: unknown[];
}) {
  const touched: { table: unknown; cols: unknown }[] = [];
  const byTable = new Map<unknown, unknown[]>([
    [schema.event, rows.event],
    [schema.submission, rows.submission],
    [schema.evaluation, rows.evaluation],
    [schema.submissionTrack, rows.submissionTrack],
    [schema.participant, rows.participant ?? []],
  ]);

  const db = {
    select(cols?: unknown) {
      return {
        from(table: unknown) {
          touched.push({ table, cols });
          const tableRows = byTable.get(table) ?? [];
          const chain = {
            innerJoin(joinTable: unknown) {
              touched.push({ table: joinTable, cols });
              return chain;
            },
            where() {
              const result: Promise<unknown[]> & {
                limit?: (n: number) => Promise<unknown[]>;
                orderBy?: (
                  ...args: unknown[]
                ) => Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> };
              } = Promise.resolve(tableRows);
              (result as { limit: (n: number) => Promise<unknown[]> }).limit = async (n: number) => tableRows.slice(0, n);
              (
                result as {
                  orderBy: (...args: unknown[]) => Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> };
                }
              ).orderBy = (..._args: unknown[]) => {
                const ordered: Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> } =
                  Promise.resolve(tableRows);
                (ordered as { limit: (n: number) => Promise<unknown[]> }).limit = async (n: number) =>
                  tableRows.slice(0, n);
                return ordered;
              };
              return result;
            },
          };
          return chain;
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
    anonymizedAt: null,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    roundMeta: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
    ...overrides,
  };
}

describe("DEC-439/DEC-440: buildResults payload width", () => {
  it("never issues the old whole-event trackId scan when the plan has no track filter", async () => {
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

    await rankPlanResults({ var: { db } }, plan, 1);

    // DEC-703's own page-scoped track-name lookup selects {submissionId,
    // name} from schema.submissionTrack (joined to track) -- distinct from
    // the OLD whole-event {submissionId, trackId} scan this test guards
    // against (DEC-439/listPlanFilteredSubmissions({withTrackIds: false})
    // must still skip its own second query entirely).
    const submissionTrackTouches = touched.filter((t) => t.table === schema.submissionTrack);
    for (const touch of submissionTrackTouches) {
      const colKeys = Object.keys((touch.cols ?? {}) as Record<string, unknown>).sort();
      expect(colKeys).not.toEqual(["submissionId", "trackId"]);
    }
  });

  it("selects exactly {submissionId, scoresJson} from schema.evaluation, not a whole-row select()", async () => {
    const plan = makePlan();
    const { db, touched } = fakeDb({
      event: [{ recordPrefix: "S" }],
      submission: [{ id: "sub-1", seq: 1, title: "Talk A", status: "pending" }],
      evaluation: [{ submissionId: "sub-1", scoresJson: JSON.stringify({ c1: 4 }) }],
      submissionTrack: [],
    });

    await rankPlanResults({ var: { db } }, plan, 1);

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

    const rankedRows = await rankPlanResults({ var: { db } }, plan, 1);
    const rows = await hydrateResultsRows({ var: { db } }, plan, rankedRows);

    expect(rows).toEqual([
      {
        submissionId: "sub-2",
        // Post-eval amendment: the SCORE rank is stamped on the ranked
        // population, so it rides the payload rather than being recomputed
        // from display position in the table.
        rank: 1,
        ref: "S-002",
        title: "Talk B",
        count: 1,
        average: 5,
        perCriterion: { c1: 5 },
        perDropdown: { decision: { counts: { advance: 1, reject: 0 }, modal: "advance" } },
        status: "accepted",
        speakers: [],
        trackNames: [],
        recusals: 0,
      },
      {
        submissionId: "sub-1",
        rank: 2,
        ref: "S-001",
        title: "Talk A",
        count: 2,
        average: 3,
        perCriterion: { c1: 3 },
        perDropdown: { decision: { counts: { advance: 1, reject: 1 }, modal: "advance" } },
        status: "pending",
        speakers: [],
        trackNames: [],
        recusals: 0,
      },
    ]);
  });

  it("DEC-703: a results row carries speaker names and track names, resolved via ONE batched query each", async () => {
    const plan = makePlan();
    const { db, touched } = fakeDb({
      event: [{ recordPrefix: "S" }],
      submission: [
        { id: "sub-1", seq: 1, title: "Talk A", status: "pending" },
        { id: "sub-2", seq: 2, title: "Talk B", status: "pending" },
      ],
      evaluation: [],
      submissionTrack: [
        { submissionId: "sub-1", name: "Engineering" },
        { submissionId: "sub-1", name: "Leadership" },
      ],
      participant: [
        { submissionId: "sub-1", firstName: "Ada", lastName: "Lovelace" },
        { submissionId: "sub-1", firstName: "Grace", lastName: "Hopper" },
      ],
    });

    const rankedRows = await rankPlanResults({ var: { db } }, plan, 1);
    const rows = await hydrateResultsRows({ var: { db } }, plan, rankedRows);

    const rowA = rows.find((r: { submissionId: string }) => r.submissionId === "sub-1");
    const rowB = rows.find((r: { submissionId: string }) => r.submissionId === "sub-2");
    expect(rowA?.speakers).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(rowA?.trackNames).toEqual(["Engineering", "Leadership"]);
    // A submission with no participant/track rows gets empty arrays, never
    // undefined -- the row shape is uniform regardless of data presence.
    expect(rowB?.speakers).toEqual([]);
    expect(rowB?.trackNames).toEqual([]);

    // ONE statement per page for each lookup (never per-row): exactly one
    // select().from(schema.participant) and one select().from(
    // schema.submissionTrack) whose cols select {submissionId, name} (the
    // DEC-703 track-name lookup), regardless of there being two submissions
    // on this page.
    const participantFromTouches = touched.filter((t) => t.table === schema.participant);
    expect(participantFromTouches.length).toBe(1);
    const trackNameTouches = touched.filter(
      (t) => t.table === schema.submissionTrack && Object.keys((t.cols ?? {}) as Record<string, unknown>).includes("name"),
    );
    expect(trackNameTouches.length).toBe(1);
  });
});
