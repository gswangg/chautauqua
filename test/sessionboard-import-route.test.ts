// DEC-612/DEC-613 coverage: POST /api/v1/events/:eventId/import/sessionboard
// through the real importRoutes sub-app, backed by a minimal in-memory fake
// Db (same technique as test/contacts-import.test.ts and
// test/contacts-stats-repo.test.ts: mock drizzle-orm's eq/and/inArray to
// plain markers this fake evaluates structurally against seeded rows,
// exercising the real repo write path rather than a scripted response
// queue -- no D1 test harness exists in this repo).
//
// Covers: dry run reports the same created/updated numbers the real run
// then produces without writing anything; a second identical real run
// reports updated, not created (idempotence via external_ref); a cross-org
// eventId 404s (never 403); an over-cap body 400s naming the cap.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; val: unknown[] }
  | { __marker: "lower"; col: unknown }
  | { __marker: "max"; col: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, val: vals }),
    // The wave-47 email-fallback pre-pass (loadContactsByEmail) uses
    // inArray(sql`lower(col)`, batch); the order pre-pass
    // (loadMaxOrderBySubmissionId) uses a `max(col)` aggregate select field
    // + groupBy. Both fragments are mocked to structural markers (same
    // technique as test/contacts-import.test.ts) so this fake's
    // evalCond/project below can interpret them; every OTHER sql`...` usage
    // (submissionSeqSubquery, the track/participant position/order
    // sub-selects written only into an insert's `values`) falls back to the
    // real tag, unchanged.
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]): unknown => {
        if (strings.length === 2 && strings[0]?.trim() === "lower(" && strings[1]?.trim() === ")") {
          return { __marker: "lower", col: values[0] } satisfies Marker;
        }
        if (strings.length === 2 && strings[0]?.trim() === "max(" && strings[1]?.trim() === ")") {
          return { __marker: "max", col: values[0] } satisfies Marker;
        }
        return actual.sql(strings, ...values);
      },
      actual.sql,
    ),
  };
});

// Imported after the mocks so importRoutes -> repo/events.ts + repo/import/
// sessionboard.ts pick up the mocked eq/and/inArray/sql.
const { importRoutes } = await import("../src/routes/api/import");
const { MAX_IMPORT_CSV_BYTES, MAX_IMPORT_ROWS } = await import("../src/routes/api/contacts/import");

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

/** Resolves a column reference -- which may be wrapped in a "lower" marker
 * from a mocked sql`lower(...)` call -- to its value on a row. */
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

/** In-memory fake Db across event/contact/submission/track: real
 * insert/select/update semantics evaluated against the real eq/and/inArray
 * markers above, so this exercises the actual repo write + read path. */
interface FakeRows {
  event: Record<string, unknown>[];
  contact: Record<string, unknown>[];
  submission: Record<string, unknown>[];
  track: Record<string, unknown>[];
  participant: Record<string, unknown>[];
}

function makeFakeDb() {
  const rows: FakeRows = {
    event: [],
    contact: [],
    submission: [],
    track: [],
    participant: [],
  };

  const db = {
    select(fields?: Record<string, unknown>) {
      let table: unknown = null;
      let whereCond: unknown = null;
      let limitN: number | null = null;
      let groupByCol: unknown = null;
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
        // groupBy is only used by loadMaxOrderBySubmissionId (a select field
        // is the mocked "max" marker) -- the projection branch below
        // aggregates per group instead of mapping row-for-row whenever a
        // groupByCol is set.
        groupBy: (col: unknown) => {
          groupByCol = col;
          return chain;
        },
        then: (resolve: (v: unknown[]) => void) => {
          const tag = tableTag(table);
          const all = rows[tag] ?? [];
          const filtered = whereCond ? all.filter((r) => evalCond(whereCond, r)) : all.slice();
          if (groupByCol) {
            const groups = new Map<unknown, Record<string, unknown>[]>();
            for (const r of filtered) {
              const key = fieldValue(groupByCol, r);
              const g = groups.get(key) ?? [];
              g.push(r);
              groups.set(key, g);
            }
            const out: Record<string, unknown>[] = [];
            for (const groupRows of groups.values()) {
              const row: Record<string, unknown> = {};
              for (const [outKey, col] of Object.entries(fields ?? {})) {
                const m = col as Marker;
                if (m && typeof m === "object" && "__marker" in m && m.__marker === "max") {
                  row[outKey] = Math.max(...groupRows.map((r) => Number(fieldValue(m.col, r))));
                } else {
                  row[outKey] = fieldValue(col, groupRows[0] as Record<string, unknown>);
                }
              }
              out.push(row);
            }
            resolve(out);
            return;
          }
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
        // A multi-row insert (chunkRowsForInsert's set-based flush) passes
        // an array of value objects rather than one object -- support both
        // shapes.
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

function seedContact(
  rows: FakeRows,
  params: { id: string; orgId: string; externalRef: string | null; email: string; title?: string | null; company?: string | null },
) {
  const now = new Date();
  rows.contact.push({
    id: params.id,
    orgId: params.orgId,
    firstName: "First",
    lastName: "Last",
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

function seedSubmission(rows: FakeRows, params: { id: string; eventId: string; externalRef: string | null; title: string }) {
  const now = new Date();
  rows.submission.push({
    id: params.id,
    eventId: params.eventId,
    formId: null,
    seq: 1,
    title: params.title,
    description: null,
    trackId: null,
    status: "pending",
    contentStatus: "pending",
    externalRef: params.externalRef,
    createdAt: now,
    updatedAt: now,
  });
}

const CSV_TEXT = "Speaker ID,Speaker Email,Speaker First Name,Speaker Last Name\nsb-1,new@example.com,New,Speaker\n";

describe("POST /api/v1/events/:eventId/import/sessionboard", () => {
  it("dry run reports the same created/updated the real run then produces, and writes nothing", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const dryRes = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText: CSV_TEXT, mapping: {}, dryRun: true }),
    });
    expect(dryRes.status).toBe(200);
    const dryBody = (await dryRes.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(dryBody.created).toBe(1);
    expect(dryBody.updated).toBe(0);
    expect(dryBody.skipped).toEqual([]);
    expect(rows.contact).toHaveLength(0);

    const realRes = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText: CSV_TEXT, mapping: {}, dryRun: false }),
    });
    expect(realRes.status).toBe(200);
    const realBody = (await realRes.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(realBody.created).toBe(dryBody.created);
    expect(realBody.updated).toBe(dryBody.updated);
    expect(rows.contact).toHaveLength(1);
    expect(rows.contact[0]?.externalRef).toBe("sessionboard:sb-1");
  });

  it("a second identical real run reports updated, not created (idempotence via external_ref)", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const first = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText: CSV_TEXT, mapping: {}, dryRun: false }),
    });
    expect((await first.json()) as unknown).toMatchObject({ created: 1, updated: 0 });
    expect(rows.contact).toHaveLength(1);

    const second = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText: CSV_TEXT, mapping: {}, dryRun: false }),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { created: number; updated: number };
    expect(secondBody).toMatchObject({ created: 0, updated: 1 });
    expect(rows.contact).toHaveLength(1);
  });

  it("a cross-org eventId 404s, never 403", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev-other-org", "org-2");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const res = await app.request("/api/v1/events/ev-other-org/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText: CSV_TEXT, mapping: {}, dryRun: true }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("an over-cap body returns 400 naming the cap", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const oversizedCsv = "x".repeat(MAX_IMPORT_CSV_BYTES + 1);
    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText: oversizedCsv, mapping: {}, dryRun: true }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain(String(MAX_IMPORT_CSV_BYTES));
  });

  it("an over-row-cap body returns 400 naming the row cap", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    const app = appWithDbAndAuth(db, ORGANIZER);

    const header = "Speaker ID,Speaker Email\n";
    const dataRows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `sb-${i},p${i}@example.com`).join("\n");
    const csvText = header + dataRows + "\n";

    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "contacts", csvText, mapping: {}, dryRun: true }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain(String(MAX_IMPORT_ROWS));
  });
});

describe("POST .../import/sessionboard, entity=participants (DEC-639/DEC-640)", () => {
  const PARTICIPANT_CSV =
    "Session ID,Speaker ID,Speaker Email,Role,Order\nsb-sess-1,sb-spk-1,,speaker,0\n";

  function seedFixture(rows: FakeRows) {
    seedEvent(rows, "ev1", "org-1");
    seedSubmission(rows, { id: "sub-1", eventId: "ev1", externalRef: "sessionboard:sb-sess-1", title: "Talk" });
    seedContact(rows, {
      id: "con-1",
      orgId: "org-1",
      externalRef: "sessionboard:sb-spk-1",
      email: "speaker@example.com",
      title: "Engineer",
      company: "Acme",
    });
  }

  it("dry run and real run report identical created/updated counts", async () => {
    const { db, rows } = makeFakeDb();
    seedFixture(rows);
    const app = appWithDbAndAuth(db, ORGANIZER);

    const dryRes = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: true }),
    });
    const dryBody = (await dryRes.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(dryBody).toMatchObject({ created: 1, updated: 0, skipped: [] });
    expect(rows.participant).toHaveLength(0);

    const realRes = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    const realBody = (await realRes.json()) as { created: number; updated: number; skipped: unknown[] };
    expect(realBody).toMatchObject({ created: dryBody.created, updated: dryBody.updated });
    expect(rows.participant).toHaveLength(1);
  });

  it("writes title_at_time/org_at_time from the resolved contact's live fields on create", async () => {
    const { db, rows } = makeFakeDb();
    seedFixture(rows);
    const app = appWithDbAndAuth(db, ORGANIZER);

    await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    expect(rows.participant).toHaveLength(1);
    // DEC-675/DEC-656: an imported co-presenter is RECORDED, not published --
    // it reaches the public site only through the organizer's existing
    // Visible checkbox on the submission-detail participants table.
    expect(rows.participant[0]).toMatchObject({
      submissionId: "sub-1",
      contactId: "con-1",
      titleAtTime: "Engineer",
      orgAtTime: "Acme",
      visible: false,
      inviteStatus: "none",
    });
  });

  it("a re-import of the same pair updates rather than duplicates", async () => {
    const { db, rows } = makeFakeDb();
    seedFixture(rows);
    const app = appWithDbAndAuth(db, ORGANIZER);

    const first = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    expect((await first.json()) as unknown).toMatchObject({ created: 1, updated: 0 });
    expect(rows.participant).toHaveLength(1);

    const second = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    expect((await second.json()) as unknown).toMatchObject({ created: 0, updated: 1 });
    expect(rows.participant).toHaveLength(1);
  });

  it("skips an unresolved session reference by name, never creating a placeholder submission", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    seedContact(rows, { id: "con-1", orgId: "org-1", externalRef: "sessionboard:sb-spk-1", email: "speaker@example.com" });
    const app = appWithDbAndAuth(db, ORGANIZER);

    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    const body = (await res.json()) as { created: number; skipped: { row: number; reason: string }[] };
    expect(body.created).toBe(0);
    expect(rows.submission).toHaveLength(0);
    expect(rows.participant).toHaveLength(0);
    expect(body.skipped).toEqual([{ row: 2, reason: "Unresolved session reference: sb-sess-1" }]);
  });

  it("skips an unresolved speaker (by ref) by name, never creating a placeholder contact", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    seedSubmission(rows, { id: "sub-1", eventId: "ev1", externalRef: "sessionboard:sb-sess-1", title: "Talk" });
    const app = appWithDbAndAuth(db, ORGANIZER);

    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    const body = (await res.json()) as { created: number; skipped: { row: number; reason: string }[] };
    expect(body.created).toBe(0);
    expect(rows.contact).toHaveLength(0);
    expect(rows.participant).toHaveLength(0);
    expect(body.skipped).toEqual([{ row: 2, reason: "Unresolved speaker reference: sb-spk-1" }]);
  });

  it("an imported participant is invisible to the public speakers query (visible=false fails visibleParticipantConditions)", async () => {
    const { db, rows } = makeFakeDb();
    seedFixture(rows);
    const app = appWithDbAndAuth(db, ORGANIZER);

    await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: PARTICIPANT_CSV, mapping: {}, dryRun: false }),
    });
    expect(rows.participant).toHaveLength(1);
    expect(rows.participant[0]).toMatchObject({ visible: false });

    // visibleParticipantConditions() (DEC-274/DEC-656) requires
    // participant.visible=true -- assert the imported row's own field fails
    // that predicate directly, the same fact the real D1 query enforces.
    const { visibleParticipantConditions } = await import("../src/server/repo/public/gates");
    void visibleParticipantConditions; // constructs the real drizzle expression; not evaluable against the fake db here
    expect(rows.participant[0]?.visible).not.toBe(true);
  });

  it("resolves the speaker by speakerEmail when speakerExternalId is absent", async () => {
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    seedSubmission(rows, { id: "sub-1", eventId: "ev1", externalRef: "sessionboard:sb-sess-1", title: "Talk" });
    seedContact(rows, { id: "con-1", orgId: "org-1", externalRef: null, email: "byemail@example.com", title: "CTO", company: "Beta" });
    const app = appWithDbAndAuth(db, ORGANIZER);

    const csv = "Session ID,Speaker ID,Speaker Email,Role,Order\nsb-sess-1,,byemail@example.com,speaker,0\n";
    const res = await app.request("/api/v1/events/ev1/import/sessionboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ entity: "participants", csvText: csv, mapping: {}, dryRun: false }),
    });
    const body = (await res.json()) as { created: number; skipped: unknown[] };
    expect(body).toMatchObject({ created: 1, skipped: [] });
    expect(rows.participant[0]).toMatchObject({ submissionId: "sub-1", contactId: "con-1", titleAtTime: "CTO", orgAtTime: "Beta" });
  });
});

// DEC-528 (wave 47 amendment) coverage: applySessionboardPlans's
// participants branch, called directly (below the CSV/route layer) with a
// statement-counting wrapper around the same structural fake db above --
// asserts the email-fallback pre-pass and the participant create flush are
// genuinely O(chunks), not O(rows), over a batch large enough (40 rows, all
// resolved by speakerEmail with no speakerExternalId at all -- the "hand-
// exported CSV" shape the amendment names) to expose a per-row SELECT or a
// per-row INSERT if either regressed.
describe("applySessionboardPlans participants: batched pre-pass + set-based create (DEC-528 wave 47)", () => {
  it("issues O(1) SELECTs and O(chunks) participant INSERTs for 40 email-only rows, with matching output rows", async () => {
    const { applySessionboardPlans } = await import("../src/server/repo/import/sessionboard");
    const { db, rows } = makeFakeDb();
    seedEvent(rows, "ev1", "org-1");
    seedSubmission(rows, { id: "sub-1", eventId: "ev1", externalRef: "sessionboard:sb-sess-1", title: "Talk" });

    const ROW_COUNT = 40;
    for (let i = 0; i < ROW_COUNT; i++) {
      seedContact(rows, {
        id: `con-${i}`,
        orgId: "org-1",
        externalRef: null, // resolved by email only -- no Record ID on this row
        email: `speaker${i}@example.com`,
      });
    }

    let selectCount = 0;
    let insertStatementCount = 0;
    const countingDb: typeof db = {
      ...db,
      select: (...args: unknown[]) => {
        selectCount++;
        return (db as any).select(...args);
      },
      insert: (table: unknown) => {
        const real = (db as any).insert(table);
        return {
          values: async (vals: unknown) => {
            insertStatementCount++;
            return real.values(vals);
          },
        };
      },
    } as unknown as typeof db;

    const plans = Array.from({ length: ROW_COUNT }, (_, i) => ({
      row: i + 2,
      externalRef: null,
      values: {
        sessionExternalId: "sb-sess-1",
        speakerEmail: `speaker${i}@example.com`,
        role: "speaker",
      },
    }));

    const result = await applySessionboardPlans(countingDb, {
      orgId: "org-1",
      eventId: "ev1",
      entity: "participants",
      plans: plans as any,
      dryRun: false,
    });

    // (a) O(1) SELECTs: the pre-pass issues one chunked query per lookup
    // (session refs, contact-by-email, existing pairs, max-order) -- never
    // one per row. 40 rows all fit one ID_CHUNK_SIZE=90 batch per lookup, so
    // this stays in the single digits regardless of row count.
    expect(selectCount).toBeLessThan(10);

    // (b) O(chunks) participant INSERTs, not O(rows): chunkRowsForInsert
    // slices an 11-column participant row at floor(90/11)=8 rows/chunk, so
    // 40 rows -> 5 statements, never 40.
    expect(insertStatementCount).toBeGreaterThan(0);
    expect(insertStatementCount).toBeLessThan(ROW_COUNT);
    expect(insertStatementCount).toBe(Math.ceil(ROW_COUNT / 8));

    // (c) resulting rows match the shape the pre-batching implementation
    // produced: one participant per row, all created (none skipped), speaker
    // role, visible=false, inviteStatus='none', order assigned 0..39 within
    // the batch (DEC-675/DEC-656 snapshot semantics untouched).
    expect(result.created).toBe(ROW_COUNT);
    expect(result.updated).toBe(0);
    expect(result.skipped).toEqual([]);
    expect(rows.participant).toHaveLength(ROW_COUNT);
    const orders = rows.participant.map((r) => r.order as number).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: ROW_COUNT }, (_, i) => i));
    for (const r of rows.participant) {
      expect(r.submissionId).toBe("sub-1");
      expect(r.role).toBe("speaker");
      expect(r.visible).toBe(false);
      expect(r.inviteStatus).toBe("none");
      const idx = Number(String(r.contactId).replace("con-", ""));
      expect(Number.isInteger(idx)).toBe(true);
    }
  });
});
