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
import { insertFile } from "../src/server/repo/files-versions";
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
