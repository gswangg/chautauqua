// J6 onboarding tasks repo (DEC-023): the ONE per-task roster read
// (GET /api/v1/tasks/:id/roster), behind design pack v12's task view --
// the "One task, every speaker" / "One task · still waiting" frames in
// docs/design/Chautauqua Speakers.dc.html. Sibling of grid.ts (every task
// across every speaker) and speaker-detail.ts (every task for ONE speaker):
// this is the third face of the same task_assignment join -- ONE task
// across every speaker who has it.
//
// The wire contract below is normative and shared with
// app/src/pages/speakers/TaskView.tsx.

import { and, eq, like, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { overdueAssignmentConditions } from "./crud";
import { REMINDER_SUBJECT_PREFIX } from "./reminders";
import { listFields } from "../forms";
import { parseTaskResponse } from "../../../forms/task-response";
import { answerDisplayText } from "../../../domain/answer-text";

export interface TaskViewTask {
  id: string;
  eventId: string;
  kind: string;
  title: string;
  dueDate: number | null;
  required: boolean;
  formId: string | null;
  instructions: string | null;
}

export interface TaskViewRow {
  contactId: string;
  name: string;
  company: string | null;
  assignmentId: string;
  status: string;
  completedAt: number | null;
  // DEC-801: when this assignment was created. The waiting tab's "Where it
  // stands" reads it, and the overdue flag below is judged against it (an
  // assignment cannot be late before it existed).
  assignedAt: number;
  // The dedupe stamp task_assignment already carries -- exact, per
  // (task, speaker). "last 4 Aug" in the frame's Last reminded column.
  lastRemindedAt: number | null;
  // How many reminder emails have NAMED this task to this speaker. See
  // countRemindSends below for why this is derived from email_log rather
  // than read off a column: task_assignment has no send counter, only
  // last_reminded_at.
  remindCount: number;
  fileId: string | null;
  fileName: string | null;
  // form-kind tasks only: the saved answers as one line, in form-field
  // order, for the answered tab's "Their answers" column. null when the
  // task is not a form or nothing has been saved.
  answerSummary: string | null;
  // DEC-801: judged server-side against the EVENT's timezone, exactly as
  // speaker-detail.ts does -- the client cannot re-derive it.
  overdue: boolean;
}

export interface TaskViewCounts {
  assigned: number;
  complete: number;
  pending: number;
  // The frame's sub-line says "6 answered of 9 who need it": `answered` is
  // the count of rows that have something to READ (a saved response, an
  // uploaded file, or a completion), which is what the answered tab lists.
  answered: number;
}

export interface TaskView {
  task: TaskViewTask;
  // DEC-801 (wave 58 amendment): the owning event's IANA timezone, so the
  // SPA can render day labels by the same rule the overdue flags used.
  timezone: string;
  rows: TaskViewRow[];
  counts: TaskViewCounts;
}

/** Reminder sends per contact for ONE task, counted out of email_log.
 *
 * task_assignment carries `last_reminded_at` (an instant) and nothing else
 * -- there is no send COUNTER on the row, so "3 sends · last 4 Aug" in the
 * frame's Last reminded column cannot be read off the assignment. It is
 * derived here instead, exactly and without a schema change: a reminder
 * email lists every outstanding task the recipient holds
 * (formatTaskLines, ../../../domain/reminders.ts), so a reminder sent to
 * this contact AFTER the assignment was created and BEFORE it was
 * completed necessarily named this task. Matching on
 * REMINDER_SUBJECT_PREFIX (the shared prefix buildReminderMessage composes,
 * never a second copy of the string) keeps the match robust to an event
 * rename, and excludes every other email in the log.
 *
 * ONE grouped query, correlated in SQL -- never a query per row. */
async function countRemindSends(db: Db, taskId: string, eventId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      contactId: schema.taskAssignment.contactId,
      sends: sql<number>`count(*)`,
    })
    .from(schema.emailLog)
    .innerJoin(schema.taskAssignment, eq(schema.taskAssignment.contactId, schema.emailLog.contactId))
    .where(
      and(
        eq(schema.taskAssignment.taskId, taskId),
        eq(schema.emailLog.eventId, eventId),
        eq(schema.emailLog.status, "sent"),
        like(schema.emailLog.subject, `${REMINDER_SUBJECT_PREFIX}%`),
        sql`${schema.emailLog.sentAt} >= ${schema.taskAssignment.createdAt}`,
        sql`(${schema.taskAssignment.completedAt} is null or ${schema.emailLog.sentAt} < ${schema.taskAssignment.completedAt})`,
      ),
    )
    .groupBy(schema.taskAssignment.contactId);
  const byContact = new Map<string, number>();
  for (const r of rows) byContact.set(r.contactId, Number(r.sends));
  return byContact;
}

/** Builds the design-pack-v12 task view for ONE task, in a bounded number
 * of queries independent of how many speakers hold it: (i) the task joined
 * to its owning event (title/due/required/kind/formId + org timezone);
 * (ii) ONE task_assignment/contact/file join for the whole roster of this
 * task (the same join shape grid.ts's cells query and speaker-detail.ts's
 * task query carry, never a query per row); (iii) the overdue set,
 * composing the existing DEC-801 overdueAssignmentConditions predicate
 * rather than re-typing its grace window; (iv) ONE grouped email_log
 * aggregate for the per-speaker reminder-send counts (countRemindSends
 * above); and, for a form-kind task only, (v) the form's field defs, read
 * ONCE for the whole page rather than per answered row. Four queries for a
 * general/file_request task, five for a form task.
 *
 * Returns null when the task does not exist; the caller's org-scope check
 * (getTaskOwnership) runs separately, so a cross-org lookup 404s before
 * this is ever reached. */
export async function getTaskView(db: Db, taskId: string): Promise<TaskView | null> {
  const taskRows = await db
    .select({
      id: schema.task.id,
      eventId: schema.task.eventId,
      kind: schema.task.kind,
      title: schema.task.title,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
      formId: schema.task.formId,
      instructions: schema.task.instructions,
      timezone: schema.event.timezone,
    })
    .from(schema.task)
    .innerJoin(schema.event, eq(schema.event.id, schema.task.eventId))
    .where(eq(schema.task.id, taskId))
    .limit(1);
  const taskRow = taskRows[0];
  if (!taskRow) return null;

  const eventId = taskRow.eventId;
  const timeZone = taskRow.timezone;

  const assignmentRows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      contactId: schema.taskAssignment.contactId,
      status: schema.taskAssignment.status,
      completedAt: schema.taskAssignment.completedAt,
      createdAt: schema.taskAssignment.createdAt,
      lastRemindedAt: schema.taskAssignment.lastRemindedAt,
      responseJson: schema.taskAssignment.responseJson,
      fileId: schema.taskAssignment.fileId,
      fileName: schema.file.filename,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
    .leftJoin(schema.file, eq(schema.file.id, schema.taskAssignment.fileId))
    .where(eq(schema.taskAssignment.taskId, taskId))
    .orderBy(sql`lower(${schema.contact.lastName}) asc, lower(${schema.contact.firstName}) asc, ${schema.contact.id} asc`);

  // The ONE lateness read for this payload (DEC-801), composing the same
  // predicate the grid's `counts.overdue` and the speaker detail's per-row
  // flag compose -- three surfaces, one definition of late.
  const overdueRows = await db
    .select({ id: schema.taskAssignment.id })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
    .where(and(eq(schema.taskAssignment.taskId, taskId), overdueAssignmentConditions(eventId, Date.now(), timeZone)));
  const overdueAssignmentIds = new Set(overdueRows.map((r) => r.id));

  const remindSends = await countRemindSends(db, taskId, eventId);

  // DEC-291's field-order rule, applied once for the whole page: the
  // summary line reads answers in FORM-FIELD order, never JSON key order,
  // so two speakers' answers to the same form read in the same order.
  const fieldDefs = taskRow.kind === "form" && taskRow.formId ? await listFields(db, taskRow.formId) : [];

  let complete = 0;
  let answered = 0;
  const rows: TaskViewRow[] = assignmentRows.map((r) => {
    // schema.file.filename is a notNull column (DEC-920) -- a non-null
    // fileId whose file row didn't resolve through the join is a broken
    // reference, not a "no file" state. Fail loudly (mirrors grid.ts and
    // speaker-detail.ts) rather than rendering a generic label.
    if (r.fileId != null && r.fileName == null) {
      throw new Error(`task view: assignment ${r.assignmentId} has fileId ${r.fileId} that does not resolve to a file row`);
    }

    let answerSummary: string | null = null;
    if (fieldDefs.length > 0 && r.responseJson !== null) {
      const answers = parseTaskResponse(r.responseJson, r.assignmentId);
      const parts = fieldDefs
        .map((f) => answerDisplayText(answers[f.id], { empty: "" }))
        .filter((v) => v.length > 0);
      answerSummary = parts.length > 0 ? parts.join(" · ") : null;
    }

    if (r.status === "complete") complete += 1;
    // "6 answered of 9 who need it": a row is ANSWERED when it has
    // something to read -- saved answers, an uploaded file, or a
    // completion the organizer/speaker recorded.
    if (r.status === "complete" || answerSummary !== null || r.fileId !== null) answered += 1;

    return {
      contactId: r.contactId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      company: r.company,
      assignmentId: r.assignmentId,
      status: r.status,
      completedAt: r.completedAt ? r.completedAt.getTime() : null,
      assignedAt: r.createdAt.getTime(),
      lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
      remindCount: remindSends.get(r.contactId) ?? 0,
      fileId: r.fileId,
      fileName: r.fileName,
      answerSummary,
      overdue: overdueAssignmentIds.has(r.assignmentId),
    };
  });

  return {
    task: {
      id: taskRow.id,
      eventId,
      kind: taskRow.kind,
      title: taskRow.title,
      dueDate: taskRow.dueDate ? taskRow.dueDate.getTime() : null,
      required: taskRow.required,
      formId: taskRow.formId,
      instructions: taskRow.instructions,
    },
    timezone: timeZone,
    rows,
    counts: {
      assigned: rows.length,
      complete,
      pending: rows.length - complete,
      answered,
    },
  };
}
