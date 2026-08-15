// DEC-671: the contacts export carries the directory's own filter (q/
// segmentId/rules), via selectFilteredContactRows (src/server/repo/contacts/
// crud.ts) — the same row-selection predicate listContactsForOrg uses, minus
// the page window. Unlike the fake-db-double style used for the DEC-649
// submissions export filter test (which never wires a real SQL engine), this
// exercises the REAL generated WHERE/ORDER BY SQL against a real in-memory
// node:sqlite database (same technique as
// test/public-copresenter-visibility.test.ts) — because the q filter is a
// LIKE/ESCAPE/COLLATE predicate that must actually be evaluated, not just
// diffed as text, to prove the filter narrows the export.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SQLiteSyncDialect, type SQLiteSelectQueryBuilder } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { exportContacts } from "../src/server/repo/exports/contacts";
import type { ParsedContactListQuery } from "../src/server/repo/contacts/query";

const ORG_ID = "org-1";

interface RawContact {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  title?: string | null;
}

const CONTACTS: RawContact[] = [
  { id: "c1", orgId: ORG_ID, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Acme" },
  { id: "c2", orgId: ORG_ID, firstName: "Alan", lastName: "Turing", email: "alan@example.com", company: "Globex" },
  { id: "c3", orgId: ORG_ID, firstName: "Grace", lastName: "Hopper", email: "grace@example.com", company: "Initech" },
];

// A minimal real-SQL-backed Db double: the drizzle query builder chain is
// used only to build SQL AST (schema.contact columns, where/orderBy
// expressions); every terminal chain resolves by converting the accumulated
// where/orderBy expressions to real SQL text via SQLiteSyncDialect and
// running it against an in-memory node:sqlite table — so a LIKE/ESCAPE/
// COLLATE q predicate is genuinely evaluated, not hand-simulated in JS.
function makeRealDb(rows: RawContact[]): Db {
  const sqliteDb = new DatabaseSync(":memory:");
  sqliteDb.exec(
    `CREATE TABLE contact (
      id TEXT PRIMARY KEY, org_id TEXT, first_name TEXT, last_name TEXT, email TEXT,
      phone TEXT, company TEXT, title TEXT, bio TEXT, headshot_url TEXT,
      headshot_file_id TEXT,
      social_links_json TEXT, notes TEXT, custom_fields_json TEXT,
      created_at INTEGER, updated_at INTEGER
    )`,
  );
  const insert = sqliteDb.prepare(
    `INSERT INTO contact (id, org_id, first_name, last_name, email, company, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = 1_700_000_000_000;
  for (const r of rows) {
    insert.run(r.id, r.orgId, r.firstName, r.lastName, r.email, r.company, r.title ?? null, now, now);
  }

  const dialect = new SQLiteSyncDialect();

  function runSelect(whereExpr: SQL, orderExprs: SQL[], limitN: number | undefined) {
    const whereQ = dialect.sqlToQuery(whereExpr);
    let sqlText = `SELECT * FROM contact WHERE ${whereQ.sql}`;
    const params = [...whereQ.params];
    if (orderExprs.length > 0) {
      const orderParts: string[] = [];
      for (const expr of orderExprs) {
        const q = dialect.sqlToQuery(expr);
        orderParts.push(q.sql);
        params.push(...q.params);
      }
      sqlText += ` ORDER BY ${orderParts.join(", ")}`;
    }
    if (limitN !== undefined) {
      sqlText += ` LIMIT ${limitN}`;
    }
    const stmt = sqliteDb.prepare(sqlText);
    const raw = stmt.all(...(params as (string | number)[])) as Record<string, unknown>[];
    return raw.map(
      (r) =>
        ({
          id: r.id,
          orgId: r.org_id,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          company: r.company,
          title: r.title,
          bio: r.bio,
          headshotUrl: r.headshot_url,
          socialLinksJson: r.social_links_json,
          notes: r.notes,
          customFieldsJson: r.custom_fields_json,
          createdAt: new Date(r.created_at as number),
          updatedAt: new Date(r.updated_at as number),
        }) as unknown as typeof schema.contact.$inferSelect,
    );
  }

  function chain(whereExpr: SQL | undefined, orderExprs: SQL[], limitN: number | undefined) {
    const c: Record<string, unknown> = {
      where(expr: SQL) {
        return chain(expr, orderExprs, limitN);
      },
      orderBy(...exprs: SQL[]) {
        return chain(whereExpr, exprs, limitN);
      },
      limit(n: number) {
        return chain(whereExpr, orderExprs, n);
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        if (!whereExpr) throw new Error("fake db: select ran without a where() call");
        return Promise.resolve(runSelect(whereExpr, orderExprs, limitN)).then(resolve, reject);
      },
    };
    return c;
  }

  const db = {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          if (table !== schema.contact) throw new Error("fake db: unexpected table");
          return chain(undefined, [], undefined);
        },
      };
    },
  };

  return db as unknown as Db;
}

function baseParams(overrides: Partial<ParsedContactListQuery> = {}): ParsedContactListQuery {
  return { page: 1, perPage: 50, q: null, segmentId: null, sort: "name", rules: [], ...overrides };
}

void (0 as unknown as SQLiteSelectQueryBuilder); // type-only import keeps the drizzle-orm type surface honest

describe("exportContacts carries the directory's own filter (DEC-671)", () => {
  it("an unfiltered export returns all 3 seeded contacts, sorted by (lastName, firstName, id)", async () => {
    const db = makeRealDb(CONTACTS);
    const table = await exportContacts(db, ORG_ID);
    expect(table.rows).toHaveLength(3);
    expect(table.rows.map((r) => r[0])).toEqual(["c3", "c1", "c2"]); // Hopper, Lovelace, Turing
  });

  it("?q= matching one contact narrows the export to exactly 1 data row", async () => {
    const db = makeRealDb(CONTACTS);
    const params = baseParams({ q: "alan" });
    const table = await exportContacts(db, ORG_ID, params);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]![0]).toBe("c2");
    expect(table.rows[0]![1]).toBe("Alan");
    expect(table.rows[0]![2]).toBe("Turing");
  });

  it("a filtered export with params still exercises the org scope: a q that matches nothing yields 0 rows, not all 3", async () => {
    const db = makeRealDb(CONTACTS);
    const params = baseParams({ q: "nonexistent-name-xyz" });
    const table = await exportContacts(db, ORG_ID, params);
    expect(table.rows).toHaveLength(0);
  });
});
