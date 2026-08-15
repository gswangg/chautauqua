// DEC-725 amendment (wave 32): org-level renames (contact first/last name,
// track name) must stamp `submission.updated_at` on every submission that
// embeds the renamed string in its published Speakers/Tracks cells --
// otherwise src/sync/airtable.ts's incremental watermark (`gt(submission.
// updatedAt, mark)`) never re-selects the submission, and the customer's
// Airtable base keeps the OLD string forever. A same-string (no-op) write
// -- e.g. a notes-only contact patch, or a track color-only edit -- must
// NOT touch, since src/server/repo/overview.ts's producer worklist orders
// by desc(submission.updatedAt).
//
// Same real (in-memory) SQLite + drizzle sqlite-proxy technique as
// test/submission-touch-on-write.test.ts, so the actual UPDATE statements
// are exercised, not hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { patchContact } from "../src/server/repo/contacts/crud";
import { updateTrack } from "../src/server/repo/events";
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
create table track (
  id text primary key,
  event_id text,
  name text,
  color text,
  position integer,
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

function seedEvent(sqlite: DatabaseSync, ts: number) {
  sqlite.exec(`
    insert into event (id, org_id, record_prefix, created_at, updated_at)
      values ('event-1', '${ORG_A}', 'SES', ${ts}, ${ts});
  `);
}

function insertSubmission(sqlite: DatabaseSync, id: string, ts: number) {
  sqlite
    .prepare(`insert into submission (id, event_id, seq, title, status, created_at, updated_at) values (?, 'event-1', 1, 'Talk', 'accepted', ?, ?)`)
    .run(id, ts, ts);
}

function insertContact(sqlite: DatabaseSync, id: string, ts: number) {
  sqlite
    .prepare(`insert into contact (id, org_id, first_name, last_name, email, notes, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, ORG_A, "Ada", "Lovelace", `${id}@x.com`, "", ts, ts);
}

function insertParticipant(sqlite: DatabaseSync, id: string, submissionId: string, contactId: string, ts: number) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
    )
    .run(id, submissionId, contactId, ts, ts);
}

function insertTrack(sqlite: DatabaseSync, id: string, name: string, ts: number) {
  sqlite
    .prepare(`insert into track (id, event_id, name, color, position, created_at, updated_at) values (?, 'event-1', ?, null, 0, ?, ?)`)
    .run(id, name, ts, ts);
}

function insertSubmissionTrack(sqlite: DatabaseSync, submissionId: string, trackId: string, ts: number) {
  sqlite.prepare(`insert into submission_track (submission_id, track_id, created_at) values (?, ?, ?)`).run(submissionId, trackId, ts);
}

function submissionUpdatedAt(sqlite: DatabaseSync, submissionId: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(submissionId) as { updated_at: number };
  return row.updated_at;
}

describe("org-level renames stamp their dependent submissions (DEC-725 wave-32 amendment)", () => {
  it("renaming a contact (patchContact) bumps updated_at on every submission it participates in", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertSubmission(sqlite, "sub-2", T0);
    insertContact(sqlite, "c1", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    insertParticipant(sqlite, "p2", "sub-2", "c1", T0);
    const before1 = submissionUpdatedAt(sqlite, "sub-1");
    const before2 = submissionUpdatedAt(sqlite, "sub-2");

    await patchContact(db, "c1", { firstName: "Grace" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before1);
    expect(submissionUpdatedAt(sqlite, "sub-2")).toBeGreaterThan(before2);
  });

  it("a notes-only contact write (patchContact) bumps no submission", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await patchContact(db, "c1", { notes: "Prefers morning slots" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });

  it("a same-string patchContact firstName/lastName write bumps no submission", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await patchContact(db, "c1", { firstName: "Ada", lastName: "Lovelace" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });

  it("renaming a track (updateTrack) bumps every submission carrying it", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertSubmission(sqlite, "sub-2", T0);
    insertTrack(sqlite, "t1", "Frontend", T0);
    insertSubmissionTrack(sqlite, "sub-1", "t1", T0);
    insertSubmissionTrack(sqlite, "sub-2", "t1", T0);
    const before1 = submissionUpdatedAt(sqlite, "sub-1");
    const before2 = submissionUpdatedAt(sqlite, "sub-2");

    await updateTrack(db, "t1", "event-1", { name: "Platform Engineering" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before1);
    expect(submissionUpdatedAt(sqlite, "sub-2")).toBeGreaterThan(before2);
  });

  it("a color-only track edit (updateTrack) bumps no submission", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertTrack(sqlite, "t1", "Frontend", T0);
    insertSubmissionTrack(sqlite, "sub-1", "t1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await updateTrack(db, "t1", "event-1", { color: "#ff0000" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });
});
