// DEC-776 amendment (wave 61): chaseableContactExistsForTaskEvent is the ONE
// "still owes something" predicate composed by BOTH the onboarding grid's
// outstanding* counts (grid.ts's countsRow) and the speaker's own portal
// list (portal/tasks.ts's getMyTaskAssignments) — a contact who declines
// their invite (or whose accepted submission leaves 'accepted') must drop
// out of both surfaces at once, and come back the moment they're chaseable
// again (re-accepting, or a second accepted participation). This runs the
// real repo functions against a real (in-memory) SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver, mirroring
// onboarding-roster-set.test.ts's harness.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { getOnboardingGrid } from "../src/server/repo/tasks/grid";
import { createTaskAssignments } from "../src/server/repo/tasks/crud";
import { getMyTaskAssignments } from "../src/server/repo/portal/tasks";
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

function insertEvent(sqlite: DatabaseSync, id: string, orgId = "org-1") {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at) values (?, ?, 'Event', ?, '2026-01-01', '2026-01-02', 'UTC', 'SES', ?, ?)`,
    )
    .run(id, orgId, id, NOW.getTime(), NOW.getTime());
}

function insertContact(sqlite: DatabaseSync, id: string, firstName: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', ?, 'Speaker', ?, ?, ?)`,
    )
    .run(id, firstName, `${firstName.toLowerCase()}@example.com`, NOW.getTime(), NOW.getTime());
}

function insertSubmission(sqlite: DatabaseSync, id: string, eventId: string, status: string, seq = 1) {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at) values (?, ?, ?, 'Talk', ?, 'pending', 0, ?, ?)`,
    )
    .run(id, eventId, seq, status, NOW.getTime(), NOW.getTime());
}

function insertParticipant(sqlite: DatabaseSync, submissionId: string, contactId: string, inviteStatus: string) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    )
    .run(newId(), submissionId, contactId, inviteStatus, NOW.getTime(), NOW.getTime());
}

function updateInviteStatus(sqlite: DatabaseSync, submissionId: string, contactId: string, inviteStatus: string) {
  sqlite
    .prepare(`update participant set invite_status = ? where submission_id = ? and contact_id = ?`)
    .run(inviteStatus, submissionId, contactId);
}

function insertTask(sqlite: DatabaseSync, id: string, eventId: string, required = true) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Sign W9', ?, ?, ?)`,
    )
    .run(id, eventId, required ? 1 : 0, NOW.getTime(), NOW.getTime());
}

async function grid(db: Db, eventId: string) {
  return getOnboardingGrid(db, eventId, {
    page: 1,
    perPage: 50,
    q: null,
    taskId: null,
    status: null,
    overdueOnly: false,
    inviteStatus: null,
    now: NOW.getTime(),
  });
}

describe("chaseableContactExistsForTaskEvent parity (DEC-776 wave 61)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const EVENT = "event-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite, EVENT);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("declining the only accepted participation drops counts.outstanding*/portal rows, leaves overdue and speakers unchanged, and re-accepting restores everything", async () => {
    insertTask(sqlite, "task-1", EVENT, true);
    insertContact(sqlite, "c-1", "Ada");
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c-1", "accepted");
    await createTaskAssignments(db, "task-1", ["c-1"], NOW);

    const before = await grid(db, EVENT);
    expect(before.counts.outstandingRequired).toBe(1);
    expect(before.counts.outstandingContacts).toBe(1);
    expect(before.counts.overdue).toBe(0);
    expect(before.counts.speakers).toBe(1);

    const portalBefore = await getMyTaskAssignments(db, "c-1", "org-1");
    expect(portalBefore).toHaveLength(1);

    updateInviteStatus(sqlite, "sub-1", "c-1", "declined");

    const afterDecline = await grid(db, EVENT);
    expect(afterDecline.counts.outstandingRequired).toBe(0);
    expect(afterDecline.counts.outstandingContacts).toBe(0);
    // overdue was already excluding non-active-invite contacts -- unchanged.
    expect(afterDecline.counts.overdue).toBe(0);
    // the roster still shows the row (DEC-829).
    expect(afterDecline.counts.speakers).toBe(1);

    const portalAfterDecline = await getMyTaskAssignments(db, "c-1", "org-1");
    expect(portalAfterDecline).toEqual([]);

    updateInviteStatus(sqlite, "sub-1", "c-1", "accepted");

    const afterReaccept = await grid(db, EVENT);
    expect(afterReaccept.counts.outstandingRequired).toBe(1);
    expect(afterReaccept.counts.outstandingContacts).toBe(1);
    expect(afterReaccept.counts.overdue).toBe(0);
    expect(afterReaccept.counts.speakers).toBe(1);

    const portalAfterReaccept = await getMyTaskAssignments(db, "c-1", "org-1");
    expect(portalAfterReaccept).toHaveLength(1);
    expect(portalAfterReaccept[0]!.id).toBe(portalBefore[0]!.id);
  });

  it("a contact chaseable via a SECOND accepted participation keeps their tasks even after the first is declined", async () => {
    insertTask(sqlite, "task-1", EVENT, true);
    insertContact(sqlite, "c-2", "Grace");
    insertSubmission(sqlite, "sub-a", EVENT, "accepted", 1);
    insertParticipant(sqlite, "sub-a", "c-2", "accepted");
    insertSubmission(sqlite, "sub-b", EVENT, "accepted", 2);
    insertParticipant(sqlite, "sub-b", "c-2", "accepted");
    await createTaskAssignments(db, "task-1", ["c-2"], NOW);

    const before = await grid(db, EVENT);
    expect(before.counts.outstandingRequired).toBe(1);
    expect(before.counts.outstandingContacts).toBe(1);

    // decline ONE of the two accepted participations -- the contact is
    // still chaseable through the other.
    updateInviteStatus(sqlite, "sub-a", "c-2", "declined");

    const after = await grid(db, EVENT);
    expect(after.counts.outstandingRequired).toBe(1);
    expect(after.counts.outstandingContacts).toBe(1);

    const portal = await getMyTaskAssignments(db, "c-2", "org-1");
    expect(portal).toHaveLength(1);
  });
});
