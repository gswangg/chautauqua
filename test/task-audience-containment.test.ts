// DEC-754 (roster predicate) / DEC-829 (roster widened to any invite
// status, "speakers" count) / DEC-776 amendment wave 61 (chaseable-contact
// predicate correlated on task_assignment/task instead of a bound eventId,
// composed by both the onboarding grid's countsRow and the reminder repo's
// listOutstandingForEvent/listRemindableContactIds): task-audience.ts
// (grid.ts + reminders.ts + crud.ts's listAcceptedContactIds) exposes
// THREE distinct populations over the same event —
//
//   roster (rosterParticipantExistsForContact / getOnboardingGrid rows)
//     >= accepted-target (listAcceptedContactIds)
//     >= chaseable (chaseableContactExistsForTaskEvent / chaseableContactExists,
//        composed by listOutstandingForEvent, listRemindableContactIds, and
//        the grid's counts.outstandingRequired/outstandingContacts)
//
// — and each predicate is spot-checked against the others in isolation
// elsewhere (chase-predicate-parity.test.ts, onboarding-roster-set.test.ts)
// but never enumerated together against one shared cast of participant
// states. This is exactly how POST /tasks/:id/assign drifted out of the
// lattice unnoticed (w38-b fixes that route; this proves the CLASS at the
// repo-predicate level, deliberately not importing anything w38-b adds so
// both land independently).
//
// Real rows: node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy over the
// same hand-rolled DDL as chase-predicate-parity.test.ts (the repo's probe
// convention -- duplicated deliberately, not factored out).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { getOnboardingGrid } from "../src/server/repo/tasks/grid";
import { createTaskAssignments, listAcceptedContactIds } from "../src/server/repo/tasks/crud";
import { listOutstandingForEvent, listRemindableContactIds } from "../src/server/repo/tasks/reminders";
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

const CREATED_AT = new Date(1_700_000_000_000);
// Task due date is AFTER assignment creation (so overdueAssignmentConditions'
// effective-due-date CASE picks task.dueDate itself, not the
// createdAt+grace fallback) but still before NOW, so a pending,
// still-chaseable assignment reads as overdue.
const DUE_DATE = new Date(1_700_086_400_000);
const NOW = 1_700_200_000_000;

function insertEvent(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at) values (?, 'org-1', 'Event', ?, '2026-01-01', '2026-01-02', 'UTC', 'SES', ?, ?)`,
    )
    .run(id, id, CREATED_AT.getTime(), CREATED_AT.getTime());
}

function insertContact(sqlite: DatabaseSync, id: string, firstName: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', ?, 'Speaker', ?, ?, ?)`,
    )
    .run(id, firstName, `${firstName.toLowerCase()}@example.com`, CREATED_AT.getTime(), CREATED_AT.getTime());
}

function insertSubmission(sqlite: DatabaseSync, id: string, eventId: string, status: string, seq: number) {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at) values (?, ?, ?, 'Talk', ?, 'pending', 0, ?, ?)`,
    )
    .run(id, eventId, seq, status, CREATED_AT.getTime(), CREATED_AT.getTime());
}

function insertParticipant(sqlite: DatabaseSync, submissionId: string, contactId: string, inviteStatus: string) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    )
    .run(newId(), submissionId, contactId, inviteStatus, CREATED_AT.getTime(), CREATED_AT.getTime());
}

function insertTask(sqlite: DatabaseSync, id: string, eventId: string) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, due_date, required, created_at, updated_at) values (?, ?, 'general', 'Sign W9', ?, 1, ?, ?)`,
    )
    .run(id, eventId, DUE_DATE.getTime(), CREATED_AT.getTime(), CREATED_AT.getTime());
}

// A minimal enumeration of every participant/assignment state the three
// predicates under test can distinguish. Each entry is seeded EXACTLY ONCE
// and carries the ledger's expected membership in every set this test
// asserts -- so a new state added to STATES without a matching set of
// expectations fails the "unaccounted state" assertion at the bottom rather
// than silently passing.
interface StateSpec {
  key: string;
  contactId: string;
  // Does this contact end up as a row in getOnboardingGrid
  // (rosterParticipantExistsForContact: accepted submission, ANY invite
  // status)?
  inGrid: boolean;
  // Does this contact end up in listAcceptedContactIds (acceptedSpeaker
  // Conditions: accepted submission, ACTIVE invite status -- ignores
  // assignment/completion entirely)?
  inAcceptedTarget: boolean;
  // Does this contact end up in the chase surfaces (listOutstandingForEvent
  // / listRemindableContactIds / the grid's outstandingRequired/
  // outstandingContacts counts -- acceptedSpeakerConditions AND a
  // non-complete assignment)?
  inChase: boolean;
}

const STATES: StateSpec[] = [
  { key: "invite-none", contactId: "c-none", inGrid: true, inAcceptedTarget: true, inChase: true },
  { key: "invite-accepted", contactId: "c-accepted", inGrid: true, inAcceptedTarget: true, inChase: true },
  { key: "invite-invited", contactId: "c-invited", inGrid: true, inAcceptedTarget: false, inChase: false },
  { key: "invite-declined", contactId: "c-declined", inGrid: true, inAcceptedTarget: false, inChase: false },
  { key: "pending-submission", contactId: "c-pending-sub", inGrid: false, inAcceptedTarget: false, inChase: false },
  { key: "no-participation", contactId: "c-no-participation", inGrid: false, inAcceptedTarget: false, inChase: false },
  // A genuine roster member (accepted submission, active invite status) all
  // of whose task assignments are complete: acceptedSpeakerConditions does
  // NOT look at assignment status, so this contact stays in both the roster
  // and listAcceptedContactIds -- only the chase predicates (which require
  // a non-complete assignment) drop it.
  { key: "all-complete", contactId: "c-all-complete", inGrid: true, inAcceptedTarget: true, inChase: false },
];

describe("task-audience containment lattice (DEC-754/DEC-829/DEC-776)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const EVENT = "event-1";
  const TASK = "task-1";

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite, EVENT);
    insertTask(sqlite, TASK, EVENT);

    let seq = 1;
    for (const state of STATES) {
      insertContact(sqlite, state.contactId, state.key);
    }

    // invite-none / invite-accepted / invite-invited / invite-declined /
    // all-complete: accepted submissions, one per contact, with the named
    // invite status.
    const activeAccepted = ["invite-none", "invite-accepted", "invite-invited", "invite-declined", "all-complete"];
    const inviteStatusByKey: Record<string, string> = {
      "invite-none": "none",
      "invite-accepted": "accepted",
      "invite-invited": "invited",
      "invite-declined": "declined",
      "all-complete": "accepted",
    };
    for (const key of activeAccepted) {
      const state = STATES.find((s) => s.key === key)!;
      const subId = `sub-${key}`;
      insertSubmission(sqlite, subId, EVENT, "accepted", seq++);
      insertParticipant(sqlite, subId, state.contactId, inviteStatusByKey[key]!);
    }

    // pending-submission: a participant of a NON-accepted submission.
    const pending = STATES.find((s) => s.key === "pending-submission")!;
    insertSubmission(sqlite, "sub-pending", EVENT, "pending", seq++);
    insertParticipant(sqlite, "sub-pending", pending.contactId, "none");

    // no-participation: an org contact with no participant/submission row
    // at all (already inserted above via the STATES loop).

    // Assign the task to every contact that is a candidate for the chase
    // surfaces per acceptedSpeakerConditions (active invite status):
    // invite-none, invite-accepted, all-complete. (invite-invited/declined
    // are deliberately NOT assigned -- assignToAllAccepted would never
    // expand to them either; the containment claim under test is about the
    // predicates, not about proving an unreachable assignment refuses to
    // chase.)
    await createTaskAssignments(db, TASK, ["c-none", "c-accepted", "c-all-complete"], CREATED_AT);

    // Mark c-all-complete's assignment complete -- the ONLY axis that
    // separates it from c-accepted.
    sqlite
      .prepare(`update task_assignment set status = 'complete', completed_at = ? where task_id = ? and contact_id = 'c-all-complete'`)
      .run(CREATED_AT.getTime(), TASK);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("every STATES entry is accounted for in exactly the sets its ledger predicts", async () => {
    // Two-directional ledger check #1: no duplicate/unlabeled states.
    const seenKeys = new Set(STATES.map((s) => s.key));
    expect(seenKeys.size).toBe(STATES.length);

    const grid = await getOnboardingGrid(db, EVENT, {
      page: 1,
      perPage: 50,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      inviteStatus: null,
      now: NOW,
    });
    const gridIds = new Set(grid.rows.map((r) => r.contact.id));

    const acceptedIds = new Set(await listAcceptedContactIds(db, EVENT));

    const outstanding = await listOutstandingForEvent(db, EVENT);
    const outstandingIds = new Set(outstanding.map((r) => r.contactId));

    const remindable = await listRemindableContactIds(db, EVENT, {
      now: NOW,
      dedupeWindowMs: 0,
      max: 50,
    });
    const remindableIds = new Set(remindable.contactIds);

    // listOutstandingForEvent and listRemindableContactIds are BOTH
    // compositions of the same chaseable predicate family -- they must
    // never disagree on WHO is chaseable (chase-predicate-parity.test.ts
    // covers status-transition parity; this asserts set equality over the
    // full state enumeration).
    expect(remindableIds).toEqual(outstandingIds);

    const expectedGrid = new Set(STATES.filter((s) => s.inGrid).map((s) => s.contactId));
    const expectedAccepted = new Set(STATES.filter((s) => s.inAcceptedTarget).map((s) => s.contactId));
    const expectedChase = new Set(STATES.filter((s) => s.inChase).map((s) => s.contactId));

    // Two-directional ledger check #2: every expectation set names a real
    // STATES entry (by construction, since it's derived from STATES) and no
    // STATES entry is missing an opinion (every state has explicit
    // inGrid/inAcceptedTarget/inChase booleans, asserted individually below
    // so a forgotten flag can't silently default to false and pass).
    for (const state of STATES) {
      expect(typeof state.inGrid).toBe("boolean");
      expect(typeof state.inAcceptedTarget).toBe("boolean");
      expect(typeof state.inChase).toBe("boolean");
    }

    expect(gridIds).toEqual(expectedGrid);
    expect(acceptedIds).toEqual(expectedAccepted);
    expect(outstandingIds).toEqual(expectedChase);
    expect(remindableIds).toEqual(expectedChase);

    // The lattice: roster >= accepted-target >= chaseable, for THIS shared
    // cast of states.
    for (const id of expectedAccepted) expect(gridIds).toContain(id);
    for (const id of expectedChase) expect(expectedAccepted).toContain(id);
    for (const id of expectedChase) expect(gridIds).toContain(id);

    // Named containment claims from the task brief, restated in terms of
    // the ledger so they can't drift from it:
    // - the roster is exactly the accepted-submission participants
    //   (any invite status) plus the all-complete roster member.
    expect(gridIds).toEqual(new Set(["c-none", "c-accepted", "c-invited", "c-declined", "c-all-complete"]));
    // - listAcceptedContactIds is exactly the ACTIVE-invite-status subset,
    //   still including the all-complete contact (completion is invisible
    //   to this predicate).
    expect(acceptedIds).toEqual(new Set(["c-none", "c-accepted", "c-all-complete"]));
    // - the chase set is listAcceptedContactIds MINUS the all-complete
    //   contact (the only axis separating it from c-accepted is assignment
    //   completion, which only the chase predicates examine).
    expect(outstandingIds).toEqual(new Set([...acceptedIds].filter((id) => id !== "c-all-complete")));
    expect(outstandingIds).toEqual(new Set(["c-none", "c-accepted"]));

    // The grid's counts.overdue / counts.outstandingContacts range ONLY
    // over the chase set (2 contacts, both with a required assignment
    // overdue relative to NOW), never over the wider roster/accepted-target
    // sets.
    expect(grid.counts.outstandingContacts).toBe(expectedChase.size);
    expect(grid.counts.outstandingRequired).toBe(expectedChase.size);
    expect(grid.counts.overdue).toBe(expectedChase.size);
    // speakers is the roster's own (wider) count, unaffected by chase.
    expect(grid.counts.speakers).toBe(expectedGrid.size);
  });
});
