// DEC-663 (wave-8 amendment, w8-d): created/updated must count DEDUPED
// CONTACTS, never CSV lines. A single address repeated on two lines is one
// contact, not "1 new · 1 updated" -- mirrors test/contacts-import-plan.test.ts's
// in-memory fake Db (real eq/and/inArray/sql`lower(...)` semantics evaluated
// structurally) so applyImportRows/planImportRows are exercised directly,
// no D1 test harness exists in this repo.

import { describe, expect, it, vi } from "vitest";
import type { Db } from "../src/server/context";
import * as schema from "../src/db/schema";

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

const { applyImportRows, planImportRows } = await import("../src/server/repo/contacts/import");

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

function project(row: Record<string, unknown>, fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [outKey, col] of Object.entries(fields)) out[outKey] = row[colKey(col)];
  return out;
}

function makeFakeContactDb() {
  let rows: Record<string, unknown>[] = [];

  const db = {
    select(fields?: Record<string, unknown>) {
      let table: unknown = schema.contact;
      let whereCond: unknown = null;
      const run = () => {
        // Same guard as test/contacts-import.test.ts's fake: this fake only
        // models `contact` rows -- a select against any other table (e.g.
        // touchSubmissionsForContacts' participant/submission lookups)
        // resolves to an empty result set without running the
        // contact-only condition evaluator.
        if (table !== schema.contact) return [];
        const filtered = whereCond ? rows.filter((r) => evalCond(whereCond, r)) : rows.slice();
        if (fields && Object.values(fields).some((v) => !Object.values(schema.contact).includes(v))) {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(fields)) out[key] = filtered.length;
          return [out];
        }
        return fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
      };
      const chain: any = {
        from: (t: unknown) => {
          table = t;
          return chain;
        },
        where: (cond: unknown) => {
          whereCond = cond;
          return chain;
        },
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
        then: (resolve: (v: unknown[]) => void) => resolve(run()),
      };
      return chain;
    },
    insert(_table: unknown) {
      return {
        values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(vals) ? vals : [vals];
          const insertAll = async () => {
            for (const v of list) rows.push({ ...v });
          };
          return {
            then: (resolve: (v: void) => void, reject?: (e: unknown) => void) =>
              insertAll().then(resolve, reject),
            onConflictDoUpdate: (opts: { set: Record<string, unknown> }) => ({
              then: (resolve: (v: void) => void, reject?: (e: unknown) => void) => {
                const upsertAll = async () => {
                  for (const v of list) {
                    const idx = rows.findIndex((r) => r.id === v.id);
                    if (idx < 0) continue;
                    const patch: Record<string, unknown> = {};
                    for (const key of Object.keys(opts.set)) patch[key] = v[key];
                    rows[idx] = { ...rows[idx], ...patch };
                  }
                };
                return upsertAll().then(resolve, reject);
              },
            }),
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set: (vals: Record<string, unknown>) => ({
          // touchSubmissionsForContacts (DEC-725 amendment) issues an UPDATE
          // against `submission`, not `contact`, after a rename lands -- this
          // fake only models the contact table, so an update against any
          // other table is a no-op (mirrors select()'s guard above).
          where: async (cond: unknown) => {
            if (table !== schema.contact) return;
            rows = rows.map((r) => (evalCond(cond, r) ? { ...r, ...vals } : r));
          },
        }),
      };
    },
  };

  return { db: db as unknown as Db, rows: () => rows };
}

function seedContact(db: Db, overrides: Record<string, unknown>) {
  return (db as any)
    .insert(schema.contact)
    .values({
      id: "seed-id",
      orgId: "org-1",
      firstName: "First",
      lastName: "Last",
      email: "seed@example.com",
      phone: null,
      company: null,
      title: null,
      bio: null,
      notes: null,
      customFieldsJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
}

const ORG = "org-1";

describe("DEC-663 (wave-8 amendment): created/updated count deduped contacts, not CSV lines", () => {
  it("(a) applyImportRows: the same address on two lines reports 1 new · 0 updated", async () => {
    const { db, rows } = makeFakeContactDb();
    const csvRows = [
      { line: 2, parsed: { email: "brand.new@example.com", firstName: "Brand", lastName: "New" } },
      { line: 3, parsed: { email: "brand.new@example.com", lastName: "Newer" } },
    ];

    const result = await applyImportRows(db, ORG, csvRows);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.contactIds).toHaveLength(1);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.lastName).toBe("Newer");
  });

  it("(b) planImportRows: the same file's plan reports the same 1 new · 0 updated pair", async () => {
    const { db } = makeFakeContactDb();
    const csvRows = [
      { line: 2, parsed: { email: "brand.new@example.com", firstName: "Brand", lastName: "New" } },
      { line: 3, parsed: { email: "brand.new@example.com", lastName: "Newer" } },
    ];

    const plan = await planImportRows(db, ORG, csvRows);

    expect(plan.created).toBe(1);
    expect(plan.updated).toBe(0);
  });

  it("(c) applyImportRows: an existing contact touched twice in one file reports 0 new · 1 updated", async () => {
    const { db, rows } = makeFakeContactDb();
    await seedContact(db, {
      id: "ct_existing",
      email: "existing@example.com",
      firstName: "Old",
      lastName: "Name",
    });
    const csvRows = [
      { line: 2, parsed: { email: "existing@example.com", firstName: "Newer1" } },
      { line: 3, parsed: { email: "existing@example.com", lastName: "Newer2" } },
    ];

    const result = await applyImportRows(db, ORG, csvRows);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.contactIds).toEqual(["ct_existing"]);
    const row = rows().find((r) => r.id === "ct_existing");
    expect(row?.firstName).toBe("Newer1");
    expect(row?.lastName).toBe("Newer2");
  });

  it("(d) a mixed file's plan counts equal the commit counts", async () => {
    const { db: planDb } = makeFakeContactDb();
    const { db: applyDb } = makeFakeContactDb();

    // Two independent, identically-seeded dbs: one is dry-run planned, the
    // other actually committed, so plan vs. commit counts can be compared
    // without one run's writes contaminating the other's reads.
    for (const db of [planDb, applyDb]) {
      await seedContact(db, {
        id: "ct_existing",
        email: "existing@example.com",
        firstName: "Old",
        lastName: "Name",
      });
    }

    const csvRows = [
      // existing@example.com touched twice -> 1 update, not 2.
      { line: 2, parsed: { email: "existing@example.com", firstName: "Changed1" } },
      { line: 3, parsed: { email: "existing@example.com", firstName: "Changed2" } },
      // brand-new@example.com touched twice -> 1 create, not "1 create + 1 update".
      { line: 4, parsed: { email: "brand-new@example.com", firstName: "Brand", lastName: "New" } },
      { line: 5, parsed: { email: "brand-new@example.com", lastName: "Newer" } },
      // a single, unambiguous second new contact -> 1 create.
      { line: 6, parsed: { email: "solo@example.com", firstName: "Solo", lastName: "Contact" } },
    ];

    const plan = await planImportRows(planDb, ORG, csvRows);
    const result = await applyImportRows(applyDb, ORG, csvRows);

    expect(plan.created).toBe(result.created);
    expect(plan.updated).toBe(result.updated);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(1);
  });
});
