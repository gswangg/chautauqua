// DEC-663 (wave-64 amendment): the merge-disposition half of the CSV import
// contract. A merged line patches an organizer-named existing contact
// (never creates), and the server re-derives every merge choice against the
// same possible-duplicate candidate set planImportRows would compute rather
// than trusting the client's line/contactId pairing.
//
// Mirrors test/contacts-import-plan.test.ts's in-memory fake Db (real eq/
// and/inArray/sql`lower(...)` semantics evaluated structurally — no D1 test
// harness exists in this repo).

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
    update(table: unknown) {
      return {
        set: (vals: Record<string, unknown>) => ({
          where: async (cond: unknown) => {
            // DEC-299's attribution backfill (src/server/repo/attribution.ts)
            // issues its own update against schema.participant, a table this
            // contact-only fake never models -- a no-op here, matching "no
            // never-taken attribution snapshot exists to repair" in a store
            // with no participant rows at all.
            if (table !== schema.contact) return;
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
const OTHER_ORG: AuthInfo = { userId: "u2", role: "organizer", orgId: "org-2" };

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

const ADA_CSV = "Email,First,Last,Company\nada.lovelace@newmail.example.com,Ada,Lovelace,Analytical Engines Inc\n";
const MAPPING = { Email: "email", First: "firstName", Last: "lastName", Company: "company" };

describe("POST /api/v1/contacts/import mergeLines (DEC-663 wave-64 amendment)", () => {
  it("patches the named target, replaces its email, counts as updated, and creates no new row", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@work.example.com",
      company: "Analytical Engines Inc",
      bio: "Mathematician.",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        csvText: ADA_CSV,
        mapping: MAPPING,
        mergeLines: [{ line: 2, contactId: "ct_1" }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(body.skipped).toEqual([]);
    expect(rows()).toHaveLength(1);
    const row = rows()[0] as Record<string, unknown>;
    expect(row.id).toBe("ct_1");
    expect(row.email).toBe("ada.lovelace@newmail.example.com");
    // Untouched columns (bio wasn't in the CSV mapping) are preserved.
    expect(row.bio).toBe("Mathematician.");
  });

  it("a later same-email row in the file patches the same merged contact, not a fresh one", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@work.example.com",
      company: "Analytical Engines Inc",
    });

    const csvText =
      "Email,First,Last,Company,Bio\n" +
      "ada.lovelace@newmail.example.com,Ada,Lovelace,Analytical Engines Inc,First pass bio.\n" +
      "ada.lovelace@newmail.example.com,Ada,Lovelace,Analytical Engines Inc,Second pass bio.\n";
    const mapping = { ...MAPPING, Bio: "bio" };

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, mergeLines: [{ line: 2, contactId: "ct_1" }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number };
    expect(body.created).toBe(0);
    // Both rows resolve to an update against the same contact -- counted
    // per-row (matching applyImportRows' existing within-file-duplicate
    // convention: two occurrences of the same email are two update events),
    // never a second created row.
    expect(body.updated).toBe(2);
    expect(rows()).toHaveLength(1);
    const row = rows()[0] as Record<string, unknown>;
    expect(row.bio).toBe("Second pass bio.");
  });

  it("400s when the merge target is unknown", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText: ADA_CSV, mapping: MAPPING, mergeLines: [{ line: 2, contactId: "no-such-id" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("400s when the merge target belongs to another org", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_foreign",
      orgId: "org-2",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@other-org.example.com",
      company: "Analytical Engines Inc",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText: ADA_CSV, mapping: MAPPING, mergeLines: [{ line: 2, contactId: "ct_foreign" }] }),
    });
    expect(res.status).toBe(400);
    void OTHER_ORG; // documents the seeded row's org, unused as an auth identity here
  });

  it("400s when the merged line also appears in skipLines", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@work.example.com",
      company: "Analytical Engines Inc",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        csvText: ADA_CSV,
        mapping: MAPPING,
        skipLines: [2],
        mergeLines: [{ line: 2, contactId: "ct_1" }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400s when the merged line's own email already resolves to an update", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_email_match",
      firstName: "Someone",
      lastName: "Else",
      email: "ada.lovelace@newmail.example.com",
    });
    await seedContact(db, {
      id: "ct_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@work.example.com",
      company: "Analytical Engines Inc",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText: ADA_CSV, mapping: MAPPING, mergeLines: [{ line: 2, contactId: "ct_1" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("400s when the named contact is not a possible duplicate for that row (a stranger id)", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_stranger",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText: ADA_CSV, mapping: MAPPING, mergeLines: [{ line: 2, contactId: "ct_stranger" }] }),
    });
    expect(res.status).toBe(400);
  });
});
