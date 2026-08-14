// DEC-492: bumpIcsSequences is ONE atomic, set-based UPDATE per chunkIds()
// batch (never a read-then-write race), and runAutoSchedule's write burst is
// bounded/chunked (chunked inserts + one bumpIcsSequences call) rather than
// 2N serial statements for N placements.

import { describe, expect, it } from "vitest";
import { bumpIcsSequences } from "../src/server/repo/ics-sequence";
import { runAutoSchedule, MAX_AUTO_SCHEDULE_PLACEMENTS } from "../src/server/repo/agenda";
import * as schema from "../src/db/schema";
import { ID_CHUNK_SIZE, MAX_D1_BOUND_PARAMS } from "../src/lib/chunk";

// DEC-528: scheduleSlot inserts are chunked by bound-parameter budget
// (columns-per-row derived from the row shape: id, submissionId, roomId,
// day, startMin, endMin, createdAt, updatedAt = 8 columns), independently
// of ID_CHUNK_SIZE which still governs the bumpIcsSequences id-list chunks.
const SCHEDULE_SLOT_COLUMNS = 8;
const SCHEDULE_SLOT_ROWS_PER_CHUNK = Math.floor((MAX_D1_BOUND_PARAMS - 10) / SCHEDULE_SLOT_COLUMNS);
import type { Db } from "../src/server/context";

// Minimal fake db that records every select/insert/update statement issued,
// resolving select() rows by which schema table .from()/.innerJoin() named
// (mirrors the established pattern in test/agenda-room-ownership.test.ts,
// but table-keyed instead of call-order-keyed since runAutoSchedule fans out
// across many chunked selects).
function makeFakeDb(opts: { rooms: string[]; submissionIds: string[] }) {
  const insertCalls: { table: unknown; rows: unknown[] }[] = [];
  const updateCalls: { table: unknown; setValue: unknown; where: unknown }[] = [];

  const submissionRows = opts.submissionIds.map((id, i) => ({ id, seq: i + 1, title: `Talk ${i + 1}` }));

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.room) return opts.rooms.map((id) => ({ id }));
    if (table === schema.track) return [];
    if (table === schema.submission) return submissionRows;
    if (table === schema.submissionTrack) return [];
    if (table === schema.participant) return [];
    if (table === schema.scheduleSlot) return [];
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
            returning: async () =>
              table === schema.scheduleSlot
                ? (arr as { submissionId: string }[]).map((r) => ({ submissionId: r.submissionId }))
                : [],
          }),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (setValue: unknown) => ({
        where: async (where: unknown) => {
          updateCalls.push({ table, setValue, where });
        },
      }),
    }),
  } as unknown as Db;

  return { db, insertCalls, updateCalls };
}

describe("bumpIcsSequences (DEC-492: atomic set-based bump)", () => {
  it("is a no-op for empty input (no statements issued)", async () => {
    const { db, updateCalls } = makeFakeDb({ rooms: [], submissionIds: [] });
    await bumpIcsSequences(db, []);
    expect(updateCalls).toHaveLength(0);
  });

  it("dedupes ids and issues exactly one UPDATE per chunkIds() batch", async () => {
    const ids = Array.from({ length: ID_CHUNK_SIZE + 5 }, (_, i) => `sub-${i}`);
    // Duplicate every id once — dedupe must collapse this back to ids.length
    // unique submissions before chunking, not double it.
    const { db, updateCalls } = makeFakeDb({ rooms: [], submissionIds: [] });
    await bumpIcsSequences(db, [...ids, ...ids]);
    // ID_CHUNK_SIZE+5 unique ids -> 2 chunks (90, 5) -> exactly 2 UPDATEs,
    // never one per submission (which would be ID_CHUNK_SIZE+5 = 95).
    expect(updateCalls).toHaveLength(2);
    for (const call of updateCalls) {
      expect(call.table).toBe(schema.submission);
    }
  });

  it("increments in place via a SQL expression, never a read-then-write literal", async () => {
    const { db, updateCalls } = makeFakeDb({ rooms: [], submissionIds: [] });
    await bumpIcsSequences(db, ["sub-1"]);
    expect(updateCalls).toHaveLength(1);
    const setValue = updateCalls[0]?.setValue as { icsSequence: unknown };
    // A read-then-write bump would pass a plain number here (current + 1);
    // the atomic bump passes a drizzle SQL fragment instead.
    expect(typeof setValue.icsSequence).not.toBe("number");
    expect(setValue.icsSequence).toBeTypeOf("object");
  });
});

describe("runAutoSchedule write burst (DEC-492: chunked inserts, one bump call)", () => {
  it("issues O(N/chunk) inserts and O(N/chunk) bump updates for N placements, never 2N statements", async () => {
    const n = ID_CHUNK_SIZE * 2 + 10; // 190 -> 3 insert chunks, 3 bump chunks
    const submissionIds = Array.from({ length: n }, (_, i) => `sub-${i}`);
    const { db, insertCalls, updateCalls } = makeFakeDb({ rooms: ["room1"], submissionIds });

    const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };
    const payload = await runAutoSchedule(db, "event1", event as any, {
      dayStartMin: 0,
      dayEndMin: 100000,
      defaultDurationMin: 1,
      gridMin: 1,
    });

    expect(payload).toBeTruthy();
    expect(n).toBeLessThanOrEqual(MAX_AUTO_SCHEDULE_PLACEMENTS);

    const expectedInsertChunks = Math.ceil(n / SCHEDULE_SLOT_ROWS_PER_CHUNK);
    const expectedBumpChunks = Math.ceil(n / ID_CHUNK_SIZE);
    expect(insertCalls).toHaveLength(expectedInsertChunks);
    expect(updateCalls).toHaveLength(expectedBumpChunks);
    // Old per-placement loop would have issued exactly n inserts + n updates
    // (2n total); the chunked version issues far fewer statements.
    expect(insertCalls.length + updateCalls.length).toBeLessThan(2 * n);

    const totalInsertedRows = insertCalls.reduce((sum, c) => sum + c.rows.length, 0);
    expect(totalInsertedRows).toBe(n);
  });

  it(
    "caps persisted placements at MAX_AUTO_SCHEDULE_PLACEMENTS, never throwing on overflow",
    async () => {
      const n = MAX_AUTO_SCHEDULE_PLACEMENTS + 50;
      const submissionIds = Array.from({ length: n }, (_, i) => `sub-${i}`);
      // Many rooms + a tight day window keeps the real greedy autoSchedule
      // engine's per-session scan cheap at this N (this is a persistence
      // write-burst test, not an autoSchedule performance test).
      const rooms = Array.from({ length: 50 }, (_, i) => `room-${i}`);
      const { db, insertCalls } = makeFakeDb({ rooms, submissionIds });

      const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };
      await expect(
        runAutoSchedule(db, "event1", event as any, {
          dayStartMin: 0,
          dayEndMin: 3000,
          defaultDurationMin: 1,
          gridMin: 1,
        }),
      ).resolves.toBeTruthy();

      const totalInsertedRows = insertCalls.reduce((sum, c) => sum + c.rows.length, 0);
      expect(totalInsertedRows).toBe(MAX_AUTO_SCHEDULE_PLACEMENTS);
    },
    20000,
  );
});
