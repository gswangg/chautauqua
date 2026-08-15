// DEC-612 (wave-54 amendment): the sessionboard importer's contacts entity
// must resolve identity by normalized email BEFORE it is allowed to create
// -- a Sessionboard roster import must chain onto a ref-less contact the
// CFP form already created rather than duplicating it. Uses the same
// structural drizzle-orm mock as test/sessionboard-import-route.test.ts (no
// D1 test harness exists in this repo) so this exercises the real
// applySessionboardPlans write path, including the batched loadContactsByEmail
// pre-pass it now shares with the participants path.

import { describe, expect, it, vi } from "vitest";
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

const { applySessionboardPlans } = await import("../src/server/repo/import/sessionboard");
const { externalRef, SESSIONBOARD_SOURCE } = await import("../src/domain/sessionboard");
import type { Db } from "../src/server/context";

type TableTag = "contact";
const TABLES: Record<TableTag, unknown> = { contact: schema.contact };

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
  if (!info) throw new Error("fake db: condition/select referenced an unresolved column");
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
  contact: Record<string, unknown>[];
}

function makeFakeDb() {
  const rows: FakeRows = { contact: [] };

  const db = {
    select(fields?: Record<string, unknown>) {
      let table: unknown = null;
      let whereCond: unknown = null;
      const chain: any = {
        from: (t: unknown) => {
          table = t;
          return chain;
        },
        where: (cond: unknown) => {
          whereCond = cond;
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
          resolve(projected);
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

  return { db: db as unknown as Db, rows };
}

function seedContact(
  rows: FakeRows,
  params: {
    id: string;
    orgId: string;
    externalRef: string | null;
    email: string;
    firstName?: string;
    lastName?: string;
    title?: string | null;
    company?: string | null;
  },
) {
  const now = new Date();
  rows.contact.push({
    id: params.id,
    orgId: params.orgId,
    // The rename-detection touch path (findRenamedContactIds ->
    // touchSubmissionsForContacts) is out of this test's scope, so every
    // seed here matches the file row's firstName/lastName -- a same-string
    // re-import that must not touch, exactly as an idempotent apply
    // expects, and avoids needing a submission/participant table in this
    // contacts-only fake.
    firstName: params.firstName ?? "First",
    lastName: params.lastName ?? "Last",
    email: params.email,
    phone: null,
    company: params.company ?? null,
    title: params.title ?? null,
    bio: null,
    externalRef: params.externalRef,
    createdAt: now,
    updatedAt: now,
  });
}

const ORG_ID = "org-1";
const EVENT_ID = "event-1";

describe("DEC-612 (wave-54 amendment): sessionboard contacts import resolves identity by email before create", () => {
  it("a file row whose email matches a ref-less CFP-created contact updates it and adopts the ref; re-running is idempotent", async () => {
    const { db, rows } = makeFakeDb();
    seedContact(rows, { id: "cfp-1", orgId: ORG_ID, externalRef: null, email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" });

    const plans = [
      {
        row: 2,
        externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-1"),
        values: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Acme" },
      },
    ];

    const first = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });

    expect(first).toMatchObject({ created: 0, updated: 1, skipped: [] });
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]?.id).toBe("cfp-1");
    expect(rows.contact[0]?.externalRef).toBe(externalRef(SESSIONBOARD_SOURCE, "sb-1"));
    expect(rows.contact[0]?.firstName).toBe("Ada");
    expect(rows.contact[0]?.company).toBe("Acme");

    // Re-running the same file: the ref now resolves directly via refMap --
    // still an update, still exactly one contact row.
    const second = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });
    expect(second).toMatchObject({ created: 0, updated: 1, skipped: [] });
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]?.externalRef).toBe(externalRef(SESSIONBOARD_SOURCE, "sb-1"));
  });

  it("a row matching a contact that already carries a different ref updates it without changing its ref", async () => {
    const { db, rows } = makeFakeDb();
    seedContact(rows, {
      id: "cfp-2",
      orgId: ORG_ID,
      externalRef: "sessionboard:other-source-ref",
      email: "grace@example.com",
      firstName: "Grace",
      lastName: "Hopper",
    });

    const plans = [
      {
        row: 2,
        externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-9"),
        values: { firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
      },
    ];

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });

    expect(result).toMatchObject({ created: 0, updated: 1, skipped: [] });
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]?.id).toBe("cfp-2");
    // The ref is untouched -- still the pre-existing, DIFFERENT ref.
    expect(rows.contact[0]?.externalRef).toBe("sessionboard:other-source-ref");
    expect(rows.contact[0]?.firstName).toBe("Grace");
  });

  it("two file rows sharing one email produce one contact", async () => {
    const { db, rows } = makeFakeDb();

    const plans = [
      {
        row: 2,
        externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-a"),
        values: { firstName: "Alan", lastName: "Turing", email: "alan@example.com" },
      },
      {
        row: 3,
        externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-b"),
        values: { firstName: "Alan", lastName: "Turing", email: "alan@example.com", company: "Bletchley" },
      },
    ];

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });

    // First row creates (no ref, no existing email match); the second row's
    // email now resolves via refMap because the first row's ref-map entry
    // is live -- but the SECOND row carries a DIFFERENT external_ref, so it
    // is a fresh create candidate whose email now matches the contact the
    // first row just created (ref no longer null) -- an update, not a
    // second create.
    expect(result).toMatchObject({ created: 1, updated: 1, skipped: [] });
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]?.company).toBe("Bletchley");
    // The first row's ref is preserved -- the second row's ref was never
    // adopted since the contact already carried one.
    expect(rows.contact[0]?.externalRef).toBe(externalRef(SESSIONBOARD_SOURCE, "sb-a"));
  });

  it("dry run's created/updated split equals apply's", async () => {
    const { db, rows } = makeFakeDb();
    seedContact(rows, {
      id: "cfp-3",
      orgId: ORG_ID,
      externalRef: null,
      email: "linus@example.com",
      firstName: "Linus",
      lastName: "Torvalds",
    });

    const plans = [
      {
        row: 2,
        externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-linus"),
        values: { firstName: "Linus", lastName: "Torvalds", email: "linus@example.com" },
      },
      {
        row: 3,
        externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-new-person"),
        values: { firstName: "New", lastName: "Person", email: "new-person@example.com" },
      },
    ];

    const dryRun = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: true,
      plans: plans as any,
    });
    expect(dryRun).toMatchObject({ created: 1, updated: 1, skipped: [] });
    // No writes at all under dry run.
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]?.externalRef).toBeNull();

    const apply = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });
    expect(apply).toMatchObject({ created: dryRun.created, updated: dryRun.updated, skipped: [] });
    expect(rows.contact).toHaveLength(2);
  });
});
