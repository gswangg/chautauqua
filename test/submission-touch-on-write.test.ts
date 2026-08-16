// DEC-725 amendment (wave 63): a submission's published shape is composed
// from `participant` and `submission_track`, so `submission.updated_at`
// must advance whenever either changes -- otherwise DEC-725's incremental
// airtable watermark never re-selects a submission whose speaker list or
// tracks changed, and (separately) src/server/repo/overview.ts's producer
// worklist ordering (desc(submission.updatedAt)) doesn't move it either.
// Runs the real repo functions against a real (in-memory) SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver (same technique as
// test/contacts-dismissal-cascade.test.ts), so the actual UPDATE statements
// touchSubmissions issues are exercised, not hand-simulated.

import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { setParticipantInviteStatus } from "../src/server/repo/participants";
import { setInviteStatus as portalSetInviteStatus } from "../src/server/repo/portal/invitations";
import { replaceSubmissionTracks } from "../src/server/repo/submit";
import { mergeContacts } from "../src/server/repo/contacts/merge";
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
  headshot_file_id text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table contact_duplicate_dismissal (
  id text primary key,
  org_id text,
  contact_id_a text,
  contact_id_b text,
  created_at integer,
  unique (org_id, contact_id_a, contact_id_b)
);
create table event (
  id text primary key,
  org_id text,
  record_prefix text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
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
  invite_status text not null default 'none',
  created_at integer,
  updated_at integer,
  unique (submission_id, contact_id)
);
create table submission_track (
  submission_id text,
  track_id text,
  created_at integer
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
create table pipeline_entry (
  id text primary key,
  org_id text,
  contact_id text,
  stage text,
  fit_score integer,
  rationale text,
  created_at integer,
  updated_at integer
);
create table pipeline_activity (
  id text primary key,
  entry_id text,
  kind text,
  body text,
  from_stage text,
  to_stage text,
  author_user_id text,
  author_name text,
  created_at integer
);
create table email_log (
  id text primary key,
  org_id text,
  event_id text,
  contact_id text,
  kind text,
  subject text,
  body_html text,
  to_email text,
  status text,
  sent_at integer,
  created_at integer
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
create table file (
  id text primary key,
  org_id text,
  event_id text,
  submission_id text,
  kind text,
  filename text,
  r2_key text,
  size integer,
  content_type text,
  uploaded_by_contact_id text,
  uploaded_by_user_id text,
  created_at integer
);
create table file_comment (
  id text primary key,
  file_id text,
  author_contact_id text,
  author_user_id text,
  body text,
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

const ORG_A = "org-a";
const T0 = 1_700_000_000_000;

function seedEventAndSubmission(sqlite: DatabaseSync, submissionId: string, ts: number) {
  sqlite.exec(`
    insert into event (id, org_id, record_prefix, created_at, updated_at)
      values ('event-1', '${ORG_A}', 'SES', ${ts}, ${ts});
    insert into submission (id, event_id, seq, title, status, created_at, updated_at)
      values ('${submissionId}', 'event-1', 1, 'Talk', 'accepted', ${ts}, ${ts});
  `);
}

function insertContact(sqlite: DatabaseSync, id: string, ts: number) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, id, "Test", `${id}@x.com`, ts, ts);
}

function insertParticipant(
  sqlite: DatabaseSync,
  id: string,
  submissionId: string,
  contactId: string,
  inviteStatus: string,
  ts: number,
) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    )
    .run(id, submissionId, contactId, inviteStatus, ts, ts);
}

function submissionUpdatedAt(sqlite: DatabaseSync, submissionId: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(submissionId) as {
    updated_at: number;
  };
  return row.updated_at;
}

describe("submission.updated_at covers its participant/submission_track composition (DEC-725 amendment)", () => {
  it("declining a co-presenter (organizer PATCH path) advances submission.updated_at", async () => {
    const { db, sqlite } = makeTestDb();
    seedEventAndSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", "invited", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await setParticipantInviteStatus(db, "p1", "declined", "sub-1");

    const after = submissionUpdatedAt(sqlite, "sub-1");
    expect(after).toBeGreaterThan(before);
  });

  it("declining one's own invitation (speaker portal path) advances submission.updated_at", async () => {
    const { db, sqlite } = makeTestDb();
    seedEventAndSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", "invited", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await portalSetInviteStatus(db, "p1", "c1", "declined", "sub-1");

    const after = submissionUpdatedAt(sqlite, "sub-1");
    expect(after).toBeGreaterThan(before);
  });

  it("removing a participant (contact merge dedupe delete) advances the affected submission's updated_at", async () => {
    const { db, sqlite } = makeTestDb();
    seedEventAndSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "contact-keep", T0);
    insertContact(sqlite, "contact-merge", T0);
    // Both contacts already participate on the same submission -- merge
    // dedupes mergeId's row away (deleting the participant row entirely),
    // which is exactly the "removing a participant" write path this stamp
    // must cover, since after the delete there is nothing left to derive
    // the submission id from.
    insertParticipant(sqlite, "p-keep", "sub-1", "contact-keep", "accepted", T0);
    insertParticipant(sqlite, "p-merge", "sub-1", "contact-merge", "accepted", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await mergeContacts(db, "contact-keep", ["contact-merge"]);

    const remaining = sqlite.prepare(`select id from participant where submission_id = 'sub-1'`).all();
    expect(remaining.length).toBe(1); // the dupe row was deleted, not repointed

    const after = submissionUpdatedAt(sqlite, "sub-1");
    expect(after).toBeGreaterThan(before);
  });

  it("changing a submission's tracks (replaceSubmissionTracks) advances submission.updated_at", async () => {
    const { db, sqlite } = makeTestDb();
    seedEventAndSubmission(sqlite, "sub-1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await replaceSubmissionTracks(db, "sub-1", ["track-a", "track-b"]);

    const after = submissionUpdatedAt(sqlite, "sub-1");
    expect(after).toBeGreaterThan(before);

    const rows = sqlite.prepare(`select track_id from submission_track where submission_id = 'sub-1'`).all() as {
      track_id: string;
    }[];
    expect(rows.map((r) => r.track_id).sort()).toEqual(["track-a", "track-b"]);
  });

  it("clearing a submission's tracks to empty still advances submission.updated_at", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(T0);
      const { db, sqlite } = makeTestDb();
      seedEventAndSubmission(sqlite, "sub-1", T0);
      await replaceSubmissionTracks(db, "sub-1", ["track-a"]);
      const before = submissionUpdatedAt(sqlite, "sub-1");

      vi.setSystemTime(T0 + 1000);
      await replaceSubmissionTracks(db, "sub-1", []);

      const after = submissionUpdatedAt(sqlite, "sub-1");
      expect(after).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
