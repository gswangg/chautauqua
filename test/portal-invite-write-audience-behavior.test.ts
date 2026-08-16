// DEC-317 Amendment (wave 37) behavior coverage: a speaker adds a
// co-presenter whose email matches an existing contact who HAS a portal
// account. That contact must land 'invited' (not active) until they accept.
//
// (a)/(b)/(c)/(d) are already proven GENERICALLY by existing invite-status
// coverage that this repo already has for the 'invited' state — this file
// only asserts that addCoPresenter's actual write feeds that machinery the
// same value the organizer's own add-participant path writes:
//   (a) not readable/writable through the portal while merely invited —
//       test/portal-invite-scope.test.ts's "invited participant" case.
//   (b) excluded as a comms recipient — test/comms-invite-scope.test.ts
//       proves loadComposeSubmissions' WHERE excludes 'invited'.
//   (c) excluded from onboarding-task planning while invited — reproduced
//       directly below via ensureOnboardingTasks (mirrors
//       test/onboarding-task-backfill.test.ts's fakeDb).
//   (d) sees the pending invitation — reproduced directly below via the
//       real getMyInvitations repo function.
//   (e) accept flips 'invited' -> 'accepted' and back-fills onboarding
//       tasks — covered in the SEPARATE file
//       test/portal-invite-write-audience-accept-route.test.ts (kept apart
//       because that file's vi.mock("../src/server/repo/submissions") would
//       otherwise shadow the REAL ensureOnboardingTasks this file exercises
//       directly in Part 2 — same file-splitting convention as
//       test/portal-copresenter.test.ts / test/portal-copresenter-route.test.ts).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { addCoPresenter } from "../src/server/repo/portal-edit";
import { getMyInvitations } from "../src/server/repo/portal/invitations";
import { ensureOnboardingTasks } from "../src/server/repo/submissions";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";

// ---------------------------------------------------------------------------
// Part 1: addCoPresenter (the real function) writes inviteStatus='invited'
// for a co-presenter matched to an EXISTING contact by email.
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    // DEC-558 (wave 75): findContactByEmail orders by (createdAt, id) before
    // .limit(1); a no-op for this fake, but it must exist in the chain.
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("addCoPresenter writes inviteStatus='invited' for an existing-contact match", () => {
  it("matches by case-insensitive email against a contact who already has a portal account, and lands 'invited' + visible=false", async () => {
    const existingContact = { id: "contact-existing", title: "Staff Engineer", company: "Acme" };
    let call = 0;
    const inserts: any[] = [];
    const db = {
      select: () => {
        const rows = call === 0 ? [{ count: 1 }] : [existingContact];
        call += 1;
        return makeChain(rows);
      },
      insert: () => ({
        values: (vals: unknown) => {
          inserts.push(vals);
          return { onConflictDoNothing: () => ({ returning: async () => [{ id: "participant-new" }] }) };
        },
      }),
      // DEC-725 amendment: addCoPresenter now also bumps the owning
      // submission's updated_at (submissions/touch.ts).
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as unknown as Db;

    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie.existing@example.com",
      role: "co-presenter",
    });

    expect(result.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].contactId).toBe("contact-existing");
    // The core assertion: an untrusted speaker-supplied write never mints an
    // ACTIVE grant directly — it lands 'invited', exactly like the
    // organizer's own add-participant path.
    expect(inserts[0].inviteStatus).toBe("invited");
    expect(inserts[0].visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Part 2: (c) an 'invited' participant is excluded from onboarding-task
// back-fill until they accept.
// ---------------------------------------------------------------------------

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

/** Table-identity-aware in-memory double, mirroring
 * test/onboarding-task-backfill.test.ts's fakeDb (same real join/where
 * evaluator). */
function backfillFakeDb(seed: { event: unknown[]; submission: unknown[]; participant: unknown[] }) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...seed.submission] as any[],
    participant: [...seed.participant] as any[],
    task: [] as any[],
    taskAssignment: [] as any[],
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
  function makeJoinChain(ctxLists: CtxEntry[][]) {
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
        return makeJoinChain(joined);
      },
      where: (cond: unknown) => makeJoinChain(ctxLists.filter((ctxList) => evalCond(cond, ctxList))),
      limit: (n: number) => makeJoinChain(ctxLists.slice(0, n)),
      then: (resolve: (v: unknown[]) => void) => resolve(ctxLists.map(mergeCtx)),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeJoinChain((stateArrayFor(table) ?? []).map((row) => [{ table, row }])),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const write = async () => {
          const rows = Array.isArray(vals) ? vals : [vals];
          const arr = stateArrayFor(table);
          if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
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

describe("(c) an 'invited' co-presenter gets NO onboarding tasks on acceptance", () => {
  it("ensureOnboardingTasks(contactIds=null) skips an 'invited' participant, plans for an 'accepted' one", async () => {
    const { db, state } = backfillFakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: "sub-1", eventId: EVENT_ID, status: "accepted", acceptedAt: new Date(0) }],
      participant: [
        { contactId: "ct-invited", submissionId: "sub-1", inviteStatus: "invited" },
        { contactId: "ct-accepted", submissionId: "sub-1", inviteStatus: "accepted" },
      ],
    });

    await ensureOnboardingTasks(db, EVENT_ID, "sub-1", null, new Date(1));

    expect(state.taskAssignment.some((a: any) => a.contactId === "ct-invited")).toBe(false);
    expect(state.taskAssignment.filter((a: any) => a.contactId === "ct-accepted").length).toBe(
      DEFAULT_ONBOARDING_TASKS.length,
    );
  });
});

// ---------------------------------------------------------------------------
// Part 3: (d) the named contact sees the pending invitation via the real
// getMyInvitations repo function.
// ---------------------------------------------------------------------------

describe("(d) the named contact sees a pending co-presenter invitation", () => {
  it("getMyInvitations returns the row while inviteStatus='invited'", async () => {
    const db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: async () => [
                {
                  participantId: "participant-new",
                  submissionId: "sub-1",
                  seq: 3,
                  title: "Talk title",
                  recordPrefix: "SES",
                  eventName: "Conf",
                },
              ],
            }),
          }),
        }),
      }),
    } as unknown as Db;

    const invitations = await getMyInvitations(db, "contact-existing", "org-1");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.participantId).toBe("participant-new");
    expect(invitations[0]?.title).toBe("Talk title");
  });
});

