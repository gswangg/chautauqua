// DEC-932 regression: activation BACK-FILLS, it never snapshots. A CUSTOM
// task the organizer created (before or after a contact became an active
// accepted participant) must land on every currently-active participant
// contact, not just the DEFAULT_ONBOARDING_TASKS titles planAcceptance
// plans. Covers all three planAndPersistOnboardingTasks call shapes (bulk
// accept via updateSubmissionStatuses, ensureOnboardingTasks with an
// explicit contactIds list, and ensureOnboardingTasks with contactIds=null),
// idempotency (a second run writes zero new rows), that an already-complete
// assignment is never touched, and that the added back-fill pass issues a
// query count proportional to CHUNK count (DEC-078), never one query per
// contact or per task.
//
// Uses the same evalCond-based join/where evaluator as
// test/participant-invite-status-tasks.test.ts (a real drizzle SQL
// condition walker, not a "ignore WHERE" double) — required here because
// the DEFAULT_ONBOARDING_TASKS idempotency assertion depends on the first
// pass's taskAssignment/task innerJoin (matched on taskId) actually
// filtering by real title values, not on undefined fields silently
// mismatching everything.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses, ensureOnboardingTasks } from "../src/server/repo/submissions";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import { chunkIds } from "../src/lib/chunk";
import { PAIR_ID_CHUNK_SIZE } from "../src/server/repo/submissions/status";
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

/** Table-identity-aware in-memory double with a real join/where evaluator
 * (mirrors test/participant-invite-status-tasks.test.ts), plus a per-call
 * select query counter so query-count assertions can be made directly. */
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
    // task rows that don't specify it, mirroring the real column default.
    task: (seed.task ?? []).map((t) => ({ audience: "everyone", ...(t as object) })) as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    form: [] as any[],
    formField: [] as any[],
  };
  const insertCalls: { table: unknown; rowCount: number }[] = [];
  let selectQueryCount = 0;

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
      where: (cond: unknown) => {
        selectQueryCount += 1;
        return makeChain(ctxLists.filter((ctxList) => evalCond(cond, ctxList)));
      },
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
          insertCalls.push({ table, rowCount: rows.length });
          const arr = stateArrayFor(table);
          // DEC-746 (wave-77 amendment): mirrors the real DB's
          // audience='everyone' column default (src/db/schema/tasks.ts) for
          // inserts into schema.task that don't set it explicitly (e.g.
          // getOrCreateTask's default-onboarding-template path) -- without
          // this, status.ts's backfill filter (audience = DEFAULT_TASK_
          // AUDIENCE) would wrongly exclude every fake-db-seeded task row.
          if (arr) {
            arr.push(
              ...rows.map((r) => (table === schema.task ? { audience: "everyone", ...(r as object) } : { ...(r as object) })),
            );
          }
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          // DEC-556: onConflictDoNothing target is a real unique index in
          // production; this fake db has no uniqueness enforcement of its
          // own, so the caller is responsible for pre-filtering
          // already-existing pairs (which the code under test does) — this
          // is a passthrough.
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
  return { db: db as unknown as Db, state, insertCalls, queryCount: () => selectQueryCount };
}

function contactIds(n: number, prefix: string): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

function seedCustomTask(): {
  id: string;
  eventId: string;
  title: string;
  kind: string;
  required: boolean;
  formId: null;
} {
  return {
    id: "task-custom",
    eventId: EVENT_ID,
    title: "Sign the venue waiver",
    kind: "general",
    required: false,
    formId: null,
  };
}

describe("DEC-932: activation back-fills every event task onto participantContactIds", () => {
  it("a CUSTOM task created before acceptance lands on the contact via bulk accept (updateSubmissionStatuses)", async () => {
    const customTask = seedCustomTask();
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: [{ contactId: "contact-1", submissionId: "sub-1", inviteStatus: "none" }],
      task: [customTask],
    });

    await updateSubmissionStatuses(db, EVENT_ID, ["sub-1"], "accepted", new Date(1));

    const customAssignment = state.taskAssignment.find(
      (a) => a.taskId === customTask.id && a.contactId === "contact-1",
    );
    expect(customAssignment).toBeDefined();
    expect(customAssignment.status).toBe("pending");
    // Every default template also landed, alongside the custom one.
    expect(state.taskAssignment.length).toBe(DEFAULT_ONBOARDING_TASKS.length + 1);
  });

  it("a CUSTOM task lands on the contact via ensureOnboardingTasks with an explicit contactIds list", async () => {
    const customTask = seedCustomTask();
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [{ contactId: "contact-2", submissionId: "sub-1", inviteStatus: "accepted" }],
      task: [customTask],
    });

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", ["contact-2"], new Date(1));

    const customAssignment = state.taskAssignment.find(
      (a) => a.taskId === customTask.id && a.contactId === "contact-2",
    );
    expect(customAssignment).toBeDefined();
    expect(customAssignment.status).toBe("pending");
  });

  it("a CUSTOM task lands on every active participant via ensureOnboardingTasks with contactIds=null", async () => {
    const customTask = seedCustomTask();
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [
        { contactId: "contact-3", submissionId: "sub-1", inviteStatus: "none" },
        { contactId: "contact-4", submissionId: "sub-1", inviteStatus: "declined" }, // not active — skipped
      ],
      task: [customTask],
    });

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", null, new Date(1));

    expect(state.taskAssignment.some((a) => a.taskId === customTask.id && a.contactId === "contact-3")).toBe(true);
    expect(state.taskAssignment.some((a) => a.taskId === customTask.id && a.contactId === "contact-4")).toBe(false);
  });

  it("re-running is idempotent — zero new rows on the second run", async () => {
    const customTask = seedCustomTask();
    const { db, state, insertCalls } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [{ contactId: "contact-5", submissionId: "sub-1", inviteStatus: "none" }],
      task: [customTask],
    });

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", ["contact-5"], new Date(1));
    const rowCountAfterFirstRun = state.taskAssignment.length;
    expect(rowCountAfterFirstRun).toBe(DEFAULT_ONBOARDING_TASKS.length + 1);
    insertCalls.length = 0;

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", ["contact-5"], new Date(2));

    expect(state.taskAssignment.length).toBe(rowCountAfterFirstRun);
    const taskAssignmentInserts = insertCalls.filter((c) => c.table === schema.taskAssignment);
    const totalRowsInserted = taskAssignmentInserts.reduce((sum, c) => sum + c.rowCount, 0);
    expect(totalRowsInserted).toBe(0);
  });

  it("an already-complete assignment is never UPDATEd or DELETEd by the back-fill pass", async () => {
    const customTask = seedCustomTask();
    const completedAssignment = {
      id: "assignment-existing",
      taskId: customTask.id,
      contactId: "contact-6",
      status: "completed",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [{ contactId: "contact-6", submissionId: "sub-1", inviteStatus: "none" }],
      task: [customTask],
      taskAssignment: [completedAssignment],
    });

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", ["contact-6"], new Date(1));

    const row = state.taskAssignment.find((a) => a.id === "assignment-existing");
    expect(row).toBeDefined();
    expect(row.status).toBe("completed");
    // No duplicate row was created for the same (task, contact) pair either.
    expect(
      state.taskAssignment.filter((a) => a.taskId === customTask.id && a.contactId === "contact-6"),
    ).toHaveLength(1);
  });
});

function chunkCount(total: number, size: number): number {
  return Math.ceil(total / size);
}

describe("DEC-932 back-fill pass query count: no query per contact, no query per task", () => {
  it("scales the existing-pairs select by TASK CHUNK count when the event's task count grows from 1 to 300", async () => {
    async function runWithTaskCount(taskCount: number): Promise<number> {
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        id: `task-${i}`,
        eventId: EVENT_ID,
        title: `Custom task ${i}`,
        kind: "general",
        required: false,
        formId: null,
      }));
      const { db, queryCount } = fakeDb({
        event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
        submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
        participant: [{ contactId: "contact-1", submissionId: "sub-1", inviteStatus: "none" }],
        task: tasks,
      });
      await ensureOnboardingTasks(db, EVENT_ID, "sub-1", ["contact-1"], new Date(1));
      return queryCount();
    }

    const small = await runWithTaskCount(1);
    const large = await runWithTaskCount(300);
    // The event-task-id select is ONE unchunked read regardless of how many
    // task rows exist. The existing-pairs select binds BOTH id lists in the
    // same statement, so DEC-078 forces both dimensions to be chunked
    // (PAIR_ID_CHUNK_SIZE each, DEC-528 amendment wave 10): growing the task
    // roster 300x adds one query per extra TASK CHUNK (with contacts held at
    // one chunk), never one per task — 300 tasks is 299 more tasks but only
    // 6 more chunks.
    const taskChunkDelta = chunkCount(300, PAIR_ID_CHUNK_SIZE) - chunkCount(1, PAIR_ID_CHUNK_SIZE);
    expect(large - small).toBe(taskChunkDelta);
  });

  it("scales the contact-chunked existing-pairs select by chunk count (DEC-078), never one-per-contact", async () => {
    const customTask = seedCustomTask();
    async function runWithContactCount(n: number): Promise<number> {
      const contacts = contactIds(n, "contact");
      const { db, queryCount } = fakeDb({
        event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
        submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
        participant: contacts.map((c) => ({ contactId: c, submissionId: "sub-1", inviteStatus: "none" })),
        task: [customTask],
      });
      await ensureOnboardingTasks(db, EVENT_ID, "sub-1", contacts, new Date(1));
      return queryCount();
    }

    const oneContact = await runWithContactCount(1);
    const manyContacts = await runWithContactCount(300);
    // Both the first-pass existing-titles read and the DEC-932 back-fill's
    // existing-pairs read are chunked by contact — each adds exactly one
    // extra query per extra chunk (never one per extra CONTACT: 300 contacts
    // is 299 more contacts but only a handful more chunks). They chunk at
    // DIFFERENT sizes: the first pass binds one id list (ID_CHUNK_SIZE via
    // chunkIds), the back-fill's pairs read binds two in one statement so it
    // halves the budget per list (PAIR_ID_CHUNK_SIZE, DEC-528 amendment wave
    // 10). One task here means the task dimension is a single chunk.
    const titlesChunkDelta = chunkIds(contactIds(300, "contact")).length - chunkIds(contactIds(1, "contact")).length;
    const pairsChunkDelta = chunkCount(300, PAIR_ID_CHUNK_SIZE) - chunkCount(1, PAIR_ID_CHUNK_SIZE);
    expect(manyContacts - oneContact).toBe(titlesChunkDelta + pairsChunkDelta);
  });
});
