// DEC-009 amendment (wave 59): "Finalize bio + headshot" is now a
// kind='general' onboarding task, closed by completeProfileTaskForContact
// (src/server/repo/profile.ts) once a speaker's portal profile save leaves
// both a bio and a headshot in place -- never by a file_request upload.
// This runs the real SQL (node:sqlite + drizzle's sqlite-proxy driver, same
// pattern as test/onboarding-roster-set.test.ts) so the ONE set-based
// UPDATE's join/subquery is actually evaluated, not merely asserted as SQL
// text.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { completeProfileTaskForContact } from "../src/server/repo/profile";
import { PROFILE_TASK_TITLE } from "../src/domain/acceptance";
import { newId } from "../src/domain/ids";
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
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(async (sqlText, params, method) => {
    const stmt = sqlite.prepare(sqlText);
    stmt.setReturnArrays(true);
    if (method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }
    const rows = stmt.all(...params) as unknown[];
    return { rows };
  }, { schema });
  return { db: db as unknown as Db, sqlite };
}

const NOW = new Date(1_700_000_000_000);
const ORG = "org-1";
const EVENT = "event-1";

function insertEvent(sqlite: DatabaseSync, id: string, orgId: string) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at) values (?, ?, 'Event', ?, '2026-01-01', '2026-01-02', 'UTC', 'SES', ?, ?)`,
    )
    .run(id, orgId, id, NOW.getTime(), NOW.getTime());
}

function insertContact(sqlite: DatabaseSync, id: string, orgId: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, 'Ada', 'Lovelace', ?, ?, ?)`,
    )
    .run(id, orgId, `${id}@example.com`, NOW.getTime(), NOW.getTime());
}

function insertSubmission(sqlite: DatabaseSync, id: string, eventId: string, status: string) {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at) values (?, ?, 1, 'Talk', ?, 'pending', 0, ?, ?)`,
    )
    .run(id, eventId, status, NOW.getTime(), NOW.getTime());
}

function insertParticipant(sqlite: DatabaseSync, submissionId: string, contactId: string, inviteStatus: string) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    )
    .run(newId(), submissionId, contactId, inviteStatus, NOW.getTime(), NOW.getTime());
}

function insertTask(sqlite: DatabaseSync, id: string, eventId: string, title: string, kind = "general") {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(id, eventId, kind, title, NOW.getTime(), NOW.getTime());
}

function insertAssignment(sqlite: DatabaseSync, id: string, taskId: string, contactId: string, status = "pending") {
  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, taskId, contactId, status, NOW.getTime(), NOW.getTime());
}

describe("completeProfileTaskForContact (DEC-009 amendment, wave 59)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite, EVENT, ORG);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("closes the pending PROFILE_TASK_TITLE assignment for an active accepted participant, and is idempotent on a second call", async () => {
    insertContact(sqlite, "c1", ORG);
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c1", "accepted");
    insertTask(sqlite, "task-1", EVENT, PROFILE_TASK_TITLE);
    insertAssignment(sqlite, "assign-1", "task-1", "c1");

    const closed = await completeProfileTaskForContact(db, "c1", ORG, "user-1");
    expect(closed).toBe(1);

    const row = sqlite.prepare("select status, completed_by from task_assignment where id = ?").get("assign-1") as {
      status: string;
      completed_by: string;
    };
    expect(row.status).toBe("complete");
    expect(row.completed_by).toBe("user-1");

    // Idempotent: the row is already 'complete', so a second call (e.g. a
    // second profile save) touches nothing.
    const closedAgain = await completeProfileTaskForContact(db, "c1", ORG, "user-1");
    expect(closedAgain).toBe(0);
  });

  it("does not touch an assignment for a different task title", async () => {
    insertContact(sqlite, "c1", ORG);
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c1", "accepted");
    insertTask(sqlite, "task-1", EVENT, "Finalize talk description");
    insertAssignment(sqlite, "assign-1", "task-1", "c1");

    const closed = await completeProfileTaskForContact(db, "c1", ORG, "user-1");
    expect(closed).toBe(0);
    const row = sqlite.prepare("select status from task_assignment where id = ?").get("assign-1") as {
      status: string;
    };
    expect(row.status).toBe("pending");
  });

  it("does not touch a declined participant's assignment (not ACTIVE_INVITE_STATUSES)", async () => {
    insertContact(sqlite, "c1", ORG);
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c1", "declined");
    insertTask(sqlite, "task-1", EVENT, PROFILE_TASK_TITLE);
    insertAssignment(sqlite, "assign-1", "task-1", "c1");

    const closed = await completeProfileTaskForContact(db, "c1", ORG, "user-1");
    expect(closed).toBe(0);
  });

  it("does not touch a non-accepted submission's assignment", async () => {
    insertContact(sqlite, "c1", ORG);
    insertSubmission(sqlite, "sub-1", EVENT, "pending");
    insertParticipant(sqlite, "sub-1", "c1", "accepted");
    insertTask(sqlite, "task-1", EVENT, PROFILE_TASK_TITLE);
    insertAssignment(sqlite, "assign-1", "task-1", "c1");

    const closed = await completeProfileTaskForContact(db, "c1", ORG, "user-1");
    expect(closed).toBe(0);
  });

  it("does not touch another org's event even with a matching task title", async () => {
    insertContact(sqlite, "c1", ORG);
    insertEvent(sqlite, "event-2", "org-2");
    insertSubmission(sqlite, "sub-1", "event-2", "accepted");
    insertParticipant(sqlite, "sub-1", "c1", "accepted");
    insertTask(sqlite, "task-1", "event-2", PROFILE_TASK_TITLE);
    insertAssignment(sqlite, "assign-1", "task-1", "c1");

    const closed = await completeProfileTaskForContact(db, "c1", ORG, "user-1");
    expect(closed).toBe(0);
  });
});
