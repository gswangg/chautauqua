// DEC-528: createTaskAssignments is the last per-row task_assignment writer
// in the product — it's now set-based (chunkRowsForInsert), and refuses an
// oversized batch (MAX_TASK_ASSIGNMENT_WRITES) BEFORE any write. Uses the
// same in-memory table-double fakeDb pattern as
// test/tasks-assign-all-accepted-invite-gate.test.ts (no real-D1 harness in
// stage 1, per DEC-266), extended so insert().values() accepts both a
// single row and an array of rows (chunkRowsForInsert emits arrays).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { createTaskAssignments, MAX_TASK_ASSIGNMENT_WRITES } from "../src/server/repo/tasks/crud";
import type { Db } from "../src/server/context";

type CtxEntry = { table: unknown; row: any };

function isColumnNode(v: unknown): v is { table: unknown; name: string } {
  return !!v && typeof v === "object" && "columnType" in (v as object);
}

function isParamNode(v: unknown): v is { value: unknown } {
  return !!v && typeof v === "object" && "encoder" in (v as object) && !("columnType" in (v as object));
}

function fieldNameForColumn(column: { table: unknown; name: string }): string {
  const table = column.table as Record<string, unknown>;
  for (const key of Object.keys(table)) {
    if (table[key] === column) return key;
  }
  throw new Error(`fakeDb: no field name found for column "${column.name}"`);
}

function getValue(column: { table: unknown; name: string }, ctx: CtxEntry[]): unknown {
  const entry = ctx.find((e) => e.table === column.table);
  if (!entry) throw new Error(`fakeDb: no row context for table of column "${column.name}"`);
  return entry.row[fieldNameForColumn(column)];
}

function stringChunkText(v: unknown): string {
  const value = (v as { value?: unknown } | undefined)?.value;
  return Array.isArray(value) ? value.join("") : String(value ?? "");
}

function evalCond(cond: any, ctx: CtxEntry[]): boolean {
  const chunks: unknown[] = cond.queryChunks;
  const colIdx = chunks.findIndex(isColumnNode);
  if (colIdx !== -1) {
    const column = chunks[colIdx] as { table: unknown; name: string };
    const opText = stringChunkText(chunks[colIdx + 1]).trim();
    const rhs = chunks[colIdx + 2];
    const leftVal = getValue(column, ctx);
    if (Array.isArray(rhs)) {
      if (opText !== "in") throw new Error(`fakeDb: unsupported operator "${opText}" with array rhs`);
      return rhs.map((p) => (p as { value: unknown }).value).includes(leftVal);
    }
    if (isParamNode(rhs)) {
      if (opText !== "=") throw new Error(`fakeDb: unsupported operator "${opText}"`);
      return leftVal === rhs.value;
    }
    throw new Error("fakeDb: unrecognized condition rhs shape");
  }
  const subConds = chunks.filter(
    (c) => c && typeof c === "object" && Array.isArray((c as { queryChunks?: unknown }).queryChunks),
  );
  if (subConds.length > 0) return subConds.every((c) => evalCond(c, ctx));
  throw new Error("fakeDb: unrecognized condition shape (no column, no sub-conditions)");
}

function fakeDb(seed: { taskAssignment?: unknown[] }) {
  const state = { taskAssignment: [...(seed.taskAssignment ?? [])] as any[] };
  const insertCalls: unknown[][] = [];

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.taskAssignment) return state.taskAssignment;
    return undefined;
  }

  function makeChain(ctxLists: CtxEntry[][]) {
    const chain: any = {
      where: (cond: unknown) => makeChain(ctxLists.filter((ctxList) => evalCond(cond, ctxList))),
      then: (resolve: (v: unknown[]) => void) => resolve(ctxLists.map((c) => c.reduce((acc, e) => ({ ...acc, ...e.row }), {}))),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain((stateArrayFor(table) ?? []).map((row) => [{ table, row }])),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const write = async () => {
          const arr = stateArrayFor(table);
          if (!arr) return;
          const rows = Array.isArray(vals) ? vals : [vals];
          insertCalls.push(rows);
          for (const row of rows) arr.push({ ...(row as object) });
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
  };
  return { db: db as unknown as Db, state, insertCalls };
}

describe("createTaskAssignments (DEC-528)", () => {
  it("inserts set-based (multiple rows per insert call), not one row at a time", async () => {
    const { db, state, insertCalls } = fakeDb({});
    const contactIds = Array.from({ length: 250 }, (_, i) => `contact-${i}`);

    await createTaskAssignments(db, "task-1", contactIds, new Date());

    expect(state.taskAssignment.length).toBe(250);
    // Set-based: far fewer insert() calls than rows (each call carries many
    // rows, chunked by bound-parameter budget rather than one per row).
    expect(insertCalls.length).toBeLessThan(contactIds.length / 2);
    expect(insertCalls.some((rows) => rows.length > 1)).toBe(true);
  });

  it("is idempotent: skips contacts that already have a task_assignment row", async () => {
    const { db, state } = fakeDb({
      taskAssignment: [
        { id: "ta-1", taskId: "task-1", contactId: "contact-0", status: "pending", createdAt: new Date(), updatedAt: new Date() },
      ],
    });

    await createTaskAssignments(db, "task-1", ["contact-0", "contact-1"], new Date());

    expect(state.taskAssignment.length).toBe(2);
    expect(state.taskAssignment.filter((r: any) => r.contactId === "contact-0").length).toBe(1);
  });

  it("throws before any write when the batch exceeds MAX_TASK_ASSIGNMENT_WRITES", async () => {
    const { db, state } = fakeDb({});
    const contactIds = Array.from({ length: MAX_TASK_ASSIGNMENT_WRITES + 1 }, (_, i) => `contact-${i}`);

    await expect(createTaskAssignments(db, "task-1", contactIds, new Date())).rejects.toThrow(
      new RegExp(String(MAX_TASK_ASSIGNMENT_WRITES)),
    );

    expect(state.taskAssignment.length).toBe(0);
  });

  it("does not throw at exactly the cap", async () => {
    const { db, state } = fakeDb({});
    const contactIds = Array.from({ length: MAX_TASK_ASSIGNMENT_WRITES }, (_, i) => `contact-${i}`);

    await createTaskAssignments(db, "task-1", contactIds, new Date());

    expect(state.taskAssignment.length).toBe(MAX_TASK_ASSIGNMENT_WRITES);
  });
});
