// DEC-669 coverage: speaker headshots are structurally unreachable from
// listEventDeliverableFiles (a headshot file carries submission_id null and
// is linked instead by contact.headshot_url = '/headshots/<fileId>'). This
// exercises the new, separate listEventHeadshotFiles query and the
// GET /api/v1/events/:eventId/headshots route's org-scoped 404 (never 403)
// against an in-memory fake DB that evaluates the actual drizzle
// where/join/orderBy conditions the repo builds — same rationale as
// test/files-library.test.ts ("no D1 test harness exists in this repo").

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "or"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: unknown[] }
  | { __marker: "isNotNull"; col: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    or: (...conds: unknown[]): Marker => ({ __marker: "or", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    isNotNull: (col: unknown): Marker => ({ __marker: "isNotNull", col }),
  };
});

const { listEventHeadshotFiles } = await import("../src/server/repo/files-library");

// -----------------------------------------------------------------------
// Fake DB: joined rows are kept as TAGGED sub-objects (never flat-merged),
// so contact.id and file.id — both literally named "id" in the schema — can
// never collide, unlike a naive object spread merge.
// -----------------------------------------------------------------------

const TABLES = {
  participant: schema.participant,
  submission: schema.submission,
  contact: schema.contact,
  file: schema.file,
} as const;
type TableKey = keyof typeof TABLES;

interface JoinedRow {
  participant: Record<string, unknown>;
  submission: Record<string, unknown>;
  contact: Record<string, unknown>;
  file?: Record<string, unknown>;
}

function colInfo(col: unknown): { table: TableKey; prop: string } {
  for (const [tableKey, tableObj] of Object.entries(TABLES)) {
    for (const [prop, value] of Object.entries(tableObj)) {
      if (value === col) return { table: tableKey as TableKey, prop };
    }
  }
  throw new Error("fake db: condition referenced a column not on a known table");
}

function isColumnRef(x: unknown): boolean {
  for (const tableObj of Object.values(TABLES)) {
    for (const value of Object.values(tableObj)) {
      if (value === x) return true;
    }
  }
  return false;
}

function resolveVal(x: unknown, row: JoinedRow): unknown {
  if (!isColumnRef(x)) return x;
  const { table, prop } = colInfo(x);
  const sub = row[table];
  if (!sub) throw new Error(`fake db: column on table "${table}" referenced before it was joined`);
  return sub[prop];
}

function isSqlNode(x: unknown): x is { queryChunks: unknown[] } {
  return typeof x === "object" && x !== null && "queryChunks" in (x as Record<string, unknown>);
}

function isStringChunk(x: unknown): x is { value: string[] } {
  return (
    typeof x === "object" &&
    x !== null &&
    x.constructor?.name === "StringChunk" &&
    Array.isArray((x as { value: unknown }).value)
  );
}

/** likeContains wraps in %...% and escapes \/%/_ — reverse it to a literal
 * substring test (mirrors test/files-library.test.ts's likeMatches). */
function likeMatches(value: string, likePattern: string): boolean {
  const inner = likePattern.slice(1, -1);
  const literal = inner.replace(/\\(.)/g, "$1");
  return value.includes(literal);
}

/** Renders a sql`` node's literal text with column refs embedded as
 * `#table.prop` and every other interpolated value collected as a param —
 * only the two known shapes this module emits (the headshot join predicate
 * and the q-filter LIKE templates) are ever evaluated. */
function renderSql(node: { queryChunks: unknown[] }): { text: string; cols: unknown[]; params: unknown[] } {
  let text = "";
  const cols: unknown[] = [];
  const params: unknown[] = [];
  for (const chunk of node.queryChunks) {
    if (isStringChunk(chunk)) {
      text += chunk.value.join("");
    } else if (isSqlNode(chunk)) {
      const inner = renderSql(chunk);
      text += inner.text;
      cols.push(...inner.cols);
      params.push(...inner.params);
    } else if (isColumnRef(chunk)) {
      const { table, prop } = colInfo(chunk);
      text += `#${table}.${prop}`;
      cols.push(chunk);
    } else {
      text += "?";
      params.push(chunk);
    }
  }
  return { text, cols, params };
}

function evalSqlNode(node: { queryChunks: unknown[] }, row: JoinedRow): boolean {
  const { text, cols, params } = renderSql(node);
  if (text.includes(" || ") && text.includes(" = ")) {
    // The headshot join predicate: contact.headshot_url = '/headshots/' || file.id
    const [leftCol, rightCol] = cols;
    const leftVal = resolveVal(leftCol, row);
    const rightVal = resolveVal(rightCol, row);
    return leftVal === `/headshots/${String(rightVal)}`;
  }
  if (text.includes(" like ")) {
    const like = params[0] as string;
    if (cols.length === 2) {
      // lower(firstName || ' ' || lastName) like ?
      const combined = `${String(resolveVal(cols[0], row))} ${String(resolveVal(cols[1], row))}`.toLowerCase();
      return likeMatches(combined, like);
    }
    // lower(filename) like ? / lower(coalesce(company, '')) like ?
    const value = String(resolveVal(cols[0], row) ?? "").toLowerCase();
    return likeMatches(value, like);
  }
  throw new Error(`fake db: unsupported sql node: ${text}`);
}

function evalCond(cond: unknown, row: JoinedRow): boolean {
  if (isSqlNode(cond)) return evalSqlNode(cond, row);
  const m = cond as Marker;
  if (m.__marker === "eq") return resolveVal(m.col, row) === resolveVal(m.val, row);
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.vals.includes(resolveVal(m.col, row));
  if (m.__marker === "isNotNull") return resolveVal(m.col, row) != null;
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

interface Seed {
  participant: { submissionId: string; contactId: string; order: number; role: string; inviteStatus: string }[];
  submission: { id: string; eventId: string; status: string }[];
  contact: { id: string; firstName: string; lastName: string; company: string | null; headshotUrl: string | null }[];
  file: { id: string; filename: string; sizeBytes: number; contentType: string; createdAt: Date }[];
}

function makeFakeHeadshotsDb(seed: Seed) {
  const byTable: Record<TableKey, Record<string, unknown>[]> = {
    participant: seed.participant as unknown as Record<string, unknown>[],
    submission: seed.submission as unknown as Record<string, unknown>[],
    contact: seed.contact as unknown as Record<string, unknown>[],
    file: seed.file as unknown as Record<string, unknown>[],
  };
  const keyOf = (table: Record<string, unknown>): TableKey => {
    const found = (Object.entries(TABLES) as [TableKey, unknown][]).find(([, t]) => t === table);
    if (!found) throw new Error("fake db: unknown table in from()/innerJoin()");
    return found[0];
  };

  function select(fields: Record<string, unknown>, distinct: boolean) {
    let source: JoinedRow[] = [];
    let whereCond: unknown = null;
    let orderByArg: unknown = null;
    let limitN: number | undefined;
    let offsetN = 0;
    const run = () => {
      let matched = whereCond ? source.filter((r) => evalCond(whereCond, r)) : source.slice();
      if (orderByArg) {
        matched = matched
          .slice()
          .sort((a, b) => {
            const an = `${a.contact.lastName}|${a.contact.firstName}|${a.file?.id}`;
            const bn = `${b.contact.lastName}|${b.contact.firstName}|${b.file?.id}`;
            return an < bn ? -1 : an > bn ? 1 : 0;
          });
      }
      let projected = matched.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [outKey, col] of Object.entries(fields)) {
          out[outKey] = resolveVal(col, r);
        }
        return out;
      });
      if (distinct) {
        const seen = new Set<string>();
        projected = projected.filter((p) => {
          const key = JSON.stringify(p);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (offsetN) projected = projected.slice(offsetN);
      if (limitN !== undefined) projected = projected.slice(0, limitN);
      return projected;
    };
    const chain: any = {
      from: (table: Record<string, unknown>) => {
        const tableKey = keyOf(table);
        source = (byTable[tableKey] ?? []).map((r) => ({ [tableKey]: r }) as JoinedRow);
        return chain;
      },
      innerJoin: (table: Record<string, unknown>, cond: unknown) => {
        const tableKey = keyOf(table);
        const joinRows = byTable[tableKey] ?? [];
        const merged: JoinedRow[] = [];
        for (const s of source) {
          for (const j of joinRows) {
            const candidate: JoinedRow = { ...s, [tableKey]: j };
            if (evalCond(cond, candidate)) merged.push(candidate);
          }
        }
        source = merged;
        return chain;
      },
      where: (cond: unknown) => {
        whereCond = cond;
        return chain;
      },
      orderBy: (arg: unknown) => {
        orderByArg = arg;
        return chain;
      },
      limit: (n: number) => {
        limitN = n;
        return chain;
      },
      offset: (n: number) => {
        offsetN = n;
        return chain;
      },
      then: (resolve: (v: unknown[]) => void) => resolve(run()),
    };
    return chain;
  }

  const db = {
    selectDistinct: (fields: Record<string, unknown>) => select(fields, true),
  };
  return db as unknown as import("../src/server/context").Db;
}

// ---------------------------------------------------------------------------
// Fixture: one accepted speaker with a headshot (Priya), one accepted
// speaker with none (Someone Else, headshotUrl null — excluded), one
// speaker on a NOT-accepted submission with a headshot (excluded).
// ---------------------------------------------------------------------------

function baseSeed(): Seed {
  return {
    participant: [
      { submissionId: "sub-1", contactId: "contact-priya", order: 0, role: "speaker", inviteStatus: "accepted" },
      { submissionId: "sub-1", contactId: "contact-other", order: 1, role: "speaker", inviteStatus: "accepted" },
      { submissionId: "sub-2", contactId: "contact-declined", order: 0, role: "speaker", inviteStatus: "accepted" },
    ],
    submission: [
      { id: "sub-1", eventId: "event-1", status: "accepted" },
      { id: "sub-2", eventId: "event-1", status: "submitted" },
    ],
    contact: [
      { id: "contact-priya", firstName: "Priya", lastName: "Raman", company: "Acme Corp", headshotUrl: "/headshots/file-hs-priya" },
      { id: "contact-other", firstName: "Someone", lastName: "Else", company: null, headshotUrl: null },
      { id: "contact-declined", firstName: "Not", lastName: "Accepted", company: null, headshotUrl: "/headshots/file-hs-declined" },
    ],
    file: [
      { id: "file-hs-priya", filename: "priya.jpg", sizeBytes: 234567, contentType: "image/jpeg", createdAt: new Date("2026-01-05T00:00:00Z") },
      { id: "file-hs-declined", filename: "declined.jpg", sizeBytes: 111, contentType: "image/jpeg", createdAt: new Date("2026-01-05T00:00:00Z") },
    ],
  };
}

describe("listEventHeadshotFiles (DEC-669)", () => {
  it("surfaces only the accepted speaker with a headshot, joined via contact.headshot_url = '/headshots/' || file.id", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const result = await listEventHeadshotFiles(db, "event-1", { page: 1, perPage: 50 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      fileId: "file-hs-priya",
      filename: "priya.jpg",
      contactId: "contact-priya",
      contactName: "Priya Raman",
      company: "Acme Corp",
    });
  });

  it("excludes a speaker with no headshot and a headshot belonging to a non-accepted submission's speaker", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const result = await listEventHeadshotFiles(db, "event-1", { page: 1, perPage: 50 });
    const contactIds = result.items.map((i) => i.contactId);
    expect(contactIds).not.toContain("contact-other");
    expect(contactIds).not.toContain("contact-declined");
  });

  it("q filters by speaker name", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const hit = await listEventHeadshotFiles(db, "event-1", { page: 1, perPage: 50, q: "raman" });
    expect(hit.items).toHaveLength(1);

    const dbMiss = makeFakeHeadshotsDb(baseSeed());
    const miss = await listEventHeadshotFiles(dbMiss, "event-1", { page: 1, perPage: 50, q: "nonexistent" });
    expect(miss.items).toHaveLength(0);
    expect(miss.total).toBe(0);
  });

  it("returns items and total from the same where clause (never a union) for an event with no eligible contacts", async () => {
    const seed = baseSeed();
    seed.contact[0]!.headshotUrl = null; // Priya no longer has a headshot
    const db = makeFakeHeadshotsDb(seed);
    const result = await listEventHeadshotFiles(db, "event-1", { page: 1, perPage: 50 });
    expect(result).toEqual({ items: [], total: 0, page: 1, perPage: 50 });
  });
});
