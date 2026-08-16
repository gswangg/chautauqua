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
import { isUniqueViolation } from "../constraints";
import { DEC_528, DEC_556, DEC_746, DEC_801 } from "../../../decisions";
import { ASSIGNED_LATE_GRACE_DAYS, overdueDayCutoff } from "../../../domain/task-due";
import type { FileKind } from "../../../domain/files";
import { DEFAULT_TASK_AUDIENCE, type TaskAudience } from "../../../domain/task-kinds";

void DEC_746; // wave-77 amendment: task.audience is stamped here, per input.contactIds.

void DEC_801; // overdueAssignmentConditions below composes the DEC-801 grace window.

void DEC_528; // createTaskAssignments below is set-based under MAX_TASK_ASSIGNMENT_WRITES
// DEC-556: the (task_id, contact_id) uniqueIndex backs the insert below's
// ON CONFLICT target, belt-and-suspenders alongside the existing
// existence-check pre-read (kept for DEC-528's write-burst cap).
void DEC_556;

export type DeliverableKind = FileKind;

export interface CreateTaskInput {
  kind: "general" | "file_request" | "form";
  title: string;
  description?: string | null;
  dueDate?: number | null;
  required: boolean;
  formId?: string | null;
  // DEC-240: only meaningful when kind='file_request'.
  deliverableKind?: DeliverableKind | null;
  // CNT-01 (migrations/0036): a free-text brief for the assignee, distinct
  // from `description`. null clears/omits it.
  instructions?: string | null;
  // DEC-746 (wave 59 amendment, REVERSES the original "creation always
  // expands" clause): when present, the caller has already validated this
  // is a non-empty array of ids that all pass filterRosterContactIds for
  // this event -- createTask assigns exactly this set instead of expanding.
  // Absent means every accepted speaker, byte-for-byte the original
  // behavior.
  contactIds?: string[];
  // DEC-746 (wave-77 amendment): the caller (routes/tasks.ts) stamps
  // 'targeted' when contactIds is present, DEFAULT_TASK_AUDIENCE otherwise.
  // Omitted means DEFAULT_TASK_AUDIENCE ('everyone'), matching the schema
  // column's own default -- callers that don't care about audience (tests,
  // getOrCreateTask's default-onboarding-template path) need not thread it.
  audience?: TaskAudience;
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
  instructions: string | null;
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
    instructions: row.instructions,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** DEC-680: the ONE accepted-speaker predicate — accepted submissions in
 * `eventId` whose participant invite status is still active. Both
 * listAcceptedContactIds below and files-library.ts's listEventDeliverableFiles
 * headshot branch (DEC-773) compose this instead of hand-copying the pair
 * of conditions, so the definition can't drift between the onboarding grid
 * and the files library's headshot rows. Callers AND this with
 * `eq(schema.submission.eventId, eventId)` and their own joins/conditions. */
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
/** DEC-754 (narrowed by DEC-829): the ONE predicate for "is this contact an
 * accepted AND invite-active speaker of this event" as a correlated EXISTS
 * against `schema.contact` — composed by createTask/assignToAllAccepted's
 * expansion target (via listAcceptedContactIds, built from the same
 * acceptedSpeakerConditions), overdueAssignmentConditions, and other
 * task-assignment/chasing/visibility consumers. The Speakers roster GRID
 * (grid.ts) no longer composes this directly — it composes the wider
 * rosterParticipantExistsForContact below, so an 'invited'/'declined'
 * participant can still be a row even though this predicate (correctly)
 * excludes them from task expansion. */
export function acceptedSpeakerExistsForContact(eventId: string) {
  return sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${acceptedSpeakerConditions(eventId)})`;
}

/** DEC-829 amendment (wave 59): the ONE 'chase' predicate — the same
 * correlated EXISTS as acceptedSpeakerExistsForContact above (an accepted
 * submission with an invite-active participant), but correlated against
 * `schema.taskAssignment.contactId` instead of `schema.contact.id`, so
 * queries that build a task_assignment -> task -> event chain WITHOUT ever
 * joining `contact` (reminders.ts's listOutstandingForEvent and
 * listRemindableContactIds) can still compose it in their WHERE clause. A
 * speaker who has declined every accepted submission on the event must
 * never be chased for an outstanding task, matching what
 * overdueAssignmentConditions already reports via
 * acceptedSpeakerExistsForContact. */
export function chaseableContactExists(eventId: string) {
  return sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.taskAssignment.contactId} and ${acceptedSpeakerConditions(eventId)})`;
}

/** DEC-776 amendment (wave 61): the ONE 'still owes something' predicate —
 * chaseableContactExists above, but with the event correlated on
 * schema.task.eventId instead of a bound literal, so callers that already
 * have task_assignment -> task joined (the onboarding grid's countsRow, and
 * the speaker portal's getMyTaskAssignments) can compose it without binding
 * an eventId up front. Built from the same acceptedSpeakerConditions /
 * ACTIVE_INVITE_STATUSES this file's other predicates use, so the organizer's
 * counts and the speaker's own portal can never drift apart on who still
 * "owes" a task. */
export function chaseableContactExistsForTaskEvent() {
  return sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.taskAssignment.contactId} and ${schema.submission.eventId} = ${schema.task.eventId} and ${schema.submission.status} = 'accepted' and ${inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES])})`;
}

/** DEC-829: the ONE roster-participant predicate — accepted submissions in
 * `eventId`, with NO inviteStatus clause (unlike acceptedSpeakerConditions
 * above, which restricts to ACTIVE_INVITE_STATUSES). This is the base set
 * for the Speakers roster GRID (grid.ts): a participant whose invite status
 * is 'invited' or 'declined' is still a row on that roster (with its status
 * visible), even though it is NOT part of the task-expansion/chasing set
 * acceptedSpeakerConditions defines. Every other consumer of "who gets a
 * task assignment / chase / public-visible slot" (listAcceptedContactIds,
 * overdueAssignmentConditions, files-library's headshot branch, comms
 * audiences, public/portal access) keeps composing acceptedSpeakerConditions
 * unchanged. */
export function rosterParticipantConditions(eventId: string) {
  return and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted"))!;
}

/** DEC-829: the correlated EXISTS twin of rosterParticipantConditions,
 * against `schema.contact` — the onboarding/Speakers grid's base row
 * condition (grid.ts) composes this (not acceptedSpeakerExistsForContact)
 * so a row, its invite-status control, and the ?inviteStatus= filter pills
 * all range over the same widened roster set: 'none', 'invited', 'accepted'
 * and 'declined' participants of an accepted submission can all appear. */
export function rosterParticipantExistsForContact(eventId: string) {
  return sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${rosterParticipantConditions(eventId)})`;
}

/** DEC-776 (narrowed by DEC-801 wave-58 amendment, J6): the ONE
 * overdue-assignment predicate — a task_assignment is "overdue" iff its task
 * belongs to `eventId`, its status is not 'complete' (matching every
 * non-complete status a status enum might grow, not just 'pending'), it is
 * overdue per ../../../domain/task-due.ts's isAssignmentOverdue, AND its
 * contact is currently an accepted speaker on the event (composing
 * acceptedSpeakerExistsForContact so this can never drift from the
 * onboarding roster). Callers must join task_assignment -> task (on
 * task.id = task_assignment.task_id) -> contact (on contact.id =
 * task_assignment.contact_id) before applying this in a WHERE clause, since
 * acceptedSpeakerExistsForContact correlates against schema.contact.id.
 *
 * DEC-801 wave-58: task.dueDate is a DAY LABEL (a UTC-midnight stand-in for
 * a calendar date), not an instant — comparing it directly to `now` (the
 * pre-amendment behavior) flags a task overdue as soon as UTC midnight
 * passes, up to ~16 hours before the due day even begins in the event's own
 * timezone. `timeZone` must be the OWNING EVENT's timezone (event-time.ts
 * convention). The CASE mirrors isAssignmentOverdue: when the task's own
 * due date holds (>= assignment.createdAt), overdue means the due date's day
 * label is strictly before `now`'s day label in `timeZone` (overdueDayCutoff
 * — the SQL-comparable twin of dayLabelEndInstant's boundary); otherwise
 * (the grace-window branch) the effective due date is already a real
 * instant (assignment.createdAt + grace), so it's compared to `now`
 * directly, no timezone expansion needed. */
export function overdueAssignmentConditions(eventId: string, now: number, timeZone: string) {
  const graceMs = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = overdueDayCutoff(now, timeZone);
  const isOverdue = sql`(case when ${schema.task.dueDate} >= ${schema.taskAssignment.createdAt} then ${schema.task.dueDate} < ${cutoff} else ${schema.taskAssignment.createdAt} + ${graceMs} < ${now} end)`;
  return and(
    eq(schema.task.eventId, eventId),
    sql`${schema.taskAssignment.status} <> 'complete'`,
    sql`${schema.task.dueDate} is not null and ${isOverdue}`,
    acceptedSpeakerExistsForContact(eventId),
  )!;
}

/** DEC-754 amendment (wave 38): task assignment must range over the event
 * ROSTER (rosterParticipantConditions -- any invite status), not the org
 * contact directory -- assign was validating contactIds only against
 * findContactsForOrg, letting an organizer mint a task_assignment row for a
 * contact who is not a participant on any accepted submission of this
 * event, which the grid (rosterParticipantExistsForContact) then never
 * lists and neither reminder path (chaseableContactExists) ever chases.
 * Chunked (chunkIds, DEC-078) against the SAME rosterParticipantConditions
 * predicate the grid composes, never a second copy of the roster rule.
 * Returns the distinct subset of `contactIds` that IS on the roster. */
export async function filterRosterContactIds(db: Db, eventId: string, contactIds: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunkIds(contactIds)) {
    const rows = await db
      .selectDistinct({ contactId: schema.participant.contactId })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .where(and(rosterParticipantConditions(eventId), inArray(schema.participant.contactId, batch)));
    for (const row of rows) found.add(row.contactId);
  }
  return found;
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

/** DEC-528 amendment (wave 10): given how many task_assignment rows a single
 * planning unit (e.g. one accepted submission's participant, who gets one row
 * per event task) produces, returns the largest number of such units a single
 * call can plan/write before crossing MAX_TASK_ASSIGNMENT_WRITES. Shared so a
 * refusal message that names "the largest batch that would succeed" can never
 * drift from the cap it's derived from. */
export function maxUnitsForTaskAssignmentWrites(rowsPerUnit: number): number {
  if (rowsPerUnit <= 0) {
    throw new Error(`maxUnitsForTaskAssignmentWrites: rowsPerUnit must be positive, got ${rowsPerUnit}`);
  }
  return Math.floor(MAX_TASK_ASSIGNMENT_WRITES / rowsPerUnit);
}

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

/** DEC-111 amendment (wave 48): task_event_id_title_idx (migrations/0032_
 * task_title_unique.sql) is a real UNIQUE(event_id, title) DB constraint —
 * an organizer-typed title colliding with an existing task on the same
 * event surfaces as a named field error, mirroring patchSegment's
 * (../contacts/segments.ts) UNIQUE-constraint-to-ApiError translation, not
 * an uncaught 500. */
const TASK_TITLE_COLLISION_FIELDS = { title: "A task with this title already exists for this event" };

export async function createTask(db: Db, eventId: string, input: CreateTaskInput): Promise<TaskRecord> {
  const now = new Date();
  const id = newId();
  try {
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
      instructions: input.instructions ?? null,
      audience: input.audience ?? DEFAULT_TASK_AUDIENCE,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isUniqueViolation(err, "task.title")) {
      throw new ApiError("invalid", "A task with this title already exists for this event", TASK_TITLE_COLLISION_FIELDS);
    }
    throw err;
  }

  // DEC-746 (wave 59 amendment, REVERSES the original always-expand
  // clause): input.contactIds, when present, is an explicit non-empty
  // roster subset the caller (routes/tasks.ts) has already validated via
  // filterRosterContactIds -- use it as-is. Absent still expands to every
  // accepted speaker (with an active invite, per DEC-283/DEC-278),
  // byte-for-byte the original behavior.
  const contactIds = input.contactIds ?? (await listAcceptedContactIds(db, eventId));
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
  // CNT-01 (migrations/0036): a free-text brief for the assignee, distinct
  // from `description`. null clears it.
  instructions?: string | null;
}

export async function updateTask(db: Db, taskId: string, input: UpdateTaskInput): Promise<TaskRecord> {
  const now = new Date();
  let rows: (typeof schema.task.$inferSelect)[];
  try {
    rows = await db
      .update(schema.task)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate !== null && input.dueDate !== undefined ? new Date(input.dueDate) : null } : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.formId !== undefined ? { formId: input.formId } : {}),
        ...(input.deliverableKind !== undefined ? { deliverableKind: input.deliverableKind } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        updatedAt: now,
      })
      .where(eq(schema.task.id, taskId))
      .returning();
  } catch (err) {
    if (isUniqueViolation(err, "task.title")) {
      throw new ApiError("invalid", "A task with this title already exists for this event", TASK_TITLE_COLLISION_FIELDS);
    }
    throw err;
  }

  const row = rows[0];
  if (!row) throw new Error(`updateTask: task ${taskId} not found after update`);
  return toTaskRecord(row);
}

export interface TaskDeleteImpact {
  assigned: number;
  completed: number;
  responses: number;
  files: number;
}

/** DEC-933 amendment (wave 63): task deletion names what it destroys --
 * feeds the delete confirmation dialog's prose, event-wide (never the
 * paginated/filtered grid page). One grouped aggregate over
 * task_assignment (never a per-row scan, never a query per column). */
export async function countTaskDeleteImpact(db: Db, taskId: string): Promise<TaskDeleteImpact> {
  const rows = await db
    .select({
      assigned: sql<number>`count(*)`,
      completed: sql<number>`count(case when ${schema.taskAssignment.status} = 'complete' then 1 end)`,
      responses: sql<number>`count(case when ${schema.taskAssignment.responseJson} is not null then 1 end)`,
      files: sql<number>`count(case when ${schema.taskAssignment.fileId} is not null then 1 end)`,
    })
    .from(schema.taskAssignment)
    .where(eq(schema.taskAssignment.taskId, taskId));
  return {
    assigned: Number(rows[0]?.assigned ?? 0),
    completed: Number(rows[0]?.completed ?? 0),
    responses: Number(rows[0]?.responses ?? 0),
    files: Number(rows[0]?.files ?? 0),
  };
}

/** DEC-933 amendment: matches countTaskDeleteImpact's tally exactly so the
 * confirm dialog's numbers are never a lie about what this actually
 * deletes. */
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
// DEC-962 (wave-63 amendment): the organizer route (src/routes/tasks.ts)
// legitimately updates any contact's assignment in its org, already scoped
// upstream by event/org authz — but the speaker portal route
// (src/routes/portal/tasks.tsx) can only ever act on its OWN assignment.
// scopeContactId is optional (undefined preserves the unscoped statement for
// the organizer caller, no regression) so the portal caller can pass its own
// contactId and have the WHERE itself refuse a foreign assignment, in
// addition to (never instead of) the upstream assertOwnAssignmentOr403
// check that already runs there.
export async function updateAssignmentStatus(
  db: Db,
  assignmentId: string,
  status: TaskAssignmentStatus,
  actingUserId: string,
  now: Date,
  scopeContactId?: string,
): Promise<AssignmentRecord> {
  const rows = await db
    .update(schema.taskAssignment)
    .set({
      status,
      completedAt: status === "complete" ? now : null,
      completedBy: status === "complete" ? actingUserId : null,
      updatedAt: now,
    })
    .where(
      scopeContactId
        ? and(eq(schema.taskAssignment.id, assignmentId), eq(schema.taskAssignment.contactId, scopeContactId))
        : eq(schema.taskAssignment.id, assignmentId),
    )
    .returning();
  const row = rows[0];
  if (!row) throw new Error(`updateAssignmentStatus: assignment ${assignmentId} not found after update`);
  return toAssignmentRecord(row);
}
