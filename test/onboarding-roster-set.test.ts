// DEC-754: the onboarding roster and the accepted-speaker set an action
// (createTask/assignToAllAccepted) expands over must be ONE predicate.
// This runs the real getOnboardingGrid/listAcceptedContactIds against a
// real (in-memory) SQLite engine via node:sqlite + drizzle-orm's
// sqlite-proxy driver — no fakeDb row-queue stand-in — so the correlated
// EXISTS in acceptedSpeakerExistsForContact (crud.ts) is actually
// evaluated, not merely asserted as SQL text. Enumeration, never sampling:
// every seeded contact is checked against both the grid's rows and
// listAcceptedContactIds, in both directions.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { getOnboardingGrid } from "../src/server/repo/tasks/grid";
import { listAcceptedContactIds, createTaskAssignments } from "../src/server/repo/tasks/crud";
import { newId } from "../src/domain/ids";
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

function insertContact(sqlite: DatabaseSync, id: string, firstName: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', ?, 'Speaker', ?, ?, ?)`,
    )
    .run(id, firstName, `${firstName.toLowerCase()}@example.com`, NOW.getTime(), NOW.getTime());
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

function insertTask(sqlite: DatabaseSync, id: string, eventId: string) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Sign W9', 1, ?, ?)`,
    )
    .run(id, eventId, NOW.getTime(), NOW.getTime());
}

describe("onboarding roster == accepted-speaker set (DEC-754)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const EVENT = "event-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  async function allGridContactIds(): Promise<string[]> {
    const ids: string[] = [];
    let page = 1;
    // perPage=1 to exercise pagination across "all pages" per the task's
    // enumeration requirement.
    for (;;) {
      const grid = await getOnboardingGrid(db, EVENT, {
        page,
        perPage: 1,
        q: null,
        taskId: null,
        status: null,
        overdueOnly: false,
        now: NOW.getTime(),
      });
      if (grid.rows.length === 0) break;
      ids.push(...grid.rows.map((r) => r.contact.id));
      if (ids.length >= grid.total) break;
      page += 1;
    }
    return ids;
  }

  it("an accepted, active-invite speaker with NO assignments appears in the grid", async () => {
    insertTask(sqlite, "task-1", EVENT);
    insertContact(sqlite, "c-no-assignment", "Ada");
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c-no-assignment", "none");
    // Deliberately no task_assignment row for c-no-assignment.

    const ids = await allGridContactIds();
    expect(ids).toContain("c-no-assignment");

    const grid = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      now: NOW.getTime(),
    });
    const row = grid.rows.find((r) => r.contact.id === "c-no-assignment");
    expect(row).toBeDefined();
    expect(row?.cells).toEqual([]);
  });

  it("a contact with an assignment but no active accepted participation does NOT appear", async () => {
    insertTask(sqlite, "task-1", EVENT);
    insertContact(sqlite, "c-stale-assignment", "Grace");
    // No submission/participant row at all for this event -- but it still
    // carries a task_assignment (e.g. a stale row from a prior task cycle).
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values (?, 'task-1', 'c-stale-assignment', 'pending', ?, ?)`,
      )
      .run(newId(), NOW.getTime(), NOW.getTime());

    const ids = await allGridContactIds();
    expect(ids).not.toContain("c-stale-assignment");
  });

  it("a declined-invite accepted-submission contact does NOT appear", async () => {
    insertTask(sqlite, "task-1", EVENT);
    insertContact(sqlite, "c-declined", "Rosa");
    insertSubmission(sqlite, "sub-declined", EVENT, "accepted");
    insertParticipant(sqlite, "sub-declined", "c-declined", "declined");

    const ids = await allGridContactIds();
    expect(ids).not.toContain("c-declined");
  });

  it("grid roster across all pages == listAcceptedContactIds, and counts.speakers is its size", async () => {
    insertTask(sqlite, "task-1", EVENT);

    // (i) accepted + active, no assignment -- should appear.
    insertContact(sqlite, "c1", "Ada");
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c1", "none");

    // (ii) accepted + active, WITH an assignment -- should appear.
    insertContact(sqlite, "c2", "Grace");
    insertSubmission(sqlite, "sub-2", EVENT, "accepted");
    insertParticipant(sqlite, "sub-2", "c2", "accepted");
    await createTaskAssignments(db, "task-1", ["c2"], NOW);

    // (iii) accepted submission but invite declined -- must NOT appear.
    insertContact(sqlite, "c3", "Rosa");
    insertSubmission(sqlite, "sub-3", EVENT, "accepted");
    insertParticipant(sqlite, "sub-3", "c3", "declined");

    // (iv) pending (not accepted) submission -- must NOT appear.
    insertContact(sqlite, "c4", "Mae");
    insertSubmission(sqlite, "sub-4", EVENT, "pending");
    insertParticipant(sqlite, "sub-4", "c4", "none");

    // (v) has a task_assignment for this event's task but no participation
    // at all -- must NOT appear (the P2 bug this task fixes).
    insertContact(sqlite, "c5", "Katherine");
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values (?, 'task-1', 'c5', 'pending', ?, ?)`,
      )
      .run(newId(), NOW.getTime(), NOW.getTime());

    const gridIds = new Set(await allGridContactIds());
    const acceptedIds = new Set(await listAcceptedContactIds(db, EVENT));

    expect(gridIds).toEqual(new Set(["c1", "c2"]));
    expect(acceptedIds).toEqual(new Set(["c1", "c2"]));
    expect(gridIds).toEqual(acceptedIds);

    const grid = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      now: NOW.getTime(),
    });
    expect(grid.counts.speakers).toBe(acceptedIds.size);
    expect(grid.counts.speakers).toBe(2);
  });
});

// DEC-789: the roster row carries a (participantId, submissionId,
// inviteStatus) triple sourced from the SAME row query as the rest of the
// row, and an inviteStatus filter param is ANDed onto that SAME query --
// never a separate predicate the row set could drift from.
describe("onboarding grid invite-status control + filter (DEC-789)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const EVENT = "event-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("each row carries the participant/submission id backing it, and its current inviteStatus", async () => {
    insertTask(sqlite, "task-1", EVENT);
    insertContact(sqlite, "c1", "Ada");
    insertSubmission(sqlite, "sub-1", EVENT, "accepted");
    insertParticipant(sqlite, "sub-1", "c1", "accepted");

    const grid = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      inviteStatus: null,
      now: NOW.getTime(),
    });
    const row = grid.rows.find((r) => r.contact.id === "c1");
    expect(row).toBeDefined();
    expect(row!.contact.inviteStatus).toBe("accepted");
    expect(row!.contact.submissionId).toBe("sub-1");
    expect(typeof row!.contact.participantId).toBe("string");
    expect(row!.contact.participantId.length).toBeGreaterThan(0);
  });

  it("an inviteStatus filter narrows the roster to that status, on the SAME row query", async () => {
    insertTask(sqlite, "task-1", EVENT);

    insertContact(sqlite, "c-accepted", "Ada");
    insertSubmission(sqlite, "sub-accepted", EVENT, "accepted");
    insertParticipant(sqlite, "sub-accepted", "c-accepted", "accepted");

    insertContact(sqlite, "c-none", "Grace");
    insertSubmission(sqlite, "sub-none", EVENT, "accepted");
    insertParticipant(sqlite, "sub-none", "c-none", "none");

    const acceptedOnly = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      inviteStatus: "accepted",
      now: NOW.getTime(),
    });
    expect(acceptedOnly.rows.map((r) => r.contact.id)).toEqual(["c-accepted"]);

    // A filter value outside the roster's active-invite-status base
    // condition (DEC-754: none/accepted only) correctly yields zero rows
    // rather than silently matching the whole roster.
    const declinedOnly = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      inviteStatus: "declined",
      now: NOW.getTime(),
    });
    expect(declinedOnly.rows).toEqual([]);

    const unfiltered = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      inviteStatus: null,
      now: NOW.getTime(),
    });
    expect(unfiltered.rows.map((r) => r.contact.id).sort()).toEqual(["c-accepted", "c-none"]);
  });
});
