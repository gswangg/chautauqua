// Files repo — per-submission reads + uploader-name resolution (DEC-601,
// DEC-965). Split out of files-versions.ts (contention decomposition) — no
// behavior change, files-versions.ts re-exports everything below for
// existing callers.

import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";
import { ApiError } from "../http";
import { DEC_461, DEC_965 } from "../../decisions";

void DEC_965;
void DEC_461;

/** DEC-461 w78: listSubmissionFiles selected every file row for a
 * submission with no ceiling, while src/routes/files.ts JS-pages the fully
 * materialised array -- the same shape every sibling JS-paged list in this
 * tree already refuses loudly over (MAX_FILE_LIBRARY_SCAN,
 * MAX_PLAN_SUBMISSION_SCAN, MAX_CONTACT_DIRECTORY_SCAN, MAX_AGENDA_SCAN,
 * MAX_REVIEWER_SCOPE_ROWS). 1000, not 20000 like those siblings: this reads
 * ONE submission's own version history, which is inherently small (a
 * handful of deliverable kinds x a bounded number of re-uploads), never the
 * whole org/event surface those other ceilings guard -- and a ceiling at or
 * above MAX_FILE_LIBRARY_SCAN could never fire before the library guard
 * does (DEC-829 w74 sibling-guard-ordering precedent: the narrower cap must
 * sit below the broader one it's nested inside, or it's decoration). */
export const MAX_SUBMISSION_FILE_SCAN = 1000;

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
    .orderBy(desc(schema.file.createdAt), asc(schema.file.id))
    .limit(MAX_SUBMISSION_FILE_SCAN + 1);

  if (rows.length > MAX_SUBMISSION_FILE_SCAN) {
    throw new ApiError(
      "invalid",
      `This submission would scan more than ${MAX_SUBMISSION_FILE_SCAN} file versions -- narrow the version history first`,
    );
  }

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
