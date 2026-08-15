// DEC-725 (wave-33 amendment): re-verifies that the dependent-submission
// stamp (touchSubmissionsForContacts/touchSubmissionsForTracks) is bounded
// to writes that ACTUALLY change the denormalised string
// src/sync/airtable.ts pushes into the Speakers/Tracks cells. A stamp fired
// on a no-op write is not a no-op — src/server/repo/overview.ts:284 orders
// the producer worklist desc(submission.updatedAt) with a small LIMIT, so a
// spurious bump evicts genuinely-awaiting items from Overview's first
// screen.
//
// This file re-verifies three writers already amended in prior waves
// (applyImportRows: 0e4dfb7c, updateTrack + updateContactProfile: wave-32),
// plus proves each still bumps on a GENUINE change. Reuses the real-SQL
// harness technique from test/submission-touch-on-rename.test.ts (node:sqlite
// + drizzle-orm sqlite-proxy) so the actual UPDATE statements are exercised.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { applyImportRows } from "../src/server/repo/contacts/import";
import { updateTrack } from "../src/server/repo/events";
import { updateContactProfile, type ProfileUpdateInput } from "../src/server/repo/profile";
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
  name text,
  contact_id text,
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
create table submission_track (
  submission_id text,
  track_id text,
  created_at integer
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
create table task (
  id text primary key,
  event_id text,
  title text,
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
    .prepare(
      `insert into submission (id, event_id, seq, title, status, created_at, updated_at)
       values (?, 'event-1', 1, 'Talk', 'accepted', ?, ?)`,
    )
    .run(id, ts, ts);
}

function insertContact(
  sqlite: DatabaseSync,
  id: string,
  ts: number,
  opts?: { firstName?: string; lastName?: string; bio?: string | null; email?: string },
) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, bio, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      ORG_A,
      opts?.firstName ?? id,
      opts?.lastName ?? "Test",
      opts?.email ?? `${id}@x.com`,
      opts?.bio ?? null,
      ts,
      ts,
    );
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
    .prepare(`insert into track (id, event_id, name, position, created_at, updated_at) values (?, 'event-1', ?, 0, ?, ?)`)
    .run(id, name, ts, ts);
}

function insertSubmissionTrack(sqlite: DatabaseSync, submissionId: string, trackId: string, ts: number) {
  sqlite
    .prepare(`insert into submission_track (submission_id, track_id, created_at) values (?, ?, ?)`)
    .run(submissionId, trackId, ts);
}

function submissionUpdatedAt(sqlite: DatabaseSync, submissionId: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(submissionId) as {
    updated_at: number;
  };
  return row.updated_at;
}

function baseProfileInput(overrides: Partial<ProfileUpdateInput> = {}): ProfileUpdateInput {
  return {
    firstName: "c1",
    lastName: "Test",
    title: null,
    company: null,
    bio: null,
    socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
    ...overrides,
  };
}

describe("submission.updated_at stamp is bounded to real changes (DEC-725 wave-33 amendment)", () => {
  it("a no-op re-import (same names) leaves dependent submissions byte-identical", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0, { firstName: "c1", lastName: "Test", email: "c1@x.com" });
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    // Re-upload the exact same row (same first/last name) — a real-world
    // re-import of an unchanged CSV. applyImportRows expects rows already
    // mapped to canonical camelCase field names (mapImportRow does that
    // mapping at the route layer) — NOT raw CSV snake_case headers.
    await applyImportRows(db, ORG_A, [{ line: 1, parsed: { email: "c1@x.com", firstName: "c1", lastName: "Test" } }]);

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });

  it("a genuine bulk-import rename still bumps dependent submissions", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0, { firstName: "c1", lastName: "Test", email: "c1@x.com" });
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await applyImportRows(db, ORG_A, [
      { line: 1, parsed: { email: "c1@x.com", firstName: "Renamed", lastName: "Test" } },
    ]);

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before);
  });

  it("a colour-only track PATCH does NOT bump dependent submissions", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertTrack(sqlite, "trk-1", "Track One", T0);
    insertSubmissionTrack(sqlite, "sub-1", "trk-1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    // Re-send the SAME unchanged name alongside a new colour — the guard
    // must compare against the pre-write name, not just check `!== undefined`.
    await updateTrack(db, "trk-1", "event-1", { name: "Track One", color: "#00ff00" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });

  it("a genuine track rename still bumps dependent submissions", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertTrack(sqlite, "trk-1", "Track One", T0);
    insertSubmissionTrack(sqlite, "sub-1", "trk-1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await updateTrack(db, "trk-1", "event-1", { name: "Track One Renamed" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before);
  });

  it("a bio-only portal profile save does NOT bump dependent submissions", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0, { firstName: "c1", lastName: "Test" });
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await updateContactProfile(db, "c1", baseProfileInput({ bio: "New bio text" }));

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });

  it("a genuine name change via the portal profile still bumps dependent submissions", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0, { firstName: "c1", lastName: "Test" });
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await updateContactProfile(db, "c1", baseProfileInput({ firstName: "Renamed" }));

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before);
  });
});
