// DEC-926/DEC-927 coverage (task w23-a):
//   - deleteFileVersion must re-home (never delete) a task_assignment row
//     linked to the deleted file: repoint fileId to the surviving link when
//     one exists, else reopen the assignment (status back to pending,
//     completedAt/completedBy/fileId cleared) when the deleted file was the
//     sole version in its chain.
//   - listFileChainVersions must return each row's own stored versionNo in
//     the same batch query, not a second per-row lookup.
// Runs the real insertFile/deleteFileVersion/listFileChainVersions against a
// real (in-memory) SQLite engine via node:sqlite + drizzle-orm's
// sqlite-proxy driver (same technique as test/file-version-identity.test.ts).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { insertFile, deleteFileVersion, listFileChainVersions } from "../src/server/repo/files-versions";
import { newId } from "../src/domain/ids";
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

function insertAssignment(sqlite: DatabaseSync, params: { fileId: string; status: string }) {
  const id = newId();
  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, completed_at, completed_by, file_id, created_at, updated_at)
       values (?, 'task-1', 'contact-1', ?, ?, ?, ?, 0, 0)`,
    )
    .run(id, params.status, params.status === "complete" ? 100 : null, params.status === "complete" ? "contact-1" : null, params.fileId);
  return id;
}

describe("deleteFileVersion re-homes task_assignment (DEC-926)", () => {
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

  it("reopens the assignment when the deleted file is the sole version in its chain", async () => {
    const v1 = await insertFile(db, {
      submissionId: null,
      kind: "handout",
      filename: "handout-v1.pdf",
      r2Key: "task/assignment-1/v1.pdf",
      sizeBytes: 100,
      contentType: "application/pdf",
      previousFileId: null,
      uploadedByContactId: null,
    });
    const assignmentId = insertAssignment(sqlite, { fileId: v1, status: "complete" });

    await deleteFileVersion(db, { fileId: v1, deletedByUserId: "u1", deletedByContactId: null });

    const rows = sqlite.prepare(`select status, completed_at, completed_by, file_id from task_assignment where id = ?`).all(assignmentId) as {
      status: string;
      completed_at: number | null;
      completed_by: string | null;
      file_id: string | null;
    }[];
    expect(rows).toHaveLength(1); // row still present, never deleted
    const row = rows[0]!;
    expect(row.status).toBe("pending");
    expect(row.completed_at).toBeNull();
    expect(row.completed_by).toBeNull();
    expect(row.file_id).toBeNull();
  });

  it("repoints assignment.fileId to the survivor when deleting the head of a 2-version chain", async () => {
    const v1 = await insertFile(db, {
      submissionId: null,
      kind: "handout",
      filename: "handout-v1.pdf",
      r2Key: "task/assignment-1/v1.pdf",
      sizeBytes: 100,
      contentType: "application/pdf",
      previousFileId: null,
      uploadedByContactId: null,
    });
    const v2 = await insertFile(db, {
      submissionId: null,
      kind: "handout",
      filename: "handout-v2.pdf",
      r2Key: "task/assignment-1/v2.pdf",
      sizeBytes: 200,
      contentType: "application/pdf",
      previousFileId: v1,
      uploadedByContactId: null,
    });
    // Assignment tracks the chain head (v2), per DEC-240.
    const assignmentId = insertAssignment(sqlite, { fileId: v2, status: "complete" });

    // Delete v2 (the head) -- v1 (the predecessor) is the surviving link.
    await deleteFileVersion(db, { fileId: v2, deletedByUserId: "u1", deletedByContactId: null });

    const rows = sqlite.prepare(`select status, file_id from task_assignment where id = ?`).all(assignmentId) as {
      status: string;
      file_id: string | null;
    }[];
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.file_id).toBe(v1);
    // Untouched: this wasn't a sole-version delete, so completion state
    // stays as-is (only fileId follows the chain).
    expect(row.status).toBe("complete");
  });
});

describe("listFileChainVersions returns versionNo (DEC-927)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("carries each row's own stored version_no in the same batch fetch", async () => {
    const v1 = await insertFile(db, {
      submissionId: null,
      kind: "handout",
      filename: "handout-v1.pdf",
      r2Key: "task/assignment-1/v1.pdf",
      sizeBytes: 100,
      contentType: "application/pdf",
      previousFileId: null,
      uploadedByContactId: null,
    });
    const v2 = await insertFile(db, {
      submissionId: null,
      kind: "handout",
      filename: "handout-v2.pdf",
      r2Key: "task/assignment-1/v2.pdf",
      sizeBytes: 200,
      contentType: "application/pdf",
      previousFileId: v1,
      uploadedByContactId: null,
    });

    const chain = await listFileChainVersions(db, v2);
    expect(chain.map((r) => ({ id: r.id, versionNo: r.versionNo }))).toEqual([
      { id: v1, versionNo: 1 },
      { id: v2, versionNo: 2 },
    ]);
  });
});
