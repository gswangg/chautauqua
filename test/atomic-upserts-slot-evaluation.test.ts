// Regression for DEC-552 (part 1 of 2): schedule_slot and evaluation
// upserts are one atomic INSERT ... ON CONFLICT DO UPDATE statement each --
// never a SELECT-then-INSERT-or-UPDATE race over their uniqueIndexes
// (schedule_slot_submission_id_idx at src/db/schema.ts:432,
// evaluation_plan_submission_reviewer_round_idx at src/db/schema.ts:350).
//
// Fake-db harness shape copied from test/portal-edit-answer-upsert.test.ts
// (DEC-541 precedent): a db whose select()/insert()/update() calls are
// recorded, in call order, against specific schema tables, so a regression
// back to read-then-write is caught even if final DB state looks correct.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { upsertSlot } from "../src/server/repo/agenda";
import { upsertEvaluation } from "../src/server/repo/review/evaluations";

interface UpsertCall {
  table: unknown;
  rows: Array<Record<string, unknown>>;
  target: unknown;
  set: Record<string, unknown>;
}

type CallLogEntry =
  | { kind: "select"; table: unknown }
  | { kind: "insert"; table: unknown }
  | { kind: "update"; table: unknown };

function makeFakeDb() {
  const log: CallLogEntry[] = [];
  const upserts: UpsertCall[] = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  // getEvaluation's post-write read-back needs a row to return so
  // upsertEvaluation doesn't throw "row missing after write". Track the
  // last evaluation upsert and synthesize a matching row.
  let lastEvaluationUpsert: UpsertCall | null = null;

  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      where: () => chain,
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          log.push({ kind: "select", table });
          if (table === schema.evaluation) {
            const u = lastEvaluationUpsert;
            if (!u) return chainFor([]);
            const row = u.rows[0]!;
            return chainFor([
              {
                id: row.id,
                planId: row.planId,
                submissionId: row.submissionId,
                reviewerId: row.reviewerId,
                round: row.round,
                scoresJson: row.scoresJson,
                comment: row.comment,
              },
            ]);
          }
          throw new Error(`fake db: unexpected table in select: ${String(table)}`);
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: () => {
              log.push({ kind: "update", table });
              updates.push({ table, values });
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const asArray = Array.isArray(rows) ? rows : [rows];
          log.push({ kind: "insert", table });
          return {
            onConflictDoUpdate(opts: { target: unknown; set: Record<string, unknown> }) {
              const call: UpsertCall = { table, rows: asArray, target: opts.target, set: opts.set };
              upserts.push(call);
              if (table === schema.evaluation) lastEvaluationUpsert = call;
              const result = Promise.resolve() as Promise<undefined> & {
                returning: () => Promise<{ id: unknown }[]>;
              };
              // DEC-519 wave-6 amendment: upsertSlot gates its ics bump on
              // `.returning()` having a row -- these tests are exercising
              // the atomic-upsert shape (never a read-then-write), each
              // call here is a genuine change, so report one row.
              result.returning = () => Promise.resolve([{ id: (asArray[0] as { id?: unknown })?.id ?? "row-1" }]);
              return result;
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Db, log, upserts, updates };
}

describe("upsertSlot (DEC-552)", () => {
  it("issues zero selects against schedule_slot and exactly one insert-with-onConflictDoUpdate, then bumps ics_sequence", async () => {
    const { db, log, upserts, updates } = makeFakeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-12", startMin: 60, endMin: 120, roomId: "room1" });

    const slotSelects = log.filter((e) => e.kind === "select" && e.table === schema.scheduleSlot);
    expect(slotSelects.length).toBe(0);

    const slotUpserts = upserts.filter((u) => u.table === schema.scheduleSlot);
    expect(slotUpserts.length).toBe(1);

    expect(slotUpserts[0]!.target).toEqual(schema.scheduleSlot.submissionId);

    // bumpIcsSequences ran afterwards: one update against schema.submission.
    const submissionUpdates = updates.filter((u) => u.table === schema.submission);
    expect(submissionUpdates.length).toBe(1);

    // ordering: the slot insert happened before the submission update.
    const insertIdx = log.findIndex((e) => e.kind === "insert" && e.table === schema.scheduleSlot);
    const updateIdx = log.findIndex((e) => e.kind === "update" && e.table === schema.submission);
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(insertIdx);
  });

  it("a second upsertSlot for the same submission issues a second single-statement upsert and never a SELECT", async () => {
    const { db, log, upserts } = makeFakeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-12", startMin: 60, endMin: 120, roomId: "room1" });
    await upsertSlot(db, "sub1", { day: "2026-08-13", startMin: 30, endMin: 90, roomId: "room2" });

    const slotSelects = log.filter((e) => e.kind === "select" && e.table === schema.scheduleSlot);
    expect(slotSelects.length).toBe(0);

    const slotUpserts = upserts.filter((u) => u.table === schema.scheduleSlot);
    expect(slotUpserts.length).toBe(2);
    expect(slotUpserts[1]!.rows[0]!.day).toBe("2026-08-13");
  });
});

describe("upsertEvaluation (DEC-552)", () => {
  it("issues zero selects against evaluation before the write, exactly one insert-with-onConflictDoUpdate, then a read-back select", async () => {
    const { db, log, upserts } = makeFakeDb();
    const saved = await upsertEvaluation(db, {
      planId: "p1",
      submissionId: "s1",
      reviewerId: "r1",
      round: 1,
      scores: { crit1: 5 },
      comment: "nice",
    });

    const evalUpserts = upserts.filter((u) => u.table === schema.evaluation);
    expect(evalUpserts.length).toBe(1);
    expect(evalUpserts[0]!.target).toEqual([
      schema.evaluation.planId,
      schema.evaluation.submissionId,
      schema.evaluation.reviewerId,
      schema.evaluation.round,
    ]);

    const insertIdx = log.findIndex((e) => e.kind === "insert" && e.table === schema.evaluation);
    const selectIdxs = log
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.kind === "select" && e.table === schema.evaluation)
      .map(({ i }) => i);
    // no selects happened before the insert (the invariant is no read
    // BEFORE the write); the read-back select happens after.
    expect(selectIdxs.every((i) => i > insertIdx)).toBe(true);
    expect(selectIdxs.length).toBe(1);

    expect(saved.scores).toEqual({ crit1: 5 });
    expect(saved.comment).toBe("nice");
  });

  it("a second upsertEvaluation for the same plan+submission+reviewer+round issues a second single-statement upsert and never a SELECT before it", async () => {
    const { db, log, upserts } = makeFakeDb();
    await upsertEvaluation(db, {
      planId: "p1",
      submissionId: "s1",
      reviewerId: "r1",
      round: 1,
      scores: { crit1: 3 },
    });
    const beforeSecondInsert = log.length;
    await upsertEvaluation(db, {
      planId: "p1",
      submissionId: "s1",
      reviewerId: "r1",
      round: 1,
      scores: { crit1: 9 },
      comment: "revised",
    });

    const secondCallLog = log.slice(beforeSecondInsert);
    const secondInsertIdx = secondCallLog.findIndex((e) => e.kind === "insert" && e.table === schema.evaluation);
    const selectsBeforeSecondInsert = secondCallLog
      .slice(0, secondInsertIdx)
      .filter((e) => e.kind === "select" && e.table === schema.evaluation);
    expect(selectsBeforeSecondInsert.length).toBe(0);

    const evalUpserts = upserts.filter((u) => u.table === schema.evaluation);
    expect(evalUpserts.length).toBe(2);
    expect(evalUpserts[1]!.rows[0]!.scoresJson).toBe(JSON.stringify({ crit1: 9 }));
  });
});
