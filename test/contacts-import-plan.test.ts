// DEC-663 regression: the server half of the planned CSV import dry-run.
// Mirrors test/contacts-import.test.ts's in-memory fake Db (real eq/and/
// inArray/sql`lower(...)` semantics evaluated structurally — no D1 test
// harness exists in this repo) so planImportRows/applyImportRows are
// exercised through the real contactsRoutes sub-app, not a scripted
// response queue.

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
        // DEC-491 amendment (wave 47): see the identical comment in
        // test/contacts-import.test.ts's makeFakeContactDb.
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

describe("POST /api/v1/contacts/import dryRun=true (DEC-663 plan)", () => {
  it("surfaces a possibleDuplicate for a same-human-second-email row instead of a clean create", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@work.example.com",
      company: "Analytical Engines Inc",
    });

    const csvText = "Email,First,Last,Company\nada.lovelace@newmail.example.com,Ada,Lovelace,Analytical Engines Inc\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName", Company: "company" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { action: string; possibleDuplicates?: { id: string }[] }[];
      created: number;
      updated: number;
      skipped: number;
    };
    expect(body.rows).toHaveLength(1);
    // Never reported as a clean create -- it must name the possible duplicate.
    expect(body.rows[0]?.action).toBe("create");
    expect(body.rows[0]?.possibleDuplicates).toBeDefined();
    expect(body.rows[0]?.possibleDuplicates?.map((d) => d.id)).toEqual(["ct_1"]);
    expect(body.created).toBe(1);
    expect(body.updated).toBe(0);
    expect(body.skipped).toBe(0);
    // No write happened.
    expect(rows()).toHaveLength(1);
  });

  it("reports a bio overwrite with from/to when the incoming bio would replace a stored non-blank bio", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_bio",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      bio: "Original bio.",
    });

    const csvText = "Email,Bio\ngrace@example.com,New bio text.\n";
    const mapping = { Email: "email", Bio: "bio" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { action: string; overwrites?: { field: string; from: string; to: string }[] }[];
    };
    expect(body.rows[0]?.action).toBe("update");
    expect(body.rows[0]?.overwrites).toEqual([{ field: "bio", from: "Original bio.", to: "New bio text." }]);
  });

  it("dryRun writes nothing -- the contact table is byte-identical afterward", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, { id: "ct_existing", email: "existing@example.com" });
    const before = JSON.stringify(rows());

    const csvText = "Email,First,Last\nexisting@example.com,Changed,Name\nbrand.new@example.com,Brand,New\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: true }),
    });
    expect(res.status).toBe(200);
    const after = JSON.stringify(rows());
    expect(after).toBe(before);
  });

  it("honours skipLines on the real run: skipped lines are not written and reflected in post-commit counts", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    // Line numbers: header is line 1, so first data row is line 2, second is line 3.
    const csvText = "Email,First,Last\nkeep@example.com,Keep,Me\nskip@example.com,Skip,Me\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, skipLines: [3] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; skipped: { line: number; reason: string }[] };
    expect(body.created).toBe(1);
    expect(body.updated).toBe(0);
    expect(body.skipped).toEqual([{ line: 3, reason: "skipped by organizer" }]);
    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { email: string }).email).toBe("keep@example.com");
  });
});
