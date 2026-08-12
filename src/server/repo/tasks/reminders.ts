// J6 onboarding tasks repo (DEC-023): reminder sends, shared by the bulk
// 'remind now' endpoint and the due-date cron. Split out of repo/tasks.ts
// for contention decomposition (no behavior change) — see repo/tasks.ts's
// barrel header.

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import type { Mailer } from "../../../mail/types";
import { renderTemplate, textToHtml } from "../../../mail/render";
import type { ReminderAssignment } from "../../../domain/reminders";
import { capReminderGroups, planManualReminders, planReminders } from "../../../domain/reminders";

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
