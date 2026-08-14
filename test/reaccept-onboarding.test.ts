// DEC-278 wave-58 amendment regression: accept -> un-accept -> add a
// co-speaker -> re-accept must still plan onboarding tasks for that
// co-speaker (previously fireAcceptance only ever fired once, on the first
// entry into 'accepted', so a re-accept was a complete no-op for planning),
// while accepted_at must stay pinned to the ORIGINAL accept timestamp (never
// overwritten by the re-accept). Fake db pattern (real WHERE-condition
// introspection via rowMatches + innerJoin title lookup) modelled on
// test/acceptance-write-burst.test.ts / test/onboarding-late-participant.test.ts
// -- no real-D1 harness exists in stage 1 (DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import type { Db } from "../src/server/context";

const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-1";

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

  function makeChain(table: unknown, rows: unknown[]) {
    const chain: any = {
      innerJoin: (joinTable: unknown) => {
        // Only join shape actually used: taskAssignment innerJoin(task) for
        // planAndPersistOnboardingTasks' existing (contactId, title) select.
        if (table === schema.taskAssignment && joinTable === schema.task) {
          rows = (rows as any[]).map((a) => {
            const t = state.task.find((tk) => tk.id === a.taskId);
            return { contactId: a.contactId, title: t ? t.title : undefined, eventId: t ? t.eventId : undefined };
          });
        }
        return chain;
      },
      where: (cond: unknown) => {
        rows = (rows as any[]).filter((r) => rowMatches(r as Record<string, unknown>, cond));
        return chain;
      },
      limit: (n: number) => {
        rows = (rows as any[]).slice(0, n);
        return chain;
      },
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain(table, [...(stateArrayFor(table) ?? [])]),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        const write = async () => {
          const arr = stateArrayFor(table);
          if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
        };
        // The real DB enforces UNIQUE(event_id, title) on task/form
        // (DEC-111) and UNIQUE(task_id, contact_id) on task_assignment
        // (DEC-556) via ON CONFLICT DO NOTHING — this fake honors the same
        // constraints so a re-accept's getOrCreateTask/getOrCreateFormTaskForm
        // resolves back to the SAME original row (never minting a second
        // task/form for an already-planned title), matching real behavior.
        const writeDeduped = async () => {
          const arr = stateArrayFor(table);
          if (!arr) return;
          for (const row of rows as Record<string, unknown>[]) {
            let dup = false;
            if (table === schema.task || table === schema.form) {
              dup = arr.some((r) => r.eventId === row.eventId && r.title === row.title);
            } else if (table === schema.taskAssignment) {
              dup = arr.some((r) => r.taskId === row.taskId && r.contactId === row.contactId);
            }
            if (!dup) arr.push({ ...row });
          }
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          onConflictDoNothing: () => writeDeduped(),
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
  return { db: db as unknown as Db, state };
}

describe("DEC-278 wave-58 amendment: re-accept re-fires onboarding without re-stamping accepted_at", () => {
  it("accept -> un-accept -> add co-speaker -> re-accept plans tasks for the co-speaker and preserves the original accepted_at", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-01" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: [{ contactId: "contact-1", submissionId: SUBMISSION_ID, inviteStatus: "none" }],
    });

    // 1. Accept.
    const firstAccept = new Date(1000);
    await updateSubmissionStatuses(db, EVENT_ID, [SUBMISSION_ID], "accepted", firstAccept);
    expect(state.submission[0].status).toBe("accepted");
    expect(state.submission[0].acceptedAt).toBe(firstAccept);
    const contact1TasksAfterFirstAccept = state.taskAssignment.filter((a: any) => a.contactId === "contact-1");
    expect(contact1TasksAfterFirstAccept.length).toBe(DEFAULT_ONBOARDING_TASKS.length);

    // 2. Set back to pending. accepted_at must NOT be cleared (DEC-009).
    await updateSubmissionStatuses(db, EVENT_ID, [SUBMISSION_ID], "pending", new Date(2000));
    expect(state.submission[0].status).toBe("pending");
    expect(state.submission[0].acceptedAt).toBe(firstAccept);

    // 3. POST a second participant (co-speaker) -- default invite_status
    // 'none' is active per the DB schema default.
    state.participant.push({ contactId: "contact-2", submissionId: SUBMISSION_ID, inviteStatus: "none" });

    // 4. Re-accept.
    const secondAccept = new Date(3000);
    await updateSubmissionStatuses(db, EVENT_ID, [SUBMISSION_ID], "accepted", secondAccept);

    expect(state.submission[0].status).toBe("accepted");
    // The crux of the fix: accepted_at is still the FIRST accept's timestamp,
    // never overwritten by the re-accept.
    expect(state.submission[0].acceptedAt).toBe(firstAccept);

    // The crux of the bug: the co-speaker added while un-accepted now has
    // onboarding task_assignment rows.
    const contact2Tasks = state.taskAssignment.filter((a: any) => a.contactId === "contact-2");
    expect(contact2Tasks.length).toBeGreaterThan(0);
    expect(contact2Tasks.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
  });
});
