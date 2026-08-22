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
import { registerErrorHandler, ApiError } from "../src/server/http";
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
const repo = await import("../src/server/repo/contacts");

function colKeyIn(schemaObj: Record<string, unknown>, col: unknown): string {
  for (const [key, value] of Object.entries(schemaObj)) {
    if (value === col) return key;
  }
  throw new Error("fake db: condition referenced a column not on the queried table's schema");
}

function fieldValue(colOrExpr: unknown, row: Record<string, unknown>, schemaObj: Record<string, unknown>): unknown {
  const m = colOrExpr as Marker;
  if (m && typeof m === "object" && "__marker" in m && m.__marker === "lower") {
    return String(fieldValue(m.col, row, schemaObj)).toLowerCase();
  }
  return row[colKeyIn(schemaObj, colOrExpr)];
}

function evalCond(cond: unknown, row: Record<string, unknown>, schemaObj: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") return row[colKeyIn(schemaObj, m.col)] === m.val;
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row, schemaObj));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row, schemaObj));
  if (m.__marker === "inArray") return m.val.includes(fieldValue(m.col, row, schemaObj));
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

function project(row: Record<string, unknown>, fields: Record<string, unknown>, schemaObj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [outKey, col] of Object.entries(fields)) out[outKey] = row[colKeyIn(schemaObj, col)];
  return out;
}

// DEC-663 fill path (src/server/repo/contacts/import.ts:469): a merge FILL
// reads schema.user by lowered email to enforce DEC-456's login-identity
// conflict/cascade contract. The fake db models `user` as a SECOND table --
// its own row store and its own schema object -- seeded per test only where
// a case needs an account owner; every other test leaves it empty, matching
// "no schema.user row owns this address" (the common, unowned case).
// Tables this fake db does not model (schema.submission, schema.participant,
// ...) fall through to an empty, schema-less stub rather than throwing --
// mirrors the pre-existing lenient `.from()` behavior for a query whose
// result is never actually read (e.g. touchSubmissionsForContacts' inArray
// subquery, unread when its containing update() no-ops for an unmodeled
// target table). Actually evaluating a condition against the stub still
// fails loudly, via colKeyIn's own "column not found" throw.
const UNMODELED_TABLE = { schema: {} as Record<string, unknown>, rows: [] as Record<string, unknown>[] };

function tableFor(
  tables: { contact: { schema: Record<string, unknown>; rows: Record<string, unknown>[] }; user: { schema: Record<string, unknown>; rows: Record<string, unknown>[] } },
  table: unknown,
) {
  if (table === schema.contact) return tables.contact;
  if (table === schema.user) return tables.user;
  return UNMODELED_TABLE;
}

function makeFakeContactDb() {
  const tables = {
    contact: { schema: schema.contact as unknown as Record<string, unknown>, rows: [] as Record<string, unknown>[] },
    user: { schema: schema.user as unknown as Record<string, unknown>, rows: [] as Record<string, unknown>[] },
  };

  const db = {
    select(fields?: Record<string, unknown>) {
      let target = tables.contact;
      let whereCond: unknown = null;
      let limitN: number | null = null;
      let offsetN = 0;
      const run = () => {
        const schemaObj = target.schema;
        const filtered = whereCond ? target.rows.filter((r) => evalCond(whereCond, r, schemaObj)) : target.rows.slice();
        if (fields && Object.values(fields).some((v) => !Object.values(schemaObj).includes(v))) {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(fields)) out[key] = filtered.length;
          return [out];
        }
        const projected = fields ? filtered.map((r) => project(r, fields, schemaObj)) : filtered.map((r) => ({ ...r }));
        return limitN !== null ? projected.slice(offsetN, offsetN + limitN) : projected;
      };
      const chain: any = {
        from: (table: unknown) => {
          target = tableFor(tables, table);
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
    insert(table: unknown) {
      const target = tableFor(tables, table);
      return {
        values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(vals) ? vals : [vals];
          const insertAll = async () => {
            for (const v of list) target.rows.push({ ...v });
          };
          return {
            then: (resolve: (v: void) => void, reject?: (e: unknown) => void) =>
              insertAll().then(resolve, reject),
            onConflictDoUpdate: (opts: { set: Record<string, unknown> }) => ({
              then: (resolve: (v: void) => void, reject?: (e: unknown) => void) => {
                const upsertAll = async () => {
                  for (const v of list) {
                    const idx = target.rows.findIndex((r) => r.id === v.id);
                    if (idx < 0) continue;
                    const patch: Record<string, unknown> = {};
                    for (const key of Object.keys(opts.set)) patch[key] = v[key];
                    target.rows[idx] = { ...target.rows[idx], ...patch };
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
            // fake never models -- a no-op here, matching "no never-taken
            // attribution snapshot exists to repair" in a store with no
            // participant rows at all.
            if (table !== schema.contact && table !== schema.user) return;
            const target = tableFor(tables, table);
            target.rows = target.rows.map((r) => (evalCond(cond, r, target.schema) ? { ...r, ...vals } : r));
          },
        }),
      };
    },
  };

  return {
    db: db as unknown as AppEnv["Variables"]["db"],
    rows: () => tables.contact.rows,
    userRows: () => tables.user.rows,
  };
}

/** Seeds a schema.user row -- the DEC-456 login-identity owner a merge FILL's
 * pre-pass (import.ts:469) looks up by lowered email. Only used by tests that
 * need an account already owning an address. */
function seedUser(db: AppEnv["Variables"]["db"], overrides: Record<string, unknown>) {
  return (db as any)
    .insert(schema.user)
    .values({
      id: "seed-user-id",
      contactId: null,
      email: "seed-user@example.com",
      ...overrides,
    });
}
void seedUser;

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
  // DEC-663 (amendment, wave 115): wave 64's "the CSV row's email REPLACES
  // the target's stored email" is reversed — judge-filed, the imported row
  // silently overwrote a contact's org-wide address. A merge fills a blank
  // and never replaces a non-blank one; the offered address is REPORTED.
  it("patches the named target, KEEPS its stored email and reports the offered one, counts as updated, creates no new row", async () => {
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
    const body = (await res.json()) as {
      created: number;
      updated: number;
      skipped: unknown[];
      emailConflicts: { line: number; contactId: string; kept: string; offered: string }[];
    };
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(body.skipped).toEqual([]);
    expect(rows()).toHaveLength(1);
    const row = rows()[0] as Record<string, unknown>;
    expect(row.id).toBe("ct_1");
    // The stored, org-wide address survives the merge.
    expect(row.email).toBe("ada@work.example.com");
    // …and the one the file offered is named rather than silently dropped.
    expect(body.emailConflicts).toEqual([
      { line: 2, contactId: "ct_1", kept: "ada@work.example.com", offered: "ada.lovelace@newmail.example.com" },
    ]);
    // Untouched columns (bio wasn't in the CSV mapping) are preserved.
    expect(row.bio).toBe("Mathematician.");
  });

  it("FILLS a blank stored email from the merged row, and reports no conflict for it", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
      company: "Analytical Engines Inc",
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
    const body = (await res.json()) as { updated: number; emailConflicts?: unknown[] };
    expect(body.updated).toBe(1);
    // Nothing was overridden, so the response carries no conflicts field at
    // all -- present only when there ARE conflicts, like `addedToEvent`.
    expect(body.emailConflicts).toBeUndefined();
    const row = rows()[0] as Record<string, unknown>;
    expect(row.email).toBe("ada.lovelace@newmail.example.com");
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

// w10-ii: the still-open root of cut-2 item 1 -- "the copy and the behavior
// must agree." A merge line MUST preview as the update applyImportRows will
// actually commit, naming the same target and the same overwritten columns,
// not the "action: create" phantom the old planImportRows (which had no
// mergeLines parameter at all) reported.
describe("POST /api/v1/contacts/import dryRun=true mergeLines preview (w10-ii)", () => {
  // Company matches the seeded target on both rows below: findImportDuplicateCandidates
  // (the SAME function resolveMergeTargets validates the merge against) sub-groups a
  // name match by company, so a differing company would make the target a
  // non-candidate before the merge is even attempted. Title/bio -- not part
  // of duplicate matching -- carry the changed columns this test asserts on.
  const MERGE_CSV =
    "Email,First,Last,Company,Title,Bio\nada.lovelace@newmail.example.com,Ada,Lovelace,Old Engines Inc,Chief Engineer,New bio text.\n";
  const MERGE_MAPPING = {
    Email: "email",
    First: "firstName",
    Last: "lastName",
    Company: "company",
    Title: "title",
    Bio: "bio",
  };

  it("previews a merge onto a blank-email target as an update naming the real target and every changed column", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_blank_email",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
      company: "Old Engines Inc",
      title: "Junior Engineer",
      bio: "Old bio text.",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        csvText: MERGE_CSV,
        mapping: MERGE_MAPPING,
        dryRun: true,
        mergeLines: [{ line: 2, contactId: "ct_blank_email" }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { line: number; action: string; contactId?: string; overwrites?: { field: string; from: string; to: string }[] }[];
      created: number;
      updated: number;
      skipped: number;
    };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.action).toBe("update");
    expect(body.rows[0]?.contactId).toBe("ct_blank_email");
    expect(body.rows[0]?.overwrites).toEqual(
      expect.arrayContaining([
        { field: "title", from: "Junior Engineer", to: "Chief Engineer" },
        { field: "bio", from: "Old bio text.", to: "New bio text." },
      ]),
    );
    // email is never listed among overwrites -- a merge fills a blank, it
    // never replaces one (DEC-663 amendment, wave 115).
    expect(body.rows[0]?.overwrites?.some((o) => o.field === "email")).toBe(false);
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(body.skipped).toBe(0);
    // No write happened.
    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { company: string }).company).toBe("Old Engines Inc");
  });

  it("previews a merge onto a target with a differing stored email as an update naming the real target and every changed column", async () => {
    const { db, rows } = makeFakeContactDb();
    const app = appWithDbAndAuth(db, ORGANIZER);
    await seedContact(db, {
      id: "ct_diff_email",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@work.example.com",
      company: "Old Engines Inc",
      title: "Junior Engineer",
      bio: "Old bio text.",
    });

    const res = await app.request("/api/v1/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        csvText: MERGE_CSV,
        mapping: MERGE_MAPPING,
        dryRun: true,
        mergeLines: [{ line: 2, contactId: "ct_diff_email" }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { line: number; action: string; contactId?: string; overwrites?: { field: string; from: string; to: string }[] }[];
      created: number;
      updated: number;
      skipped: number;
    };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.action).toBe("update");
    expect(body.rows[0]?.contactId).toBe("ct_diff_email");
    expect(body.rows[0]?.overwrites).toEqual(
      expect.arrayContaining([
        { field: "title", from: "Junior Engineer", to: "Chief Engineer" },
        { field: "bio", from: "Old bio text.", to: "New bio text." },
      ]),
    );
    // The stored non-blank email is kept -- never listed as an overwrite,
    // matching applyImportRows' merge branch (the offered address is only
    // ever reported via emailConflicts on the real commit response).
    expect(body.rows[0]?.overwrites?.some((o) => o.field === "email")).toBe(false);
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(body.skipped).toBe(0);
    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { email: string }).email).toBe("ada@work.example.com");
  });

  // DEC-663's whole point: the plan the organizer approves and the run that
  // actually executes must agree. Drives repo.planImportRows and
  // repo.applyImportRows directly over the SAME rows+dispositions and
  // compares the created/updated/skipped counts, rather than trusting two
  // separately-asserted HTTP responses to have stayed in sync.
  it("planImportRows and applyImportRows agree on created/updated/skipped counts for the same rows+dispositions", async () => {
    const { db } = makeFakeContactDb();
    await seedContact(db, {
      id: "ct_merge_target",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
      company: "Old Engines Inc",
    });
    await seedContact(db, {
      id: "ct_plain_update",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
    });

    const rows = [
      { line: 2, parsed: { email: "ada.lovelace@newmail.example.com", firstName: "Ada", lastName: "Lovelace", company: "Old Engines Inc", title: "Chief Engineer" } },
      { line: 3, parsed: { email: "grace@example.com", firstName: "Grace", lastName: "Hopper Jr" } },
      { line: 4, parsed: { email: "brand.new@example.com", firstName: "Brand", lastName: "New" } },
      { line: 5, parsed: { email: "", firstName: "No", lastName: "Email" } },
    ];
    const opts = { skipLines: [5], mergeLines: [{ line: 2, contactId: "ct_merge_target" }] };

    const plan = await repo.planImportRows(db, "org-1", rows, opts);
    const result = await repo.applyImportRows(db, "org-1", rows, opts);

    expect(plan.created).toBe(result.created);
    expect(plan.updated).toBe(result.updated);
    expect(plan.skipped).toBe(result.skipped.length);
    // And the specific rows agree, not just the totals.
    expect(plan.created).toBe(1); // brand.new@example.com
    expect(plan.updated).toBe(2); // ct_merge_target (merge), ct_plain_update (email match)
    expect(plan.skipped).toBe(1); // line 5, skipped by organizer
  });

  // DEC-456 (wave-6 amendment): applyImportRows' fill branch refuses a merge
  // fill when a `schema.user` row already owns the offered address under a
  // DIFFERENT contact (import.ts:593-599) -- planImportRows must refuse the
  // exact same line at dry-run time, per the file's own comment at :936
  // ("a dry run must refuse what the real run refuses"). Before this fix,
  // planImportRows never queried schema.user at all, so an organizer's
  // approved dry-run preview ("N updated") could be rejected wholesale when
  // they clicked commit.
  it("planImportRows refuses a merge fill whose offered email already belongs to another account's login (dry run must refuse what the real run refuses)", async () => {
    const { db } = makeFakeContactDb();
    await seedContact(db, {
      id: "ct_merge_target",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
    });
    await seedUser(db, {
      id: "user-other",
      contactId: "ct_someone_else",
      email: "ada.lovelace@newmail.example.com",
    });

    const rows = [{ line: 2, parsed: { email: "ada.lovelace@newmail.example.com", firstName: "Ada", lastName: "Lovelace" } }];
    const opts = { mergeLines: [{ line: 2, contactId: "ct_merge_target" }] };

    let caughtPlan: unknown;
    try {
      await repo.planImportRows(db, "org-1", rows, opts);
    } catch (e) {
      caughtPlan = e;
    }
    let caughtApply: unknown;
    try {
      await repo.applyImportRows(db, "org-1", rows, opts);
    } catch (e) {
      caughtApply = e;
    }

    expect(caughtApply).toBeInstanceOf(ApiError);
    expect(caughtPlan).toBeInstanceOf(ApiError);
    const planErr = caughtPlan as InstanceType<typeof ApiError>;
    const applyErr = caughtApply as InstanceType<typeof ApiError>;
    expect(planErr.message).toBe(applyErr.message);
    expect(planErr.fields).toEqual(applyErr.fields);
    expect(planErr.message).toBe("Line 2: this email already belongs to another account");
  });
});

// w11-dd: a merge line minted a SECOND contact carrying an org-scoped email
// an earlier line in the SAME file just created. resolveMergeTargets' email
// collision guard only ever sees the DB pre-pass byEmail, taken once before
// the apply/plan loop runs -- it cannot catch a collision minted mid-file.
// The fill branch now re-checks byEmail as it stands at fill time.
describe("mergeLines vs. a same-file create of the same email (w11-dd)", () => {
  const rowsFor = () => [
    { line: 2, parsed: { email: "ada@newmail.example.com", firstName: "Ada", lastName: "Lovelace" } },
    { line: 3, parsed: { email: "ada@newmail.example.com", firstName: "Ada", lastName: "Lovelace" } },
  ];

  it("applyImportRows refuses a merge fill when an earlier line in the file already created that email, and mints no second contact", async () => {
    const { db, rows } = makeFakeContactDb();
    await seedContact(db, {
      id: "ct_blank",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
    });

    const rowsIn = rowsFor();
    const opts = { mergeLines: [{ line: 3, contactId: "ct_blank" }] };

    let caught: unknown;
    try {
      await repo.applyImportRows(db, "org-1", rowsIn, opts);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as InstanceType<typeof ApiError>;
    expect(err.code).toBe("invalid");
    expect(err.message).toBe(
      "Line 3 already matches an existing contact by email; it resolves to an update, not a merge",
    );
    expect(err.fields).toEqual({ mergeLines: "line 3: resolves to an update" });

    // No write happened at all -- the throw fires before any commit flush,
    // so the earlier line's would-be create never lands either.
    expect(rows()).toHaveLength(1);
  });

  it("planImportRows refuses the same dry-run mid-file collision (dry run refuses what the real run refuses)", async () => {
    const { db } = makeFakeContactDb();
    await seedContact(db, {
      id: "ct_blank",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
    });

    const rowsIn = rowsFor();
    const opts = { mergeLines: [{ line: 3, contactId: "ct_blank" }] };

    let caught: unknown;
    try {
      await repo.planImportRows(db, "org-1", rowsIn, opts);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as InstanceType<typeof ApiError>;
    expect(err.code).toBe("invalid");
    expect(err.fields).toEqual({ mergeLines: "line 3: resolves to an update" });
  });

  it("reverse order: a merge fill first, then a same-email create line, still resolves to a single update (already worked, locked here)", async () => {
    const { db, rows } = makeFakeContactDb();
    await seedContact(db, {
      id: "ct_blank",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
    });

    const rowsIn = [
      { line: 2, parsed: { email: "ada@newmail.example.com", firstName: "Ada", lastName: "Lovelace" } },
      { line: 3, parsed: { email: "ada@newmail.example.com", firstName: "Ada", lastName: "Lovelace" } },
    ];
    const opts = { mergeLines: [{ line: 2, contactId: "ct_blank" }] };

    // NOTE: this reverse-order parity check is applyImportRows-only.
    // planImportRows' merge branch (line ~811-834) never re-sets its byEmail
    // map after resolving a merge line -- only the plain create/update branch
    // does (~789/~810/~867/~888) -- so a plan-only run of these same rows
    // would plan line 3 as a SECOND create instead of an update, unlike the
    // real run below. That parity gap predates this task (it is not the
    // mid-file collision this task's fix addresses) and is out of scope
    // here; flagged for the merge train rather than silently patched.
    const result = await repo.applyImportRows(db, "org-1", rowsIn, opts);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);
    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { id: string; email: string }).id).toBe("ct_blank");
    expect((rows()[0] as { email: string }).email).toBe("ada@newmail.example.com");
  });
});
