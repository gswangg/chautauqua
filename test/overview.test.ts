/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  aggregateTriageCounts,
  aggregateSpeakerCounts,
  computeAgendaSummary,
  minNonNull,
  buildOverdueTaskRows,
  buildConflictRows,
  getOverviewPayload,
  type ConflictSessionInfo,
} from "../src/server/repo/overview";
import { findConflicts, type PlacedSession } from "../src/domain/schedule";

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

describe("aggregateSpeakerCounts (DEC-030 speakers card)", () => {
  const now = 1_000_000;

  it("dedupes contactsOwing by contactId and counts overdue assignments", () => {
    expect(
      aggregateSpeakerCounts(
        [
          { contactId: "c1", dueDate: now - 1000 }, // overdue
          { contactId: "c1", dueDate: now + 1000 }, // same contact, not overdue
          { contactId: "c2", dueDate: null }, // no due date, never overdue
        ],
        now,
      ),
    ).toEqual({ contactsOwing: 2, overdueAssignments: 1 });
  });

  it("returns zeros when there are no pending assignments", () => {
    expect(aggregateSpeakerCounts([], now)).toEqual({ contactsOwing: 0, overdueAssignments: 0 });
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
  // form close date, pending-assignment rows, overdue detail rows, triage
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
      overrides.evaluationsSubmitted ?? [{ count: 0 }],
      overrides.planClose ?? [{ closeDate: null }],
      overrides.formClose ?? [{ closeDate: null }],
      overrides.pendingAssignments ?? [],
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
    expect(payload.triage).toEqual({ pending: 0, accept_queue: 0, decline_queue: 0 });
    expect(payload.review).toEqual({ plans: 0, evaluationsSubmitted: 0 });
    expect(payload.speakers).toEqual({ contactsOwing: 0, overdueAssignments: 0 });
    expect(payload.content).toEqual({ awaitingApproval: 0 });
    expect(payload.agenda).toEqual({ unplaced: 0, conflicts: 0 });
    expect(payload.comms).toEqual({ sentLast7Days: 0, lastSentAt: null });

    // v2 sections present with the DEC-370 shape.
    expect(payload.deadlines).toEqual({
      formCloseDate: null,
      nextTaskDueDate: null,
      planCloseDate: null,
      eventStartDate: new Date("2027-03-10T00:00:00Z").getTime(),
    });
    expect(payload.overdueTasks).toEqual({ total: 0, rows: [] });
    expect(payload.triageQueue).toEqual({ total: 0, oldestSubmittedAt: null, rows: [] });
    expect(payload.contentApproval).toEqual({ total: 0, reuploadedCount: 0, rows: [] });
    expect(payload.agendaWork).toEqual({ unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [] });
  });

  it("deadlines resolve null independently per cell when a source is missing", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb(
      emptyResponses({
        event: [{ recordPrefix: "DFC", startDate: null }],
        planClose: [{ closeDate: 1_700_000_000_000 }],
        formClose: [{ closeDate: null }],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now);
    expect(payload.deadlines).toEqual({
      formCloseDate: null,
      nextTaskDueDate: null,
      planCloseDate: 1_700_000_000_000,
      eventStartDate: null,
    });
  });

  it("overdueTasks.total reuses speakers.overdueAssignments (no second count query) and rows carry daysLate", async () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    const overdueDueDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const db = makeFakeDb(
      emptyResponses({
        pendingAssignments: [{ contactId: "c1", dueDate: overdueDueDate }],
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

  it("triageQueue.total can exceed the 5-row cap while rows stay capped", async () => {
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
    expect(payload.triage.pending).toBe(12);
    expect(payload.triageQueue.total).toBe(12); // total exceeds the 5 returned rows
    expect(payload.triageQueue.rows).toHaveLength(5);
    expect(payload.triageQueue.oldestSubmittedAt).toBe(createdAt(0).getTime());
    expect(payload.triageQueue.rows[0]).toMatchObject({ submissionId: "s0", ref: "DFC-001", title: "Talk 0", trackName: null });
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
      [{ count: 0 }], // evaluationsSubmitted
      [{ closeDate: null }], // planClose
      [{ closeDate: null }], // formClose
      [], // pendingAssignments
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
});
