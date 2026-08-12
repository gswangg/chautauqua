// DEC-432 coverage: getMyResources pushes event scope into the SQL WHERE
// (inArray/chunkIds) instead of fetching every org resource and filtering in
// JS. Uses the same real drizzle-orm eq/and/inArray condition-tree evaluator
// as test/portal-invite-scope.test.ts (a fresh generic multi-table fake db,
// scoped to this file) so the scoping is proven at the WHERE layer, not as
// an app-code post-filter.

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

const { getMyResources } = await import("../src/server/repo/portal");

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

function evalJoinCond(cond: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const resolve = (x: unknown) => {
      const info = colInfo(x);
      return info.tag === joinTag ? joinRow[info.key] : rec[info.tag]?.[info.key];
    };
    return resolve(m.col) === resolve(m.val);
  }
  throw new Error(`fake db: unsupported join condition ${JSON.stringify(cond)}`);
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

const now = 0;

function baseSeed() {
  return {
    event: [
      { id: "event-1", orgId: "org-1", name: "Conf One" },
      { id: "event-2", orgId: "org-1", name: "Conf Two" },
    ],
    submission: [{ id: "sub-1", eventId: "event-1", seq: 1, title: "Talk", status: "accepted", createdAt: now, formId: "form-1" }],
    participant: [{ id: "p1", submissionId: "sub-1", contactId: "contact-1", inviteStatus: "accepted", order: 0, role: "speaker" }],
    contact: [{ id: "contact-1", firstName: "Sam", lastName: "Speaker", email: "sam@example.test" }],
    resource: [
      { id: "res-1", eventId: "event-1", kind: "wiki", title: "Speaker Guide", content: "hi", fileId: null, position: 1 },
      { id: "res-2", eventId: "event-1", kind: "wiki", title: "AV Info", content: "hi", fileId: null, position: 0 },
      // Resource on a same-org event contact-1 does NOT participate in.
      { id: "res-3", eventId: "event-2", kind: "wiki", title: "Other Conf Doc", content: "hi", fileId: null, position: 0 },
    ],
  };
}

describe("getMyResources (DEC-432 SQL-scoped event filter)", () => {
  it("only returns resources for events the contact participates in, never a same-org event they don't", async () => {
    const db = makeDb(baseSeed());
    const groups = await getMyResources(db, "contact-1", "org-1");

    expect(groups).toHaveLength(1);
    expect(groups[0]!.eventId).toBe("event-1");
    const titles = groups[0]!.resources.map((r) => r.title);
    expect(titles).toEqual(["AV Info", "Speaker Guide"]); // position 0, then 1
    expect(titles).not.toContain("Other Conf Doc");
  });

  it("a contact in zero events returns []", async () => {
    const seed = baseSeed();
    seed.participant = [];
    const db = makeDb(seed);
    const groups = await getMyResources(db, "contact-1", "org-1");
    expect(groups).toEqual([]);
  });
});
