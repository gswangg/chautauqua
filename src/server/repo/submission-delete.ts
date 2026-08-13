// Submission delete repo (DEC-886): "A session can be deleted, from a
// confirmation PAGE that names what goes with it, and a submitted
// evaluation makes it undeletable." Split into a read-only planning phase
// (planSubmissionDelete) and a mutating commit phase (commitSubmissionDelete)
// so the route can delete each eligible submission's R2 objects through the
// same FileStore abstraction DEC-713's version-delete route uses, BEFORE
// any DB row is touched — repo functions don't own the FileStore port
// (DEC-012, see routes/api/portal-config.ts's resource-delete route for the
// same split).
//
// Everything a submission owns is removed set-based/chunked (never a query
// per id, DEC-078's chunkIds): submission_answer, submission_track,
// participant, task_assignment rows completed via one of the submission's
// files (task_assignment has no submissionId column — its only link to a
// submission is through task_assignment.file_id), file + file_comment,
// review_recusal, submission_revision, then the submission row itself.
// email_log rows are historical fact and are never touched.

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";
import { formatRef } from "../../domain/ids";

export interface DeleteRefusal {
  id: string;
  ref: string;
  reason: string;
}

export interface EligibleSubmissionDelete {
  submissionId: string;
  ref: string;
  title: string;
  fileR2Keys: string[];
}

export interface SubmissionDeletePlan {
  eligible: EligibleSubmissionDelete[];
  refused: DeleteRefusal[];
}

/**
 * Read-only plan for a bulk submission delete. An id that does not belong
 * to `eventId` (unknown, or belongs to another event) is refused rather
 * than throwing for the whole batch — the caller's selection may simply be
 * stale. An id whose submission carries at least one SUBMITTED
 * (evaluation.submittedAt not null) evaluation is refused, naming the
 * reason. Everything else is eligible, carrying the R2 keys of every file
 * row the submission owns so the route can delete those objects before
 * calling commitSubmissionDelete.
 */
export async function planSubmissionDelete(db: Db, eventId: string, ids: string[]): Promise<SubmissionDeletePlan> {
  const requested = [...new Set(ids)];
  if (requested.length === 0) return { eligible: [], refused: [] };

  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix;
  if (!recordPrefix) throw new Error(`planSubmissionDelete: event ${eventId} not found`);

  const subRows: { id: string; seq: number; title: string }[] = [];
  for (const chunk of chunkIds(requested)) {
    const rows = await db
      .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, chunk)));
    subRows.push(...rows);
  }
  const byId = new Map(subRows.map((r) => [r.id, r]));

  const refused: DeleteRefusal[] = [];
  for (const id of requested) {
    if (!byId.has(id)) {
      refused.push({ id, ref: id, reason: "Submission not found in this event" });
    }
  }
  const foundIds = requested.filter((id) => byId.has(id));

  const submittedSubmissionIds = new Set<string>();
  for (const chunk of chunkIds(foundIds)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ submissionId: schema.evaluation.submissionId })
      .from(schema.evaluation)
      .where(and(inArray(schema.evaluation.submissionId, chunk), isNotNull(schema.evaluation.submittedAt)));
    for (const r of rows) submittedSubmissionIds.add(r.submissionId);
  }

  const eligibleIds = foundIds.filter((id) => !submittedSubmissionIds.has(id));
  for (const id of submittedSubmissionIds) {
    const row = byId.get(id);
    if (!row) continue;
    refused.push({ id, ref: formatRef(recordPrefix, row.seq), reason: "Has at least one submitted evaluation" });
  }

  const fileRows: { submissionId: string | null; r2Key: string }[] = [];
  for (const chunk of chunkIds(eligibleIds)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ submissionId: schema.file.submissionId, r2Key: schema.file.r2Key })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, chunk));
    fileRows.push(...rows);
  }
  const keysBySubmission = new Map<string, string[]>();
  for (const r of fileRows) {
    if (!r.submissionId) continue;
    const arr = keysBySubmission.get(r.submissionId) ?? [];
    arr.push(r.r2Key);
    keysBySubmission.set(r.submissionId, arr);
  }

  const eligible: EligibleSubmissionDelete[] = eligibleIds.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`planSubmissionDelete: unreachable — eligible id ${id} missing from byId`);
    return {
      submissionId: id,
      ref: formatRef(recordPrefix, row.seq),
      title: row.title,
      fileR2Keys: keysBySubmission.get(id) ?? [],
    };
  });

  return { eligible, refused };
}

/**
 * Mutating cascade for a set of already-planned, already-eligible
 * submission ids (the caller MUST have deleted every R2 object named in
 * the plan's fileR2Keys first — this function never touches R2). Chunked
 * throughout; returns the count of submission rows removed.
 */
export async function commitSubmissionDelete(db: Db, eventId: string, submissionIds: string[]): Promise<number> {
  if (submissionIds.length === 0) return 0;

  for (const chunk of chunkIds(submissionIds)) {
    if (chunk.length === 0) continue;

    const fileRows = await db
      .select({ id: schema.file.id })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, chunk));
    const fileIds = fileRows.map((r) => r.id);

    for (const fileChunk of chunkIds(fileIds)) {
      if (fileChunk.length === 0) continue;
      // task_assignment has no submissionId column — its only link to a
      // submission is through the file_request task's completion file.
      await db.delete(schema.taskAssignment).where(inArray(schema.taskAssignment.fileId, fileChunk));
      await db.delete(schema.fileComment).where(inArray(schema.fileComment.fileId, fileChunk));
    }

    await db.delete(schema.file).where(inArray(schema.file.submissionId, chunk));
    await db.delete(schema.submissionAnswer).where(inArray(schema.submissionAnswer.submissionId, chunk));
    await db.delete(schema.submissionTrack).where(inArray(schema.submissionTrack.submissionId, chunk));
    await db.delete(schema.participant).where(inArray(schema.participant.submissionId, chunk));
    await db.delete(schema.reviewRecusal).where(inArray(schema.reviewRecusal.submissionId, chunk));
    await db.delete(schema.submissionRevision).where(inArray(schema.submissionRevision.submissionId, chunk));
    await db
      .delete(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, chunk)));
  }

  return submissionIds.length;
}
