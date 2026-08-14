// Regression for DEC-541: submission_answer writes are one set-based,
// atomic upsert (INSERT ... ON CONFLICT DO UPDATE against the
// (submissionId, formFieldId) uniqueIndex declared at
// src/db/schema.ts:223) — never a per-field SELECT-then-UPDATE-or-INSERT
// loop. Exercises both callers: submit.ts's upsertSubmissionAnswers
// directly, and portal-edit.ts's saveSubmissionEdits (which now delegates
// to the same function instead of looping).
//
// Statement counting is the point of this file: a fake db that counts
// select()/insert() calls against schema.submissionAnswer specifically, so
// a regression back to read-then-write is caught even if the final DB state
// looks correct.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { upsertSubmissionAnswers } from "../src/server/repo/submit";
import { saveSubmissionEdits } from "../src/server/repo/portal-edit";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS } from "../src/forms/types";
import { chunkRowsForInsert } from "../src/lib/chunk";

interface UpsertCall {
  rows: Array<Record<string, unknown>>;
  target: unknown;
  set: Record<string, unknown>;
}

interface FakeDbOpts {
  submissionRows?: unknown[];
  contactRows?: unknown[];
}

function makeFakeDb(opts: FakeDbOpts = {}) {
  const answerSelects: number[] = [];
  const answerUpserts: UpsertCall[] = [];
  const otherInserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.submission) return opts.submissionRows ?? [];
    if (table === schema.contact) return opts.contactRows ?? [];
    if (table === schema.submissionAnswer) {
      answerSelects.push(1);
      return [];
    }
    // DEC-725 amendment: saveSubmissionEdits now calls
    // touchSubmissionsForContacts, whose subquery reads schema.participant
    // to resolve dependent submission ids -- this fake never seeds
    // participants, so it always resolves to none.
    if (table === schema.participant) return [];
    throw new Error("fake db: unexpected table in select");
  }

  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
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
          return chainFor(rowsFor(table));
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: () => {
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
          if (table === schema.submissionAnswer) {
            return {
              onConflictDoUpdate(opts2: { target: unknown; set: Record<string, unknown> }) {
                answerUpserts.push({ rows: asArray, target: opts2.target, set: opts2.set });
                return Promise.resolve();
              },
            };
          }
          otherInserts.push({ table, values: rows });
          return Promise.resolve();
        },
      };
    },
    delete(table: unknown) {
      return {
        where: () => Promise.resolve(),
      };
    },
  };

  return { db: db as unknown as Db, answerSelects, answerUpserts, otherInserts, updates };
}

describe("upsertSubmissionAnswers (DEC-541)", () => {
  it("empty answers is a zero-statement no-op", async () => {
    const { db, answerSelects, answerUpserts } = makeFakeDb();
    await upsertSubmissionAnswers(db, "s1", {});
    expect(answerSelects.length).toBe(0);
    expect(answerUpserts.length).toBe(0);
  });

  it("N custom answers cost ceil(N / chunk size) write statements and zero reads", async () => {
    const N = 20;
    const answers: Record<string, unknown> = {};
    for (let i = 0; i < N; i++) answers[`custom_${i}`] = `value-${i}`;
    const { db, answerSelects, answerUpserts } = makeFakeDb();
    await upsertSubmissionAnswers(db, "s1", answers);

    expect(answerSelects.length).toBe(0);

    // Ground truth for the expected chunk count, derived from the same
    // helper the implementation uses (not a hand-picked number).
    const sampleRows = Object.keys(answers).map((fieldId) => ({
      id: "x",
      submissionId: "s1",
      formFieldId: fieldId,
      valueJson: "x",
      createdAt: 0,
      updatedAt: 0,
    }));
    const expectedChunks = chunkRowsForInsert(sampleRows).length;
    expect(answerUpserts.length).toBe(expectedChunks);

    // Every row across every chunk is accounted for — no dropped rows.
    const allFieldIds = answerUpserts.flatMap((u) => u.rows.map((r) => r.formFieldId));
    expect(allFieldIds.sort()).toEqual(Object.keys(answers).sort());
  });

  it("targets the (submissionId, formFieldId) uniqueIndex and sets valueJson/updatedAt via excluded", async () => {
    const { db, answerUpserts } = makeFakeDb();
    await upsertSubmissionAnswers(db, "s1", { custom_a: "v1" });
    expect(answerUpserts.length).toBe(1);
    const call = answerUpserts[0]!;
    expect(call.target).toEqual([
      schema.submissionAnswer.submissionId,
      schema.submissionAnswer.formFieldId,
    ]);
    expect(Object.keys(call.set).sort()).toEqual(["updatedAt", "valueJson"]);
  });

  it("a re-save of the same field overwrites via the upsert set clause, never a duplicate insert", async () => {
    const { db, answerUpserts } = makeFakeDb();
    await upsertSubmissionAnswers(db, "s1", { custom_a: "first" });
    await upsertSubmissionAnswers(db, "s1", { custom_a: "second" });
    // Two upsert *statements* (two separate calls), each a single-row
    // ON CONFLICT DO UPDATE — never a read to check existence first, and
    // never two rows for the same field id.
    expect(answerUpserts.length).toBe(2);
    expect(answerUpserts[0]!.rows[0]!.valueJson).toBe(JSON.stringify("first"));
    expect(answerUpserts[1]!.rows[0]!.valueJson).toBe(JSON.stringify("second"));
  });

  it("locked session/speaker field ids never produce a submission_answer row", async () => {
    const { db, answerUpserts } = makeFakeDb();
    const answers: Record<string, unknown> = { custom_a: "kept" };
    for (const f of LOCKED_SESSION_FIELDS) answers[f] = "locked-session-value";
    for (const f of LOCKED_SPEAKER_FIELDS) answers[f] = "locked-speaker-value";
    await upsertSubmissionAnswers(db, "s1", answers);
    expect(answerUpserts.length).toBe(1);
    expect(answerUpserts[0]!.rows).toHaveLength(1);
    expect(answerUpserts[0]!.rows[0]!.formFieldId).toBe("custom_a");
  });
});

describe("saveSubmissionEdits delegates custom-answer writes to upsertSubmissionAnswers (DEC-541)", () => {
  it("issues zero submission_answer reads and one upsert statement for N custom answers", async () => {
    const { db, answerSelects, answerUpserts } = makeFakeDb({
      submissionRows: [],
      contactRows: [],
    });
    const answers: Record<string, unknown> = {
      title: "T",
      description: "D",
      custom_a: "va",
      custom_b: "vb",
      custom_c: "vc",
    };
    await saveSubmissionEdits(db, "s1", "c1", answers, null, []);

    expect(answerSelects.length).toBe(0);
    expect(answerUpserts.length).toBe(1);
    const rowFieldIds = answerUpserts[0]!.rows.map((r) => r.formFieldId).sort();
    expect(rowFieldIds).toEqual(["custom_a", "custom_b", "custom_c"]);
  });

  it("locked field ids never produce a submission_answer row from the portal-edit path either", async () => {
    const { db, answerUpserts } = makeFakeDb({ submissionRows: [], contactRows: [] });
    const answers: Record<string, unknown> = { title: "T", description: "D" };
    for (const f of LOCKED_SPEAKER_FIELDS) answers[f] = "x";
    await saveSubmissionEdits(db, "s1", "c1", answers, null, []);
    expect(answerUpserts.length).toBe(0);
  });

  it("a re-save of the same custom field via saveSubmissionEdits overwrites rather than inserting a duplicate", async () => {
    const { db, answerUpserts } = makeFakeDb({ submissionRows: [], contactRows: [] });
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D", custom_a: "first" }, null, []);
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D", custom_a: "second" }, null, []);
    expect(answerUpserts.length).toBe(2);
    expect(answerUpserts[0]!.rows[0]!.valueJson).toBe(JSON.stringify("first"));
    expect(answerUpserts[1]!.rows[0]!.valueJson).toBe(JSON.stringify("second"));
  });
});
