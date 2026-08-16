// DEC-754 amendment (wave 38): POST /api/v1/tasks/:id/assign must range over
// the event ROSTER (rosterParticipantExistsForContact -- the grid's base row
// predicate), not just org membership (DEC-120's findContactsForOrg check).
// Assigning a contact who is not a participant on an accepted submission of
// this event used to return 200 and write a task_assignment row the grid
// never shows and no reminder path (chaseableContactExists) ever chases.
//
// Real rows: node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy over a
// hand-rolled DDL, mirroring test/onboarding-roster-set.test.ts's harness,
// so the correlated EXISTS predicates in crud.ts are actually evaluated
// end-to-end through the real route handler (no repo mocks in this file).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { taskRoutes } from "../src/routes/tasks";
import { getOnboardingGrid } from "../src/server/repo/tasks/grid";
import { listOutstandingForEvent } from "../src/server/repo/tasks/reminders";
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
  audience text,
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
  updated_at integer,
  unique (task_id, contact_id)
);
create table file (
  id text primary key,
  submission_id text,
  kind text,
  filename text,
  r2_key text,
  size_bytes integer,
  content_type text,
  previous_file_id text,
  version_no integer,
  uploaded_by_contact_id text,
  created_at integer
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
const TASK = "task-1";

function insertEvent(sqlite: DatabaseSync) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at) values (?, ?, 'Event', 'event', '2026-01-01', '2026-01-02', 'UTC', 'SES', ?, ?)`,
    )
    .run(EVENT, ORG, NOW.getTime(), NOW.getTime());
}

function insertTask(sqlite: DatabaseSync) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Sign W9', 1, ?, ?)`,
    )
    .run(TASK, EVENT, NOW.getTime(), NOW.getTime());
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

function assignRequest(contactIds: unknown[]) {
  return new Request(`http://test/api/v1/tasks/${TASK}/assign`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ contactIds }),
  });
}

describe("DEC-754 (wave 38 amendment): POST /tasks/:id/assign ranges over the event roster", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite);
    insertTask(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("(a) an invite-'none' roster contact assigns -> 200 and appears in the grid with a cell for the task", async () => {
    insertContact(sqlite, "c-roster", "Ada");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-roster", "none");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(assignRequest(["c-roster"]));
    expect(res.status).toBe(200);
    expect(countAssignments(sqlite)).toBe(1);

    const grid = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      now: NOW.getTime(),
    });
    const row = grid.rows.find((r) => r.contact.id === "c-roster");
    expect(row).toBeDefined();
    expect(row?.cells.some((cell) => cell.taskId === TASK)).toBe(true);
  });

  it("(b) an org contact with NO participant row -> 400 'invalid', a stale-selection sentence (not the id), and writes zero assignments", async () => {
    insertContact(sqlite, "c-no-roster", "Grace");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(assignRequest(["c-no-roster"]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    // DEC-856 amendment: no raw id in the refusal -- nothing resolved, so a
    // stale-selection sentence with the refresh action.
    expect(body.error.fields?.contactIds).not.toContain("c-no-roster");
    expect(body.error.fields?.contactIds).toContain("selection is stale");
    expect(countAssignments(sqlite)).toBe(0);
  });

  it("(c) a 'declined' participant of an accepted submission IS assignable and IS a grid row, but listOutstandingForEvent still excludes them (DEC-829 listing/expansion split)", async () => {
    insertContact(sqlite, "c-declined", "Rosa");
    insertSubmission(sqlite, "sub-declined", "accepted");
    insertParticipant(sqlite, "sub-declined", "c-declined", "declined");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(assignRequest(["c-declined"]));
    expect(res.status).toBe(200);
    expect(countAssignments(sqlite)).toBe(1);

    const grid = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      now: NOW.getTime(),
    });
    expect(grid.rows.some((r) => r.contact.id === "c-declined")).toBe(true);

    const outstanding = await listOutstandingForEvent(db, EVENT);
    expect(outstanding.some((o) => o.contactId === "c-declined")).toBe(false);
  });

  it("(d) a mixed valid+invalid batch -> 400, names the live contact, counts the dead one, no id, and zero writes", async () => {
    insertContact(sqlite, "c-roster", "Ada");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-roster", "none");
    insertContact(sqlite, "c-no-roster", "Grace");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(assignRequest(["c-roster", "c-no-roster"]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    // DEC-856 amendment: names the live (resolved) contact, counts the dead
    // one, and never prints either raw id.
    expect(body.error.fields?.contactIds).not.toContain("c-no-roster");
    expect(body.error.fields?.contactIds).not.toContain("c-roster");
    expect(body.error.fields?.contactIds).toContain("Ada Speaker");
    expect(body.error.fields?.contactIds).toMatch(/^1 selected row/);
    expect(countAssignments(sqlite)).toBe(0);
  });
});
