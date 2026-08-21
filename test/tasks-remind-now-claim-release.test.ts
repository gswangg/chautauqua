// DEC-941 (Amendment wave 22): "a claim is released only by the caller that
// still holds it" — src/server/repo/tasks/reminders.ts's mailer-failure
// release loop must condition its restoring UPDATE on the row still
// carrying THIS call's claim value (`lastRemindedAt === now`), never a bare
// `inArray(id, chunk)`. Two things this file proves, in the idiom of
// test/tasks-remind-now-mailer-failure.test.ts's fakeDb/fakeMailer
// conventions, but with a STATEFUL, condition-aware fake db (unlike that
// file's fake, which ignores the update WHERE entirely) so the release
// predicate itself is exercised, not just its call count:
//
//   (a) a failing send releases its OWN claim back to the exact pre-claim
//       lastRemindedAt — both the null and the non-null case.
//   (b) a row whose lastRemindedAt was changed by another writer BETWEEN
//       this call's claim and its release (simulating a concurrent
//       remindNow/cron tick that already delivered) is LEFT ALONE by the
//       release — the concurrent value survives, which is the double-send
//       window DEC-023's claim exists to close staying closed.
//
// The fake db below walks the real drizzle-orm SQL condition tree (and/eq/
// inArray produce nested SQL{queryChunks:[...]} objects whose leaf Param
// nodes carry the bound values) to evaluate the release WHERE against a
// live, mutable row store — see collectComparisons.
import { describe, expect, it } from "vitest";
import { remindNow } from "../src/server/repo/tasks";
import { MANUAL_DEDUPE_WINDOW_MS } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

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

const ORIGIN = "https://events.example.com";
const NOW = new Date(1_700_000_000_000);
const HOUR = 60 * 60 * 1000;

interface LiveRow {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  dueDate: Date | null;
  status: string;
  lastRemindedAt: Date | null;
  updatedAt: Date | null;
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  eventId: string;
  eventName: string;
  timezone: string;
  assignmentCreatedAt: Date;
}

type Comparison = { col: string; op: "in" | "="; val: unknown };

/** Walks a drizzle-orm SQL condition tree (built from and()/eq()/inArray())
 * collecting every (columnName, operator, value) leaf it finds, regardless
 * of and/or nesting depth. Each column node carries a `.name` (the DB column
 * name, e.g. "last_reminded_at"); the operator lives in the StringChunk
 * immediately after it (" in " or " = "); the value(s) follow as either an
 * array of Param nodes (inArray) or a single Param node (eq), each Param
 * exposing its bound value on `.value`. */
function collectComparisons(node: unknown, out: Comparison[]): void {
  if (!node || typeof node !== "object") return;
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i] as { name?: unknown; columnType?: unknown; queryChunks?: unknown[] };
    if (c && typeof c.name === "string" && typeof c.columnType === "string") {
      const opChunk = chunks[i + 1] as { value?: unknown[] } | undefined;
      const valChunk = chunks[i + 2];
      const op = Array.isArray(opChunk?.value) ? opChunk.value[0] : undefined;
      if (op === " in " && Array.isArray(valChunk)) {
        out.push({ col: c.name, op: "in", val: valChunk.map((p) => (p as { value: unknown }).value) });
      } else if (op === " = " && valChunk && typeof valChunk === "object") {
        out.push({ col: c.name, op: "=", val: (valChunk as { value: unknown }).value });
      }
    } else if (c && Array.isArray(c.queryChunks)) {
      collectComparisons(c, out);
    }
  }
}

function comparisonHolds(cmp: Comparison, row: LiveRow): boolean {
  if (cmp.col === "id") {
    if (cmp.op === "in") return (cmp.val as string[]).includes(row.assignmentId);
    return row.assignmentId === cmp.val;
  }
  if (cmp.col === "last_reminded_at") {
    const rowMs = row.lastRemindedAt ? row.lastRemindedAt.getTime() : null;
    const cmpMs = cmp.val instanceof Date ? cmp.val.getTime() : (cmp.val as number | null);
    if (cmp.op === "in") return false; // never used for this column in this code path
    return rowMs === cmpMs;
  }
  return true;
}

/** A live, mutable row store plus a condition-aware fake db: the SELECT side
 * mirrors the "grouped chain" idiom of test/tasks-remind-now-mailer-
 * failure.test.ts (computing the eligible/skipped contact split the real
 * SQL GROUP BY/HAVING would), and the UPDATE side really applies `values` to
 * only the rows the real WHERE predicate (walked via collectComparisons)
 * would have matched — so a release whose eq(lastRemindedAt, now) predicate
 * no longer holds for a row is provably a no-op on that row, not just an
 * unchecked call. */
function fakeDb(initialRows: LiveRow[]): { db: Db; liveRows: LiveRow[] } {
  const liveRows = initialRows;
  let asCallCount = 0;

  function computeEligible(): string[] {
    const seen = new Set<string>();
    const eligible: string[] = [];
    const byContact = new Map<string, LiveRow[]>();
    for (const r of liveRows) {
      if (r.status !== "pending") continue;
      const arr = byContact.get(r.contactId) ?? [];
      arr.push(r);
      byContact.set(r.contactId, arr);
    }
    for (const [contactId, rows] of byContact) {
      let maxReminded: number | null = null;
      for (const r of rows) {
        if (!r.lastRemindedAt) continue;
        const t = r.lastRemindedAt.getTime();
        if (maxReminded === null || t > maxReminded) maxReminded = t;
      }
      if (maxReminded === null || maxReminded <= NOW.getTime() - MANUAL_DEDUPE_WINDOW_MS) {
        if (!seen.has(contactId)) {
          seen.add(contactId);
          eligible.push(contactId);
        }
      }
    }
    eligible.sort();
    return eligible;
  }

  function makeChain(state: { grouped?: boolean; limited?: number; outstandingLimited?: boolean; subquery?: { kind: "eligible" | "skipped" } }): any {
    return {
      from: (table: unknown) => {
        const marker = table as { __subqueryKind?: "eligible" | "skipped" } | undefined;
        if (marker && marker.__subqueryKind) return makeChain({ subquery: { kind: marker.__subqueryKind } });
        return makeChain({});
      },
      innerJoin: () => makeChain(state),
      where: () => makeChain(state),
      groupBy: () => makeChain({ ...state, grouped: true }),
      having: () => makeChain(state),
      orderBy: () => makeChain(state),
      limit: (n: number) => {
        if (state.grouped) return makeChain({ ...state, limited: n });
        return makeChain({ ...state, outstandingLimited: true });
      },
      as: (): { __subqueryKind: "eligible" | "skipped" } => {
        asCallCount += 1;
        return { __subqueryKind: asCallCount === 1 ? "eligible" : "skipped" };
      },
      then: (resolve: (v: unknown) => void) => {
        if (state.subquery) {
          const eligible = computeEligible();
          const count = state.subquery.kind === "eligible" ? eligible.length : 0;
          resolve([{ count }]);
          return;
        }
        if (state.limited !== undefined) {
          resolve(computeEligible().slice(0, state.limited).map((contactId) => ({ contactId })));
          return;
        }
        if (state.outstandingLimited) {
          resolve(liveRows);
          return;
        }
        resolve([]);
      },
    };
  }

  const db = {
    select: () => makeChain({}),
    update: () => ({
      set: (values: { lastRemindedAt?: Date | null; updatedAt?: Date }) => ({
        where: (cond: unknown) => {
          const comparisons: Comparison[] = [];
          collectComparisons(cond, comparisons);
          const matched = liveRows.filter((row) => comparisons.every((cmp) => comparisonHolds(cmp, row)));
          for (const row of matched) {
            if ("lastRemindedAt" in values) row.lastRemindedAt = values.lastRemindedAt ?? null;
            if ("updatedAt" in values && values.updatedAt) row.updatedAt = values.updatedAt;
          }
          return {
            then: (resolve: (v: unknown) => void) => resolve(undefined),
            returning: async () => matched.map((r) => ({ id: r.assignmentId })),
          };
        },
      }),
    }),
    insert: () => ({ values: async () => {} }),
  } as unknown as Db;

  return { db, liveRows };
}

function rowFor(assignmentId: string, contactId: string, email: string, lastRemindedAt: Date | null): LiveRow {
  return {
    assignmentId,
    taskId: `task_${assignmentId}`,
    taskTitle: "Hotel stay requirement form",
    dueDate: new Date(NOW.getTime() - HOUR),
    status: "pending",
    lastRemindedAt,
    updatedAt: new Date(0),
    contactId,
    firstName: "First",
    lastName: "Last",
    email,
    eventId: "event_1",
    eventName: "DevFlow Conf 2027",
    timezone: "America/Los_Angeles",
    assignmentCreatedAt: new Date(0),
  };
}

describe("remindNow claim release predicate (DEC-941 Amendment wave 22)", () => {
  it("releases a failing send's own claim back to its exact pre-claim lastRemindedAt (null and non-null)", async () => {
    const priorStamp = new Date(NOW.getTime() - 2 * HOUR); // outside MANUAL_DEDUPE_WINDOW_MS (1h), still eligible
    const rowNull = rowFor("assign_null", "contact_null", "null@example.com", null);
    const rowPrior = rowFor("assign_prior", "contact_prior", "prior@example.com", priorStamp);
    const { db, liveRows } = fakeDb([rowNull, rowPrior]);

    const mailer: Mailer = {
      async send() {
        throw new Error("simulated provider rejection");
      },
    };

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(0);
    expect(result.failed).toHaveLength(2);

    const finalNull = liveRows.find((r) => r.assignmentId === "assign_null")!;
    const finalPrior = liveRows.find((r) => r.assignmentId === "assign_prior")!;
    // Released back to the exact pre-claim value.
    expect(finalNull.lastRemindedAt).toBeNull();
    expect(finalPrior.lastRemindedAt).toEqual(priorStamp);
    // DEC-941: the claim's updatedAt bump is NOT undone by the release — the
    // row honestly records that a write attempt happened.
    expect(finalNull.updatedAt).toEqual(NOW);
    expect(finalPrior.updatedAt).toEqual(NOW);
  });

  it("leaves a row alone on release when a concurrent writer changed lastRemindedAt after this call's claim", async () => {
    const rowConcurrent = rowFor("assign_concurrent", "contact_concurrent", "concurrent@example.com", null);
    const { db, liveRows } = fakeDb([rowConcurrent]);
    const concurrentStamp = new Date(NOW.getTime() + 5 * 60 * 1000);

    const mailer: Mailer = {
      async send() {
        // Simulate a concurrent writer (e.g. an overlapping remindNow call
        // that already delivered) stamping this row AFTER this call's claim
        // but BEFORE this call's release runs.
        const live = liveRows.find((r) => r.assignmentId === "assign_concurrent")!;
        live.lastRemindedAt = concurrentStamp;
        throw new Error("simulated provider rejection");
      },
    };

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(0);
    expect(result.failed).toHaveLength(1);

    const final = liveRows.find((r) => r.assignmentId === "assign_concurrent")!;
    // The release predicate (lastRemindedAt === this call's claim value
    // `now`) no longer holds -- the concurrent writer's stamp survives
    // untouched, which is the double-send window staying closed.
    expect(final.lastRemindedAt).toEqual(concurrentStamp);
    expect(final.lastRemindedAt).not.toBeNull();
    expect(final.lastRemindedAt?.getTime()).not.toBe(NOW.getTime());
  });
});
