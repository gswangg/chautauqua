// Submission delete repo (DEC-886/DEC-921): "A session can be deleted, from
// a confirmation PAGE that names what goes with it, and a submitted
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
// participant, schedule_slot, file + file_comment, review_recusal,
// submission_revision, then the submission row itself. task_assignment rows
// completed via one of the submission's files (task_assignment has no
// submissionId column — its only link to a submission is through
// task_assignment.file_id) are NEVER deleted by this cascade: a completed
// file-request assignment is reopened (status back to 'pending',
// completedAt/completedBy/fileId cleared) rather than losing the row —
// the assignment is owned by the (task, contact) pair, not by the
// submission whose file happened to complete it (DEC-921). email_log rows
// are historical fact and are never touched.

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";
import { formatRef } from "../../domain/ids";

export interface DeleteRefusal {
  id: string;
  ref: string;
  reason: string;
}

// DEC-921: the plan names the blast radius, one grouped count per owned
// table — never a query per submission.
export interface DeleteCounts {
  files: number;
  comments: number;
  participants: number;
  answers: number;
  tracks: number;
  recusals: number;
  revisions: number;
  taskResponses: number;
}

export interface EligibleSubmissionDelete {
  submissionId: string;
  ref: string;
  title: string;
  counts: DeleteCounts;
  scheduled: boolean;
  // Internal only — the route deletes these R2 objects before calling
  // commitSubmissionDelete, then must NOT let this field reach the wire
  // (see the delete-plan route's explicit projection).
  fileR2Keys: string[];
}

export interface SubmissionDeletePlan {
  eligible: EligibleSubmissionDelete[];
  refused: DeleteRefusal[];
}

function emptyCounts(): DeleteCounts {
  return { files: 0, comments: 0, participants: 0, answers: 0, tracks: 0, recusals: 0, revisions: 0, taskResponses: 0 };
}

/**
 * One grouped `groupBy(submissionId) + count(*)` query per chunk of
 * `eligibleIds`, folded into `counts` under `key`. Never a query per
 * submission.
 */
async function foldGroupedSubmissionCounts(
  db: Db,
  eligibleIds: string[],
  counts: Map<string, DeleteCounts>,
  key: keyof DeleteCounts,
  table: { submissionId: unknown },
): Promise<void> {
  for (const chunk of chunkIds(eligibleIds)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ submissionId: table.submissionId as never, count: sql<number>`count(*)` })
      .from(table as never)
      .where(inArray(table.submissionId as never, chunk))
      .groupBy(table.submissionId as never);
    for (const r of rows as unknown as { submissionId: string; count: number }[]) {
      const c = counts.get(r.submissionId);
      if (!c) continue;
      c[key] = Number(r.count);
    }
  }
}

/**
 * Read-only plan for a bulk submission delete. An id that does not belong
 * to `eventId` (unknown, or belongs to another event) is refused rather
 * than throwing for the whole batch — the caller's selection may simply be
 * stale. An id whose submission carries at least one SUBMITTED
 * (evaluation.submittedAt not null) evaluation is refused, naming the
 * reason. Everything else is eligible, carrying the R2 keys of every file
 * row the submission owns (so the route can delete those objects before
 * calling commitSubmissionDelete) plus a per-table blast-radius count and
 * whether the submission currently holds a schedule slot (DEC-921).
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

  // File rows also double as the `files` count — no separate grouped query
  // needed since every row is already fetched here for its R2 key.
  const fileRows: { id: string; submissionId: string | null; r2Key: string }[] = [];
  for (const chunk of chunkIds(eligibleIds)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ id: schema.file.id, submissionId: schema.file.submissionId, r2Key: schema.file.r2Key })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, chunk));
    fileRows.push(...rows);
  }
  const keysBySubmission = new Map<string, string[]>();
  const fileIdToSubmission = new Map<string, string>();
  for (const r of fileRows) {
    if (!r.submissionId) continue;
    const arr = keysBySubmission.get(r.submissionId) ?? [];
    arr.push(r.r2Key);
    keysBySubmission.set(r.submissionId, arr);
    fileIdToSubmission.set(r.id, r.submissionId);
  }
  const allFileIds = [...fileIdToSubmission.keys()];

  const counts = new Map<string, DeleteCounts>(eligibleIds.map((id) => [id, emptyCounts()]));
  for (const id of eligibleIds) {
    const c = counts.get(id);
    if (c) c.files = keysBySubmission.get(id)?.length ?? 0;
  }

  await foldGroupedSubmissionCounts(db, eligibleIds, counts, "participants", schema.participant);
  await foldGroupedSubmissionCounts(db, eligibleIds, counts, "answers", schema.submissionAnswer);
  await foldGroupedSubmissionCounts(db, eligibleIds, counts, "tracks", schema.submissionTrack);
  await foldGroupedSubmissionCounts(db, eligibleIds, counts, "recusals", schema.reviewRecusal);
  await foldGroupedSubmissionCounts(db, eligibleIds, counts, "revisions", schema.submissionRevision);

  // comments/taskResponses hang off file_id, not submission_id — group by
  // file_id over the id set already collected above, then fold into the
  // owning submission's count via fileIdToSubmission. One grouped query per
  // table, chunked by file id, never a query per submission.
  for (const chunk of chunkIds(allFileIds)) {
    if (chunk.length === 0) continue;
    const commentRows = await db
      .select({ fileId: schema.fileComment.fileId, count: sql<number>`count(*)` })
      .from(schema.fileComment)
      .where(inArray(schema.fileComment.fileId, chunk))
      .groupBy(schema.fileComment.fileId);
    for (const r of commentRows) {
      const subId = fileIdToSubmission.get(r.fileId);
      const c = subId ? counts.get(subId) : undefined;
      if (c) c.comments += Number(r.count);
    }

    const taskRows = await db
      .select({ fileId: schema.taskAssignment.fileId, count: sql<number>`count(*)` })
      .from(schema.taskAssignment)
      .where(inArray(schema.taskAssignment.fileId, chunk))
      .groupBy(schema.taskAssignment.fileId);
    for (const r of taskRows) {
      const subId = r.fileId ? fileIdToSubmission.get(r.fileId) : undefined;
      const c = subId ? counts.get(subId) : undefined;
      if (c) c.taskResponses += Number(r.count);
    }
  }

  const scheduledIds = new Set<string>();
  for (const chunk of chunkIds(eligibleIds)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ submissionId: schema.scheduleSlot.submissionId })
      .from(schema.scheduleSlot)
      .where(inArray(schema.scheduleSlot.submissionId, chunk));
    for (const r of rows) scheduledIds.add(r.submissionId);
  }

  const eligible: EligibleSubmissionDelete[] = eligibleIds.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`planSubmissionDelete: unreachable — eligible id ${id} missing from byId`);
    const c = counts.get(id) ?? emptyCounts();
    return {
      submissionId: id,
      ref: formatRef(recordPrefix, row.seq),
      title: row.title,
      counts: c,
      scheduled: scheduledIds.has(id),
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
  const now = new Date();

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
      // DEC-921: the assignment row is owned by the (task, contact) pair,
      // not by the submission whose file happened to complete it — it is
      // never hard-deleted here, only reopened to 'pending' with its
      // completion fields cleared (responseJson is a kind='form' task
      // field and is untouched).
      await db
        .update(schema.taskAssignment)
        .set({ status: "pending", completedAt: null, completedBy: null, fileId: null, updatedAt: now })
        .where(inArray(schema.taskAssignment.fileId, fileChunk));
      await db.delete(schema.fileComment).where(inArray(schema.fileComment.fileId, fileChunk));
    }

    await db.delete(schema.file).where(inArray(schema.file.submissionId, chunk));
    await db.delete(schema.submissionAnswer).where(inArray(schema.submissionAnswer.submissionId, chunk));
    await db.delete(schema.submissionTrack).where(inArray(schema.submissionTrack.submissionId, chunk));
    await db.delete(schema.participant).where(inArray(schema.participant.submissionId, chunk));
    // DEC-921: an orphaned schedule_slot left behind by a deleted
    // submission makes deleteRoom refuse forever (events.ts's 409 guard
    // checks for ANY referencing slot) — deleted here, before the
    // submission row, alongside every other owned table.
    await db.delete(schema.scheduleSlot).where(inArray(schema.scheduleSlot.submissionId, chunk));
    await db.delete(schema.reviewRecusal).where(inArray(schema.reviewRecusal.submissionId, chunk));
    await db.delete(schema.submissionRevision).where(inArray(schema.submissionRevision.submissionId, chunk));
    await db
      .delete(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, chunk)));
  }

  return submissionIds.length;
}
