// Files repo (J8, DEC-020 contract). Repo functions are the only code that
// touches drizzle row types (DEC-012); handlers in src/routes/files.ts stay
// thin: parse/authz -> repo function -> pure core (src/domain/files.ts) ->
// response.

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef, newId } from "../../domain/ids";
import { isValidFileKind, type FileKind } from "../../domain/files";
import { chunkIds } from "../../lib/chunk";
import { ApiError } from "../http";
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

/** DEC-242: 1-indexed version number for `fileId`, counting `fileId` itself
 * plus every ancestor reachable by walking previous_file_id — matches the
 * VersionList frontend's `versions.length - idx` numbering (oldest = v1,
 * current/latest = v<chain length>) since a task_assignment's linked file is
 * always the newest link in its chain. */
export async function getFileVersionNumber(db: Db, fileId: string): Promise<number> {
  let current: string | null = fileId;
  let version = 0;
  while (current) {
    version += 1;
    const rows: { previousFileId: string | null }[] = await db
      .select({ previousFileId: schema.file.previousFileId })
      .from(schema.file)
      .where(eq(schema.file.id, current))
      .limit(1);
    const row: { previousFileId: string | null } | undefined = rows[0];
    if (!row) throw new Error(`getFileVersionNumber: file ${current} not found mid-chain — data corruption`);
    current = row.previousFileId;
  }
  return version;
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

// ---------------------------------------------------------------------------
// Central files library (DEC-159): event-scoped deliverable version chains
// ---------------------------------------------------------------------------

export interface EventFilesScope {
  orgId: string;
  slug: string;
}

/** Org + slug for the GET/POST /events/:eventId/files* endpoints — slug
 * feeds the ZIP download's Content-Disposition filename. */
export async function getEventFilesScope(db: Db, eventId: string): Promise<EventFilesScope | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId, slug: schema.event.slug })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}

export interface EventDeliverableChain {
  rootFileId: string;
  latestFileId: string;
  filename: string;
  kind: string;
  submissionId: string;
  submissionRef: string;
  submissionTitle: string;
  speakerName: string;
  uploadedAt: number;
  versionCount: number;
}

interface DeliverableFileRow {
  id: string;
  submissionId: string;
  kind: string;
  filename: string;
  previousFileId: string | null;
  createdAt: Date;
}

/** Follows previous_file_id links to find the oldest ancestor ('root') of
 * `fileId` within `byId` — used to group a submission's files into version
 * chains. Bounded by the number of files on the event (DEC-159), so a
 * plain loop rather than a recursive CTE. */
function findRoot(fileId: string, byId: Map<string, DeliverableFileRow>): string {
  let current = byId.get(fileId);
  if (!current) throw new Error(`findRoot: file ${fileId} not in the loaded set`);
  const visited = new Set<string>([fileId]);
  while (current.previousFileId) {
    if (visited.has(current.previousFileId)) {
      throw new Error(`findRoot: previous_file_id cycle detected at ${current.previousFileId}`);
    }
    const parent = byId.get(current.previousFileId);
    if (!parent) break; // parent outside the loaded set — treat current as root
    visited.add(parent.id);
    current = parent;
  }
  return current.id;
}

/** DEC-159: every deliverable file version chain (previous_file_id links)
 * attached to a submission in `eventId`, one row per chain, newest version's
 * metadata surfaced (filename/kind/uploadedAt) plus the chain's version
 * count and the submission's lead speaker. */
export async function listEventDeliverableFiles(db: Db, eventId: string): Promise<EventDeliverableChain[]> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) return [];

  const submissionRows = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));
  if (submissionRows.length === 0) return [];
  const submissionById = new Map(submissionRows.map((s) => [s.id, s]));
  const submissionIds = submissionRows.map((s) => s.id);

  const fileRows: DeliverableFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, batch));
    for (const r of rows) {
      if (r.submissionId) fileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  if (fileRows.length === 0) return [];

  const participantRows: { submissionId: string; contactId: string; order: number; role: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.participant.submissionId,
        contactId: schema.participant.contactId,
        order: schema.participant.order,
        role: schema.participant.role,
      })
      .from(schema.participant)
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...rows);
  }
  const leadContactBySubmission = new Map<string, string>();
  for (const p of participantRows) {
    if (p.role !== "speaker") continue;
    const existing = leadContactBySubmission.get(p.submissionId);
    if (existing === undefined) {
      leadContactBySubmission.set(p.submissionId, p.contactId);
      continue;
    }
    const existingOrder = participantRows.find((x) => x.submissionId === p.submissionId && x.contactId === existing)?.order ?? 0;
    if (p.order < existingOrder) leadContactBySubmission.set(p.submissionId, p.contactId);
  }
  const contactIds = [...new Set(leadContactBySubmission.values())];
  const contactNameById = new Map<string, string>();
  for (const batch of chunkIds(contactIds)) {
    const rows = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const c of rows) contactNameById.set(c.id, `${c.firstName} ${c.lastName}`.trim());
  }

  const byId = new Map(fileRows.map((f) => [f.id, f]));
  const chains = new Map<string, DeliverableFileRow[]>();
  for (const f of fileRows) {
    const root = findRoot(f.id, byId);
    const arr = chains.get(root) ?? [];
    arr.push(f);
    chains.set(root, arr);
  }

  const out: EventDeliverableChain[] = [];
  for (const [rootFileId, versions] of chains) {
    versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = versions[0];
    if (!latest) throw new Error(`listEventDeliverableFiles: empty chain for root ${rootFileId}`);
    const submission = submissionById.get(latest.submissionId);
    if (!submission) throw new Error(`listEventDeliverableFiles: submission ${latest.submissionId} not loaded`);
    const leadContactId = leadContactBySubmission.get(latest.submissionId);
    const speakerName = leadContactId ? (contactNameById.get(leadContactId) ?? "") : "";
    out.push({
      rootFileId,
      latestFileId: latest.id,
      filename: latest.filename,
      kind: latest.kind,
      submissionId: latest.submissionId,
      submissionRef: formatRef(event.recordPrefix, submission.seq),
      submissionTitle: submission.title,
      speakerName,
      uploadedAt: latest.createdAt.getTime(),
      versionCount: versions.length,
    });
  }
  return out;
}

/** DEC-160: resolves each requested file id to its version chain's latest
 * file row (id/filename/contentType/r2Key), scoped to `eventId` — throws if
 * any requested id doesn't resolve to a deliverable of that event's
 * submissions (no silent skips, per DEC-160's "whole request 404s" rule). */
export async function resolveLatestVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string }>> {
  const chains = await listEventDeliverableFiles(db, eventId);
  const latestByAnyChainMember = new Map<string, string>(); // any file id in a chain -> latest file id

  // Re-derive chain membership so both root and non-root ids in the request
  // resolve correctly (a caller may pass an older version's id).
  const submissionRows = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));
  const submissionIds = submissionRows.map((s) => s.id);
  const fileRows: DeliverableFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, batch));
    for (const r of rows) {
      if (r.submissionId) fileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const byId = new Map(fileRows.map((f) => [f.id, f]));
  const latestByRoot = new Map(chains.map((c) => [c.rootFileId, c.latestFileId]));
  for (const f of fileRows) {
    const root = findRoot(f.id, byId);
    const latestId = latestByRoot.get(root);
    if (latestId) latestByAnyChainMember.set(f.id, latestId);
  }

  const latestFileIds = new Set<string>();
  for (const requestedId of fileIds) {
    const latestId = latestByAnyChainMember.get(requestedId);
    if (!latestId) {
      throw new ApiError("not_found", `File ${requestedId} is not a deliverable of this event`);
    }
    latestFileIds.add(latestId);
  }

  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string }>();
  for (const batch of chunkIds([...latestFileIds])) {
    const rows = await db
      .select({
        id: schema.file.id,
        filename: schema.file.filename,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const r of rows) out.set(r.id, r);
  }

  const resolved = new Map<string, { id: string; filename: string; contentType: string; r2Key: string }>();
  for (const requestedId of fileIds) {
    const latestId = latestByAnyChainMember.get(requestedId);
    if (!latestId) throw new Error("unreachable: validated above");
    const row = out.get(latestId);
    if (!row) throw new Error(`resolveLatestVersions: latest file ${latestId} row missing`);
    resolved.set(requestedId, row);
  }
  return resolved;
}

export { isValidFileKind };
