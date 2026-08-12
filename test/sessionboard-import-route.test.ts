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
  | { __marker: "inArray"; col: unknown; val: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, val: vals }),
    // submissionSeqSubquery / the track position subquery both build a raw
    // sql`...` fragment that is only ever WRITTEN into an insert's `values`
    // (never evaluated by this fake's evalCond), so the real tag can stay
    // unmocked here — this test only asserts created/updated/skipped
    // counts, never seq/position values.
    sql: actual.sql,
  };
});

// Imported after the mock so importRoutes -> repo/events.ts + repo/import/
// sessionboard.ts pick up the mocked eq/and/inArray.
const { importRoutes } = await import("../src/routes/api/import");
const { MAX_IMPORT_CSV_BYTES, MAX_IMPORT_ROWS } = await import("../src/routes/api/contacts/import");

type TableTag = "event" | "contact" | "submission" | "track";

const TABLES: Record<TableTag, unknown> = {
  event: schema.event,
  contact: schema.contact,
  submission: schema.submission,
  track: schema.track,
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

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const info = colInfo(m.col);
    if (!info) throw new Error("fake db: eq on unresolved column");
    return row[info.key] === m.val;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "inArray") {
    const info = colInfo(m.col);
    if (!info) throw new Error("fake db: inArray on unresolved column");
    return m.val.includes(row[info.key]);
  }
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
}

function makeFakeDb() {
  const rows: FakeRows = {
    event: [],
    contact: [],
    submission: [],
    track: [],
  };

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
                  const info = colInfo(col);
                  out[outKey] = info ? r[info.key] : undefined;
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
        values: async (vals: Record<string, unknown>) => {
          rows[tag]?.push({ ...vals });
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
