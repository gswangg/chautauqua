// DEC-238 (wave-134 amendment): the FOURTH and last send path -- speaker
// task reminders -- writes the email_log rows its skipped count promises.
// listRemindableContactIds now returns a skippedContactIds ROSTER (not a
// bare count), and remindNow writes one status:'skipped' email_log row per
// skipped contact through the SAME single insert owner (d1EmailLogWriter)
// the real send uses, minting no claim token for a skipped recipient.
// previewRemindNow stays a pure read and must write nothing.
//
// Same real in-memory SQLite harness as test/reminders-sql-batch.test.ts /
// test/reminders-declined-not-chased.test.ts (node:sqlite + drizzle-orm's
// sqlite-proxy driver) so the GROUP BY/HAVING roster query and the insert
// are both exercised for real.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { listRemindableContactIds, previewRemindNow, remindNow } from "../src/server/repo/tasks/reminders";
import { MANUAL_DEDUPE_WINDOW_MS, MAX_REMINDER_BATCH } from "../src/domain/reminders";
import { PREVIEW_CLAIM_TOKEN } from "../src/domain/compose";
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
  headshot_file_id text,
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
  updated_at integer,
  scope text NOT NULL DEFAULT 'person',
  accepted_types_json text,
  max_size_mb integer,
  max_files integer
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
  scope_key text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'direct',
  detached_at integer,
  due_date integer,
  required integer,
  reopened_until integer
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
  updated_at integer,
  origin text NOT NULL DEFAULT 'cfp'
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
  updated_at integer,
  invitation_message text,
  reply_by integer,
  invited_by_user_id text,
  decline_note text,
  invitation_token_hash text
);
create table email_log (
  id text primary key,
  event_id text,
  template_id text,
  contact_id text,
  batch_id text,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  ics_text text,
  ics_filename text,
  provider text,
  status text,
  sent_at integer,
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

class CountingKV extends InMemoryKV {
  puts = 0;
  async put(key: string, value: string): Promise<void> {
    this.puts += 1;
    await super.put(key, value);
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
const MINUTE = 60 * 1000;

/** Two speakers, one pending task each. `contact-recent` was reminded
 * MANUAL_DEDUPE_WINDOW_MS ago plus a small margin outside it, `contact-
 * skipped` was reminded well inside the window (10 minutes ago) so exactly
 * one contact is dedupe-skipped by this call. */
function seedTwoContacts(sqlite: DatabaseSync) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, 'DevFlow Conf', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, NOW_MS, NOW_MS);
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, description, due_date, required, created_at, updated_at)
       values ('task-1', ?, 'onboarding', 'Submit bio', null, null, 1, ?, ?)`,
    )
    .run(EVENT_ID, NOW_MS, NOW_MS);

  const contacts = [
    { id: "contact-eligible", lastRemindedAt: null as number | null },
    { id: "contact-skipped", lastRemindedAt: NOW_MS - 10 * MINUTE },
  ];
  for (const c of contacts) {
    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
         values (?, ?, 'First', 'Last', ?, ?, ?)`,
      )
      .run(c.id, ORG_ID, `${c.id}@example.com`, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values (?, ?, 1, 'Talk', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run(`submission-${c.id}`, EVENT_ID, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
         values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
      )
      .run(`participant-${c.id}`, `submission-${c.id}`, c.id, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
         values (?, 'task-1', ?, 'pending', ?, ?, ?)`,
      )
      .run(`assign-${c.id}`, c.id, c.lastRemindedAt, NOW_MS, NOW_MS);
  }
}

function readEmailLogRows(sqlite: DatabaseSync): {
  eventId: string;
  contactId: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  provider: string;
  status: string;
}[] {
  const stmt = sqlite.prepare(
    `select event_id as eventId, contact_id as contactId, to_email as toEmail, subject, body_text as bodyText,
            body_html as bodyHtml, provider, status
     from email_log`,
  );
  stmt.setReturnArrays(false);
  return stmt.all() as never;
}

describe("DEC-238 (wave-134 amendment): reminders.ts writes a comms-history row per skipped contact", () => {
  it("listRemindableContactIds returns a skippedContactIds roster whose length equals the skipped count", async () => {
    const { db, sqlite } = makeTestDb();
    seedTwoContacts(sqlite);

    const chosen = await listRemindableContactIds(db, EVENT_ID, {
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });

    expect(chosen.skippedContactIds).toEqual(["contact-skipped"]);
    expect(chosen.skipped).toBe(chosen.skippedContactIds.length);
    expect(chosen.contactIds).toEqual(["contact-eligible"]);
  });

  it("remindNow writes exactly one status:'skipped' email_log row for the dedupe-skipped contact, and mints no claim token", async () => {
    const { db, sqlite } = makeTestDb();
    seedTwoContacts(sqlite);
    const { mailer, sendCalls } = fakeMailer();
    const kv = new CountingKV();

    const result = await remindNow(db, mailer, EVENT_ID, undefined, NOW, kv, ORIGIN);

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(1);
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.to.email).toBe("contact-eligible@example.com");

    const rows = readEmailLogRows(sqlite);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.status).toBe("skipped");
    expect(row.contactId).toBe("contact-skipped");
    expect(row.toEmail).toBe("contact-skipped@example.com");
    expect(row.eventId).toBe(EVENT_ID);
    expect(row.provider).toBe("none");
    expect(row.bodyHtml).toBe("");
    expect(row.subject).toContain("DevFlow Conf");
    expect(row.bodyText).toContain("Submit bio");

    // No claim token minted for the skipped recipient (DEC-397): its portal
    // link resolves to the fixed preview placeholder, never a real minted
    // token, even though the real send (to contact-eligible, also
    // userless) mints one -- createClaimToken writes the token record plus
    // its supersede index (2 puts), and that's ALL the KV activity this
    // call produces.
    expect(row.bodyText).toContain(`/claim/${PREVIEW_CLAIM_TOKEN}`);
    expect(kv.puts).toBe(2);
  });

  it("previewRemindNow writes no email_log rows even though one contact is skipped", async () => {
    const { db, sqlite } = makeTestDb();
    seedTwoContacts(sqlite);
    const kv = new InMemoryKV();

    const preview = await previewRemindNow(db, EVENT_ID, undefined, NOW, kv, ORIGIN);

    expect(preview.skipped).toBe(1);
    expect(preview.drafts).toHaveLength(1);
    expect(readEmailLogRows(sqlite)).toEqual([]);
  });

  it("an early return (zero chosen contactIds, everyone dedupe-skipped) still writes the skipped rows", async () => {
    const { db, sqlite } = makeTestDb();
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values (?, ?, 'DevFlow Conf', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
      )
      .run(EVENT_ID, ORG_ID, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, description, due_date, required, created_at, updated_at)
         values ('task-1', ?, 'onboarding', 'Submit bio', null, null, 1, ?, ?)`,
      )
      .run(EVENT_ID, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
         values ('contact-only', ?, 'First', 'Last', 'contact-only@example.com', ?, ?)`,
      )
      .run(ORG_ID, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values ('submission-1', ?, 1, 'Talk', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run(EVENT_ID, NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
         values ('participant-1', 'submission-1', 'contact-only', 'speaker', 0, 1, 'accepted', ?, ?)`,
      )
      .run(NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
         values ('assign-1', 'task-1', 'contact-only', 'pending', ?, ?, ?)`,
      )
      .run(NOW_MS - 10 * MINUTE, NOW_MS, NOW_MS);

    const { mailer, sendCalls } = fakeMailer();
    const result = await remindNow(db, mailer, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sendCalls).toEqual([]);

    const rows = readEmailLogRows(sqlite);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("skipped");
    expect(rows[0]?.contactId).toBe("contact-only");
  });
});
