// DEC-536: getMySessions (the speaker portal's "my sessions" read) must
// agree with every other schedule read (public/agenda.ts, public/sessions.ts,
// public/detail.ts, repo/agenda.ts) that a schedule_slot dated outside its
// event's [startDate, endDate] never renders as a placement. The range
// predicate must live in the LEFT JOIN's ON clause — a WHERE would drop the
// whole session row instead of merely nulling its placement fields. This
// file proves both the SQL-shape (predicate in the join, not the where) and
// the resulting behavior, against a real join/where evaluator (same style as
// test/portal-invite-scope.test.ts) rather than a JS post-filter, per DEC-312.

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

// ---------------------------------------------------------------------------
// Generic multi-table fake DB (mirrors test/portal-invite-scope.test.ts):
// evaluates the real drizzle-orm-shaped condition marker trees the repo
// builds for both leftJoin ON clauses and the top-level WHERE, so the
// DEC-536 predicate placement is proven at the SQL layer, not by a JS
// post-filter.
// ---------------------------------------------------------------------------

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
  // The DEC-536 range predicate is a gte/lte pair — if a future refactor
  // moves it from the join ON into the top-level WHERE, this harness must
  // fail loudly rather than silently accepting it as if it belonged here.
  throw new Error(`fake db: unsupported where condition (gte/lte belong in the LEFT JOIN, not WHERE): ${JSON.stringify(cond)}`);
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

function makeDb(dataByTag: Record<string, Record<string, unknown>[]>, capturedJoinConds: unknown[]) {
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
        // Record every scheduleSlot join condition so the test can assert
        // the DEC-536 range predicate lives here, in the ON clause.
        if (tag === "scheduleSlot") capturedJoinConds.push(cond);
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

function walkMarkerTokens(node: unknown, seen = new Set<unknown>()): string[] {
  if (node === null || typeof node !== "object" || seen.has(node)) return [];
  seen.add(node);
  const m = node as Marker & Record<string, unknown>;
  const out: string[] = [];
  if (m.__marker) out.push(`marker:${m.__marker}`);
  if ("col" in m) {
    const info = tryColInfo(m.col);
    if (info) out.push(`col:${info.tag}.${info.key}`);
  }
  if ("val" in m && m.val !== undefined) {
    const info = tryColInfo(m.val);
    out.push(info ? `col:${info.tag}.${info.key}` : `val:${JSON.stringify(m.val)}`);
  }
  if ("conds" in m && Array.isArray((m as any).conds)) {
    for (const c of (m as any).conds) out.push(...walkMarkerTokens(c, seen));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixture: one event (2026-08-10 .. 2026-08-12), three accepted+participated
// submissions — one with an in-range slot, one with an out-of-range slot
// (one day after event.endDate), and one with no slot at all.
// ---------------------------------------------------------------------------

function seed() {
  return {
    event: [{ id: "event-1", orgId: "org-1", recordPrefix: "SES", startDate: "2026-08-10", endDate: "2026-08-12" }],
    submission: [
      { id: "sub-in", eventId: "event-1", seq: 1, title: "In range", status: "accepted" },
      { id: "sub-out", eventId: "event-1", seq: 2, title: "Out of range", status: "accepted" },
      { id: "sub-none", eventId: "event-1", seq: 3, title: "No slot", status: "accepted" },
    ],
    participant: [
      { id: "p-in", submissionId: "sub-in", contactId: "contact-1", inviteStatus: "accepted" },
      { id: "p-out", submissionId: "sub-out", contactId: "contact-1", inviteStatus: "accepted" },
      { id: "p-none", submissionId: "sub-none", contactId: "contact-1", inviteStatus: "accepted" },
    ],
    scheduleSlot: [
      { id: "slot-in", submissionId: "sub-in", roomId: "room-1", day: "2026-08-11", startMin: 540, endMin: 600 },
      // one day after event.endDate — out of range per DEC-536
      { id: "slot-out", submissionId: "sub-out", roomId: "room-1", day: "2026-08-13", startMin: 540, endMin: 600 },
    ],
    room: [{ id: "room-1", eventId: "event-1", name: "Room 2A" }],
  };
}

describe("getMySessions (DEC-536): schedule_slot bounded to event range via the LEFT JOIN's ON clause", () => {
  it("an in-range slot returns its placement; an out-of-range slot nulls it; a session with no slot at all is unaffected", async () => {
    const capturedJoinConds: unknown[] = [];
    const db = makeDb(seed(), capturedJoinConds);

    const sessions = await getMySessions(db, "contact-1", "org-1");
    const byId = Object.fromEntries(sessions.map((s) => [s.submissionId, s]));

    expect(byId["sub-in"]).toMatchObject({ day: "2026-08-11", startMin: 540, endMin: 600, roomName: "Room 2A" });

    // The fake db's leftJoin-no-match row has no scheduleSlot record at all,
    // so its projected fields come back `undefined` rather than SQL `null` —
    // the row surviving (not being dropped) is what this test proves; the
    // JS-vs-SQL null representation is a harness artifact, not product
    // behavior (portal.ts's own mapper passes row.day etc through as-is).
    expect(byId["sub-out"]).toBeDefined();
    expect(byId["sub-out"]!.day == null && byId["sub-out"]!.startMin == null && byId["sub-out"]!.endMin == null && byId["sub-out"]!.roomName == null).toBe(true);

    expect(byId["sub-none"]).toBeDefined();
    expect(byId["sub-none"]!.day == null && byId["sub-none"]!.startMin == null && byId["sub-none"]!.endMin == null && byId["sub-none"]!.roomName == null).toBe(true);

    expect(sessions).toHaveLength(3);
  });

  it("the range predicate is carried on the scheduleSlot LEFT JOIN's ON clause, not the WHERE", async () => {
    const capturedJoinConds: unknown[] = [];
    const db = makeDb(seed(), capturedJoinConds);

    await getMySessions(db, "contact-1", "org-1");

    expect(capturedJoinConds).toHaveLength(1);
    const tokens = walkMarkerTokens(capturedJoinConds[0]);
    expect(tokens).toContain("marker:gte");
    expect(tokens).toContain("marker:lte");
    expect(tokens).toContain("col:scheduleSlot.day");
    expect(tokens).toContain("col:event.startDate");
    expect(tokens).toContain("col:event.endDate");
    // Also still joins on submissionId, same as before this change.
    expect(tokens).toContain("marker:eq");
    expect(tokens).toContain("col:scheduleSlot.submissionId");
    expect(tokens).toContain("col:submission.id");
  });
});
