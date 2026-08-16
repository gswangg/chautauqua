// Files repo — deleting a version: authz scope + the chain-relink/re-home
// write (DEC-713). Split out of files-versions.ts (contention decomposition)
// — no behavior change, files-versions.ts re-exports everything below for
// existing callers.

import { eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { FILE_KINDS } from "../../domain/files";
import { DEC_713 } from "../../decisions";
import { getFileVersionNumber } from "./files-versions-chain";

void DEC_713;

export interface FileDeleteScope {
  id: string;
  submissionId: string | null;
  eventId: string | null;
  orgId: string | null;
  filename: string;
  r2Key: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  contentStatus: string | null;
  /** submission status — feeds canEditSubmission (DEC-041 edit-lock). */
  status: string | null;
  /** DAY LABEL close date in epoch ms, or null when the submission has no
   * form — mirrors SubmissionScope.formCloseDate. */
  formCloseDate: number | null;
  /** owning event's IANA timezone — isFormClosed expands closeDate in this zone. */
  timezone: string | null;
  /** true when no other file's previous_file_id points at this one — i.e.
   * this is the newest link in its own version chain (DEC-713: a speaker may
   * only delete the LATEST version they uploaded). */
  isLatestInChain: boolean;
}

/** Loads everything the DEC-713 delete route needs to authz + act on a file
 * version: submission/org/contentStatus (for the speaker "own latest,
 * pending" rule), and whether this file is the chain head (no successor). */
export async function getFileDeleteScope(db: Db, fileId: string): Promise<FileDeleteScope | null> {
  const fileRows = await db
    .select({
      id: schema.file.id,
      kind: schema.file.kind,
      submissionId: schema.file.submissionId,
      filename: schema.file.filename,
      r2Key: schema.file.r2Key,
      previousFileId: schema.file.previousFileId,
      uploadedByContactId: schema.file.uploadedByContactId,
    })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow) return null;
  // DEC-713: version deletion's population is submission DELIVERABLES only
  // (FILE_KINDS: presentation/poster/handout/recording) — disjoint from
  // kind='attachment' (a CFP form-answer upload, id stored inline in
  // submission_answer.value_json, insertAttachmentFile in submit.ts) and
  // kind='resource'/'headshot'/task-linked uploads, mirroring
  // getResourceFileScope/getTaskFileScope's own disjoint-population guards.
  if (!(FILE_KINDS as readonly string[]).includes(fileRow.kind)) return null;

  let orgId: string | null = null;
  let eventId: string | null = null;
  let contentStatus: string | null = null;
  let status: string | null = null;
  let formCloseDate: number | null = null;
  let timezone: string | null = null;
  if (fileRow.submissionId) {
    const subRows = await db
      .select({
        eventId: schema.submission.eventId,
        orgId: schema.event.orgId,
        contentStatus: schema.submission.contentStatus,
        status: schema.submission.status,
        formCloseDate: schema.form.closeDate,
        timezone: schema.event.timezone,
      })
      .from(schema.submission)
      .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
      .leftJoin(schema.form, eq(schema.submission.formId, schema.form.id))
      .where(eq(schema.submission.id, fileRow.submissionId))
      .limit(1);
    const sub = subRows[0];
    if (sub) {
      orgId = sub.orgId;
      eventId = sub.eventId;
      contentStatus = sub.contentStatus;
      status = sub.status;
      formCloseDate = sub.formCloseDate ? sub.formCloseDate.getTime() : null;
      timezone = sub.timezone;
    }
  }

  // DEC-558: at most one row by construction — `file_previous_file_id_unique`
  // is a partial uniqueIndex on previousFileId (WHERE previousFileId IS NOT
  // NULL).
  const successorRows = await db
    .select({ id: schema.file.id })
    .from(schema.file)
    .where(eq(schema.file.previousFileId, fileId))
    .limit(1);

  return {
    id: fileRow.id,
    submissionId: fileRow.submissionId,
    eventId,
    orgId,
    filename: fileRow.filename,
    r2Key: fileRow.r2Key,
    previousFileId: fileRow.previousFileId,
    uploadedByContactId: fileRow.uploadedByContactId,
    contentStatus,
    status,
    formCloseDate,
    timezone,
    isLatestInChain: successorRows.length === 0,
  };
}

export interface DeleteFileVersionInput {
  fileId: string;
  deletedByUserId: string;
  deletedByContactId: string | null;
}

/** DEC-713 write: repoints the chain across the deleted row's gap in ONE
 * statement (a middle deletion must never fork the chain, DEC-244/573), then
 * re-homes the deleted row's comment thread onto the surviving neighbour —
 * the successor that takes over the vacated slot if one exists, else the
 * predecessor, else (a single-version chain) the comments are removed with
 * the row. Appends a system note ("Removed version N - <filename>") to the
 * surviving thread.
 *
 * DEC-926: also re-homes (never deletes) any task_assignment row pointing at
 * the deleted file id, set-based on file_id — when a surviving link exists
 * (successor or predecessor) the assignment's file_id follows it to that
 * surviving id; when this was the sole version in its chain, the assignment
 * is reopened instead (status back to 'pending', completed_at/completed_by/
 * file_id cleared) rather than left pointing at a row that no longer exists.
 * A task_assignment row is never deleted here — completion state must
 * survive its linked file's deletion.
 *
 * DEC-713 ordering (amended wave 50): the caller (the route) commits THIS
 * row-delete FIRST and only deletes the R2 object afterwards, logging and
 * swallowing a store.delete failure rather than rethrowing it — this
 * function never touches R2, so a throw here can't orphan an object, only
 * leave the row (and its bytes) still present. A committed row-delete must
 * never be reported as a failure just because the object cleanup failed. */
export async function deleteFileVersion(db: Db, input: DeleteFileVersionInput): Promise<void> {
  const { fileId } = input;
  const rows = await db
    .select({ id: schema.file.id, previousFileId: schema.file.previousFileId, filename: schema.file.filename })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`deleteFileVersion: file ${fileId} not found`);

  // DEC-818: the deleted row's OWN stored version number — the repoint
  // below is a pure re-link (nothing else ever writes version_no), so
  // deleting a middle version never renumbers the survivors, and this note
  // stays correct even after later versions are deleted in turn.
  const versionNumber = await getFileVersionNumber(db, fileId);

  const successorRows = await db
    .select({ id: schema.file.id })
    .from(schema.file)
    .where(eq(schema.file.previousFileId, fileId))
    .limit(1);
  const successor = successorRows[0] ?? null;

  let survivingId: string | null = null;
  if (successor) {
    survivingId = successor.id;
    // DEC-244/573: set-based repoint — every row chained off the deleted
    // link (in a linear chain, at most one) moves in ONE statement, so a
    // middle deletion can't fork the chain.
    await db.update(schema.file).set({ previousFileId: row.previousFileId }).where(eq(schema.file.previousFileId, fileId));
  } else if (row.previousFileId) {
    survivingId = row.previousFileId;
  }

  if (survivingId) {
    await db.update(schema.fileComment).set({ fileId: survivingId }).where(eq(schema.fileComment.fileId, fileId));
    const now = new Date();
    await db.insert(schema.fileComment).values({
      id: newId(),
      fileId: survivingId,
      authorUserId: input.deletedByUserId,
      authorContactId: input.deletedByContactId,
      body: `Removed version ${versionNumber} - ${row.filename}`,
      createdAt: now,
      updatedAt: now,
    });
    // DEC-926: any task_assignment linked to the deleted file follows the
    // chain to the surviving link — set-based, never a row delete.
    await db
      .update(schema.taskAssignment)
      .set({ fileId: survivingId, updatedAt: now })
      .where(eq(schema.taskAssignment.fileId, fileId));
  } else {
    // Sole version in its chain — its comments go with it.
    await db.delete(schema.fileComment).where(eq(schema.fileComment.fileId, fileId));
    // DEC-926: no surviving link to repoint to — reopen the assignment
    // instead of leaving it pointed at a deleted row.
    const now = new Date();
    await db
      .update(schema.taskAssignment)
      .set({ status: "pending", completedAt: null, completedBy: null, fileId: null, updatedAt: now })
      .where(eq(schema.taskAssignment.fileId, fileId));
  }

  await db.delete(schema.file).where(eq(schema.file.id, fileId));
}
