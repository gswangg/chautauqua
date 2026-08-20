// Eval regression (MINOR, speaker-management -- filed in ALL FIVE eval runs):
// "a portal-uploaded headshot renders organizer-side only as an avatar and a
// bare Download; the speaker record's FILES table omits it entirely (no
// filename, uploader, timestamp) while task-upload files show metadata."
//
// Root cause: getSpeakerDetail projected `contact.headshotFileId` as a bare id
// and joined NO file row for it, even though setContactHeadshot writes a real
// schema.file row with filename/sizeBytes/uploadedByContactId/createdAt and
// files-library-list.ts already reads exactly those columns for the admin
// Files library. DEC-930 (amendment, wave 115) adds `headshotFile` to the
// payload and `uploadedAt`/`uploaderName` to every SpeakerDetailFile.
//
// Pinned against a real (in-memory) SQLite engine via node:sqlite + drizzle's
// sqlite-proxy driver -- the same technique as
// test/portal-invite-mints-invited.test.ts -- because test/speaker-detail.
// test.ts's table-double fakeDb ignores WHERE entirely and therefore cannot
// prove the two things that matter here: that the read is scoped to
// kind='headshot', and that it resolves the CONTACT'S OWN current headshot
// rather than whichever file row happens to come first.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { getSpeakerDetail } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key, org_id text, first_name text, last_name text, email text,
  phone text, company text, title text, bio text, notes text,
  headshot_url text, headshot_file_id text, social_links_json text,
  external_ref text, custom_fields_json text, created_at integer, updated_at integer
);
create table user (
  id text primary key, org_id text, contact_id text, email text, role text,
  created_at integer, updated_at integer
);
create table event (
  id text primary key, org_id text, name text, slug text, record_prefix text,
  timezone text, start_date text, end_date text, created_at integer, updated_at integer
);
create table submission (
  id text primary key, event_id text, seq integer, title text, status text,
  content_status text, created_at integer, updated_at integer
);
create table participant (
  id text primary key, submission_id text, contact_id text, role text,
  "order" integer, visible integer, invite_status text not null default 'none',
  title_at_time text, org_at_time text, name_at_time text,
  created_at integer, updated_at integer
);
create table schedule_slot (
  id text primary key, event_id text, submission_id text, room_id text,
  day text, start_min integer, end_min integer, created_at integer, updated_at integer
);
create table room (
  id text primary key, event_id text, name text, capacity integer,
  created_at integer, updated_at integer
);
create table task (
  id text primary key, event_id text, title text, description text, kind text,
  required integer, due_date integer, form_id text, is_default integer,
  created_at integer, updated_at integer
);
create table task_assignment (
  id text primary key, task_id text, contact_id text, status text,
  completed_at integer, file_id text, response_json text, last_reminded_at integer,
  created_at integer, updated_at integer
);
create table file (
  id text primary key, submission_id text, kind text, filename text, r2_key text,
  size_bytes integer, content_type text, previous_file_id text, version_no integer,
  uploaded_by_contact_id text, task_assignment_id text,
  created_at integer, updated_at integer
);
`;

const T0 = 1_700_000_000_000;
const HEADSHOT_AT = Date.UTC(2026, 3, 8, 14, 5);
const SLIDES_AT = Date.UTC(2026, 3, 9, 10, 0);
const ORG = "org-a";
const EVENT_ID = "evt-1";
const CONTACT_ID = "ct-ada";

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
      return { rows: stmt.all(...params) as unknown[] };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

/** One event, one roster contact with an accepted session, one completed
 * file_request task carrying an upload, and (optionally) a current headshot
 * plus a superseded one that nothing references any more. */
function seed(sqlite: DatabaseSync, opts: { headshot: boolean; headshotUploader?: string | null }): void {
  sqlite.exec(`
    insert into event (id, org_id, name, slug, record_prefix, timezone, start_date, end_date, created_at, updated_at)
      values ('${EVENT_ID}', '${ORG}', 'DevFlow', 'devflow', 'SES', 'UTC', '2026-05-11', '2026-05-14', ${T0}, ${T0});
    insert into submission (id, event_id, seq, title, status, content_status, created_at, updated_at)
      values ('sub-1', '${EVENT_ID}', 14, 'Taming CI', 'accepted', 'approved', ${T0}, ${T0});
    insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
      values ('p-1', 'sub-1', '${CONTACT_ID}', 'speaker', 0, 1, 'accepted', ${T0}, ${T0});
    insert into task (id, event_id, title, description, kind, required, due_date, is_default, created_at, updated_at)
      values ('task-1', '${EVENT_ID}', 'Final slides', null, 'file_request', 1, null, 0, ${T0}, ${T0});
    insert into task_assignment (id, task_id, contact_id, status, completed_at, file_id, created_at, updated_at)
      values ('as-1', 'task-1', '${CONTACT_ID}', 'complete', ${T0}, 'file-slides', ${T0}, ${T0});
    insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
      values ('file-slides', 'sub-1', 'deliverable', 'taming-ci.pdf', 'k/slides', 2048, 'application/pdf', 1, '${CONTACT_ID}', 'as-1', ${SLIDES_AT}, ${SLIDES_AT});
  `);

  const uploader = opts.headshotUploader === undefined ? `'${CONTACT_ID}'` : opts.headshotUploader === null ? "null" : `'${opts.headshotUploader}'`;
  if (opts.headshot) {
    sqlite.exec(`
      insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, version_no, uploaded_by_contact_id, created_at, updated_at)
        values ('file-hs-old', null, 'headshot', 'ada-2024.png', 'k/hs-old', 40000, 'image/png', 1, '${CONTACT_ID}', ${T0}, ${T0}),
               ('file-hs-now', null, 'headshot', 'ada-lovelace.jpg', 'k/hs-now', 51200, 'image/jpeg', 1, ${uploader}, ${HEADSHOT_AT}, ${HEADSHOT_AT});
      insert into contact (id, org_id, first_name, last_name, email, company, title, headshot_url, headshot_file_id, created_at, updated_at)
        values ('${CONTACT_ID}', '${ORG}', 'Ada', 'Lovelace', 'ada@example.com', 'Analytical Engines', 'Engineer', '/headshots/file-hs-now', 'file-hs-now', ${T0}, ${T0});
    `);
  } else {
    sqlite.exec(`
      insert into contact (id, org_id, first_name, last_name, email, company, title, created_at, updated_at)
        values ('${CONTACT_ID}', '${ORG}', 'Ada', 'Lovelace', 'ada@example.com', 'Analytical Engines', 'Engineer', ${T0}, ${T0});
    `);
  }
}

describe("DEC-930 (amendment, wave 115): the speaker record lists the headshot as a file object", () => {
  it("projects the CURRENT headshot with filename, size, uploader and timestamp — never the superseded row", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, { headshot: true });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail).not.toBeNull();
    expect(detail!.headshotFile).toEqual({
      id: "file-hs-now",
      filename: "ada-lovelace.jpg",
      sizeBytes: 51200,
      // No version history is invented: setContactHeadshot never sets
      // previousFileId, so this is the stored number and nothing more.
      versionNo: 1,
      uploadedAt: HEADSHOT_AT,
      uploaderName: "Ada Lovelace",
    });
    // The superseded headshot row still exists in storage and is NOT listed.
    expect(detail!.headshotFile!.id).not.toBe("file-hs-old");
    expect(detail!.contact.headshotFileId).toBe("file-hs-now");
  });

  it("gives the task upload the same uploader/timestamp facts, so the headshot is listed like any file row", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, { headshot: true });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    const taskFile = detail!.tasks[0]!.file;
    expect(taskFile).toEqual({
      id: "file-slides",
      filename: "taming-ci.pdf",
      sizeBytes: 2048,
      versionNo: 1,
      uploadedAt: SLIDES_AT,
      uploaderName: "Ada Lovelace",
    });
  });

  it("resolves an uploader who is NOT the speaker through the one chunked contact lookup", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, { headshot: true, headshotUploader: "ct-organizer" });
    sqlite.exec(`
      insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
        values ('ct-organizer', '${ORG}', 'Grace', 'Hopper', 'grace@example.com', ${T0}, ${T0});
    `);

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail!.headshotFile!.uploaderName).toBe("Grace Hopper");
  });

  it("falls back to the owning speaker's own name when the headshot row records no uploader", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, { headshot: true, headshotUploader: null });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    // A headshot's owner IS this speaker, so an unattributed row still reads
    // truthfully as theirs -- the same rule files-library-list.ts applies.
    expect(detail!.headshotFile!.uploaderName).toBe("Ada Lovelace");
  });

  it("reads no file row at all for a contact with no headshot", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, { headshot: false });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail!.headshotFile).toBeNull();
    expect(detail!.contact.headshotFileId).toBeNull();
  });
});
