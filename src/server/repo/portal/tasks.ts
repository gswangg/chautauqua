// J7 portal depth (DEC-029/DEC-028): task_assignment reads/writes + DEC-240
// deliverable-submission linkage. Every query below filters by the
// speaker's own contact_id and/or the events they participate in — no IDOR.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import type { SubmissionStatus } from "../../../domain/status";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";

// 'general' | 'file_request' | 'form' — DEC-003 task.kind literal.
export type PortalTaskKind = "general" | "file_request" | "form";

export interface PortalTaskAssignment {
  id: string;
  taskId: string;
  eventId: string;
  kind: PortalTaskKind;
  title: string;
  description: string | null;
  dueDate: number | null;
  required: boolean;
  status: string;
  formId: string | null;
  fileId: string | null;
  responseJson: string | null;
  timezone: string;
  completedAt: number | null;
}

/** Lists every task_assignment belonging to `contactId`, joined through task
 * -> event and scoped to the caller's org. */
export async function getMyTaskAssignments(db: Db, contactId: string, orgId: string): Promise<PortalTaskAssignment[]> {
  const rows = await db
    .select({
      id: schema.taskAssignment.id,
      taskId: schema.taskAssignment.taskId,
      eventId: schema.task.eventId,
      status: schema.taskAssignment.status,
      fileId: schema.taskAssignment.fileId,
      responseJson: schema.taskAssignment.responseJson,
      completedAt: schema.taskAssignment.completedAt,
      kind: schema.task.kind,
      title: schema.task.title,
      description: schema.task.description,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
      formId: schema.task.formId,
      eventOrgId: schema.event.orgId,
      timezone: schema.event.timezone,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(and(eq(schema.taskAssignment.contactId, contactId), eq(schema.event.orgId, orgId)));

  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    eventId: row.eventId,
    kind: row.kind as PortalTaskKind,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate ? row.dueDate.getTime() : null,
    required: row.required,
    status: row.status,
    formId: row.formId,
    fileId: row.fileId,
    responseJson: row.responseJson,
    timezone: row.timezone,
    completedAt: row.completedAt ? row.completedAt.getTime() : null,
  }));
}

export interface PortalAssignmentScope {
  id: string;
  taskId: string;
  eventId: string;
  kind: PortalTaskKind;
  formId: string | null;
  // DEC-240: the file kind the task's uploads should use ('presentation'|
  // 'poster'|'handout'); null for non-file_request tasks or unset ones (the
  // upload site falls back to 'handout').
  deliverableKind: string | null;
  contactId: string;
  orgId: string;
  status: string;
  // current linked file, if any — DEC-240 re-uploads chain previous_file_id
  // to this value and replace it.
  fileId: string | null;
}

/** Ownership + kind lookup for a single task_assignment, used by every
 * /portal/tasks/:assignmentId/* completion route before touching the row —
 * the caller must compare `.contactId` against the authenticated speaker's
 * own contactId (never trust the :assignmentId path param alone). */
export async function getAssignmentScope(db: Db, assignmentId: string): Promise<PortalAssignmentScope | null> {
  const rows = await db
    .select({
      id: schema.taskAssignment.id,
      taskId: schema.taskAssignment.taskId,
      eventId: schema.task.eventId,
      contactId: schema.taskAssignment.contactId,
      status: schema.taskAssignment.status,
      kind: schema.task.kind,
      formId: schema.task.formId,
      deliverableKind: schema.task.deliverableKind,
      fileId: schema.taskAssignment.fileId,
      orgId: schema.event.orgId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.taskId,
    eventId: row.eventId,
    kind: row.kind as PortalTaskKind,
    formId: row.formId,
    deliverableKind: row.deliverableKind,
    contactId: row.contactId,
    orgId: row.orgId,
    status: row.status,
    fileId: row.fileId,
  };
}

// ---------------------------------------------------------------------------
// DEC-240: deterministic submission linkage for task-assignment uploads
// ---------------------------------------------------------------------------

export interface DeliverableSubmissionCandidate {
  id: string;
  status: SubmissionStatus;
  seq: number;
}

/** Pure tie-break: the uploader-contact's participant submission in the
 * task's event — an 'accepted' one with the lowest seq if any exist, else
 * the lowest-seq submission of any status, else null (no participant
 * submissions at all — e.g. a staff/organizer-only contact). DEC-240. */
export function pickDeliverableSubmission(candidates: DeliverableSubmissionCandidate[]): string | null {
  if (candidates.length === 0) return null;
  const accepted = candidates.filter((c) => c.status === "accepted");
  const pool = accepted.length > 0 ? accepted : candidates;
  const lowest = pool.reduce((best, c) => (c.seq < best.seq ? c : best));
  return lowest.id;
}

/** Resolves the file.submission_id a task-assignment upload from `contactId`
 * in `eventId` should link to, per DEC-240's deterministic rule. */
export async function resolveDeliverableSubmissionId(
  db: Db,
  contactId: string,
  eventId: string,
): Promise<string | null> {
  const rows = await db
    .select({
      id: schema.submission.id,
      status: schema.submission.status,
      seq: schema.submission.seq,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.submission.eventId, eventId),
        inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),
      ),
    );
  return pickDeliverableSubmission(rows as DeliverableSubmissionCandidate[]);
}

/** Pure ownership guard for a task_assignment: only the speaker whose own
 * contact_id matches may act on it — 403 otherwise (no IDOR across the
 * portal's task-assignment routes). */
export function assertOwnAssignment(scope: PortalAssignmentScope, contactId: string): void {
  if (scope.contactId !== contactId) {
    throw new Error("assignment does not belong to this contact");
  }
}

/** kind='form' task_assignment completion: stores the answer JSON blob.
 * Status transition to 'complete' is applied separately by
 * src/server/repo/tasks.ts's updateAssignmentStatus (DEC-023 owns assignment
 * status semantics — this module never duplicates that logic). */
export async function saveTaskFormResponse(db: Db, assignmentId: string, responseJson: string): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ responseJson, updatedAt: new Date() })
    .where(eq(schema.taskAssignment.id, assignmentId));
}

/** kind='file_request' task_assignment completion: links the uploaded file
 * row. Status transition to 'complete' is applied separately (see above). */
export async function saveTaskFileCompletion(db: Db, assignmentId: string, fileId: string): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ fileId, updatedAt: new Date() })
    .where(eq(schema.taskAssignment.id, assignmentId));
}
