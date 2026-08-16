// J7 portal depth (DEC-029/DEC-028): task_assignment reads/writes + DEC-240
// deliverable-submission linkage. Every query below filters by the
// speaker's own contact_id and/or the events they participate in — no IDOR.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import type { SubmissionStatus } from "../../../domain/status";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { formatRef } from "../../../domain/ids";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";
import { chaseableContactExistsForTaskEvent } from "../tasks/crud";
import type { TaskKind } from "../../../domain/task-kinds";

// Alias of the shared vocabulary (DEC-613 wave-70 amendment) —
// src/domain/task-kinds.ts is the ONE declaration.
export type PortalTaskKind = TaskKind;

export interface PortalTaskAssignment {
  id: string;
  taskId: string;
  eventId: string;
  kind: PortalTaskKind;
  title: string;
  description: string | null;
  // CNT-01 (migrations/0036): a free-text brief for the assignee, rendered
  // in plain body ink on the speaker's own task row (never behind a
  // disclosure) -- distinct from `description`.
  instructions: string | null;
  dueDate: number | null;
  // DEC-826: the assignment's own createdAt, needed by every caller that
  // must judge lateness via effectiveAssignmentDueDate — a task cannot be
  // late before it was assigned (src/domain/task-due.ts).
  assignedAt: number;
  required: boolean;
  status: string;
  formId: string | null;
  // DEC-891: null for non-file_request tasks or unset ones — mirrors
  // PortalAssignmentScope.deliverableKind (the file kind that decides
  // whether an upload links to a session deliverable at all).
  deliverableKind: string | null;
  fileId: string | null;
  responseJson: string | null;
  timezone: string;
  completedAt: number | null;
}

/** Lists every task_assignment belonging to `contactId`, joined through task
 * -> event and scoped to the caller's org. DEC-776 amendment (wave 61): also
 * composes chaseableContactExistsForTaskEvent — the same "still owes
 * something" predicate the onboarding grid's counts use — so a speaker who
 * has declined every accepted submission on the event (or whose submission
 * left 'accepted') no longer sees that event's tasks on their own portal.
 * Nothing is deleted: the rows return the moment the contact is chaseable
 * again (e.g. re-accepting the invite, or a second accepted participation). */
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
      assignedAt: schema.taskAssignment.createdAt,
      kind: schema.task.kind,
      title: schema.task.title,
      description: schema.task.description,
      instructions: schema.task.instructions,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
      formId: schema.task.formId,
      deliverableKind: schema.task.deliverableKind,
      eventOrgId: schema.event.orgId,
      timezone: schema.event.timezone,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(
      and(
        eq(schema.taskAssignment.contactId, contactId),
        eq(schema.event.orgId, orgId),
        chaseableContactExistsForTaskEvent(),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    eventId: row.eventId,
    kind: row.kind as PortalTaskKind,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    dueDate: row.dueDate ? row.dueDate.getTime() : null,
    assignedAt: row.assignedAt.getTime(),
    required: row.required,
    status: row.status,
    formId: row.formId,
    deliverableKind: row.deliverableKind,
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
// DEC-891: explicit-choice submission linkage for task-assignment uploads
//
// A speaker with two accepted sessions in the same event has ONE
// task_assignment for a file_request task (task_assignment is UNIQUE(task_id,
// contact_id) per migrations/0019_join_table_uniqueness.sql:33) but TWO
// candidate submissions to link an upload to. Rather than a deterministic
// tie-break that silently always picks the same one (the DEC-240 bug this
// supersedes: slides for the second session landed on the first), the
// speaker now chooses explicitly via a `submissionId` form field whenever
// there's more than one candidate.
// ---------------------------------------------------------------------------

export interface DeliverableCandidate {
  id: string;
  ref: string;
  title: string;
  status: SubmissionStatus;
  seq: number;
}

/** Every accepted-session candidate `contactId` could link a task-assignment
 * upload to within `eventId`, ordered seq asc. Scoped by ACTIVE_INVITE_STATUSES
 * exactly as the prior DEC-240 resolver was (no IDOR: only the caller's own
 * participant rows). */
export async function listDeliverableCandidates(db: Db, contactId: string, eventId: string): Promise<DeliverableCandidate[]> {
  const rows = await db
    .select({
      id: schema.submission.id,
      status: schema.submission.status,
      seq: schema.submission.seq,
      title: schema.submission.title,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.submission.eventId, eventId),
        eq(schema.submission.status, "accepted"),
        inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),
      ),
    )
    .orderBy(schema.submission.seq);

  return rows.map((row) => ({
    id: row.id,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    status: row.status as SubmissionStatus,
    seq: row.seq,
  }));
}

/** Batched form of listDeliverableCandidates: the portal submission-detail
 * route's per-file_request-task candidate lookup, done once for the deduped
 * set of eventIds rather than once PER task. Preserves the exact
 * participant/ACTIVE_INVITE_STATUSES scoping (contactId's own participant
 * rows only — no IDOR widening) and seq-asc order within each event; chunked
 * via chunkIds over the eventId list (DEC-078 D1 bound-parameter ceiling).
 * DEC-962 audit: this reader already carries contactId inside the SAME
 * query's WHERE (eq(schema.participant.contactId, contactId) below) — a
 * foreign eventId contributes no row, by construction. No change needed. */
export async function listDeliverableCandidatesForEvents(
  db: Db,
  contactId: string,
  eventIds: string[],
): Promise<Map<string, DeliverableCandidate[]>> {
  const out = new Map<string, DeliverableCandidate[]>();
  const dedupedIds = [...new Set(eventIds)];
  if (dedupedIds.length === 0) return out;
  for (const chunk of chunkIds(dedupedIds)) {
    const rows = await db
      .select({
        id: schema.submission.id,
        status: schema.submission.status,
        seq: schema.submission.seq,
        title: schema.submission.title,
        recordPrefix: schema.event.recordPrefix,
        eventId: schema.submission.eventId,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
      .where(
        and(
          eq(schema.participant.contactId, contactId),
          inArray(schema.submission.eventId, chunk),
          eq(schema.submission.status, "accepted"),
          inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),
        ),
      )
      .orderBy(schema.submission.seq);

    for (const row of rows) {
      const candidate: DeliverableCandidate = {
        id: row.id,
        ref: formatRef(row.recordPrefix, row.seq),
        title: row.title,
        status: row.status as SubmissionStatus,
        seq: row.seq,
      };
      const existing = out.get(row.eventId);
      if (existing) existing.push(candidate);
      else out.set(row.eventId, [candidate]);
    }
  }
  return out;
}

/** Pure: resolves the file.submission_id a task-assignment upload should
 * link to, given the speaker's own candidate set and the `submissionId`
 * they posted (null if the form had no such control — the zero/one-candidate
 * case, DEC-891's "conditional-and-quiet" rule). Zero candidates always
 * resolves to null (a plain handout upload, no session to link). Never
 * silently guesses across 2+ candidates: an absent choice there is a
 * validation error, and a choice outside the candidate set is a forbidden
 * (never evidence-revealing) rejection. */
export function resolveChosenDeliverable(candidates: DeliverableCandidate[], chosenId: string | null): string | null {
  if (candidates.length === 0) return null;
  if (chosenId != null) {
    const match = candidates.find((c) => c.id === chosenId);
    if (!match) throw new ApiError("forbidden", "submissionId does not belong to this speaker");
    return match.id;
  }
  if (candidates.length === 1) return candidates[0]!.id;
  throw new ApiError("invalid", "submissionId is required when more than one session is eligible", {
    submissionId: "Required",
  });
}

/** Thrown by assertOwnAssignment for the one legitimate case it detects: the
 * assignment belongs to a different contact. Callers (assertOwnAssignmentOr403)
 * must only relabel this as a 403 — any other exception is an internal fault
 * and must surface as-is (DEC-029 amendment). */
export class ForeignAssignmentError extends Error {}

/** Pure ownership guard for a task_assignment: only the speaker whose own
 * contact_id matches may act on it — 403 otherwise (no IDOR across the
 * portal's task-assignment routes). */
export function assertOwnAssignment(scope: PortalAssignmentScope, contactId: string): void {
  if (scope.contactId !== contactId) {
    throw new ForeignAssignmentError("assignment does not belong to this contact");
  }
}

/** kind='form' task_assignment completion: stores the answer JSON blob.
 * Status transition to 'complete' is applied separately by
 * src/server/repo/tasks.ts's updateAssignmentStatus (DEC-023 owns assignment
 * status semantics — this module never duplicates that logic).
 *
 * DEC-962 (wave-63 amendment): contactId is part of the WHERE, not just an
 * upstream assertOwnAssignment check — a caller's memory is not a scope.
 * Callers already hold contactId (it is the authenticated speaker's own id)
 * and MUST keep calling assertOwnAssignment first (defence in depth, not a
 * replacement): the JS check gives a clean 403 with a message, this predicate
 * makes a foreign id write zero rows even if the JS check is ever skipped. */
export async function saveTaskFormResponse(
  db: Db,
  assignmentId: string,
  contactId: string,
  responseJson: string,
): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ responseJson, updatedAt: new Date() })
    .where(and(eq(schema.taskAssignment.id, assignmentId), eq(schema.taskAssignment.contactId, contactId)));
}

/** kind='file_request' task_assignment completion: links the uploaded file
 * row. Status transition to 'complete' is applied separately (see above).
 * DEC-962 (wave-63 amendment): see saveTaskFormResponse above. */
export async function saveTaskFileCompletion(
  db: Db,
  assignmentId: string,
  contactId: string,
  fileId: string,
): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ fileId, updatedAt: new Date() })
    .where(and(eq(schema.taskAssignment.id, assignmentId), eq(schema.taskAssignment.contactId, contactId)));
}
