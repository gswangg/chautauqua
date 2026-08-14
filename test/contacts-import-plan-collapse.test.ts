// DEC-663 amendment (wave 61) regression: the CSV import dry-run plan must
// model the same within-file email collapse the real run performs (a
// second row in the SAME file carrying an email first seen earlier in that
// file resolves as an update against the row minted by the earlier row, not
// a second create). Harness copied from test/contacts-import-plan.test.ts
// (same in-memory fake Db, exercised through the real contactsRoutes
// sub-app for both dryRun=true and the real commit path).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
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

const { contactsRoutes } = await import("../src/routes/api/contacts");

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
      let whereCond: unknown = null;
      let limitN: number | null = null;
      let offsetN = 0;
      const run = () => {
        const filtered = whereCond ? rows.filter((r) => evalCond(whereCond, r)) : rows.slice();
        if (fields && Object.values(fields).some((v) => !Object.values(schema.contact).includes(v))) {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(fields)) out[key] = filtered.length;
          return [out];
        }
        const projected = fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
        return limitN !== null ? projected.slice(offsetN, offsetN + limitN) : projected;
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
        offset: (n: number) => {
          offsetN = n;
          return chain;
        },
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

  return { db: db as unknown as AppEnv["Variables"]["db"], rows: () => rows };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

function seedContact(db: AppEnv["Variables"]["db"], overrides: Record<string, unknown>) {
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

describe("CSV import plan/apply: within-file email collapse (DEC-663 amendment, wave 61)", () => {
  it("plans created:1, updated:1 for a two-row file with one repeated new email, second row an update with no contactId and the fixed reason", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    const csvText =
      "Email,First,Last\n" +
      "new.person@example.com,New,Person\n" +
      "new.person@example.com,Newer,Personson\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { line: number; action: string; contactId?: string; reason?: string }[];
      created: number;
      updated: number;
      skipped: number;
    };
    expect(body.created).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]?.action).toBe("create");
    expect(body.rows[1]?.action).toBe("update");
    expect(body.rows[1]?.contactId).toBeUndefined();
    expect(body.rows[1]?.reason).toBe("same email as an earlier row in this file");
    // dry run: no write happened.
    expect(rows()).toHaveLength(0);
  });

  it("applyImportRows on the identical two rows produces the identical created/updated tallies and exactly one contact row", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    const csvText =
      "Email,First,Last\n" +
      "new.person@example.com,New,Person\n" +
      "new.person@example.com,Newer,Personson\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(body.created).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.skipped).toEqual([]);
    expect(rows()).toHaveLength(1);
    const row = rows()[0] as { firstName: string; lastName: string };
    // Second row's patch won (matches applyImportRows' base-chaining).
    expect(row.firstName).toBe("Newer");
    expect(row.lastName).toBe("Personson");
  });

  it("a repeated email that ALSO matches an existing DB contact still plans update-against-that-contact on both rows", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_existing",
      email: "existing@example.com",
      firstName: "Old",
      lastName: "Name",
    });

    const csvText =
      "Email,First,Last\n" + "existing@example.com,Changed,Once\n" + "existing@example.com,Changed,Twice\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { action: string; contactId?: string; reason?: string }[];
      created: number;
      updated: number;
    };
    expect(body.created).toBe(0);
    expect(body.updated).toBe(2);
    expect(body.rows[0]?.action).toBe("update");
    expect(body.rows[0]?.contactId).toBe("ct_existing");
    expect(body.rows[0]?.reason).toBeUndefined();
    expect(body.rows[1]?.action).toBe("update");
    expect(body.rows[1]?.contactId).toBe("ct_existing");
    expect(body.rows[1]?.reason).toBeUndefined();
    expect(rows()).toHaveLength(1);
  });
});
