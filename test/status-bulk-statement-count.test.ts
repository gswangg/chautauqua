// DEC-355 regression: bulk-accepting many submissions at once must plan
// onboarding tasks SET-BASED — one chunked participant SELECT for all firing
// ids, one chunked existing-(contact,title) SELECT for all deduped contacts,
// planAcceptance called once, and getOrCreateTask called once per DISTINCT
// planned title — never once per submission/id. This test drives 200 firing
// submissions (well above the DEC-078 90-id chunk size) through a
// call-counting fake Db and asserts the statement count is O(ids/90 +
// distinct titles), not O(ids).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { chunkIds } from "../src/lib/chunk";


import type { Db } from "../src/server/context";

const EVENT_ID = "event-1";
const N = 200;
const IDS = Array.from({ length: N }, (_, i) => `sub-${i + 1}`);

function makeResult(rows: unknown[]) {
  return {
    limit: async (_n: number) => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
}

/**
 * Counting fake Db. Each select() is routed by which schema table it reads
 * `.from()`, with per-table call counters returning precomputed chunk
 * responses in call order (deterministic given chunkIds' fixed partitioning
 * and Set-preserved insertion order — mirrored here via the same chunkIds
 * helper the production code uses).
 */
function fakeDb() {
  const selectCalls: { table: string; joined: boolean }[] = [];
  const insertCalls: { table: string; value: unknown }[] = [];
  const updateCalls: { table: string; setValue: unknown; firing: boolean }[] = [];

  // All N submissions start 'pending' and transition to 'accepted' — every
  // one fires the acceptance planner.
  const submissionChunks = chunkIds(IDS).map((chunk) =>
    chunk.map((id) => ({ id, status: "pending", acceptedAt: null as Date | null })),
  );
  // Firing ids == IDS (all fire), in the same order → same chunk partition.
  const participantChunks = chunkIds(IDS).map((chunk) =>
    chunk.map((id) => ({ contactId: `contact-${id}`, inviteStatus: "accepted" })),
  );

  let submissionCallIdx = 0;
  let participantCallIdx = 0;
  // DEC-111 amendment (wave 48): getOrCreateTask is now insert-on-conflict-
  // do-nothing THEN select (was select-then-insert) — this fake's task
  // table select must return whatever was JUST inserted, not a canned []
  // forever, or the post-insert select finds nothing and getOrCreateTask
  // throws. Deterministic call order (one title fully resolved before the
  // next) means "the most recently inserted task row" is always the right
  // answer here.
  let lastInsertedTask: { id: string; formId: string | null } | null = null;
  // The DEC-932 back-fill's eventTaskRows read (no .limit() call, unlike
  // getOrCreateTask's post-insert select) needs every task row minted so
  // far, not just the most recent one.
  const allInsertedTasks: { id: string; formId: string | null }[] = [];
  // DEC-932 back-fill's existingPairs read ({taskId, contactId} shape) needs
  // real data once the main plan's task_assignment rows exist -- unlike the
  // main plan's OWN existingTaskTitlesByContact read ({contactId, title}
  // shape), which always runs first, while the table is still genuinely
  // empty, so it can stay canned-empty.
  const insertedAssignmentPairs: { taskId: string; contactId: string }[] = [];
  // DEC-111 amendment (wave 55): getOrCreateFormTaskForm is now insert-on-
  // conflict-do-nothing THEN select too (was select-then-insert), backed by
  // the real UNIQUE(event_id, title) index from
  // migrations/0033_form_title_unique.sql. Same fake-db consequence as the
  // wave-48 task change above: the form select must return whatever was JUST
  // inserted, or the post-insert select finds nothing and the helper throws.
  // Deterministic call order (one title fully resolved before the next) makes
  // "the most recently inserted form row" the right answer here.
  let lastInsertedForm: { id: string } | null = null;

  const db = {
    select(selection: unknown) {
      return {
        from(table: unknown) {
          let joined = false;
          const chain: any = {
            innerJoin(_joinTable: unknown) {
              joined = true;
              return chain;
            },
            where(_cond: unknown) {
              if (table === schema.submission) {
                selectCalls.push({ table: "submission", joined });
                const rows = submissionChunks[submissionCallIdx] ?? [];
                submissionCallIdx += 1;
                return makeResult(rows);
              }
              if (table === schema.participant) {
                selectCalls.push({ table: "participant", joined });
                const rows = participantChunks[participantCallIdx] ?? [];
                participantCallIdx += 1;
                return makeResult(rows);
              }
              if (table === schema.taskAssignment) {
                selectCalls.push({ table: "taskAssignment", joined });
                const isBackfillPairsRead = selection !== null && typeof selection === "object" && "taskId" in (selection as object);
                return makeResult(isBackfillPairsRead ? insertedAssignmentPairs : []);
              }
              if (table === schema.task) {
                // Two different real callers share this branch:
                //  - getOrCreateTask's post-insert select calls .limit(1)
                //    and wants the row the immediately-preceding insert()
                //    just wrote.
                //  - the DEC-932 back-fill's eventTaskRows read never calls
                //    .limit() and wants every task row minted so far.
                selectCalls.push({ table: "task", joined });
                return {
                  limit: async (_n: number) => (lastInsertedTask ? [lastInsertedTask] : []),
                  then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
                    Promise.resolve(allInsertedTasks).then(resolve, reject),
                };
              }
              if (table === schema.form) {
                // getOrCreateFormTaskForm's post-insert winner select: no
                // pre-existing forms, so the winner is always the row this
                // call's own insert just wrote.
                selectCalls.push({ table: "form", joined });
                return makeResult(lastInsertedForm ? [lastInsertedForm] : []);
              }
              if (table === schema.event) {
                // DEC-520: single event-start-date read, before the plan loop.
                selectCalls.push({ table: "event", joined });
                return makeResult([{ startDate: "2026-06-01" }]);
              }
              throw new Error("unexpected select().from() table in fake Db");
            },
          };
          return chain;
        },
      };
    },
    update(table: unknown) {
      return {
        set(setValue: unknown) {
          return {
            where: async () => {
              updateCalls.push({ table: table === schema.submission ? "submission" : "other", setValue, firing: true });
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values: (value: unknown) => {
          const name =
            table === schema.task
              ? "task"
              : table === schema.taskAssignment
                ? "task_assignment"
                : table === schema.form
                  ? "form"
                  : table === schema.formField
                    ? "form_field"
                    : "other";
          insertCalls.push({ table: name, value });
          if (table === schema.task) {
            const row = value as { id: string; formId?: string | null };
            lastInsertedTask = { id: row.id, formId: row.formId ?? null };
            allInsertedTasks.push(lastInsertedTask);
          }
          if (table === schema.form) {
            lastInsertedForm = { id: (value as { id: string }).id };
          }
          if (table === schema.taskAssignment) {
            const rows = Array.isArray(value) ? value : [value];
            for (const row of rows as { taskId: string; contactId: string }[]) {
              insertedAssignmentPairs.push({ taskId: row.taskId, contactId: row.contactId });
            }
          }
          return {
            then: (resolve: (v: unknown) => void) => resolve(undefined),
            // DEC-556: task_assignment inserts target the real (task_id,
            // contact_id) unique index; this fake db has no uniqueness of
            // its own, so onConflictDoNothing is a no-op passthrough.
            // DEC-111 amendment (wave 48): getOrCreateTask's task insert
            // also goes through onConflictDoNothing now — same no-op
            // passthrough, since this fake never models a real title
            // collision (each id here is always fresh).
            onConflictDoNothing: () => Promise.resolve(undefined),
          };
        },
      };
    },
  };

  return { db: db as unknown as Db, selectCalls, insertCalls, updateCalls };
}

describe("DEC-355 bulk accept is set-based, not per-submission", () => {
  it("issues O(ids/90) SELECTs and UPDATEs for 200 firing submissions, and plans nothing (decision 76)", async () => {
    const { db, selectCalls, insertCalls, updateCalls } = fakeDb();

    const result = await updateSubmissionStatuses(db, EVENT_ID, IDS, "accepted", new Date(5000));

    expect(result.updated).toBe(N);

    // Expected chunk counts: chunkIds(200) => 3 chunks (90, 90, 20).
    const expectedChunks = chunkIds(IDS).length;
    expect(expectedChunks).toBe(3);

    // multi-portal decision 76: acceptance creates no tasks of its own, so
    // the only reads are the chunked submission selects -- no participant,
    // task, form or task_assignment reads, and no inserts at all
    expect(selectCalls.filter((c) => c.table === "submission").length).toBe(expectedChunks);
    expect(selectCalls.length).toBe(expectedChunks);
    expect(insertCalls).toEqual([]);

    // The firing rows get one chunked UPDATE per chunk (status/acceptedAt/updatedAt).
    expect(updateCalls.length).toBe(expectedChunks);
  });
});
