// DEC-717 regression: the Sessionboard submissions importer routes every
// status write through updateSubmissionStatuses (the ONE status writer),
// never a raw column set — otherwise accepted_at stays null and the J6
// acceptance auto-creation (onboarding task assignments) never fires for an
// imported acceptance. Same table-identity-aware fake db technique as
// test/acceptance-due-dates.test.ts (real WHERE-clause filtering, unlike the
// ignore-where convention used elsewhere).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import { applySessionboardPlans } from "../src/server/repo/import/sessionboard";
import { externalRef, SESSIONBOARD_SOURCE } from "../src/domain/sessionboard";
import type { Db } from "../src/server/context";

function fakeDb(seed: {
  event: unknown[];
  submission?: unknown[];
  participant?: unknown[];
  task?: unknown[];
  taskAssignment?: unknown[];
  form?: unknown[];
  formField?: unknown[];
  contact?: unknown[];
  track?: unknown[];
}) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    participant: [...(seed.participant ?? [])] as any[],
    task: [...(seed.task ?? [])] as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    form: [...(seed.form ?? [])] as any[],
    formField: [...(seed.formField ?? [])] as any[],
    contact: [...(seed.contact ?? [])] as any[],
    track: [...(seed.track ?? [])] as any[],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.event) return state.event;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.form) return state.form;
    if (table === schema.formField) return state.formField;
    if (table === schema.contact) return state.contact;
    if (table === schema.track) return state.track;
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
        where: (cond: unknown) => {
          const write = async () => {
            const arr = stateArrayFor(table);
            if (!arr) return;
            for (const r of arr) {
              if (rowMatches(r as Record<string, unknown>, cond)) Object.assign(r, setVals as object);
            }
          };
          return {
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state };
}

const ORG_ID = "org-1";
const EVENT_ID = "event-1";
const EXTERNAL_ID = "sb-sess-1";
const REF = externalRef(SESSIONBOARD_SOURCE, EXTERNAL_ID);

describe("DEC-717: Sessionboard submissions importer routes status through updateSubmissionStatuses", () => {
  it("a status=accepted row on create leaves accepted_at non-null immediately", async () => {
    const { db, state } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: REF, values: { title: "Talk", status: "accepted" } }],
    });

    expect(result).toMatchObject({ created: 1, updated: 0, skipped: [] });
    expect(state.submission).toHaveLength(1);
    const created = state.submission[0];
    expect(created.status).toBe("accepted");
    expect(created.acceptedAt).not.toBeNull();
  });

  it("an update to status=accepted on a row with existing participants fires the J6 onboarding-task auto-creation", async () => {
    const { db, state } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });

    // First import creates the submission with no status column (planner
    // default: pending) -- gives a real, known submission id to attach a
    // participant to before the accepting import.
    await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: REF, values: { title: "Talk" } }],
    });
    const submissionId = state.submission[0].id;
    expect(state.submission[0].status).toBe("pending");
    expect(state.submission[0].acceptedAt).toBeFalsy();
    state.participant.push({ submissionId, contactId: "contact-a", inviteStatus: "none" });

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: REF, values: { title: "Talk", status: "accepted" } }],
    });

    expect(result).toMatchObject({ created: 0, updated: 1, skipped: [] });
    expect(state.submission[0].status).toBe("accepted");
    expect(state.submission[0].acceptedAt).not.toBeNull();
    expect(state.task.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
    expect(state.taskAssignment.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
    for (const assignment of state.taskAssignment) {
      expect(assignment.contactId).toBe("contact-a");
    }
  });

  it("re-importing the same external_ref is idempotent: no second task set, accepted_at unchanged", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
    });

    await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: REF, values: { title: "Talk", status: "accepted" } }],
    });
    const submissionId = state.submission[0].id;
    state.participant.push({ submissionId, contactId: "contact-a", inviteStatus: "none" });

    // A second identical import: the row now resolves via existing
    // external_ref (update branch), still carrying status=accepted --
    // changeStatus sees an already-accepted row (acceptedAt already set)
    // and does not re-fire the onboarding planner, so no duplicate task
    // assignments are created.
    const firstAcceptedAt = state.submission[0].acceptedAt;
    const before = state.taskAssignment.length;

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: REF, values: { title: "Talk", status: "accepted" } }],
    });

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(state.submission).toHaveLength(1);
    expect(state.submission[0].acceptedAt).toBe(firstAcceptedAt);
    expect(state.taskAssignment.length).toBe(before);
  });

  it("a dry run writes nothing and issues no status calls", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
    });

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: true,
      plans: [{ row: 2, externalRef: REF, values: { title: "Talk", status: "accepted" } }],
    });

    expect(result).toMatchObject({ created: 1, updated: 0, skipped: [] });
    expect(state.submission).toHaveLength(0);
    expect(state.task).toHaveLength(0);
    expect(state.taskAssignment).toHaveLength(0);
  });
});
