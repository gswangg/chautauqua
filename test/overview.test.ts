/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  aggregateTriageCounts,
  computeAgendaSummary,
  minNonNull,
  buildOverdueTaskRows,
  buildConflictRows,
  getOverviewPayload,
  pickLatestFilePerSubmission,
  pickLeadSpeakerPerSubmission,
  type ConflictSessionInfo,
  type FileRowForPick,
  type LeadSpeakerRow,
} from "../src/server/repo/overview";
import { getOnboardingGrid } from "../src/server/repo/tasks";
import { findConflicts, type PlacedSession } from "../src/domain/schedule";
import type { Db } from "../src/server/context";
import { asc, desc } from "drizzle-orm";
import * as schema from "../src/db/schema";

describe("aggregateTriageCounts (DEC-030 triage card)", () => {
  it("maps grouped status rows to the three triage buckets", () => {
    expect(
      aggregateTriageCounts([
        { status: "pending", n: 4 },
        { status: "accept_queue", n: 2 },
        { status: "decline_queue", n: 1 },
        { status: "accepted", n: 10 },
        { status: "declined", n: 3 },
      ]),
    ).toEqual({ pending: 4, accept_queue: 2, decline_queue: 1 });
  });

  it("defaults missing buckets to zero", () => {
    expect(aggregateTriageCounts([])).toEqual({ pending: 0, accept_queue: 0, decline_queue: 0 });
  });
});

describe("computeAgendaSummary (DEC-030 agenda card, delegates to findConflicts)", () => {
  it("counts unplaced accepted submissions and delegates conflicts to findConflicts", () => {
    const placed: PlacedSession[] = [
      {
        submissionId: "s1",
        roomId: "r1",
        day: "2026-01-01",
        startMin: 60,
        endMin: 90,
        speakerContactIds: ["c1"],
      },
      {
        submissionId: "s2",
        roomId: "r1",
        day: "2026-01-01",
        startMin: 70,
        endMin: 100,
        speakerContactIds: ["c2"],
      },
    ];
    const result = computeAgendaSummary(["s1", "s2", "s3"], placed);
    expect(result.unplaced).toBe(1); // s3 has no slot
    expect(result.conflicts).toBe(1); // room_overlap between s1/s2
  });

  it("is zero/zero for no accepted submissions", () => {
    expect(computeAgendaSummary([], [])).toEqual({ unplaced: 0, conflicts: 0 });
  });
});

// DEC-370 deadlines strip: each cell tolerates a missing source independently.
describe("minNonNull (DEC-370 deadlines strip)", () => {
  it("returns the smallest value, ignoring null/undefined", () => {
    expect(minNonNull([300, null, 100, undefined, 200])).toBe(100);
  });

  it("returns null when every value is missing", () => {
    expect(minNonNull([null, undefined])).toBeNull();
    expect(minNonNull([])).toBeNull();
  });
});

// DEC-370 overdueTasks rows: daysLate maths.
describe("buildOverdueTaskRows (DEC-370 section 01)", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = 10 * DAY_MS;

  it("computes whole days late from now - dueDate", () => {
    const rows = buildOverdueTaskRows(
      [
        {
          assignmentId: "a1",
          contactId: "c1",
          contactName: "Ada Lovelace",
          company: "Acme",
          taskId: "t1",
          taskTitle: "Upload slides",
          dueDate: now - 2 * DAY_MS - 1, // just past 2 full days late
        },
        {
          assignmentId: "a2",
          contactId: "c2",
          contactName: "Grace Hopper",
          company: null,
          taskId: "t2",
          taskTitle: "Confirm bio",
          dueDate: now - 12 * 60 * 60 * 1000, // 12h overdue -> 0 whole days
        },
      ],
      now,
    );
    expect(rows[0]!.daysLate).toBe(2);
    expect(rows[1]!.daysLate).toBe(0);
  });

  it("clamps daysLate at zero even if dueDate is not actually in the past", () => {
    const rows = buildOverdueTaskRows(
      [
        {
          assignmentId: "a1",
          contactId: "c1",
          contactName: "Ada Lovelace",
          company: null,
          taskId: "t1",
          taskTitle: "Upload slides",
          dueDate: now + DAY_MS,
        },
      ],
      now,
    );
    expect(rows[0]!.daysLate).toBe(0);
  });
});

// DEC-370 agendaWork.conflicts rows: built from findConflicts(), never
// re-derived.
describe("buildConflictRows (DEC-370 section 04, delegates to findConflicts)", () => {
  it("builds one row per findConflicts pair, resolved against the session/room lookup", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "r1", day: "2026-01-01", startMin: 60, endMin: 90, speakerContactIds: ["c1"] },
      { submissionId: "s2", roomId: "r1", day: "2026-01-01", startMin: 70, endMin: 100, speakerContactIds: ["c2"] },
    ];
    const conflicts = findConflicts(placed);
    expect(conflicts).toHaveLength(1);

    const sessionById = new Map<string, ConflictSessionInfo>([
      ["s1", { day: "2026-01-01", startMin: 60, endMin: 90, roomId: "r1", ref: "DFC-001", title: "Talk One", speakerName: "Priya Raman" }],
      ["s2", { day: "2026-01-01", startMin: 70, endMin: 100, roomId: "r1", ref: "DFC-002", title: "Talk Two", speakerName: "Ruth Adeyemi" }],
    ]);
    const roomNameById = new Map([["r1", "Room 2A"]]);

    const rows = buildConflictRows(conflicts, sessionById, roomNameById);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      day: "2026-01-01",
      startMin: 60,
      endMin: 90,
      roomName: "Room 2A",
      kind: "room_overlap",
      entries: [
        { submissionId: "s1", ref: "DFC-001", title: "Talk One", speakerName: "Priya Raman" },
        { submissionId: "s2", ref: "DFC-002", title: "Talk Two", speakerName: "Ruth Adeyemi" },
      ],
    });
  });

  it("caps rows at the given limit", () => {
    // Three mutually room-overlapping sessions -> 3 findConflicts pairs.
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "r1", day: "d", startMin: 0, endMin: 30, speakerContactIds: [] },
      { submissionId: "s2", roomId: "r1", day: "d", startMin: 0, endMin: 30, speakerContactIds: [] },
      { submissionId: "s3", roomId: "r1", day: "d", startMin: 0, endMin: 30, speakerContactIds: [] },
    ];
    const conflicts = findConflicts(placed);
    expect(conflicts.length).toBeGreaterThan(1);

    const sessionById = new Map<string, ConflictSessionInfo>(
      placed.map((p) => [p.submissionId, { day: p.day, startMin: p.startMin, endMin: p.endMin, roomId: p.roomId, ref: p.submissionId, title: p.submissionId, speakerName: "" }]),
    );
    const rows = buildConflictRows(conflicts, sessionById, new Map(), 1);
    expect(rows).toHaveLength(1);
  });

  it("fails loudly if a conflicting submission id isn't in the loaded session lookup", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "r1", day: "d", startMin: 0, endMin: 30, speakerContactIds: [] },
      { submissionId: "s2", roomId: "r1", day: "d", startMin: 0, endMin: 30, speakerContactIds: [] },
    ];
    const conflicts = findConflicts(placed);
    expect(() => buildConflictRows(conflicts, new Map(), new Map())).toThrow(/not in the loaded set/);
  });
});

// DEC-558: the two "best row" reducers extracted from getOverviewPayload
// each get an explicit id/contactId tiebreak, so they're a total order —
// feeding the same rows in reversed order must produce byte-identical
// output (the DEC-534 rule as a property, not a spot check).
describe("pickLatestFilePerSubmission (DEC-558 total order)", () => {
  const rows: FileRowForPick[] = [
    { id: "f1", submissionId: "s1", filename: "a.pdf", previousFileId: null, createdAt: 100 },
    { id: "f2", submissionId: "s1", filename: "b.pdf", previousFileId: "f1", createdAt: 200 },
    { id: "f3", submissionId: "s1", filename: "c.pdf", previousFileId: "f2", createdAt: 200 }, // tie w/ f2
  ];

  it("picks the highest createdAt, tiebreak on file.id ascending", () => {
    const picked = pickLatestFilePerSubmission(rows);
    expect(picked?.id).toBe("f2"); // f2 < f3 on tied createdAt
  });

  it("is order-independent: reversed input yields byte-identical output", () => {
    const forward = pickLatestFilePerSubmission(rows);
    const reversed = pickLatestFilePerSubmission([...rows].reverse());
    expect(reversed).toEqual(forward);
  });

  it("returns null for an empty row list", () => {
    expect(pickLatestFilePerSubmission([])).toBeNull();
  });
});

describe("pickLeadSpeakerPerSubmission (DEC-558 total order)", () => {
  const rows: LeadSpeakerRow[] = [
    { submissionId: "s1", order: 2, contactId: "c2", name: "Bob" },
    { submissionId: "s1", order: 1, contactId: "cB", name: "Ann" },
    { submissionId: "s1", order: 1, contactId: "cA", name: "Zoe" }, // tie w/ cB on order
  ];

  it("picks the lowest order, tiebreak on contactId ascending", () => {
    const picked = pickLeadSpeakerPerSubmission(rows);
    expect(picked?.contactId).toBe("cA"); // cA < cB on tied order
  });

  it("is order-independent: reversed input yields byte-identical output", () => {
    const forward = pickLeadSpeakerPerSubmission(rows);
    const reversed = pickLeadSpeakerPerSubmission([...rows].reverse());
    expect(reversed).toEqual(forward);
  });

  it("returns null for an empty row list", () => {
    expect(pickLeadSpeakerPerSubmission([])).toBeNull();
  });
});

// Regression for DEC-333/DEC-334/DEC-370: getOverviewPayload issues one
// bounded round trip per section (no query inside a loop, no fan-out),
// and the v1 payload keys survive byte-for-byte alongside the v2 additions.
// Uses the response-queue fake-db pattern from test/api-submissions.test.ts
// — a chainable object whose `then` pops the next queued response in call
// order.
describe("getOverviewPayload: DEC-370 v2 shape, one bounded query per section", () => {
  function makeFakeDb(responses: unknown[]) {
    let cursor = 0;
    function chain(): any {
      const obj: any = {};
      const passthrough = [
        "from",
        "where",
        "innerJoin",
        "orderBy",
        "limit",
        "offset",
        "select",
        "groupBy",
      ];
      for (const m of passthrough) obj[m] = () => obj;
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        if (cursor >= responses.length) {
          throw new Error(`makeFakeDb: query #${cursor + 1} has no queued response (only ${responses.length} queued)`);
        }
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    return { select: () => chain() } as any;
  }

  // Call order inside getOverviewPayload: event lookup, triage status rows,
  // plan count, evaluations-submitted count, plan close-date min, default
  // form close date, speakers conditional-aggregate row, overdue detail rows, triage
  // detail rows, (track names — skipped when no trackIds), content agg
  // (total+reuploaded), content detail rows, (file rows — skipped when no
  // content rows), accepted-submission rows, then — only when the inputs
  // actually trigger them — schedule_slot/participant queries, the combined
  // lead-speaker query and the conflict-room-name query (each test passes
  // `extra` for exactly the branches its own fixture data trips), and
  // finally the comms aggregate row.
  function emptyResponses(overrides: Partial<Record<string, unknown>> = {}, extra: unknown[] = []) {
    return [
      overrides.event ?? [{ recordPrefix: "DFC", startDate: "2027-03-10" }],
      overrides.statusRows ?? [],
      overrides.planCount ?? [{ count: 0 }],
      overrides.evaluationsAgg ?? [{ expected: 0, submitted: 0 }],
      overrides.planClose ?? [{ closeDate: null, currentRound: null }],
      overrides.formClose ?? [{ closeDate: null }],
      overrides.speakerAgg ?? [{ outstandingContacts: 0, overdue: 0, nextDue: null }],
      overrides.overdueDetail ?? [],
      overrides.triageDetail ?? [],
      overrides.contentAgg ?? [{ total: 0, reuploaded: 0 }],
      overrides.contentDetail ?? [],
      overrides.accepted ?? [],
      ...extra,
      overrides.comms ?? [{ sentLast7Days: 0, lastSentAt: null }],
    ];
  }

  it("returns the v1 aggregate keys byte-for-byte alongside the v2 sections", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb(emptyResponses());

    const payload = await getOverviewPayload(db, "event-1", now);

    // v1 keys, unchanged shape/values (nav badge + app/src/pages/overview/cards.ts).
    expect(payload["triage-counts"]).toEqual({ pending: 0, accept_queue: 0, decline_queue: 0 });
    expect(payload.review).toEqual({ plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 });
    expect(payload.speakers).toEqual({ contactsOwing: 0, overdueAssignments: 0 });
    expect(payload.content).toEqual({ awaitingApproval: 0 });
    expect(payload.agenda).toEqual({ unplaced: 0, conflicts: 0 });
    expect(payload.comms).toEqual({ sentLast7Days: 0, lastSentAt: null });

    // v2 sections present with the DEC-370 shape.
    expect(payload.deadlines).toEqual({
      formCloseDate: null,
      nextTaskDueDate: null,
      planCloseDate: null,
      planRound: null,
      eventStartDate: new Date("2027-03-10T00:00:00Z").getTime(),
    });
    expect(payload.overdueTasks).toEqual({ total: 0, rows: [] });
    expect(payload.triage).toEqual({ total: 0, oldestSubmittedAt: null, rows: [] });
    expect(payload.contentApproval).toEqual({ total: 0, reuploadedCount: 0, rows: [] });
    expect(payload.agendaWork).toEqual({ unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [] });
  });

  it("deadlines resolve null independently per cell when a source is missing", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb(
      emptyResponses({
        event: [{ recordPrefix: "DFC", startDate: null }],
        planClose: [{ closeDate: new Date(1_700_000_000_000), currentRound: 2 }],
        formClose: [{ closeDate: null }],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now);
    expect(payload.deadlines).toEqual({
      formCloseDate: null,
      nextTaskDueDate: null,
      planCloseDate: 1_700_000_000_000,
      planRound: 2,
      eventStartDate: null,
    });
  });

  it("overdueTasks.total reuses speakers.overdueAssignments (no second count query) and rows carry daysLate", async () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    const overdueDueDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const db = makeFakeDb(
      emptyResponses({
        speakerAgg: [{ outstandingContacts: 1, overdue: 1, nextDue: overdueDueDate.getTime() }],
        overdueDetail: [
          {
            assignmentId: "a1",
            contactId: "c1",
            firstName: "Ada",
            lastName: "Lovelace",
            company: "Acme",
            taskId: "t1",
            taskTitle: "Upload slides",
            dueDate: overdueDueDate,
          },
        ],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now);
    expect(payload.speakers.overdueAssignments).toBe(1);
    expect(payload.overdueTasks.total).toBe(1);
    expect(payload.overdueTasks.rows).toEqual([
      {
        assignmentId: "a1",
        contactId: "c1",
        contactName: "Ada Lovelace",
        company: "Acme",
        taskId: "t1",
        taskTitle: "Upload slides",
        dueDate: overdueDueDate.getTime(),
        daysLate: 2,
      },
    ]);
  });

  it("triage.total can exceed the 5-row cap while rows stay capped", async () => {
    const now = 1_735_999_999_999;
    const createdAt = (n: number) => new Date(1_700_000_000_000 + n);
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      seq: i + 1,
      title: `Talk ${i}`,
      trackId: null,
      createdAt: createdAt(i),
    }));
    const db = makeFakeDb(
      emptyResponses(
        {
          statusRows: [{ status: "pending", n: 12 }],
          triageDetail: rows,
        },
        // The 5 triage rows have no track ids (skip trackRows) and no
        // accepted submissions exist, but they DO feed the combined
        // lead-speaker lookup (non-empty leadSpeakerIds) -> one query.
        [[]],
      ),
    );
    const payload = await getOverviewPayload(db, "event-1", now);
    expect(payload["triage-counts"].pending).toBe(12);
    expect(payload.triage.total).toBe(12); // total exceeds the 5 returned rows
    expect(payload.triage.rows).toHaveLength(5);
    expect(payload.triage.oldestSubmittedAt).toBe(createdAt(0).getTime());
    expect(payload.triage.rows[0]).toMatchObject({ submissionId: "s0", ref: "DFC-001", title: "Talk 0", trackName: null });
  });

  it("contentApproval.total/reuploadedCount can exceed the 5 returned rows", async () => {
    const now = 1_735_999_999_999;
    // Non-empty content-detail/accepted rows trip three extra queries not
    // present in the all-empty base case: file rows (per-submission latest
    // file, right after contentDetail), schedule_slot rows (right after
    // accepted, since acceptedIds is non-empty), and the combined
    // lead-speaker lookup (submission s1 feeds both the content row and the
    // unplaced-row set, since it has no schedule_slot).
    const db = makeFakeDb([
      [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // event
      [], // statusRows
      [{ count: 0 }], // planCount
      [{ expected: 0, submitted: 0 }], // evaluationsAgg
      [{ closeDate: null, currentRound: null }], // planClose
      [{ closeDate: null }], // formClose
      [], // speakerAgg
      [], // overdueDetail
      [], // triageDetail
      [{ total: 9, reuploaded: 4 }], // contentAgg
      [{ id: "s1", seq: 1, title: "Talk", updatedAt: new Date(1_700_000_000_000) }], // contentDetail
      [], // fileRows (s1's file rows -- empty is fine, not asserted)
      [{ id: "s1", seq: 1, title: "Talk" }], // accepted
      [], // slotRows (s1 has no schedule_slot -> unplaced)
      [], // lead-speaker rows for {s1}
      [{ sentLast7Days: 0, lastSentAt: null }], // comms
    ]);
    const payload = await getOverviewPayload(db, "event-1", now);
    expect(payload.contentApproval.total).toBe(9);
    expect(payload.contentApproval.reuploadedCount).toBe(4);
    expect(payload.contentApproval.rows).toHaveLength(1);
    expect(payload.agendaWork.unplaced).toHaveLength(1);
  });

  // DEC-531: the row-materializing aggregateSpeakerCounts helper is gone —
  // speakers.contactsOwing/overdueAssignments/nextTaskDueDate now come
  // straight from ONE conditional-aggregate query (see
  // src/server/repo/overview.ts's speakerAggRows), the same SQL shape as
  // src/server/repo/tasks/grid.ts's counts query. This worked-by-hand
  // fixture is what that SQL would return for: a contact (c1) owing two
  // pending, past-due assignments (counted once in contactsOwing, twice in
  // overdueAssignments); a contact (c2) with a null-due-date pending
  // assignment (counted in contactsOwing only, excluded from
  // overdueAssignments/nextTaskDueDate); and a contact (c3) whose only
  // assignment is complete-but-overdue (excluded from both).
  it("speakers counts match the worked-by-hand aggregate for a mixed pending/null-due/completed fixture", async () => {
    const now = 1_735_999_999_999;
    const soonestPendingDue = now - 1000; // c1's earlier overdue assignment
    const db = makeFakeDb(
      emptyResponses({
        speakerAgg: [{ outstandingContacts: 2, overdue: 2, nextDue: soonestPendingDue }],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now);
    expect(payload.speakers).toEqual({ contactsOwing: 2, overdueAssignments: 2 });
    expect(payload.deadlines.nextTaskDueDate).toBe(soonestPendingDue);
  });

  // DEC-531: the two surfaces that both count "outstanding contacts" /
  // "overdue assignments" for the same event — the overview card and the
  // J6 grid's event-wide counts — must never drift, since they're built
  // from the textually-identical CASE expression. This feeds the same
  // aggregate-row values through both repo functions and asserts they
  // resolve to the same numbers.
  it("overview speakers counts equal the J6 grid's counts.outstandingContacts/overdue on the same aggregate values", async () => {
    const now = 1_735_999_999_999;

    const overviewDb = makeFakeDb(
      emptyResponses({ speakerAgg: [{ outstandingContacts: 3, overdue: 1, nextDue: now - 5000 }] }),
    );
    const overview = await getOverviewPayload(overviewDb, "event-1", now);

    function fakeGridDb(selectQueue: unknown[][]): Db {
      let call = 0;
      const select = () => {
        const rows = selectQueue[call] ?? [];
        call += 1;
        const chain: any = {
          from: () => chain,
          leftJoin: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: () => chain,
          offset: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve(rows),
        };
        return chain;
      };
      return { select } as unknown as Db;
    }

    const TASK_ROWS = [{ id: "task-1", kind: "general", title: "Sign W9", dueDate: null, required: true }];
    const gridDb = fakeGridDb([
      TASK_ROWS, // tasks
      [{ count: 0 }], // total
      [], // contacts page (empty; unrelated to the counts aggregate)
      [{ speakers: 5, outstandingRequired: 0, overdue: 1, outstandingContacts: 3 }], // counts
    ]);
    const grid = await getOnboardingGrid(gridDb, "event-1", {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      now,
    });

    expect(overview.speakers.contactsOwing).toBe(grid.counts.outstandingContacts);
    expect(overview.speakers.overdueAssignments).toBe(grid.counts.overdue);
  });

  // DEC-558: every capped detail-row query gets a total order (a tail id
  // tiebreak so the top-N is stable across ties). Captures the exact
  // orderBy() call args (in select-call order) rather than just the
  // response shape.
  it("issues the DEC-558 total-order orderBy args for each capped detail-row query", async () => {
    const now = 1_735_999_999_999;
    const orderByCallsBySelectIndex: unknown[][] = [];
    let selectIndex = -1;
    function chain(): any {
      const myIndex = selectIndex;
      const obj: any = {};
      const passthrough = ["from", "where", "innerJoin", "limit", "offset", "groupBy"];
      for (const m of passthrough) obj[m] = () => obj;
      obj.orderBy = (...args: unknown[]) => {
        orderByCallsBySelectIndex[myIndex] = args;
        return obj;
      };
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        if (cursor >= responses.length) {
          throw new Error(`fake db: query #${cursor + 1} has no queued response`);
        }
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    let cursor = 0;
    const responses = emptyResponses();
    const db = {
      select: () => {
        selectIndex += 1;
        return chain();
      },
    } as any;

    await getOverviewPayload(db, "event-1", now);

    // Call order: 0=event, 1=statusRows, 2=planCount, 3=evaluationsAgg,
    // 4=planClose, 5=formClose, 6=speakerAgg, 7=overdueDetail,
    // 8=triageDetail, 9=contentAgg, 10=contentDetail, 11=accepted, 12=comms
    // (no track/file/slot/lead-speaker/room queries fire on this all-empty
    // fixture).
    expect(orderByCallsBySelectIndex[7]).toEqual([asc(schema.task.dueDate), asc(schema.taskAssignment.id)]);
    expect(orderByCallsBySelectIndex[8]).toEqual([asc(schema.submission.createdAt), asc(schema.submission.id)]);
    expect(orderByCallsBySelectIndex[10]).toEqual([desc(schema.submission.updatedAt), asc(schema.submission.id)]);
    expect(orderByCallsBySelectIndex[11]).toEqual([asc(schema.submission.seq)]);
  });
});
