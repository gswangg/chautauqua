// J6 onboarding tasks repo (DEC-023): grid payload, task CRUD, assignment
// status, reminder sends. Repo functions are the only code touching drizzle
// row types (DEC-012); handlers in src/routes/tasks.ts stay thin.

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import type { Mailer } from "../../mail/types";
import { renderTemplate, textToHtml } from "../../mail/render";
import type { ReminderAssignment } from "../../domain/reminders";
import { capReminderGroups, planManualReminders, planReminders } from "../../domain/reminders";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { listFields } from "./forms";
import type { AnswerMap } from "../../forms/types";
import { likeContains } from "./contacts/query";

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

/** Returns the (eventId, orgId, kind) owning a task row, or null if it
 * doesn't exist. `kind` is included so callers (e.g. the PATCH deliverable
 * kind gate, DEC-240) don't need a second round-trip. */
export async function getTaskOwnership(
  db: Db,
  taskId: string,
): Promise<{ eventId: string; orgId: string; kind: string } | null> {
  const rows = await db
    .select({ eventId: schema.task.eventId, orgId: schema.event.orgId, kind: schema.task.kind })
    .from(schema.task)
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.task.id, taskId))
    .limit(1);
  return rows[0] ?? null;
}

/** Returns ownership info for a task_assignment row: event/org (for the
 * organizer authz path) plus the assignment's own contactId (for the
 * owning-speaker authz path — DEC-023 PATCH allows organizer OR the owning
 * speaker, compared against c.var.auth.contactId). Also carries the task's
 * kind and the assignment's own response_json/file_id so the PATCH handler
 * can enforce the DEC-214 speaker-side kind gates in the same round-trip. */
export async function getAssignmentOwnership(
  db: Db,
  assignmentId: string,
): Promise<{
  eventId: string;
  orgId: string;
  contactId: string;
  kind: string;
  responseJson: string | null;
  fileId: string | null;
} | null> {
  const rows = await db
    .select({
      eventId: schema.task.eventId,
      orgId: schema.event.orgId,
      contactId: schema.taskAssignment.contactId,
      kind: schema.task.kind,
      responseJson: schema.taskAssignment.responseJson,
      fileId: schema.taskAssignment.fileId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Response detail (GET /api/v1/task-assignments/:id/response) — DEC-291
// ---------------------------------------------------------------------------

export interface AssignmentResponseField {
  label: string;
  value: string;
}

export interface AssignmentResponseDetail {
  assignmentId: string;
  taskTitle: string;
  taskKind: string;
  contact: { id: string; name: string; email: string };
  status: string;
  completedAt: number | null;
  fields: AssignmentResponseField[];
}

function answerToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Organizer-facing view of a kind='form' task_assignment's saved answers
 * (DEC-291): parses response_json as an AnswerMap keyed by form_field.id and
 * joins it against listFields(db, task.formId) in field order, so the
 * organizer sees every field on the form (unanswered ones rendered with an
 * empty-string value, never omitted). Returns null when the assignment
 * doesn't exist — the route's org-scope check happens separately via
 * getAssignmentOwnership so a cross-org lookup 404s before this ever runs. */
export async function getAssignmentResponseDetail(
  db: Db,
  assignmentId: string,
): Promise<AssignmentResponseDetail | null> {
  const rows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      status: schema.taskAssignment.status,
      completedAt: schema.taskAssignment.completedAt,
      responseJson: schema.taskAssignment.responseJson,
      taskTitle: schema.task.title,
      taskKind: schema.task.kind,
      formId: schema.task.formId,
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.contact, eq(schema.taskAssignment.contactId, schema.contact.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const answers: AnswerMap = row.responseJson ? (JSON.parse(row.responseJson) as AnswerMap) : {};
  const fieldDefs = row.formId ? await listFields(db, row.formId) : [];
  const fields: AssignmentResponseField[] = fieldDefs.map((f) => ({
    label: f.label,
    value: answerToString(answers[f.id]),
  }));

  return {
    assignmentId: row.assignmentId,
    taskTitle: row.taskTitle,
    taskKind: row.taskKind,
    contact: {
      id: row.contactId,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email,
    },
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.getTime() : null,
    fields,
  };
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

export interface OnboardingGridParams {
  page: number;
  perPage: number;
  q: string | null;
  taskId: string | null;
  status: "pending" | "complete" | null;
  overdueOnly: boolean;
  now: number;
}

export interface OnboardingGridCounts {
  speakers: number;
  outstandingRequired: number;
  overdue: number;
  outstandingContacts: number;
}

export interface OnboardingGrid {
  tasks: GridTask[];
  rows: GridRow[];
  total: number;
  page: number;
  perPage: number;
  counts: OnboardingGridCounts;
}

/** The correlated EXISTS predicate a matching contact must satisfy: at
 * least one task_assignment, for a task in this event, that satisfies EVERY
 * active filter simultaneously (DEC-312: the WHERE is normative — this is
 * the SQL form of app/src/pages/speakers/rowFilters.ts's now-deleted "one
 * cell matching all filters" semantics, preserved exactly per DEC-340). */
function onboardingMatchExists(
  eventId: string,
  taskId: string | null,
  status: "pending" | "complete" | null,
  overdueOnly: boolean,
  now: number,
) {
  const inner = [sql`${schema.task.eventId} = ${eventId}`];
  if (taskId) inner.push(sql`${schema.taskAssignment.taskId} = ${taskId}`);
  if (status) inner.push(sql`${schema.taskAssignment.status} = ${status}`);
  if (overdueOnly) {
    inner.push(
      sql`${schema.task.dueDate} is not null and ${schema.taskAssignment.status} <> 'complete' and ${schema.task.dueDate} < ${now}`,
    );
  }
  const innerWhere = sql.join(inner, sql` and `);
  return sql`exists (select 1 from ${schema.taskAssignment} inner join ${schema.task} on ${schema.task.id} = ${schema.taskAssignment.taskId} where ${schema.taskAssignment.contactId} = ${schema.contact.id} and ${innerWhere})`;
}

/** Builds the J6 onboarding grid: a server-paginated, server-filtered,
 * searchable roster (DEC-340, superseding DEC-023's whole-event envelope).
 * Four bounded queries: (i) the event's tasks; (ii) the matching contact-id
 * page (one correlated-EXISTS SELECT + a matching COUNT(*)); (iii) the cells
 * for exactly those page contacts, unfiltered (every task column still
 * renders); (iv) one event-wide filter-independent aggregate for `counts`. */
export async function getOnboardingGrid(db: Db, eventId: string, params: OnboardingGridParams): Promise<OnboardingGrid> {
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

  const emptyCounts: OnboardingGridCounts = {
    speakers: 0,
    outstandingRequired: 0,
    overdue: 0,
    outstandingContacts: 0,
  };

  if (tasks.length === 0) {
    return { tasks: [], rows: [], total: 0, page: params.page, perPage: params.perPage, counts: emptyCounts };
  }

  const matchExists = onboardingMatchExists(eventId, params.taskId, params.status, params.overdueOnly, params.now);

  const conditions = [matchExists];
  if (params.q) {
    const like = likeContains(params.q);
    conditions.push(
      sql`(lower(${schema.contact.firstName}) like ${like} escape '\\' or lower(${schema.contact.lastName}) like ${like} escape '\\' or lower(${schema.contact.email}) like ${like} escape '\\')`,
    );
  }
  const whereExpr = and(...conditions);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(whereExpr);
  const total = Number(totalRows[0]?.count ?? 0);

  const offset = (params.page - 1) * params.perPage;
  const contactRows = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      userId: schema.user.id,
    })
    .from(schema.contact)
    .leftJoin(schema.user, eq(schema.user.contactId, schema.contact.id))
    .where(whereExpr)
    .orderBy(sql`lower(${schema.contact.lastName}) asc, lower(${schema.contact.firstName}) asc, ${schema.contact.id} asc`)
    .limit(params.perPage)
    .offset(offset);

  // A left join to `user` may repeat a row only when a contact has more than
  // one user account, which the app never creates — dedupe defensively.
  const rowsByContact = new Map<string, GridRow>();
  const contactIdsInOrder: string[] = [];
  for (const c of contactRows) {
    let row = rowsByContact.get(c.id);
    if (!row) {
      row = {
        contact: {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          company: c.company,
          hasAccount: false,
        },
        cells: [],
      };
      rowsByContact.set(c.id, row);
      contactIdsInOrder.push(c.id);
    }
    if (c.userId) row.contact.hasAccount = true;
  }

  // Cells for exactly those page contacts, carrying ALL their cells
  // unfiltered so every task column still renders — chunked per DEC-104 so
  // the page's contact ids never reach inArray unbounded.
  const taskIds = tasks.map((t) => t.id);
  if (contactIdsInOrder.length > 0) {
    for (const batch of chunkIds(contactIdsInOrder)) {
      const cellRows = await db
        .select({
          assignmentId: schema.taskAssignment.id,
          taskId: schema.taskAssignment.taskId,
          status: schema.taskAssignment.status,
          completedAt: schema.taskAssignment.completedAt,
          fileId: schema.taskAssignment.fileId,
          lastRemindedAt: schema.taskAssignment.lastRemindedAt,
          contactId: schema.taskAssignment.contactId,
        })
        .from(schema.taskAssignment)
        .where(and(inArray(schema.taskAssignment.contactId, batch), inArray(schema.taskAssignment.taskId, taskIds)));
      for (const r of cellRows) {
        const row = rowsByContact.get(r.contactId);
        if (!row) continue;
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
  }

  const rows = contactIdsInOrder.map((id) => rowsByContact.get(id)).filter((r): r is GridRow => r !== undefined);

  // Event-wide aggregate, filter- and page-independent (DEC-333/334): SQL
  // COUNT forms, never materialized rows.
  const countsRow = await db
    .select({
      speakers: sql<number>`count(distinct ${schema.taskAssignment.contactId})`,
      outstandingRequired: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' and ${schema.task.required} = 1 then ${schema.taskAssignment.id} end)`,
      overdue: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' and ${schema.task.dueDate} is not null and ${schema.task.dueDate} < ${params.now} then ${schema.taskAssignment.id} end)`,
      outstandingContacts: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' then ${schema.taskAssignment.contactId} end)`,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .where(eq(schema.task.eventId, eventId));

  const counts: OnboardingGridCounts = countsRow[0]
    ? {
        speakers: Number(countsRow[0].speakers),
        outstandingRequired: Number(countsRow[0].outstandingRequired),
        overdue: Number(countsRow[0].overdue),
        outstandingContacts: Number(countsRow[0].outstandingContacts),
      }
    : emptyCounts;

  return { tasks, rows, total, page: params.page, perPage: params.perPage, counts };
}

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

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
export async function listAcceptedContactIds(db: Db, eventId: string): Promise<string[]> {
  const rows = await db
    .select({ contactId: schema.participant.contactId })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(
      and(
        eq(schema.submission.eventId, eventId),
        eq(schema.submission.status, "accepted"),
        inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
      ),
    );
  return [...new Set(rows.map((r) => r.contactId))];
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
    deliverableKind: input.deliverableKind ?? null,
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
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
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
): Promise<{ sent: number; failed: { email: string; message: string }[] }> {
  let sent = 0;
  // DEC-238: a send failure for one recipient must not abort the batch —
  // class 1 (cron, sendDueRemindersForEvent) logs and moves on; class 2
  // (organizer-triggered remindNow) additionally surfaces `failed` in its
  // response so the organizer sees a structured partial-failure summary
  // instead of a 500.
  const failed: { email: string; message: string }[] = [];
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

    const reminderText = renderTemplate(
      "You have outstanding tasks for {event_name}: {task_list} (due {due_date}).",
      {
        event_name: eventName,
        task_list: taskList,
        due_date: formatDueDate(nextDue ?? null),
      },
    );

    try {
      await mailer.send({
        to: { email: first.email, name: `${first.firstName} ${first.lastName}`.trim() },
        subject: `Action needed: outstanding tasks for ${eventName}`,
        text: reminderText,
        html: textToHtml(reminderText),
        eventId,
        contactId: group.contactId,
      });
    } catch (err) {
      console.error("reminder email failed for", first.email, err);
      failed.push({ email: first.email, message: err instanceof Error ? err.message : String(err) });
      continue;
    }

    const assignmentIds = group.assignments.map((a) => a.assignmentId);
    for (const batch of chunkIds(assignmentIds)) {
      await db
        .update(schema.taskAssignment)
        .set({ lastRemindedAt: now, updatedAt: now })
        .where(inArray(schema.taskAssignment.id, batch));
    }

    sent += 1;
  }
  return { sent, failed };
}

/** Bulk "remind now" — an explicit organizer action, so it reminds every
 * outstanding assignment regardless of the due-window/dedupe gate, but is
 * still capped and de-duped per DEC-319 (planManualReminders) so a huge
 * event can't blow one request past MAX_REMINDER_BATCH contacts; the
 * organizer clicks again to continue through `remaining`. */
export async function remindNow(
  db: Db,
  mailer: Mailer,
  eventId: string,
  taskIds: string[] | undefined,
  now: Date,
): Promise<{ sent: number; failed: { email: string; message: string }[]; skipped: number; remaining: number }> {
  const outstanding = await listOutstandingForEvent(db, eventId, taskIds);
  if (outstanding.length === 0) return { sent: 0, failed: [], skipped: 0, remaining: 0 };
  const eventName = outstanding[0]?.eventName ?? "";

  const outstandingByContact = new Map<string, OutstandingRow[]>();
  for (const r of outstanding) {
    const arr = outstandingByContact.get(r.contactId) ?? [];
    arr.push(r);
    outstandingByContact.set(r.contactId, arr);
  }

  const plan = planManualReminders({
    assignments: outstanding.map(toReminderAssignment),
    now: now.getTime(),
  });
  if (plan.groups.length === 0) return { sent: 0, failed: [], skipped: plan.skipped, remaining: plan.remaining };

  const result = await sendReminderEmails(db, mailer, eventId, eventName, plan.groups, outstandingByContact, now);
  return { ...result, skipped: plan.skipped, remaining: plan.remaining };
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

  // DEC-319: cap even the cron's due-window batch so one event with a huge
  // outstanding backlog can't send an unbounded number of emails in one
  // tick — the next tick picks up the `remaining` contacts.
  const { groups: cappedGroups } = capReminderGroups(plan.groups);

  const result = await sendReminderEmails(db, mailer, eventId, eventName, cappedGroups, outstandingByContact, now);
  return result.sent;
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
