// DEC-275 wave-51 amendment: cloneSubmission must not alias another
// submission's uploaded files. A file answer's valueJson holds the
// ORIGINAL submission's file id -- submission-delete.ts:307's cascade
// (`delete(schema.file).where(inArray(schema.file.submissionId, chunk))`)
// scopes file deletion to the submission that owns the upload, so a copied
// answer naming the original's file id becomes a dangling pointer the
// moment the original submission is deleted. This closes that trigger by
// filtering file-kind answers out of the copy instead of aliasing them.
//
// Fake-db pattern follows test/clone-participants.test.ts (no real-D1/sqlite
// harness in this repo -- DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { cloneSubmission } from "../src/server/repo/submissions/create";
import type { Db } from "../src/server/context";

function thenable<T>(rows: T[]) {
  return {
    limit(n: number) {
      return Promise.resolve(rows.slice(0, n));
    },
    then(onFulfilled: (v: T[]) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
}

interface Seed {
  submission: { id: string; eventId: string; formId: string | null; title: string; description: string | null; trackId: string | null };
  answers: Array<{ formFieldId: string; valueJson: string }>;
  fileFields: Array<{ id: string }>;
}

function fakeDb(seed: Seed) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const selectCalls: unknown[] = [];

  const db = {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond?: unknown) {
              selectCalls.push(table);
              if (table === schema.submission) return thenable([seed.submission]);
              if (table === schema.submissionTrack) return thenable([]);
              if (table === schema.submissionAnswer) return thenable(seed.answers);
              if (table === schema.participant) return thenable([]);
              if (table === schema.formField) return thenable(seed.fileFields);
              throw new Error(`fakeDb: unexpected table in select().from(): ${String(table)}`);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: unknown) {
          const rows = Array.isArray(values) ? values : [values];
          for (const row of rows) inserts.push({ table, values: row });
          return Promise.resolve(undefined);
        },
      };
    },
  };

  return { db: db as unknown as Db, inserts, selectCalls };
}

describe("DEC-275 wave-51: cloneSubmission never aliases another submission's file", () => {
  it("drops the file answer, keeps non-file answers, and reports droppedFileAnswers === 1", async () => {
    const { db, inserts } = fakeDb({
      submission: { id: "sub-1", eventId: "event-1", formId: "form-1", title: "Talk", description: "desc", trackId: null },
      answers: [
        { formFieldId: "field-file", valueJson: '"file-original-123"' },
        { formFieldId: "field-text-1", valueJson: '"answer one"' },
        { formFieldId: "field-text-2", valueJson: '"answer two"' },
      ],
      fileFields: [{ id: "field-file" }],
    });

    const result = await cloneSubmission(db, "sub-1");
    expect(result.droppedFileAnswers).toBe(1);

    const answerInserts = inserts.filter((i) => i.table === schema.submissionAnswer) as Array<{
      values: { formFieldId: string; valueJson: string };
    }>;
    expect(answerInserts).toHaveLength(2);
    expect(answerInserts.map((i) => i.values.formFieldId).sort()).toEqual(["field-text-1", "field-text-2"]);
    // No copied row's value is the original's file id.
    expect(answerInserts.some((i) => i.values.valueJson === '"file-original-123"')).toBe(false);
  });

  it("issues no formField query and returns 0 when the submission has no form (formId null)", async () => {
    const { db, inserts, selectCalls } = fakeDb({
      submission: { id: "sub-2", eventId: "event-1", formId: null, title: "Untouched", description: null, trackId: null },
      answers: [{ formFieldId: "field-x", valueJson: '"still here"' }],
      fileFields: [],
    });

    const result = await cloneSubmission(db, "sub-2");
    expect(result.droppedFileAnswers).toBe(0);
    expect(selectCalls.filter((t) => t === schema.formField)).toHaveLength(0);

    const answerInserts = inserts.filter((i) => i.table === schema.submissionAnswer);
    expect(answerInserts).toHaveLength(1);
  });

  it("returns 0 when the form has no file-kind field", async () => {
    const { db, inserts } = fakeDb({
      submission: { id: "sub-3", eventId: "event-1", formId: "form-2", title: "Talk", description: null, trackId: null },
      answers: [{ formFieldId: "field-text", valueJson: '"answer"' }],
      fileFields: [],
    });

    const result = await cloneSubmission(db, "sub-3");
    expect(result.droppedFileAnswers).toBe(0);
    const answerInserts = inserts.filter((i) => i.table === schema.submissionAnswer);
    expect(answerInserts).toHaveLength(1);
  });

  it("leaves participants and tracks unchanged (byte-identical copy semantics)", async () => {
    const { db, inserts } = fakeDb({
      submission: { id: "sub-4", eventId: "event-1", formId: "form-1", title: "Talk", description: null, trackId: null },
      answers: [{ formFieldId: "field-file", valueJson: '"file-abc"' }],
      fileFields: [{ id: "field-file" }],
    });

    await cloneSubmission(db, "sub-4");

    expect(inserts.some((i) => i.table === schema.participant)).toBe(false);
    expect(inserts.some((i) => i.table === schema.submissionTrack)).toBe(false);
  });
});
