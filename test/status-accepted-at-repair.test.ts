// DEC-009/DEC-079 wave-26 regression: changeStatus computes fireAcceptance
// (re-plan onboarding) and setsAcceptedAt (stamp accepted_at) INDEPENDENTLY.
// updateSubmissionStatuses must route rows into planIds / stampIds with two
// independent checks (not stampIds nested inside fireAcceptance) so a row
// already 'accepted' with a null accepted_at gets repaired without
// re-triggering onboarding planning, and a genuine re-accept re-plans
// without re-stamping. Uses the counting-fake-Db shape from
// test/status-bulk-statement-count.test.ts, but stateful: submissions live
// in a mutable Map so a second call against the same fake db observes the
// first call's writes (needed for the DEC-079 convergence case).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import type { Db } from "../src/server/context";

function makeResult(rows: unknown[]) {
  return {
    limit: async (_n: number) => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

interface SubRow {
  id: string;
  status: string;
  acceptedAt: Date | null;
}

/**
 * Stateful fake Db: submission rows live in a Map keyed by id and are
 * mutated in place by update(). No active participants are ever returned,
 * so planAndPersistOnboardingTasks (called when planIds is non-empty)
 * returns immediately after its own empty-array guard — this test only
 * needs to observe whether the participant SELECT fires, not the full
 * onboarding task pipeline (that is covered by
 * test/status-bulk-statement-count.test.ts).
 */
function fakeDb(initial: SubRow[]) {
  const submissions = new Map(initial.map((r) => [r.id, { ...r }]));
  const participantSelectCalls: string[][] = [];
  const submissionUpdateCalls: { ids: string[]; setValue: Record<string, unknown> }[] = [];

  const db = {
    select(_selection: unknown) {
      return {
        from(table: unknown) {
          return {
            where(cond: unknown) {
              if (table === schema.submission) {
                const ids = extractIds(cond);
                const rows = ids.map((id) => submissions.get(id)).filter((r): r is SubRow => r !== undefined);
                return makeResult(rows);
              }
              if (table === schema.participant) {
                const ids = extractIds(cond);
                participantSelectCalls.push(ids);
                // No active participants for any submission in this test.
                return makeResult([]);
              }
              throw new Error("unexpected select().from() table in fake Db");
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(setValue: Record<string, unknown>) {
          return {
            where: async (cond: unknown) => {
              if (table !== schema.submission) throw new Error("unexpected update() table");
              const ids = extractIds(cond);
              submissionUpdateCalls.push({ ids, setValue });
              for (const id of ids) {
                const row = submissions.get(id);
                if (!row) throw new Error(`update() targeted unknown id ${id}`);
                if ("status" in setValue) row.status = setValue.status as string;
                if ("acceptedAt" in setValue) row.acceptedAt = setValue.acceptedAt as Date | null;
              }
            },
          };
        },
      };
    },
    insert(_table: unknown) {
      throw new Error("insert() should not be called: no active participants in this test");
    },
  };

  return { db: db as unknown as Db, submissions, participantSelectCalls, submissionUpdateCalls };
}

// Drizzle's `and(eq(...), inArray(col, ids))` builds an opaque SQL AST —
// this fake never parses it (unlike production D1). It just needs to know
// which ids the query's `inArray(...)` targeted: the AST's `inArray` clause
// is the only place a nested queryChunks array contains more than one
// Param node directly, so "an array whose every element is a bound Param"
// uniquely identifies it (the `eq(eventId, ...)` clause binds exactly one
// Param, never inside a nested array).
function extractIds(cond: unknown): string[] {
  const results: string[] = [];
  function isParamLike(n: unknown): n is { value: string } {
    return n !== null && typeof n === "object" && "value" in n && !("queryChunks" in n);
  }
  function visit(node: unknown) {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      if (node.length > 0 && node.every(isParamLike)) {
        for (const n of node) results.push((n as { value: string }).value);
        return;
      }
      for (const n of node) visit(n);
      return;
    }
    if (typeof node === "object" && "queryChunks" in node) {
      visit((node as { queryChunks: unknown }).queryChunks);
    }
  }
  visit(cond);
  return results;
}

const EVENT_ID = "event-1";

describe("DEC-009/DEC-079 wave-26: accepted_at repair vs. re-accept vs. first accept", () => {
  it("case 1: already-accepted row with null accepted_at is stamped, not re-planned", async () => {
    const { db, submissions, participantSelectCalls } = fakeDb([
      { id: "sub-1", status: "accepted", acceptedAt: null },
    ]);

    const result = await updateSubmissionStatuses(db, EVENT_ID, ["sub-1"], "accepted", new Date(9000));

    expect(result.updated).toBe(1);
    expect(submissions.get("sub-1")).toEqual({ id: "sub-1", status: "accepted", acceptedAt: new Date(9000) });
    // No participant SELECT: this row never fires the acceptance planner.
    expect(participantSelectCalls).toEqual([]);
  });

  it("case 2: genuine re-accept plans but does not re-stamp accepted_at", async () => {
    const originalAcceptedAt = new Date(1000);
    const { db, submissions, participantSelectCalls } = fakeDb([
      { id: "sub-2", status: "declined", acceptedAt: originalAcceptedAt },
    ]);

    const result = await updateSubmissionStatuses(db, EVENT_ID, ["sub-2"], "accepted", new Date(9000));

    expect(result.updated).toBe(1);
    // fireAcceptance fires -> participant SELECT happens (the "plans" side).
    expect(participantSelectCalls).toEqual([["sub-2"]]);
    // setsAcceptedAt is false (accepted_at was already non-null) -> the
    // original stamp is preserved, not overwritten with `now`.
    expect(submissions.get("sub-2")).toEqual({ id: "sub-2", status: "accepted", acceptedAt: originalAcceptedAt });
  });

  it("case 3: first accept both plans and stamps accepted_at", async () => {
    const { db, submissions, participantSelectCalls } = fakeDb([
      { id: "sub-3", status: "pending", acceptedAt: null },
    ]);

    const result = await updateSubmissionStatuses(db, EVENT_ID, ["sub-3"], "accepted", new Date(9000));

    expect(result.updated).toBe(1);
    expect(participantSelectCalls).toEqual([["sub-3"]]);
    expect(submissions.get("sub-3")).toEqual({ id: "sub-3", status: "accepted", acceptedAt: new Date(9000) });
  });

  it("case 4 (DEC-079 convergence): re-applying the identical batch stamps nothing new and reaches the same terminal state", async () => {
    const { db, submissions, participantSelectCalls } = fakeDb([
      { id: "sub-a", status: "pending", acceptedAt: null }, // first accept
      { id: "sub-b", status: "accepted", acceptedAt: null }, // repair-only
      { id: "sub-c", status: "declined", acceptedAt: new Date(500) }, // re-accept
    ]);

    const first = await updateSubmissionStatuses(
      db,
      EVENT_ID,
      ["sub-a", "sub-b", "sub-c"],
      "accepted",
      new Date(9000),
    );
    expect(first.updated).toBe(3);

    const terminalAfterFirst = new Map(
      ["sub-a", "sub-b", "sub-c"].map((id) => [id, { ...submissions.get(id) }]),
    );
    expect(terminalAfterFirst.get("sub-a")).toEqual({ id: "sub-a", status: "accepted", acceptedAt: new Date(9000) });
    expect(terminalAfterFirst.get("sub-b")).toEqual({ id: "sub-b", status: "accepted", acceptedAt: new Date(9000) });
    expect(terminalAfterFirst.get("sub-c")).toEqual({ id: "sub-c", status: "accepted", acceptedAt: new Date(500) });

    participantSelectCalls.length = 0; // reset observation window for the retry

    const second = await updateSubmissionStatuses(
      db,
      EVENT_ID,
      ["sub-a", "sub-b", "sub-c"],
      "accepted",
      new Date(20000),
    );
    expect(second.updated).toBe(3);

    // All three rows are already 'accepted' -> fireAcceptance is false for
    // every one of them this time (DEC-278: fireAcceptance is keyed off
    // current.status !== 'accepted'), so nothing re-plans.
    expect(participantSelectCalls).toEqual([]);
    // Terminal state is identical to after the first run — no id was
    // re-stamped with the new `now` (20000).
    expect(submissions.get("sub-a")).toEqual(terminalAfterFirst.get("sub-a"));
    expect(submissions.get("sub-b")).toEqual(terminalAfterFirst.get("sub-b"));
    expect(submissions.get("sub-c")).toEqual(terminalAfterFirst.get("sub-c"));
  });
});
