// DEC-932 amendment (wave 43): activation back-fill scope was RULED
// DELIBERATE — an event task is event-wide in the model, per-contact
// assignment is ADDITIVE (it adds assignments now, it does not declare an
// audience forever), and SPEC §J6 describes the grid as per-speaker x
// per-task over the event's task set. This file is the falsifying pin the
// wave-43 DEC-932 amendment cites.
//
// test/onboarding-task-backfill.test.ts already pins: a custom task lands
// on every active participant via all three call shapes, idempotency (zero
// new rows on re-run), an already-complete assignment is never
// UPDATEd/DELETEd, and query-count scaling. This file adds the THREE
// assertions task-w43-e was scoped to that were not yet exercised anywhere:
//
//   1) a task that ALREADY had a strict-subset assignment (to some other,
//      non-participant contact) still back-fills onto a newly-active
//      contact — the organizer's earlier narrow assignment does not become
//      a permanent audience ceiling.
//   2) NEGATIVE CONTROL: a task belonging to a DIFFERENT event is never
//      assigned to this event's newly-active contact.
//   3) NEGATIVE CONTROL: a contact who is NOT an active participant of the
//      accepting submission (e.g. still 'invited', or 'declined') receives
//      nothing.
//
// Reuses the same real join/where-evaluating fake db as
// test/onboarding-task-backfill.test.ts (table-identity-aware, walks real
// drizzle SQL condition trees) rather than a "read every row" double, since
// assertion (2) specifically depends on the eventId scoping in the real
// `eq(schema.task.eventId, eventId)` WHERE clause actually filtering.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses, ensureOnboardingTasks } from "../src/server/repo/submissions";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
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

const EVENT_ID = "event-1";
const OTHER_EVENT_ID = "event-2";

function fakeDb(seed: {
  event: unknown[];
  submission: unknown[];
  participant: unknown[];
  task?: unknown[];
  taskAssignment?: unknown[];
}) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...seed.submission] as any[],
    participant: [...seed.participant] as any[],
    // DEC-746 (wave-77 amendment): default audience='everyone' for seeded
    // task rows that don't specify it, mirroring the real column default --
    // status.ts's back-fill select now filters on task.audience.
    task: (seed.task ?? []).map((t) => ({ audience: "everyone", ...(t as object) })) as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    form: [] as any[],
    formField: [] as any[],
  };

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
      values: (vals: unknown) => {
        const write = async () => {
          const rows = Array.isArray(vals) ? vals : [vals];
          const arr = stateArrayFor(table);
          // DEC-746 (wave-77 amendment): mirror the real audience='everyone'
          // column default for schema.task inserts that don't set it.
          if (arr) {
            arr.push(
              ...rows.map((r) => (table === schema.task ? { audience: "everyone", ...(r as object) } : { ...(r as object) })),
            );
          }
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          onConflictDoNothing: () => write(),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (setVals: unknown) => ({
        where: async (cond: unknown) => {
          const arr = stateArrayFor(table);
          if (!arr) return;
          for (const row of arr) {
            if (evalCond(cond, [{ table, row }])) Object.assign(row, setVals as object);
          }
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state };
}

function customTask(id: string, eventId: string, title: string) {
  return { id, eventId, title, kind: "general", required: false, formId: null };
}

describe("DEC-932 amendment (wave 43): back-fill scope — new falsifying checks", () => {
  it("a task with an existing STRICT-SUBSET assignment (to a different, non-participant contact) still back-fills onto a newly-active contact", async () => {
    const task = customTask("task-narrow", EVENT_ID, "Sign the venue waiver");
    const priorAssignment = {
      id: "assignment-prior",
      taskId: task.id,
      contactId: "contact-other-not-a-participant-here",
      status: "pending",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: [{ contactId: "contact-new", submissionId: "sub-1", inviteStatus: "none" }],
      task: [task],
      taskAssignment: [priorAssignment],
    });

    await updateSubmissionStatuses(db, EVENT_ID, ["sub-1"], "accepted", new Date(1));

    // the organizer's earlier narrow assignment is untouched...
    const prior = state.taskAssignment.find((a) => a.id === "assignment-prior");
    expect(prior).toBeDefined();
    expect(prior.contactId).toBe("contact-other-not-a-participant-here");
    // ...and the newly-active contact ALSO now holds this task, additively.
    const backfilled = state.taskAssignment.find((a) => a.taskId === task.id && a.contactId === "contact-new");
    expect(backfilled).toBeDefined();
    expect(backfilled.status).toBe("pending");
    // Both pairs coexist — a strict-subset assignment did not become a ceiling.
    expect(state.taskAssignment.filter((a) => a.taskId === task.id)).toHaveLength(2);
  });

  it("NEGATIVE CONTROL: a task belonging to a DIFFERENT event is never assigned to this event's newly-active contact", async () => {
    const thisEventTask = customTask("task-this-event", EVENT_ID, "This event's task");
    const otherEventTask = customTask("task-other-event", OTHER_EVENT_ID, "Other event's task");
    const { db, state } = fakeDb({
      event: [
        { id: EVENT_ID, startDate: "2026-06-15" },
        { id: OTHER_EVENT_ID, startDate: "2026-09-01" },
      ],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [{ contactId: "contact-new", submissionId: "sub-1", inviteStatus: "none" }],
      task: [thisEventTask, otherEventTask],
    });

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", ["contact-new"], new Date(1));

    expect(
      state.taskAssignment.some((a) => a.taskId === thisEventTask.id && a.contactId === "contact-new"),
    ).toBe(true);
    expect(
      state.taskAssignment.some((a) => a.taskId === otherEventTask.id && a.contactId === "contact-new"),
    ).toBe(false);
  });

  it("NEGATIVE CONTROL: a contact who is NOT an active participant of the accepting submission (still 'invited') receives nothing", async () => {
    const task = customTask("task-custom", EVENT_ID, "Sign the venue waiver");
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [
        { contactId: "contact-active", submissionId: "sub-1", inviteStatus: "accepted" },
        { contactId: "contact-still-invited", submissionId: "sub-1", inviteStatus: "invited" },
      ],
      task: [task],
    });

    // contactIds=null path: reads participant rows itself and filters by
    // isActiveParticipant — an 'invited' participant is not yet active.
    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", null, new Date(1));

    expect(state.taskAssignment.some((a) => a.taskId === task.id && a.contactId === "contact-active")).toBe(true);
    expect(
      state.taskAssignment.some((a) => a.taskId === task.id && a.contactId === "contact-still-invited"),
    ).toBe(false);
    // Sanity: only the default onboarding templates plus the one custom task
    // landed for the active contact, never any row for the invited one.
    expect(state.taskAssignment.filter((a) => a.contactId === "contact-still-invited")).toHaveLength(0);
    expect(state.taskAssignment.filter((a) => a.contactId === "contact-active").length).toBe(
      DEFAULT_ONBOARDING_TASKS.length + 1,
    );
  });
});
