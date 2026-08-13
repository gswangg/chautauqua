// J6 onboarding tasks repo (DEC-023): task CRUD, assignment creation, and
// assignment status transitions. Split out of repo/tasks.ts for contention
// decomposition (no behavior change) — see repo/tasks.ts's barrel header.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { ApiError } from "../../http";
import { DEC_528, DEC_556 } from "../../../decisions";

void DEC_528; // createTaskAssignments below is set-based under MAX_TASK_ASSIGNMENT_WRITES
// DEC-556: the (task_id, contact_id) uniqueIndex backs the insert below's
// ON CONFLICT target, belt-and-suspenders alongside the existing
// existence-check pre-read (kept for DEC-528's write-burst cap).
void DEC_556;

export type DeliverableKind = "presentation" | "poster" | "handout";

export interface CreateTaskInput {
  kind: "general" | "file_request" | "form";
  title: string;
  description?: string | null;
  dueDate?: number | null;
  required: boolean;
  formId?: string | null;
  // DEC-240: only meaningful when kind='file_request'.
  deliverableKind?: DeliverableKind | null;
}

export interface TaskRecord {
  id: string;
  eventId: string;
  kind: string;
  title: string;
  description: string | null;
  dueDate: number | null;
  required: boolean;
  formId: string | null;
  deliverableKind: string | null;
  createdAt: number;
  updatedAt: number;
}

function toTaskRecord(row: typeof schema.task.$inferSelect): TaskRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate ? row.dueDate.getTime() : null,
    required: row.required,
    formId: row.formId,
    deliverableKind: row.deliverableKind,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** DEC-680: the ONE accepted-speaker predicate — accepted submissions in
 * `eventId` whose participant invite status is still active. Both
 * listAcceptedContactIds below and files-library.ts's listEventHeadshotFiles
 * compose this instead of hand-copying the pair of conditions, so the
 * definition can't drift between the onboarding grid and the headshots tab.
 * Callers AND this with `eq(schema.submission.eventId, eventId)` and their
 * own joins/conditions. */
export function acceptedSpeakerConditions(eventId: string) {
  return and(
    eq(schema.submission.eventId, eventId),
    eq(schema.submission.status, "accepted"),
    inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
  )!;
}

/** Returns the ACTIVE participants (DEC-278 — invite status 'none' or
 * 'accepted') of accepted submissions in the event — the DEC-023
 * assignToAllAccepted expansion target, gated per DEC-283 so a task an
 * organizer creates event-wide doesn't re-add an 'invited' or 'declined'
 * co-speaker to the onboarding grid (mirroring ensureOnboardingTasks'
 * contactIds=null path in ../submissions/status.ts).
 *
 * The SQL WHERE clause is normative per DEC-312: the inviteStatus filter is
 * pushed into the query itself (inArray against ACTIVE_INVITE_STATUSES)
 * rather than filtered in application code, so a test double's WHERE
 * evaluation can't drift from what production SQL actually does. */
/** DEC-754: the ONE predicate for "is this contact an accepted speaker of
 * this event" as a correlated EXISTS against `schema.contact` — the
 * onboarding grid's base row condition (grid.ts) composes this directly so
 * the roster it lists and the set createTask/assignToAllAccepted expand
 * over (via listAcceptedContactIds, built from the same
 * acceptedSpeakerConditions) can never drift apart: a contact this returns
 * true for is a row in the grid whether or not it has any task_assignment
 * yet, and a contact this returns false for never appears no matter how
 * many stale/unrelated assignments it carries. */
export function acceptedSpeakerExistsForContact(eventId: string) {
  return sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${acceptedSpeakerConditions(eventId)})`;
}

/** DEC-776: the ONE overdue-assignment predicate — a task_assignment is
 * "overdue" iff its task belongs to `eventId`, its status is not 'complete'
 * (matching every non-complete status a status enum might grow, not just
 * 'pending'), its task has a due date in the past relative to `now`, AND its
 * contact is currently an accepted speaker on the event (composing
 * acceptedSpeakerExistsForContact so this can never drift from the
 * onboarding roster). Callers must join task_assignment -> task (on
 * task.id = task_assignment.task_id) -> contact (on contact.id =
 * task_assignment.contact_id) before applying this in a WHERE clause, since
 * acceptedSpeakerExistsForContact correlates against schema.contact.id. */
export function overdueAssignmentConditions(eventId: string, now: number) {
  return and(
    eq(schema.task.eventId, eventId),
    sql`${schema.taskAssignment.status} <> 'complete'`,
    sql`${schema.task.dueDate} is not null and ${schema.task.dueDate} < ${now}`,
    acceptedSpeakerExistsForContact(eventId),
  )!;
}

export async function listAcceptedContactIds(db: Db, eventId: string): Promise<string[]> {
  const rows = await db
    .select({ contactId: schema.participant.contactId })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(acceptedSpeakerConditions(eventId));
  return [...new Set(rows.map((r) => r.contactId))];
}

/** DEC-528: the last per-row task_assignment writer in the product — made
 * set-based under this cap, checked BEFORE the first write so an oversized
 * batch (e.g. assignToAllAccepted over a large accepted roster) is refused
 * loudly instead of silently truncated or run one row at a time. */
export const MAX_TASK_ASSIGNMENT_WRITES = 5000;

export async function createTaskAssignments(
  db: Db,
  taskId: string,
  contactIds: string[],
  now: Date,
): Promise<void> {
  if (contactIds.length === 0) return;
  const existing: { contactId: string }[] = [];
  for (const batch of chunkIds(contactIds)) {
    const batchRows = await db
      .select({ contactId: schema.taskAssignment.contactId })
      .from(schema.taskAssignment)
      .where(and(eq(schema.taskAssignment.taskId, taskId), inArray(schema.taskAssignment.contactId, batch)));
    existing.push(...batchRows);
  }
  const already = new Set(existing.map((r) => r.contactId));
  const toCreate = contactIds.filter((id) => !already.has(id));
  if (toCreate.length > MAX_TASK_ASSIGNMENT_WRITES) {
    throw new ApiError(
      "invalid",
      `Task assignments to create (${toCreate.length}) exceed the cap of ${MAX_TASK_ASSIGNMENT_WRITES}`,
      { contactIds: `${toCreate.length} exceeds cap ${MAX_TASK_ASSIGNMENT_WRITES}` },
    );
  }
  const rows = toCreate.map((contactId) => ({
    id: newId(),
    taskId,
    contactId,
    status: "pending" as const,
    createdAt: now,
    updatedAt: now,
  }));
  for (const chunk of chunkRowsForInsert(rows)) {
    await db
      .insert(schema.taskAssignment)
      .values(chunk)
      .onConflictDoNothing({ target: [schema.taskAssignment.taskId, schema.taskAssignment.contactId] });
  }
}

export async function createTask(db: Db, eventId: string, input: CreateTaskInput): Promise<TaskRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.task).values({
    id,
    eventId,
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    dueDate: input.dueDate !== null && input.dueDate !== undefined ? new Date(input.dueDate) : null,
    required: input.required,
    formId: input.formId ?? null,
    deliverableKind: input.deliverableKind ?? null,
    createdAt: now,
    updatedAt: now,
  });

  // DEC-746: createTask always expands to every accepted speaker (with an
  // active invite, per DEC-283/DEC-278) -- there is no longer an opt-out.
  const contactIds = await listAcceptedContactIds(db, eventId);
  await createTaskAssignments(db, id, contactIds, now);

  const rows = await db.select().from(schema.task).where(eq(schema.task.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("createTask: insert did not persist");
  return toTaskRecord(row);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueDate?: number | null;
  required?: boolean;
  formId?: string | null;
  // DEC-240: only meaningful when the task's kind is 'file_request'.
  deliverableKind?: DeliverableKind | null;
}

export async function updateTask(db: Db, taskId: string, input: UpdateTaskInput): Promise<TaskRecord> {
  const now = new Date();
  await db
    .update(schema.task)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate !== null && input.dueDate !== undefined ? new Date(input.dueDate) : null } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.formId !== undefined ? { formId: input.formId } : {}),
      ...(input.deliverableKind !== undefined ? { deliverableKind: input.deliverableKind } : {}),
      updatedAt: now,
    })
    .where(eq(schema.task.id, taskId));

  const rows = await db.select().from(schema.task).where(eq(schema.task.id, taskId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`updateTask: task ${taskId} not found after update`);
  return toTaskRecord(row);
}

export async function deleteTask(db: Db, taskId: string): Promise<void> {
  await db.delete(schema.taskAssignment).where(eq(schema.taskAssignment.taskId, taskId));
  await db.delete(schema.task).where(eq(schema.task.id, taskId));
}

export async function assignTask(db: Db, taskId: string, contactIds: string[]): Promise<void> {
  await createTaskAssignments(db, taskId, contactIds, new Date());
}

export type TaskAssignmentStatus = "pending" | "complete";

export interface AssignmentRecord {
  id: string;
  taskId: string;
  contactId: string;
  status: string;
  completedAt: number | null;
  completedBy: string | null;
  fileId: string | null;
  responseJson: string | null;
  lastRemindedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

function toAssignmentRecord(row: typeof schema.taskAssignment.$inferSelect): AssignmentRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    contactId: row.contactId,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.getTime() : null,
    completedBy: row.completedBy,
    fileId: row.fileId,
    responseJson: row.responseJson,
    lastRemindedAt: row.lastRemindedAt ? row.lastRemindedAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** Sets status, stamping completedAt/completedBy(acting user) on transition
 * to 'complete'; clearing them on transition back to 'pending'. */
export async function updateAssignmentStatus(
  db: Db,
  assignmentId: string,
  status: TaskAssignmentStatus,
  actingUserId: string,
  now: Date,
): Promise<AssignmentRecord> {
  await db
    .update(schema.taskAssignment)
    .set({
      status,
      completedAt: status === "complete" ? now : null,
      completedBy: status === "complete" ? actingUserId : null,
      updatedAt: now,
    })
    .where(eq(schema.taskAssignment.id, assignmentId));

  const rows = await db
    .select()
    .from(schema.taskAssignment)
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`updateAssignmentStatus: assignment ${assignmentId} not found after update`);
  return toAssignmentRecord(row);
}
