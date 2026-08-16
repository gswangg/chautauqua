// DEC-422 (wave-77 amendment): ONE cap for task assignees. Both doors onto
// the task_assignment write -- POST /events/:eventId/tasks's contactIds
// (create) and POST /tasks/:id/assign's contactIds (assign) -- must refuse
// at the same count (MAX_TASK_ASSIGNEES, src/domain/task-kinds.ts) with the
// same shaped 400, rather than the create door capping at 200 and the
// assign door silently taking DEFAULT_BOUNDED_ID_ARRAY_MAX = 1000.
//
// Real rows: node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy over a
// hand-rolled DDL, mirroring test/tasks-create-assignee-subset.test.ts's
// harness, so both route handlers are exercised end-to-end (no repo mocks).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { taskRoutes } from "../src/routes/tasks";
import { newId } from "../src/domain/ids";
import { MAX_TASK_ASSIGNEES } from "../src/domain/task-kinds";
import { clampPerPage } from "../src/lib/pagination";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

const DDL = `
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
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
create table submission (
  id text primary key,
  event_id text,
  form_id text,
  seq integer,
  title text,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text,
  content_status text,
  accepted_at integer,
  ics_sequence integer,
  external_ref text,
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
  invite_status text,
  title_at_time text,
  org_at_time text,
  created_at integer,
  updated_at integer
);
create table user (
  id text primary key,
  contact_id text,
  org_id text,
  email text,
  role text,
  created_at integer,
  updated_at integer
);
create table file (
  id text primary key,
  event_id text,
  kind text,
  filename text,
  content_type text,
  size_bytes integer,
  r2_key text,
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
  updated_at integer,
  unique (event_id, title)
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
  updated_at integer,
  unique (task_id, contact_id)
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

const NOW = new Date(1_700_000_000_000);
const ORG = "org-1";
const EVENT = "event-1";

function insertEvent(sqlite: DatabaseSync) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at) values (?, ?, 'Event', 'event', '2026-01-01', '2026-01-02', 'UTC', 'SES', ?, ?)`,
    )
    .run(EVENT, ORG, NOW.getTime(), NOW.getTime());
}

function insertContact(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, 'Speaker', 'Person', ?, ?, ?)`,
    )
    .run(id, ORG, `${id}@example.com`, NOW.getTime(), NOW.getTime());
}

function insertRosterContact(sqlite: DatabaseSync, contactId: string) {
  insertContact(sqlite, contactId);
  const subId = newId();
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at) values (?, ?, 1, ?, 'accepted', 'pending', 0, ?, ?)`,
    )
    .run(subId, EVENT, `Talk ${contactId}`, NOW.getTime(), NOW.getTime());
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
    )
    .run(newId(), subId, contactId, NOW.getTime(), NOW.getTime());
}

function insertTask(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Sign W9', 0, ?, ?)`,
    )
    .run(id, EVENT, NOW.getTime(), NOW.getTime());
}

async function buildApp(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    await next();
  });
  app.route("/api/v1", taskRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG };

function createTaskRequest(body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/events/${EVENT}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function assignRequest(taskId: string, body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/tasks/${taskId}/assign`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function idsOfLength(n: number): string[] {
  return Array.from({ length: n }, () => newId());
}

describe("DEC-422 (wave-77 amendment): ONE cap for task assignees", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("MAX_TASK_ASSIGNEES is 200, spendable by the picker: clampPerPage(MAX_TASK_ASSIGNEES) reaches it", () => {
    expect(MAX_TASK_ASSIGNEES).toBe(200);
    expect(clampPerPage(MAX_TASK_ASSIGNEES)).toBe(MAX_TASK_ASSIGNEES);
  });

  it("create door refuses a contactIds array over MAX_TASK_ASSIGNEES with a 400", async () => {
    const app = await buildApp(db, ORGANIZER);
    const contactIds = idsOfLength(MAX_TASK_ASSIGNEES + 1);
    const res = await app.request(
      createTaskRequest({ kind: "general", title: "Sign W9", required: false, contactIds }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).toContain(String(MAX_TASK_ASSIGNEES));
    const taskRow = sqlite.prepare(`select count(*) as n from task`).get() as { n: number };
    expect(taskRow.n).toBe(0);
  });

  it("assign door refuses a contactIds array over MAX_TASK_ASSIGNEES with the same shaped 400 (not the 1000-count default)", async () => {
    const taskId = newId();
    insertTask(sqlite, taskId);
    const app = await buildApp(db, ORGANIZER);
    const contactIds = idsOfLength(MAX_TASK_ASSIGNEES + 1);
    const res = await app.request(assignRequest(taskId, { contactIds }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).toContain(String(MAX_TASK_ASSIGNEES));
    const assignments = sqlite.prepare(`select count(*) as n from task_assignment`).get() as { n: number };
    expect(assignments.n).toBe(0);
  });

  it("assign door accepts exactly MAX_TASK_ASSIGNEES roster contacts (the ceiling itself is not refused)", async () => {
    const taskId = newId();
    insertTask(sqlite, taskId);
    const contactIds: string[] = [];
    for (let i = 0; i < MAX_TASK_ASSIGNEES; i++) {
      const id = `c-${i}`;
      insertRosterContact(sqlite, id);
      contactIds.push(id);
    }
    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(assignRequest(taskId, { contactIds }));
    expect(res.status).toBe(200);
    const assignments = sqlite.prepare(`select count(*) as n from task_assignment`).get() as { n: number };
    expect(assignments.n).toBe(MAX_TASK_ASSIGNEES);
  }, 20000);
});
