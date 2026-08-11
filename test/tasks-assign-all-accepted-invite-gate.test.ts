// DEC-283: closes the DEC-278 twin gate on the task-creation roster
// expansion. ensureOnboardingTasks (src/server/repo/submissions/status.ts)
// already filters a submission's participants through isActiveParticipant,
// but listAcceptedContactIds (src/server/repo/tasks.ts) — the function
// createTask's assignToAllAccepted expansion uses — had no such filter, so
// the first event-wide task a producer created re-added a declined/invited
// co-speaker to the onboarding grid. Uses the same in-memory table-double
// fakeDb pattern as test/onboarding-late-participant.test.ts /
// test/tasks-assign-org-scope.test.ts (no real-D1 harness in stage 1, per
// DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { createTask, listAcceptedContactIds } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

// --- minimal drizzle SQL condition evaluator ------------------------------
// This fakeDb has no real D1/SQLite behind it (DEC-266), so `.where()`
// previously ignored its condition entirely and returned every row in the
// table — any invite-status filtering had to happen in application code for
// the double to prove anything. DEC-312 pushes that filter into the SQL
// WHERE clause instead, so the double must actually evaluate the drizzle
// condition tree (eq/inArray/and, plus column-vs-column join predicates)
// against ctx rows, or this test would pass for the wrong reason.

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
    if (isColumnNode(rhs)) {
      if (opText !== "=") throw new Error(`fakeDb: unsupported column-vs-column operator "${opText}"`);
      return leftVal === getValue(rhs, ctx);
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

function fakeDb(seed: { participant?: unknown[]; submission?: unknown[]; task?: unknown[]; taskAssignment?: unknown[] }) {
  const state = {
    participant: [...(seed.participant ?? [])] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    task: [...(seed.task ?? [])] as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.participant) return state.participant;
    if (table === schema.submission) return state.submission;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    return undefined;
  }

  function mergeCtx(ctx: CtxEntry[]): any {
    return ctx.reduce((acc, e) => ({ ...acc, ...e.row }), {});
  }

  function makeChain(ctxLists: CtxEntry[][]) {
    const chain: any = {
      innerJoin: (table: unknown, cond: unknown) => {
        const rightRows = stateArrayFor(table) ?? [];
        const joined: CtxEntry[][] = [];
        for (const ctxList of ctxLists) {
          for (const row of rightRows) {
            const candidate = [...ctxList, { table, row }];
            if (evalCond(cond, candidate)) joined.push(candidate);
          }
        }
        return makeChain(joined);
      },
      where: (cond: unknown) => makeChain(ctxLists.filter((ctxList) => evalCond(cond, ctxList))),
      limit: (n: number) => makeChain(ctxLists.slice(0, n)),
      then: (resolve: (v: unknown[]) => void) => resolve(ctxLists.map(mergeCtx)),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain((stateArrayFor(table) ?? []).map((row) => [{ table, row }])),
    }),
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        const arr = stateArrayFor(table);
        if (arr) arr.push({ ...(vals as object) });
      },
    }),
  };
  return { db: db as unknown as Db, state };
}

const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-1";

function participantRow(contactId: string, inviteStatus: string) {
  return { id: `p-${contactId}`, submissionId: SUBMISSION_ID, contactId, inviteStatus };
}

function acceptedSubmission() {
  return { id: SUBMISSION_ID, eventId: EVENT_ID, status: "accepted" };
}

describe("DEC-283: listAcceptedContactIds excludes invited/declined co-speakers", () => {
  it("returns only 'none'/'accepted' contact ids, deduped and order-preserving", async () => {
    const { db } = fakeDb({
      submission: [acceptedSubmission()],
      participant: [
        participantRow("contact-none", "none"),
        participantRow("contact-accepted", "accepted"),
        participantRow("contact-invited", "invited"),
        participantRow("contact-declined", "declined"),
        // a duplicate participant row for contact-none (e.g. a second
        // submission) to prove dedup still applies after filtering.
        { id: "p-contact-none-2", submissionId: "sub-2", contactId: "contact-none", inviteStatus: "none" },
      ],
    });

    const ids = await listAcceptedContactIds(db, EVENT_ID);

    expect(ids).toEqual(["contact-none", "contact-accepted"]);
  });

  it("excludes an active-invite-status participant of a non-accepted submission (whole predicate, not just the new clause)", async () => {
    const { db } = fakeDb({
      submission: [
        acceptedSubmission(),
        { id: "sub-pending", eventId: EVENT_ID, status: "pending" },
      ],
      participant: [
        participantRow("contact-accepted", "accepted"),
        { id: "p-contact-pending", submissionId: "sub-pending", contactId: "contact-pending", inviteStatus: "none" },
      ],
    });

    const ids = await listAcceptedContactIds(db, EVENT_ID);

    expect(ids).toEqual(["contact-accepted"]);
  });

  it("createTask({assignToAllAccepted:true}) inserts task_assignment rows for exactly the active contacts", async () => {
    const { db, state } = fakeDb({
      submission: [acceptedSubmission()],
      participant: [
        participantRow("contact-none", "none"),
        participantRow("contact-accepted", "accepted"),
        participantRow("contact-invited", "invited"),
        participantRow("contact-declined", "declined"),
      ],
      task: [],
    });

    const record = await createTask(db, EVENT_ID, {
      kind: "general",
      title: "Announce participation",
      required: false,
      assignToAllAccepted: true,
    });

    expect(record.id).toBeTruthy();
    // createTask re-reads schema.task after insert; the fakeDb `from`
    // returns whatever is currently in state.task, so seed it via the
    // insert path itself (already exercised above) — assert on
    // taskAssignment instead, which is what this gate protects.
    const assignedContactIds = new Set(state.taskAssignment.map((a: any) => a.contactId));
    expect(assignedContactIds.has("contact-none")).toBe(true);
    expect(assignedContactIds.has("contact-accepted")).toBe(true);
    expect(assignedContactIds.has("contact-invited")).toBe(false);
    expect(assignedContactIds.has("contact-declined")).toBe(false);
    expect(state.taskAssignment.length).toBe(2);
  });

  it("an all-declined roster inserts zero assignments and still returns the created TaskRecord", async () => {
    const { db, state } = fakeDb({
      submission: [acceptedSubmission()],
      participant: [participantRow("contact-declined-1", "declined"), participantRow("contact-invited-1", "invited")],
      task: [],
    });

    const record = await createTask(db, EVENT_ID, {
      kind: "general",
      title: "Finalize talk description",
      required: false,
      assignToAllAccepted: true,
    });

    expect(record).toMatchObject({
      eventId: EVENT_ID,
      kind: "general",
      title: "Finalize talk description",
      required: false,
    });
    expect(state.taskAssignment.length).toBe(0);
  });
});
