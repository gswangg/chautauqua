// Files repo — ownership / authz lookups (J8, DEC-020 contract). Split out of
// files.ts (contention decomposition) — no behavior change, files.ts
// re-exports everything below for existing callers.

import { and, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { listPlansForEvent, isSubmissionInReviewerScope } from "./review";
import { PORTAL_VISIBLE_INVITE_STATUSES, isActiveParticipant } from "../../domain/acceptance";
import { isPlanOpen } from "../../domain/evaluation";

/** DEC-317: read=not-declined (PORTAL_VISIBLE_INVITE_STATUSES), write=active
 * (ACTIVE_INVITE_STATUSES) — participation is only-in-passing filtered here
 * since PORTAL_VISIBLE_INVITE_STATUSES is a superset of ACTIVE_INVITE_STATUSES;
 * the active set is always a subset of the read set. */
function isPortalVisibleParticipant(inviteStatus: string): boolean {
  return (PORTAL_VISIBLE_INVITE_STATUSES as readonly string[]).includes(inviteStatus);
}

// ---------------------------------------------------------------------------
// Ownership / authz lookups
// ---------------------------------------------------------------------------

export interface SubmissionScope {
  submissionId: string;
  eventId: string;
  orgId: string;
  /** DEC-317 read population: not-declined participants (may SEE the
   * submission while an invite is outstanding) — for speaker IDOR read checks. */
  readParticipantContactIds: string[];
  /** DEC-317 write population: active participants only (may upload/comment/
   * delete) — a strict subset of readParticipantContactIds. */
  activeParticipantContactIds: string[];
  /** submission status — feeds canEditSubmission (DEC-041 edit-lock). */
  status: string;
  /** DAY LABEL close date in epoch ms, or null when the submission has no
   * form (isFormClosed treats null as open) — mirrors
   * loadEditableSubmission's formCloseDate projection. */
  formCloseDate: number | null;
  /** owning event's IANA timezone — isFormClosed expands closeDate in this zone. */
  timezone: string;
}

/** Loads the submission's event/org + participant contact ids, or null if
 * the submission doesn't exist. Used to authz both the upload and list
 * endpoints under /api/v1/submissions/:id/files, and to feed the DEC-041
 * edit-lock check in authzSubmissionWrite. */
export async function getSubmissionScope(db: Db, submissionId: string): Promise<SubmissionScope | null> {
  const subRows = await db
    .select({
      eventId: schema.submission.eventId,
      orgId: schema.event.orgId,
      status: schema.submission.status,
      formCloseDate: schema.form.closeDate,
      timezone: schema.event.timezone,
    })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .leftJoin(schema.form, eq(schema.submission.formId, schema.form.id))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const sub = subRows[0];
  if (!sub) return null;

  // ONE query selecting contactId + inviteStatus, partitioned in TS into the
  // DEC-317 read/write populations — never two round trips.
  const participantRows = await db
    .select({ contactId: schema.participant.contactId, inviteStatus: schema.participant.inviteStatus })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));

  const readParticipantContactIds: string[] = [];
  const activeParticipantContactIds: string[] = [];
  for (const row of participantRows) {
    if (isPortalVisibleParticipant(row.inviteStatus)) readParticipantContactIds.push(row.contactId);
    if (isActiveParticipant(row.inviteStatus)) activeParticipantContactIds.push(row.contactId);
  }

  return {
    submissionId,
    eventId: sub.eventId,
    orgId: sub.orgId,
    readParticipantContactIds,
    activeParticipantContactIds,
    status: sub.status,
    formCloseDate: sub.formCloseDate ? sub.formCloseDate.getTime() : null,
    timezone: sub.timezone,
  };
}

export interface FileScope {
  fileId: string;
  submissionId: string | null;
  eventId: string;
  orgId: string;
  uploadedByContactId: string | null;
  /** DEC-317 read/write split — see SubmissionScope. */
  readParticipantContactIds: string[];
  activeParticipantContactIds: string[];
  filename: string;
  contentType: string;
  r2Key: string;
}

/** Loads a file's authz scope (submission ownership, participants, uploader)
 * for GET /files/:fileId and the comment endpoints — null if not found or
 * the file isn't attached to a submission (stage-1 J8 scope is submission
 * deliverables only). Per DEC-549, a task upload only lands in this
 * submission-linked population when its task.deliverable_kind was declared
 * (non-null) at upload time; uploads from a task with deliverable_kind
 * NULL always have file.submissionId null and are served by
 * getTaskFileScope below instead — the two populations are disjoint on
 * that discriminator. */
// DEC-248 wave-70 amendment sibling check: getFileScope's own .limit(1)
// selects on schema.file.id (the table's primary key) — a single-column
// equality on a unique key, so it's already deterministic; no change needed.
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
    readParticipantContactIds: scope.readParticipantContactIds,
    activeParticipantContactIds: scope.activeParticipantContactIds,
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
  scope: { orgId: string; uploadedByContactId: string | null; readParticipantContactIds: readonly string[] },
  opts?: { reviewerInScope?: boolean },
): boolean {
  if (auth.role === "organizer") {
    return auth.orgId === scope.orgId;
  }
  if (auth.role === "speaker") {
    if (!auth.contactId) return false;
    // DEC-317: the self-upload clause is untouched — an uploader may always
    // read their own upload regardless of invite status.
    return scope.uploadedByContactId === auth.contactId || scope.readParticipantContactIds.includes(auth.contactId);
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
  // DEC-018 (wave-10 amendment): a closed (or not-yet-open) plan can't
  // authorise a download either -- default is a call-site-transparent
  // Date.now(), overridable for tests.
  now: number = Date.now(),
): Promise<boolean> {
  const assignedRows = await db
    .select({ planId: schema.planReviewer.planId })
    .from(schema.planReviewer)
    .innerJoin(schema.evaluationPlan, eq(schema.planReviewer.planId, schema.evaluationPlan.id))
    .where(and(eq(schema.planReviewer.userId, userId), eq(schema.evaluationPlan.eventId, eventId)));
  const assignedPlanIds = new Set(assignedRows.map((r) => r.planId));
  if (assignedPlanIds.size === 0) return false;

  const plans = await listPlansForEvent(db, eventId);
  const candidatePlans = plans.filter(
    (p) =>
      assignedPlanIds.has(p.id) &&
      p.anonymized === false &&
      isPlanOpen(p.openDate, p.closeDate, now, p.timezone),
  );

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
// DEC-248 wave-70 amendment sibling check: getResourceFileScope's first
// .limit(1) (on schema.file.id) is deterministic — unique key. Its second
// .limit(1) (schema.resource, eq(resource.fileId, fileId)) sits on
// resource_file_id_idx, a plain (non-unique) index, so DB schema alone
// doesn't prove one row — but every resource.fileId is written exactly once,
// from a freshly minted file id at resource-creation time (createFileResource
// -> insertResourceFile), and no code path ever repoints an existing
// resource's fileId at another file or vice versa, so the population is 1:1
// in practice. Left unchanged; flagging here per DEC-248's instruction to
// re-read siblings rather than silently leaving the gap unstated.
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
 * upload: DEC-248 population is submissionId-null + referenced by a
 * task_assignment, of ANY kind (not restricted to 'handout'). Two disjoint
 * links can name a task_assignment: the plain-upload path (~/upload) writes
 * task_assignment.fileId pointing AT the file, while the kind='form'
 * onboarding-field path (~/form, DEC-248 amendment wave 10) writes the
 * file's own task_assignment_id pointing back at its assignment (the field
 * answer only ever stores the file id inline in response_json, never a
 * reverse-joinable column on task_assignment). These links are NOT
 * guaranteed to resolve the same assignment — a stale/reassigned
 * task_assignment.fileId can point at a file whose taskAssignmentId now
 * names a different assignment (different speaker). DEC-248 wave-70
 * amendment: the file's OWN task_assignment_id is authoritative (it's the
 * column the file's uploader/owner actually set); the reverse fileId link
 * is only a fallback for files with no taskAssignmentId of their own (the
 * plain ~/upload path never sets it). We therefore query id=taskAssignmentId
 * FIRST when present, and only fall back to the fileId=... query when that
 * lookup returns nothing — never a single or() with no total order, whose
 * winner SQLite is free to pick arbitrarily. Per DEC-549 the discriminator
 * for the ~/upload path is the uploading task's deliverable_kind at upload
 * time: task.deliverable_kind NULL means the resulting file always has
 * submissionId null and is served here; task.deliverable_kind declared
 * (non-null) means the file links to the uploader's submission and is a
 * disjoint population served through getFileScope, not here. Returns null
 * when neither link resolves an assignment (not this population) — mirrors
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
      taskAssignmentId: schema.file.taskAssignmentId,
    })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow || fileRow.submissionId !== null) return null;

  const assignmentSelect = () =>
    db
      .select({
        assignmentContactId: schema.taskAssignment.contactId,
        orgId: schema.event.orgId,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id));

  let assignmentRow: { assignmentContactId: string; orgId: string } | undefined;
  if (fileRow.taskAssignmentId) {
    const ownRows = await assignmentSelect()
      .where(eq(schema.taskAssignment.id, fileRow.taskAssignmentId))
      .limit(1);
    assignmentRow = ownRows[0];
  }
  if (!assignmentRow) {
    const fallbackRows = await assignmentSelect().where(eq(schema.taskAssignment.fileId, fileId)).limit(1);
    assignmentRow = fallbackRows[0];
  }
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
