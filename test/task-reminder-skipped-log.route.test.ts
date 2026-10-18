// DEC-238 (wave-133 amendment): the FOURTH send path. remindNow's dedupe-
// skipped contacts now get one `status: "skipped"` email_log row each,
// mirroring src/routes/comms/send.ts's already-landed fix. Runs the real
// repo functions against a real in-memory SQLite engine via node:sqlite +
// drizzle-orm's sqlite-proxy driver -- same technique as
// test/reminders-sql-batch.test.ts -- so the real d1EmailLogWriter insert
// and the real GROUP BY/HAVING SQL twin are both exercised for real, not a
// hand-simulated fake.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import {
  listOutstandingForEvent,
  listRemindableContactIds,
  remindNow,
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

// Counts .put() calls so a test can assert zero KV writes happened (DEC-397:
// mintClaimTokens=false must never mint, i.e. never write a claim token to
// KV -- the strongest available proxy for "no token was minted" without
// reaching into auth/claim's internals).
class CountingKV implements KVStore {
  putCalls = 0;
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.putCalls += 1;
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
const MINUTE = 60 * 1000;

function seedFixture(sqlite: DatabaseSync, opts: { skippedLastRemindedAt: number | null }) {
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
    { id: "contact-eligible", lastRemindedAt: null },
    { id: "contact-skipped", lastRemindedAt: opts.skippedLastRemindedAt },
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

describe("remindNow writes an email_log row for every dedupe-skipped contact (DEC-238 wave-133 amendment)", () => {
  it("(a)+(b) exactly one skipped email_log row is written, and the returned `skipped` count equals rows written", async () => {
    const { db, sqlite } = makeTestDb();
    // Reminded 10 minutes ago -- inside MANUAL_DEDUPE_WINDOW_MS, so
    // remindNow's own listRemindableContactIds call skips this contact.
    seedFixture(sqlite, { skippedLastRemindedAt: NOW_MS - 10 * MINUTE });
    const { mailer, sendCalls } = fakeMailer();
    const kv = new CountingKV();

    const result = await remindNow(db, mailer, EVENT_ID, undefined, NOW, kv, ORIGIN);

    expect(result.sent).toBe(1);
    expect(sendCalls.map((c) => c.to.email)).toEqual(["contact-eligible@example.com"]);
    expect(result.skipped).toBe(1);

    const skippedRows = await db.select().from(schema.emailLog).where(eq(schema.emailLog.status, "skipped"));
    expect(skippedRows).toHaveLength(result.skipped);
    const row = skippedRows[0]!;
    expect(row.eventId).toBe(EVENT_ID);
    expect(row.contactId).toBe("contact-skipped");
    expect(row.toEmail).toBe("contact-skipped@example.com");
    expect(row.provider).toBe("none");
    expect(row.status).toBe("skipped");
    expect(row.bodyHtml).toBe("");
    expect(row.sentAt.getTime()).toBe(NOW_MS);

    const sentRows = await db.select().from(schema.emailLog).where(eq(schema.emailLog.status, "sent"));
    // Nothing in reminders.ts writes a 'sent' email_log row (the real
    // mailer would, via DevSinkMailer/EmailBindingMailer -- mocked out here
    // as fakeMailer) -- this just fences the skipped-row assertion against
    // accidentally double-counting a sent row too.
    expect(sentRows).toHaveLength(0);

    // batchId shared with the real send: the fan-out's own send call never
    // reaches d1EmailLogWriter in this test (fakeMailer bypasses it), but
    // the skipped row must still carry a non-empty batchId so the comms
    // history can group it.
    expect(typeof row.batchId).toBe("string");
    expect(row.batchId).not.toBe("");
  });

  it("(c) no claim token is minted for a skipped contact", async () => {
    const { db, sqlite } = makeTestDb();
    // Only the skipped contact this time -- nobody else is eligible, so any
    // KV.put() observed below can only have come from resolving THIS
    // contact's portal link, isolating the claim -- (a)+(b)'s fixture also
    // sends a real eligible recipient, which legitimately mints its own
    // token and would make a global .put() count meaningless here.
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
         values ('contact-skipped', ?, 'First', 'Last', 'contact-skipped@example.com', ?, ?)`,
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
         values ('participant-1', 'submission-1', 'contact-skipped', 'speaker', 0, 1, 'accepted', ?, ?)`,
      )
      .run(NOW_MS, NOW_MS);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
         values ('assign-1', 'task-1', 'contact-skipped', 'pending', ?, ?, ?)`,
      )
      .run(NOW_MS - 10 * MINUTE, NOW_MS, NOW_MS);
    const { mailer, sendCalls } = fakeMailer();
    const kv = new CountingKV();

    const result = await remindNow(db, mailer, EVENT_ID, undefined, NOW, kv, ORIGIN);
    expect(result.sent).toBe(0);
    expect(sendCalls).toEqual([]);
    expect(result.skipped).toBe(1);

    // DEC-397: a mint is the last thing a send does. The skipped contact has
    // no account (no `user` row), so a minting resolver would have to call
    // KV.put to hand out a fresh claim token -- zero .put() calls is the
    // observable proof that never happened.
    expect(kv.putCalls).toBe(0);

    const skippedRows = await db.select().from(schema.emailLog).where(eq(schema.emailLog.status, "skipped"));
    const row = skippedRows[0]!;
    // The stored body carries the same non-minting placeholder link
    // previewRemindNow already uses for a userless contact -- never a real
    // per-recipient minted token.
    expect(String(row.bodyText)).toContain("example-one-time-link");
  });

  it("(d) the SQL fast path and the JS filtered-fallback twin return the same skipped roster for the same fixture", async () => {
    const { db, sqlite } = makeTestDb();
    seedFixture(sqlite, { skippedLastRemindedAt: NOW_MS - 10 * MINUTE });

    // Unfiltered call -> the SQL GROUP BY/HAVING fast path.
    const sqlPath = await listRemindableContactIds(db, EVENT_ID, {
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });
    // A taskIds filter that matches every seeded assignment forces
    // listRemindableContactIdsFiltered (the JS chunked-fallback twin) —
    // same population, same predicate, different code path.
    const jsPath = await listRemindableContactIds(db, EVENT_ID, {
      taskIds: ["task-1"],
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });

    expect(sqlPath.skippedContactIds).toEqual(["contact-skipped"]);
    expect(jsPath.skippedContactIds).toEqual(sqlPath.skippedContactIds);
    expect(jsPath.skipped).toBe(sqlPath.skipped);
    expect(jsPath.contactIds).toEqual(sqlPath.contactIds);
    expect(jsPath.remaining).toBe(sqlPath.remaining);

    // Sanity: listOutstandingForEvent still sees both contacts (dedupe is
    // listRemindableContactIds' job, not listOutstandingForEvent's).
    const outstanding = await listOutstandingForEvent(db, EVENT_ID);
    expect(new Set(outstanding.map((r) => r.contactId))).toEqual(new Set(["contact-eligible", "contact-skipped"]));
  });

  it("an event with EVERY contact dedupe-skipped still writes a skipped row for each, even though nothing sends", async () => {
    const { db, sqlite } = makeTestDb();
    // Both contacts reminded recently -- nobody is eligible this call.
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
    for (const id of ["contact-a", "contact-b"]) {
      sqlite
        .prepare(
          `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
           values (?, ?, 'First', 'Last', ?, ?, ?)`,
        )
        .run(id, ORG_ID, `${id}@example.com`, NOW_MS, NOW_MS);
      sqlite
        .prepare(
          `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
           values (?, ?, 1, 'Talk', 'accepted', 'approved', 0, ?, ?)`,
        )
        .run(`submission-${id}`, EVENT_ID, NOW_MS, NOW_MS);
      sqlite
        .prepare(
          `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
           values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
        )
        .run(`participant-${id}`, `submission-${id}`, id, NOW_MS, NOW_MS);
      sqlite
        .prepare(
          `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
           values (?, 'task-1', ?, 'pending', ?, ?, ?)`,
        )
        .run(`assign-${id}`, id, NOW_MS - 10 * MINUTE, NOW_MS, NOW_MS);
    }
    const { mailer, sendCalls } = fakeMailer();
    const kv = new CountingKV();

    const result = await remindNow(db, mailer, EVENT_ID, undefined, NOW, kv, ORIGIN);

    expect(result.sent).toBe(0);
    expect(sendCalls).toEqual([]);
    expect(result.skipped).toBe(2);

    const skippedRows = await db.select().from(schema.emailLog).where(eq(schema.emailLog.status, "skipped"));
    expect(skippedRows).toHaveLength(2);
    expect(new Set(skippedRows.map((r) => r.contactId)).size).toBe(2);
  });
});
