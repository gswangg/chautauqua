// DEC-521 regression: the acceptance write path inserts task_assignment rows
// via chunked multi-row values() (ID_CHUNK_SIZE=90), not one INSERT
// statement per (contact, task) pair, and refuses a planned set above
// MAX_ACCEPTANCE_TASK_ASSIGNMENTS BEFORE any write — never a silent slice.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { MAX_ACCEPTANCE_TASK_ASSIGNMENTS } from "../src/server/repo/submissions/status";
import { ApiError } from "../src/server/http";
import { MAX_D1_BOUND_PARAMS } from "../src/lib/chunk";

// DEC-528: task_assignment inserts are chunked by bound-parameter budget
// (columns-per-row derived from the row shape: id, taskId, contactId,
// status, createdAt, updatedAt = 6 columns), not by ID_CHUNK_SIZE (which is
// sized for one-bind-per-id inArray lists, not multi-row inserts).
const TASK_ASSIGNMENT_COLUMNS = 6;
const TASK_ASSIGNMENT_ROWS_PER_CHUNK = Math.floor((MAX_D1_BOUND_PARAMS - 10) / TASK_ASSIGNMENT_COLUMNS);
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import type { Db } from "../src/server/context";

const EVENT_ID = "event-1";

/** Table-identity-aware in-memory double (same pattern as
 * test/acceptance-due-dates.test.ts), plus an insert-call counter so tests
 * can assert on CALL count, not just total row count. */
function fakeDb(seed: { event: unknown[]; submission: unknown[]; participant: unknown[] }) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...seed.submission] as any[],
    participant: [...seed.participant] as any[],
    task: [] as any[],
    taskAssignment: [] as any[],
    form: [] as any[],
    formField: [] as any[],
  };
  const insertCalls: { table: unknown; rowCount: number }[] = [];

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.event) return state.event;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.form) return state.form;
    if (table === schema.formField) return state.formField;
    return undefined;
  }

  function snakeToCamel(s: string): string {
    return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  }
  function conditionColumnValues(cond: unknown): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    let currentCol: string | null = null;
    function walk(node: unknown, seen = new Set<unknown>(), depth = 0): void {
      if (depth > 12 || node === null || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      const n = node as Record<string, unknown>;
      if (typeof n.name === "string" && n.name.length > 0 && /^[a-z][a-z0-9_]*$/.test(n.name)) {
        currentCol = n.name;
      }
      if (n.value !== undefined && typeof n.value !== "object") {
        if (currentCol) {
          const key = snakeToCamel(currentCol);
          if (!map.has(key)) map.set(key, new Set());
          map.get(key)!.add(JSON.stringify(n.value));
        }
      }
      if (Array.isArray(n.queryChunks)) for (const c of n.queryChunks) walk(c, seen, depth + 1);
      if (Array.isArray(n.value)) for (const c of n.value) walk(c, seen, depth + 1);
    }
    walk(cond);
    return map;
  }
  function rowMatches(row: Record<string, unknown>, cond: unknown): boolean {
    const wants = conditionColumnValues(cond);
    for (const [key, allowed] of wants) {
      if (!(key in row)) continue;
      if (!allowed.has(JSON.stringify(row[key]))) return false;
    }
    return true;
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: (cond: unknown) => makeChain(rows.filter((r) => rowMatches(r as Record<string, unknown>, cond))),
      limit: (n: number) => makeChain(rows.slice(0, n)),
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const write = async () => {
          const rows = Array.isArray(vals) ? vals : [vals];
          insertCalls.push({ table, rowCount: rows.length });
          const arr = stateArrayFor(table);
          if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          // DEC-556: task_assignment inserts target the real (task_id,
          // contact_id) unique index — this fake db has no uniqueness of
          // its own, so onConflictDoNothing is a no-op passthrough onto
          // the same write.
          onConflictDoNothing: () => write(),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (setVals: unknown) => ({
        where: async () => {
          const arr = stateArrayFor(table);
          if (arr && arr[0]) Object.assign(arr[0], setVals as object);
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state, insertCalls };
}

function contactIds(n: number, prefix: string): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

describe("DEC-521 task_assignment insert is chunked, not one-per-pair", () => {
  it("issues ceil(N / rowsPerChunk) insert calls for N (contact, title) pairs", async () => {
    const contacts = contactIds(25, "contact");
    const { db, state, insertCalls } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: contacts.map((c) => ({ contactId: c, inviteStatus: "none" })),
    });

    await updateSubmissionStatuses(db, EVENT_ID, ["sub-1"], "accepted", new Date(1));

    const expectedPairs = contacts.length * DEFAULT_ONBOARDING_TASKS.length;
    expect(state.taskAssignment.length).toBe(expectedPairs);

    const taskAssignmentCalls = insertCalls.filter((c) => c.table === schema.taskAssignment);
    expect(taskAssignmentCalls.length).toBe(Math.ceil(expectedPairs / TASK_ASSIGNMENT_ROWS_PER_CHUNK));
    const totalRows = taskAssignmentCalls.reduce((sum, c) => sum + c.rowCount, 0);
    expect(totalRows).toBe(expectedPairs);
    for (const call of taskAssignmentCalls) {
      expect(call.rowCount).toBeLessThanOrEqual(TASK_ASSIGNMENT_ROWS_PER_CHUNK);
    }
  });
});

describe("DEC-521 MAX_ACCEPTANCE_TASK_ASSIGNMENTS cap refuses before any write", () => {
  it("throws ApiError('invalid') naming the cap and count, and writes zero rows, leaving the submission un-accepted", async () => {
    // MAX_ACCEPTANCE_TASK_ASSIGNMENTS / distinctTitles + 1 contacts guarantees
    // the planned set exceeds the cap by at least one full template's worth.
    const distinctTitles = DEFAULT_ONBOARDING_TASKS.length;
    const contactCount = Math.ceil(MAX_ACCEPTANCE_TASK_ASSIGNMENTS / distinctTitles) + 1;
    const contacts = contactIds(contactCount, "contact");
    const { db, state, insertCalls } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: contacts.map((c) => ({ contactId: c, inviteStatus: "none" })),
    });

    await expect(updateSubmissionStatuses(db, EVENT_ID, ["sub-1"], "accepted", new Date(1))).rejects.toMatchObject({
      code: "invalid",
    });

    try {
      await updateSubmissionStatuses(db, EVENT_ID, ["sub-1"], "accepted", new Date(1));
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.message).toContain(String(MAX_ACCEPTANCE_TASK_ASSIGNMENTS));
      expect(apiErr.message).toContain(String(contactCount * distinctTitles));
    }

    // No task_assignment (or task) rows were ever written, and the
    // submission's status never flipped to 'accepted' — DEC-079 ordering.
    expect(insertCalls.filter((c) => c.table === schema.taskAssignment)).toHaveLength(0);
    expect(insertCalls.filter((c) => c.table === schema.task)).toHaveLength(0);
    expect(state.taskAssignment.length).toBe(0);
    expect(state.submission[0].status).toBe("pending");
  });
});
