// DEC-729 (w1-c) repo-level: getMySubmissions returns every submission the
// contact holds a participant row on, any role, mapped through the DEC-016
// speakerStatusLabel mapper (accept_queue/decline_queue never leak).
//
// Runs against a small generic multi-table fake DB (same shape as
// test/portal-invite-scope.test.ts) that evaluates the real drizzle-orm
// eq/and/inArray/leftJoin condition trees getMySubmissions builds — proven
// at the SQL layer, not a JS post-filter (DEC-312).

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: readonly unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: readonly unknown[]): Marker => ({ __marker: "inArray", col, vals }),
  };
});

const { getMySubmissions } = await import("../src/server/repo/portal");

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

type Rec = Record<string, Record<string, unknown> | undefined>;

function resolveJoinOperand(x: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): unknown {
  try {
    const info = colInfo(x);
    if (info.tag === joinTag) return joinRow[info.key];
    return rec[info.tag]?.[info.key];
  } catch {
    return x;
  }
}

function evalJoinCond(cond: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    return resolveJoinOperand(m.col, rec, joinRow, joinTag) === resolveJoinOperand(m.val, rec, joinRow, joinTag);
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
  throw new Error(`fake db: unsupported where condition ${JSON.stringify(cond)}`);
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

  const db = { select: makeSelect, selectDistinct: makeSelect };
  return db as unknown as Db;
}

function seed() {
  const now = new Date("2026-01-05T00:00:00Z");
  return {
    event: [{ id: "event-1", orgId: "org-1", recordPrefix: "SES" }],
    submission: [
      { id: "sub-pending", eventId: "event-1", seq: 1, title: "Pending talk", status: "pending", createdAt: now, trackId: null },
      { id: "sub-accepted", eventId: "event-1", seq: 2, title: "Accepted talk", status: "accepted", createdAt: now, trackId: null },
      { id: "sub-declined", eventId: "event-1", seq: 3, title: "Declined talk", status: "declined", createdAt: now, trackId: null },
      // owned by a different contact — must never appear for contact-1
      { id: "sub-other", eventId: "event-1", seq: 4, title: "Not mine", status: "pending", createdAt: now, trackId: null },
    ],
    participant: [
      { id: "p1", submissionId: "sub-pending", contactId: "contact-1", role: "speaker", inviteStatus: "none" },
      { id: "p2", submissionId: "sub-accepted", contactId: "contact-1", role: "speaker", inviteStatus: "accepted" },
      // any role: a co-presenter row, not just 'speaker'
      { id: "p3", submissionId: "sub-declined", contactId: "contact-1", role: "co-presenter", inviteStatus: "declined" },
      { id: "p4", submissionId: "sub-other", contactId: "contact-2", role: "speaker", inviteStatus: "none" },
    ],
    track: [],
    submissionAnswer: [],
  };
}

describe("getMySubmissions (DEC-729)", () => {
  it("returns every submission the contact holds a participant row on, any role, with public status labels", async () => {
    const db = makeDb(seed());
    const rows = await getMySubmissions(db, "contact-1", "org-1");
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    expect(Object.keys(byId).sort()).toEqual(["sub-accepted", "sub-declined", "sub-pending"]);
    expect(byId["sub-pending"]!.statusLabel).toBe("Under review");
    expect(byId["sub-accepted"]!.statusLabel).toBe("Accepted");
    expect(byId["sub-declined"]!.statusLabel).toBe("Not accepted");
    // ref formatting still runs through the shared formatRef helper.
    expect(byId["sub-pending"]!.ref).toBe("SES-001");
  });

  it("never includes another contact's submission — scoping is absolute", async () => {
    const db = makeDb(seed());
    const rows = await getMySubmissions(db, "contact-1", "org-1");
    expect(rows.find((r) => r.id === "sub-other")).toBeUndefined();
  });

  it("returns nothing for a contact with no participant rows", async () => {
    const db = makeDb(seed());
    const rows = await getMySubmissions(db, "contact-nobody", "org-1");
    expect(rows).toEqual([]);
  });
});
