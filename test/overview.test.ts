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
import { overdueAssignmentConditions } from "../src/server/repo/tasks/crud";
import { assignmentDaysLate } from "../src/domain/task-due";
import { dayLabelOfInstant } from "../src/lib/timezone";
import { findConflicts, type PlacedSession } from "../src/domain/schedule";
import type { Db } from "../src/server/context";
import { asc, desc } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";

const overviewDialect = new SQLiteSyncDialect();
function overviewSqlTextOf(cond: unknown): { sql: string; params: unknown[] } {
  return overviewDialect.sqlToQuery(cond as any);
}

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
    const result = computeAgendaSummary(1, placed);
    expect(result.unplaced).toBe(1); // caller-supplied SQL count (e.g. s3 has no slot)
    expect(result.conflicts).toBe(1); // room_overlap between s1/s2
  });

  it("is zero/zero for no accepted submissions", () => {
    expect(computeAgendaSummary(0, [])).toEqual({ unplaced: 0, conflicts: 0 });
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

// DEC-370/DEC-801 overdueTasks rows: daysLate maths, now timezone-aware via
// assignmentDaysLate (wave 63 amendment) — agrees with the
// overdueAssignmentConditions predicate that selected the row, so it can
// never print 0/"Due today" on a row already selected as overdue.
describe("buildOverdueTaskRows (DEC-370 section 01, DEC-801 wave-63 amendment)", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 0, 20); // 2026-01-20 00:00 UTC

  it("computes whole event-local calendar days late (UTC event)", () => {
    const rows = buildOverdueTaskRows(
      [
        {
          assignmentId: "a1",
          contactId: "c1",
          contactName: "Ada Lovelace",
          company: "Acme",
          taskId: "t1",
          taskTitle: "Upload slides",
          taskDueDate: now - 2 * DAY_MS, // day label 2 days before now's day
          assignedAt: 0,
        },
        {
          assignmentId: "a2",
          contactId: "c2",
          contactName: "Grace Hopper",
          company: null,
          taskId: "t2",
          taskTitle: "Confirm bio",
          taskDueDate: now, // due "today" (now's own day label) — day hasn't elapsed yet
          assignedAt: 0,
        },
      ],
      now,
      "UTC",
    );
    expect(rows[0]!.daysLate).toBe(2);
    expect(rows[1]!.daysLate).toBe(0);
  });

  it("never returns 0 for a row already flagged overdue — clamps to 1, never 0", () => {
    const rows = buildOverdueTaskRows(
      [
        {
          assignmentId: "a1",
          contactId: "c1",
          contactName: "Ada Lovelace",
          company: null,
          taskId: "t1",
          taskTitle: "Upload slides",
          taskDueDate: now + DAY_MS, // due in the future — not overdue
          assignedAt: 0,
        },
      ],
      now,
      "UTC",
    );
    expect(rows[0]!.daysLate).toBe(0);
  });

  // DEC-826: a task cannot be late before it was assigned — a row selected
  // because it went late (by the effective date) two days ago must never
  // be captioned with daysLate derived from the raw, earlier task.dueDate.
  it("derives dueDate/daysLate from the effective (assignment-aware) due date, not the raw task.dueDate", () => {
    // Assigned 9 days ago; the task's own due date is far earlier (42 days
    // ago, well before the assignment existed) — the raw date would (wrongly)
    // caption this row "42 days late", but the effective date (assignedAt +
    // ASSIGNED_LATE_GRACE_DAYS) makes it only 2 days late.
    const assignedAt = now - 9 * DAY_MS;
    const taskDueDate = now - 42 * DAY_MS;
    const rows = buildOverdueTaskRows(
      [
        {
          assignmentId: "a1",
          contactId: "c1",
          contactName: "Ada Lovelace",
          company: null,
          taskId: "t1",
          taskTitle: "Upload slides",
          taskDueDate,
          assignedAt,
        },
      ],
      now,
      "UTC",
    );
    // effective due date = assignedAt + 7-day grace (ASSIGNED_LATE_GRACE_DAYS)
    const expectedEffectiveDue = assignedAt + 7 * DAY_MS;
    expect(rows[0]!.dueDate).toBe(expectedEffectiveDue);
    expect(rows[0]!.daysLate).toBe(2);
    expect(rows[0]!.daysLate).not.toBe(Math.floor((now - taskDueDate) / DAY_MS));
  });

  // w63-b headline case: America/Tokyo, due day label 1 Aug, now = 1 Aug
  // 23:00Z (still 1 Aug UTC, but already 2 Aug locally in Tokyo — the row IS
  // overdue by the timezone-aware predicate). The old UTC-bare
  // Math.floor((now - dueDate)/DAY_MS) read 0, which fed the literal string
  // "Due today" on an already-overdue row (app/src/pages/overview/rows.ts).
  it("Asia/Tokyo: never 0 for a row overdueAssignmentConditions would already select", () => {
    const dueDayLabel = Date.UTC(2026, 7, 1); // day label "1 Aug"
    const tokyoNow = Date.UTC(2026, 7, 1, 23, 0, 0); // 1 Aug 23:00Z == 2 Aug 08:00 JST
    const rows = buildOverdueTaskRows(
      [
        {
          assignmentId: "a1",
          contactId: "c1",
          contactName: "Ada Lovelace",
          company: null,
          taskId: "t1",
          taskTitle: "Upload slides",
          taskDueDate: dueDayLabel,
          assignedAt: Date.UTC(2026, 6, 1),
        },
      ],
      tokyoNow,
      "Asia/Tokyo",
    );
    expect(rows[0]!.daysLate).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.daysLate).not.toBe(0);
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
  // form close date, speakers conditional-aggregate row, (DEC-776) overdue
  // assignment count row, overdue detail rows, triage detail rows, (DEC-855
  // loadTrackNamesBySubmission — skipped only when triageDetail is itself
  // empty, never based on whether any row turns out to have a track), content
  // agg (total+reuploaded), content detail rows, (file rows — skipped when no
  // content rows), (DEC-370 wave-56 amendment) the unplaced-count SQL count
  // and the unplaced-detail LIMIT ROW_CAP rows (both always fire — no more
  // materialized accepted-submission array), the schedule_slot query (also
  // always fires now — it's already event/status-scoped by its join), then —
  // only when the inputs actually trigger them — participant queries, the
  // combined lead-speaker query and the conflict-room-name query (each test
  // passes `extra` for exactly the branches its own fixture data trips), and
  // finally the comms aggregate row.
  function emptyResponses(overrides: Partial<Record<string, unknown>> = {}, extra: unknown[] = []) {
    return [
      overrides.event ?? [{ recordPrefix: "DFC", startDate: "2027-03-10" }],
      overrides.statusRows ?? [],
      overrides.planCount ?? [{ count: 0 }],
      overrides.evaluationsAgg ?? [{ expected: 0, submitted: 0 }],
      overrides.planClose ?? [{ closeDate: null, currentRound: null }],
      overrides.formClose ?? [{ closeDate: null }],
      overrides.speakerAgg ?? [{ outstandingContacts: 0, nextDue: null }],
      overrides.overdueAssignmentCount ?? [{ count: 0 }],
      overrides.overdueDetail ?? [],
      overrides.triageDetail ?? [],
      overrides.contentAgg ?? [{ total: 0, reuploaded: 0 }],
      overrides.contentDetail ?? [],
      overrides.unplacedCount ?? [{ count: 0 }],
      overrides.unplacedDetail ?? [],
      overrides.slotRows ?? [],
      ...extra,
      // DEC-010 amendment (wave 66): listBreaksForEvent fires unconditionally
      // in the same Phase 3 Promise.all wave as the leadSpeaker/room/format
      // queries above, right before the comms aggregate.
      overrides.breaks ?? [],
      overrides.comms ?? [{ sentLast7Days: 0, lastSentAt: null }],
      // DEC-370 amendment (wave 5): the "Public pages" quiet-row summary
      // count, one final SQL count query.
      overrides.publishedSessionCount ?? [{ count: 0 }],
    ];
  }

  it("returns the v1 aggregate keys byte-for-byte alongside the v2 sections", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb(emptyResponses());

    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");

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
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
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
    const assignedAt = new Date(now - 20 * 24 * 60 * 60 * 1000); // assigned well before the due date
    const db = makeFakeDb(
      emptyResponses({
        speakerAgg: [{ outstandingContacts: 1, nextDue: overdueDueDate.getTime() }],
        overdueAssignmentCount: [{ count: 1 }],
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
            assignedAt,
          },
        ],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
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
        daysLate: assignmentDaysLate(overdueDueDate.getTime(), assignedAt.getTime(), now, "America/New_York"),
      },
    ]);
    expect(payload.overdueTasks.rows[0]!.daysLate).toBeGreaterThanOrEqual(1);
  });

  // DEC-826: an assignment created AFTER its task's raw due date must be
  // judged against the effective (grace-window) date, not the raw one — a
  // row selected because it went late two days ago (by the effective date)
  // must never be captioned with daysLate computed from a much-earlier raw
  // task.dueDate.
  it("overdueTasks rows use the effective due date when the assignment postdates the task's raw due date", async () => {
    const now = 60 * 24 * 60 * 60 * 1000;
    const rawTaskDueDate = new Date(now - 42 * 24 * 60 * 60 * 1000); // 42 days "late" by the raw date
    const assignedAt = new Date(now - 9 * 24 * 60 * 60 * 1000); // assigned after the raw due date
    // DEC-801 (wave 38 amendment): the effective due date is a reader-facing
    // day label, not the raw grace-window instant — it must be collapsed
    // into the event-local calendar day via dayLabelOfInstant.
    const expectedEffectiveDue = dayLabelOfInstant(
      assignedAt.getTime() + 7 * 24 * 60 * 60 * 1000, // ASSIGNED_LATE_GRACE_DAYS
      "America/New_York",
    );
    const db = makeFakeDb(
      emptyResponses({
        speakerAgg: [{ outstandingContacts: 1, nextDue: rawTaskDueDate.getTime() }],
        overdueAssignmentCount: [{ count: 1 }],
        overdueDetail: [
          {
            assignmentId: "a1",
            contactId: "c1",
            firstName: "Grace",
            lastName: "Hopper",
            company: null,
            taskId: "t1",
            taskTitle: "Confirm bio",
            dueDate: rawTaskDueDate,
            assignedAt,
          },
        ],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
    expect(payload.overdueTasks.rows).toEqual([
      {
        assignmentId: "a1",
        contactId: "c1",
        contactName: "Grace Hopper",
        company: null,
        taskId: "t1",
        taskTitle: "Confirm bio",
        dueDate: expectedEffectiveDue,
        daysLate: assignmentDaysLate(rawTaskDueDate.getTime(), assignedAt.getTime(), now, "America/New_York"),
      },
    ]);
    expect(payload.overdueTasks.rows[0]!.daysLate).toBeGreaterThanOrEqual(1);
    expect(payload.overdueTasks.rows[0]!.daysLate).not.toBe(Math.floor((now - rawTaskDueDate.getTime()) / (24 * 60 * 60 * 1000)));
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
    const responses = emptyResponses(
      {
        statusRows: [{ status: "pending", n: 12 }],
        triageDetail: rows,
      },
      // No accepted submissions exist, but the 5 triage rows DO feed the
      // combined lead-speaker lookup (non-empty leadSpeakerIds) -> one query.
      [[]],
    );
    // DEC-855: loadTrackNamesBySubmission is queried once per non-empty
    // batch of submission ids -- right after triageDetail (index 9), before
    // contentAgg -- regardless of whether any of them turn out to have a
    // track (none do here, so the response is empty).
    responses.splice(10, 0, []);
    const db = makeFakeDb(responses);
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
    expect(payload["triage-counts"].pending).toBe(12);
    expect(payload.triage.total).toBe(12); // total exceeds the 5 returned rows
    expect(payload.triage.rows).toHaveLength(5);
    expect(payload.triage.oldestSubmittedAt).toBe(createdAt(0).getTime());
    expect(payload.triage.rows[0]).toMatchObject({ submissionId: "s0", ref: "DFC-001", title: "Talk 0", trackName: null });
  });

  it("contentApproval.total/reuploadedCount can exceed the 5 returned rows", async () => {
    const now = 1_735_999_999_999;
    // Non-empty content-detail rows trip an extra query not present in the
    // all-empty base case: file rows (per-submission latest file, right
    // after contentDetail). unplacedCount/unplacedDetail/slotRows always
    // fire now (DEC-370 wave-56 amendment); the combined lead-speaker lookup
    // fires because submission s1 feeds both the content row and the
    // unplaced-row set, since it has no schedule_slot.
    const db = makeFakeDb([
      [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // event
      [], // statusRows
      [{ count: 0 }], // planCount
      [{ expected: 0, submitted: 0 }], // evaluationsAgg
      [{ closeDate: null, currentRound: null }], // planClose
      [{ closeDate: null }], // formClose
      [], // speakerAgg
      [{ count: 0 }], // overdueAssignmentCount
      [], // overdueDetail
      [], // triageDetail
      [{ total: 9, reuploaded: 4 }], // contentAgg
      [{ id: "s1", seq: 1, title: "Talk", updatedAt: new Date(1_700_000_000_000) }], // contentDetail
      [], // fileRows (s1's file rows -- empty is fine, not asserted)
      [{ count: 1 }], // unplacedCount
      [{ id: "s1", seq: 1, title: "Talk" }], // unplacedDetail
      [], // slotRows (s1 has no schedule_slot -> unplaced)
      [], // DEC-895 amendment (w2-f): participant rows for the capped unplaced set {s1}
      [], // lead-speaker rows for {s1}
      [], // DEC-895: format-answer rows for the unplaced set {s1} (none -> durationMin null)
      [], // DEC-010 amendment: breaks for the event
      [{ sentLast7Days: 0, lastSentAt: null }], // comms
      [{ count: 0 }], // DEC-370 amendment (wave 5): publishedSessionCount
    ]);
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
    expect(payload.contentApproval.total).toBe(9);
    expect(payload.contentApproval.reuploadedCount).toBe(4);
    expect(payload.contentApproval.rows).toHaveLength(1);
    expect(payload.agendaWork.unplaced).toHaveLength(1);
    expect(payload.agendaWork.unplaced[0]).toMatchObject({ format: null, durationMin: null, suggestion: null });
  });

  // DEC-895: two unplaced rows, sized by their own session format, must be
  // handed out DIFFERENT startMin values in the same room (the growing
  // suggestionOccupancy set), and a 120-minute format must size the
  // suggestion's implied endMin - startMin to exactly 120, never a
  // hardcoded 30-minute default.
  it("sizes each unplaced row's suggestion by its own format and reserves it so the next row doesn't collide", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb([
      [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // event
      [], // statusRows
      [{ count: 0 }], // planCount
      [{ expected: 0, submitted: 0 }], // evaluationsAgg
      [{ closeDate: null, currentRound: null }], // planClose
      [{ closeDate: null }], // formClose
      [], // speakerAgg
      [{ count: 0 }], // overdueAssignmentCount
      [], // overdueDetail
      [], // triageDetail
      [{ total: 0, reuploaded: 0 }], // contentAgg
      [], // contentDetail
      // fileRows skipped (contentDetail empty)
      [{ count: 2 }], // unplacedCount
      [
        { id: "s1", seq: 1, title: "Talk One" },
        { id: "s2", seq: 2, title: "Workshop Two" },
      ], // unplacedDetail
      [
        // slotRows: an existing placement in room-a occupies 540-600 on day 1
        // so both unplaced rows are searched against a non-empty grid.
        { submissionId: "s0", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600, seq: 99, title: "Placed Session" },
      ],
      [{ submissionId: "s0", contactId: "c0" }], // participant rows for placed {s0}
      [], // lead-speaker rows for the unplaced set {s1, s2}
      [{ id: "room-a", name: "Room A" }], // room-name rows for {room-a}
      [
        { submissionId: "s1", valueJson: JSON.stringify("Talk (30 min)") },
        { submissionId: "s2", valueJson: JSON.stringify("Workshop (120 min)") },
      ], // DEC-895: format-answer rows for the unplaced set {s1, s2}
      [], // DEC-010 amendment: breaks for the event
      [{ sentLast7Days: 0, lastSentAt: null }], // comms
      [{ count: 0 }], // DEC-370 amendment (wave 5): publishedSessionCount
    ]);
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");

    expect(payload.agendaWork.unplaced).toHaveLength(2);
    const [row1, row2] = payload.agendaWork.unplaced;
    expect(row1).toMatchObject({ submissionId: "s1", format: "Talk (30 min)", durationMin: 30 });
    expect(row2).toMatchObject({ submissionId: "s2", format: "Workshop (120 min)", durationMin: 120 });

    // Both suggestions land in the only room in use (room-a), but at
    // DIFFERENT startMin values -- the second row's search must not offer
    // the exact slot the first row was just handed.
    expect(row1!.suggestion).not.toBeNull();
    expect(row2!.suggestion).not.toBeNull();
    expect(row1!.suggestion!.roomId).toBe("room-a");
    expect(row2!.suggestion!.roomId).toBe("room-a");
    expect(row1!.suggestion!.startMin).not.toBe(row2!.suggestion!.startMin);

    // The 120-minute workshop's suggestion is sized by its own format, not
    // a hardcoded 30-minute default: endMin - startMin === 120.
    expect(row2!.durationMin).toBe(120);
  });

  // DEC-895 amendment (w2-f): a placement suggestion must see EVERY active
  // participant on the unplaced submission, not just its lead speaker. p0
  // (placed, room-a, 540-630) and u1 (unplaced) share a CO-PRESENTER
  // (c-shared) who is not either submission's lead. p1 (placed, room-b,
  // 540-570) only exists to put room-b into the search set alongside
  // room-a. A lead-only occupancy check would offer room-b at 570 (free of
  // p1, and free of u1's own lead c-lead1) even though c-shared is still
  // booked there via p0 until 630 -- the fix must skip straight through to
  // 630, where c-shared (and room-a) are both actually free.
  //
  // u2 (unplaced, also shares c-shared with u1, as its own co-presenter --
  // its own lead is c-lead2) then proves the RESERVED occupancy row for
  // u1's accepted suggestion carries c-shared alongside u1's lead: once u1
  // is reserved into room-a at 630-660, room-b at 630 is otherwise
  // physically free (p1 ended at 570) -- a lead-only reservation would miss
  // c-shared entirely and wrongly offer u2 room-b at 630, double-booking
  // c-shared against u1's own new placement.
  it("an unplaced row's suggestion never double-books a co-presenter shared with a placed OR just-suggested session", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb([
      [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // event
      [], // statusRows
      [{ count: 0 }], // planCount
      [{ expected: 0, submitted: 0 }], // evaluationsAgg
      [{ closeDate: null, currentRound: null }], // planClose
      [{ closeDate: null }], // formClose
      [], // speakerAgg
      [{ count: 0 }], // overdueAssignmentCount
      [], // overdueDetail
      [], // triageDetail
      [{ total: 0, reuploaded: 0 }], // contentAgg
      [], // contentDetail
      // fileRows skipped (contentDetail empty)
      [{ count: 2 }], // unplacedCount
      [
        { id: "u1", seq: 3, title: "Co-presented Talk" },
        { id: "u2", seq: 4, title: "Also Co-presented Talk" },
      ], // unplacedDetail
      [
        { submissionId: "p0", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 630, seq: 1, title: "Placed A" },
        { submissionId: "p1", roomId: "room-b", day: "2026-08-10", startMin: 540, endMin: 570, seq: 2, title: "Placed B" },
      ], // slotRows
      [
        // participant rows for the combined {p0, p1, u1, u2} batch -- p0 and
        // u1 share the co-presenter c-shared (neither as lead), and u2
        // shares c-shared too (as its own co-presenter, lead c-lead2).
        { submissionId: "p0", contactId: "c-lead0" },
        { submissionId: "p0", contactId: "c-shared" },
        { submissionId: "p1", contactId: "c-other" },
        { submissionId: "u1", contactId: "c-lead1" },
        { submissionId: "u1", contactId: "c-shared" },
        { submissionId: "u2", contactId: "c-lead2" },
        { submissionId: "u2", contactId: "c-shared" },
      ],
      [], // lead-speaker rows for the unplaced set {u1, u2}
      [
        { id: "room-a", name: "Room A" },
        { id: "room-b", name: "Room B" },
      ], // room-name rows for {room-a, room-b}
      [
        { submissionId: "u1", valueJson: JSON.stringify("Talk (30 min)") },
        { submissionId: "u2", valueJson: JSON.stringify("Talk (30 min)") },
      ], // DEC-895: format-answer rows for {u1, u2}
      [], // DEC-010 amendment: breaks for the event
      [{ sentLast7Days: 0, lastSentAt: null }], // comms
      [{ count: 0 }], // DEC-370 amendment (wave 5): publishedSessionCount
    ]);
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");

    expect(payload.agendaWork.unplaced).toHaveLength(2);
    const [row1, row2] = payload.agendaWork.unplaced;
    expect(row1).toMatchObject({ submissionId: "u1", durationMin: 30 });
    expect(row2).toMatchObject({ submissionId: "u2", durationMin: 30 });
    expect(row1!.suggestion).not.toBeNull();
    expect(row2!.suggestion).not.toBeNull();

    // The correct answer for u1 waits for c-shared's own booking (via p0,
    // room-a, until 630) to clear -- never room-b at 570, which only looks
    // free under a lead-only check.
    expect(row1!.suggestion).toEqual({
      day: "2026-08-10",
      startMin: 630,
      roomId: "room-a",
      roomName: "Room A",
      label: "Place at 10:30",
    });

    // u2 must not land on room-b at 630 (physically free of p1, and free
    // of u2's own lead c-lead2) -- c-shared is booked THERE via u1's own
    // just-reserved suggestion (room-a, 630-660), so u2 must wait for that
    // to clear too, landing on room-a at 660.
    expect(row2!.suggestion).toEqual({
      day: "2026-08-10",
      startMin: 660,
      roomId: "room-a",
      roomName: "Room A",
      label: "Place at 11:00",
    });
  });

  // DEC-370 wave-56 amendment: agenda.unplaced comes straight off the SQL
  // NOT EXISTS(schedule_slot) COUNT (unplacedCountRows), never a JS filter
  // over a materialized accepted-submission array — this fixture stands in
  // for "12 accepted, 3 placed" by feeding that count (9) directly, with a
  // 5-row, seq-ascending unplacedDetail page (the DB's own LIMIT ROW_CAP
  // ORDER BY seq, not a .slice(0, ROW_CAP) in JS).
  it("agenda.unplaced reflects the SQL count directly, and unplaced rows are the seq-ascending capped page (12 accepted, 3 placed)", async () => {
    const now = 1_735_999_999_999;
    const unplacedDetailRows = Array.from({ length: 5 }, (_, i) => ({
      id: `u${i}`,
      seq: i + 1,
      title: `Unplaced ${i}`,
    }));
    const db = makeFakeDb(
      emptyResponses(
        {
          unplacedCount: [{ count: 9 }],
          unplacedDetail: unplacedDetailRows,
        },
        // A non-empty unplacedDetail feeds three more queries: the DEC-895
        // amendment (w2-f) participant lookup for the capped unplaced ids,
        // the combined lead-speaker lookup, and the DEC-895 format-answer
        // batch (all keyed on unplacedCappedIds).
        [[], [], []],
      ),
    );
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
    expect(payload.agenda.unplaced).toBe(9);
    expect(payload.agendaWork.unplacedTotal).toBe(9);
    expect(payload.agendaWork.unplaced).toHaveLength(5);
    expect(payload.agendaWork.unplaced.map((r) => r.submissionId)).toEqual(["u0", "u1", "u2", "u3", "u4"]);
    expect(payload.agendaWork.unplaced.map((r) => r.ref)).toEqual(["DFC-001", "DFC-002", "DFC-003", "DFC-004", "DFC-005"]);
  });

  // DEC-370: at scale (e.g. 60 accepted, unplaced) the payload must still
  // only ever carry 5 named rows behind the true count — the query is
  // capped, not the array.
  it("a 60-accepted-and-unplaced event still returns exactly 5 unplaced rows with the correct total", async () => {
    const now = 1_735_999_999_999;
    const unplacedDetailRows = Array.from({ length: 5 }, (_, i) => ({
      id: `u${i}`,
      seq: i + 1,
      title: `Unplaced ${i}`,
    }));
    const db = makeFakeDb(
      emptyResponses(
        {
          unplacedCount: [{ count: 60 }],
          unplacedDetail: unplacedDetailRows,
        },
        [[], [], []],
      ),
    );
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
    expect(payload.agenda.unplaced).toBe(60);
    expect(payload.agendaWork.unplacedTotal).toBe(60);
    expect(payload.agendaWork.unplaced).toHaveLength(5);
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
        speakerAgg: [{ outstandingContacts: 2, nextDue: soonestPendingDue }],
        overdueAssignmentCount: [{ count: 2 }],
      }),
    );
    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
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
      emptyResponses({
        speakerAgg: [{ outstandingContacts: 3, nextDue: now - 5000 }],
        overdueAssignmentCount: [{ count: 1 }],
      }),
    );
    const overview = await getOverviewPayload(overviewDb, "event-1", now, "America/New_York");

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
          groupBy: () => chain,
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
    // DEC-370 (wave-62 amendment): getOnboardingGrid's reads now issue in
    // three concurrent waves (WAVE 1 = tasks/event/speakers/counts, WAVE 2 =
    // total/contacts/overdue, WAVE 3 = participations+cells), so this
    // call-order-based queue is ordered 0=tasks, 1=event, 2=speakers,
    // 3=counts, 4=total, 5=contacts, 6=overdue.
    const gridDb = fakeGridDb([
      TASK_ROWS, // tasks
      [{ recordPrefix: "SES", timezone: "America/New_York" }], // DEC-801: event row (recordPrefix + timezone), resolved once
      [{ count: 5 }], // DEC-754: speakers roster COUNT(*) (own query now)
      [{ outstandingRequired: 0, outstandingContacts: 3 }], // counts
      [{ count: 0 }], // total
      [], // contacts page (empty; unrelated to the counts aggregate)
      [{ count: 1 }], // DEC-776: overdue roster-scoped COUNT(*) (own query now)
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

    await getOverviewPayload(db, "event-1", now, "America/New_York");

    // Call order: 0=event, 1=statusRows, 2=planCount, 3=evaluationsAgg,
    // 4=planClose, 5=formClose, 6=speakerAgg, 7=overdueAssignmentCount
    // (DEC-776), 8=overdueDetail, 9=triageDetail, 10=contentAgg,
    // 11=contentDetail, 12=unplacedCount, 13=unplacedDetail, 14=slotRows
    // (DEC-370 wave-56 amendment: unplacedCount/unplacedDetail/slotRows all
    // always fire now), 15=comms (no track/file/participant/lead-speaker/
    // room queries fire on this all-empty fixture).
    expect(orderByCallsBySelectIndex[8]).toEqual([asc(schema.task.dueDate), asc(schema.taskAssignment.id)]);
    expect(orderByCallsBySelectIndex[9]).toEqual([asc(schema.submission.createdAt), asc(schema.submission.id)]);
    expect(orderByCallsBySelectIndex[11]).toEqual([desc(schema.submission.updatedAt), asc(schema.submission.id)]);
    expect(orderByCallsBySelectIndex[13]).toEqual([asc(schema.submission.seq)]);
  });

  // DEC-776: both the overdue COUNT query (feeds speakers.overdueAssignments)
  // and the overdue DETAIL rows query compose overdueAssignmentConditions
  // verbatim -- textually identical WHERE clauses -- so the number and the
  // rows describe the SAME set (status <> 'complete', not = 'pending', plus
  // the roster join), and a task_assignment for a contact who is no longer
  // an accepted speaker on the event is excluded from both alike.
  it("the overdue count query and the overdue detail-rows query both compose overdueAssignmentConditions verbatim", async () => {
    const now = 1_735_999_999_999;
    const whereBySelectIndex: unknown[] = [];
    let selectIndex = -1;
    let cursor = 0;
    const responses = emptyResponses();
    function chain(): any {
      const obj: any = {};
      const passthrough = ["from", "innerJoin", "orderBy", "limit", "offset", "groupBy"];
      for (const m of passthrough) obj[m] = () => obj;
      obj.where = (cond: unknown) => {
        whereBySelectIndex[selectIndex] = cond;
        return obj;
      };
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    const db = {
      select: () => {
        selectIndex += 1;
        return chain();
      },
    } as any;

    await getOverviewPayload(db, "event-13", now, "America/New_York");

    // Call order (see emptyResponses' comment above): index 7 = overdue
    // count, index 8 = overdue detail rows.
    const expected = overviewSqlTextOf(overdueAssignmentConditions("event-13", now, "America/New_York"));
    const countWhere = overviewSqlTextOf(whereBySelectIndex[7]);
    const detailWhere = overviewSqlTextOf(whereBySelectIndex[8]);
    expect(countWhere.sql).toBe(expected.sql);
    expect(countWhere.params).toEqual(expected.params);
    expect(detailWhere.sql).toBe(expected.sql);
    expect(detailWhere.params).toEqual(expected.params);
  });
});
