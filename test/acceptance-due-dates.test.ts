// DEC-520 regression: auto-created onboarding tasks carry a due date derived
// from the event start date (a DEC-522 UTC-midnight day label), and an
// organizer's cleared due date on an already-existing task is never
// back-filled by the find-or-reuse branch.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { DEFAULT_ONBOARDING_TASKS, onboardingTaskDueDate } from "../src/domain/acceptance";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import type { Db } from "../src/server/context";

describe("DEC-520/DEC-522 onboardingTaskDueDate", () => {
  it("subtracts N days (UTC midnight) from a same-month start date", () => {
    // 2026-06-15 minus 14 days = 2026-06-01, UTC midnight.
    const due = onboardingTaskDueDate("2026-06-15", 14);
    expect(due).toBe(Date.UTC(2026, 5, 1));
  });

  it("crosses a month/year boundary", () => {
    // 2026-01-05 minus 30 days = 2025-12-06, UTC midnight.
    const due = onboardingTaskDueDate("2026-01-05", 30);
    expect(due).toBe(Date.UTC(2025, 11, 6));
  });

  it("does not clamp a due date that already lies in the past (DEC-520c)", () => {
    const due = onboardingTaskDueDate("2026-01-05", 365);
    expect(due).toBe(Date.UTC(2025, 0, 5));
    expect(due).toBeLessThan(Date.now());
  });

  it("throws naming the bad value on a non-ISO start date", () => {
    expect(() => onboardingTaskDueDate("August 5, 2026", 30)).toThrow(/August 5, 2026/);
  });

  it("throws on a malformed-but-digit-shaped date that doesn't round-trip", () => {
    expect(() => onboardingTaskDueDate("2026-02-30", 0)).toThrow(/2026-02-30/);
  });

  it("carries the canonical DEC-520 lead times per template", () => {
    const byTitle = Object.fromEntries(DEFAULT_ONBOARDING_TASKS.map((t) => [t.title, t.dueDaysBeforeEventStart]));
    expect(byTitle).toEqual({
      "Hotel stay requirement form": 30,
      "Flight reimbursement form": 30,
      "Finalize talk description": 21,
      "Finalize bio + headshot": 21,
      "Announce participation": 14,
    });
  });
});

/** Table-identity-aware in-memory double, same pattern as
 * test/onboarding-late-participant.test.ts. WHERE/JOIN conditions are
 * ignored — every table here only ever holds rows relevant to the single
 * event/submission/participants under test. */
function fakeDb(seed: {
  event: unknown[];
  submission: unknown[];
  participant: unknown[];
  task?: unknown[];
  taskAssignment?: unknown[];
  form?: unknown[];
  formField?: unknown[];
}) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...seed.submission] as any[],
    participant: [...seed.participant] as any[],
    task: [...(seed.task ?? [])] as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    form: [...(seed.form ?? [])] as any[],
    formField: [...(seed.formField ?? [])] as any[],
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

  // Real WHERE-clause filtering (unlike the ignore-where convention used by
  // most single-relevant-row fakes in this repo) — this test seeds multiple
  // task titles at once, so getOrCreateTask's (eventId, title) lookup must
  // actually filter or every distinct template would collapse onto the
  // first-inserted task row.
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
      values: async (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        const arr = stateArrayFor(table);
        if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
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

const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-1";

describe("DEC-520 acceptance write path assigns real due dates", () => {
  it("every auto-created task on accept gets a non-null due_date equal to the computed label", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: [{ contactId: "contact-a", inviteStatus: "none" }],
    });

    await updateSubmissionStatuses(db, EVENT_ID, [SUBMISSION_ID], "accepted", new Date(9999));

    expect(state.task.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
    for (const task of state.task) {
      const template = DEFAULT_ONBOARDING_TASKS.find((t) => t.title === task.title)!;
      expect(task.dueDate).toBeInstanceOf(Date);
      expect((task.dueDate as Date).getTime()).toBe(
        onboardingTaskDueDate("2026-06-15", template.dueDaysBeforeEventStart),
      );
    }
  });

  it("the reuse branch never back-fills an existing task's due date", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, status: "pending", acceptedAt: null }],
      participant: [{ contactId: "contact-a", inviteStatus: "none" }],
      task: [
        {
          id: "task-existing",
          eventId: EVENT_ID,
          title: "Hotel stay requirement form",
          kind: "form",
          required: true,
          formId: "form-existing",
          dueDate: null, // organizer cleared it — a legal choice (DEC-520d).
        },
      ],
    });

    await updateSubmissionStatuses(db, EVENT_ID, [SUBMISSION_ID], "accepted", new Date(9999));

    const hotelTask = state.task.find((t: any) => t.title === "Hotel stay requirement form");
    expect(hotelTask.dueDate).toBeNull();
  });
});
