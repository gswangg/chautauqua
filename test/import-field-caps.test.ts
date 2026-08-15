// DEC-417 (amendment): bulk importers enforce the same per-column caps
// every hand-typed editor enforces. Two layers exercised here:
//  1. The CRM CSV importer (routes/api/contacts/import.ts ->
//     planImportRows/applyImportRows) via the real contactsRoutes sub-app,
//     using the same in-memory fake Db idiom as
//     test/contacts-import-plan.test.ts (no D1 test harness exists in this
//     repo) -- a row one character over cap is refused BY NAME at plan
//     time (dryRun=true), applyImportRows refuses the identical row, and a
//     good row in the same file still imports.
//  2. The sessionboard importer's pure planner (domain/sessionboard.ts) --
//     an over-cap mapped value is dropped with an issue naming the field,
//     never truncated.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH, MAX_TEXT_LENGTH } from "../src/forms/validate";
import { importFieldCapViolations } from "../src/domain/contacts";
import { planSessionboardRows } from "../src/domain/sessionboard";

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

function makeFakeContactDb() {
  let rows: Record<string, unknown>[] = [];

  const db = {
    select(fields?: Record<string, unknown>) {
      let whereCond: unknown = null;
      const run = () => {
        const filtered = whereCond ? rows.filter((r) => evalCond(whereCond, r)) : rows.slice();
        return filtered.map((r) => ({ ...r }));
      };
      const chain: any = {
        from: () => chain,
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

describe("CRM CSV import: per-column caps (DEC-417 amendment)", () => {
  it("refuses a firstName one character over MAX_NAME_LENGTH at plan time, by name, and never writes it -- the good row in the same file still imports", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);

    const overCapFirstName = "A".repeat(MAX_NAME_LENGTH + 1);
    const csvText =
      `Email,First\n` +
      `over@example.com,${overCapFirstName}\n` +
      `good@example.com,Good\n`;
    const mapping = { Email: "email", First: "firstName" };

    // Plan (dry run): the over-cap row is a skip naming firstName; nothing written.
    const planRes = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: true }),
    });
    expect(planRes.status).toBe(200);
    const plan = (await planRes.json()) as {
      rows: { line: number; email: string; action: string; capViolations?: Record<string, string> }[];
      created: number;
      skipped: number;
    };
    const overRow = plan.rows.find((r) => r.email === "over@example.com");
    expect(overRow?.action).toBe("skip");
    expect(overRow?.capViolations).toBeDefined();
    expect(Object.keys(overRow!.capViolations!)).toEqual(["firstName"]);
    const goodRow = plan.rows.find((r) => r.email === "good@example.com");
    expect(goodRow?.action).toBe("create");
    expect(plan.created).toBe(1);
    expect(plan.skipped).toBe(1);
    expect(rows()).toHaveLength(0);

    // Apply (real run): applyImportRows refuses the exact same row.
    const applyRes = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ csvText, mapping, dryRun: false }),
    });
    expect(applyRes.status).toBe(200);
    const applied = (await applyRes.json()) as {
      created: number;
      updated: number;
      skipped: { line: number; reason: string }[];
    };
    expect(applied.created).toBe(1);
    expect(applied.skipped).toHaveLength(1);
    expect(applied.skipped[0]?.reason).toContain("firstName");
    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { email: string }).email).toBe("good@example.com");
  });

  it("refuses a bio one character over MAX_LONG_TEXT_LENGTH and a custom field one character over MAX_TEXT_LENGTH, each named", () => {
    const overBio = "b".repeat(MAX_LONG_TEXT_LENGTH + 1);
    const violations = importFieldCapViolations({ email: "a@example.com", bio: overBio });
    expect(Object.keys(violations)).toEqual(["bio"]);

    const overCustom = "c".repeat(MAX_TEXT_LENGTH + 1);
    const customViolations = importFieldCapViolations({
      email: "a@example.com",
      customFields: { notes: overCustom },
    });
    expect(Object.keys(customViolations)).toEqual(["custom.notes"]);
  });

  it("never truncates -- a value exactly at cap is not a violation", () => {
    const atCap = "x".repeat(MAX_NAME_LENGTH);
    const violations = importFieldCapViolations({ email: "a@example.com", firstName: atCap });
    expect(violations).toEqual({});
  });
});

describe("Sessionboard import planner: per-column caps (DEC-417 amendment)", () => {
  it("drops a contacts firstName one character over MAX_NAME_LENGTH, naming the row+field as an issue -- never truncated", () => {
    const overCap = "A".repeat(MAX_NAME_LENGTH + 1);
    const header = ["Record ID", "Email", "First Name"];
    const rows = [["rec1", "person@example.com", overCap]];
    const mapping = { "Record ID": "externalId", Email: "email", "First Name": "firstName" };

    const { plans, issues } = planSessionboardRows("contacts", header, rows, mapping);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.values.firstName).toBeUndefined();
    expect(plans[0]?.values.email).toBe("person@example.com");
    const issue = issues.find((i) => i.field === "firstName");
    expect(issue).toBeDefined();
    expect(issue?.row).toBe(2);
  });

  it("drops a submissions title one character over MAX_NAME_LENGTH, matching routes/api/contacts/import.ts's sessionTitle cap", () => {
    const overCap = "T".repeat(MAX_NAME_LENGTH + 1);
    const header = ["Record ID", "Session Title"];
    const rows = [["rec1", overCap]];
    const mapping = { "Record ID": "externalId", "Session Title": "title" };

    const { plans, issues } = planSessionboardRows("submissions", header, rows, mapping);
    expect(plans[0]?.values.title).toBeUndefined();
    expect(issues.some((i) => i.field === "title")).toBe(true);
  });

  it("a title exactly at MAX_NAME_LENGTH is kept, not dropped", () => {
    const atCap = "T".repeat(MAX_NAME_LENGTH);
    const header = ["Record ID", "Session Title"];
    const rows = [["rec1", atCap]];
    const mapping = { "Record ID": "externalId", "Session Title": "title" };

    const { plans, issues } = planSessionboardRows("submissions", header, rows, mapping);
    expect(plans[0]?.values.title).toBe(atCap);
    expect(issues.some((i) => i.field === "title")).toBe(false);
  });
});
