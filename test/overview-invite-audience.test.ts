// DEC-512 participant invite-audience: both of getOverviewPayload's own
// participant reads (the placed-session speaker-clash fan-out and the
// combined lead-speaker lookup) must exclude a declined co-presenter, not
// just the already-blessed files-library.ts lookup. Uses the makeFakeDb
// response-queue + captured-where pattern already established in
// test/overview.test.ts (see "issues the DEC-558 total-order orderBy args"
// and "the overdue count query ... compose overdueAssignmentConditions
// verbatim" for the same style).
import { describe, it, expect } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { getOverviewPayload } from "../src/server/repo/overview";
import { ACTIVE_INVITE_STATUSES } from "../src/domain/acceptance";
import * as schema from "../src/db/schema";

const dialect = new SQLiteSyncDialect();
function sqlTextOf(cond: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(cond as any);
}

describe("getOverviewPayload: participant invite-audience (DEC-512)", () => {
  // Fixture shape mirrors test/overview.test.ts's "sizes each unplaced
  // row's suggestion..." case: one accepted+placed submission (s0) so the
  // placed-participant fan-out query fires, plus one unplaced accepted
  // submission (s1) so the combined lead-speaker lookup query fires.
  it("both the placed-session participant read and the lead-speaker lookup filter to ACTIVE_INVITE_STATUSES", async () => {
    const now = 1_735_999_999_999;
    const whereBySelectIndex: unknown[] = [];
    let selectIndex = -1;
    let cursor = 0;

    const responses = [
      [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // 0 event
      [], // 1 statusRows
      [{ count: 0 }], // 2 planCount
      [{ expected: 0, submitted: 0 }], // 3 evaluationsAgg
      [{ closeDate: null, currentRound: null }], // 4 planClose
      [{ closeDate: null }], // 5 formClose
      [], // 6 speakerAgg
      [{ count: 0 }], // 7 overdueAssignmentCount
      [], // 8 overdueDetail
      [], // 9 triageDetail
      [{ total: 0, reuploaded: 0 }], // 10 contentAgg
      [], // 11 contentDetail
      [{ count: 1 }], // 12 unplacedCount (DEC-370 wave-56 amendment)
      [{ id: "s1", seq: 2, title: "Unplaced Talk" }], // 13 unplacedDetail
      [{ submissionId: "s0", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600, seq: 1, title: "Placed Talk" }], // 14 slotRows
      [], // 15 DEC-370 wave-71 amendment: breaks for the event, joined into the slotRows wave
      [{ submissionId: "s0", contactId: "c-active" }], // 16 placed-participant rows
      [{ submissionId: "s1", order: 1, contactId: "c-active", firstName: "Ada", lastName: "Lovelace" }], // 17 lead-speaker rows
      [{ id: "room-a", name: "Room A" }], // 18 room-name rows
      [], // 19 format-answer rows for unplaced {s1}
      [{ sentLast7Days: 0, lastSentAt: null }], // 20 comms
      [{ count: 0 }], // 21 DEC-370 amendment (wave 5): publishedSessionCount
    ];

    function chain(): any {
      const myIndex = selectIndex;
      const obj: any = {};
      const passthrough = ["from", "innerJoin", "orderBy", "limit", "offset", "groupBy"];
      for (const m of passthrough) obj[m] = () => obj;
      obj.where = (cond: unknown) => {
        whereBySelectIndex[myIndex] = cond;
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
    const db = {
      select: () => {
        selectIndex += 1;
        return chain();
      },
    } as any;

    const payload = await getOverviewPayload(db, "event-1", now, "America/New_York");
    // Sanity: the payload actually ran the branches under test (a placed
    // session + an unplaced row with a resolved lead speaker name).
    expect(payload.agendaWork.unplaced).toHaveLength(1);
    expect(payload.agendaWork.unplaced[0]).toMatchObject({ submissionId: "s1", speakerName: "Ada Lovelace" });

    // 16: the placed+unplaced participant fan-out (DEC-895 amendment, w2-f:
    // batch of {s0, s1} -- placed ids then the capped unplaced ids, so a
    // placement suggestion's own occupancy check sees every active
    // participant, not just leads) must AND in the same
    // inArray(inviteStatus, ACTIVE_INVITE_STATUSES) predicate files-library.ts
    // already uses -- a declined co-presenter on either a placed submission
    // or an unplaced one must never produce a speaker clash.
    const expectedParticipantWhere = sqlTextOf(
      and(
        inArray(schema.participant.submissionId, ["s0", "s1"]),
        inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
      ),
    );
    const actualParticipantWhere = sqlTextOf(whereBySelectIndex[16]);
    expect(actualParticipantWhere.sql).toBe(expectedParticipantWhere.sql);
    expect(actualParticipantWhere.params).toEqual(expectedParticipantWhere.params);

    // 17: combined lead-speaker lookup (batch of the unplaced id set {s1})
    // must AND in the identical invite-status predicate alongside role=
    // 'speaker' -- a declined co-presenter must never be rendered as the
    // owning lead speaker.
    const expectedLeadWhere = sqlTextOf(
      and(
        inArray(schema.participant.submissionId, ["s1"]),
        eq(schema.participant.role, "speaker"),
        inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
      ),
    );
    const actualLeadWhere = sqlTextOf(whereBySelectIndex[17]);
    expect(actualLeadWhere.sql).toBe(expectedLeadWhere.sql);
    expect(actualLeadWhere.params).toEqual(expectedLeadWhere.params);
  });
});
