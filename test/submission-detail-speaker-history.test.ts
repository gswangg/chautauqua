// DEC-900: the submission-detail speaker rail's history line ("N
// submissions this year · spoke in YYYY") gets its server-side writer here
// -- app/src/pages/submissions/SubmissionDetailPage.tsx's reader
// (speakerHistoryLine, :168-175) already renders it; this exercises
// getSubmissionDetail's projection that now populates the two fields.
// Runs the real repo function against a real in-memory SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver, same technique as
// test/submission-touch-on-write.test.ts, so the actual batched query is
// exercised, not hand-simulated.

import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { getSubmissionDetail } from "../src/server/repo/submissions/detail";
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
  ics_sequence integer default 0,
  external_ref text,
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
  social_links_json text,
  notes text,
  custom_fields_json text,
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
  invite_status text not null default 'none',
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer
);
create table submission_track (
  submission_id text,
  track_id text,
  created_at integer
);
create table submission_answer (
  id text primary key,
  submission_id text,
  form_field_id text,
  value_json text,
  created_at integer,
  updated_at integer
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
create table room (
  id text primary key,
  event_id text,
  name text,
  capacity integer,
  position integer default 0,
  created_at integer,
  updated_at integer
);
create table schedule_slot (
  id text primary key,
  submission_id text,
  room_id text,
  day text,
  start_min integer,
  end_min integer,
  created_at integer,
  updated_at integer
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync; spy: ReturnType<typeof vi.fn> } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const spy = vi.fn();
  const db = drizzle(
    async (sqlText, params, method) => {
      spy(sqlText);
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
  return { db: db as unknown as Db, sqlite, spy };
}

const ORG_A = "org-a";
const T0 = 1_700_000_000_000;

function insertEvent(sqlite: DatabaseSync, id: string, startDate: string, orgId = ORG_A) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'America/New_York', 'SES', ?, ?)`,
    )
    .run(id, orgId, id, id, startDate, startDate, T0, T0);
}

function insertSubmission(sqlite: DatabaseSync, id: string, eventId: string, seq: number, status: string) {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    )
    .run(id, eventId, seq, `Talk ${id}`, status, T0, T0);
}

function insertContact(sqlite: DatabaseSync, id: string, orgId = ORG_A) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, orgId, id, "Speaker", `${id}@x.com`, T0, T0);
}

function insertParticipant(sqlite: DatabaseSync, id: string, submissionId: string, contactId: string) {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
    )
    .run(id, submissionId, contactId, T0, T0);
}

function insertScheduleSlot(sqlite: DatabaseSync, id: string, submissionId: string) {
  sqlite
    .prepare(
      `insert into schedule_slot (id, submission_id, room_id, day, start_min, end_min, created_at, updated_at)
       values (?, ?, null, '2024-05-01', 540, 600, ?, ?)`,
    )
    .run(id, submissionId, T0, T0);
}

describe("DEC-900: submission detail speaker-rail history line", () => {
  it("counts submissions this (owning-event) year and finds the last prior accepted+scheduled year", async () => {
    const { db, sqlite, spy } = makeTestDb();

    // The event this submission's detail is being read for -- year 2025.
    insertEvent(sqlite, "event-2025", "2025-03-01");
    // A second submission the same contact has in the SAME calendar year
    // (2025), different event.
    insertEvent(sqlite, "event-2025b", "2025-09-01");
    // A prior-year (2023) event where the contact spoke and was scheduled
    // and accepted -- this is the "last spoke" year.
    insertEvent(sqlite, "event-2023", "2023-06-01");
    // An even-earlier prior year (2021) accepted+scheduled submission --
    // must NOT win over 2023 (most recent prior year wins).
    insertEvent(sqlite, "event-2021", "2021-06-01");
    // A prior-year submission that was NOT accepted+scheduled -- must not
    // count as "spoke".
    insertEvent(sqlite, "event-2022", "2022-06-01");

    insertContact(sqlite, "contact-1");

    insertSubmission(sqlite, "sub-main", "event-2025", 1, "accepted");
    insertSubmission(sqlite, "sub-2025b", "event-2025b", 1, "pending");
    insertSubmission(sqlite, "sub-2023", "event-2023", 1, "accepted");
    insertSubmission(sqlite, "sub-2021", "event-2021", 1, "accepted");
    insertSubmission(sqlite, "sub-2022", "event-2022", 1, "pending"); // never accepted

    insertParticipant(sqlite, "p-main", "sub-main", "contact-1");
    insertParticipant(sqlite, "p-2025b", "sub-2025b", "contact-1");
    insertParticipant(sqlite, "p-2023", "sub-2023", "contact-1");
    insertParticipant(sqlite, "p-2021", "sub-2021", "contact-1");
    insertParticipant(sqlite, "p-2022", "sub-2022", "contact-1");

    insertScheduleSlot(sqlite, "slot-2023", "sub-2023");
    insertScheduleSlot(sqlite, "slot-2021", "sub-2021");
    // sub-2022 has no schedule slot AND is never accepted -- doubly disqualified.

    const detail = await getSubmissionDetail(db, "sub-main");
    expect(detail).not.toBeNull();
    const speaker = detail!.participants.find((p) => p.contactId === "contact-1")!;

    // sub-main + sub-2025b both fall in 2025 (this submission's owning
    // event year), sub-main included.
    expect(speaker.submissionsThisYear).toBe(2);
    // Most recent PRIOR year with an accepted+scheduled submission is 2023,
    // not 2021 (older) and not 2022 (never accepted/scheduled).
    expect(speaker.lastSpokeYear).toBe(2023);

    // ONE batched query for the whole history projection -- it's the only
    // query that computes the "case when ... schedule_slot" scheduled flag
    // used for lastSpokeYear (the fixed detail-row query also left-joins
    // schedule_slot, but for the unrelated `slot` field, not this CASE
    // expression) -- never one query per speaker.
    const historyQueries = spy.mock.calls.filter((call) => /case when/i.test(String(call[0])));
    expect(historyQueries.length).toBe(1);
  });

  it("leaves lastSpokeYear absent (not null, not 0) for a first-time speaker", async () => {
    const { db, sqlite } = makeTestDb();
    insertEvent(sqlite, "event-2025", "2025-03-01");
    insertContact(sqlite, "contact-fresh");
    insertSubmission(sqlite, "sub-main", "event-2025", 1, "accepted");
    insertParticipant(sqlite, "p-main", "sub-main", "contact-fresh");

    const detail = await getSubmissionDetail(db, "sub-main");
    const speaker = detail!.participants.find((p) => p.contactId === "contact-fresh")!;

    expect(speaker.submissionsThisYear).toBe(1);
    expect(speaker.lastSpokeYear).toBeUndefined();
    expect("lastSpokeYear" in speaker).toBe(false);
  });
});
