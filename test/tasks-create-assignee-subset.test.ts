// DEC-746 (wave 59 amendment, REVERSES the original "creation always
// expands" clause): POST /api/v1/events/:eventId/tasks accepts an OPTIONAL
// `contactIds: string[]`. Absent means every accepted speaker (unchanged
// behavior); present must be a non-empty array of ids that all belong to
// this event's roster.
//
// Real rows: node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy over a
// hand-rolled DDL, mirroring test/tasks-assign-roster-scope.test.ts's
// harness, so the route handler and filterRosterContactIds are exercised
// end-to-end (no repo mocks in this file).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { taskRoutes } from "../src/routes/tasks";
import { newId } from "../src/domain/ids";
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

function insertContact(sqlite: DatabaseSync, id: string, firstName: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, 'Speaker', ?, ?, ?)`,
    )
    .run(id, ORG, firstName, `${firstName.toLowerCase()}@example.com`, NOW.getTime(), NOW.getTime());
}

function insertSubmission(sqlite: DatabaseSync, id: string, status: string) {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at) values (?, ?, 1, 'Talk', ?, 'pending', 0, ?, ?)`,
    )
    .run(id, EVENT, status, NOW.getTime(), NOW.getTime());
}

function insertParticipant(sqlite: DatabaseSync, submissionId: string, contactId: string, inviteStatus: string) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    )
    .run(newId(), submissionId, contactId, inviteStatus, NOW.getTime(), NOW.getTime());
}

function countAssignments(sqlite: DatabaseSync): number {
  const row = sqlite.prepare(`select count(*) as n from task_assignment`).get() as { n: number };
  return row.n;
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

const BASE_TASK_BODY = { kind: "general", title: "Sign W9", required: false };

describe("DEC-746 (wave 59 amendment): POST /events/:eventId/tasks contactIds subset", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("(a) absent contactIds still assigns every accepted speaker (byte-for-byte today's behavior)", async () => {
    insertContact(sqlite, "c-1", "Ada");
    insertContact(sqlite, "c-2", "Grace");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-1", "none");
    insertParticipant(sqlite, "sub-1", "c-2", "accepted");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(createTaskRequest(BASE_TASK_BODY));
    expect(res.status).toBe(201);
    expect(countAssignments(sqlite)).toBe(2);
  });

  it("(b) a two-id subset creates exactly two task_assignment rows (not the whole roster)", async () => {
    insertContact(sqlite, "c-1", "Ada");
    insertContact(sqlite, "c-2", "Grace");
    insertContact(sqlite, "c-3", "Rosa");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-1", "none");
    insertParticipant(sqlite, "sub-1", "c-2", "accepted");
    insertParticipant(sqlite, "sub-1", "c-3", "none");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(createTaskRequest({ ...BASE_TASK_BODY, contactIds: ["c-1", "c-2"] }));
    expect(res.status).toBe(201);
    expect(countAssignments(sqlite)).toBe(2);
    const rows = sqlite.prepare(`select contact_id as contactId from task_assignment`).all() as { contactId: string }[];
    expect(new Set(rows.map((r) => r.contactId))).toEqual(new Set(["c-1", "c-2"]));
  });

  it("(c) an empty contactIds array is a 400 naming fields.contactIds and writes nothing", async () => {
    insertContact(sqlite, "c-1", "Ada");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-1", "none");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(createTaskRequest({ ...BASE_TASK_BODY, contactIds: [] }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).toBe("A task must be for at least one person");
    expect(countAssignments(sqlite)).toBe(0);
    const taskRow = sqlite.prepare(`select count(*) as n from task`).get() as { n: number };
    expect(taskRow.n).toBe(0);
  });

  it("(d) an off-roster id is a 400 naming the count that did not resolve, and writes nothing", async () => {
    insertContact(sqlite, "c-1", "Ada");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-1", "none");
    insertContact(sqlite, "c-off-roster", "Grace");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(createTaskRequest({ ...BASE_TASK_BODY, contactIds: ["c-1", "c-off-roster"] }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).toContain("1 of 2");
    expect(body.error.fields?.contactIds).toContain("roster");
    expect(countAssignments(sqlite)).toBe(0);
    const taskRow = sqlite.prepare(`select count(*) as n from task`).get() as { n: number };
    expect(taskRow.n).toBe(0);
  });
});
