// DEC-694: an OPTIONAL contactIds scope on both POST
// /events/:eventId/onboarding/remind and its /preview twin, with IDENTICAL
// scoping semantics on both paths — a preview that scopes differently from
// its send is the defect this closes. Uses the same "minimal drizzle SQL
// condition evaluator" fakeDb pattern as
// test/tasks-assign-all-accepted-invite-gate.test.ts (no real-D1 harness in
// stage 1, per DEC-266), extended with update() so remindNow's
// lastRemindedAt stamp is observable too.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { previewRemindNow, remindNow } from "../src/server/repo/tasks";
import { MANUAL_DEDUPE_WINDOW_MS } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

// --- minimal drizzle SQL condition evaluator (copied convention) ---------

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

// DEC-829 (wave-59 amendment): chaseableContactExists is a raw sql`` EXISTS
// fragment with its own nested join (participant/submission), not a plain
// drizzle eq()/and() condition tree — this evaluator can't walk its ON
// clauses generically. Detected by its leading literal text and evaluated
// against `chaseable` (a callback fakeDb supplies, computed once per
// contactId from the seeded participant/submission rows) instead.
function isChaseableExistsChunks(chunks: unknown[]): boolean {
  const first = chunks[0];
  return typeof first === "object" && first !== null && stringChunkText(first).startsWith("exists (select 1 from ");
}

function evalCond(cond: any, ctx: CtxEntry[], chaseable?: (contactId: string) => boolean): boolean {
  const chunks: unknown[] = cond.queryChunks;
  if (isChaseableExistsChunks(chunks)) {
    if (!chaseable) throw new Error("fakeDb: chaseableContactExists encountered with no `chaseable` callback wired");
    const entry = ctx.find((e) => e.table === schema.taskAssignment);
    if (!entry) throw new Error("fakeDb: chaseableContactExists needs a taskAssignment row in context");
    return chaseable(entry.row.contactId as string);
  }
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
  if (subConds.length > 0) return subConds.every((c) => evalCond(c, ctx, chaseable));
  throw new Error("fakeDb: unrecognized condition shape (no column, no sub-conditions)");
}

// wave-56 amendment: remindNow/previewRemindNow now call
// listRemindableContactIds FIRST (one GROUP BY schema.taskAssignment.contactId
// / HAVING max(last_reminded_at) query for the chosen ids, plus two count(*)
// subqueries for skipped/remaining), then re-query listOutstandingForEvent
// scoped to `chosen.contactIds` (itself now carrying a trailing
// MAX_REMINDER_SCAN .limit()). This file's fixtures never set
// last_reminded_at, so the eligible/skipped split below is computed for
// real (max(lastRemindedAt) per contactId vs MANUAL_DEDUPE_WINDOW_MS of the
// caller's `now`) rather than needing to evaluate the opaque drizzle-orm
// sql`` having expression — the two count(*)-over-subquery calls are
// distinguished by call ORDER (the real code always builds eligibleGroups
// before skippedGroups), matching production's code order exactly.
type SubqueryMarker = { __subqueryKind: "eligible" | "skipped" };

function fakeDb(seed: {
  taskAssignment: any[];
  task: any[];
  event: any[];
  contact: any[];
  submission?: any[];
  participant?: any[];
}) {
  const state = {
    taskAssignment: [...seed.taskAssignment],
    task: [...seed.task],
    event: [...seed.event],
    contact: [...seed.contact],
    submission: [...(seed.submission ?? [])],
    participant: [...(seed.participant ?? [])],
  };

  // DEC-829 (wave-59 amendment): the fakeDb twin of chaseableContactExists —
  // a contact is chaseable iff it has a participant row on an accepted
  // submission of THIS event with an ACTIVE invite status ('none' or
  // 'accepted').
  function chaseable(contactId: string): boolean {
    return state.participant.some((p) => {
      if (p.contactId !== contactId) return false;
      if (p.inviteStatus !== "none" && p.inviteStatus !== "accepted") return false;
      const sub = state.submission.find((s) => s.id === p.submissionId);
      return !!sub && sub.eventId === EVENT_ID && sub.status === "accepted";
    });
  }

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.task) return state.task;
    if (table === schema.event) return state.event;
    if (table === schema.contact) return state.contact;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    return undefined;
  }

  function mergeCtx(ctx: CtxEntry[]): any {
    const merged: any = ctx.reduce((acc, e) => ({ ...acc, ...e.row }), {});
    // DEC-023 wave-47 amendment: the real listOutstandingForEvent select
    // aliases schema.taskAssignment.id AS assignmentId (distinct from the
    // merged `id`, which the taskAssignment/task/event/contact spread order
    // above resolves to contact.id) — sendReminderEmails' new claim step
    // needs the genuine assignment id to build its WHERE inArray, so this
    // one alias is threaded through explicitly rather than requiring every
    // fixture to literally carry a duplicate `assignmentId` key.
    const assignmentEntry = ctx.find((e) => e.table === schema.taskAssignment);
    if (assignmentEntry) merged.assignmentId = assignmentEntry.row.id;
    return merged;
  }

  function contactIdOf(ctxList: CtxEntry[]): string {
    const entry = ctxList.find((e) => e.table === schema.taskAssignment);
    if (!entry) throw new Error("fakeDb: no taskAssignment row context for groupBy(contactId)");
    return entry.row.contactId as string;
  }

  function lastRemindedAtOf(ctxList: CtxEntry[]): number | null {
    const entry = ctxList.find((e) => e.table === schema.taskAssignment);
    const v = entry?.row.lastRemindedAt;
    if (v === null || v === undefined) return null;
    return v instanceof Date ? v.getTime() : Number(v);
  }

  let asCallCount = 0;

  function makeChain(ctxLists: CtxEntry[][], grouped = false): any {
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
      where: (cond: unknown) => makeChain(ctxLists.filter((ctxList) => evalCond(cond, ctxList, chaseable))),
      groupBy: () => makeChain(ctxLists, true),
      having: () => chain,
      orderBy: () => chain,
      limit: (n: number) => {
        if (grouped) {
          // The eligible-contactIds "chosenRows" query — always the
          // eligibleHaving criterion in production (see file header).
          const byContact = new Map<string, CtxEntry[][]>();
          for (const ctxList of ctxLists) {
            const cId = contactIdOf(ctxList);
            const arr = byContact.get(cId) ?? [];
            arr.push(ctxList);
            byContact.set(cId, arr);
          }
          const eligible: string[] = [];
          for (const [contactId, groupRows] of byContact) {
            let maxRemindedAt: number | null = null;
            for (const ctxList of groupRows) {
              const t = lastRemindedAtOf(ctxList);
              if (t !== null && (maxRemindedAt === null || t > maxRemindedAt)) maxRemindedAt = t;
            }
            if (maxRemindedAt === null || maxRemindedAt <= NOW.getTime() - MANUAL_DEDUPE_WINDOW_MS) {
              eligible.push(contactId);
            }
          }
          eligible.sort();
          const chosen = eligible.slice(0, n).map((contactId) => ({ contactId }));
          return { then: (resolve: (v: unknown) => void) => resolve(chosen) };
        }
        // listOutstandingForEvent's MAX_REMINDER_SCAN guard limit.
        return { then: (resolve: (v: unknown[]) => void) => resolve(ctxLists.map(mergeCtx)) };
      },
      as: (): SubqueryMarker => {
        asCallCount += 1;
        return { __subqueryKind: asCallCount === 1 ? "eligible" : "skipped" };
      },
      then: (resolve: (v: unknown[]) => void) => resolve(ctxLists.map(mergeCtx)),
    };
    return chain;
  }

  function computeGroupCounts(ctxLists: CtxEntry[][]): { eligible: number; skipped: number } {
    const byContact = new Map<string, CtxEntry[][]>();
    for (const ctxList of ctxLists) {
      const cId = contactIdOf(ctxList);
      const arr = byContact.get(cId) ?? [];
      arr.push(ctxList);
      byContact.set(cId, arr);
    }
    let eligible = 0;
    let skipped = 0;
    for (const groupRows of byContact.values()) {
      let maxRemindedAt: number | null = null;
      for (const ctxList of groupRows) {
        const t = lastRemindedAtOf(ctxList);
        if (t !== null && (maxRemindedAt === null || t > maxRemindedAt)) maxRemindedAt = t;
      }
      if (maxRemindedAt === null || maxRemindedAt <= NOW.getTime() - MANUAL_DEDUPE_WINDOW_MS) eligible += 1;
      else skipped += 1;
    }
    return { eligible, skipped };
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => {
        const marker = table as SubqueryMarker | undefined;
        if (marker && marker.__subqueryKind) {
          // The subquery markers don't carry the original ctxLists, so
          // re-derive them from the FULL joined taskAssignment/task set —
          // count(*) queries have no further .where() scoping in the real
          // code either (the filter already ran inside the subquery).
          const fullJoin = (state.taskAssignment as any[])
            .map((row) => [{ table: schema.taskAssignment, row }])
            .flatMap((ctxList) => {
              const taskRows = state.task.filter((t) => t.id === ctxList[0]?.row.taskId);
              return taskRows.map((t) => [...ctxList, { table: schema.task, row: t }]);
            });
          const { eligible, skipped } = computeGroupCounts(fullJoin);
          const count = marker.__subqueryKind === "eligible" ? eligible : skipped;
          return { then: (resolve: (v: unknown) => void) => resolve([{ count }]) };
        }
        return makeChain((stateArrayFor(table) ?? []).map((row) => [{ table, row }]));
      },
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          const write = async () => {
            const arr = stateArrayFor(table) ?? [];
            const matched: any[] = [];
            for (const row of arr) {
              if (evalCond(cond, [{ table, row }])) {
                Object.assign(row, patch);
                matched.push(row);
              }
            }
            return matched;
          };
          return {
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
            returning: async (cols: { id: unknown }) => {
              const matched = await write();
              return matched.map((row) => ({ id: row.id }));
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state };
}

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function fakeMailer(): { mailer: Mailer; sendCalls: { to: { email: string } }[] } {
  const sendCalls: { to: { email: string } }[] = [];
  const mailer: Mailer = {
    async send(m) {
      sendCalls.push(m as { to: { email: string } });
    },
  };
  return { mailer, sendCalls };
}

const EVENT_ID = "event-1";
const ORIGIN = "https://events.example.com";
const NOW = new Date(1_700_000_000_000);

function eventRow() {
  return { id: EVENT_ID, name: "DevFlow Conf 2027", timezone: "America/Los_Angeles" };
}

function taskRow(id: string) {
  return { id, eventId: EVENT_ID, title: `Task ${id}`, dueDate: null };
}

function contactRow(id: string, email: string) {
  return { id, firstName: "First", lastName: id, email };
}

// DEC-801: this fakeDb's mergeCtx spreads raw joined-table rows verbatim
// (ignores the select() alias map — see makeChain/then above), so a field
// the app reads via a SELECT alias (like listOutstandingForEvent's
// `assignmentCreatedAt: schema.taskAssignment.createdAt`) only resolves
// here if the fixture literally carries that alias's key name.
function assignmentRow(id: string, taskId: string, contactId: string) {
  return { id, taskId, contactId, status: "pending", lastRemindedAt: null, assignmentCreatedAt: new Date(0) };
}

// DEC-829 (wave-59 amendment): every contact in this file's shared `seed()`
// must be chaseable (an accepted submission, invite-active participant) so
// these DEC-694 scoping tests keep exercising scope, not the chase gate —
// the chase gate itself is covered by the dedicated tests below.
function submissionRow(id: string) {
  return { id, eventId: EVENT_ID, status: "accepted" };
}

function participantRow(id: string, submissionId: string, contactId: string, inviteStatus: string) {
  return { id, submissionId, contactId, inviteStatus };
}

function seed() {
  return {
    event: [eventRow()],
    task: [taskRow("task-1"), taskRow("task-2")],
    contact: [contactRow("contact-1", "one@example.com"), contactRow("contact-2", "two@example.com")],
    taskAssignment: [
      assignmentRow("assign-1", "task-1", "contact-1"),
      assignmentRow("assign-2", "task-2", "contact-2"),
    ],
    submission: [submissionRow("submission-1"), submissionRow("submission-2")],
    participant: [
      participantRow("participant-1", "submission-1", "contact-1", "accepted"),
      participantRow("participant-2", "submission-2", "contact-2", "accepted"),
    ],
  };
}

describe("DEC-694: contactIds scoping is identical between preview and send", () => {
  it("a preview and a send issued with the same {taskIds, contactIds} address exactly the same recipient set", async () => {
    const { db: previewDb } = fakeDb(seed());
    const { db: sendDb } = fakeDb(seed());
    const { mailer, sendCalls } = fakeMailer();

    const preview = await previewRemindNow(
      previewDb,
      EVENT_ID,
      undefined,
      NOW,
      new InMemoryKV(),
      ORIGIN,
      ["contact-1"],
    );
    await remindNow(sendDb, mailer, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN, ["contact-1"]);

    expect(preview.drafts.map((d) => d.email)).toEqual(["one@example.com"]);
    expect(sendCalls.map((c) => c.to.email)).toEqual(["one@example.com"]);
  });

  it("undefined contactIds preserves today's behaviour (every outstanding contact) on both paths", async () => {
    const { db: previewDb } = fakeDb(seed());
    const { db: sendDb } = fakeDb(seed());
    const { mailer, sendCalls } = fakeMailer();

    const preview = await previewRemindNow(previewDb, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);
    await remindNow(sendDb, mailer, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(preview.drafts.map((d) => d.email).sort()).toEqual(["one@example.com", "two@example.com"]);
    expect(sendCalls.map((c) => c.to.email).sort()).toEqual(["one@example.com", "two@example.com"]);
  });

  it("contactIds and taskIds compose (AND), identically on both paths", async () => {
    const { db: previewDb } = fakeDb(seed());
    const { db: sendDb } = fakeDb(seed());
    const { mailer, sendCalls } = fakeMailer();

    // contact-1 only has task-1; scoping to task-2 excludes them entirely.
    const preview = await previewRemindNow(
      previewDb,
      EVENT_ID,
      ["task-2"],
      NOW,
      new InMemoryKV(),
      ORIGIN,
      ["contact-1"],
    );
    await remindNow(sendDb, mailer, EVENT_ID, ["task-2"], NOW, new InMemoryKV(), ORIGIN, ["contact-1"]);

    expect(preview.drafts).toEqual([]);
    expect(sendCalls).toEqual([]);
  });
});
