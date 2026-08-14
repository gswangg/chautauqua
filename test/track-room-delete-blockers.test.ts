// DEC-931: deleteTrack/deleteRoom's 409 refusals must NAME their blocking
// rows (up to five, "... and N more" past that) instead of a bare class
// sentence, and the plan_reviewer track-scope check must be ONE query
// joining plan_reviewer to evaluation_plan on eventId — never a query per
// plan. Same fake-db pattern as test/track-delete-references.test.ts (no
// local sqlite/D1 test driver wired up for this repo layer).

import { describe, expect, it } from "vitest";
import { deleteTrack, deleteRoom } from "../src/server/repo/events";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
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

/** Builds a fake db that answers sequential select() calls from `selects`
 * (one array of rows per call, in call order) and supports a no-op
 * delete(). Also exposes `queryCount` (the number of top-level
 * `db.select(...)` calls made) for the round-trip-counting assertion. */
function fakeDb(selects: unknown[][]) {
  let call = 0;
  const deleteChain: any = { where: async () => undefined };
  const db = {
    select: () => {
      const rows = selects[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    delete: () => deleteChain,
  } as unknown as AppEnv["Variables"]["db"];
  return { db, queryCount: () => call };
}

const now = new Date();

const trackRow = {
  id: "track1",
  eventId: "event1",
  name: "Track One",
  color: null,
  position: 0,
  createdAt: now,
  updatedAt: now,
};

const roomRow = {
  id: "room1",
  eventId: "event1",
  name: "Main Stage",
  capacity: 200,
  position: 0,
  createdAt: now,
  updatedAt: now,
};

const eventRefFields = { recordPrefix: "TALK", timezone: "America/New_York" };

function planRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "plan1",
    eventId: "event1",
    name: "Plan",
    instructions: null,
    openDate: null,
    closeDate: null,
    filtersJson: null,
    anonymized: false,
    scaleJson: JSON.stringify({ min: 1, max: 5 }),
    criteriaJson: JSON.stringify([]),
    rounds: 1,
    currentRound: 1,
    roundCriteriaJson: null,
    maxEvaluations: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function formRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "form1",
    eventId: "event1",
    title: "CFP 2027",
    description: null,
    isDefault: true,
    openDate: null,
    closeDate: null,
    tracksJson: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function subRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ seq: i + 1, title: `Talk ${i + 1}` }));
}

describe("deleteTrack 409 refusal names its blocking rows (DEC-931)", () => {
  it("fields.submissions names up to five blocking submissions", async () => {
    const { db } = fakeDb([
      [trackRow], // getTrackForEvent
      [], // getTrackForEvent submissionCount agg
      [eventRefFields], // getEventRefFields
      subRows(5), // submissionTrack join submission, limit 5
      [{ count: 5 }], // bounded COUNT
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({
      status: 409,
      fields: { submissions: "TALK-001 - Talk 1; TALK-002 - Talk 2; TALK-003 - Talk 3; TALK-004 - Talk 4; TALK-005 - Talk 5" },
    });
  });

  it("fields.submissions appends '... and N more' when the true count exceeds five (7 blockers)", async () => {
    const { db } = fakeDb([
      [trackRow],
      [],
      [eventRefFields],
      subRows(5), // limit 5 -- only the first 5 rows are ever fetched
      [{ count: 7 }], // bounded COUNT reports the true total
    ]);
    let caught: any;
    try {
      await deleteTrack(db, "track1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.fields.submissions.split("; ")).toEqual([
      "TALK-001 - Talk 1",
      "TALK-002 - Talk 2",
      "TALK-003 - Talk 3",
      "TALK-004 - Talk 4",
      "TALK-005 - Talk 5",
      "... and 2 more",
    ]);
  });

  it("fields.form names the blocking form by title", async () => {
    const { db } = fakeDb([
      [trackRow],
      [],
      [eventRefFields],
      [], // no submissionTrack refs
      [formRow({ tracksJson: JSON.stringify(["track1"]) })], // findFormForEvent
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({
      status: 409,
      fields: { form: "CFP 2027" },
    });
  });

  it("fields.plans names up to five blocking plans, '... and N more' past five", async () => {
    const sevenPlans = Array.from({ length: 7 }, (_, i) => ({
      plan: planRow({ id: `plan${i}`, name: `Plan ${i + 1}`, filtersJson: JSON.stringify({ trackIds: ["track1"] }) }),
      timezone: "UTC",
    }));
    const { db } = fakeDb([
      [trackRow],
      [],
      [eventRefFields],
      [], // no submissionTrack refs
      [], // no form
      sevenPlans, // listPlansForEvent
    ]);
    let caught: any;
    try {
      await deleteTrack(db, "track1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.fields.plans.split("; ")).toEqual([
      "Plan 1",
      "Plan 2",
      "Plan 3",
      "Plan 4",
      "Plan 5",
      "... and 2 more",
    ]);
  });

  it("fields.reviewers names up to five blocking reviewer-scope rows, '... and N more' past five (7 blockers)", async () => {
    const fiveReviewerRows = Array.from({ length: 5 }, (_, i) => ({
      email: `reviewer${i + 1}@example.com`,
      planName: "Plan",
    }));
    const { db } = fakeDb([
      [trackRow],
      [],
      [eventRefFields],
      [], // no submissionTrack refs
      [], // no form
      [{ plan: planRow(), timezone: "UTC" }], // listPlansForEvent, no filter reference
      fiveReviewerRows, // plan_reviewer join evaluation_plan join user, limit 5
      [{ count: 7 }], // bounded COUNT reports the true total
    ]);
    let caught: any;
    try {
      await deleteTrack(db, "track1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    const names = caught.fields.reviewers.split("; ");
    expect(names).toHaveLength(6);
    expect(names[0]).toBe("reviewer1@example.com in 'Plan'");
    expect(names[5]).toBe("... and 2 more");
  });

  it("deletes cleanly, and issues a CONSTANT query count independent of the event's plan count (3 vs 30)", async () => {
    async function runWithPlanCount(n: number): Promise<number> {
      const plans = Array.from({ length: n }, (_, i) => ({ plan: planRow({ id: `plan${i}` }), timezone: "UTC" }));
      const { db, queryCount } = fakeDb([
        [trackRow],
        [],
        [eventRefFields],
        [], // no submissionTrack refs
        [], // no form
        plans, // listPlansForEvent -- unbounded read, but reviewer step below does not scale with it
        [], // plan_reviewer join evaluation_plan join user, limit 5 -- ONE query, no matches
        [], // embed select (DEC-931 amendment, w63-a) -- limit 5, no matches
      ]);
      await deleteTrack(db, "track1", "event1");
      return queryCount();
    }

    const small = await runWithPlanCount(3);
    const large = await runWithPlanCount(30);
    expect(small).toBe(large);
    expect(small).toBe(8);
  });
});

describe("deleteRoom 409 refusal names its blocking schedule slots (DEC-931)", () => {
  it("fields.slots names the blocking session as 'REF - Title (weekday day, HH:MM, Room name)' in the OWNING event's timezone", async () => {
    const { db } = fakeDb([
      [roomRow], // getRoomForEvent row
      [{ count: 0 }], // getRoomForEvent sessionCount agg (DEC-896 amendment, wave 26)
      [eventRefFields], // getEventRefFields (America/New_York)
      [{ seq: 12, title: "Keynote", day: "2027-05-12", startMin: 10 * 60 }], // scheduleSlot join submission, limit 5
      [{ count: 1 }], // bounded COUNT
    ]);
    let caught: any;
    try {
      await deleteRoom(db, "room1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.fields.slots).toBe("TALK-012 - Keynote (Wed 12, 10:00, Main Stage)");
  });

  it("fields.slots appends '... and N more' when the true count exceeds five (7 blockers)", async () => {
    const fiveSlots = Array.from({ length: 5 }, (_, i) => ({
      seq: i + 1,
      title: `Talk ${i + 1}`,
      day: "2027-05-12",
      startMin: 10 * 60,
    }));
    const { db } = fakeDb([
      [roomRow],
      [{ count: 0 }], // getRoomForEvent sessionCount agg
      [eventRefFields],
      fiveSlots, // limit 5
      [{ count: 7 }],
    ]);
    let caught: any;
    try {
      await deleteRoom(db, "room1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    const names = caught.fields.slots.split("; ");
    expect(names).toHaveLength(6);
    expect(names[5]).toBe("... and 2 more");
  });

  it("deletes cleanly when the room is wholly unreferenced", async () => {
    const { db } = fakeDb([
      [roomRow],
      [{ count: 0 }], // getRoomForEvent sessionCount agg
      [eventRefFields],
      [], // no schedule_slot refs
    ]);
    await expect(deleteRoom(db, "room1", "event1")).resolves.toBeUndefined();
  });
});
