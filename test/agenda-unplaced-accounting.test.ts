// DEC-615 (wave 43 amendment): a session with a persisted schedule_slot
// whose day falls OUTSIDE the event's [startDate, endDate] window must be
// (a) named in unplacedReasons with reason 'slot_outside_event_range',
// (b) excluded from `existing` so it can never suppress a conflict or
// occupy a room-slot in the placer's occupancy index, and (c) accounted for
// exactly by runAutoSchedule's unplacedReasons.length === summary.unplaced
// invariant. Closes ledger 0195's autoSchedule320 FAIL
// (unplacedTotal=298 vs reasons.length=237).
import { describe, expect, it } from "vitest";
import { runAutoSchedule } from "../src/server/repo/agenda";
import { describeUnplaced, type UnplacedLabels } from "../src/domain/schedule";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

// Same fake-db idiom as test/agenda-repo.test.ts's DEC-974 describe block:
// a table-keyed select() plus an insert().values().onConflictDoNothing()
// that actually appends to the mutable persistedSlots array, so a real
// runAutoSchedule placement is visible to the getAgendaPayload call it
// makes right after persisting.
function makeFakeDb(opts: {
  rooms: { id: string }[];
  submissions: { id: string; seq: number; title: string }[];
  slots: { submission_id: string; room_id: string | null; day: string; start_min: number; end_min: number }[];
}) {
  const persistedSlots = opts.slots.map((s) => ({
    submissionId: s.submission_id,
    roomId: s.room_id,
    day: s.day,
    startMin: s.start_min,
    endMin: s.end_min,
  }));

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.room) return opts.rooms;
    if (table === schema.track) return [];
    if (table === schema.submission) return opts.submissions;
    if (table === schema.submissionTrack) return [];
    if (table === schema.participant) return [];
    if (table === schema.scheduleSlot) return persistedSlots;
    if (table === schema.submissionAnswer) return [];
    return [];
  }

  const insertCalls: { table: unknown; rows: unknown[] }[] = [];

  const db = {
    select: () => {
      let table: unknown;
      const chain: any = {
        from: (t: unknown) => {
          table = t;
          return chain;
        },
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: async () => rowsFor(table),
        then: (resolve: (v: unknown[]) => void) => resolve(rowsFor(table)),
      };
      return chain;
    },
    insert: (table: unknown) => ({
      values: (rows: unknown) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        insertCalls.push({ table, rows: arr });
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              if (table === schema.scheduleSlot) {
                for (const r of arr as {
                  submissionId: string;
                  roomId: string | null;
                  day: string;
                  startMin: number;
                  endMin: number;
                }[]) {
                  persistedSlots.push({
                    submissionId: r.submissionId,
                    roomId: r.roomId,
                    day: r.day,
                    startMin: r.startMin,
                    endMin: r.endMin,
                  });
                }
                return (arr as { submissionId: string }[]).map((r) => ({ submissionId: r.submissionId }));
              }
              return [];
            },
          }),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  } as unknown as Db;

  return { db, insertCalls };
}

const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-12", recordPrefix: "EV" };
const params = { dayStartMin: 540, dayEndMin: 1080, defaultDurationMin: 30, gridMin: 15 };

describe("DEC-615 wave-43: out-of-range slots are named unplaced, never silently dropped", () => {
  it("(a) a slot whose day falls outside the event range appears in unplacedReasons with reason 'slot_outside_event_range'", async () => {
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }],
      submissions: [{ id: "sub-1", seq: 1, title: "Stale Talk" }],
      // Event range is 2026-08-10..2026-08-12; this slot's day is outside it.
      slots: [{ submission_id: "sub-1", room_id: "room-a", day: "2026-08-20", start_min: 540, end_min: 600 }],
    });

    const payload = await runAutoSchedule(db, "event1", event as any, params);

    expect(payload.unplacedReasons).toHaveLength(1);
    expect(payload.unplacedReasons[0]?.submissionId).toBe("sub-1");
    expect(payload.unplacedReasons[0]?.reason).toBe("slot_outside_event_range");
  });

  it("(b) the out-of-range session is absent from `placed` and never occupies a room/day it would otherwise conflict on", async () => {
    // sub-1 holds an out-of-range slot in room-a on 2026-08-20 (outside the
    // event window). sub-2 is unscheduled and would need room-a on the
    // in-range day 2026-08-10 at the same time — if sub-1's stale slot were
    // still occupying the placer's room-a index, this would collide; since
    // it must be excluded, sub-2 places cleanly.
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }],
      submissions: [
        { id: "sub-1", seq: 1, title: "Stale Talk" },
        { id: "sub-2", seq: 2, title: "Fresh Talk" },
      ],
      slots: [{ submission_id: "sub-1", room_id: "room-a", day: "2026-08-20", start_min: 540, end_min: 600 }],
    });

    const payload = await runAutoSchedule(db, "event1", event as any, params);

    expect(payload.placed.map((p) => p.submissionId)).not.toContain("sub-1");
    const placedSub2 = payload.placed.find((p) => p.submissionId === "sub-2");
    expect(placedSub2).toBeTruthy();
    expect(placedSub2?.day).toBe("2026-08-10");
    expect(placedSub2?.roomId).toBe("room-a");
  });

  it("(c) mixed fixture (in-range placed + out-of-range + slotless placeable) -- unplacedReasons.length === summary.unplaced", async () => {
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }, { id: "room-b" }],
      submissions: [
        { id: "sub-1", seq: 1, title: "In Range" }, // already placed, in range
        { id: "sub-2", seq: 2, title: "Out Of Range" }, // slotted, out of range
        { id: "sub-3", seq: 3, title: "Slotless Placeable" }, // no slot, will place
      ],
      slots: [
        { submission_id: "sub-1", room_id: "room-a", day: "2026-08-10", start_min: 540, end_min: 600 },
        { submission_id: "sub-2", room_id: "room-b", day: "2026-08-25", start_min: 540, end_min: 600 },
      ],
    });

    const payload = await runAutoSchedule(db, "event1", event as any, params);

    expect(payload.unplacedReasons.length).toBe(payload.summary.unplaced);
    // sub-2 is the only unplaced one (sub-1 stays placed, sub-3 gets placed).
    expect(payload.unplacedReasons.map((r) => r.submissionId)).toEqual(["sub-2"]);
    expect(payload.summary.unplaced).toBe(1);
  });

  it("(d) NEGATIVE CONTROL: an in-range slot never yields 'slot_outside_event_range' and stays credited as existing/placed", async () => {
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }],
      submissions: [{ id: "sub-1", seq: 1, title: "In Range Talk" }],
      slots: [{ submission_id: "sub-1", room_id: "room-a", day: "2026-08-11", start_min: 540, end_min: 600 }],
    });

    const payload = await runAutoSchedule(db, "event1", event as any, params);

    expect(payload.unplacedReasons).toEqual([]);
    expect(payload.placed.map((p) => p.submissionId)).toContain("sub-1");
    expect(payload.summary.unplaced).toBe(0);
  });
});

describe("DEC-615 wave-43: describeUnplaced renders slot_outside_event_range copy naming the session", () => {
  it("names the session title and points at the date-range mismatch", () => {
    const labels: UnplacedLabels = {
      titleBySubmissionId: new Map([["sub-1", "Stale Talk"]]),
      speakerNameByContactId: new Map(),
    };
    const detail = describeUnplaced("slot_outside_event_range", labels, {
      submissionId: "sub-1",
      durationMin: 30,
    });
    expect(detail).toContain("Stale Talk");
    expect(detail.toLowerCase()).toContain("date range");
  });
});
