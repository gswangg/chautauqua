// DEC-615 (wave 47 amendment): runAutoSchedule's unplaced-reason accounting
// is a SECOND read (getAgendaPayload) taken after the write, over a
// population any concurrent accept/unaccept/slot edit can change. A length
// comparison against that second read let a benign concurrent edit surface
// as an uncaught 500, and let two compensating differences cancel silently.
// Closes the CONFIRMED-DEFECT filed by docs/verification-log/index/0233
// claim 1. This suite exercises both arms of the set-based, snapshot-scoped
// reconciliation with the fakeDb harness from test/agenda-unplaced-accounting.test.ts:
// (1) an id OUTSIDE this run's own snapshot diverging surfaces as
//     'changed_during_run', never throws;
// (2) an id INSIDE this run's own snapshot diverging is still a genuine
//     accounting bug and still throws.
import { describe, expect, it } from "vitest";
import { runAutoSchedule } from "../src/server/repo/agenda";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

/** Same fake-db idiom as test/agenda-unplaced-accounting.test.ts, extended
 * with PER-TABLE call sequencing: schema.submission and schema.scheduleSlot
 * can be given a call-indexed array of row-sets so a test can simulate a
 * concurrent writer's edit landing BETWEEN runAutoSchedule's own read (call
 * 1, at auto-schedule.ts:54) and getAgendaPayload's second read (call 2, at
 * auto-schedule.ts:158) -- both go through the SAME loadAcceptedSessions,
 * so both tables are queried exactly once per call. */
function makeFakeDb(opts: {
  rooms: { id: string }[];
  submissionCalls: { id: string; seq: number; title: string }[][];
  scheduleSlotCalls: {
    submission_id: string;
    room_id: string | null;
    day: string;
    start_min: number;
    end_min: number;
  }[][];
}) {
  const persistedSlots: {
    submissionId: string;
    roomId: string | null;
    day: string;
    startMin: number;
    endMin: number;
  }[] = [];

  let submissionCallIdx = 0;
  let scheduleSlotCallIdx = 0;

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.room) return opts.rooms;
    if (table === schema.track) return [];
    if (table === schema.submission) {
      const calls = opts.submissionCalls;
      const idx = Math.min(submissionCallIdx, calls.length - 1);
      submissionCallIdx += 1;
      return calls[idx] ?? [];
    }
    if (table === schema.submissionTrack) return [];
    if (table === schema.participant) return [];
    if (table === schema.scheduleSlot) {
      const calls = opts.scheduleSlotCalls;
      const idx = Math.min(scheduleSlotCallIdx, calls.length - 1);
      scheduleSlotCallIdx += 1;
      const fixture = calls[idx] ?? [];
      return [
        ...fixture.map((s) => ({
          submissionId: s.submission_id,
          roomId: s.room_id,
          day: s.day,
          startMin: s.start_min,
          endMin: s.end_min,
        })),
        // Any slot this run itself persisted mid-run is also visible to the
        // second read, exactly as in production.
        ...persistedSlots,
      ];
    }
    if (table === schema.submissionAnswer) return [];
    return [];
  }

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

  return { db };
}

const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-12", recordPrefix: "EV" };
const params = { dayStartMin: 540, dayEndMin: 1080, defaultDurationMin: 30, gridMin: 15 };

describe("DEC-615 wave-47: unplaced accounting is set-based and snapshot-scoped", () => {
  it("an id OUTSIDE this run's own snapshot appearing unplaced in the second read surfaces as 'changed_during_run', never throws", async () => {
    // Run's own read (call 1): only sub-1, unscheduled, one free room -- it
    // places cleanly with no unplaced reason.
    // Second read inside getAgendaPayload (call 2): a concurrent writer has
    // ALSO accepted sub-2 mid-run. sub-2 never went through this run's
    // autoSchedule() call, so it carries no reason of its own -- yet it is
    // unscheduled in the payload. It was never part of this run's snapshot,
    // so this is a benign concurrent edit, not an accounting bug.
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }],
      submissionCalls: [
        [{ id: "sub-1", seq: 1, title: "Run's Own Talk" }],
        [
          { id: "sub-1", seq: 1, title: "Run's Own Talk" },
          { id: "sub-2", seq: 2, title: "Added Mid-Run" },
        ],
      ],
      scheduleSlotCalls: [[], []],
    });

    const payload = await runAutoSchedule(db, "event1", event as any, params);

    expect(payload.placed.map((p) => p.submissionId)).toContain("sub-1");
    expect(payload.unplacedReasons).toHaveLength(1);
    expect(payload.unplacedReasons[0]?.submissionId).toBe("sub-2");
    expect(payload.unplacedReasons[0]?.reason).toBe("changed_during_run");
    expect(payload.unplacedReasons[0]?.detail.toLowerCase()).toContain("run again");
    expect(payload.unplacedReasons.length).toBe(payload.summary.unplaced);
  });

  it("an id INSIDE this run's own snapshot diverging between reads is a genuine accounting bug and still throws", async () => {
    // sub-1 is accepted in BOTH submission reads (same snapshot). In the
    // run's own read (call 1) it already carries a persisted, in-range
    // slot -- it classifies as 'existing', is never handed to autoSchedule,
    // and gets no unplaced reason. Between this run's read and
    // getAgendaPayload's second read, a concurrent writer removes that
    // slot (call 2 returns no slot for sub-1). The payload now counts
    // sub-1 as unscheduled, but sub-1 WAS part of this run's own snapshot
    // and carries no reason -- the reconciliation must throw rather than
    // silently invent a reason for an id it read as already-placed.
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }],
      submissionCalls: [
        [{ id: "sub-1", seq: 1, title: "Slot Removed Mid-Run" }],
        [{ id: "sub-1", seq: 1, title: "Slot Removed Mid-Run" }],
      ],
      scheduleSlotCalls: [
        [{ submission_id: "sub-1", room_id: "room-a", day: "2026-08-10", start_min: 540, end_min: 600 }],
        [],
      ],
    });

    await expect(runAutoSchedule(db, "event1", event as any, params)).rejects.toThrow(
      /reason accounting has diverged/,
    );
  });
});
