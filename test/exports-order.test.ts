// DEC-560: every J12 export must be deterministic — no ORDER BY meant no
// guarantee two runs (or two replicas returning join rows in different
// physical order) render the same CSV. Covers all six export kinds:
//
//  - submissions, agenda, showflow, speakers: the JS-side aggregation
//    (tracks Set, speaker order + contact-id tiebreak, and — for
//    speakers — the whole per-contact aggregate) is itself sort-stable,
//    so feeding the same logical join rows in reversed order through the
//    real exportX() functions (via the fakeDb select-queue pattern
//    established by test/exports-content.test.ts /
//    test/participant-attribution.test.ts) must still produce
//    byte-identical CSV.
//  - evaluations, email-log: ordering is SQL-only (no JS resort of the
//    row list), so determinism instead lives in the query's own
//    .orderBy(...) call — asserted by capturing the orderBy() arguments
//    a fakeDb records and checking they reference the exact DEC-560
//    columns, in order, by object identity.
//  - agenda: additionally proves shapeAgendaExport's total order (day,
//    startMin, room, submission seq) directly: rows are non-decreasing in
//    (day, startMin), and a same-day/same-time pair in two different
//    rooms sorts deterministically (by room name).

import { describe, expect, it } from "vitest";
import { asc, desc } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { toCsv } from "../src/domain/csv";
import { buildExport, buildShowflowExport } from "../src/server/repo/exports";
import { shapeAgendaExport, type AgendaExportInput } from "../src/server/repo/exports/agenda";
import { shapeShowflowExport, type ShowflowExportInput } from "../src/server/repo/exports/showflow";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[], orderByLog?: unknown[][]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: (...args: unknown[]) => {
      orderByLog?.push(args);
      return chain;
    },
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order;
 * optionally records every .orderBy() call's arguments into orderByLog
 * (one entry per select() call, in call order). */
function fakeDb(selectQueue: unknown[][], orderByLog?: unknown[][][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      const log: unknown[][] = [];
      orderByLog?.push(log);
      call += 1;
      return makeChain(rows, log);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

describe("DEC-560: submissions export — tracks/speakers deterministic regardless of join-row order", () => {
  // exportSubmissions' select() call order: 1 getRecordPrefix, 2 submissions,
  // 3 trackJoinRows, 4 participantRows, 5 forms, 6 fieldRows, 7 answerRows.
  function queue(trackJoinRows: unknown[], participantRows: unknown[]) {
    return [
      [{ recordPrefix: "SES" }],
      [
        {
          id: "sub-1",
          seq: 1,
          title: "Talk One",
          description: "",
          status: "accepted",
          contentStatus: "approved",
          trackId: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      trackJoinRows,
      participantRows,
      [], // forms
      [], // fieldRows
      [], // answerRows
    ];
  }

  it("tracks Set emitted sorted by name; speakers tiebroken by contact id — byte-identical CSV under reversed join-row order", async () => {
    const trackRowsA = [
      { submissionId: "sub-1", trackName: "Platform" },
      { submissionId: "sub-1", trackName: "Keynote" },
    ];
    const trackRowsB = [...trackRowsA].reverse();
    const participantRowsA = [
      { submissionId: "sub-1", order: 0, contactId: "c-b", firstName: "Bob", lastName: "B" },
      { submissionId: "sub-1", order: 0, contactId: "c-a", firstName: "Alice", lastName: "A" },
    ];
    const participantRowsB = [...participantRowsA].reverse();

    const tableA = await buildExport(fakeDb(queue(trackRowsA, participantRowsA)), "event-1", "submissions");
    const tableB = await buildExport(fakeDb(queue(trackRowsB, participantRowsB)), "event-1", "submissions");

    expect(toCsv([tableA.header, ...tableA.rows])).toBe(toCsv([tableB.header, ...tableB.rows]));
    const tracksCol = tableA.header.indexOf("tracks");
    expect(tableA.rows[0]![tracksCol]).toBe("Keynote; Platform");
    const speakersCol = tableA.header.indexOf("speakers");
    // order:0 ties -> contact-id tiebreak: "c-a" (Alice) before "c-b" (Bob).
    expect(tableA.rows[0]![speakersCol]).toBe("Alice A; Bob B");
  });
});

describe("DEC-560: speakers export — per-contact aggregate deterministic regardless of row order", () => {
  function queue(rows: unknown[]) {
    return [[{ recordPrefix: "SES" }], rows];
  }
  const baseRow = {
    company: "Acme",
    title: "Eng",
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    inviteStatus: "accepted",
    contentStatus: "approved",
  };

  it("orders speakers by (lastName, firstName, contactId) and sorts each speaker's acceptedSessions cell — byte-identical CSV under reversed row order", async () => {
    const rowsA = [
      { ...baseRow, contactId: "c-z", firstName: "Zoe", lastName: "Adams", email: "z@example.com", visible: true, status: "accepted", seq: 5 },
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "accepted", seq: 2 },
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "accepted", seq: 1 },
    ];
    const rowsB = [...rowsA].reverse();

    const tableA = await buildExport(fakeDb(queue(rowsA)), "event-1", "speakers");
    const tableB = await buildExport(fakeDb(queue(rowsB)), "event-1", "speakers");

    expect(toCsv([tableA.header, ...tableA.rows])).toBe(toCsv([tableB.header, ...tableB.rows]));
    // Amy Adams (firstName tiebreak within same lastName) sorts before Zoe Adams.
    expect(tableA.rows.map((r) => r[0])).toEqual(["Amy", "Zoe"]);
    const acceptedCol = tableA.header.indexOf("acceptedSessions");
    // Amy's two accepted refs (seq 1, 2) render lowest-seq-first regardless
    // of the join rows' arrival order.
    expect(tableA.rows[0]![acceptedCol]).toBe("SES-001; SES-002");
  });

  it("DEC-560 amendment: company/title come from the ACCEPTED participant row with lowest submission.seq, falling back to the first row overall — deterministic under row shuffle", async () => {
    const rows = [
      // Higher-seq (2) ACCEPTED row with different org/title — must lose to
      // the lower-seq (1) ACCEPTED row below, regardless of arrival order.
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "accepted", seq: 2, company: "LateCo", title: "VP" },
      // Non-accepted (invited) row that arrives first in one ordering — must
      // never win over an accepted row.
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "pending", inviteStatus: "invited", seq: 3, company: "NeverCo", title: "Nope" },
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "accepted", seq: 1, company: "EarlyCo", title: "Eng" },
    ];
    const shuffled = [rows[1]!, rows[2]!, rows[0]!];

    const tableStraight = await buildExport(fakeDb(queue(rows)), "event-1", "speakers");
    const tableShuffled = await buildExport(fakeDb(queue(shuffled)), "event-1", "speakers");

    expect(toCsv([tableStraight.header, ...tableStraight.rows])).toBe(toCsv([tableShuffled.header, ...tableShuffled.rows]));
    const companyCol = tableStraight.header.indexOf("company");
    const titleCol = tableStraight.header.indexOf("title");
    expect(tableStraight.rows[0]![companyCol]).toBe("EarlyCo");
    expect(tableStraight.rows[0]![titleCol]).toBe("Eng");
  });

  it("DEC-560 amendment: company/title fall back to the first row overall when the contact has no accepted participant row", async () => {
    const rows = [
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: false, status: "pending", inviteStatus: "invited", seq: 3, company: "LaterCo", title: "Later" },
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: false, status: "pending", inviteStatus: "none", seq: 1, company: "FirstCo", title: "First" },
    ];
    const shuffled = [...rows].reverse();

    const tableStraight = await buildExport(fakeDb(queue(rows)), "event-1", "speakers");
    const tableShuffled = await buildExport(fakeDb(queue(shuffled)), "event-1", "speakers");

    expect(toCsv([tableStraight.header, ...tableStraight.rows])).toBe(toCsv([tableShuffled.header, ...tableShuffled.rows]));
    const companyCol = tableStraight.header.indexOf("company");
    expect(tableStraight.rows[0]![companyCol]).toBe("FirstCo");
  });

  it("DEC-560 amendment: visible mirrors public/gates.ts visibleSubmissionConditions — false when the only visible participant row hangs off a pending or content-unapproved submission, true once accepted+approved", async () => {
    const visibleCol = (t: { header: string[] }) => t.header.indexOf("visible");
    const acceptedRefCol = (t: { header: string[] }) => t.header.indexOf("acceptedSessions");

    // Case 1: visible participant row, but submission.status='pending' — never publicly visible.
    const pendingRows = [
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "pending", contentStatus: "pending", seq: 1 },
    ];
    const tablePending = await buildExport(fakeDb(queue(pendingRows)), "event-1", "speakers");
    expect(tablePending.rows[0]![visibleCol(tablePending)]).toBe("false");
    expect(tablePending.rows[0]![acceptedRefCol(tablePending)]).toBe("");

    // Case 2: visible participant row, submission accepted but content not approved — still not visible.
    const contentPendingRows = [
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "accepted", contentStatus: "pending", seq: 1 },
    ];
    const tableContentPending = await buildExport(fakeDb(queue(contentPendingRows)), "event-1", "speakers");
    expect(tableContentPending.rows[0]![visibleCol(tableContentPending)]).toBe("false");
    // acceptedSessions reflects submission.status alone (unaffected by contentStatus).
    expect(tableContentPending.rows[0]![acceptedRefCol(tableContentPending)]).toBe("SES-001");

    // Case 3: same speaker, submission accepted AND content approved — visible=true.
    const approvedRows = [
      { ...baseRow, contactId: "c-a", firstName: "Amy", lastName: "Adams", email: "a@example.com", visible: true, status: "accepted", contentStatus: "approved", seq: 1 },
    ];
    const tableApproved = await buildExport(fakeDb(queue(approvedRows)), "event-1", "speakers");
    expect(tableApproved.rows[0]![visibleCol(tableApproved)]).toBe("true");
    expect(tableApproved.rows[0]![acceptedRefCol(tableApproved)]).toBe("SES-001");
  });
});

describe("DEC-560: agenda export — total order (day, startMin, room, submission seq)", () => {
  it("byte-identical CSV under reversed join-row order", async () => {
    // exportAgenda select() order: 1 getRecordPrefix, 2 slotRows, 3 trackJoinRows, 4 participantRows.
    const slotRows = [
      { submissionId: "sub-1", day: "2026-06-01", startMin: 540, endMin: 570, roomName: "Room A", seq: 1, title: "Talk 1" },
      { submissionId: "sub-2", day: "2026-06-01", startMin: 540, endMin: 570, roomName: "Room B", seq: 2, title: "Talk 2" },
    ];
    const trackRowsA = [
      { submissionId: "sub-1", trackName: "Platform" },
      { submissionId: "sub-1", trackName: "Keynote" },
    ];
    const trackRowsB = [...trackRowsA].reverse();
    const participantRowsA = [
      { submissionId: "sub-1", order: 0, contactId: "c-b", firstName: "Bob", lastName: "B" },
      { submissionId: "sub-1", order: 0, contactId: "c-a", firstName: "Alice", lastName: "A" },
    ];
    const participantRowsB = [...participantRowsA].reverse();

    const queue = (trackRows: unknown[], participantRows: unknown[]) => [
      [{ recordPrefix: "SES" }],
      slotRows,
      trackRows,
      participantRows,
    ];

    const tableA = await buildExport(fakeDb(queue(trackRowsA, participantRowsA)), "event-1", "agenda");
    const tableB = await buildExport(fakeDb(queue(trackRowsB, participantRowsB)), "event-1", "agenda");

    expect(toCsv([tableA.header, ...tableA.rows])).toBe(toCsv([tableB.header, ...tableB.rows]));
  });

  it("shapeAgendaExport: rows are non-decreasing in (day, startMin), a same-day/same-time pair in two rooms orders deterministically", () => {
    const inputs: AgendaExportInput[] = [
      { day: "2026-06-01", startMin: 570, endMin: 600, room: "Room B", ref: "SES-002", title: "B", speakers: [], tracks: [], seq: 2 },
      { day: "2026-06-01", startMin: 540, endMin: 570, room: "Room A", ref: "SES-001", title: "A", speakers: [], tracks: [], seq: 1 },
      { day: "2026-06-01", startMin: 570, endMin: 600, room: "Room A", ref: "SES-003", title: "C", speakers: [], tracks: [], seq: 3 },
      { day: "2026-06-02", startMin: 480, endMin: 510, room: "Room A", ref: "SES-004", title: "D", speakers: [], tracks: [], seq: 4 },
    ];
    const shuffled = [inputs[2]!, inputs[0]!, inputs[3]!, inputs[1]!];

    const tableStraight = shapeAgendaExport(inputs);
    const tableShuffled = shapeAgendaExport(shuffled);
    expect(toCsv([tableStraight.header, ...tableStraight.rows])).toBe(toCsv([tableShuffled.header, ...tableShuffled.rows]));

    // Non-decreasing in (day, startMin).
    const dayStartPairs = tableStraight.rows.map((r) => [r[0], r[1]]);
    for (let i = 1; i < dayStartPairs.length; i++) {
      const [prevDay, prevStart] = dayStartPairs[i - 1]!;
      const [curDay, curStart] = dayStartPairs[i]!;
      expect(prevDay! <= curDay!).toBe(true);
      if (prevDay === curDay) expect(prevStart! <= curStart!).toBe(true);
    }

    // Same-day/same-time (2026-06-01 09:30) pair, rooms A and B: Room A first.
    const refCol = tableStraight.header.indexOf("ref");
    const sameSlotRefs = tableStraight.rows.filter((r) => r[0] === "2026-06-01" && r[1] === "09:30").map((r) => r[refCol]);
    expect(sameSlotRefs).toEqual(["SES-003", "SES-002"]);
  });
});

describe("DEC-560: showflow export — total order (day, startMin, room, submission seq), unscheduled last by seq", () => {
  it("byte-identical CSV under reversed join-row order", async () => {
    // buildShowflowExport select() order: 1 getRecordPrefix, 2 submissions,
    // 3 breaks (schedule_break, DEC-022 amendment wave 66), 4 slotRows,
    // 5 trackJoinRows, 6 participantRows, 7 presentationFiles.
    const submissions = [{ id: "sub-1", seq: 1, title: "Talk 1", description: "" }];
    const slotRows = [{ submissionId: "sub-1", day: "2026-06-01", startMin: 540, endMin: 570, roomName: "Room A" }];
    const trackRowsA = [
      { submissionId: "sub-1", trackName: "Platform" },
      { submissionId: "sub-1", trackName: "Keynote" },
    ];
    const trackRowsB = [...trackRowsA].reverse();
    const participantRowsA = [
      { submissionId: "sub-1", order: 0, contactId: "c-b", firstName: "Bob", lastName: "B" },
      { submissionId: "sub-1", order: 0, contactId: "c-a", firstName: "Alice", lastName: "A" },
    ];
    const participantRowsB = [...participantRowsA].reverse();

    const queue = (trackRows: unknown[], participantRows: unknown[]) => [
      [{ recordPrefix: "SES" }],
      submissions,
      [], // breaks
      slotRows,
      trackRows,
      participantRows,
      [],
    ];

    const showflowA = await buildShowflowExport(fakeDb(queue(trackRowsA, participantRowsA)), "event-1");
    const showflowB = await buildShowflowExport(fakeDb(queue(trackRowsB, participantRowsB)), "event-1");

    expect(toCsv([showflowA.header, ...showflowA.rows])).toBe(toCsv([showflowB.header, ...showflowB.rows]));
  });

  it("shapeShowflowExport: byte-identical CSV under reversed input order, unscheduled rows ordered by seq", () => {
    const inputs: ShowflowExportInput[] = [
      { ref: "SES-003", title: "Unscheduled", description: "", day: null, startMin: null, endMin: null, room: null, tracks: [], speakers: [], deckFile: "", deckUrl: "", seq: 3 },
      { ref: "SES-002", title: "Room B", description: "", day: "2026-06-01", startMin: 570, endMin: 600, room: "Room B", tracks: [], speakers: [], deckFile: "", deckUrl: "", seq: 2 },
      { ref: "SES-001", title: "Room A", description: "", day: "2026-06-01", startMin: 540, endMin: 570, room: "Room A", tracks: [], speakers: [], deckFile: "", deckUrl: "", seq: 1 },
      { ref: "SES-006", title: "Unscheduled 2", description: "", day: null, startMin: null, endMin: null, room: null, tracks: [], speakers: [], deckFile: "", deckUrl: "", seq: 6 },
    ];
    const reversed = [...inputs].reverse();

    const tableA = shapeShowflowExport(inputs);
    const tableB = shapeShowflowExport(reversed);
    expect(toCsv([tableA.header, ...tableA.rows])).toBe(toCsv([tableB.header, ...tableB.rows]));
    expect(tableA.rows.map((r) => r[0])).toEqual(["SES-001", "SES-002", "SES-003", "SES-006"]);
  });
});

describe("DEC-560: evaluations export — SQL total order (submission seq, reviewer id, round, evaluation id)", () => {
  it("wires .orderBy() with the exact columns, in order, by identity", async () => {
    const orderByLog: unknown[][][] = [];
    const db = fakeDb([[{ recordPrefix: "SES" }], []], orderByLog);
    await buildExport(db, "event-1", "evaluations");

    // Second select() call is the main evaluations query.
    const orderByArgs = orderByLog[1]![0]!;
    expect(orderByArgs).toHaveLength(4);
    const cols = (orderByArgs as any[]).map((o) => o.queryChunks[1]);
    expect(cols).toEqual([schema.submission.seq, schema.evaluation.reviewerId, schema.evaluation.round, schema.evaluation.id]);
    const dirs = (orderByArgs as any[]).map((o) => o.queryChunks[2].value[0]);
    expect(dirs).toEqual([" asc", " asc", " asc", " asc"]);
    // Sanity: these are literally the DEC-560 asc(...) helpers, not desc.
    expect(orderByArgs[0]).toEqual(asc(schema.submission.seq));
  });
});

describe("DEC-560: email-log export — SQL total order (sentAt desc, id desc)", () => {
  it("wires .orderBy() with the exact columns/direction, in order, by identity", async () => {
    const orderByLog: unknown[][][] = [];
    const db = fakeDb([[]], orderByLog);
    await buildExport(db, "event-1", "email-log");

    const orderByArgs = orderByLog[0]![0]!;
    expect(orderByArgs).toHaveLength(2);
    const cols = (orderByArgs as any[]).map((o) => o.queryChunks[1]);
    expect(cols).toEqual([schema.emailLog.sentAt, schema.emailLog.id]);
    expect(orderByArgs[0]).toEqual(desc(schema.emailLog.sentAt));
    expect(orderByArgs[1]).toEqual(desc(schema.emailLog.id));
  });
});
