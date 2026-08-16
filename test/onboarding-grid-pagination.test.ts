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
        // DEC-829 wave-29: totalRows/contactRows/speakersCountRows now
        // GROUP BY contact.id (driving relation is participant/submission,
        // never `contact` alone) -- the fake chain just needs to keep
        // returning `chain` so `.groupBy(...).orderBy(...)` still resolves.
        groupBy: () => chain,
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
  return {
    id,
    firstName: first,
    lastName: last,
    email: `${first}@example.com`.toLowerCase(),
    company: null,
    userId: null,
  };
}

// DEC-936: the event lookup (recordPrefix, for formatRef) and the ONE
// grouped participations query -- fixtures for tests with a non-empty
// contacts page must supply both so the roster row's fail-loudly
// empty-participations check doesn't trip on unrelated fixtures.
// DEC-801 (wave 58 amendment): the event row is now resolved ONCE, up
// front (never a second query), so every fixture needing a non-empty tasks
// select must also supply this as the SECOND select() response — it carries
// both recordPrefix (DEC-936) and timezone (DEC-801) from that one row.
//
// DEC-370 (wave-62 amendment): getOnboardingGrid now issues its 9
// db.select() calls in three concurrent waves rather than one sequential
// chain, so the call-order-based fakeDb queue below is ordered
// 0=tasks, 1=event, 2=speakersCount, 3=counts, 4=totalCount, 5=contactsPage,
// 6=overdueCount, 7=participations, 8=cells (participations/cells skipped
// when the contacts page is empty; cells also skipped when there are no
// tasks) -- see getOnboardingGrid's WAVE 1/2/3 comments.
const EVENT_ROW = [{ recordPrefix: "SES", timezone: "America/New_York" }];

function participationRow(contactId: string, seq = 1, overrides: Partial<{ participantId: string; submissionId: string; submissionTitle: string; inviteStatus: string }> = {}) {
  return {
    contactId,
    participantId: overrides.participantId ?? `participant-${contactId}-${seq}`,
    submissionId: overrides.submissionId ?? `submission-${contactId}-${seq}`,
    submissionSeq: seq,
    submissionTitle: overrides.submissionTitle ?? `Talk ${seq}`,
    inviteStatus: overrides.inviteStatus ?? "accepted",
  };
}

// DEC-754: `speakers` is now its own event-wide accepted-roster COUNT(*)
// query (against `contact`, base predicate only), no longer read off the
// task_assignment aggregate. DEC-370 (wave-62): SPEAKERS_COUNT_ROW/
// COUNTS_ROW both compose no timezone/whereExpr, so they join WAVE 1
// (queued right after EVENT_ROW, at call indices 2/3).
const SPEAKERS_COUNT_ROW = [{ count: 5 }];
const COUNTS_ROW = [{ outstandingRequired: 2, outstandingContacts: 3 }];
// DEC-776: `overdue` is its own query (composed from
// overdueAssignmentConditions, joined through `contact` for the roster
// predicate) — needs whereExpr/timezone, so it joins WAVE 2 (queued right
// after the contacts page, at call index 6).
const OVERDUE_COUNT_ROW = [{ count: 1 }];

function sqlTextOf(cond: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(cond as any);
}

describe("getOnboardingGrid (DEC-340)", () => {
  // DEC-370 (wave-62 amendment): the missing-event throw is evaluated right
  // after WAVE 1 resolves (taskRows/eventRows/speakersCountRows/countsRow
  // all issued concurrently) -- it must still fire even though eventRows is
  // no longer the sole query in that wave, and it must fire BEFORE any
  // WAVE 2 query (which needs eventRows' timezone) is ever issued.
  it("throws when the event row is missing (recordPrefix/timezone unresolved), never reaching WAVE 2", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, [] /* eventRows: no matching event */, SPEAKERS_COUNT_ROW, COUNTS_ROW]);
    await expect(getOnboardingGrid(db, "event-404", baseParams())).rejects.toThrow(
      "onboarding grid: event event-404 has no record prefix/timezone",
    );
    // Only WAVE 1's four selects were ever issued.
    expect(calls.length).toBe(4);
  });

  // DEC-829 (wave-59 amendment): a zero-task event must NOT short-circuit --
  // the roster (rows/total/counts.speakers) is driven by
  // rosterParticipantConditions alone, independent of whether any task rows
  // exist. With no contacts on the roster either, this is still an empty
  // envelope, but it's reached by running every query (cellRows is the only
  // one skipped, guarded by taskIds.length > 0), not by an early return.
  it("returns an empty envelope by running every query (not an early return) when the event has no tasks", async () => {
    const { db, calls } = fakeDb([[], EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    expect(result).toEqual({
      tasks: [],
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      counts: { speakers: 5, outstandingRequired: 2, overdue: 1, outstandingContacts: 3 },
      timezone: "America/New_York",
    });
    expect(calls.length).toBe(7);
  });

  it("page 2 uses offset=perPage and returns rows in the page-contact declared order (disjoint from page 1's canned set)", async () => {
    const page1Contacts = [contactRow("c1", "Ada", "Lovelace"), contactRow("c2", "Grace", "Hopper")];
    const page2Contacts = [contactRow("c3", "Rosa", "Parks"), contactRow("c4", "Mae", "Jemison")];

    const page1Participations = [participationRow("c1"), participationRow("c2")];
    const page2Participations = [participationRow("c3"), participationRow("c4")];

    const { db: db1, calls: calls1 } = fakeDb([
      TASK_ROWS,
      EVENT_ROW,
      SPEAKERS_COUNT_ROW,
      COUNTS_ROW,
      [{ count: 4 }],
      page1Contacts,
      OVERDUE_COUNT_ROW,
      page1Participations,
      [],
    ]);
    const result1 = await getOnboardingGrid(db1, "event-1", baseParams({ page: 1, perPage: 2 }));
    expect(result1.rows.map((r) => r.contact.id)).toEqual(["c1", "c2"]);
    // contactRows is call index 5 (0=tasks, 1=event, 2=speakers, 3=counts, 4=count, 5=contacts page).
    expect(calls1[5]?.offset).toBe(0);
    expect(calls1[5]?.limit).toBe(2);

    const { db: db2, calls: calls2 } = fakeDb([
      TASK_ROWS,
      EVENT_ROW,
      SPEAKERS_COUNT_ROW,
      COUNTS_ROW,
      [{ count: 4 }],
      page2Contacts,
      OVERDUE_COUNT_ROW,
      page2Participations,
      [],
    ]);
    const result2 = await getOnboardingGrid(db2, "event-1", baseParams({ page: 2, perPage: 2 }));
    expect(result2.rows.map((r) => r.contact.id)).toEqual(["c3", "c4"]);
    expect(calls2[5]?.offset).toBe(2);
    expect(calls2[5]?.limit).toBe(2);

    // Disjoint: no id from page 1 appears in page 2.
    const page1Ids = new Set(result1.rows.map((r) => r.contact.id));
    for (const row of result2.rows) expect(page1Ids.has(row.contact.id)).toBe(false);
  });

  it("total comes from the contact COUNT(*), not the number of task_assignment cell rows", async () => {
    const contacts = [contactRow("c1", "Ada", "Lovelace")];
    // Deliberately more cell rows than contacts, to prove `total` isn't
    // derived from assignment-row count.
    const cellRows = [
      { assignmentId: "a1", taskId: "task-1", status: "pending", completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, contactId: "c1", createdAt: new Date(500_000) },
      { assignmentId: "a2", taskId: "task-2", status: "complete", completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, contactId: "c1", createdAt: new Date(500_000) },
      { assignmentId: "a3", taskId: "task-3", status: "pending", completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, contactId: "c1", createdAt: new Date(500_000) },
    ];
    const { db } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 1 }], contacts, OVERDUE_COUNT_ROW, [participationRow("c1")], cellRows]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    expect(result.total).toBe(1);
    expect(result.rows[0]?.cells.length).toBe(3);
  });

  it("counts stay event-wide (identical aggregate WHERE) whether or not a filter is active", async () => {
    const { db: dbFiltered, calls: callsFiltered } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    await getOnboardingGrid(
      dbFiltered,
      "event-1",
      baseParams({ taskId: "task-1", status: "pending", overdueOnly: true, q: "ada" }),
    );
    const { db: dbUnfiltered, calls: callsUnfiltered } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    await getOnboardingGrid(dbUnfiltered, "event-1", baseParams());

    // Last select() call in both cases is the counts aggregate.
    const aggFiltered = callsFiltered[callsFiltered.length - 1];
    const aggUnfiltered = callsUnfiltered[callsUnfiltered.length - 1];
    expect(sqlTextOf(aggFiltered!.where).sql).toBe(sqlTextOf(aggUnfiltered!.where).sql);
    expect(sqlTextOf(aggFiltered!.where).params).toEqual(sqlTextOf(aggUnfiltered!.where).params);
  });

  it("counts come straight from the aggregate query untouched", async () => {
    // No contacts on the page, so the cellRows select is skipped entirely —
    // COUNTS_ROW is served at call index 3 (0=tasks, 1=event, 2=speakers,
    // 3=counts, 4=count, 5=contacts, 6=overdue).
    const { db } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    expect(result.counts).toEqual({ speakers: 5, outstandingRequired: 2, overdue: 1, outstandingContacts: 3 });
  });

  // DEC-776: counts.overdue is computed by the ONE overdue predicate
  // (overdueAssignmentConditions), joined through `contact` for the roster
  // check -- the last select() call's WHERE must be textually identical to
  // calling that function directly, proving the grid can't drift from the
  // overview card's same-predicate count.
  it("counts.overdue's query composes overdueAssignmentConditions verbatim (DEC-776)", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ now: 42_000 }));
    const overdueCall = calls[calls.length - 1];
    const { overdueAssignmentConditions } = await import("../src/server/repo/tasks/crud");
    const expected = sqlTextOf(overdueAssignmentConditions("event-1", 42_000, "America/New_York"));
    const actual = sqlTextOf(overdueCall!.where);
    expect(actual.sql).toBe(expected.sql);
    expect(actual.params).toEqual(expected.params);
  });

  it("taskId/status/overdueOnly are ANDed inside the single correlated EXISTS (DEC-312)", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ taskId: "task-1", status: "pending", overdueOnly: true }));
    // contactRows where clause is call index 5 (0=tasks, 1=event, 2=speakers, 3=counts, 4=count, 5=contacts).
    const { sql, params } = sqlTextOf(calls[5]!.where);
    expect(sql).toContain("exists (select 1 from");
    expect(sql).toMatch(/"task_assignment"\."task_id" = \?.*"task_assignment"\."status" = \?.*"task"\."due_date" is not null/s);
    expect(params).toContain("task-1");
    expect(params).toContain("pending");
  });

  it("q ANDs first/last/email OR-columns as an escaped LIKE, never widening a literal % or _", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ q: "50%_off" }));
    const { sql, params } = sqlTextOf(calls[5]!.where);
    expect(sql).toContain("like");
    expect(sql).toContain("escape '\\'");
    // likeContains escapes % and _ to \% and \_ before wrapping in %...%.
    expect(params).toContain("%50\\%\\_off%");
  });

  it("q is ANDed with the match-exists predicate (conjunction, not OR)", async () => {
    const { db, calls } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW]);
    await getOnboardingGrid(db, "event-1", baseParams({ taskId: "task-1", q: "ada" }));
    const { sql } = sqlTextOf(calls[5]!.where);
    expect(sql).toContain("exists (select 1 from");
    expect(sql).toContain("like");
    // and(...) joins clauses with " and " at the top level.
    expect(sql.split(" and ").length).toBeGreaterThan(1);
  });

  // DEC-920: the cells select joins schema.file so the grid can name the
  // file, not just flag its presence -- filename/size come back on the same
  // cellRows call, and a cell with no fileId carries null for both.
  it("cells carry the joined filename/size for an assignment with a file, and null for one without (DEC-920)", async () => {
    const contacts = [contactRow("c1", "Ada", "Lovelace")];
    const cellRows = [
      {
        assignmentId: "a1",
        taskId: "task-1",
        status: "complete",
        completedAt: null,
        fileId: "file-1",
        fileName: "slides.pdf",
        fileSizeBytes: 2048,
        lastRemindedAt: null,
        contactId: "c1",
        createdAt: new Date(500_000),
      },
      {
        assignmentId: "a2",
        taskId: "task-2",
        status: "pending",
        completedAt: null,
        fileId: null,
        fileName: null,
        fileSizeBytes: null,
        lastRemindedAt: null,
        contactId: "c1",
        createdAt: new Date(500_000),
      },
    ];
    const { db } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 1 }], contacts, OVERDUE_COUNT_ROW, [participationRow("c1")], cellRows]);
    const result = await getOnboardingGrid(db, "event-1", baseParams());
    const cellWithFile = result.rows[0]!.cells.find((c) => c.assignmentId === "a1");
    const cellWithoutFile = result.rows[0]!.cells.find((c) => c.assignmentId === "a2");
    expect(cellWithFile).toMatchObject({ fileId: "file-1", fileName: "slides.pdf", fileSizeBytes: 2048 });
    expect(cellWithoutFile).toMatchObject({ fileId: null, fileName: null, fileSizeBytes: null });
  });

  // DEC-920: a non-null fileId whose file row didn't resolve through the
  // join is a broken reference -- fail loudly, naming the assignment and
  // file id, rather than silently rendering a generic label.
  it("throws naming the assignment and file id when a fileId doesn't resolve through the join", async () => {
    const contacts = [contactRow("c1", "Ada", "Lovelace")];
    const cellRows = [
      {
        assignmentId: "a1",
        taskId: "task-1",
        status: "complete",
        completedAt: null,
        fileId: "missing-file",
        fileName: null,
        fileSizeBytes: null,
        lastRemindedAt: null,
        contactId: "c1",
        createdAt: new Date(500_000),
      },
    ];
    const { db } = fakeDb([TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 1 }], contacts, OVERDUE_COUNT_ROW, [participationRow("c1")], cellRows]);
    await expect(getOnboardingGrid(db, "event-1", baseParams())).rejects.toThrow(/a1.*missing-file/s);
  });

  // DEC-104: the cells select is chunked per PAGE, not per roster row -- the
  // number of select() calls must not grow with how many contacts are on
  // the page (a single page's worth of contacts stays inside one chunk).
  it("the cells query count does not grow with the number of roster rows on the page", async () => {
    const contacts = [contactRow("c1", "Ada", "Lovelace"), contactRow("c2", "Grace", "Hopper"), contactRow("c3", "Rosa", "Parks")];
    const cellRows = [
      { assignmentId: "a1", taskId: "task-1", status: "pending", completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, contactId: "c1", createdAt: new Date(500_000) },
    ];
    const participations = [participationRow("c1"), participationRow("c2"), participationRow("c3")];
    const { calls } = await (async () => {
      const { db, calls } = fakeDb([
        TASK_ROWS,
        EVENT_ROW,
        SPEAKERS_COUNT_ROW,
        COUNTS_ROW,
        [{ count: 3 }],
        contacts,
        OVERDUE_COUNT_ROW,
        participations,
        cellRows,
      ]);
      await getOnboardingGrid(db, "event-1", baseParams());
      return { calls };
    })();
    // tasks, event lookup, speakers count, counts aggregate, contact count,
    // contacts page, overdue count, ONE participations select, ONE cells
    // select == 9 total regardless of row count.
    expect(calls.length).toBe(9);
  });

  // DEC-558: the J6 grid's task COLUMN query is now a legible total order —
  // undated tasks last, then due date ascending, then title ascending, then
  // task.id ascending — so column rendering order is stable.
  it("orders the task columns: undated last, then dueDate asc, title asc, task.id asc (DEC-558)", async () => {
    const orderByArgs: unknown[][] = [];
    let call = 0;
    // Reuses the exact response sequence from "counts come straight from
    // the aggregate query untouched" above (no contacts on the page, so
    // the cellRows select is skipped): tasks, event lookup, count, contacts
    // page (empty), counts aggregate.
    const responses = [TASK_ROWS, EVENT_ROW, SPEAKERS_COUNT_ROW, COUNTS_ROW, [{ count: 0 }], [], OVERDUE_COUNT_ROW];
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
