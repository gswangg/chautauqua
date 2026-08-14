// DEC-492 (wave 46 amendment): auto-schedule's bulk slot write obeys the
// single-slot writer's atomicity rule (each chunk is one
// .onConflictDoNothing().returning() statement, never a read-then-write
// race) and its write-burst cap reports every placement it drops rather
// than silently discarding it.

import { describe, expect, it } from "vitest";
import { runAutoSchedule, MAX_AUTO_SCHEDULE_PLACEMENTS } from "../src/server/repo/agenda";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

/** Stateful fake db: schedule_slot rows live in a mutable Map, consulted
 * both by the "read" side (loadAcceptedSessions' select, getAgendaPayload)
 * and the "write" side (onConflictDoNothing's uniqueness check) — so a run
 * that persists a slot is visible to the NEXT call against the same db. */
function makeStatefulFakeDb(opts: {
  rooms: string[];
  submissionIds: string[];
  // Rows already "written" at the time each test scenario is set up
  // (simulates pre-existing / concurrently-written schedule_slot rows).
  preExisting?: { submissionId: string; roomId: string | null; day: string; startMin: number; endMin: number }[];
  // Submission ids to omit ONLY from the very first schedule_slot select
  // (loadAcceptedSessions' read) — models a row that a concurrent writer
  // committed strictly AFTER this run's read but BEFORE this run's write.
  omitFromFirstRead?: Set<string>;
}) {
  const submissionRows = opts.submissionIds.map((id, i) => ({ id, seq: i + 1, title: `Talk ${i + 1}` }));
  const slots = new Map<string, { submissionId: string; roomId: string | null; day: string; startMin: number; endMin: number }>();
  for (const row of opts.preExisting ?? []) slots.set(row.submissionId, row);

  const insertCalls: { table: unknown; rows: unknown[] }[] = [];
  const updateCalls: { table: unknown }[] = [];
  let scheduleSlotSelectCount = 0;

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.room) return opts.rooms.map((id) => ({ id }));
    if (table === schema.track) return [];
    if (table === schema.submission) return submissionRows;
    if (table === schema.submissionTrack) return [];
    if (table === schema.participant) return [];
    if (table === schema.scheduleSlot) {
      scheduleSlotSelectCount += 1;
      const all = [...slots.values()];
      if (scheduleSlotSelectCount === 1 && opts.omitFromFirstRead) {
        return all.filter((r) => !opts.omitFromFirstRead!.has(r.submissionId));
      }
      return all;
    }
    if (table === schema.submissionAnswer) return [];
    if (table === schema.scheduleBreak) return [];
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
        insertCalls.push({ table, rows: arr });
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              if (table !== schema.scheduleSlot) return [];
              const written: { submissionId: string }[] = [];
              for (const r of arr as {
                submissionId: string;
                roomId: string | null;
                day: string;
                startMin: number;
                endMin: number;
              }[]) {
                // Simulates the unique index on schedule_slot.submission_id:
                // a row already present is left untouched (onConflictDoNothing).
                if (slots.has(r.submissionId)) continue;
                slots.set(r.submissionId, r);
                written.push({ submissionId: r.submissionId });
              }
              return written;
            },
          }),
        };
      },
    }),
    update: (table: unknown) => ({
      set: () => ({
        where: async () => {
          updateCalls.push({ table });
        },
      }),
    }),
  } as unknown as Db;

  return { db, insertCalls, updateCalls, slots };
}

describe("runAutoSchedule persistence (DEC-492 wave-46 amendment)", () => {
  it("running auto-schedule twice over the same unplaced set is idempotent: no duplicate row, second run bumps no sequences", async () => {
    const { db, insertCalls, updateCalls, slots } = makeStatefulFakeDb({
      rooms: ["room-a"],
      submissionIds: ["sub-1"],
    });
    const params = { dayStartMin: 0, dayEndMin: 600, defaultDurationMin: 30, gridMin: 15 };

    await runAutoSchedule(db, "event1", event as any, params);
    expect(insertCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
    expect(slots.size).toBe(1);

    insertCalls.length = 0;
    updateCalls.length = 0;

    await runAutoSchedule(db, "event1", event as any, params);
    // sub-1 is now already scheduled -- the second run sees it via
    // loadAcceptedSessions and never re-attempts to place/write it.
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
    expect(slots.size).toBe(1);
  });

  it("a submission whose slot was written between the read and the write is left untouched", async () => {
    // sub-race is unscheduled per the (stale) read the accepted-session
    // loader sees -- loadAcceptedSessions' schedule_slot select is the
    // FIRST such select this run issues, and omitFromFirstRead makes it
    // miss the row a concurrent writer already committed. autoSchedule
    // therefore computes a placement for sub-race, but by the time this
    // run's insert executes, the row already exists; onConflictDoNothing
    // must leave it exactly as the concurrent writer left it and never
    // bump it.
    const raceRow = { submissionId: "sub-race", roomId: "room-b", day: "2026-08-10", startMin: 100, endMin: 130 };
    const { db, insertCalls, updateCalls, slots } = makeStatefulFakeDb({
      rooms: ["room-a"],
      submissionIds: ["sub-race"],
      preExisting: [raceRow],
      omitFromFirstRead: new Set(["sub-race"]),
    });

    const params = { dayStartMin: 0, dayEndMin: 600, defaultDurationMin: 30, gridMin: 15 };
    await expect(runAutoSchedule(db, "event1", event as any, params)).resolves.toBeTruthy();

    // The placer attempted to place sub-race (its stale read saw it as
    // unscheduled) and this run's insert chunk includes it...
    expect(insertCalls).toHaveLength(1);
    expect((insertCalls[0]!.rows as { submissionId: string }[]).some((r) => r.submissionId === "sub-race")).toBe(
      true,
    );
    // ...but onConflictDoNothing excluded it from the WRITTEN set, so it is
    // never bumped and its pre-existing row is left byte-for-byte alone.
    expect(updateCalls).toHaveLength(0);
    expect(slots.get("sub-race")).toEqual(raceRow);
  });

  it(
    "a run whose placement count exceeds the write cap reports every dropped placement as write_cap_reached with its real duration",
    async () => {
      const overflow = 5;
      const n = MAX_AUTO_SCHEDULE_PLACEMENTS + overflow;
      const submissionIds = Array.from({ length: n }, (_, i) => `sub-${String(i).padStart(5, "0")}`);
      // Many rooms + a wide day window keeps the real greedy autoSchedule
      // engine's per-session scan cheap at this N (this is a
      // persistence/reporting test, not an autoSchedule performance test).
      const rooms = Array.from({ length: 50 }, (_, i) => `room-${i}`);
      const { db, insertCalls } = makeStatefulFakeDb({ rooms, submissionIds });

      const payload = await runAutoSchedule(db, "event1", event as any, {
        dayStartMin: 0,
        dayEndMin: 3000,
        defaultDurationMin: 1,
        gridMin: 1,
      });

      const totalInsertedRows = insertCalls.reduce((sum, c) => sum + c.rows.length, 0);
      expect(totalInsertedRows).toBe(MAX_AUTO_SCHEDULE_PLACEMENTS);

      const capped = payload.unplacedReasons.filter((u) => u.reason === "write_cap_reached");
      expect(capped).toHaveLength(overflow);
      for (const u of capped) {
        expect(u.durationMin).toBe(1);
        expect(u.detail).toMatch(/write cap/i);
        expect(u.detail).toMatch(/re-run auto-schedule/i);
      }
    },
    20000,
  );
});
