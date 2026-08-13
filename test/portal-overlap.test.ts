// DEC-777 (wave 44 amendment): "the speaker sees their own clash" — the
// speaker portal must flag a speaker's own overlapping placed sessions,
// computed by running the SAME src/domain/schedule.ts findConflicts
// predicate the organizer agenda/conflict chips and auto-schedule pass use
// (never a second overlap implementation). Advisory only — this proves the
// repo-layer read (getMySessions) that feeds the inline "Overlaps <REF> ·
// <time>" flag rendered in src/routes/portal/index.tsx.
//
// Uses the same fake multi-table drizzle-shaped db harness as
// test/portal-sessions-event-range.test.ts (real join/where evaluator, not
// a JS post-filter), so getMySessions's actual SQL-building code runs.

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: readonly unknown[] }
  | { __marker: "gte"; col: unknown; val: unknown }
  | { __marker: "lte"; col: unknown; val: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: readonly unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    gte: (col: unknown, val: unknown): Marker => ({ __marker: "gte", col, val }),
    lte: (col: unknown, val: unknown): Marker => ({ __marker: "lte", col, val }),
  };
});

const { getMySessions } = await import("../src/server/repo/portal");

const TABLE_TAG = new Map<object, string>();
for (const [tag, val] of Object.entries(schema)) {
  if (val && typeof val === "object") TABLE_TAG.set(val as object, tag);
}

function colInfo(col: unknown): { tag: string; key: string } {
  for (const [tableObj, tag] of TABLE_TAG.entries()) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return { tag, key };
    }
  }
  throw new Error("fake db: condition referenced an unknown column");
}

function tryColInfo(val: unknown): { tag: string; key: string } | null {
  try {
    return colInfo(val);
  } catch {
    return null;
  }
}

type Rec = Record<string, Record<string, unknown> | undefined>;

function resolveJoinOperand(x: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): unknown {
  const info = tryColInfo(x);
  if (!info) return x;
  if (info.tag === joinTag) return joinRow[info.key];
  return rec[info.tag]?.[info.key];
}

function evalJoinCond(cond: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    return resolveJoinOperand(m.col, rec, joinRow, joinTag) === resolveJoinOperand(m.val, rec, joinRow, joinTag);
  }
  if (m.__marker === "and") return m.conds.every((c) => evalJoinCond(c, rec, joinRow, joinTag));
  if (m.__marker === "gte") {
    const a = resolveJoinOperand(m.col, rec, joinRow, joinTag) as string;
    const b = resolveJoinOperand(m.val, rec, joinRow, joinTag) as string;
    return a >= b;
  }
  if (m.__marker === "lte") {
    const a = resolveJoinOperand(m.col, rec, joinRow, joinTag) as string;
    const b = resolveJoinOperand(m.val, rec, joinRow, joinTag) as string;
    return a <= b;
  }
  throw new Error(`fake db: unsupported join condition ${JSON.stringify(cond)}`);
}

function evalWhereCond(cond: unknown, rec: Rec): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const info = colInfo(m.col);
    return rec[info.tag]?.[info.key] === m.val;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalWhereCond(c, rec));
  if (m.__marker === "inArray") {
    const info = colInfo(m.col);
    return m.vals.includes(rec[info.tag]?.[info.key]);
  }
  throw new Error(`fake db: unsupported where condition: ${JSON.stringify(cond)}`);
}

function project(records: Rec[], fields: Record<string, unknown>) {
  return records.map((rec) => {
    const out: Record<string, unknown> = {};
    for (const [outKey, col] of Object.entries(fields)) {
      const info = colInfo(col);
      out[outKey] = rec[info.tag]?.[info.key];
    }
    return out;
  });
}

function makeDb(dataByTag: Record<string, Record<string, unknown>[]>) {
  function rowsFor(table: unknown): { tag: string; rows: Record<string, unknown>[] } {
    const tag = TABLE_TAG.get(table as object);
    if (!tag) throw new Error("fake db: unknown table in from/join");
    return { tag, rows: dataByTag[tag] ?? [] };
  }

  function makeSelect(fields: Record<string, unknown>) {
    let records: Rec[] = [];
    let whereCond: unknown = null;
    const chain: any = {
      from(table: unknown) {
        const { tag, rows } = rowsFor(table);
        records = rows.map((r) => ({ [tag]: r }));
        return chain;
      },
      innerJoin(table: unknown, cond: unknown) {
        const { tag, rows } = rowsFor(table);
        const next: Rec[] = [];
        for (const rec of records) {
          for (const row of rows) {
            if (evalJoinCond(cond, rec, row, tag)) next.push({ ...rec, [tag]: row });
          }
        }
        records = next;
        return chain;
      },
      leftJoin(table: unknown, cond: unknown) {
        const { tag, rows } = rowsFor(table);
        const next: Rec[] = [];
        for (const rec of records) {
          const matches = rows.filter((row) => evalJoinCond(cond, rec, row, tag));
          if (matches.length === 0) next.push({ ...rec, [tag]: undefined });
          else for (const row of matches) next.push({ ...rec, [tag]: row });
        }
        records = next;
        return chain;
      },
      where(cond: unknown) {
        whereCond = cond;
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit: async (n: number) => {
        const filtered = whereCond ? records.filter((r) => evalWhereCond(whereCond, r)) : records;
        return project(filtered, fields).slice(0, n);
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try {
          const filtered = whereCond ? records.filter((r) => evalWhereCond(whereCond, r)) : records;
          resolve(project(filtered, fields));
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };
    return chain;
  }

  const db = {
    select: makeSelect,
    selectDistinct: makeSelect,
  };
  return db as unknown as Db;
}

// ---------------------------------------------------------------------------
// Fixture: one event, one room. contact-1 has three accepted+placed
// sessions — A and B overlap in time (same day/room-agnostic), C does not
// overlap either. contact-2 (a different speaker) has two overlapping
// placed sessions D/E of their own, entirely unrelated to contact-1.
// ---------------------------------------------------------------------------

function seed() {
  return {
    event: [
      {
        id: "event-1",
        orgId: "org-1",
        recordPrefix: "SES",
        startDate: "2026-08-10",
        endDate: "2026-08-12",
        timezone: "America/Chicago",
        name: "Conf",
      },
    ],
    submission: [
      { id: "sub-a", eventId: "event-1", seq: 1, title: "Talk A", status: "accepted" },
      { id: "sub-b", eventId: "event-1", seq: 2, title: "Talk B", status: "accepted" },
      { id: "sub-c", eventId: "event-1", seq: 3, title: "Talk C", status: "accepted" },
      { id: "sub-d", eventId: "event-1", seq: 4, title: "Talk D", status: "accepted" },
      { id: "sub-e", eventId: "event-1", seq: 5, title: "Talk E", status: "accepted" },
    ],
    participant: [
      { id: "p-a", submissionId: "sub-a", contactId: "contact-1", inviteStatus: "accepted" },
      { id: "p-b", submissionId: "sub-b", contactId: "contact-1", inviteStatus: "accepted" },
      { id: "p-c", submissionId: "sub-c", contactId: "contact-1", inviteStatus: "accepted" },
      { id: "p-d", submissionId: "sub-d", contactId: "contact-2", inviteStatus: "accepted" },
      { id: "p-e", submissionId: "sub-e", contactId: "contact-2", inviteStatus: "accepted" },
    ],
    scheduleSlot: [
      // A and B overlap: 09:00-10:00 vs 09:30-10:30.
      { id: "slot-a", submissionId: "sub-a", roomId: "room-1", day: "2026-08-11", startMin: 540, endMin: 600 },
      { id: "slot-b", submissionId: "sub-b", roomId: "room-2", day: "2026-08-11", startMin: 570, endMin: 630 },
      // C is later the same day, no overlap with A or B.
      { id: "slot-c", submissionId: "sub-c", roomId: "room-1", day: "2026-08-11", startMin: 700, endMin: 760 },
      // D and E (contact-2's own) overlap, but must never surface for contact-1.
      { id: "slot-d", submissionId: "sub-d", roomId: "room-1", day: "2026-08-11", startMin: 800, endMin: 860 },
      { id: "slot-e", submissionId: "sub-e", roomId: "room-2", day: "2026-08-11", startMin: 820, endMin: 880 },
    ],
    room: [
      { id: "room-1", eventId: "event-1", name: "Room 1" },
      { id: "room-2", eventId: "event-1", name: "Room 2" },
    ],
  };
}

describe("getMySessions overlap flag (DEC-777 wave-44 amendment): the speaker sees their own clash", () => {
  it("two overlapping placed sessions are BOTH flagged, each naming the other's ref", async () => {
    const db = makeDb(seed());
    const sessions = await getMySessions(db, "contact-1", "org-1");
    const byId = Object.fromEntries(sessions.map((s) => [s.submissionId, s]));

    expect(byId["sub-a"]!.overlaps).toHaveLength(1);
    expect(byId["sub-a"]!.overlaps[0]).toMatchObject({ submissionId: "sub-b", ref: byId["sub-b"]!.ref });

    expect(byId["sub-b"]!.overlaps).toHaveLength(1);
    expect(byId["sub-b"]!.overlaps[0]).toMatchObject({ submissionId: "sub-a", ref: byId["sub-a"]!.ref });
  });

  it("a non-overlapping session carries no flag", async () => {
    const db = makeDb(seed());
    const sessions = await getMySessions(db, "contact-1", "org-1");
    const byId = Object.fromEntries(sessions.map((s) => [s.submissionId, s]));

    expect(byId["sub-c"]!.overlaps).toEqual([]);
  });

  it("a different speaker's overlapping pair never appears in this speaker's portal — scoping is absolute", async () => {
    const db = makeDb(seed());
    const sessions = await getMySessions(db, "contact-1", "org-1");

    // contact-2's own sessions are not even returned by getMySessions
    // (existing contactId scope on the WHERE clause).
    const ids = sessions.map((s) => s.submissionId);
    expect(ids).not.toContain("sub-d");
    expect(ids).not.toContain("sub-e");

    // And no overlap entry anywhere references contact-2's submissions.
    for (const s of sessions) {
      for (const o of s.overlaps) {
        expect(["sub-a", "sub-b", "sub-c"]).toContain(o.submissionId);
      }
    }
  });
});
