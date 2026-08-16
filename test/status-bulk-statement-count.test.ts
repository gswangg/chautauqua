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
import { chunkIds, MAX_D1_BOUND_PARAMS } from "../src/lib/chunk";

// DEC-528: task_assignment inserts are chunked by bound-parameter budget
// (columns-per-row derived from the row shape: id, taskId, contactId,
// status, createdAt, updatedAt = 6 columns), not by ID_CHUNK_SIZE.
const TASK_ASSIGNMENT_ROWS_PER_CHUNK = Math.floor((MAX_D1_BOUND_PARAMS - 10) / 6);
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
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
  it("issues O(ids/90) + O(distinct titles) SELECTs for 200 firing submissions, not O(ids)", async () => {
    const { db, selectCalls, insertCalls, updateCalls } = fakeDb();

    const result = await updateSubmissionStatuses(db, EVENT_ID, IDS, "accepted", new Date(5000));

    expect(result.updated).toBe(N);

    // Expected chunk counts: chunkIds(200) => 3 chunks (90, 90, 20).
    const expectedChunks = chunkIds(IDS).length;
    expect(expectedChunks).toBe(3);

    const distinctTitles = DEFAULT_ONBOARDING_TASKS.length; // 5
    const formTitles = DEFAULT_ONBOARDING_TASKS.filter((t) => t.kind === "form").length; // 2

    const submissionSelects = selectCalls.filter((c) => c.table === "submission").length;
    const participantSelects = selectCalls.filter((c) => c.table === "participant").length;
    const taskAssignmentSelects = selectCalls.filter((c) => c.table === "taskAssignment").length;
    const taskSelects = selectCalls.filter((c) => c.table === "task").length;
    const formSelects = selectCalls.filter((c) => c.table === "form").length;

    expect(submissionSelects).toBe(expectedChunks);
    expect(participantSelects).toBe(expectedChunks);
    // DEC-932: the back-fill pass's eventTaskRows read (schema.task, no
    // .limit()) now sees every real task row getOrCreateTask minted (DEC-111
    // amendment, wave 48: getOrCreateTask is insert-then-select, and this
    // fake's schema.task branch is stateful) — so eventTaskIds has all 5
    // distinct titles' ids, and the back-fill's existing-pairs select over
    // schema.taskAssignment actually runs.
    //
    // DEC-528 amendment (wave 10, defect 1 fix): that existing-pairs query
    // binds inArray(taskId, eventTaskIds) alongside inArray(contactId,
    // contactChunk) in the SAME statement, so BOTH dimensions are now
    // chunked at PAIR_ID_CHUNK_SIZE (45, half of ID_CHUNK_SIZE's 90) instead
    // of only the contact dimension at ID_CHUNK_SIZE — with only 5 event
    // tasks (well under 45) the task dimension stays a single chunk, but the
    // contact dimension now chunks at 45 instead of 90, so the back-fill's
    // own select count is ceil(N / 45), not `expectedChunks` (ceil(N / 90)).
    const backfillPairChunks = Math.ceil(N / 45);
    expect(taskAssignmentSelects).toBe(expectedChunks + backfillPairChunks);
    expect(taskSelects).toBe(distinctTitles + 1);
    expect(formSelects).toBe(formTitles);

    const totalSelects = selectCalls.length;
    // submission + participant + taskAssignment(main, expectedChunks) +
    // taskAssignment(back-fill, backfillPairChunks), + distinctTitles + 1
    // (task) + formTitles (form) + 1 (event).
    expect(totalSelects).toBe(
      expectedChunks * 2 + expectedChunks + backfillPairChunks + distinctTitles + 1 + formTitles + 1,
    );
    // The load-bearing assertion: total SELECT count is nowhere near N (200)
    // — it is bounded by chunk count + distinct-title count, not id count.
    expect(totalSelects).toBeLessThan(31);

    // DEC-521/DEC-528: task_assignment rows are inserted via chunked
    // multi-row values(), not one insert statement per (contact, title)
    // pair — total ROW count is still N * distinctTitles, but the insert
    // CALL count is ceil(rows / TASK_ASSIGNMENT_ROWS_PER_CHUNK), chunked by
    // bound-parameter budget rather than ID_CHUNK_SIZE.
    const taskAssignmentInsertCalls = insertCalls.filter((c) => c.table === "task_assignment");
    const taskAssignmentRowCount = taskAssignmentInsertCalls.reduce(
      (sum, c) => sum + (Array.isArray(c.value) ? c.value.length : 1),
      0,
    );
    expect(taskAssignmentRowCount).toBe(N * distinctTitles);
    expect(taskAssignmentInsertCalls.length).toBe(
      Math.ceil((N * distinctTitles) / TASK_ASSIGNMENT_ROWS_PER_CHUNK),
    );

    // task: one insert per distinct title (getOrCreateTask runs once per title).
    const taskInserts = insertCalls.filter((c) => c.table === "task").length;
    expect(taskInserts).toBe(distinctTitles);

    // form: one insert per distinct form-kind title.
    const formInserts = insertCalls.filter((c) => c.table === "form").length;
    expect(formInserts).toBe(formTitles);

    // The firing rows get one chunked UPDATE per chunk (status/acceptedAt/updatedAt).
    expect(updateCalls.length).toBe(expectedChunks);
    for (const call of updateCalls) {
      expect(call.setValue).toMatchObject({ status: "accepted", acceptedAt: new Date(5000), updatedAt: new Date(5000) });
    }
  });
});
