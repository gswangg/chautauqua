// DEC-725 amendment (wave 30-c): a submission's `updated_at` must also cover
// the DENORMALISED strings src/sync/airtable.ts:303-304 pushes into the
// Speakers/Tracks cells -- contact.firstName/lastName and track.name -- not
// just the participant/submission_track composition covered by
// test/submission-touch-on-write.test.ts. Renaming a contact or a track
// changes what those cells should say without touching participant/
// submission_track at all, so every writer of a rename must ALSO stamp its
// dependent submissions. Runs the real repo functions against a real
// (in-memory) SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy
// driver (same technique as test/submission-touch-on-write.test.ts), so the
// actual UPDATE statements touchSubmissionsForContacts/
// touchSubmissionsForTracks issue are exercised, not hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { patchContact } from "../src/server/repo/contacts/crud";
import { applyImportRows } from "../src/server/repo/contacts/import";
import { updateTrack } from "../src/server/repo/events";
import { runAirtableSync, type AirtableSyncEnv } from "../src/sync/airtable";
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

function insertContact(sqlite: DatabaseSync, id: string, ts: number) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, id, "Test", `${id}@x.com`, ts, ts);
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

describe("submission.updated_at covers denormalised contact/track names (DEC-725 amendment)", () => {
  it("renaming a contact (organizer PATCH path) bumps every submission they participate in, and no others", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertSubmission(sqlite, "sub-2", T0);
    insertSubmission(sqlite, "sub-untouched", T0);
    insertContact(sqlite, "c1", T0);
    insertContact(sqlite, "c-other", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    insertParticipant(sqlite, "p2", "sub-2", "c1", T0);
    insertParticipant(sqlite, "p3", "sub-untouched", "c-other", T0);
    const before1 = submissionUpdatedAt(sqlite, "sub-1");
    const before2 = submissionUpdatedAt(sqlite, "sub-2");
    const beforeUntouched = submissionUpdatedAt(sqlite, "sub-untouched");

    await patchContact(db, "c1", { firstName: "Renamed" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before1);
    expect(submissionUpdatedAt(sqlite, "sub-2")).toBeGreaterThan(before2);
    expect(submissionUpdatedAt(sqlite, "sub-untouched")).toBe(beforeUntouched);
  });

  it("a bulk CSV rename (applyImportRows) bumps all affected submissions in one pass", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertSubmission(sqlite, "sub-2", T0);
    insertContact(sqlite, "c1", T0);
    insertContact(sqlite, "c2", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);
    insertParticipant(sqlite, "p2", "sub-2", "c2", T0);
    const before1 = submissionUpdatedAt(sqlite, "sub-1");
    const before2 = submissionUpdatedAt(sqlite, "sub-2");

    // resolveImportUpsert reads CAMEL-case keys off `parsed` (the CSV header
    // mapper has already normalised first_name -> firstName by this point).
    // Passing snake_case here would leave the patch empty, so nothing would
    // actually be renamed and this test would assert nothing.
    await applyImportRows(db, ORG_A, [
      { line: 1, parsed: { email: "c1@x.com", firstName: "RenamedOne", lastName: "Test" } },
      { line: 2, parsed: { email: "c2@x.com", firstName: "RenamedTwo", lastName: "Test" } },
    ]);

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before1);
    expect(submissionUpdatedAt(sqlite, "sub-2")).toBeGreaterThan(before2);
  });

  it("renaming a track (updateTrack) bumps every submission assigned to it", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertSubmission(sqlite, "sub-2", T0);
    insertSubmission(sqlite, "sub-other-track", T0);
    insertTrack(sqlite, "trk-1", "Track One", T0);
    insertTrack(sqlite, "trk-2", "Track Two", T0);
    insertSubmissionTrack(sqlite, "sub-1", "trk-1", T0);
    insertSubmissionTrack(sqlite, "sub-2", "trk-1", T0);
    insertSubmissionTrack(sqlite, "sub-other-track", "trk-2", T0);
    const before1 = submissionUpdatedAt(sqlite, "sub-1");
    const before2 = submissionUpdatedAt(sqlite, "sub-2");
    const beforeOther = submissionUpdatedAt(sqlite, "sub-other-track");

    await updateTrack(db, "trk-1", "event-1", { name: "Track One Renamed" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBeGreaterThan(before1);
    expect(submissionUpdatedAt(sqlite, "sub-2")).toBeGreaterThan(before2);
    expect(submissionUpdatedAt(sqlite, "sub-other-track")).toBe(beforeOther);
  });

  it("changing only a track's color (not name) does NOT bump dependent submissions", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertTrack(sqlite, "trk-1", "Track One", T0);
    insertSubmissionTrack(sqlite, "sub-1", "trk-1", T0);
    const before = submissionUpdatedAt(sqlite, "sub-1");

    await updateTrack(db, "trk-1", "event-1", { color: "#ff0000" });

    expect(submissionUpdatedAt(sqlite, "sub-1")).toBe(before);
  });

  it("a renamed contact's submission IS re-selected by the next incremental airtable tick", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertSubmission(sqlite, "sub-1", T0);
    insertContact(sqlite, "c1", T0);
    insertParticipant(sqlite, "p1", "sub-1", "c1", T0);

    const kv = (() => {
      const store = new Map<string, string>();
      return {
        store,
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: string) => {
          store.set(key, value);
        },
      };
    })();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const fakeFetch = (async () => ({ ok: true, text: async () => "" }) as Response) as typeof fetch;
    const noSleep = async () => {};

    // First tick: full push, sets the watermark.
    await runAirtableSync(env, db, fakeFetch, new Date(T0 + 1_000), noSleep);
    expect(kv.store.has(`airtable:watermark:${ORG_A}`)).toBe(true);

    // Rename the contact through the real repo write path -- this is the
    // ONLY change; participant/submission_track rows are untouched.
    await patchContact(db, "c1", { lastName: "Renamed" });

    const patch: Array<{ table: string; body: unknown }> = [];
    const collectingFetch = (async (url: string, init: RequestInit) => {
      const table = decodeURIComponent(String(url).split("/").pop() ?? "");
      patch.push({ table, body: JSON.parse(String(init.body)) });
      return { ok: true, text: async () => "" } as Response;
    }) as typeof fetch;

    const r = await runAirtableSync(env, db, collectingFetch, new Date(T0 + 2_000), noSleep);
    expect(r).toEqual({ contacts: 1, submissions: 1 });

    const submissionsPatch = patch.find((p) => p.table === "Submissions")!.body as {
      records: Array<{ fields: { ChautauquaId: string; Speakers: string } }>;
    };
    const pushed = submissionsPatch.records.find((rec) => rec.fields.ChautauquaId === "sub-1")!;
    expect(pushed.fields.Speakers).toBe("c1 Renamed");
  });
});
