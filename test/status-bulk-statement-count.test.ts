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
import { chunkIds, ID_CHUNK_SIZE } from "../src/lib/chunk";
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

  const db = {
    select(_selection: unknown) {
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
                // existing (contactId, title) pairs — fresh event, always empty.
                selectCalls.push({ table: "taskAssignment", joined });
                return makeResult([]);
              }
              if (table === schema.task) {
                // getOrCreateTask existence check — no pre-existing tasks.
                selectCalls.push({ table: "task", joined });
                return makeResult([]);
              }
              if (table === schema.form) {
                // getOrCreateFormTaskForm existence check — no pre-existing forms.
                selectCalls.push({ table: "form", joined });
                return makeResult([]);
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
        values: async (value: unknown) => {
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
    expect(taskAssignmentSelects).toBe(expectedChunks);
    expect(taskSelects).toBe(distinctTitles);
    expect(formSelects).toBe(formTitles);

    const totalSelects = selectCalls.length;
    // +1 for the single DEC-520 event-start-date read.
    expect(totalSelects).toBe(expectedChunks * 3 + distinctTitles + formTitles + 1);
    // The load-bearing assertion: total SELECT count is nowhere near N (200)
    // — it is bounded by chunk count + distinct-title count, not id count.
    expect(totalSelects).toBeLessThan(31);

    // DEC-521: task_assignment rows are inserted via chunked multi-row
    // values(), not one insert statement per (contact, title) pair — total
    // ROW count is still N * distinctTitles, but the insert CALL count is
    // ceil(rows / ID_CHUNK_SIZE).
    const taskAssignmentInsertCalls = insertCalls.filter((c) => c.table === "task_assignment");
    const taskAssignmentRowCount = taskAssignmentInsertCalls.reduce(
      (sum, c) => sum + (Array.isArray(c.value) ? c.value.length : 1),
      0,
    );
    expect(taskAssignmentRowCount).toBe(N * distinctTitles);
    expect(taskAssignmentInsertCalls.length).toBe(Math.ceil((N * distinctTitles) / ID_CHUNK_SIZE));

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
