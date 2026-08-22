// DEC-509 (wave-23 amendment): an unresolvable segmentId request parameter
// is a refusal in the house envelope, never a 500. scanAndFilterContacts
// (src/server/repo/contacts/crud.ts) used to throw a bare Error when
// findSegmentForOrg missed, escaping both live doors — GET /api/v1/contacts
// and GET /api/v1/events/:id/export/contacts — as an uncaught 500 `internal`
// instead of the house 400/404 envelope. Also covers the cross-org case (a
// segmentId that belongs to a DIFFERENT org): the response must be
// byte-identical in shape to the nonexistent-id case, proving there is no
// existence oracle leaking across orgs.
//
// Runs the real contactsRoutes/exportsRoutes sub-apps against a real
// (in-memory) SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy
// driver — same technique as test/contacts-delete.test.ts — with a session
// seeded directly onto the Hono context (c.set("auth", ...)) rather than a
// login round trip, matching that file's harness.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { contactsRoutes } from "../src/routes/api/contacts";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  title text,
  bio text,
  headshot_url text,
  headshot_file_id text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table segment (
  id text primary key,
  org_id text,
  name text,
  rules_json text,
  created_at integer,
  updated_at integer
);
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  timezone text,
  record_prefix text,
  created_at integer,
  updated_at integer
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

const NOW = 1_700_000_000_000;
const ORG_A = "org-a";
const ORG_B = "org-b";

function appWithDbAndAuth(db: Db, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  app.route("/", exportsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function insertContact(sqlite: DatabaseSync, id: string, orgId: string, firstName: string, lastName: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, orgId, firstName, lastName, `${firstName.toLowerCase()}@example.com`, NOW, NOW);
}

function insertSegment(sqlite: DatabaseSync, id: string, orgId: string, name: string, rules: unknown[]) {
  sqlite
    .prepare(`insert into segment (id, org_id, name, rules_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`)
    .run(id, orgId, name, JSON.stringify(rules), NOW, NOW);
}

function insertEvent(sqlite: DatabaseSync, id: string, orgId: string) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, 'DevFlow Conf 2027', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
    )
    .run(id, orgId, NOW, NOW);
}

type Envelope = { error: { code: string; message: string; fields?: Record<string, string> } };

describe("DEC-509 (wave-23 amendment): an unresolvable segmentId is a refusal, not a crash", () => {
  it("(1) GET /api/v1/contacts?segmentId=<nonexistent> returns the house 404 envelope, never a 500", async () => {
    const { db } = makeTestDb();
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request("/api/v1/contacts?segmentId=nonexistent-segment");

    expect(res.status).toBe(404);
    const body = (await res.json()) as Envelope;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toContain("nonexistent-segment");
    // The org id must never be echoed back into a user-visible error string.
    expect(body.error.message).not.toContain(ORG_A);
  });

  it("(2) the same segmentId seeded under a DIFFERENT org produces an IDENTICAL response shape (no cross-org existence oracle)", async () => {
    const { db, sqlite } = makeTestDb();
    insertSegment(sqlite, "seg-from-b", ORG_B, "Org B's segment", []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const [missingRes, crossOrgRes] = await Promise.all([
      app.request("/api/v1/contacts?segmentId=nonexistent-segment"),
      app.request("/api/v1/contacts?segmentId=seg-from-b"),
    ]);

    expect(crossOrgRes.status).toBe(missingRes.status);
    expect(crossOrgRes.status).toBe(404);
    const missingBody = (await missingRes.json()) as Envelope;
    const crossOrgBody = (await crossOrgRes.json()) as Envelope;
    expect(crossOrgBody.error.code).toBe(missingBody.error.code);
    expect(crossOrgBody.error.message).toContain("seg-from-b");
    expect(crossOrgBody.error.message).not.toContain(ORG_A);
    expect(crossOrgBody.error.message).not.toContain(ORG_B);
  });

  it("(3) the export door GET /api/v1/events/:id/export/contacts?segmentId=... refuses the same way for both a nonexistent and a cross-org segmentId", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite, "event-1", ORG_A);
    insertSegment(sqlite, "seg-from-b", ORG_B, "Org B's segment", []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const missingRes = await app.request("/api/v1/events/event-1/export/contacts?segmentId=nonexistent-segment&format=csv");
    expect(missingRes.status).toBe(404);
    const missingBody = (await missingRes.json()) as Envelope;
    expect(missingBody.error.code).toBe("not_found");
    expect(missingBody.error.message).toContain("nonexistent-segment");

    const crossOrgRes = await app.request("/api/v1/events/event-1/export/contacts?segmentId=seg-from-b&format=csv");
    expect(crossOrgRes.status).toBe(404);
    const crossOrgBody = (await crossOrgRes.json()) as Envelope;
    expect(crossOrgBody.error.code).toBe("not_found");
    expect(crossOrgBody.error.message).toContain("seg-from-b");
  });

  it("(4) negative control: a valid segmentId still filters and returns matching rows (no over-broad refusal)", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "ct-1", ORG_A, "Ada", "Lovelace");
    insertContact(sqlite, "ct-2", ORG_A, "Grace", "Hopper");
    insertSegment(sqlite, "seg-ada", ORG_A, "Ada only", [{ field: "lastName", op: "eq", value: "Lovelace" }]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request("/api/v1/contacts?segmentId=seg-ada");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; firstName: string; lastName: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.id).toBe("ct-1");
    expect(body.items[0]!.lastName).toBe("Lovelace");
  });

  it("(4b) negative control on the export door: a valid segmentId exports the matching rows", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite, "event-1", ORG_A);
    insertContact(sqlite, "ct-1", ORG_A, "Ada", "Lovelace");
    insertContact(sqlite, "ct-2", ORG_A, "Grace", "Hopper");
    insertSegment(sqlite, "seg-ada", ORG_A, "Ada only", [{ field: "lastName", op: "eq", value: "Lovelace" }]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request("/api/v1/events/event-1/export/contacts?segmentId=seg-ada&format=json");

    expect(res.status).toBe(200);
    const records = (await res.json()) as Record<string, string>[];
    expect(records).toHaveLength(1);
    expect(records[0]!.id).toBe("ct-1");
  });
});
