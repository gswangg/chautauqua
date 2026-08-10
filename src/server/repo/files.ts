// Files repo (J8, DEC-020 contract). Repo functions are the only code that
// touches drizzle row types (DEC-012); handlers in src/routes/files.ts stay
// thin: parse/authz -> repo function -> pure core (src/domain/files.ts) ->
// response.

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { isValidFileKind, type FileKind } from "../../domain/files";
import { chunkIds } from "../../lib/chunk";

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
 * DEC-020 doesn't name reviewers for this surface; per DEC-066, reviewers may
 * download submission files (GET /files/:fileId only, never the comment
 * endpoints) iff they're assigned (plan_reviewer) to a review plan for the
 * file's event — callers pass that precomputed boolean in `opts`, never
 * defaulting to true. */
export function canAccessFile(
  auth: { role: string; orgId: string; contactId?: string },
  scope: { orgId: string; uploadedByContactId: string | null; participantContactIds: readonly string[] },
  opts?: { reviewerAssignedToEvent?: boolean },
): boolean {
  if (auth.role === "organizer") {
    return auth.orgId === scope.orgId;
  }
  if (auth.role === "speaker") {
    if (!auth.contactId) return false;
    return scope.uploadedByContactId === auth.contactId || scope.participantContactIds.includes(auth.contactId);
  }
  if (auth.role === "reviewer") {
    return opts?.reviewerAssignedToEvent === true;
  }
  return false;
}

/** DEC-066: does this reviewer (by user id) have a plan_reviewer assignment
 * on any evaluation plan for the given event? Pure existence check — used to
 * gate reviewer downloads of submission files via GET /files/:fileId. */
export async function reviewerHasPlanForEvent(db: Db, userId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.planReviewer.id })
    .from(schema.planReviewer)
    .innerJoin(schema.evaluationPlan, eq(schema.planReviewer.planId, schema.evaluationPlan.id))
    .where(and(eq(schema.planReviewer.userId, userId), eq(schema.evaluationPlan.eventId, eventId)))
    .limit(1);
  return rows.length > 0;
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
 * handout upload: submissionId null, kind 'handout', reverse-joined via
 * task_assignment.fileId -> its task -> event, for orgId. Returns null when
 * no task_assignment row references the file (not this population) — mirrors
 * getResourceFileScope's disjointness with getFileScope. */
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
  if (!fileRow || fileRow.kind !== "handout" || fileRow.submissionId !== null) return null;

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

// ---------------------------------------------------------------------------
// Version-chain lookups
// ---------------------------------------------------------------------------

/** Loads the submission id + kind of the file `replacesFileId` points at, for
 * the DEC-020 version-chain rule — null if it doesn't exist. */
export async function getReplacesTarget(
  db: Db,
  replacesFileId: string,
): Promise<{ submissionId: string | null; kind: string } | null> {
  const rows = await db
    .select({ submissionId: schema.file.submissionId, kind: schema.file.kind })
    .from(schema.file)
    .where(eq(schema.file.id, replacesFileId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface InsertFileInput {
  // nullable: resource files (task_assignment handouts, headshots, standalone
  // resources) aren't attached to a submission — matches the schema column.
  submissionId: string | null;
  kind: FileKind;
  filename: string;
  r2Key: string;
  sizeBytes: number;
  contentType: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
}

export async function insertFile(db: Db, input: InsertFileInput): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.file).values({
    id,
    submissionId: input.submissionId,
    kind: input.kind,
    filename: input.filename,
    r2Key: input.r2Key,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    previousFileId: input.previousFileId,
    uploadedByContactId: input.uploadedByContactId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
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
    })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .orderBy(desc(schema.file.createdAt));

  const grouped: FilesByKind = {};
  for (const row of rows) {
    const version: FileVersion = {
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      contentType: row.contentType,
      previousFileId: row.previousFileId,
      uploadedByContactId: row.uploadedByContactId,
      createdAt: row.createdAt.getTime(),
    };
    (grouped[row.kind] ??= []).push(version);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface FileCommentRow {
  id: string;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: number;
}

export async function listFileComments(db: Db, fileId: string): Promise<FileCommentRow[]> {
  const rows = await db
    .select({
      id: schema.fileComment.id,
      body: schema.fileComment.body,
      createdAt: schema.fileComment.createdAt,
      authorUserId: schema.fileComment.authorUserId,
    })
    .from(schema.fileComment)
    .where(eq(schema.fileComment.fileId, fileId))
    .orderBy(schema.fileComment.createdAt);

  const userIds = [...new Set(rows.map((r) => r.authorUserId).filter((x): x is string => !!x))];
  const userMap = new Map<string, { email: string; role: string; contactId: string | null }>();
  if (userIds.length > 0) {
    for (const batch of chunkIds(userIds)) {
      const userRows = await db
        .select({ id: schema.user.id, email: schema.user.email, role: schema.user.role, contactId: schema.user.contactId })
        .from(schema.user)
        .where(inArray(schema.user.id, batch));
      for (const u of userRows) userMap.set(u.id, { email: u.email, role: u.role, contactId: u.contactId });
    }
  }

  const contactIds = [...new Set([...userMap.values()].map((u) => u.contactId).filter((x): x is string => !!x))];
  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    for (const batch of chunkIds(contactIds)) {
      const contactRows = await db
        .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
        .from(schema.contact)
        .where(inArray(schema.contact.id, batch));
      for (const c of contactRows) contactMap.set(c.id, `${c.firstName} ${c.lastName}`.trim());
    }
  }

  return rows.map((row) => {
    const user = row.authorUserId ? userMap.get(row.authorUserId) : undefined;
    const authorName = user ? (user.contactId && contactMap.get(user.contactId)) || user.email : "Unknown";
    return {
      id: row.id,
      body: row.body,
      authorName,
      authorRole: user?.role ?? "unknown",
      createdAt: row.createdAt.getTime(),
    };
  });
}

export async function insertFileComment(
  db: Db,
  input: { fileId: string; body: string; authorUserId: string; authorContactId: string | null },
): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.fileComment).values({
    id,
    fileId: input.fileId,
    authorUserId: input.authorUserId,
    authorContactId: input.authorContactId,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Content status (organizer approval)
// ---------------------------------------------------------------------------

export const CONTENT_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isValidContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

/** Organizer-only content approval; DEC-009 invariant — this module MUST
 * NEVER import a mailer. Status changes never send email. */
export async function updateContentStatus(db: Db, submissionId: string, contentStatus: ContentStatus): Promise<void> {
  await db
    .update(schema.submission)
    .set({ contentStatus, updatedAt: new Date() })
    .where(eq(schema.submission.id, submissionId));
}

export { isValidFileKind };
