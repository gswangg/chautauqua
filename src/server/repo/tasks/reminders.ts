// J6 onboarding tasks repo (DEC-023): reminder sends, shared by the bulk
// 'remind now' endpoint and the due-date cron. Split out of repo/tasks.ts
// for contention decomposition (no behavior change) — see repo/tasks.ts's
// barrel header.

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { newId } from "../../../domain/ids";
import type { Mailer } from "../../../mail/types";
import { renderTemplate, textToHtml } from "../../../mail/render";
import type { ReminderAssignment } from "../../../domain/reminders";
import { capReminderGroups, formatTaskLines, planManualReminders, planReminders } from "../../../domain/reminders";
import type { KVStore } from "../../../auth/claim";
import { resolvePortalLinks } from "../portal-link";
import { findAccountUserIds } from "../comms";
import { effectiveAssignmentDueDate } from "../../../domain/task-due";

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
  timezone: string;
}

/** One joined query for every non-complete assignment in the event (or
 * across taskIds, when provided), carrying everything a reminder email
 * needs — no N+1. */
export async function listOutstandingForEvent(
  db: Db,
  eventId: string,
  taskIds?: string[],
  contactIds?: string[],
): Promise<OutstandingRow[]> {
  const conditions = [eq(schema.task.eventId, eventId), eq(schema.taskAssignment.status, "pending")];
  if (taskIds && taskIds.length > 0) {
    conditions.push(inArray(schema.taskAssignment.taskId, taskIds));
  }
  if (contactIds && contactIds.length > 0) {
    conditions.push(inArray(schema.taskAssignment.contactId, contactIds));
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
      timezone: schema.event.timezone,
      assignmentCreatedAt: schema.taskAssignment.createdAt,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .innerJoin(schema.contact, eq(schema.taskAssignment.contactId, schema.contact.id))
    .where(and(...conditions));
  // DEC-801: dueDate reported on each row is the assignment's EFFECTIVE due
  // date, not the raw task.dueDate — so reminder emails and compose's
  // {due_date} agree with the grid badge/cell, which judge against the same
  // effectiveAssignmentDueDate. The row SHAPE (dueDate: Date | null) is
  // unchanged, only the value.
  return rows.map((r): OutstandingRow => {
    const effective = effectiveAssignmentDueDate(
      r.dueDate ? r.dueDate.getTime() : null,
      r.assignmentCreatedAt.getTime(),
    );
    return {
      assignmentId: r.assignmentId,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      dueDate: effective === null ? null : new Date(effective),
      status: r.status,
      lastRemindedAt: r.lastRemindedAt,
      contactId: r.contactId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      eventId: r.eventId,
      eventName: r.eventName,
      timezone: r.timezone,
    };
  });
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

/** ONE builder for the reminder email body — used by both the real send
 * (sendReminderEmails) and the preview endpoint (previewRemindNow), so a
 * preview draft is always byte-identical to what a send would produce. */
export function buildReminderMessage(
  eventName: string,
  eventTimezone: string,
  assignments: ReminderAssignment[],
  portalLink: string,
): { subject: string; text: string } {
  const header = renderTemplate("You have outstanding tasks for {event_name}:", {
    event_name: eventName,
  });
  // DEC-564/DEC-792: shared task-line renderer — eventTimezone is unused
  // here (dueDate is a DEC-522 calendar day, not an instant); kept in the
  // signature since callers still use it for other purposes.
  const taskLines = formatTaskLines(assignments);
  // DEC-559: append the portal link through the same renderTemplate
  // '{portal_link}' idiom the CFP confirmation email uses (submit.tsx).
  const footer = renderTemplate("{portal_link}", { portal_link: portalLink });
  const text = [header, ...taskLines, "", footer].join("\n");
  return { subject: `Action needed: outstanding tasks for ${eventName}`, text };
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
  eventTimezone: string,
  groups: { contactId: string; assignments: ReminderAssignment[] }[],
  outstandingByContact: Map<string, OutstandingRow[]>,
  now: Date,
  kv: KVStore,
  origin: string,
  mintClaimTokens: boolean,
): Promise<{ sent: number; failed: { email: string; message: string }[] }> {
  let sent = 0;
  // DEC-238: a send failure for one recipient must not abort the batch —
  // class 1 (cron, sendDueRemindersForEvent) logs and moves on; class 2
  // (organizer-triggered remindNow) additionally surfaces `failed` in its
  // response so the organizer sees a structured partial-failure summary
  // instead of a 500.
  const failed: { email: string; message: string }[] = [];

  // DEC-603: one id per fan-out call (this function), shared by every
  // recipient in the loop below, so the comms history tab can group the
  // batch into one row.
  const batchId = newId();

  // DEC-530: resolve every recipient's account identity in one batched query
  // instead of per-recipient (the capped group is bounded, so this stays a
  // single round trip regardless of group count).
  const accountMap = await findAccountUserIds(
    db,
    groups.map((group) => {
      const rows = outstandingByContact.get(group.contactId) ?? [];
      const first = rows[0];
      return { contactId: group.contactId, email: first?.email ?? "" };
    }),
  );

  // DEC-530 wave-46 amendment: resolve every recipient's portal link (and
  // mint any claim tokens needed) through ONE batched Promise.all before the
  // send loop, instead of an await-per-recipient KV round trip inside it.
  const portalLinkMap = await resolvePortalLinks(
    kv,
    groups.map((group) => ({ contactId: group.contactId, userId: accountMap.get(group.contactId) ?? null })),
    eventId,
    origin,
    mintClaimTokens,
  );

  for (const group of groups) {
    const rows = outstandingByContact.get(group.contactId) ?? [];
    if (rows.length === 0) continue;
    const first = rows[0];
    if (!first) continue;

    const portalLink = portalLinkMap.get(group.contactId);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${group.contactId}`);
    const { subject, text: reminderText } = buildReminderMessage(
      eventName,
      eventTimezone,
      group.assignments,
      portalLink,
    );

    try {
      await mailer.send({
        to: { email: first.email, name: `${first.firstName} ${first.lastName}`.trim() },
        subject,
        text: reminderText,
        html: textToHtml(reminderText),
        eventId,
        contactId: group.contactId,
        batchId,
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
  kv: KVStore,
  origin: string,
  contactIds?: string[],
): Promise<{ sent: number; failed: { email: string; message: string }[]; skipped: number; remaining: number }> {
  const outstanding = await listOutstandingForEvent(db, eventId, taskIds, contactIds);
  if (outstanding.length === 0) return { sent: 0, failed: [], skipped: 0, remaining: 0 };
  const eventName = outstanding[0]?.eventName ?? "";
  const eventTimezone = outstanding[0]?.timezone ?? "";

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

  const result = await sendReminderEmails(
    db,
    mailer,
    eventId,
    eventName,
    eventTimezone,
    plan.groups,
    outstandingByContact,
    now,
    kv,
    origin,
    true,
  );
  return { ...result, skipped: plan.skipped, remaining: plan.remaining };
}

/** Preview for "remind now" (SPEC §10 #3, DEC-441): runs the identical
 * listOutstandingForEvent + planManualReminders path as remindNow and
 * renders each group through the same buildReminderMessage used by the
 * real send, but never calls the mailer and never writes a row — pure
 * read, safe to call as often as an organizer opens the review dialog. */
export async function previewRemindNow(
  db: Db,
  eventId: string,
  taskIds: string[] | undefined,
  now: Date,
  kv: KVStore,
  origin: string,
  contactIds?: string[],
): Promise<{
  drafts: { contactId: string; email: string; name: string; subject: string; text: string }[];
  skipped: number;
  remaining: number;
}> {
  const outstanding = await listOutstandingForEvent(db, eventId, taskIds, contactIds);
  if (outstanding.length === 0) return { drafts: [], skipped: 0, remaining: 0 };
  const eventName = outstanding[0]?.eventName ?? "";
  const eventTimezone = outstanding[0]?.timezone ?? "";

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

  // DEC-530/DEC-397: batched account lookup, then a preview never mints a
  // claim token (mintClaimTokens=false) — a userless contact resolves to
  // the fixed PREVIEW_CLAIM_TOKEN placeholder with zero KV writes.
  const accountMap = await findAccountUserIds(
    db,
    plan.groups.map((group) => {
      const rows = outstandingByContact.get(group.contactId) ?? [];
      const first = rows[0];
      return { contactId: group.contactId, email: first?.email ?? "" };
    }),
  );

  // DEC-530 wave-46 amendment: batched resolution above the preview loop —
  // mintClaimTokens=false, so this never touches KV regardless of group
  // count (userless contacts resolve to PREVIEW_CLAIM_TOKEN).
  const portalLinkMap = await resolvePortalLinks(
    kv,
    plan.groups.map((group) => ({ contactId: group.contactId, userId: accountMap.get(group.contactId) ?? null })),
    eventId,
    origin,
    false,
  );

  const drafts: { contactId: string; email: string; name: string; subject: string; text: string }[] = [];
  for (const group of plan.groups) {
    const rows = outstandingByContact.get(group.contactId) ?? [];
    const first = rows[0];
    if (!first) continue;
    const portalLink = portalLinkMap.get(group.contactId);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${group.contactId}`);
    const { subject, text } = buildReminderMessage(eventName, eventTimezone, group.assignments, portalLink);
    drafts.push({
      contactId: group.contactId,
      email: first.email,
      name: `${first.firstName} ${first.lastName}`.trim(),
      subject,
      text,
    });
  }
  return { drafts, skipped: plan.skipped, remaining: plan.remaining };
}

/** Due-date-driven cron reminder pass, scoped to one event's outstanding
 * assignments, filtered through the pure DEC-023 planReminders gate. Never
 * triggered by a submission/assignment status change (DEC-009). */
export async function sendDueRemindersForEvent(
  db: Db,
  mailer: Mailer,
  eventId: string,
  now: Date,
  kv: KVStore,
  origin: string,
): Promise<number> {
  const outstanding = await listOutstandingForEvent(db, eventId);
  if (outstanding.length === 0) return 0;
  const eventName = outstanding[0]?.eventName ?? "";
  const eventTimezone = outstanding[0]?.timezone ?? "";

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

  const result = await sendReminderEmails(
    db,
    mailer,
    eventId,
    eventName,
    eventTimezone,
    cappedGroups,
    outstandingByContact,
    now,
    kv,
    origin,
    true,
  );
  return result.sent;
}

/** All event ids that have at least one non-complete task assignment — the
 * cron's outer loop, so each event's reminder pass stays a small, scoped
 * joined query rather than one unbounded cross-event query. DEC-537: the
 * dedupe is a SQL DISTINCT, not a whole-table scan reduced in JS. */
export async function listEventIdsWithOutstandingAssignments(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventId: schema.task.eventId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(and(eq(schema.taskAssignment.status, "pending"), isNull(schema.taskAssignment.completedAt)));
  return rows.map((r) => r.eventId);
}
