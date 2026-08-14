// DEC-432 coverage (narrowed wave 33: returningSpeakers/eventCount deleted,
// no renderer ever consumed them): getContactStats' speakerCount is computed
// by a single count(*) over a GROUP BY contact.id subquery, never a
// per-contact JS .filter(). This file mocks drizzle-orm's eq/and/desc/sql to
// plain markers (same technique as test/portal-invite-scope.test.ts) and
// evaluates the real condition trees the repo builds against seeded rows, so
// the aggregation is proven at the SQL layer, not app code.

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "desc"; of: unknown }
  | { __marker: "inArray"; col: unknown; vals: unknown[] };

type SqlMarker = { __sqlMarker: true; strings: string[]; exprs: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    desc: (of: unknown): Marker => ({ __marker: "desc", of }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    sql: (strings: TemplateStringsArray, ...exprs: unknown[]): SqlMarker => ({
      __sqlMarker: true,
      strings: Array.from(strings),
      exprs,
    }),
  };
});

const { getContactStats } = await import("../src/server/repo/contacts/stats");

const TABLE_TAG = new Map<object, string>();
for (const [tag, val] of Object.entries(schema)) {
  if (val && typeof val === "object") TABLE_TAG.set(val as object, tag);
}

function isSqlMarker(x: unknown): x is SqlMarker {
  return !!x && typeof x === "object" && (x as any).__sqlMarker === true;
}

function colInfo(col: unknown): { tag: string; key: string } | null {
  for (const [tableObj, tag] of TABLE_TAG.entries()) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return { tag, key };
    }
  }
  return null;
}

type Rec = Record<string, Record<string, unknown> | undefined>;

function resolveVal(col: unknown, rec: Rec): unknown {
  const info = colInfo(col);
  if (!info) throw new Error("fake db: unresolved column ref");
  return rec[info.tag]?.[info.key];
}

function evalWhereCond(cond: unknown, rec: Rec): boolean {
  if (isSqlMarker(cond)) {
    // Only shape stats.ts issues at the WHERE level: `${col} is not null
    // and ${col} != ''`.
    const val = resolveVal(cond.exprs[0], rec);
    return val !== null && val !== "";
  }
  const m = cond as Marker;
  if (m.__marker === "eq") return resolveVal(m.col, rec) === m.val;
  if (m.__marker === "and") return m.conds.every((c) => evalWhereCond(c, rec));
  if (m.__marker === "inArray") return m.vals.includes(resolveVal(m.col, rec));
  throw new Error(`fake db: unsupported where condition ${JSON.stringify(cond)}`);
}

function evalJoinCond(cond: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const resolve = (x: unknown) => {
      const info = colInfo(x);
      if (!info) throw new Error("fake db: unresolved join column");
      return info.tag === joinTag ? joinRow[info.key] : rec[info.tag]?.[info.key];
    };
    return resolve(m.col) === resolve(m.val);
  }
  throw new Error(`fake db: unsupported join condition ${JSON.stringify(cond)}`);
}

function evalHaving(cond: unknown, group: Rec[]): boolean {
  if (!isSqlMarker(cond)) throw new Error("fake db: HAVING must be a sql fragment");
  const raw = cond.strings.join("￿");
  const m = /^count\(distinct ￿\) > (\d+)$/.exec(raw);
  if (!m) throw new Error(`fake db: unsupported HAVING shape ${raw}`);
  const threshold = Number(m[1]);
  const col = cond.exprs[0];
  const distinct = new Set(group.map((rec) => resolveVal(col, rec)));
  return distinct.size > threshold;
}

function evalAggregateField(spec: unknown, group: Rec[]): unknown {
  if (isSqlMarker(spec)) {
    const raw = spec.strings.join("￿").trim();
    if (raw === "count(*)") return group.length;
    throw new Error(`fake db: unsupported aggregate field ${raw}`);
  }
  return group.length ? resolveVal(spec, group[0]!) : undefined;
}

function makeDb(dataByTag: Record<string, Record<string, unknown>[]>) {
  function rowsFor(table: unknown): { tag: string; rows: Record<string, unknown>[] } | null {
    const tag = TABLE_TAG.get(table as object);
    if (!tag) return null;
    return { tag, rows: dataByTag[tag] ?? [] };
  }

  function makeSelect(fields: Record<string, unknown>) {
    let records: Rec[] = [];
    let whereCond: unknown = null;
    let groupByCol: unknown = null;
    let havingCond: unknown = null;
    let orderByDesc = false;
    let limitN: number | null = null;

    function evaluate(): Record<string, unknown>[] {
      const filtered = whereCond ? records.filter((r) => evalWhereCond(whereCond, r)) : records;
      let out: Record<string, unknown>[];
      if (groupByCol) {
        const groups = new Map<unknown, Rec[]>();
        for (const rec of filtered) {
          const key = resolveVal(groupByCol, rec);
          const arr = groups.get(key);
          if (arr) arr.push(rec);
          else groups.set(key, [rec]);
        }
        let entries = Array.from(groups.values());
        if (havingCond) entries = entries.filter((group) => evalHaving(havingCond, group));
        out = entries.map((group) => {
          const row: Record<string, unknown> = {};
          for (const [outKey, spec] of Object.entries(fields)) row[outKey] = evalAggregateField(spec, group);
          return row;
        });
      } else {
        const row: Record<string, unknown> = {};
        for (const [outKey, spec] of Object.entries(fields)) row[outKey] = evalAggregateField(spec, filtered);
        out = [row];
      }
      if (orderByDesc) out.sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0));
      if (limitN != null) out = out.slice(0, limitN);
      return out;
    }

    const chain: any = {
      from(table: unknown) {
        const subquery = table as { __subqueryRows?: Record<string, unknown>[] };
        if (subquery && subquery.__subqueryRows) {
          records = subquery.__subqueryRows.map((row) => ({ __flat: row }));
          return chain;
        }
        const info = rowsFor(table);
        if (!info) throw new Error("fake db: unknown table in from()");
        records = info.rows.map((r) => ({ [info.tag]: r }));
        return chain;
      },
      innerJoin(table: unknown, cond: unknown) {
        const info = rowsFor(table);
        if (!info) throw new Error("fake db: unknown table in innerJoin()");
        const next: Rec[] = [];
        for (const rec of records) {
          for (const row of info.rows) {
            if (evalJoinCond(cond, rec, row, info.tag)) next.push({ ...rec, [info.tag]: row });
          }
        }
        records = next;
        return chain;
      },
      where(cond: unknown) {
        whereCond = cond;
        return chain;
      },
      groupBy(col: unknown) {
        groupByCol = col;
        return chain;
      },
      having(cond: unknown) {
        havingCond = cond;
        return chain;
      },
      orderBy() {
        orderByDesc = true;
        return chain;
      },
      limit(n: number) {
        limitN = n;
        return chain;
      },
      as() {
        return { __subqueryRows: evaluate() };
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try {
          resolve(evaluate());
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };
    return chain;
  }

  const db = { select: makeSelect };
  return db as unknown as Db;
}

function seed() {
  return {
    // DEC-711: getContactStats now also runs findDuplicateGroupsForOrg (for
    // duplicateCount) — email/firstName/lastName are required there
    // (normalizeEmail reads them), so every seeded contact carries distinct
    // values that never collide into a duplicate group.
    contact: [
      { id: "c-returning", orgId: "org-1", company: "Acme", email: "returning@example.com", firstName: "Rita", lastName: "Returning" },
      { id: "c-single", orgId: "org-1", company: "Acme", email: "single@example.com", firstName: "Sam", lastName: "Single" },
      { id: "c-none", orgId: "org-1", company: null, email: "none@example.com", firstName: "Noel", lastName: "None" },
    ],
    event: [
      { id: "event-1", orgId: "org-1" },
      { id: "event-2", orgId: "org-1" },
    ],
    submission: [
      { id: "sub-1", eventId: "event-1" },
      { id: "sub-2", eventId: "event-2" },
      { id: "sub-3", eventId: "event-1" },
    ],
    participant: [
      // c-returning participates in two distinct events as an active
      // speaker -> counts once.
      { id: "p1", submissionId: "sub-1", contactId: "c-returning", role: "speaker", inviteStatus: "accepted" },
      { id: "p2", submissionId: "sub-2", contactId: "c-returning", role: "speaker", inviteStatus: "accepted" },
      // c-single participates in exactly one event -> does not count.
      { id: "p3", submissionId: "sub-3", contactId: "c-single", role: "speaker", inviteStatus: "accepted" },
      // c-none has zero participant rows -> does not count.
    ],
  };
}

// wave-21 amendment coverage (narrowed wave 33): speakerCount's predicate is
// role='speaker' AND inviteStatus active, scoped to THIS org's own events
// via the event join, not just contact.orgId. Each case seeds ONLY the
// control (an active speaker, who always counts) plus one contact under
// test, so the assertion isolates that one contact's effect on speakerCount.
function seedControlPlus(caseContact: { id: string }, caseParticipants: Record<string, unknown>[], caseSubmissions: Record<string, unknown>[], extraEvents: Record<string, unknown>[] = []) {
  return {
    contact: [
      { id: "c-control", orgId: "org-1", company: null, email: "control@example.com", firstName: "Cara", lastName: "Control" },
      { id: caseContact.id, orgId: "org-1", company: null, email: `${caseContact.id}@example.com`, firstName: "Case", lastName: caseContact.id },
    ],
    event: [{ id: "event-1", orgId: "org-1" }, { id: "event-2", orgId: "org-1" }, ...extraEvents],
    submission: [
      { id: "sub-control-1", eventId: "event-1" },
      { id: "sub-control-2", eventId: "event-2" },
      ...caseSubmissions,
    ],
    participant: [
      { id: "p-control-1", submissionId: "sub-control-1", contactId: "c-control", role: "speaker", inviteStatus: "accepted" },
      { id: "p-control-2", submissionId: "sub-control-2", contactId: "c-control", role: "speaker", inviteStatus: "accepted" },
      ...caseParticipants,
    ],
  };
}

describe("getContactStats (total/topCompanies/speakerCount)", () => {
  it("keeps total/topCompanies computed from the seeded contacts", async () => {
    const db = makeDb(seed());
    const stats = await getContactStats(db, "org-1");
    expect(stats.total).toBe(3);
    expect(stats.topCompanies).toEqual([{ company: "Acme", count: 2 }]);
  });

  it("counts active speakers on org-1's events toward speakerCount", async () => {
    const db = makeDb(seed());
    const stats = await getContactStats(db, "org-1");
    // c-returning holds an active 'speaker' role on org-1 events; c-single
    // does too, on a single event -- speakerCount has no 2-event threshold.
    expect(stats.speakerCount).toBe(2);
  });

  // DEC-558: topCompanies gets a total order — desc(count) with an
  // asc(company) tiebreak, so tied companies render in a stable order.
  it("issues topCompanies' orderBy as desc(count) then asc(company)", async () => {
    const orderByArgsBySelectIndex: unknown[][] = [];
    let selectIndex = -1;
    const emptyDb = {
      select: () => {
        selectIndex += 1;
        const myIndex = selectIndex;
        const chain: any = {
          from: () => chain,
          where: () => chain,
          groupBy: () => chain,
          innerJoin: () => chain,
          having: () => chain,
          as: () => ({ __fakeSubquery: true }),
          orderBy: (...args: unknown[]) => {
            orderByArgsBySelectIndex[myIndex] = args;
            return chain;
          },
          limit: () => chain,
          then: (resolve: (v: unknown[]) => void) => resolve([]),
        };
        return chain;
      },
    } as unknown as Db;
    await getContactStats(emptyDb, "org-1");
    // Call order: 0=total, 1=companyRows, 2=speakerCount subquery,
    // 3=speakerCount outer count.
    const companyOrderBy = orderByArgsBySelectIndex[1]!;
    expect(companyOrderBy).toHaveLength(2);
    expect((companyOrderBy[0] as Marker).__marker).toBe("desc");
  });
});

describe("getContactStats (wave-21 amendment: speakerCount's predicate)", () => {
  it("excludes a non-speaker (e.g. moderator) participant", async () => {
    const seed = seedControlPlus(
      { id: "c-nonspeaker" },
      [{ id: "p-case-1", submissionId: "sub-case-1", contactId: "c-nonspeaker", role: "moderator", inviteStatus: "accepted" }],
      [{ id: "sub-case-1", eventId: "event-1" }],
    );
    const stats = await getContactStats(makeDb(seed), "org-1");
    expect(stats.speakerCount).toBe(1); // only c-control
  });

  it("counts an active-invite speaker", async () => {
    const seed = seedControlPlus(
      { id: "c-speaker" },
      [{ id: "p-case-1", submissionId: "sub-case-1", contactId: "c-speaker", role: "speaker", inviteStatus: "accepted" }],
      [{ id: "sub-case-1", eventId: "event-1" }],
    );
    const stats = await getContactStats(makeDb(seed), "org-1");
    expect(stats.speakerCount).toBe(2); // c-control + c-speaker
  });

  it("excludes a speaker whose invite_status is 'declined'", async () => {
    const seed = seedControlPlus(
      { id: "c-declined" },
      [{ id: "p-case-1", submissionId: "sub-case-1", contactId: "c-declined", role: "speaker", inviteStatus: "declined" }],
      [{ id: "sub-case-1", eventId: "event-1" }],
    );
    const stats = await getContactStats(makeDb(seed), "org-1");
    expect(stats.speakerCount).toBe(1); // only c-control
  });

  it("excludes a speaker whose participation is on another org's event", async () => {
    const seed = seedControlPlus(
      { id: "c-otherorg" },
      [{ id: "p-case-1", submissionId: "sub-case-1", contactId: "c-otherorg", role: "speaker", inviteStatus: "accepted" }],
      [{ id: "sub-case-1", eventId: "event-3" }], // event-3 belongs to org-2
      [{ id: "event-3", orgId: "org-2" }],
    );
    const stats = await getContactStats(makeDb(seed), "org-1");
    expect(stats.speakerCount).toBe(1); // only c-control (org-1's own event)
  });
});
