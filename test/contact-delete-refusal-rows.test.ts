// DEC-956: DELETE /api/v1/contacts/:id refuses by NAMING the rows it
// refuses over (submission refs, task titles, event names, "has a login"),
// not just class counts — an organiser cannot act on "3 tasks". Runs the
// real contactsRoutes sub-app against a real (in-memory) SQLite engine via
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

  it("409s naming the submission ref, task titles, event name and login, capping rows with a remainder", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1", "Ada", "Lovelace");
    insertEvent(sqlite, "event-1", "DevFlow Conf 2027");

    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values (?, ?, 12, 'Taming CI', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run("sub-1", "event-1", NOW, NOW);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
         values (?, 'sub-1', 'contact-1', 'speaker', 0, 1, ?, ?)`,
      )
      .run(newId(), NOW, NOW);

    // 7 task assignments across 7 tasks on event-1: cap at 5 named, 2 more.
    for (let i = 0; i < 7; i++) {
      const taskId = `task-${i}`;
      sqlite
        .prepare(
          `insert into task (id, event_id, kind, title, required, created_at, updated_at)
           values (?, ?, 'general', ?, 0, ?, ?)`,
        )
        .run(taskId, "event-1", `Task ${i}`, NOW + i, NOW + i);
      sqlite
        .prepare(
          `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
           values (?, ?, 'contact-1', 'pending', ?, ?)`,
        )
        .run(newId(), taskId, NOW + i, NOW + i);
    }

    sqlite
      .prepare(`insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
        values (?, ?, 'ada@example.com', 'x', 'speaker', 'contact-1', ?, ?)`)
      .run(newId(), ORG_A, NOW, NOW);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("conflict");

    // Names the submission ref and its owning event.
    expect(json.error.message).toContain("DFC-012");
    expect(json.error.message).toContain("Taming CI");
    expect(json.error.message).toContain("DevFlow Conf 2027");

    // Names task titles and their owning event, capped at 5 with a remainder.
    expect(json.error.message).toContain("Task 0");
    expect(json.error.message).toContain("Task 4");
    expect(json.error.message).not.toContain("Task 5");
    expect(json.error.message).toContain("2 more task");

    // States a login exists.
    expect(json.error.message).toMatch(/login/i);

    // Both ways forward.
    expect(json.error.message).toMatch(/merge/i);
    expect(json.error.message).toMatch(/remove them/i);

    // `fields` keeps the count-shaped keys the SPA banner already renders.
    expect(json.error.fields?.participants).toBe("1");
    expect(json.error.fields?.taskAssignments).toBe("7");
    expect(json.error.fields?.userAccounts).toBe("1");
    expect(json.error.fields?.pipelineEntries).toBeUndefined();

    // Never deleted.
    const row = sqlite.prepare(`select id from contact where id = 'contact-1'`).all();
    expect(row).toHaveLength(1);
  });
});
