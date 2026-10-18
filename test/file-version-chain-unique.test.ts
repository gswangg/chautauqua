// DEC-818 amendment (wave-47): closes the CONFIRMED-DEFECT filed by
// docs/verification-log/index/0235 claim 2 -- insertFile's read-then-write
// versionNo computation (src/server/repo/files-versions.ts) had no
// transaction and the only index on file.previous_file_id was a plain
// (non-unique) btree, so two concurrent re-uploads onto the same chain head
// could both mint version N. migrations/0043_file_version_chain_unique.sql
// adds a partial UNIQUE index on previous_file_id (WHERE NOT NULL) encoding
// the chain invariant directly: "at most one row may name a given
// predecessor." This test mirrors that constraint in the in-memory DDL (same
// technique as test/file-version-identity.test.ts) so the real insertFile
// write path is exercised against a real SQLite UNIQUE violation, not a
// hand-simulated one.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { insertFile, deleteFileVersion } from "../src/server/repo/files-versions";
import { ApiError } from "../src/server/http";
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
  task_assignment_id text,
  created_at integer,
  updated_at integer
);
create unique index file_previous_file_id_unique on file (previous_file_id) where previous_file_id is not null;
create table file_comment (
  id text primary key,
  file_id text not null,
  author_contact_id text,
  author_user_id text,
  body text not null,
  created_at integer,
  updated_at integer
);
create table task_assignment (
  id text primary key,
  task_id text,
  contact_id text,
  status text not null default 'pending',
  completed_at integer,
  completed_by text,
  response_json text,
  file_id text,
  last_reminded_at integer,
  created_at integer,
  updated_at integer,
  scope_key text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'direct',
  detached_at integer,
  due_date integer,
  required integer,
  reopened_until integer
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

describe("insertFile refuses a concurrent re-upload onto the same chain head (DEC-818 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("throws a conflict ApiError on the second insert instead of minting a second row at the same version", async () => {
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

    // First re-upload onto v1 succeeds.
    await insertFile(db, {
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck-v2-a.pdf",
      r2Key: "sub/sub-1/v2-a.pdf",
      sizeBytes: 200,
      contentType: "application/pdf",
      previousFileId: v1,
      uploadedByContactId: null,
    });

    // A second, concurrent re-upload racing against the same predecessor
    // (v1) must be refused, not silently minted as a second "version 2".
    await expect(
      insertFile(db, {
        submissionId: "sub-1",
        kind: "presentation",
        filename: "deck-v2-b.pdf",
        r2Key: "sub/sub-1/v2-b.pdf",
        sizeBytes: 250,
        contentType: "application/pdf",
        previousFileId: v1,
        uploadedByContactId: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" } satisfies Partial<ApiError>);

    const rows = sqlite.prepare("select id, previous_file_id, version_no from file where previous_file_id = ?").all(v1);
    expect(rows).toHaveLength(1);
  });

  it("still allows two independent chain roots (previousFileId=null) to coexist", async () => {
    await expect(
      insertFile(db, {
        submissionId: "sub-1",
        kind: "presentation",
        filename: "root-a.pdf",
        r2Key: "sub/sub-1/root-a.pdf",
        sizeBytes: 100,
        contentType: "application/pdf",
        previousFileId: null,
        uploadedByContactId: null,
      }),
    ).resolves.toBeTruthy();

    await expect(
      insertFile(db, {
        submissionId: "sub-1",
        kind: "presentation",
        filename: "root-b.pdf",
        r2Key: "sub/sub-1/root-b.pdf",
        sizeBytes: 100,
        contentType: "application/pdf",
        previousFileId: null,
        uploadedByContactId: null,
      }),
    ).resolves.toBeTruthy();
  });
});

// w10-hh: deleteFileVersion's successor repoint (files-versions-delete.ts)
// writes into the SAME partial UNIQUE index (file_previous_file_id_unique)
// this suite's DDL enforces above. For a 3+ version chain v1 -> v2 -> v3,
// deleting the MIDDLE version (v2) used to repoint v3.previousFileId = v1
// while v2 itself (previousFileId also v1) was still a live row, so the
// UPDATE hit the same UNIQUE violation `insertFile` is guarded against
// above -- a hard 500 on every organizer middle-version delete. This
// exercises deleteFileVersion against the real SQLite constraint (not a
// hand-simulated fake), the only way to actually reach the bug.
describe("deleteFileVersion on a middle-of-chain version (organizer-only path)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("repoints v3 onto v1 without hitting the partial UNIQUE index, and re-homes the comment + task_assignment onto the surviving link", async () => {
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

    sqlite
      .prepare(
        "insert into task_assignment (id, task_id, contact_id, status, completed_at, completed_by, file_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("asg-1", "task-1", "contact-1", "complete", 5000, "contact-1", v2, 1000, 1000);

    // (a) no throw
    await expect(
      deleteFileVersion(db, { fileId: v2, deletedByUserId: "organizer-1", deletedByContactId: null }),
    ).resolves.toBeUndefined();

    const remaining = sqlite.prepare("select id, previous_file_id from file order by id").all() as {
      id: string;
      previous_file_id: string | null;
    }[];

    // (c) v1 and v3 both survive, v2 is gone.
    expect(remaining.map((r) => r.id).sort()).toEqual([v1, v3].sort());

    // (b) v3.previousFileId === v1.id
    const v3Row = remaining.find((r) => r.id === v3)!;
    expect(v3Row.previous_file_id).toBe(v1);

    // (d) the 'Removed version N' comment lands on the surviving link (v3).
    const comment = sqlite
      .prepare("select file_id, body from file_comment where body like 'Removed version%'")
      .get() as { file_id: string; body: string } | undefined;
    expect(comment).toBeDefined();
    expect(comment!.body).toBe("Removed version 2 - deck-v2.pdf");
    expect(comment!.file_id).toBe(v3);

    // (e) the task_assignment that pointed at v2 now points at v3.
    const asg = sqlite.prepare("select file_id, status, completed_by from task_assignment where id = 'asg-1'").get() as {
      file_id: string;
      status: string;
      completed_by: string;
    };
    expect(asg.file_id).toBe(v3);
    expect(asg.status).toBe("complete");
    expect(asg.completed_by).toBe("contact-1");
  });
});
