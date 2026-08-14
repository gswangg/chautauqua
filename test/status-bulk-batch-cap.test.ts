// DEC-528 amendment (wave 10) regression, two defects in
// planAndPersistOnboardingTasks (src/server/repo/submissions/status.ts):
//
// 1. BIND BUDGET: the DEC-932 back-fill's existing-pairs read bound
//    inArray(taskId, eventTaskIds) (UNBOUNDED — every task row for the
//    event) alongside inArray(contactId, contactChunk) (chunked at 90) in
//    the SAME statement. An event with >=11 tasks pushed the combined bind
//    count over D1's ~100-parameter ceiling. Both dimensions must now be
//    chunked so no single statement can exceed MAX_D1_BOUND_PARAMS.
//
// 2. REFUSAL WITH NO FORWARD PATH: once the back-fill's planned insert set
//    exceeds MAX_TASK_ASSIGNMENT_WRITES, the function throws BEFORE any
//    submission status UPDATE (DEC-079) — correct, since a partial accept
//    would be worse. But the message must name a batch size the producer
//    can actually use next time, derived from the same constants, never a
//    bare internal cap number.

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { ApiError } from "../src/server/http";
import { chunkIds, MAX_D1_BOUND_PARAMS } from "../src/lib/chunk";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import { MAX_TASK_ASSIGNMENT_WRITES } from "../src/server/repo/tasks/crud";
import type { Db } from "../src/server/context";

// Intercepts every drizzle-orm inArray()/and() call made by production code
// so the test can assert on the REAL bind count of every emitted statement,
// without knowing status.ts's internal chunk-size constant. `and(...)`
// records the sum of the array lengths of any inArray(...) arguments passed
// directly to it — the exact shape of the query this defect concerns
// (`and(inArray(taskId, ...), inArray(contactId, ...))`).
const andBindSums: number[] = [];
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  const TAG = Symbol("inArrayLen");
  return {
    ...actual,
    inArray: (col: unknown, arr: unknown[]) => {
      const real = actual.inArray(col as never, arr as never[]);
      Object.assign(real as object, { [TAG]: arr.length });
      return real;
    },
    and: (...conds: unknown[]) => {
      const sum = conds.reduce((s: number, c) => {
        const len = c && typeof c === "object" ? (c as Record<symbol, unknown>)[TAG] : undefined;
        return s + (typeof len === "number" ? len : 0);
      }, 0);
      if (sum > 0) andBindSums.push(sum as number);
      return actual.and(...(conds as never[]));
    },
  };
});

const EVENT_ID = "event-1";

function makeResult(rows: unknown[]) {
  return {
    limit: async (_n: number) => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
}

/** Counting/stateful fake Db, adapted from
 * test/status-bulk-statement-count.test.ts's model, extended with
 * pre-seeded CUSTOM (non-default-title) task rows so eventTaskIds grows
 * past the 5 default onboarding titles — this is what makes the DEC-932
 * back-fill's existing-pairs query (the one with two inArray dimensions)
 * actually run with a large taskId list. */
function fakeDb(opts: { contactCount: number; customTaskCount: number }) {
  const IDS = Array.from({ length: opts.contactCount }, (_, i) => `sub-${i + 1}`);
  const selectCalls: { table: string }[] = [];
  const updateCalls: { table: string; firing: boolean }[] = [];

  const submissionChunks = chunkIds(IDS).map((chunk) =>
    chunk.map((id) => ({ id, status: "pending", acceptedAt: null as Date | null })),
  );
  const participantChunks = chunkIds(IDS).map((chunk) =>
    chunk.map((id) => ({ contactId: `contact-${id}`, inviteStatus: "accepted" })),
  );

  let submissionCallIdx = 0;
  let participantCallIdx = 0;
  let lastInsertedTask: { id: string; formId: string | null } | null = null;
  const customTasks = Array.from({ length: opts.customTaskCount }, (_, i) => ({
    id: `custom-task-${i + 1}`,
    formId: null as string | null,
  }));
  const allInsertedTasks: { id: string; formId: string | null }[] = [...customTasks];
  const insertedAssignmentPairs: { taskId: string; contactId: string }[] = [];
  let lastInsertedForm: { id: string } | null = null;

  const db = {
    select(selection: unknown) {
      return {
        from(table: unknown) {
          const chain: any = {
            innerJoin() {
              return chain;
            },
            where(_cond: unknown) {
              if (table === schema.submission) {
                selectCalls.push({ table: "submission" });
                const rows = submissionChunks[submissionCallIdx] ?? [];
                submissionCallIdx += 1;
                return makeResult(rows);
              }
              if (table === schema.participant) {
                selectCalls.push({ table: "participant" });
                const rows = participantChunks[participantCallIdx] ?? [];
                participantCallIdx += 1;
                return makeResult(rows);
              }
              if (table === schema.taskAssignment) {
                selectCalls.push({ table: "taskAssignment" });
                const isBackfillPairsRead = selection !== null && typeof selection === "object" && "taskId" in (selection as object);
                return makeResult(isBackfillPairsRead ? insertedAssignmentPairs : []);
              }
              if (table === schema.task) {
                selectCalls.push({ table: "task" });
                return {
                  limit: async (_n: number) => (lastInsertedTask ? [lastInsertedTask] : []),
                  then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
                    Promise.resolve(allInsertedTasks).then(resolve, reject),
                };
              }
              if (table === schema.form) {
                selectCalls.push({ table: "form" });
                return makeResult(lastInsertedForm ? [lastInsertedForm] : []);
              }
              if (table === schema.event) {
                selectCalls.push({ table: "event" });
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
        set(_setValue: unknown) {
          return {
            where: async () => {
              updateCalls.push({ table: table === schema.submission ? "submission" : "other", firing: true });
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values: (value: unknown) => {
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
            onConflictDoNothing: () => Promise.resolve(undefined),
          };
        },
      };
    },
  };

  return { db: db as unknown as Db, ids: IDS, selectCalls, updateCalls };
}

describe("DEC-528 amendment (wave 10): back-fill bind budget", () => {
  it("emits no statement over MAX_D1_BOUND_PARAMS binds for 12 tasks x 200+ contacts", async () => {
    andBindSums.length = 0;
    const { db, ids } = fakeDb({ contactCount: 200, customTaskCount: 7 }); // 5 default + 7 custom = 12 tasks

    const result = await updateSubmissionStatuses(db, EVENT_ID, ids, "accepted", new Date(9000));
    expect(result.updated).toBe(200);

    // The load-bearing assertion: no `and(inArray(taskId,...), inArray(contactId,...))`
    // call ever bound more parameters than D1 allows.
    expect(andBindSums.length).toBeGreaterThan(0);
    for (const sum of andBindSums) {
      expect(sum).toBeLessThanOrEqual(MAX_D1_BOUND_PARAMS);
    }
  });
});

describe("DEC-528 amendment (wave 10): over-cap refusal names a usable batch size", () => {
  it("throws before any submission UPDATE, naming both the projected count and the max batch size", async () => {
    // 6 custom tasks (11 total with the 5 defaults) x 900 contacts = 5400
    // NEW rows for custom tasks alone (defaults are already backed by the
    // main plan's own inserts, so they're excluded from missingRows).
    const customTaskCount = 6;
    const contactCount = 900;
    const { db, ids, updateCalls } = fakeDb({ contactCount, customTaskCount });

    const totalTasks = DEFAULT_ONBOARDING_TASKS.length + customTaskCount;
    const projectedMissing = customTaskCount * contactCount;
    expect(projectedMissing).toBeGreaterThan(MAX_TASK_ASSIGNMENT_WRITES);
    const expectedMaxBatch = Math.floor(MAX_TASK_ASSIGNMENT_WRITES / totalTasks);

    let caught: unknown;
    try {
      await updateSubmissionStatuses(db, EVENT_ID, ids, "accepted", new Date(9000));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiErr = caught as ApiError;
    expect(apiErr.code).toBe("invalid");
    expect(apiErr.message).toContain(String(projectedMissing));
    expect(apiErr.message).toContain(String(expectedMaxBatch));

    // No submission UPDATE ever ran — DEC-079 ordering preserved.
    expect(updateCalls.length).toBe(0);
  });
});
