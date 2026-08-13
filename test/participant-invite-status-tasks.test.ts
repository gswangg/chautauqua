// DEC-813 (tied to DEC-278): flipping a participant to 'accepted' via the
// Speakers grid's toggleInviteStatus control (PATCH
// /submissions/:id/participants/:participantId with { inviteStatus }) must
// not leave a now-visible, now-active speaker with zero onboarding tasks
// when the submission is already 'accepted' — that's exactly the gap the
// sibling invite-a-new-participant path already closed under DEC-278.
// Mounts the real submissionsRoutes sub-app against an in-memory table
// double that evaluates real drizzle WHERE/JOIN conditions (the same
// evalCond machinery test/tasks-assign-all-accepted-invite-gate.test.ts
// uses) rather than ignoring them — this suite's idempotency assertion
// depends on getOrCreateTask's own (eventId, title) lookup actually
// filtering, or a naive "ignore WHERE" double would silently re-create
// tasks and pass for the wrong reason.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

// --- minimal drizzle SQL condition evaluator (mirrors
// test/tasks-assign-all-accepted-invite-gate.test.ts) -----------------------

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

const ORG_ID = "org-a";
const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-1";
const PARTICIPANT_ID = "p1";
const CONTACT_ID = "contact-1";

function fakeDb(seed: { submissionStatus: string; participantInviteStatus: string }) {
  const state = {
    event: [{ id: EVENT_ID, orgId: ORG_ID, startDate: "2026-06-01" }] as any[],
    submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, status: seed.submissionStatus }] as any[],
    participant: [
      {
        id: PARTICIPANT_ID,
        submissionId: SUBMISSION_ID,
        contactId: CONTACT_ID,
        role: "speaker",
        order: 0,
        visible: true,
        inviteStatus: seed.participantInviteStatus,
      },
    ] as any[],
    contact: [
      {
        id: CONTACT_ID,
        orgId: ORG_ID,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        title: null,
        company: null,
      },
    ] as any[],
    task: [] as any[],
    taskAssignment: [] as any[],
    form: [] as any[],
    formField: [] as any[],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.participant) return state.participant;
    if (table === schema.submission) return state.submission;
    if (table === schema.event) return state.event;
    if (table === schema.contact) return state.contact;
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
        const rows = Array.isArray(vals) ? vals : [vals];
        const write = async () => {
          for (const row of rows) {
            const arr = stateArrayFor(table);
            if (arr) arr.push({ ...(row as object) });
          }
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          // DEC-556: task_assignment inserts target the real (task_id,
          // contact_id) unique index; this fake db has no uniqueness
          // enforcement of its own, so onConflictDoNothing is a no-op
          // passthrough onto the same write.
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

function appWithDbAndAuth(db: Db) {
  const auth: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_ID };
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

function patchRequest(body: unknown) {
  return new Request(`http://local/api/v1/submissions/${SUBMISSION_ID}/participants/${PARTICIPANT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("DEC-813 PATCH participants/:id inviteStatus plans onboarding tasks", () => {
  it("PATCH inviteStatus->'accepted' on an 'accepted' submission creates that contact's assignments", async () => {
    const { db, state } = fakeDb({ submissionStatus: "accepted", participantInviteStatus: "invited" });
    const res = await appWithDbAndAuth(db).request(patchRequest({ inviteStatus: "accepted" }));

    expect(res.status).toBe(200);
    const assignments = state.taskAssignment.filter((a: any) => a.contactId === CONTACT_ID);
    expect(assignments.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
  });

  it("a second identical PATCH creates no additional assignments (idempotent)", async () => {
    const { db, state } = fakeDb({ submissionStatus: "accepted", participantInviteStatus: "invited" });
    const app = appWithDbAndAuth(db);

    await app.request(patchRequest({ inviteStatus: "accepted" }));
    const afterFirst = state.taskAssignment.length;
    expect(afterFirst).toBe(DEFAULT_ONBOARDING_TASKS.length);

    const res2 = await app.request(patchRequest({ inviteStatus: "accepted" }));
    expect(res2.status).toBe(200);
    expect(state.taskAssignment.length).toBe(afterFirst);
  });

  it("PATCH inviteStatus->'declined' creates no assignments", async () => {
    const { db, state } = fakeDb({ submissionStatus: "accepted", participantInviteStatus: "invited" });
    const res = await appWithDbAndAuth(db).request(patchRequest({ inviteStatus: "declined" }));

    expect(res.status).toBe(200);
    expect(state.taskAssignment.length).toBe(0);
  });

  it("PATCH inviteStatus->'accepted' on a PENDING submission creates no assignments", async () => {
    const { db, state } = fakeDb({ submissionStatus: "pending", participantInviteStatus: "invited" });
    const res = await appWithDbAndAuth(db).request(patchRequest({ inviteStatus: "accepted" }));

    expect(res.status).toBe(200);
    expect(state.taskAssignment.length).toBe(0);
  });
});
