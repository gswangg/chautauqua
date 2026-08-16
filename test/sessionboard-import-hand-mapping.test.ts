// DEC-613 (amendment, task-w60-b) coverage: the P0 trap was a hand-set,
// non-empty mapping guaranteeing "Missing external id (Record ID)" on every
// row, because the UI's OWN target-field vocabulary never offered
// "externalId" as a pill (src/routes/api/import.ts:90-91 only auto-maps
// when the posted mapping is EMPTY -- an explicit mapping always stays
// authoritative, unchanged by this task). This file exercises the route
// exactly as the fixed UI now would: a non-empty mapping that DOES include
// "externalId", using the same in-memory fake Db technique as
// test/sessionboard-import-route.test.ts (no D1 test harness exists in
// this repo) -- plus the falsifying twin: a hand mapping that omits
// externalId still yields the row-level issue, proving the assertion is
// live rather than vacuous.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; val: unknown[] }
  | { __marker: "lower"; col: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, val: vals }),
    // loadContactsByEmail's email-fallback pre-pass uses
    // inArray(sql`lower(col)`, batch) -- mocked to a structural marker
    // (same technique as test/sessionboard-import-route.test.ts) so this
    // fake's evalCond/fieldValue below can interpret it; every other
    // sql`...` usage falls back to the real tag, unchanged.
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]): unknown => {
        if (strings.length === 2 && strings[0]?.trim() === "lower(" && strings[1]?.trim() === ")") {
          return { __marker: "lower", col: values[0] } satisfies Marker;
        }
        return actual.sql(strings, ...values);
      },
      actual.sql,
    ),
  };
});

const { importRoutes } = await import("../src/routes/api/import");

type TableTag = "event" | "contact" | "submission" | "track" | "participant";

const TABLES: Record<TableTag, unknown> = {
  event: schema.event,
  contact: schema.contact,
  submission: schema.submission,
  track: schema.track,
  participant: schema.participant,
};

function tableTag(table: unknown): TableTag {
  for (const [tag, obj] of Object.entries(TABLES)) {
    if (obj === table) return tag as TableTag;
  }
  throw new Error("fake db: unknown table");
}

function colInfo(col: unknown): { tag: string; key: string } | null {
  for (const [tag, tableObj] of Object.entries(TABLES)) {
    for (const [key, value] of Object.entries(tableObj as Record<string, unknown>)) {
      if (value === col) return { tag, key };
    }
  }
  return null;
}

function fieldValue(colOrExpr: unknown, row: Record<string, unknown>): unknown {
  const m = colOrExpr as Marker;
  if (m && typeof m === "object" && "__marker" in m && m.__marker === "lower") {
    return String(fieldValue(m.col, row)).toLowerCase();
  }
  const info = colInfo(colOrExpr);
  if (!info) throw new Error("fake db: condition referenced an unresolved column");
  return row[info.key];
}

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") return fieldValue(m.col, row) === m.val;
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.val.includes(fieldValue(m.col, row));
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

interface FakeRows {
  event: Record<string, unknown>[];
  contact: Record<string, unknown>[];
  submission: Record<string, unknown>[];
  track: Record<string, unknown>[];
  participant: Record<string, unknown>[];
}

function makeFakeDb() {
  const rows: FakeRows = { event: [], contact: [], submission: [], track: [], participant: [] };

  const db = {
    select(fields?: Record<string, unknown>) {
      let table: unknown = null;
      let whereCond: unknown = null;
      let limitN: number | null = null;
      const chain: any = {
        from: (t: unknown) => {
          table = t;
          return chain;
        },
        where: (cond: unknown) => {
          whereCond = cond;
          return chain;
        },
        limit: (n: number) => {
          limitN = n;
          return chain;
        },
        then: (resolve: (v: unknown[]) => void) => {
          const tag = tableTag(table);
          const all = rows[tag] ?? [];
          const filtered = whereCond ? all.filter((r) => evalCond(whereCond, r)) : all.slice();
          const projected = fields
            ? filtered.map((r) => {
                const out: Record<string, unknown> = {};
                for (const [outKey, col] of Object.entries(fields)) {
                  out[outKey] = fieldValue(col, r);
                }
                return out;
              })
            : filtered.map((r) => ({ ...r }));
          resolve(limitN !== null ? projected.slice(0, limitN) : projected);
        },
      };
      return chain;
    },
    insert(table: unknown) {
      const tag = tableTag(table);
      return {
        values: async (vals: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(vals) ? vals : [vals];
          for (const v of list) rows[tag]?.push({ ...v });
        },
      };
    },
    update(table: unknown) {
      const tag = tableTag(table);
      return {
        set: (vals: Record<string, unknown>) => ({
          where: async (cond: unknown) => {
            rows[tag] = (rows[tag] ?? []).map((r) => (evalCond(cond, r) ? { ...r, ...vals } : r));
          },
        }),
      };
    },
  };

  return { db: db as unknown as AppEnv["Variables"]["db"], rows };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", importRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

function seedEvent(rows: FakeRows, id: string, orgId: string) {
  const now = new Date();
  rows.event.push({
    id,
    orgId,
    name: "Test Event",
    slug: `test-event-${id}`,
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    location: null,
    timezone: "UTC",
    recordPrefix: "SES",
    brandingJson: null,
    createdAt: now,
    updatedAt: now,
  });
}

// A CSV whose header names do NOT match any of the built-in aliases in
// src/domain/sessionboard.ts's SB_ALIASES -- exactly the "operator hand-maps
// because auto-detect missed the columns" scenario the P0 was filed against.
const HAND_MAPPED_CSV = "sb_ref,work_email,given_name,family_name\nsb-1,new@example.com,Ada,Lovelace\n";

describe("POST /api/v1/events/:eventId/import/sessionboard, hand-set mapping (DEC-613 amendment, task-w60-b)", () => {
  it("a non-empty hand-set mapping that includes externalId creates rows", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        entity: "contacts",
        csvText: HAND_MAPPED_CSV,
        mapping: {
          sb_ref: "externalId",
          work_email: "email",
          given_name: "firstName",
          family_name: "lastName",
        },
        dryRun: false,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; issues: unknown[] };
    expect(body).toMatchObject({ created: 1, updated: 0, issues: [] });
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]).toMatchObject({
      email: "new@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      externalRef: "sessionboard:sb-1",
    });
  });

  it("falsifying twin: a hand-set mapping that omits externalId still yields the per-row issue and 0 imported", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        entity: "contacts",
        csvText: HAND_MAPPED_CSV,
        mapping: { work_email: "email", given_name: "firstName", family_name: "lastName" },
        dryRun: false,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      created: number;
      updated: number;
      issues: { row: number; field: string; message: string }[];
    };
    expect(body.created).toBe(0);
    expect(body.updated).toBe(0);
    expect(body.issues).toEqual([{ row: 2, field: "externalId", message: "Missing external id (Record ID)" }]);
    expect(rows.contact).toHaveLength(0);
  });
});
