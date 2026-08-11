// Files repo — ownership / authz lookups (J8, DEC-020 contract). Split out of
// files.ts (contention decomposition) — no behavior change, files.ts
// re-exports everything below for existing callers.

import { and, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { listPlansForEvent, isSubmissionInReviewerScope } from "./review";

// ---------------------------------------------------------------------------
// Ownership / authz lookups
// ---------------------------------------------------------------------------

export interface SubmissionScope {
  submissionId: string;
  eventId: string;
  orgId: string;
  /** contact ids of every participant on the submission — for speaker IDOR checks. */
  participantContactIds: string[];
}

/** Loads the submission's event/org + participant contact ids, or null if
 * the submission doesn't exist. Used to authz both the upload and list
 * endpoints under /api/v1/submissions/:id/files. */
export async function getSubmissionScope(db: Db, submissionId: string): Promise<SubmissionScope | null> {
  const subRows = await db
    .select({ eventId: schema.submission.eventId, orgId: schema.event.orgId })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const sub = subRows[0];
  if (!sub) return null;

  const participantRows = await db
    .select({ contactId: schema.participant.contactId })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));

  return {
    submissionId,
    eventId: sub.eventId,
    orgId: sub.orgId,
    participantContactIds: participantRows.map((r) => r.contactId),
  };
}

export interface FileScope {
  fileId: string;
  submissionId: string | null;
  eventId: string;
  orgId: string;
  uploadedByContactId: string | null;
  participantContactIds: string[];
  filename: string;
  contentType: string;
  r2Key: string;
}

/** Loads a file's authz scope (submission ownership, participants, uploader)
 * for GET /files/:fileId and the comment endpoints — null if not found or
 * the file isn't attached to a submission (stage-1 J8 scope is submission
 * deliverables only). */
export async function getFileScope(db: Db, fileId: string): Promise<FileScope | null> {
  const fileRows = await db
    .select({
      id: schema.file.id,
      submissionId: schema.file.submissionId,
      filename: schema.file.filename,
      contentType: schema.file.contentType,
      r2Key: schema.file.r2Key,
      uploadedByContactId: schema.file.uploadedByContactId,
    })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow) return null;
  if (!fileRow.submissionId) return null;

  const scope = await getSubmissionScope(db, fileRow.submissionId);
  if (!scope) return null;

  return {
    fileId: fileRow.id,
    submissionId: fileRow.submissionId,
    eventId: scope.eventId,
    orgId: scope.orgId,
    uploadedByContactId: fileRow.uploadedByContactId,
    participantContactIds: scope.participantContactIds,
    filename: fileRow.filename,
    contentType: fileRow.contentType,
    r2Key: fileRow.r2Key,
  };
}

/** Pure authz check for GET /files/:fileId and the comment endpoints, per
 * DEC-020: organizers may access any file in their org; speakers only when
 * they're a participant on the file's submission or the uploader — no IDOR.
 * DEC-020 doesn't name reviewers for this surface; per DEC-170 (supersedes
 * DEC-066), reviewers may download submission files (GET /files/:fileId
 * only, never the comment endpoints) iff the file's submission is in scope
 * for one of their non-anonymized plan assignments — callers pass that
 * precomputed boolean in `opts`, never defaulting to true. */
export function canAccessFile(
  auth: { role: string; orgId: string; contactId?: string },
  scope: { orgId: string; uploadedByContactId: string | null; participantContactIds: readonly string[] },
  opts?: { reviewerInScope?: boolean },
): boolean {
  if (auth.role === "organizer") {
    return auth.orgId === scope.orgId;
  }
  if (auth.role === "speaker") {
    if (!auth.contactId) return false;
    return scope.uploadedByContactId === auth.contactId || scope.participantContactIds.includes(auth.contactId);
  }
  if (auth.role === "reviewer") {
    return opts?.reviewerInScope === true;
  }
  return false;
}

/** DEC-170 (supersedes DEC-066): does this reviewer (by user id) have a
 * non-anonymized plan assignment in `eventId` whose scope covers
 * `submissionId`? Unlike the superseded DEC-066 check (event-wide plan
 * existence), this scopes access to the reviewer's assigned tracks/
 * submissions AND excludes anonymized plans entirely — a reviewer must
 * never download a submission's files via an anonymized plan assignment.
 * Loads the event's plans once (listPlansForEvent) rather than duplicating
 * PlanRecord parsing, filters to the ones the reviewer is assigned to via
 * plan_reviewer, then delegates the per-submission scope check to
 * isSubmissionInReviewerScope (src/server/repo/review.ts). */
export async function reviewerCanAccessSubmissionFile(
  db: Db,
  userId: string,
  eventId: string,
  submissionId: string,
): Promise<boolean> {
  const assignedRows = await db
    .select({ planId: schema.planReviewer.planId })
    .from(schema.planReviewer)
    .innerJoin(schema.evaluationPlan, eq(schema.planReviewer.planId, schema.evaluationPlan.id))
    .where(and(eq(schema.planReviewer.userId, userId), eq(schema.evaluationPlan.eventId, eventId)));
  const assignedPlanIds = new Set(assignedRows.map((r) => r.planId));
  if (assignedPlanIds.size === 0) return false;

  const plans = await listPlansForEvent(db, eventId);
  const candidatePlans = plans.filter((p) => assignedPlanIds.has(p.id) && p.anonymized === false);

  for (const plan of candidatePlans) {
    if (await isSubmissionInReviewerScope(db, plan, userId, submissionId)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Resource-file (DEC-047) organizer authz scope
// ---------------------------------------------------------------------------

export interface ResourceFileScope {
  fileId: string;
  orgId: string;
  filename: string;
  contentType: string;
  r2Key: string;
}

/** Authz scope for GET /files/:fileId when the file is kind='resource'
 * (submissionId null, so getFileScope/getSubmissionScope can never reach
 * it). Organizers whose org owns the resource's event may serve it —
 * mirrors src/server/repo/portal.ts's getResourceDownloadScope, which is
 * the speaker-side counterpart for the same underlying resource/file rows. */
export async function getResourceFileScope(db: Db, fileId: string): Promise<ResourceFileScope | null> {
  const fileRows = await db
    .select({
      id: schema.file.id,
      kind: schema.file.kind,
      submissionId: schema.file.submissionId,
      filename: schema.file.filename,
      contentType: schema.file.contentType,
      r2Key: schema.file.r2Key,
    })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow || fileRow.kind !== "resource" || fileRow.submissionId !== null) return null;

  const resourceRows = await db
    .select({ eventOrgId: schema.event.orgId })
    .from(schema.resource)
    .innerJoin(schema.event, eq(schema.resource.eventId, schema.event.id))
    .where(eq(schema.resource.fileId, fileId))
    .limit(1);
  const resourceRow = resourceRows[0];
  if (!resourceRow) return null;

  return {
    fileId: fileRow.id,
    orgId: resourceRow.eventOrgId,
    filename: fileRow.filename,
    contentType: fileRow.contentType,
    r2Key: fileRow.r2Key,
  };
}

/** Pure authz check for organizer access to a resource file — organizer-only
 * (speakers already have a dedicated /portal/resources/:id/download route,
 * DEC-047/DEC-029), org match only since resource files aren't submission-
 * scoped (no participant/uploader path like canAccessFile's speaker branch). */
export function canAccessResourceFile(auth: { role: string; orgId: string }, scope: { orgId: string }): boolean {
  return auth.role === "organizer" && auth.orgId === scope.orgId;
}

// ---------------------------------------------------------------------------
// Task-assignment (kind='handout') organizer/speaker authz scope (DEC-065)
// ---------------------------------------------------------------------------

export interface TaskFileScope {
  fileId: string;
  orgId: string;
  assignmentContactId: string;
  uploadedByContactId: string | null;
  filename: string;
  contentType: string;
  r2Key: string;
}

/** Authz scope for GET /files/:fileId when the file is a task-assignment
 * upload: DEC-248 population is submissionId-null + referenced by
 * task_assignment.fileId, of ANY kind (not restricted to 'handout') —
 * reverse-joined via task_assignment.fileId -> its task -> event, for orgId.
 * Submission-linked task uploads are a disjoint population served through
 * getFileScope, not here. Returns null when no task_assignment row
 * references the file (not this population) — mirrors getResourceFileScope's
 * disjointness with getFileScope. */
export async function getTaskFileScope(db: Db, fileId: string): Promise<TaskFileScope | null> {
  const fileRows = await db
    .select({
      id: schema.file.id,
      kind: schema.file.kind,
      submissionId: schema.file.submissionId,
      filename: schema.file.filename,
      contentType: schema.file.contentType,
      r2Key: schema.file.r2Key,
      uploadedByContactId: schema.file.uploadedByContactId,
    })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow || fileRow.submissionId !== null) return null;

  const assignmentRows = await db
    .select({
      assignmentContactId: schema.taskAssignment.contactId,
      orgId: schema.event.orgId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.taskAssignment.fileId, fileId))
    .limit(1);
  const assignmentRow = assignmentRows[0];
  if (!assignmentRow) return null;

  return {
    fileId: fileRow.id,
    orgId: assignmentRow.orgId,
    assignmentContactId: assignmentRow.assignmentContactId,
    uploadedByContactId: fileRow.uploadedByContactId,
    filename: fileRow.filename,
    contentType: fileRow.contentType,
    r2Key: fileRow.r2Key,
  };
}

/** Pure authz check for DEC-065 task-assignment handout downloads: organizer
 * org-match, or the speaker who is the assignment's contact or the uploader
 * (a task-completion handout may be uploaded by the assigned speaker's own
 * account) — no IDOR for any other speaker. */
export function canAccessTaskFile(
  auth: { role: string; orgId: string; contactId?: string },
  scope: { orgId: string; assignmentContactId: string; uploadedByContactId: string | null },
): boolean {
  if (auth.role === "organizer") {
    return auth.orgId === scope.orgId;
  }
  if (auth.role === "speaker") {
    if (!auth.contactId) return false;
    return auth.contactId === scope.assignmentContactId || auth.contactId === scope.uploadedByContactId;
  }
  return false;
}
