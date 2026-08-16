// DEC-370 (wave-71 amendment): the Overview worklist's conflict number and
// conflict rows must see the same breaks the Agenda grid does, computed
// exactly once. Before this fix, getOverviewPayload called findConflicts
// twice, neither time threaded with the event's breaks, so a session
// dragged onto a break was invisible on Overview while agenda/payload.ts's
// findConflicts(placedSessions, blocks) flagged it. This test seeds one
// accepted, placed submission whose slot fully overlaps one event break and
// asserts (a) Overview's agenda.conflicts count sees it, (b)
// agendaWork.conflicts carries exactly one row with kind 'break_overlap',
// and (c) that count matches what getAgendaPayload reports for the SAME
// fixture -- the divergence this closes.
import { describe, expect, it } from "vitest";
import { getOverviewPayload } from "../src/server/repo/overview";
import { getAgendaPayload } from "../src/server/repo/agenda";
import type { Db } from "../src/server/context";

// Fixture shared by both fake dbs below: one accepted submission (sub-1)
// placed in room-a on 2026-08-10 from 09:00-10:00 (540-600 min), with lead
// speaker c1, and one event break the same day from 09:30-10:00 (570-600
// min, durationMin 30) -- the break's window fully overlaps the back half
// of sub-1's slot.
const EVENT = { recordPrefix: "EV", startDate: "2026-08-10", endDate: "2026-08-10", orgId: "org1" };
const BREAK_ROW = {
  id: "break-1",
  eventId: "event1",
  day: "2026-08-10",
  label: "Lunch",
  location: null,
  startMin: 570,
  durationMin: 30,
  createdAt: new Date(1_700_000_000_000),
  updatedAt: new Date(1_700_000_000_000),
};

// Minimal fake db mirroring getOverviewPayload's sequential (Promise.all
// wave) select() calls -- see test/overview.test.ts's emptyResponses and
// test/overview-invite-audience.test.ts for the same response-queue style.
function makeOverviewDb(): Db {
  const responses: unknown[] = [
    [{ recordPrefix: EVENT.recordPrefix, startDate: EVENT.startDate }], // 0 event
    [], // 1 statusRows
    [{ count: 0 }], // 2 planCount
    [{ expected: 0, submitted: 0 }], // 3 evaluationsAgg
    [{ closeDate: null, currentRound: null }], // 4 planClose
    [{ closeDate: null }], // 5 formClose
    [{ outstandingContacts: 0, nextDue: null }], // 6 speakerAgg
    [{ count: 0 }], // 7 overdueAssignmentCount
    [], // 8 overdueDetail
    [], // 9 triageDetail
    [{ total: 0, reuploaded: 0 }], // 10 contentAgg
    [], // 11 contentDetail
    [{ count: 0 }], // 12 unplacedCount
    [], // 13 unplacedDetail
    [{ submissionId: "sub-1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600, seq: 1, title: "Talk One" }], // 14 slotRows
    [BREAK_ROW], // 15 breaks (DEC-370 wave-71 amendment: joined into the slotRows wave)
    [{ submissionId: "sub-1", contactId: "c1" }], // 16 placed-participant fan-out
    [{ submissionId: "sub-1", order: 0, contactId: "c1", firstName: "Casey", lastName: "Speaker" }], // 17 combined lead-speaker lookup
    [{ id: "room-a", name: "Room A" }], // 18 room-name rows
    [{ sentLast7Days: 0, lastSentAt: null }], // 19 comms
    [{ count: 0 }], // 20 publishedSessionCount
  ];
  let cursor = 0;
  function chain(): any {
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) obj[m] = () => obj;
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (cursor >= responses.length) {
        throw new Error(`makeOverviewDb: query #${cursor + 1} has no queued response`);
      }
      const value = responses[cursor];
      cursor += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { select: () => chain() } as unknown as Db;
}

// Minimal fake db mirroring getAgendaPayload's call sequence: rooms, tracks,
// submissionRows, breaks (DEC-557 wave-69 amendment joins breaks into that
// same wave), then loadAcceptedSessions' own trackRows/participantRows/
// slotRows wave -- see test/agenda-repo.test.ts's makeAgendaPayloadDb for
// the established pattern this mirrors.
function makeAgendaDb(): Db {
  let call = 0;
  function makeChain(rows: unknown[]): any {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }
  const db = {
    select: () => {
      call += 1;
      const thisCall = call;
      if (thisCall === 1) return makeChain([{ id: "room-a", name: "Room A" }]); // rooms
      if (thisCall === 2) return makeChain([]); // tracks
      if (thisCall === 3) return makeChain([{ id: "sub-1", seq: 1, title: "Talk One" }]); // submissionRows
      if (thisCall === 4) return makeChain([BREAK_ROW]); // scheduleBreak (listBreaksForEvent)
      if (thisCall === 5) return makeChain([]); // trackRows (submissionTrack)
      if (thisCall === 6)
        return makeChain([{ submissionId: "sub-1", contactId: "c1", firstName: "Casey", lastName: "Speaker", order: 0 }]); // participantRows
      return makeChain([{ submissionId: "sub-1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600 }]); // slotRows
    },
  } as unknown as Db;
  return db;
}

describe("getOverviewPayload conflicts see the event's breaks (DEC-370 wave-71 amendment)", () => {
  it("agenda.conflicts counts a session placed over a break, and agendaWork.conflicts carries exactly one break_overlap row", async () => {
    const now = 1_735_999_999_999;
    const payload = await getOverviewPayload(makeOverviewDb(), "event1", now, "America/New_York");

    expect(payload.agenda.conflicts).toBe(1);
    expect(payload.agendaWork.conflictTotal).toBe(1);
    expect(payload.agendaWork.conflicts).toHaveLength(1);
    expect(payload.agendaWork.conflicts[0]).toMatchObject({
      kind: "break_overlap",
      entries: [{ submissionId: "sub-1" }],
    });
  });

  it("Overview's conflict count equals Agenda's for the same fixture -- the divergence this closes", async () => {
    const now = 1_735_999_999_999;
    const overview = await getOverviewPayload(makeOverviewDb(), "event1", now, "America/New_York");
    const agenda = await getAgendaPayload(makeAgendaDb(), "event1", EVENT);

    expect(overview.agenda.conflicts).toBe(1);
    expect(agenda.summary.conflicts).toBe(1);
    expect(overview.agenda.conflicts).toBe(agenda.summary.conflicts);
  });
});
