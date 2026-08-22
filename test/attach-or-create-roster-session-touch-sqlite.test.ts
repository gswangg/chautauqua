// DEC-725 (wave-22 amendment): insertActiveParticipants' in-code exemption
// premise was FALSE. It claimed its one caller (pushContactsToEvent) always
// calls it in the same request that just createSubmission'd submissionId, so
// there was never a stale stamp to correct. But attachOrCreateRosterSession
// (src/server/repo/contacts/push.ts) is a SECOND caller — when a roster-add
// title exactly matches an existing session, it attaches the contact to
// that PRE-EXISTING submission, exactly the case the premise excluded.
// Consequence: under DEC-725's watermark (`gt(schema.submission.updatedAt,
// mark)`), a roster add joining an existing session never re-selected that
// submission, so it never reached the customer's Airtable Speakers cell and
// never resurfaced on overview.ts's `desc(submission.updatedAt)` worklist.
//
// This pins the WRITE half against a real (in-memory) SQLite engine via
// node:sqlite + drizzle's sqlite-proxy driver — same technique as
// test/sessionboard-participant-touch-sqlite.test.ts and
// test/contacts-import-merge-keeps-email.test.ts — because a hand-rolled
// fake Db never proves the real `UPDATE submission SET updated_at = ...`
// statement lands.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { attachOrCreateRosterSession } from "../src/server/repo/contacts/push";
import type { Db } from "../src/server/context";

const DDL = `
create table event (
  id text primary key,
  org_id text not null,
  name text not null,
  slug text not null,
  start_date text not null,
  end_date text not null,
  location text,
  timezone text not null,
  record_prefix text not null default 'SES',
  branding_json text,
  created_at integer,
  updated_at integer
);
create table contact (
  id text primary key,
  org_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
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
  event_id text not null,
  form_id text,
  seq integer not null,
  title text not null,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text not null default 'pending',
  content_status text not null default 'pending',
  accepted_at integer,
  ics_sequence integer not null default 0,
  external_ref text,
  created_at integer,
  updated_at integer not null
);
create table participant (
  id text primary key,
  submission_id text not null,
  contact_id text not null,
  role text not null default 'speaker',
  "order" integer not null default 0,
  visible integer not null default 1,
  invite_status text not null default 'none',
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer
);
create unique index participant_submission_id_contact_id_idx on participant (submission_id, contact_id);
create table form (
  id text primary key,
  event_id text not null,
  title text not null,
  description text,
  is_default integer not null default 0,
  open_date integer,
  close_date integer,
  tracks_json text,
  created_at integer,
  updated_at integer,
  unique (event_id, title)
);
create table form_field (
  id text primary key,
  form_id text not null,
  section text not null,
  kind text not null,
  label text not null,
  help_text text,
  required integer not null default 0,
  position integer not null default 0,
  options_json text,
  rule_json text,
  locked integer not null default 0,
  role text,
  created_at integer,
  updated_at integer
);
create table task (
  id text primary key,
  event_id text not null,
  kind text not null,
  title text not null,
  description text,
  due_date integer,
  required integer not null default 0,
  form_id text,
  deliverable_kind text,
  instructions text,
  audience text not null default 'everyone',
  created_at integer,
  updated_at integer,
  unique (event_id, title)
);
create table task_assignment (
  id text primary key,
  task_id text not null,
  contact_id text not null,
  status text not null default 'pending',
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

const T0 = 1_700_000_000_000;
const ORG_ID = "org-a";
const EVENT_ID = "event-1";

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

function seedEvent(sqlite: DatabaseSync): void {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
       values (?, ?, 'Widgetcon', 'widgetcon', '2026-06-01', '2026-06-02', 'UTC', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, T0, T0);
}

function seedContact(sqlite: DatabaseSync, id: string, email: string): void {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
       values (?, ?, 'Speaker', 'Name', ?, ?, ?)`,
    )
    .run(id, ORG_ID, email, T0, T0);
}

function seedSubmission(sqlite: DatabaseSync, id: string, title: string, updatedAt: number): void {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, created_at, updated_at)
       values (?, ?, 1, ?, 'accepted', ?, ?)`,
    )
    .run(id, EVENT_ID, title, T0, updatedAt);
}

function readSubmissionUpdatedAt(sqlite: DatabaseSync, id: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(id) as { updated_at: number } | undefined;
  if (!row) throw new Error(`submission ${id} vanished`);
  return row.updated_at;
}

describe("DEC-725 (wave-22 amendment): attachOrCreateRosterSession stamps the submission it attaches to", () => {
  it("matched-title path: attaching to a PRE-EXISTING submission moves its updated_at forward", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite);
    seedContact(sqlite, "contact-existing", "existing@example.com");
    seedContact(sqlite, "contact-new", "new@example.com");
    seedSubmission(sqlite, "sub-existing", "Panel: Widgets at Scale", T0);

    const before = readSubmissionUpdatedAt(sqlite, "sub-existing");
    expect(before).toBe(T0);

    const submissionId = await attachOrCreateRosterSession(
      db,
      EVENT_ID,
      ORG_ID,
      { id: "contact-new", email: "new@example.com", firstName: "Speaker", lastName: "Name", title: null, company: null },
      "Panel: Widgets at Scale",
    );

    // References the existing submission -- no duplicate minted.
    expect(submissionId).toBe("sub-existing");
    expect(readSubmissionUpdatedAt(sqlite, "sub-existing")).toBeGreaterThan(before);

    const participantRow = sqlite
      .prepare(`select contact_id, visible, invite_status from participant where submission_id = ? and contact_id = ?`)
      .get("sub-existing", "contact-new") as { contact_id: string; visible: number; invite_status: string } | undefined;
    expect(participantRow).toBeDefined();
    expect(participantRow!.visible).toBe(1);
    expect(participantRow!.invite_status).toBe("none");
  });

  it("mint path: an unmatched title creates a fresh submission (not the touch of an existing one)", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite);
    seedContact(sqlite, "contact-fresh", "fresh@example.com");

    const submissionId = await attachOrCreateRosterSession(
      db,
      EVENT_ID,
      ORG_ID,
      { id: "contact-fresh", email: "fresh@example.com", firstName: "Speaker", lastName: "Name", title: null, company: null },
      "A Brand New Talk",
    );

    const row = sqlite
      .prepare(`select id, title, status from submission where id = ?`)
      .get(submissionId) as { id: string; title: string; status: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.title).toBe("A Brand New Talk");
    expect(row!.status).toBe("accepted");

    const participantRow = sqlite
      .prepare(`select contact_id from participant where submission_id = ? and contact_id = ?`)
      .get(submissionId, "contact-fresh") as { contact_id: string } | undefined;
    expect(participantRow).toBeDefined();
  });
});
