// Files repo — per-submission reads + uploader-name resolution (DEC-601,
// DEC-965). Split out of files-versions.ts (contention decomposition) — no
// behavior change, files-versions.ts re-exports everything below for
// existing callers.

import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";
import { DEC_965 } from "../../decisions";

void DEC_965;

// ---------------------------------------------------------------------------
// DEC-601: a file version's uploader name, resolved server-side
// ---------------------------------------------------------------------------

/** ONE batched contact lookup for `contactIds` (deduped, chunked for D1's
 * bound-parameter ceiling) -- callers pass only the ids present on the page
 * being returned, never the whole table. A contact id with no matching row
 * is simply absent from the returned map (deleted contact); callers treat a
 * missing map entry the same as a null uploadedByContactId. */
export async function batchContactNames(db: Db, contactIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(contactIds)];
  const out = new Map<string, string>();
  for (const batch of chunkIds(uniqueIds)) {
    if (batch.length === 0) continue;
    const rows = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const c of rows) out.set(c.id, `${c.firstName} ${c.lastName}`.trim());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reads: deliverables grouped by kind, versions newest-first
// ---------------------------------------------------------------------------

export interface FileVersion {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  createdAt: number;
  /** DEC-965: the row's own stored version_no (DEC-818 identity) — carried
   * end-to-end instead of re-derived from chain position. */
  versionNo: number;
}

export type FilesByKind = Record<string, FileVersion[]>;

/** Every file on the submission, grouped by kind, newest-first within each
 * kind's version chain. */
export async function listSubmissionFiles(db: Db, submissionId: string): Promise<FilesByKind> {
  const rows = await db
    .select({
      id: schema.file.id,
      kind: schema.file.kind,
      filename: schema.file.filename,
      sizeBytes: schema.file.sizeBytes,
      contentType: schema.file.contentType,
      previousFileId: schema.file.previousFileId,
      uploadedByContactId: schema.file.uploadedByContactId,
      createdAt: schema.file.createdAt,
      versionNo: schema.file.versionNo,
    })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .orderBy(desc(schema.file.createdAt), asc(schema.file.id));

  const grouped: FilesByKind = {};
  for (const row of rows) {
    if (row.versionNo === null || row.versionNo === undefined) {
      throw new Error(`listSubmissionFiles: file ${row.id} has no stored version_no -- data corruption`);
    }
    const version: FileVersion = {
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      contentType: row.contentType,
      previousFileId: row.previousFileId,
      uploadedByContactId: row.uploadedByContactId,
      createdAt: row.createdAt.getTime(),
      versionNo: row.versionNo,
    };
    (grouped[row.kind] ??= []).push(version);
  }
  return grouped;
}
