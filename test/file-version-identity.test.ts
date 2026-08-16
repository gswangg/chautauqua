// DEC-818: a version number is an identity, not a position among the
// survivors. Deleting a middle file version must not renumber every later
// version -- including in the audit note the delete just wrote, and
// including the versionNumber tag already attached to comments on the
// survivor. Runs the real insertFile/deleteFileVersion/listFileComments
// against a real (in-memory) SQLite engine via node:sqlite + drizzle-orm's
// sqlite-proxy driver (same technique as test/onboarding-roster-set.test.ts),
// so the actual repo queries (not a hand-simulated row shape) are exercised.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { insertFile, deleteFileVersion } from "../src/server/repo/files-versions";
import { listFileComments, insertFileComment } from "../src/server/repo/files-comments";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  first_name text,
  last_name text
);
create table user (
  id text primary key,
  email text,
  -- DEC-757 (wave 72): batched author-name ladders fall back to this when
  -- there's no resolvable contact, so the in-memory mirror needs it.
  name text,
  role text,
  contact_id text
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
  -- migrations/0035_file_task_assignment.sql (DEC-248 amendment, wave 10):
  -- insertFile now writes this column, so the in-memory mirror needs it.
  task_assignment_id text,
  created_at integer,
  updated_at integer
);
create table file_comment (
  id text primary key,
  file_id text,
  author_user_id text,
  author_contact_id text,
  body text,
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

describe("file version identity survives a middle-version delete (DEC-818)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    sqlite
      .prepare(`insert into user (id, email, role, contact_id) values ('u1', 'organizer@example.com', 'organizer', null)`)
      .run();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("keeps v3's own version number 3, preserves comment version tags, and records 'Removed version 2' in the audit note", async () => {
    // Build a 3-version chain via the real insertFile write path.
    const v1 = await insertFile(db, {
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck-v1.pdf",
      r2Key: "sub/sub-1/v1.pdf",
      sizeBytes: 100,
      contentType: "application/pdf",
      previousFileId: null,
      uploadedByContactId: null,
    });
    const v2 = await insertFile(db, {
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck-v2.pdf",
      r2Key: "sub/sub-1/v2.pdf",
      sizeBytes: 200,
      contentType: "application/pdf",
      previousFileId: v1,
      uploadedByContactId: null,
    });
    const v3 = await insertFile(db, {
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck-v3.pdf",
      r2Key: "sub/sub-1/v3.pdf",
      sizeBytes: 300,
      contentType: "application/pdf",
      previousFileId: v2,
      uploadedByContactId: null,
    });

    // A comment left on v2 and a comment left on v3 before any deletion.
    await insertFileComment(db, { fileId: v2, body: "comment on v2", authorUserId: "u1", authorContactId: null });
    await insertFileComment(db, { fileId: v3, body: "comment on v3", authorUserId: "u1", authorContactId: null });

    const before = await listFileComments(db, v3);
    const beforeByBody = new Map(before.items.map((c) => [c.body, c.versionNumber]));
    expect(beforeByBody.get("comment on v2")).toBe(2);
    expect(beforeByBody.get("comment on v3")).toBe(3);

    // Delete v2 (the middle version) -- v3 must NOT be renumbered.
    await deleteFileVersion(db, { fileId: v2, deletedByUserId: "u1", deletedByContactId: null });

    const after = await listFileComments(db, v3);
    // v3's own comment (never re-homed) keeps its original version tag: 3,
    // NOT renumbered down to 2 to fill the gap left by v2's deletion -- the
    // exact bug DEC-818 closes (a chain-position-derived number would make
    // v3 "the new position 2" the instant v2 disappears).
    const byBody = new Map(after.items.map((c) => [c.body, c.versionNumber]));
    expect(byBody.get("comment on v3")).toBe(3);
    // v2's own comment is re-homed onto its surviving neighbour v3 (DEC-573)
    // and, having no version stamp of its own, now reads as whatever file it
    // currently lives on -- v3's own (unrenumbered) stored number.
    expect(byBody.get("comment on v2")).toBe(3);

    // The audit note the delete just wrote names the deleted row's OWN
    // stored version number, not a chain-position count.
    const auditNote = after.items.find((c) => c.body.startsWith("Removed version"));
    expect(auditNote?.body).toBe("Removed version 2 - deck-v2.pdf");
    expect(auditNote?.versionNumber).toBe(3); // re-homed onto the surviving v3

    // A further insert onto the (now 2-link) chain continues from v3's own
    // stored number, not from a renumbered chain length.
    const v4 = await insertFile(db, {
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck-v4.pdf",
      r2Key: "sub/sub-1/v4.pdf",
      sizeBytes: 400,
      contentType: "application/pdf",
      previousFileId: v3,
      uploadedByContactId: null,
    });
    const v4Rows = sqlite.prepare(`select version_no from file where id = ?`).all(v4);
    expect((v4Rows[0] as { version_no: number }).version_no).toBe(4);
  });
});
