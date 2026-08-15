// DEC-956/DEC-979: DELETE /api/v1/contacts/:id refuses by NAMING the rows
// it refuses over (submission refs, event names, "has a login"), not just
// class counts — an organiser cannot act on "3 tasks". Per DEC-979, task
// assignments and pipeline entries are no longer refusal classes at all
// (they cascade-delete instead), so this file only covers the two classes
// that remain: participant (submission) and userAccounts. Runs the real
// contactsRoutes sub-app against a real (in-memory) SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver, same technique as
// test/contacts-history-event-id.test.ts, so the real innerJoin +
// `count(*) over()` cap-and-remainder projection in
// listContactReferenceRows is exercised, not a hand-simulated row shape.

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
  headshot_file_id text,
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
  instructions text,
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
create table user (
  id text primary key,
  org_id text,
  email text,
  password_hash text,
  role text,
  name text,
  contact_id text,
  created_at integer,
  updated_at integer
);
create table contact_duplicate_dismissal (
  id text primary key,
  org_id text,
  contact_id_a text,
  contact_id_b text,
  created_at integer,
  unique (org_id, contact_id_a, contact_id_b)
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

function insertContact(sqlite: DatabaseSync, id: string, firstName: string, lastName: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, firstName, lastName, `${firstName.toLowerCase()}@example.com`, NOW, NOW);
}

function insertEvent(sqlite: DatabaseSync, id: string, name: string) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, ?, ?, '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
    )
    .run(id, ORG_A, name, id, NOW, NOW);
}

describe("DELETE /api/v1/contacts/:id names the rows it refuses over (DEC-956)", () => {
  it("204s a contact with zero references", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1", "Grace", "Hopper");
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(204);
    const row = sqlite.prepare(`select id from contact where id = 'contact-1'`).all();
    expect(row).toHaveLength(0);
  });

  it("409s naming submission refs, event names and login, capping rows with a remainder — and never names task/pipeline rows (DEC-979 cascades those)", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1", "Ada", "Lovelace");
    insertEvent(sqlite, "event-1", "DevFlow Conf 2027");

    // 7 submissions on event-1 with contact-1 as a participant: cap at 5
    // named, 2 more.
    for (let i = 0; i < 7; i++) {
      const subId = `sub-${i}`;
      sqlite
        .prepare(
          `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
           values (?, ?, ?, ?, 'accepted', 'approved', 0, ?, ?)`,
        )
        .run(subId, "event-1", 10 + i, `Talk ${i}`, NOW + i, NOW + i);
      sqlite
        .prepare(
          `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
           values (?, ?, 'contact-1', 'speaker', 0, 1, ?, ?)`,
        )
        .run(newId(), subId, NOW + i, NOW + i);
    }

    // A task assignment and a pipeline entry also reference contact-1 — per
    // DEC-979 these are JOIN rows, not documents, so they must never appear
    // in the refusal (they'd cascade-delete once the blocking refs above
    // are resolved).
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, required, created_at, updated_at)
         values ('task-0', 'event-1', 'general', 'Send bio', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values (?, 'task-0', 'contact-1', 'pending', ?, ?)`,
      )
      .run(newId(), NOW, NOW);
    sqlite
      .prepare(
        `insert into pipeline_entry (id, org_id, contact_id, stage, created_at, updated_at)
         values (?, ?, 'contact-1', 'identified', ?, ?)`,
      )
      .run(newId(), ORG_A, NOW, NOW);

    sqlite
      .prepare(`insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
        values (?, ?, 'ada@example.com', 'x', 'speaker', 'contact-1', ?, ?)`)
      .run(newId(), ORG_A, NOW, NOW);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("conflict");

    // Names submission refs and their owning event, capped at 5 with a
    // remainder.
    expect(json.error.message).toContain("Talk 0");
    expect(json.error.message).toContain("Talk 4");
    expect(json.error.message).not.toContain("Talk 5");
    expect(json.error.message).toContain("DevFlow Conf 2027");
    expect(json.error.message).toContain("2 more submission");

    // States a login exists.
    expect(json.error.message).toMatch(/login/i);

    // Never names the task assignment or pipeline entry.
    expect(json.error.message).not.toContain("Send bio");
    expect(json.error.message).not.toMatch(/pipeline/i);

    // Both ways forward — merge, or fix the named refs.
    expect(json.error.message).toMatch(/merge/i);
    expect(json.error.message).toMatch(/submission editor/i);
    expect(json.error.message).toMatch(/settings > people/i);

    // `fields` keeps the count-shaped keys the SPA banner already renders —
    // only the two refusal classes that remain.
    expect(json.error.fields?.participants).toBe("7");
    expect(json.error.fields?.userAccounts).toBe("1");
    expect(json.error.fields?.taskAssignments).toBeUndefined();
    expect(json.error.fields?.pipelineEntries).toBeUndefined();

    // Never deleted.
    const row = sqlite.prepare(`select id from contact where id = 'contact-1'`).all();
    expect(row).toHaveLength(1);
  });
});
