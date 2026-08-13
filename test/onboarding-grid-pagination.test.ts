// DEC-340: getOnboardingGrid becomes a server-paginated/filtered/searchable
// roster (superseding DEC-023's whole-event envelope). No D1 test harness
// exists in stage 1 (see test/contacts-duplicates-merge-route.test.ts), so
// this locks (a) the plumbing — page/perPage/offset math, total from the
// COUNT(*) query (contacts, never assignments), rows in the page-contact
// declared order, counts wired straight from the aggregate query untouched
// by page/filters — and (b) the generated SQL shape for every filter
// (individually and ANDed together) via drizzle's SQLiteSyncDialect, the
// same technique test/submission-seq.test.ts uses to assert SQL fragments
// without executing them.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { getOnboardingGrid, type OnboardingGridParams } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

const dialect = new SQLiteSyncDialect();

interface RecordedCall {
  fields?: unknown;
  where?: unknown;
  orderBy?: unknown;
  limit?: number;
  offset?: number;
}

/** Fake-db-queue pattern (test/contacts-duplicates-merge-route.test.ts): each
 * db.select() call is served the next queued row-set, in order; every
 * chained clause is recorded so tests can inspect the generated WHERE/LIMIT/
 * OFFSET without a real SQLite engine. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const calls: RecordedCall[] = [];
  const db = {
    select: (fields?: unknown) => {
      const current: RecordedCall = { fields };
      calls.push(current);
      const rows = selectQueue[call] ?? [];
      call += 1;
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (cond: unknown) => {
          current.where = cond;
          return chain;
        },
        orderBy: (o: unknown) => {
          current.orderBy = o;
          return chain;
        },
        limit: (n: number) => {
          current.limit = n;
          return chain;
        },
        offset: (n: number) => {
          current.offset = n;
          return chain;
        },
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
      };
      return chain;
    },
  };
  return { db: db as unknown as Db, calls };
}

function baseParams(overrides: Partial<OnboardingGridParams> = {}): OnboardingGridParams {
  return { page: 1, perPage: 50, q: null, taskId: null, status: null, overdueOnly: false, now: 1_000_000, ...overrides };
}

const TASK_ROWS = [{ id: "task-1", kind: "general", title: "Sign W9", dueDate: null, required: true }];

function contactRow(id: string, first: string, last: string) {
  return { id, firstName: first, lastName: last, email: `${first}@example.com`.toLowerCase(), company: null, userId: null };
}

// DEC-754: `speakers` is now its own event-wide accepted-roster COUNT(*)
// query (against `contact`, base predicate only), no longer read off the
// task_assignment aggregate — SPEAKERS_COUNT_ROW is that query's response,
// queued immediately before COUNTS_ROW (the last select() call).
const SPEAKERS_COUNT_ROW = [{ count: 5 }];
const COUNTS_ROW = [{ outstandingRequired: 2, overdue: 1, outstandingContacts: 3 }];

function sqlTextOf(cond: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(cond as any);
}

describe("getOnboardingGrid (DEC-340)", () => {
  it("returns an empty envelope with no per-page queries when the event has no tasks", async () => {
    const { db, calls } = fakeDb([[]]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    expect(result).toEqual({
      tasks: [],
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
    });
    expect(calls.length).toBe(1);
  });

  it("page 2 uses offset=perPage and returns rows in the page-contact declared order (disjoint from page 1's canned set)", async () => {
    const page1Contacts = [contactRow("c1", "Ada", "Lovelace"), contactRow("c2", "Grace", "Hopper")];
    const page2Contacts = [contactRow("c3", "Rosa", "Parks"), contactRow("c4", "Mae", "Jemison")];

    const { db: db1, calls: calls1 } = fakeDb([TASK_ROWS, [{ count: 4 }], page1Contacts, [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    const result1 = await getOnboardingGrid(db1, "event-1", baseParams({ page: 1, perPage: 2 }));
    expect(result1.rows.map((r) => r.contact.id)).toEqual(["c1", "c2"]);
    // contactRows is call index 2 (0=tasks, 1=count, 2=contacts page).
    expect(calls1[2]?.offset).toBe(0);
    expect(calls1[2]?.limit).toBe(2);

    const { db: db2, calls: calls2 } = fakeDb([TASK_ROWS, [{ count: 4 }], page2Contacts, [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    const result2 = await getOnboardingGrid(db2, "event-1", baseParams({ page: 2, perPage: 2 }));
    expect(result2.rows.map((r) => r.contact.id)).toEqual(["c3", "c4"]);
    expect(calls2[2]?.offset).toBe(2);
    expect(calls2[2]?.limit).toBe(2);

    // Disjoint: no id from page 1 appears in page 2.
    const page1Ids = new Set(result1.rows.map((r) => r.contact.id));
    for (const row of result2.rows) expect(page1Ids.has(row.contact.id)).toBe(false);
  });

  it("total comes from the contact COUNT(*), not the number of task_assignment cell rows", async () => {
    const contacts = [contactRow("c1", "Ada", "Lovelace")];
    // Deliberately more cell rows than contacts, to prove `total` isn't
    // derived from assignment-row count.
    const cellRows = [
      { assignmentId: "a1", taskId: "task-1", status: "pending", completedAt: null, fileId: null, lastRemindedAt: null, contactId: "c1" },
      { assignmentId: "a2", taskId: "task-2", status: "complete", completedAt: null, fileId: null, lastRemindedAt: null, contactId: "c1" },
      { assignmentId: "a3", taskId: "task-3", status: "pending", completedAt: null, fileId: null, lastRemindedAt: null, contactId: "c1" },
    ];
    const { db } = fakeDb([TASK_ROWS, [{ count: 1 }], contacts, cellRows, SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    expect(result.total).toBe(1);
    expect(result.rows[0]?.cells.length).toBe(3);
  });

  it("counts stay event-wide (identical aggregate WHERE) whether or not a filter is active", async () => {
    const { db: dbFiltered, calls: callsFiltered } = fakeDb([TASK_ROWS, [{ count: 0 }], [], [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    await getOnboardingGrid(
      dbFiltered,
      "event-1",
      baseParams({ taskId: "task-1", status: "pending", overdueOnly: true, q: "ada" }),
    );
    const { db: dbUnfiltered, calls: callsUnfiltered } = fakeDb([TASK_ROWS, [{ count: 0 }], [], [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    await getOnboardingGrid(dbUnfiltered, "event-1", baseParams());

    // Last select() call in both cases is the counts aggregate.
    const aggFiltered = callsFiltered[callsFiltered.length - 1];
    const aggUnfiltered = callsUnfiltered[callsUnfiltered.length - 1];
    expect(sqlTextOf(aggFiltered!.where).sql).toBe(sqlTextOf(aggUnfiltered!.where).sql);
    expect(sqlTextOf(aggFiltered!.where).params).toEqual(sqlTextOf(aggUnfiltered!.where).params);
  });

  it("counts come straight from the aggregate query untouched", async () => {
    // No contacts on the page, so the cellRows select is skipped entirely —
    // the counts aggregate is the 4th select() call, not the 5th.
    const { db } = fakeDb([TASK_ROWS, [{ count: 0 }], [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    expect(result.counts).toEqual({ speakers: 5, outstandingRequired: 2, overdue: 1, outstandingContacts: 3 });
  });

  it("taskId/status/overdueOnly are ANDed inside the single correlated EXISTS (DEC-312)", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, [{ count: 0 }], [], [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ taskId: "task-1", status: "pending", overdueOnly: true }));
    // contactRows where clause is call index 2.
    const { sql, params } = sqlTextOf(calls[2]!.where);
    expect(sql).toContain("exists (select 1 from");
    expect(sql).toMatch(/"task_assignment"\."task_id" = \?.*"task_assignment"\."status" = \?.*"task"\."due_date" is not null/s);
    expect(params).toContain("task-1");
    expect(params).toContain("pending");
  });

  it("q ANDs first/last/email OR-columns as an escaped LIKE, never widening a literal % or _", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, [{ count: 0 }], [], [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ q: "50%_off" }));
    const { sql, params } = sqlTextOf(calls[2]!.where);
    expect(sql).toContain("like");
    expect(sql).toContain("escape '\\'");
    // likeContains escapes % and _ to \% and \_ before wrapping in %...%.
    expect(params).toContain("%50\\%\\_off%");
  });

  it("q is ANDed with the match-exists predicate (conjunction, not OR)", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, [{ count: 0 }], [], [], SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ taskId: "task-1", q: "ada" }));
    const { sql } = sqlTextOf(calls[2]!.where);
    expect(sql).toContain("exists (select 1 from");
    expect(sql).toContain("like");
    // and(...) joins clauses with " and " at the top level.
    expect(sql.split(" and ").length).toBeGreaterThan(1);
  });

  // DEC-558: the J6 grid's task COLUMN query is now a legible total order —
  // undated tasks last, then due date ascending, then title ascending, then
  // task.id ascending — so column rendering order is stable.
  it("orders the task columns: undated last, then dueDate asc, title asc, task.id asc (DEC-558)", async () => {
    const orderByArgs: unknown[][] = [];
    let call = 0;
    // Reuses the exact response sequence from "counts come straight from
    // the aggregate query untouched" above (no contacts on the page, so
    // the cellRows select is skipped): tasks, count, contacts page (empty),
    // counts aggregate.
    const responses = [TASK_ROWS, [{ count: 0 }], [], SPEAKERS_COUNT_ROW, COUNTS_ROW];
    const db = {
      select: () => {
        const rows = responses[call] ?? [];
        call += 1;
        const chain: any = {
          from: () => chain,
          where: () => chain,
          innerJoin: () => chain,
          leftJoin: () => chain,
          limit: () => chain,
          offset: () => chain,
          groupBy: () => chain,
          orderBy: (...args: unknown[]) => {
            orderByArgs.push(args);
            return chain;
          },
          then: (resolve: (v: unknown[]) => void) => resolve(rows),
        };
        return chain;
      },
    } as unknown as Db;
    await getOnboardingGrid(db, "event-1", baseParams());
    expect(orderByArgs.length).toBeGreaterThanOrEqual(1);
    // First orderBy() call belongs to the tasks select (the only query
    // this test's fixture asserts against).
    const rendered = orderByArgs[0]!.map((clause) => sqlTextOf(clause).sql);
    expect(rendered).toEqual([
      '"task"."due_date" is null',
      '"task"."due_date" asc',
      '"task"."title" asc',
      '"task"."id" asc',
    ]);
  });
});
