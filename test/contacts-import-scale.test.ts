// DEC-356 regression: applyImportRows must key its contact lookup off the
// file's own distinct emails (chunked via chunkIds/ID_CHUNK_SIZE, DEC-078)
// instead of loading the org's entire contact table before applying a
// single row. Uses a counting in-memory fake Db (real eq/and/or/inArray
// semantics, per the note atop src/server/repo/contacts.ts: no D1 test
// harness exists in this repo) so the assertions are against actual query
// shapes issued by the repo layer, not a scripted response queue.

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import { ID_CHUNK_SIZE } from "../src/lib/chunk";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "or"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; val: unknown[] }
  | { __marker: "lower"; col: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    or: (...conds: unknown[]): Marker => ({ __marker: "or", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, val: vals }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]): unknown => {
      if (strings.length === 2 && strings[0]?.trim() === "lower(" && strings[1]?.trim() === ")") {
        return { __marker: "lower", col: values[0] } satisfies Marker;
      }
      return actual.sql(strings, ...values);
    },
  };
});

// Imported after the mock so import.ts -> crud.ts pick up the mocked
// eq/and/or/inArray/sql.
const { applyImportRows, MAX_IMPORT_ROWS } = await import("../src/server/repo/contacts/import");

function colKey(col: unknown): string {
  for (const [key, value] of Object.entries(schema.contact)) {
    if (value === col) return key;
  }
  throw new Error("fake db: condition referenced a column not on schema.contact");
}

function fieldValue(colOrExpr: unknown, row: Record<string, unknown>): unknown {
  const m = colOrExpr as Marker;
  if (m && typeof m === "object" && "__marker" in m && m.__marker === "lower") {
    return String(fieldValue(m.col, row)).toLowerCase();
  }
  return row[colKey(colOrExpr)];
}

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") return row[colKey(m.col)] === m.val;
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.val.includes(fieldValue(m.col, row));
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

/** True for a bare `eq(contact.orgId, orgId)` where clause with no email
 * filter alongside it -- i.e. exactly the pre-DEC-356 unfiltered org-wide
 * select this task removes. */
function isUnfilteredOrgSelect(cond: unknown): boolean {
  const m = cond as Marker;
  return m.__marker === "eq" && colKey(m.col) === "orgId";
}

/** True for the DEC-356 shape: org eq AND an inArray(lower(email), batch). */
function isChunkedEmailLookup(cond: unknown): boolean {
  const m = cond as Marker;
  if (m.__marker !== "and") return false;
  const hasOrgEq = m.conds.some((c) => (c as Marker).__marker === "eq" && colKey((c as Extract<Marker, { __marker: "eq" }>).col) === "orgId");
  const hasEmailInArray = m.conds.some((c) => {
    const cm = c as Marker;
    if (cm.__marker !== "inArray") return false;
    const inner = cm.col as Marker;
    return inner.__marker === "lower" && colKey(inner.col) === "email";
  });
  return hasOrgEq && hasEmailInArray;
}

function makeCountingContactDb() {
  let rows: Record<string, unknown>[] = [];
  let contactSelectCount = 0;
  let unfilteredOrgSelectCount = 0;
  let chunkedEmailLookupCount = 0;

  const db = {
    select(fields?: Record<string, unknown>) {
      let whereCond: unknown = null;
      let limitN: number | null = null;
      const run = () => {
        contactSelectCount++;
        if (whereCond && isUnfilteredOrgSelect(whereCond)) unfilteredOrgSelectCount++;
        if (whereCond && isChunkedEmailLookup(whereCond)) chunkedEmailLookupCount++;
        const filtered = whereCond ? rows.filter((r) => evalCond(whereCond, r)) : rows.slice();
        const projected = fields
          ? filtered.map((r) => {
              const out: Record<string, unknown> = {};
              for (const [outKey, col] of Object.entries(fields)) out[outKey] = r[colKey(col)];
              return out;
            })
          : filtered.map((r) => ({ ...r }));
        return limitN !== null ? projected.slice(0, limitN) : projected;
      };
      const chain: any = {
        from: () => chain,
        where: (cond: unknown) => {
          whereCond = cond;
          return chain;
        },
        orderBy: () => chain,
        limit: (n: number) => {
          limitN = n;
          return chain;
        },
        then: (resolve: (v: unknown[]) => void) => resolve(run()),
      };
      return chain;
    },
    insert(_table: unknown) {
      return {
        values: async (vals: Record<string, unknown>) => {
          rows.push({ ...vals });
        },
      };
    },
    update(_table: unknown) {
      return {
        set: (vals: Record<string, unknown>) => ({
          where: async (cond: unknown) => {
            rows = rows.map((r) => (evalCond(cond, r) ? { ...r, ...vals } : r));
          },
        }),
      };
    },
  };

  return {
    db: db as any,
    rows: () => rows,
    counts: () => ({ contactSelectCount, unfilteredOrgSelectCount, chunkedEmailLookupCount }),
  };
}

const ORG_ID = "org-1";

function rowsFor(emails: string[]): { line: number; parsed: Record<string, unknown> }[] {
  return emails.map((email, idx) => ({
    line: idx + 2,
    parsed: { email, firstName: "F", lastName: "L" },
  }));
}

describe("applyImportRows (DEC-356: file-keyed lookup, not org-wide select)", () => {
  it("issues one chunked email lookup per ID_CHUNK_SIZE distinct emails, never an unfiltered org-wide select", async () => {
    const { db, counts } = makeCountingContactDb();
    const distinctCount = ID_CHUNK_SIZE * 2 + 20; // forces 3 chunks
    const emails = Array.from({ length: distinctCount }, (_, i) => `person${i}@example.com`);
    const result = await applyImportRows(db, ORG_ID, rowsFor(emails));

    expect(result.created).toBe(distinctCount);
    expect(result.skipped).toEqual([]);

    const c = counts();
    expect(c.unfilteredOrgSelectCount).toBe(0);
    expect(c.chunkedEmailLookupCount).toBe(Math.ceil(distinctCount / ID_CHUNK_SIZE));
    // Sanity: lookup cost is proportional to distinct emails in the file,
    // not to an org-wide row count (there's no other data in this fake db,
    // but the assertion above already pins the statement count to the
    // chunk math rather than "however many rows exist").
  });

  it("rejects a file over MAX_IMPORT_ROWS before any DB work", async () => {
    const { db, counts } = makeCountingContactDb();
    const emails = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `over${i}@example.com`);

    await expect(applyImportRows(db, ORG_ID, rowsFor(emails))).rejects.toMatchObject({
      code: "invalid",
      status: 400,
    });
    expect(counts().contactSelectCount).toBe(0);
  });

  it("collapses within-file duplicate emails onto the same created contact", async () => {
    const { db, rows } = makeCountingContactDb();
    const result = await applyImportRows(
      db,
      ORG_ID,
      rowsFor(["dup@example.com", "DUP@example.com", " dup@example.com "]),
    );

    expect(result.created).toBe(1);
    expect(result.updated).toBe(2);
    expect(result.contactIds).toHaveLength(1);
    expect(rows()).toHaveLength(1);
  });

  it("still skips rows with a missing/blank email, same reason and line", async () => {
    const { db } = makeCountingContactDb();
    const result = await applyImportRows(db, ORG_ID, [
      { line: 2, parsed: { email: "", firstName: "A", lastName: "B" } },
      { line: 3, parsed: { firstName: "C", lastName: "D" } },
      { line: 4, parsed: { email: "ok@example.com", firstName: "E", lastName: "F" } },
    ]);

    expect(result.skipped).toEqual([
      { line: 2, reason: "missing email" },
      { line: 3, reason: "missing email" },
    ]);
    expect(result.created).toBe(1);
  });
});
