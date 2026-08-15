// DEC-773 wave-31 amendment (option 3b), task w31-a: TIER-0 PERF fix for
// GET /api/v1/events/:eventId/files. The old headshot join predicate
// (`contact.headshot_url = '/headshots/' || file.id`) buried file.id inside
// a concatenation, so no planner could drive `file` by its primary key —
// a full nested-loop scan of `file` per outer row, run TWICE per page-1
// request (computeKindCounts + listEventDeliverableFiles). The fix moves
// the indexed column to stand alone: `file.id = substr(contact.headshot_url,
// 12) and substr(contact.headshot_url, 1, 11) = '/headshots/'`.
//
// (a) A source scan: the concatenated join predicate must never reappear in
// src/server/repo/files-library.ts.
// (b) Behavioural coverage over a REAL in-memory SQLite engine (same
// technique as test/cross-org-file-bytes-probe.test.ts — "no D1 test
// harness exists in this repo", and a real engine proves the rewritten
// predicate's actual SQL semantics, not just a JS mock's re-implementation
// of them): a contact whose headshot_url is NOT of the shape
// `/headshots/<id>` never matches (proving the prefix guard is load-bearing,
// not decorative), and a headshot file resolves to exactly one row.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { listEventDeliverableFiles, resolveLatestVersions } from "../src/server/repo/files-library";

describe("files-library.ts headshot join predicate (DEC-773 wave-31 amendment, option 3b)", () => {
  it("(a) never re-introduces the concatenated '/headshots/' || file.id join predicate", () => {
    const source = readFileSync(
      new URL("../src/server/repo/files-library.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("'/headshots/' ||");
    // The rewritten predicate stands the indexed column alone, driven by
    // substr() rather than a concatenation.
    expect(source).toContain("substr(${schema.contact.headshotUrl}, 12)");
  });
});

// ---------------------------------------------------------------------------
// Real in-memory SQLite engine — only the tables the headshot join touches
// (event/submission/participant/contact/file), same technique as
// test/cross-org-file-bytes-probe.test.ts.
// ---------------------------------------------------------------------------

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
  task_assignment_id text,
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
`;

function makeSqliteDb(): { db: Db; sqlite: DatabaseSync } {
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

const EVENT_ID = "event-1";
const SUB_ID = "sub-1";
const PARTICIPANT_ID = "participant-1";
const CONTACT_MATCH = "contact-match"; // headshot_url correctly shaped
const CONTACT_MISMATCH = "contact-mismatch"; // 11-char prefix but WRONG prefix text
const FILE_HEADSHOT = "file-headshot-1";
const FILE_DECOY = "file-decoy-1"; // id happens to be a suffix collision target

function seed(sqlite: DatabaseSync): void {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, location, timezone, record_prefix, branding_json, created_at, updated_at)
       values (?, 'org-1', 'Conf', 'conf', '2026-01-01', '2026-01-02', null, 'America/Los_Angeles', 'SES', null, 0, 0)`,
    )
    .run(EVENT_ID);

  sqlite
    .prepare(
      `insert into submission (id, event_id, form_id, seq, title, description, track_id, additional_track_ids_json, status, content_status, accepted_at, ics_sequence, external_ref, created_at, updated_at)
       values (?, ?, null, 1, 'A talk', null, null, null, 'accepted', 'approved', 0, 0, null, 0, 0)`,
    )
    .run(SUB_ID, EVENT_ID);

  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, null, 'headshot', 'headshot.jpg', 'r2/headshot', 20, 'image/jpeg', null, 1, null, null, 0, 0)`,
    )
    .run(FILE_HEADSHOT);

  // A decoy file whose id is exactly the 11-char string an attacker-shaped
  // headshot_url would need to land on if the prefix guard were missing —
  // proves the guard, not just the substr offset, is load-bearing.
  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, null, 'headshot', 'decoy.jpg', 'r2/decoy', 5, 'image/jpeg', null, 1, null, null, 0, 0)`,
    )
    .run(FILE_DECOY);

  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, phone, company, title, bio, headshot_url, social_links_json, notes, custom_fields_json, external_ref, created_at, updated_at)
       values (?, 'org-1', 'Match', 'Speaker', 'match@example.com', null, null, null, null, ?, null, null, null, null, 0, 0)`,
    )
    .run(CONTACT_MATCH, `/headshots/${FILE_HEADSHOT}`);

  // Same total length as a real headshot_url, and its trailing chars equal
  // FILE_DECOY's id, but the first 11 chars are NOT '/headshots/' — under
  // the old concatenated predicate this could never falsely match (string
  // equality is exact), and the prefix guard must keep that true under the
  // rewritten substr() predicate too.
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, phone, company, title, bio, headshot_url, social_links_json, notes, custom_fields_json, external_ref, created_at, updated_at)
       values (?, 'org-1', 'Mismatch', 'Speaker', 'mismatch@example.com', null, null, null, null, ?, null, null, null, null, 0, 0)`,
    )
    .run(CONTACT_MISMATCH, `XXXXXXXXXXX${FILE_DECOY}`);

  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, title_at_time, org_at_time, name_at_time, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, 'accepted', null, null, null, 0, 0)`,
    )
    .run(PARTICIPANT_ID, SUB_ID, CONTACT_MATCH);

  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, title_at_time, org_at_time, name_at_time, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, 'accepted', null, null, null, 0, 0)`,
    )
    .run("participant-2", SUB_ID, CONTACT_MISMATCH);
}

describe("files-library.ts headshot join predicate (b) behavioural coverage", () => {
  it("a headshot file resolves to exactly one row via the correctly-shaped headshot_url", async () => {
    const { db, sqlite } = makeSqliteDb();
    try {
      seed(sqlite);
      const page = await listEventDeliverableFiles(db, EVENT_ID, { page: 1, perPage: 50, kinds: ["headshot"], q: null });
      const rows = page.items.filter((i) => i.rootFileId === FILE_HEADSHOT);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.speakerName).toBe("Match Speaker");
    } finally {
      sqlite.close();
    }
  });

  it("a contact whose headshot_url is not '/headshots/<id>' never matches (proves the prefix guard is load-bearing)", async () => {
    const { db, sqlite } = makeSqliteDb();
    try {
      seed(sqlite);
      const page = await listEventDeliverableFiles(db, EVENT_ID, { page: 1, perPage: 50, kinds: ["headshot"], q: null });
      // Only the correctly-prefixed contact's headshot resolves — the
      // mismatched-prefix contact contributes no row even though its
      // headshot_url's suffix equals a real file id (FILE_DECOY).
      expect(page.items.map((i) => i.speakerName)).toEqual(["Match Speaker"]);
      expect(page.items.some((i) => i.rootFileId === FILE_DECOY)).toBe(false);

      const resolved = await resolveLatestVersions(db, EVENT_ID, [FILE_DECOY]).catch((e: unknown) => e);
      // FILE_DECOY was never uploaded through a real headshot/deliverable
      // path scoped to this event's accepted speakers, so it must 404
      // rather than silently resolve via the mismatched contact's URL.
      expect(resolved).toBeInstanceOf(Error);
    } finally {
      sqlite.close();
    }
  });
});
