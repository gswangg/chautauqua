// DEC-829 (wave-59 amendment): getOnboardingGrid must not early-return an
// empty envelope just because the event has zero task rows -- a speaker
// pushed onto a fresh event (accepted submission + participant, no tasks
// created yet) must still show up as a roster row. Modelled on the
// fake-db-queue pattern in test/onboarding-grid-driving-relation.test.ts /
// test/onboarding-grid-pagination.test.ts (no D1 test harness exists in
// stage 1).

import { describe, expect, it } from "vitest";
import { getOnboardingGrid, type OnboardingGridParams } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

interface RecordedCall {
  where?: unknown;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const calls: RecordedCall[] = [];
  const db = {
    select: () => {
      const current: RecordedCall = {};
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
        groupBy: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
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

const EVENT_ROW = [{ recordPrefix: "SES", timezone: "America/New_York" }];
const ONE_CONTACT = [
  { id: "c1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: null, userId: null },
];
const ONE_PARTICIPATION = [
  {
    contactId: "c1",
    participantId: "participant-c1-1",
    submissionId: "submission-c1-1",
    submissionSeq: 1,
    submissionTitle: "Talk 1",
    inviteStatus: "accepted",
  },
];

describe("getOnboardingGrid: a taskless event still shows its roster (DEC-829 wave-59 amendment)", () => {
  it("returns one row/total 1/counts.speakers 1 for an accepted submission + participant with zero task rows", async () => {
    // DEC-370 (wave-62 amendment): getOnboardingGrid now issues its reads in
    // three concurrent waves (WAVE 1 = tasks/event/speakers/counts, WAVE 2 =
    // total/contacts/overdue, WAVE 3 = participations+cells chunk loops), so
    // this call-order-based queue is ordered 0=tasks, 1=event, 2=speakers,
    // 3=counts, 4=total, 5=contacts, 6=overdue, 7=participations. cellRows is
    // skipped: taskIds.length === 0.
    const { db, calls } = fakeDb([
      [], // taskRows: zero tasks
      EVENT_ROW, // event lookup
      [{ count: 1 }], // speakersCountRows
      [{ outstandingRequired: 0, outstandingContacts: 0 }], // countsRow
      [{ count: 1 }], // totalRows
      ONE_CONTACT, // contactRows (page)
      [{ count: 0 }], // overdueCountRows
      ONE_PARTICIPATION, // participations for the page
    ]);

    const result = await getOnboardingGrid(db, "event-1", baseParams());

    expect(result.tasks).toEqual([]);
    expect(result.total).toBe(1);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.contact.id).toBe("c1");
    expect(result.rows[0]?.cells).toEqual([]);
    expect(result.counts.speakers).toBe(1);

    // No cellRows select was issued (taskIds.length === 0 guards it): tasks,
    // event, speakers, counts, total, contacts, overdue, participations == 8.
    expect(calls.length).toBe(8);
  });
});
