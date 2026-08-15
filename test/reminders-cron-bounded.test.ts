// DEC-319 amendment (wave 38): the cron must bound its read instead of
// refusing the pass. sendDueRemindersForEvent now calls
// listDueReminderContactIds (a COARSE SUPERSET pre-filter, real SQL GROUP
// BY) FIRST to pick at most MAX_REMINDER_BATCH contact ids, then narrows
// listOutstandingForEvent to that set — so an event with far more than
// MAX_REMINDER_SCAN outstanding rows never throws; it just sends the first
// MAX_REMINDER_BATCH contacts (ascending) this tick and picks up the rest
// on the next tick, per the same "sorted, sliced, resumable" convention as
// capById/capReminderGroups. Runs against a real in-memory SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver, same technique as
// test/reminders-declined-not-chased.test.ts, so the GROUP BY/HAVING/ORDER
// BY/LIMIT predicate is exercised for real.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { listDueReminderContactIds, listOutstandingForEvent, sendDueRemindersForEvent } from "../src/server/repo/tasks/reminders";
import { DEDUPE_WINDOW_MS, DUE_WINDOW_MS, MAX_REMINDER_BATCH, REMINDER_OVERDUE_TAIL_MS } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

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
  name_at_time text,
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

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function fakeMailer(): { mailer: Mailer; sendCalls: { to: { email: string } }[] } {
  const sendCalls: { to: { email: string } }[] = [];
  const mailer: Mailer = {
    async send(m) {
      sendCalls.push(m as { to: { email: string } });
    },
  };
  return { mailer, sendCalls };
}

const EVENT_ID = "event-1";
const ORG_ID = "org-1";
const ORIGIN = "https://events.example.com";
const NOW_MS = 1_700_000_000_000;
const NOW = new Date(NOW_MS);
// well within the DUE_WINDOW and REMINDER_OVERDUE_TAIL, never reminded
const DUE_SOON = NOW_MS - 60 * 60 * 1000; // 1h ago

function insertEvent(sqlite: DatabaseSync) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, 'DevFlow Conf', 'devflow', '2020-01-01', '2099-01-02', 'UTC', 'DFC', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, NOW_MS, NOW_MS);
}

function insertTask(sqlite: DatabaseSync, id: string, dueDate: number | null) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, description, due_date, required, created_at, updated_at)
       values (?, ?, 'onboarding', 'Submit bio', null, ?, 1, ?, ?)`,
    )
    .run(id, EVENT_ID, dueDate, NOW_MS, NOW_MS);
}

function insertContact(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
       values (?, ?, 'First', ?, ?, ?, ?)`,
    )
    .run(id, ORG_ID, id, `${id}@example.com`, NOW_MS, NOW_MS);
}

function insertAssignment(
  sqlite: DatabaseSync,
  id: string,
  taskId: string,
  contactId: string,
  opts: { status?: string; lastRemindedAt?: number | null; createdAt?: number } = {},
) {
  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      taskId,
      contactId,
      opts.status ?? "pending",
      opts.lastRemindedAt ?? null,
      // DEC-801: default createdAt is well before every dueDate this file
      // uses (up to REMINDER_OVERDUE_TAIL_MS + slack in the past), so the
      // effective-due CASE expression resolves to the task's own dueDate
      // rather than tripping the assigned-late grace bump.
      opts.createdAt ?? NOW_MS - 30 * 24 * 60 * 60 * 1000,
      NOW_MS,
    );
}

function insertSubmission(sqlite: DatabaseSync, id: string, status: string) {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
       values (?, ?, 1, 'Talk', ?, 'approved', 0, ?, ?)`,
    )
    .run(id, EVENT_ID, status, NOW_MS, NOW_MS);
}

function insertParticipant(
  sqlite: DatabaseSync,
  id: string,
  submissionId: string,
  contactId: string,
  inviteStatus: string,
) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    )
    .run(id, submissionId, contactId, inviteStatus, NOW_MS, NOW_MS);
}

/** Makes contact `id` a chaseable (accepted, invite-active) speaker with one
 * pending, due-soon task assignment. */
function seedChaseableContact(sqlite: DatabaseSync, contactId: string, taskId: string) {
  insertContact(sqlite, contactId);
  insertAssignment(sqlite, `assign-${contactId}`, taskId, contactId);
  insertSubmission(sqlite, `submission-${contactId}`, "accepted");
  insertParticipant(sqlite, `participant-${contactId}`, `submission-${contactId}`, contactId, "accepted");
}

function contactId(i: number): string {
  return `contact-${String(i).padStart(4, "0")}`;
}

describe("DEC-319 amendment (wave 38): cron bounds its read instead of refusing the pass", () => {
  it("103 chaseable contacts each with one due task -> exactly MAX_REMINDER_BATCH sends, no throw, lowest 100 ids ascending", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);
    insertTask(sqlite, "task-1", DUE_SOON);
    const total = 103;
    for (let i = 1; i <= total; i++) {
      seedChaseableContact(sqlite, contactId(i), "task-1");
    }
    const { mailer, sendCalls } = fakeMailer();

    // asserted BEFORE sendDueRemindersForEvent stamps last_reminded_at,
    // since a second read after the send would legitimately dedupe the
    // just-sent 100 out (proving the "next tick advances" contract, not
    // this tick's selection).
    const dueIdsBeforeSend = await listDueReminderContactIds(db, EVENT_ID, { now: NOW_MS, max: MAX_REMINDER_BATCH });
    expect(dueIdsBeforeSend).toEqual(Array.from({ length: MAX_REMINDER_BATCH }, (_, i) => contactId(i + 1)));

    const sentCount = await sendDueRemindersForEvent(db, mailer, EVENT_ID, NOW, new InMemoryKV(), ORIGIN);

    expect(sentCount).toBe(MAX_REMINDER_BATCH);
    expect(sendCalls).toHaveLength(MAX_REMINDER_BATCH);
    const sentEmails = sendCalls.map((c) => c.to.email).sort();
    const expectedEmails = Array.from({ length: MAX_REMINDER_BATCH }, (_, i) => `${contactId(i + 1)}@example.com`);
    expect(sentEmails).toEqual(expectedEmails);

    // the next tick's read excludes the 100 just-reminded contacts (deduped
    // via last_reminded_at) and picks up the remaining 3.
    const dueIdsAfterSend = await listDueReminderContactIds(db, EVENT_ID, { now: NOW_MS, max: MAX_REMINDER_BATCH });
    expect(dueIdsAfterSend).toEqual([contactId(101), contactId(102), contactId(103)]);
  });

  it("listDueReminderContactIds excludes: beyond DUE_WINDOW_MS, beyond REMINDER_OVERDUE_TAIL_MS, reminded inside DEDUPE_WINDOW_MS, declined-only, and all-complete", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);

    // eligible baseline contact
    insertTask(sqlite, "task-eligible", DUE_SOON);
    seedChaseableContact(sqlite, "contact-eligible", "task-eligible");

    // beyond DUE_WINDOW_MS (due far in the future, not yet due/overdue).
    // wave-61 amendment (DEC-023): listDueReminderContactIds widens its
    // pre-filter by TWO_DAY_MS on each side (the coarse-superset bound now
    // has to cover isReminderDue's zone-expanded dueEnd, which can land up
    // to ~2 days past the raw day label) — so this must clear the window by
    // more than that slack, not just DUE_WINDOW_MS + 1h.
    const TWO_DAY_MS_PLUS_SLOP = 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    insertTask(sqlite, "task-far-future", NOW_MS + DUE_WINDOW_MS + TWO_DAY_MS_PLUS_SLOP);
    seedChaseableContact(sqlite, "contact-far-future", "task-far-future");

    // beyond REMINDER_OVERDUE_TAIL_MS (long overdue, past the terminal tail
    // and past the widened pre-filter's slack).
    insertTask(sqlite, "task-too-old", NOW_MS - REMINDER_OVERDUE_TAIL_MS - TWO_DAY_MS_PLUS_SLOP);
    seedChaseableContact(sqlite, "contact-too-old", "task-too-old");

    // reminded inside DEDUPE_WINDOW_MS
    insertContact(sqlite, "contact-recently-reminded");
    insertAssignment(sqlite, "assign-recently-reminded", "task-eligible", "contact-recently-reminded", {
      lastRemindedAt: NOW_MS - DEDUPE_WINDOW_MS + 60 * 60 * 1000,
    });
    insertSubmission(sqlite, "submission-recently-reminded", "accepted");
    insertParticipant(
      sqlite,
      "participant-recently-reminded",
      "submission-recently-reminded",
      "contact-recently-reminded",
      "accepted",
    );

    // declined every accepted participation
    insertContact(sqlite, "contact-declined");
    insertAssignment(sqlite, "assign-declined", "task-eligible", "contact-declined");
    insertSubmission(sqlite, "submission-declined", "accepted");
    insertParticipant(sqlite, "participant-declined", "submission-declined", "contact-declined", "declined");

    // all assignments complete
    insertContact(sqlite, "contact-complete");
    insertAssignment(sqlite, "assign-complete", "task-eligible", "contact-complete", { status: "complete" });
    insertSubmission(sqlite, "submission-complete", "accepted");
    insertParticipant(sqlite, "participant-complete", "submission-complete", "contact-complete", "accepted");

    const dueIds = await listDueReminderContactIds(db, EVENT_ID, { now: NOW_MS, max: MAX_REMINDER_BATCH });

    expect(dueIds).toEqual(["contact-eligible"]);
  });

  it("parity: recipients and subjects for a small seeded event match sendDueRemindersForEvent's direct listOutstandingForEvent path", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);
    insertTask(sqlite, "task-1", DUE_SOON);
    seedChaseableContact(sqlite, "contact-a", "task-1");
    seedChaseableContact(sqlite, "contact-b", "task-1");
    const { mailer, sendCalls } = fakeMailer();

    const sentCount = await sendDueRemindersForEvent(db, mailer, EVENT_ID, NOW, new InMemoryKV(), ORIGIN);

    expect(sentCount).toBe(2);
    const bySubjectAndEmail = sendCalls
      .map((c) => ({ email: c.to.email, subject: (c as unknown as { subject: string }).subject }))
      .sort((a, b) => a.email.localeCompare(b.email));
    expect(bySubjectAndEmail).toEqual([
      { email: "contact-a@example.com", subject: "Action needed: outstanding tasks for DevFlow Conf" },
      { email: "contact-b@example.com", subject: "Action needed: outstanding tasks for DevFlow Conf" },
    ]);

    // the same set is what listOutstandingForEvent returns when narrowed to
    // the contactIds listDueReminderContactIds chose -- the cron path and a
    // direct call must agree on who's outstanding.
    const dueIds = await listDueReminderContactIds(db, EVENT_ID, { now: NOW_MS, max: MAX_REMINDER_BATCH });
    const outstanding = await listOutstandingForEvent(db, EVENT_ID, undefined, dueIds);
    expect(outstanding.map((r) => r.contactId).sort()).toEqual(["contact-a", "contact-b"]);
  });
});
