// DEC-979 (wave-43 amendment): deleteContact must leave ZERO dangling
// contact references. Before this fix, deleteContact deleted this contact's
// pipeline_activity/pipeline_entry/task_assignment/duplicate-dismissal rows
// and the contact row itself, but never touched email_log.contact_id,
// file.uploaded_by_contact_id or file_comment.author_contact_id -- all three
// are members of CONTACT_FK_TABLES (src/server/repo/contacts/query.ts) that
// mergeContacts explicitly repoints (merge.ts) precisely because they are
// contact FKs that must be maintained. There are no DB-level FK constraints
// (D1 PRIMITIVES), so nothing else catches it, and J5's per-recipient send
// history would keep pointing at an unresolvable id.
//
// This file DERIVES its population from CONTACT_FK_TABLES rather than
// hand-listing it (DEC-099, A UNIVERSAL NEEDS A POPULATION), so adding an
// eighth contact-referencing table without classifying it here fails loudly
// -- mirroring the schema-walk tripwire idiom in
// test/contacts-merge-integrity.test.ts (named by
// src/server/repo/contacts/query.ts:127-134 as the merge-side tripwire).
//
// Runs the real deleteContact against a real (in-memory) SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver (same technique as
// test/contacts-delete.test.ts), so the real set-based UPDATE statements are
// exercised, not hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { CONTACT_FK_TABLES } from "../src/server/repo/contacts/query";
import { deleteContact } from "../src/server/repo/contacts/crud";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";

// REFUSED-BEFORE: the DELETE route refuses (409) on these refs before
// deleteContact is ever reached -- covered by
// test/contact-delete-refusal-rows.test.ts, not exercised again here.
const REFUSED_BEFORE = new Set(["user", "participant"]);

// CASCADE-DELETED: JOIN rows, not documents -- deleteContact deletes these
// outright (pipeline_entry's pipeline_activity feed cascades with it),
// covered by test/contacts-delete.test.ts's DEC-979 cascade case.
const CASCADE_DELETED = new Set(["task_assignment", "pipeline_entry"]);

// NULLED: durable audit/provenance rows that must survive the contact's
// deletion -- this is what this file exercises directly.
const NULLED = new Set(["email_log", "file", "file_comment"]);

describe("CONTACT_FK_TABLES classification tripwire (DEC-979)", () => {
  it("every member of CONTACT_FK_TABLES is accounted for by exactly one class", () => {
    const allTables = (CONTACT_FK_TABLES as readonly string[]).slice().sort();
    const classified = [...REFUSED_BEFORE, ...CASCADE_DELETED, ...NULLED].sort();
    expect(
      classified,
      "every table in CONTACT_FK_TABLES must be classified as exactly one of " +
        "REFUSED-BEFORE, CASCADE-DELETED, or NULLED -- a new contact-referencing " +
        "table added to CONTACT_FK_TABLES without updating this test is unclassified",
    ).toEqual(allTables);

    // No table appears in more than one class.
    const classes = [REFUSED_BEFORE, CASCADE_DELETED, NULLED];
    for (const table of allTables) {
      const memberships = classes.filter((set) => set.has(table)).length;
      expect(memberships, `${table} must belong to exactly one class`).toBe(1);
    }
  });
});

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
create table contact_duplicate_dismissal (
  id text primary key,
  org_id text,
  contact_id_a text,
  contact_id_b text,
  created_at integer,
  unique (org_id, contact_id_a, contact_id_b)
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
create table file_comment (
  id text primary key,
  file_id text,
  author_contact_id text,
  author_user_id text,
  body text,
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

const NOW = 1_700_000_000_000;
const ORG_A = "org-a";

function insertContact(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, "Priya", "Raman", `${id}@example.com`, NOW, NOW);
}

describe("deleteContact NULLs (never deletes) email_log/file/file_comment rows (DEC-979)", () => {
  it("an email_log row for the deleted contact survives with contact_id NULL; a different contact's row is untouched", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    insertContact(sqlite, "contact-other");

    const deletedLogId = newId();
    const otherLogId = newId();
    sqlite
      .prepare(
        `insert into email_log (id, event_id, contact_id, to_email, subject, body_text, provider, status, sent_at, created_at)
         values (?, 'event-1', 'contact-1', 'priya@example.com', 'Hi', 'Body', 'dev', 'sent', ?, ?)`,
      )
      .run(deletedLogId, NOW, NOW);
    sqlite
      .prepare(
        `insert into email_log (id, event_id, contact_id, to_email, subject, body_text, provider, status, sent_at, created_at)
         values (?, 'event-1', 'contact-other', 'other@example.com', 'Hi', 'Body', 'dev', 'sent', ?, ?)`,
      )
      .run(otherLogId, NOW, NOW);

    await deleteContact(db, "contact-1");

    const deletedLogRows = sqlite.prepare(`select id, contact_id from email_log where id = ?`).all(deletedLogId) as {
      id: string;
      contact_id: string | null;
    }[];
    expect(deletedLogRows).toHaveLength(1);
    expect(deletedLogRows[0]!.contact_id).toBeNull();

    const otherLogRows = sqlite.prepare(`select id, contact_id from email_log where id = ?`).all(otherLogId) as {
      id: string;
      contact_id: string | null;
    }[];
    expect(otherLogRows).toHaveLength(1);
    expect(otherLogRows[0]!.contact_id).toBe("contact-other");

    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(0);
  });

  it("a file uploaded by the deleted contact survives with uploaded_by_contact_id NULL; a different contact's upload is untouched", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    insertContact(sqlite, "contact-other");

    const deletedFileId = newId();
    const otherFileId = newId();
    sqlite
      .prepare(
        `insert into file (id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, created_at, updated_at)
         values (?, 'presentation', 'slides.pdf', 'r2/slides.pdf', 100, 'application/pdf', 'contact-1', ?, ?)`,
      )
      .run(deletedFileId, NOW, NOW);
    sqlite
      .prepare(
        `insert into file (id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, created_at, updated_at)
         values (?, 'presentation', 'other.pdf', 'r2/other.pdf', 100, 'application/pdf', 'contact-other', ?, ?)`,
      )
      .run(otherFileId, NOW, NOW);

    await deleteContact(db, "contact-1");

    const deletedFileRows = sqlite
      .prepare(`select id, uploaded_by_contact_id from file where id = ?`)
      .all(deletedFileId) as { id: string; uploaded_by_contact_id: string | null }[];
    expect(deletedFileRows).toHaveLength(1);
    expect(deletedFileRows[0]!.uploaded_by_contact_id).toBeNull();

    const otherFileRows = sqlite
      .prepare(`select id, uploaded_by_contact_id from file where id = ?`)
      .all(otherFileId) as { id: string; uploaded_by_contact_id: string | null }[];
    expect(otherFileRows).toHaveLength(1);
    expect(otherFileRows[0]!.uploaded_by_contact_id).toBe("contact-other");
  });

  it("a file_comment authored by the deleted contact survives with author_contact_id NULL; a different contact's comment is untouched", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-1");
    insertContact(sqlite, "contact-other");

    const deletedCommentId = newId();
    const otherCommentId = newId();
    sqlite
      .prepare(
        `insert into file_comment (id, file_id, author_contact_id, body, created_at, updated_at)
         values (?, 'file-1', 'contact-1', 'looks good', ?, ?)`,
      )
      .run(deletedCommentId, NOW, NOW);
    sqlite
      .prepare(
        `insert into file_comment (id, file_id, author_contact_id, body, created_at, updated_at)
         values (?, 'file-1', 'contact-other', 'thanks', ?, ?)`,
      )
      .run(otherCommentId, NOW, NOW);

    await deleteContact(db, "contact-1");

    const deletedCommentRows = sqlite
      .prepare(`select id, author_contact_id from file_comment where id = ?`)
      .all(deletedCommentId) as { id: string; author_contact_id: string | null }[];
    expect(deletedCommentRows).toHaveLength(1);
    expect(deletedCommentRows[0]!.author_contact_id).toBeNull();

    const otherCommentRows = sqlite
      .prepare(`select id, author_contact_id from file_comment where id = ?`)
      .all(otherCommentId) as { id: string; author_contact_id: string | null }[];
    expect(otherCommentRows).toHaveLength(1);
    expect(otherCommentRows[0]!.author_contact_id).toBe("contact-other");
  });
});
