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

function fakeDb(seed: { taskAssignment: any[]; task: any[]; event: any[]; contact: any[] }) {
  const state = {
    taskAssignment: [...seed.taskAssignment],
    task: [...seed.task],
    event: [...seed.event],
    contact: [...seed.contact],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.task) return state.task;
    if (table === schema.event) return state.event;
    if (table === schema.contact) return state.contact;
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
      then: (resolve: (v: unknown[]) => void) => resolve(ctxLists.map(mergeCtx)),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain((stateArrayFor(table) ?? []).map((row) => [{ table, row }])),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          const write = async () => {
            const arr = stateArrayFor(table) ?? [];
            for (const row of arr) {
              if (evalCond(cond, [{ table, row }])) Object.assign(row, patch);
            }
          };
          return { then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject) };
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

function assignmentRow(id: string, taskId: string, contactId: string) {
  return { id, taskId, contactId, status: "pending", lastRemindedAt: null };
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
