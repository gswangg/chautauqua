// J6 onboarding tasks repo (DEC-023): grid payload, task CRUD, assignment
// status, reminder sends. Repo functions are the only code touching drizzle
// row types (DEC-012); handlers in src/routes/tasks.ts stay thin.

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { Mailer } from "../../mail/types";
import { renderTemplate } from "../../mail/render";
import type { ReminderAssignment } from "../../domain/reminders";
import { planReminders } from "../../domain/reminders";

// ---------------------------------------------------------------------------
// Ownership helpers
// ---------------------------------------------------------------------------

export async function getEventOrgId(db: Db, eventId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

/** Returns the (eventId, orgId) owning a task row, or null if it doesn't exist. */
export async function getTaskOwnership(
  db: Db,
  taskId: string,
): Promise<{ eventId: string; orgId: string } | null> {
  const rows = await db
    .select({ eventId: schema.task.eventId, orgId: schema.event.orgId })
    .from(schema.task)
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.task.id, taskId))
    .limit(1);
  return rows[0] ?? null;
}

/** Returns ownership info for a task_assignment row: event/org (for the
 * organizer authz path) plus the assignment's own contactId (for the
 * owning-speaker authz path — DEC-023 PATCH allows organizer OR the owning
 * speaker, compared against c.var.auth.contactId). */
export async function getAssignmentOwnership(
  db: Db,
  assignmentId: string,
): Promise<{ eventId: string; orgId: string; contactId: string } | null> {
  const rows = await db
    .select({
      eventId: schema.task.eventId,
      orgId: schema.event.orgId,
      contactId: schema.taskAssignment.contactId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Grid payload (GET /api/v1/events/:eventId/onboarding)
// ---------------------------------------------------------------------------

export interface GridTask {
  id: string;
  kind: string;
  title: string;
  dueDate: number | null;
  required: boolean;
}

export interface GridCell {
  taskId: string;
  assignmentId: string;
  status: string;
  completedAt: number | null;
  fileId: string | null;
  lastRemindedAt: number | null;
}

export interface GridRow {
  contact: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    hasAccount: boolean;
  };
  cells: GridCell[];
}

export interface OnboardingGrid {
  tasks: GridTask[];
  rows: GridRow[];
}

/** Builds the onboarding grid: one query for the event's tasks, one joined
 * query for assignments+contacts(+account flag) — no N+1 per DEC-023. */
export async function getOnboardingGrid(db: Db, eventId: string): Promise<OnboardingGrid> {
  const taskRows = await db
    .select({
      id: schema.task.id,
      kind: schema.task.kind,
      title: schema.task.title,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
    })
    .from(schema.task)
    .where(eq(schema.task.eventId, eventId));

  const tasks: GridTask[] = taskRows.map((t) => ({
    id: t.id,
    kind: t.kind,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.getTime() : null,
    required: t.required,
  }));

  if (tasks.length === 0) return { tasks: [], rows: [] };

  const taskIds = tasks.map((t) => t.id);

  const assignmentRows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      taskId: schema.taskAssignment.taskId,
      status: schema.taskAssignment.status,
      completedAt: schema.taskAssignment.completedAt,
      fileId: schema.taskAssignment.fileId,
      lastRemindedAt: schema.taskAssignment.lastRemindedAt,
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      userId: schema.user.id,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.contact, eq(schema.taskAssignment.contactId, schema.contact.id))
    .leftJoin(schema.user, eq(schema.user.contactId, schema.contact.id))
    .where(inArray(schema.taskAssignment.taskId, taskIds));

  const rowsByContact = new Map<string, GridRow>();
  for (const r of assignmentRows) {
    let row = rowsByContact.get(r.contactId);
    if (!row) {
      row = {
        contact: {
          id: r.contactId,
          name: `${r.firstName} ${r.lastName}`.trim(),
          email: r.email,
          company: r.company,
          hasAccount: false,
        },
        cells: [],
      };
      rowsByContact.set(r.contactId, row);
    }
    if (r.userId) row.contact.hasAccount = true;
    // A left join to `user` may repeat a row only when a contact has more
    // than one user account, which the app never creates — one cell per
    // assignment either way, deduped by assignmentId to stay N+1-safe-proof.
    if (!row.cells.some((c) => c.assignmentId === r.assignmentId)) {
      row.cells.push({
        taskId: r.taskId,
        assignmentId: r.assignmentId,
        status: r.status,
        completedAt: r.completedAt ? r.completedAt.getTime() : null,
        fileId: r.fileId,
        lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
      });
    }
  }

  return { tasks, rows: [...rowsByContact.values()] };
}

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  kind: "general" | "file_request" | "form";
  title: string;
  description?: string | null;
  dueDate?: number | null;
  required: boolean;
  formId?: string | null;
  assignToAllAccepted?: boolean;
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
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** Contacts holding a participant row on any 'accepted' submission in the
 * event — the DEC-023 assignToAllAccepted expansion target. */
export async function listAcceptedContactIds(db: Db, eventId: string): Promise<string[]> {
  const rows = await db
    .select({ contactId: schema.participant.contactId })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));
  return [...new Set(rows.map((r) => r.contactId))];
}

export async function createTaskAssignments(
  db: Db,
  taskId: string,
  contactIds: string[],
  now: Date,
): Promise<void> {
  if (contactIds.length === 0) return;
  const existing = await db
    .select({ contactId: schema.taskAssignment.contactId })
    .from(schema.taskAssignment)
    .where(and(eq(schema.taskAssignment.taskId, taskId), inArray(schema.taskAssignment.contactId, contactIds)));
  const already = new Set(existing.map((r) => r.contactId));
  const toCreate = contactIds.filter((id) => !already.has(id));
  for (const contactId of toCreate) {
    await db.insert(schema.taskAssignment).values({
      id: newId(),
      taskId,
      contactId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
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
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    required: input.required,
    formId: input.formId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  if (input.assignToAllAccepted) {
    const contactIds = await listAcceptedContactIds(db, eventId);
    await createTaskAssignments(db, id, contactIds, now);
  }

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
}

export async function updateTask(db: Db, taskId: string, input: UpdateTaskInput): Promise<TaskRecord> {
  const now = new Date();
  await db
    .update(schema.task)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.formId !== undefined ? { formId: input.formId } : {}),
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

// ---------------------------------------------------------------------------
// Assign (POST /api/v1/tasks/:id/assign)
// ---------------------------------------------------------------------------

export async function assignTask(db: Db, taskId: string, contactIds: string[]): Promise<void> {
  await createTaskAssignments(db, taskId, contactIds, new Date());
}

// ---------------------------------------------------------------------------
// Assignment status (PATCH /api/v1/task-assignments/:id)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reminders — shared by the bulk 'remind now' endpoint and the due-date cron
// ---------------------------------------------------------------------------

interface OutstandingRow {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  dueDate: Date | null;
  status: string;
  lastRemindedAt: Date | null;
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  eventId: string;
  eventName: string;
}

/** One joined query for every non-complete assignment in the event (or
 * across taskIds, when provided), carrying everything a reminder email
 * needs — no N+1. */
async function listOutstandingForEvent(
  db: Db,
  eventId: string,
  taskIds?: string[],
): Promise<OutstandingRow[]> {
  const conditions = [eq(schema.task.eventId, eventId), eq(schema.taskAssignment.status, "pending")];
  if (taskIds && taskIds.length > 0) {
    conditions.push(inArray(schema.taskAssignment.taskId, taskIds));
  }
  const rows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      taskId: schema.task.id,
      taskTitle: schema.task.title,
      dueDate: schema.task.dueDate,
      status: schema.taskAssignment.status,
      lastRemindedAt: schema.taskAssignment.lastRemindedAt,
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      eventId: schema.event.id,
      eventName: schema.event.name,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .innerJoin(schema.contact, eq(schema.taskAssignment.contactId, schema.contact.id))
    .where(and(...conditions));
  return rows;
}

function toReminderAssignment(r: OutstandingRow): ReminderAssignment {
  return {
    assignmentId: r.assignmentId,
    contactId: r.contactId,
    status: r.status,
    dueDate: r.dueDate ? r.dueDate.getTime() : null,
    lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
    taskId: r.taskId,
    taskTitle: r.taskTitle,
  };
}

function formatDueDate(ms: number | null): string {
  if (ms === null) return "No due date";
  return new Date(ms).toISOString().slice(0, 10);
}

/** Sends one reminder email per contact via `mailer`, stamps
 * last_reminded_at on every assignment included in that email. Used by
 * both the bulk 'remind now' endpoint (taskIds optional filter, ignores the
 * due-date/dedupe gate — an explicit organizer action) and, filtered through
 * planReminders, the due-date cron (never triggered by a status change —
 * DEC-009). */
async function sendReminderEmails(
  db: Db,
  mailer: Mailer,
  eventId: string,
  eventName: string,
  groups: { contactId: string; assignments: ReminderAssignment[] }[],
  outstandingByContact: Map<string, OutstandingRow[]>,
  now: Date,
): Promise<number> {
  let sent = 0;
  for (const group of groups) {
    const rows = outstandingByContact.get(group.contactId) ?? [];
    if (rows.length === 0) continue;
    const first = rows[0];
    if (!first) continue;
    const taskList = group.assignments.map((a) => a.taskTitle).join(", ");
    const nextDue = group.assignments
      .map((a) => a.dueDate)
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b)[0];

    await mailer.send({
      to: { email: first.email, name: `${first.firstName} ${first.lastName}`.trim() },
      subject: `Action needed: outstanding tasks for ${eventName}`,
      text: renderTemplate("You have outstanding tasks for {event_name}: {task_list} (due {due_date}).", {
        event_name: eventName,
        task_list: taskList,
        due_date: formatDueDate(nextDue ?? null),
      }),
      html: renderTemplate(
        "<p>You have outstanding tasks for {event_name}: {task_list} (due {due_date}).</p>",
        {
          event_name: eventName,
          task_list: taskList,
          due_date: formatDueDate(nextDue ?? null),
        },
      ),
      eventId,
      contactId: group.contactId,
    });

    const assignmentIds = group.assignments.map((a) => a.assignmentId);
    await db
      .update(schema.taskAssignment)
      .set({ lastRemindedAt: now, updatedAt: now })
      .where(inArray(schema.taskAssignment.id, assignmentIds));

    sent += 1;
  }
  return sent;
}

/** Bulk "remind now" — an explicit organizer action, so it reminds every
 * outstanding assignment regardless of the due-window/dedupe gate. */
export async function remindNow(
  db: Db,
  mailer: Mailer,
  eventId: string,
  taskIds: string[] | undefined,
  now: Date,
): Promise<{ sent: number }> {
  const outstanding = await listOutstandingForEvent(db, eventId, taskIds);
  if (outstanding.length === 0) return { sent: 0 };
  const eventName = outstanding[0]?.eventName ?? "";

  const outstandingByContact = new Map<string, OutstandingRow[]>();
  const byContactAssignments = new Map<string, ReminderAssignment[]>();
  for (const r of outstanding) {
    const arr = outstandingByContact.get(r.contactId) ?? [];
    arr.push(r);
    outstandingByContact.set(r.contactId, arr);
    const arr2 = byContactAssignments.get(r.contactId) ?? [];
    arr2.push(toReminderAssignment(r));
    byContactAssignments.set(r.contactId, arr2);
  }
  const groups = [...byContactAssignments.entries()].map(([contactId, assignments]) => ({
    contactId,
    assignments,
  }));

  const sent = await sendReminderEmails(db, mailer, eventId, eventName, groups, outstandingByContact, now);
  return { sent };
}

/** Due-date-driven cron reminder pass, scoped to one event's outstanding
 * assignments, filtered through the pure DEC-023 planReminders gate. Never
 * triggered by a submission/assignment status change (DEC-009). */
export async function sendDueRemindersForEvent(db: Db, mailer: Mailer, eventId: string, now: Date): Promise<number> {
  const outstanding = await listOutstandingForEvent(db, eventId);
  if (outstanding.length === 0) return 0;
  const eventName = outstanding[0]?.eventName ?? "";

  const outstandingByContact = new Map<string, OutstandingRow[]>();
  for (const r of outstanding) {
    const arr = outstandingByContact.get(r.contactId) ?? [];
    arr.push(r);
    outstandingByContact.set(r.contactId, arr);
  }

  const plan = planReminders({
    assignments: outstanding.map(toReminderAssignment),
    now: now.getTime(),
  });
  if (plan.groups.length === 0) return 0;

  return sendReminderEmails(db, mailer, eventId, eventName, plan.groups, outstandingByContact, now);
}

/** All event ids that have at least one non-complete task assignment — the
 * cron's outer loop, so each event's reminder pass stays a small, scoped
 * joined query rather than one unbounded cross-event query. */
export async function listEventIdsWithOutstandingAssignments(db: Db): Promise<string[]> {
  const rows = await db
    .select({ eventId: schema.task.eventId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(and(eq(schema.taskAssignment.status, "pending"), isNull(schema.taskAssignment.completedAt)));
  return [...new Set(rows.map((r) => r.eventId))];
}
