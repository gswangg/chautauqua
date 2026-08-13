// DEC-758/DEC-956/DEC-979: DELETE /api/v1/contacts/:id refuses honestly
// when a *document* still depends on the contact (a submission participant,
// or a linked user account) — naming the actual rows in prose plus a
// per-kind `fields` entry — and otherwise deletes cleanly. Per DEC-979, a
// task_assignment and a pipeline_entry (+ its pipeline_activity feed) are
// JOIN rows, not documents: they cascade-delete with the contact instead of
// blocking the delete. Runs the real contactsRoutes sub-app against a real
// (in-memory) SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy
// driver (same technique as test/contacts-history-event-id.test.ts), so the
// real innerJoin-based listContactReferenceRows read and the cascade delete
// are both exercised, not hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import { newId } from "../src/domain/ids";
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
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
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
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
  content_status text,
  ics_sequence integer,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  created_at integer,
  updated_at integer
);
create table task (
  id text primary key,
  event_id text,
  kind text,
  title text,
  description text,
  due_date integer,
  required integer,
  form_id text,
  deliverable_kind text,
  created_at integer,
  updated_at integer
);
create table task_assignment (
  id text primary key,
  task_id text,
  contact_id text,
  status text,
  completed_at integer,
  completed_by text,
  response_json text,
  file_id text,
  last_reminded_at integer,
  created_at integer,
  updated_at integer
);
create table pipeline_entry (
  id text primary key,
  org_id text,
  contact_id text,
  stage text,
  fit_score integer,
  rationale text,
  created_at integer,
  updated_at integer
);
create table pipeline_activity (
  id text primary key,
  entry_id text,
  kind text,
  body text,
  from_stage text,
  to_stage text,
  author_user_id text,
  author_name text,
  created_at integer
);
create table user (
  id text primary key,
  org_id text,
  email text,
  password_hash text,
  role text,
  contact_id text,
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

function appWithDbAndAuth(db: Db, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function deleteRequest(path: string) {
  return new Request(`http://local${path}`, {
    method: "DELETE",
    headers: { "x-chq-csrf": "1" },
  });
}

function insertContact(sqlite: DatabaseSync, id: string, firstName = "Priya", lastName = "Raman") {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, firstName, lastName, `${firstName.toLowerCase()}@example.com`, NOW, NOW);
}

describe("DELETE /api/v1/contacts/:id (DEC-758/DEC-956/DEC-979)", () => {
  it("deletes a bare contact with no dependents", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(204);
    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(0);
  });

  it("409s naming the row when the contact has a participant, and leaves it in place", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values ('event-1', ?, 'DevFlow Conf 2027', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
      )
      .run(ORG_A, NOW, NOW);
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values ('sub-1', 'event-1', 12, 'Taming CI', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
         values (?, 'sub-1', 'contact-1', 'speaker', 0, 1, ?, ?)`,
      )
      .run(newId(), NOW, NOW);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("conflict");
    expect(json.error.message).toContain("DFC-012");
    expect(json.error.message).toContain("Taming CI");
    expect(json.error.message).toMatch(/merge/i);
    expect(json.error.fields?.participants).toBe("1");
    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(1);
  });

  it("409s naming only the login (never the task assignment) when a task assignment and a user account both reference the contact", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values ('event-1', ?, 'DevFlow Conf 2027', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
      )
      .run(ORG_A, NOW, NOW);
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, required, created_at, updated_at)
         values ('task-1', 'event-1', 'general', 'Send bio', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values (?, 'task-1', 'contact-1', 'pending', ?, ?)`,
      )
      .run(newId(), NOW, NOW);
    sqlite
      .prepare(
        `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
         values (?, ?, 'priya@example.com', 'x', 'speaker', 'contact-1', ?, ?)`,
      )
      .run(newId(), ORG_A, NOW, NOW);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(json.error.message).not.toContain("Send bio");
    expect(json.error.message).toMatch(/login/i);
    expect(json.error.fields?.taskAssignments).toBeUndefined();
    expect(json.error.fields?.userAccounts).toBe("1");
    // Blocked by the login ref, so the contact and its task assignment both
    // remain in place.
    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(1);
    expect(sqlite.prepare(`select id from task_assignment where contact_id = 'contact-1'`).all()).toHaveLength(1);
  });

  it("204s and cascades a contact whose only references are a task assignment and a pipeline entry (+ its activity), per DEC-979", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values ('event-1', ?, 'DevFlow Conf 2027', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
      )
      .run(ORG_A, NOW, NOW);
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, required, created_at, updated_at)
         values ('task-1', 'event-1', 'general', 'Send bio', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values (?, 'task-1', 'contact-1', 'pending', ?, ?)`,
      )
      .run(newId(), NOW, NOW);
    const entryId = newId();
    sqlite
      .prepare(
        `insert into pipeline_entry (id, org_id, contact_id, stage, created_at, updated_at)
         values (?, ?, 'contact-1', 'identified', ?, ?)`,
      )
      .run(entryId, ORG_A, NOW, NOW);
    sqlite
      .prepare(
        `insert into pipeline_activity (id, entry_id, kind, body, author_user_id, author_name, created_at)
         values (?, ?, 'note', 'Reached out', 'u-organizer-a', 'Organizer A', ?)`,
      )
      .run(newId(), entryId, NOW);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(204);
    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(0);
    expect(sqlite.prepare(`select id from task_assignment where contact_id = 'contact-1'`).all()).toHaveLength(0);
    expect(sqlite.prepare(`select id from pipeline_entry where contact_id = 'contact-1'`).all()).toHaveLength(0);
    expect(sqlite.prepare(`select id from pipeline_activity where entry_id = ?`).all(entryId)).toHaveLength(0);
  });

  it("404s when the contact belongs to a different org (existence-hiding, never 403)", async () => {
    const { db } = makeTestDb();
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-from-org-b"));

    expect(res.status).toBe(404);
  });

  it("403s a non-organizer session before any db access", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    const app = appWithDbAndAuth(db, { userId: "u-reviewer-a", role: "reviewer", orgId: ORG_A });

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(403);
    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(1);
  });
});
