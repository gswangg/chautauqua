// P1 regression (w1-f): reproduces "CSV import silently not persisting" at
// the route level, walking the exact client payload the ImportWizard sends
// (app/src/pages/contacts/ImportWizard.tsx runImport() -> apiPost
// '/contacts/import', { csvText, mapping }) through the real
// contactsRoutes sub-app, backed by a minimal in-memory fake Db that
// evaluates the actual drizzle eq/and conditions the repo layer builds
// (rather than a queued-response fake, per the comment atop
// src/server/repo/contacts.ts: no D1 test harness exists in this repo).
// A created contact must be retrievable via GET /contacts search
// afterward, and a second import of the same email must update, not
// duplicate.

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
    // DEC-356's chunked email lookup uses inArray(sql`lower(col)`, batch);
    // mocked here (rather than left as real drizzle SQL objects) so the
    // in-memory evalCond below can still evaluate it structurally.
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, val: vals }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]): unknown => {
      if (strings.length === 2 && strings[0]?.trim() === "lower(" && strings[1]?.trim() === ")") {
        return { __marker: "lower", col: values[0] } satisfies Marker;
      }
      // Other sql`...` usages (e.g. a count(*) select field) aren't part of
      // a where condition this fake evaluates structurally -- fall back to
      // the real drizzle sql tag, unchanged from pre-DEC-356 behavior.
      return actual.sql(strings, ...values);
    },
  };
});

// Imported after the mock so contactsRoutes -> repo/contacts.ts picks up the
// mocked eq/and/or.
const { contactsRoutes } = await import("../src/routes/api/contacts");

function colKey(col: unknown): string {
  for (const [key, value] of Object.entries(schema.contact)) {
    if (value === col) return key;
  }
  throw new Error("fake db: condition referenced a column not on schema.contact");
}

/** Resolves a column reference (which may be wrapped in a "lower" marker
 * from a mocked sql`lower(...)` call) to its value on a row. */
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

/** In-memory fake Db for the `contact` table only: real insert/select/update
 * semantics (evaluated against the real eq/and markers above), so this
 * exercises the actual repo write + read path rather than a scripted
 * response queue. */
function makeFakeContactDb() {
  let rows: Record<string, unknown>[] = [];

  const db = {
    select(fields?: Record<string, unknown>) {
      let table: unknown = schema.contact;
      let whereCond: unknown = null;
      let limitN: number | null = null;
      let offsetN = 0;
      const run = () => {
        // DEC-712: GET /contacts also issues a batched select over
        // `participant` for the page's labels — this fake only models
        // `contact` rows, and this test never seeds any participant rows,
        // so any other table always resolves to an empty result set
        // without running the contact-only condition evaluator.
        if (table !== schema.contact) return [];
        const filtered = whereCond ? rows.filter((r) => evalCond(whereCond, r)) : rows.slice();
        // Aggregate select (e.g. `select({ count: sql`count(*)` })`): the
        // field value isn't a real schema.contact column, so colKey/project
        // can't resolve it — treat any such select as a one-row count(*).
        if (fields && Object.values(fields).some((v) => !Object.values(schema.contact).includes(v))) {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(fields)) out[key] = filtered.length;
          return [out];
        }
        const projected = fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
        return limitN !== null ? projected.slice(offsetN, offsetN + limitN) : projected;
      };
      // orderBy is a no-op here (the real ordering is exercised against a
      // real DB elsewhere; this fake only needs to route rows through, per
      // the module comment above — no eq/and-only condition evaluator for
      // ORDER BY exists).
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
        // DEC-491 amendment (wave 47): real drizzle .values() accepts a
        // single row OR an array of rows (chunkRowsForInsert always
        // passes an array, even a one-row chunk); the returned object is
        // both directly awaitable (the plain-INSERT create path) and
        // chainable via .onConflictDoUpdate() (the upsert-flavored update
        // path -- "excluded.col" is resolved here as "the incoming row's
        // own value for that key", which is exactly what excluded means
        // when the set clause's key equals the referenced column name, as
        // it always does in src/server/repo/contacts/import.ts).
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
          // touchSubmissionsForContacts (DEC-725 amendment) now issues an
          // UPDATE ... submission ... WHERE id IN (SELECT ... FROM
          // participant ...) after every contact write in the flush loop.
          // This fake only models the `contact` table (see module comment);
          // an update against any other table is a no-op, mirroring
          // select()'s existing "unmodeled table -> empty result" guard
          // above rather than misapplying the condition to contact rows.
          where: async (cond: unknown) => {
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

// Not viaBearer: this is a cookie-session organizer, matching the real SPA,
// so the x-chq-csrf header below (set by app/src/lib/api.ts's apiPost on
// every mutation) is load-bearing for the request to pass csrfJson.
const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

describe("POST /api/v1/contacts/import (P1: silent non-persistence repro)", () => {
  it("persists a new-email row (created:1) and it's retrievable via GET /contacts search", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    // Mirrors ImportWizard's client payload shape exactly: csvText (raw
    // pasted text) + mapping (csv column header -> target field).
    const csvText = "Email,First,Last\nnew.person@example.com,New,Person\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const importRes = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping }),
    });
    expect(importRes.status).toBe(200);
    const importBody = (await importRes.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(importBody).toEqual({ created: 1, updated: 0, skipped: [] });

    // (search-by-q exercises a LIKE ... COLLATE NOCASE clause the fake db's
    // eq/and-only condition evaluator doesn't model; list unfiltered instead
    // -- the point under test is that the created row round-trips through
    // GET /contacts at all, which q-filtering would only narrow further.)
    const searchRes = await app.request("/api/v1/contacts");
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { items: { email: string; firstName: string }[]; total: number };
    expect(searchBody.total).toBe(1);
    expect(searchBody.items).toHaveLength(1);
    expect(searchBody.items[0]?.email).toBe("new.person@example.com");
    expect(searchBody.items[0]?.firstName).toBe("New");
  });

  it("updates rather than duplicates a row re-imported with the same email", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText: "Email,First,Last\ndup@example.com,Old,Name\n", mapping }),
    });
    expect(rows()).toHaveLength(1);

    const secondRes = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText: "Email,First,Last\nDUP@example.com,New,Name\n", mapping }),
    });
    const secondBody = (await secondRes.json()) as { created: number; updated: number };
    expect(secondBody).toEqual({ created: 0, updated: 1, skipped: [] });
    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { firstName: string }).firstName).toBe("New");
  });

  it("DEC-575: a blank bio cell and a partial custom-field sheet never clear existing bio/custom fields", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    // Seed an existing contact directly (bypassing import) with a bio and
    // two custom fields.
    await db
      .insert(schema.contact)
      .values({
        id: "ct_seed",
        orgId: "org-1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: null,
        company: null,
        title: null,
        bio: "Computing pioneer.",
        notes: null,
        customFieldsJson: JSON.stringify({ badge: "VIP", dietary: "Vegan" }),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

    // Re-import the same email with an empty Bio column and one custom
    // column (TalkTitle) the original row never carried.
    const csvText = "Email,Bio,TalkTitle\nada@example.com,,Ada's Keynote\n";
    const mapping = { Email: "email", Bio: "bio", TalkTitle: "custom.talkTitle" };

    const importRes = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping }),
    });
    expect(importRes.status).toBe(200);
    const importBody = (await importRes.json()) as { created: number; updated: number };
    expect(importBody).toEqual({ created: 0, updated: 1, skipped: [] });

    const updatedRow = rows().find((r) => (r as { id: string }).id === "ct_seed") as {
      bio: string | null;
      customFieldsJson: string | null;
    };
    // Bio survives (blank cell never clears it).
    expect(updatedRow.bio).toBe("Computing pioneer.");
    // Both original custom fields survive, and the new one is added.
    expect(JSON.parse(updatedRow.customFieldsJson as string)).toEqual({
      badge: "VIP",
      dietary: "Vegan",
      talkTitle: "Ada's Keynote",
    });
  });

  it("fails loudly with a 400 (not an unhandled 500) on an unsupported mapping target", async () => {
    const { db } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    // 'zipCode' isn't a target the pure core (src/domain/contacts.ts
    // mapImportRow) or the client wizard (STANDARD_IMPORT_FIELDS) recognize;
    // this covers a client/server mapping mismatch reaching the route directly.
    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        csvText: "Email,Zip\na@example.com,90210\n",
        mapping: { Email: "email", Zip: "zipCode" },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });
});
