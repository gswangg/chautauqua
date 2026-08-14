// DEC-829 (wave-59 amendment): a speaker who has declined every accepted
// submission of the event is not chased for outstanding tasks — the ONE
// chaseableContactExists predicate (crud.ts) must be composed by both
// listOutstandingForEvent and listRemindableContactIds (reminders.ts), so
// preview, send (remindNow) and the due-date cron (sendDueRemindersForEvent)
// all agree with overdueAssignmentConditions' "owes nothing" verdict for a
// declined speaker. Runs against a real in-memory SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver, same technique as
// test/reminders-sql-batch.test.ts, so the SQL EXISTS predicate is exercised
// for real rather than hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import {
  listOutstandingForEvent,
  listRemindableContactIds,
  previewRemindNow,
  remindNow,
  sendDueRemindersForEvent,
} from "../src/server/repo/tasks/reminders";
import { MANUAL_DEDUPE_WINDOW_MS, MAX_REMINDER_BATCH } from "../src/domain/reminders";
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
const PAST_DUE = NOW_MS - 10 * 24 * 60 * 60 * 1000; // 10 days ago, well within the overdue tail

function insertEvent(sqlite: DatabaseSync) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, 'DevFlow Conf', 'devflow', '2020-01-01', '2099-01-02', 'UTC', 'DFC', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, NOW_MS, NOW_MS);
}

function insertTask(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, description, due_date, required, created_at, updated_at)
       values (?, ?, 'onboarding', 'Submit bio', null, ?, 1, ?, ?)`,
    )
    .run(id, EVENT_ID, PAST_DUE, NOW_MS, NOW_MS);
}

function insertContact(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
       values (?, ?, 'First', ?, ?, ?, ?)`,
    )
    .run(id, ORG_ID, id, `${id}@example.com`, NOW_MS, NOW_MS);
}

function insertAssignment(sqlite: DatabaseSync, id: string, taskId: string, contactId: string) {
  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
       values (?, ?, ?, 'pending', null, ?, ?)`,
    )
    .run(id, taskId, contactId, NOW_MS, NOW_MS);
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

describe("DEC-829 (wave-59 amendment): declined speakers are never chased", () => {
  it("a contact whose ONLY participation is 'declined' on an accepted submission does not appear in listOutstandingForEvent or listRemindableContactIds", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);
    insertTask(sqlite, "task-1");
    insertContact(sqlite, "contact-declined");
    insertAssignment(sqlite, "assign-1", "task-1", "contact-declined");
    insertSubmission(sqlite, "submission-1", "accepted");
    insertParticipant(sqlite, "participant-1", "submission-1", "contact-declined", "declined");

    const outstanding = await listOutstandingForEvent(db, EVENT_ID);
    expect(outstanding).toEqual([]);

    const chosen = await listRemindableContactIds(db, EVENT_ID, {
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });
    expect(chosen.contactIds).toEqual([]);
  });

  it("is absent from previewRemindNow's drafts and receives zero email_log rows from remindNow", async () => {
    const previewHarness = makeTestDb();
    const sendHarness = makeTestDb();
    for (const { sqlite } of [previewHarness, sendHarness]) {
      insertEvent(sqlite);
      insertTask(sqlite, "task-1");
      insertContact(sqlite, "contact-declined");
      insertAssignment(sqlite, "assign-1", "task-1", "contact-declined");
      insertSubmission(sqlite, "submission-1", "accepted");
      insertParticipant(sqlite, "participant-1", "submission-1", "contact-declined", "declined");
    }
    const { mailer, sendCalls } = fakeMailer();

    const preview = await previewRemindNow(previewHarness.db, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);
    expect(preview.drafts).toEqual([]);

    const sent = await remindNow(sendHarness.db, mailer, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);
    expect(sent.sent).toBe(0);
    expect(sendCalls).toEqual([]);
  });

  it("is not chased by the cron path (sendDueRemindersForEvent) either", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);
    insertTask(sqlite, "task-1");
    insertContact(sqlite, "contact-declined");
    insertAssignment(sqlite, "assign-1", "task-1", "contact-declined");
    insertSubmission(sqlite, "submission-1", "accepted");
    insertParticipant(sqlite, "participant-1", "submission-1", "contact-declined", "declined");
    const { mailer, sendCalls } = fakeMailer();

    const sentCount = await sendDueRemindersForEvent(db, mailer, EVENT_ID, NOW, new InMemoryKV(), ORIGIN);
    expect(sentCount).toBe(0);
    expect(sendCalls).toEqual([]);
  });

  it("a contact active on ANY accepted submission of the event is still chased, even after declining a different one", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);
    insertTask(sqlite, "task-1");
    insertContact(sqlite, "contact-mixed");
    insertAssignment(sqlite, "assign-1", "task-1", "contact-mixed");
    insertSubmission(sqlite, "submission-declined", "accepted");
    insertParticipant(sqlite, "participant-declined", "submission-declined", "contact-mixed", "declined");
    insertSubmission(sqlite, "submission-active", "accepted");
    insertParticipant(sqlite, "participant-active", "submission-active", "contact-mixed", "accepted");

    const outstanding = await listOutstandingForEvent(db, EVENT_ID);
    expect(outstanding.map((r) => r.contactId)).toEqual(["contact-mixed"]);

    const chosen = await listRemindableContactIds(db, EVENT_ID, {
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });
    expect(chosen.contactIds).toEqual(["contact-mixed"]);
  });

  it("an 'invited'-only contact (never accepted the invite) is likewise not chased", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite);
    insertTask(sqlite, "task-1");
    insertContact(sqlite, "contact-invited");
    insertAssignment(sqlite, "assign-1", "task-1", "contact-invited");
    insertSubmission(sqlite, "submission-1", "accepted");
    insertParticipant(sqlite, "participant-1", "submission-1", "contact-invited", "invited");

    const outstanding = await listOutstandingForEvent(db, EVENT_ID);
    expect(outstanding).toEqual([]);

    const chosen = await listRemindableContactIds(db, EVENT_ID, {
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });
    expect(chosen.contactIds).toEqual([]);
  });
});
