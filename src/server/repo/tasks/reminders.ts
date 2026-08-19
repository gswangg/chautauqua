// J6 onboarding tasks repo (DEC-023): reminder sends, shared by the bulk
// 'remind now' endpoint and the due-date cron. Split out of repo/tasks.ts
// for contention decomposition (no behavior change) — see repo/tasks.ts's
// barrel header.

import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { newId } from "../../../domain/ids";
import type { Mailer } from "../../../mail/types";
import { renderTemplate } from "../../../mail/render";
import { renderEmailHtml } from "../../../mail/shell";
import type { ReminderAssignment } from "../../../domain/reminders";
import {
  capReminderGroups,
  DEDUPE_WINDOW_MS,
  DUE_WINDOW_MS,
  formatTaskLines,
  MANUAL_DEDUPE_WINDOW_MS,
  MAX_REMINDER_BATCH,
  planManualReminders,
  planReminders,
  REMINDER_OVERDUE_TAIL_MS,
  sortReminderAssignments,
} from "../../../domain/reminders";
import type { KVStore } from "../../../auth/claim";
import { resolvePortalLinks } from "../portal-link";
import { findAccountUserIds } from "../comms";
import { ASSIGNED_LATE_GRACE_DAYS, effectiveAssignmentDueDayLabel } from "../../../domain/task-due";
import { ApiError } from "../../http";
import { dayLabelEndInstant, zonedMinutesToUtc } from "../../../lib/timezone";
import { formatCalendarDate } from "../../../lib/event-time";
import { chaseableContactExists } from "./crud";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../../lib/fanout";
import { DEC_441 } from "../../../decisions";

void DEC_441;

// DEC-319 wave-56 amendment: hard ceiling on the single-event outstanding
// scan below — a per-event reminder pass should never be reading past this
// many rows; refuse rather than silently truncate (contacts/crud.ts's
// MAX_CONTACT_DIRECTORY_SCAN pattern).
export const MAX_REMINDER_SCAN = 20000;

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
  eventEndDate: string;
}

// DEC-078: taskIds/contactIds arrive via parseBoundedIdArray (routes/tasks.ts),
// whose ceiling (DEFAULT_BOUNDED_ID_ARRAY_MAX = 1000) is far above D1's
// bound-parameter budget — a caller-supplied filter list is exactly the
// "can grow with data" shape DEC-078 targets, so both listOutstandingForEvent
// and listRemindableContactIds below run one query per (taskId chunk,
// contactId chunk) pair instead of binding the raw lists directly. When a
// filter is absent/empty the pair loop degenerates to a single undefined
// chunk, matching the original unfiltered query.
function idChunksOrUndefined(ids: string[] | undefined): (string[] | undefined)[] {
  return ids && ids.length > 0 ? chunkIds(ids) : [undefined];
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
  const rows: {
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
    eventEndDate: string;
    assignmentCreatedAt: Date;
  }[] = [];
  outer: for (const taskIdChunk of idChunksOrUndefined(taskIds)) {
    for (const contactIdChunk of idChunksOrUndefined(contactIds)) {
      const conditions = [
        eq(schema.task.eventId, eventId),
        eq(schema.taskAssignment.status, "pending"),
        chaseableContactExists(eventId),
      ];
      if (taskIdChunk) conditions.push(inArray(schema.taskAssignment.taskId, taskIdChunk));
      if (contactIdChunk) conditions.push(inArray(schema.taskAssignment.contactId, contactIdChunk));
      const batchRows = await db
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
          eventEndDate: schema.event.endDate,
          assignmentCreatedAt: schema.taskAssignment.createdAt,
        })
        .from(schema.taskAssignment)
        .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
        .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
        .innerJoin(schema.contact, eq(schema.taskAssignment.contactId, schema.contact.id))
        .where(and(...conditions))
        .limit(MAX_REMINDER_SCAN + 1 - rows.length);
      rows.push(...batchRows);
      if (rows.length > MAX_REMINDER_SCAN) break outer;
    }
  }

  if (rows.length > MAX_REMINDER_SCAN) {
    throw new ApiError(
      "invalid",
      `This reminder pass would scan more than ${MAX_REMINDER_SCAN} outstanding assignments — narrow with taskIds/contactIds first`,
    );
  }
  // DEC-801: dueDate reported on each row is the assignment's EFFECTIVE due
  // date, not the raw task.dueDate — so reminder emails and compose's
  // {due_date} agree with the grid badge/cell, which judge against the same
  // day-label rule. The row SHAPE (dueDate: Date | null) is unchanged, only
  // the value. DEC-801 (wave 38 amendment): the grace branch is expanded via
  // effectiveAssignmentDueDayLabel into the event-local calendar day, not
  // the raw UTC instant — this is a reader-facing due date, never the
  // private instant form.
  return rows.map((r): OutstandingRow => {
    const effective = effectiveAssignmentDueDayLabel(
      r.dueDate ? r.dueDate.getTime() : null,
      r.assignmentCreatedAt.getTime(),
      r.timezone,
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
      eventEndDate: r.eventEndDate,
    };
  });
}

/** DEC-319 wave-56 amendment: chooses the reminder batch's recipient set in
 * SQL (one GROUP BY over pending assignments, per-contact
 * max(last_reminded_at) dedupe gate, ORDER BY contact_id ASC LIMIT max)
 * instead of loading every outstanding row for the event and slicing in JS
 * — so a huge event's dedupe/cap decision never reads more than `max`
 * contacts' worth of rows downstream. remindNow and previewRemindNow both
 * call this FIRST, then re-query listOutstandingForEvent scoped to
 * `chosen.contactIds` — the two callers must derive their recipient set
 * from this one function so preview and send never diverge. */
export async function listRemindableContactIds(
  db: Db,
  eventId: string,
  opts: { taskIds?: string[]; contactIds?: string[]; now: number; dedupeWindowMs: number; max: number },
): Promise<{ contactIds: string[]; skipped: number; remaining: number }> {
  // DEC-078: opts.taskIds/opts.contactIds arrive via parseBoundedIdArray
  // (max 1000), which exceeds D1's bound-parameter budget. Both filters are
  // WHERE-clause membership tests over the SAME grouped aggregate (per-
  // contact max(last_reminded_at)), so naively chunking either dimension
  // into separate SQL queries would split one contact's aggregate across
  // queries and silently corrupt the eligible/skipped dedupe decision. When
  // either filter is present this falls back to a chunked raw-row fetch
  // (bounded by MAX_REMINDER_SCAN, same ceiling as listOutstandingForEvent)
  // and does the max/eligible/skipped aggregation in JS instead of SQL —
  // the unfiltered fast path below (both filters absent) is untouched.
  if ((opts.taskIds && opts.taskIds.length > 0) || (opts.contactIds && opts.contactIds.length > 0)) {
    return listRemindableContactIdsFiltered(db, eventId, opts);
  }
  const conditions = [
    eq(schema.task.eventId, eventId),
    eq(schema.taskAssignment.status, "pending"),
    chaseableContactExists(eventId),
  ];

  const cutoff = opts.now - opts.dedupeWindowMs;
  const lastRemindedMax = sql`max(${schema.taskAssignment.lastRemindedAt})`;
  const eligibleHaving = sql`${lastRemindedMax} is null or ${lastRemindedMax} <= ${cutoff}`;
  const skippedHaving = sql`${lastRemindedMax} is not null and ${lastRemindedMax} > ${cutoff}`;

  const eligibleGroups = db
    .select({ contactId: schema.taskAssignment.contactId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(and(...conditions))
    .groupBy(schema.taskAssignment.contactId)
    .having(eligibleHaving)
    .as("eligible_reminder_contacts");
  const skippedGroups = db
    .select({ contactId: schema.taskAssignment.contactId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(and(...conditions))
    .groupBy(schema.taskAssignment.contactId)
    .having(skippedHaving)
    .as("skipped_reminder_contacts");

  const [chosenRows, eligibleCountRows, skippedCountRows] = await Promise.all([
    db
      .select({ contactId: schema.taskAssignment.contactId })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .where(and(...conditions))
      .groupBy(schema.taskAssignment.contactId)
      .having(eligibleHaving)
      .orderBy(asc(schema.taskAssignment.contactId))
      .limit(opts.max),
    db.select({ count: sql<number>`count(*)` }).from(eligibleGroups),
    db.select({ count: sql<number>`count(*)` }).from(skippedGroups),
  ]);

  const eligibleTotal = Number(eligibleCountRows[0]?.count ?? 0);
  const skipped = Number(skippedCountRows[0]?.count ?? 0);
  const remaining = Math.max(eligibleTotal - opts.max, 0);

  return { contactIds: chosenRows.map((r) => r.contactId), skipped, remaining };
}

/** DEC-078 chunked fallback for listRemindableContactIds when taskIds/
 * contactIds is present -- see that function's header. Fetches raw
 * (contactId, lastRemindedAt) rows per (taskId chunk x contactId chunk)
 * pair, capped at MAX_REMINDER_SCAN like listOutstandingForEvent, then
 * reduces to the same per-contact max(last_reminded_at) eligible/skipped
 * split and ORDER BY contactId ASC LIMIT max the SQL fast path computes. */
async function listRemindableContactIdsFiltered(
  db: Db,
  eventId: string,
  opts: { taskIds?: string[]; contactIds?: string[]; now: number; dedupeWindowMs: number; max: number },
): Promise<{ contactIds: string[]; skipped: number; remaining: number }> {
  const rows: { contactId: string; lastRemindedAt: Date | null }[] = [];
  outer: for (const taskIdChunk of idChunksOrUndefined(opts.taskIds)) {
    for (const contactIdChunk of idChunksOrUndefined(opts.contactIds)) {
      const conditions = [
        eq(schema.task.eventId, eventId),
        eq(schema.taskAssignment.status, "pending"),
        chaseableContactExists(eventId),
      ];
      if (taskIdChunk) conditions.push(inArray(schema.taskAssignment.taskId, taskIdChunk));
      if (contactIdChunk) conditions.push(inArray(schema.taskAssignment.contactId, contactIdChunk));
      const batchRows = await db
        .select({ contactId: schema.taskAssignment.contactId, lastRemindedAt: schema.taskAssignment.lastRemindedAt })
        .from(schema.taskAssignment)
        .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
        .where(and(...conditions))
        .limit(MAX_REMINDER_SCAN + 1 - rows.length);
      rows.push(...batchRows);
      if (rows.length > MAX_REMINDER_SCAN) break outer;
    }
  }
  if (rows.length > MAX_REMINDER_SCAN) {
    throw new ApiError(
      "invalid",
      `This reminder pass would scan more than ${MAX_REMINDER_SCAN} outstanding assignments — narrow with taskIds/contactIds first`,
    );
  }

  const cutoff = opts.now - opts.dedupeWindowMs;
  // Mirrors SQL max(last_reminded_at): non-null values win over null
  // (SQL's max() ignores NULLs), and a contact's aggregate is null only
  // when EVERY one of its rows is null (never reminded on any matching
  // assignment).
  const maxLastRemindedByContact = new Map<string, number | null>();
  for (const row of rows) {
    const ts = row.lastRemindedAt ? row.lastRemindedAt.getTime() : null;
    if (!maxLastRemindedByContact.has(row.contactId)) {
      maxLastRemindedByContact.set(row.contactId, ts);
      continue;
    }
    const prev = maxLastRemindedByContact.get(row.contactId) ?? null;
    if (prev === null && ts === null) {
      maxLastRemindedByContact.set(row.contactId, null);
    } else {
      maxLastRemindedByContact.set(row.contactId, Math.max(prev ?? -Infinity, ts ?? -Infinity));
    }
  }

  const eligibleContactIds: string[] = [];
  let skipped = 0;
  for (const [contactId, lastRemindedAt] of maxLastRemindedByContact) {
    if (lastRemindedAt === null || lastRemindedAt <= cutoff) eligibleContactIds.push(contactId);
    else skipped++;
  }
  eligibleContactIds.sort();
  const eligibleTotal = eligibleContactIds.length;
  const chosen = eligibleContactIds.slice(0, opts.max);
  const remaining = Math.max(eligibleTotal - opts.max, 0);

  return { contactIds: chosen, skipped, remaining };
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

/** The event-independent head of every task-reminder subject. Extracted so
 * the one place that COMPOSES a reminder subject (buildReminderMessage
 * below) and the one place that RECOGNISES one in email_log
 * (countRemindSends, ./task-view.ts — design pack v12's task view needs a
 * per-speaker send count, which task_assignment does not carry) share one
 * literal instead of two copies that could drift. A prefix, not the whole
 * subject, so renaming an event never orphans its own send history. */
export const REMINDER_SUBJECT_PREFIX = "Action needed: outstanding tasks for ";

/** ONE builder for the reminder email body — used by both the real send
 * (sendReminderEmails) and the preview endpoint (previewRemindNow), so a
 * preview draft is always byte-identical to what a send would produce. */
export function buildReminderMessage(
  eventName: string,
  assignments: ReminderAssignment[],
  portalLink: string,
): { subject: string; text: string } {
  const header = renderTemplate("You have outstanding tasks for {event_name}:", {
    event_name: eventName,
  });
  // DEC-564/DEC-792: shared task-line renderer — dueDate is a DEC-522
  // calendar day, not an instant, so no timezone is needed to render it
  // (wave-9 amendment: the dead eventTimezone parameter this comment used
  // to justify keeping was removed instead — DEC-851/DEC-988 class).
  const taskLines = formatTaskLines(assignments);
  // DEC-559: append the portal link through the same renderTemplate
  // '{portal_link}' idiom the CFP confirmation email uses (submit.tsx).
  const footer = renderTemplate("{portal_link}", { portal_link: portalLink });
  const text = [header, ...taskLines, "", footer].join("\n");
  return { subject: `${REMINDER_SUBJECT_PREFIX}${eventName}`, text };
}

/** Sends one reminder email per contact via `mailer`. DEC-023 amendment
 * (closes CONFIRMED-DEFECT #1, docs/verification-log/index/0232): the
 * dedupe stamp is now a CLAIM issued BEFORE the mail loop, not a record
 * written after it — two overlapping calls (e.g. two overlapping cron
 * ticks) racing this function each claim only the assignment ids their own
 * conditional UPDATE actually won (`.returning()`), so at most one of them
 * sends to a given contact, and a crash between the claim and the send
 * leaves the assignment claimed (no re-send this tick) rather than
 * unclaimed-but-already-mailed (guaranteed re-send next tick, the old
 * defect). `claimCutoff` reproduces the caller's own dedupe gate at claim
 * time: the due-date cron passes `now - DEDUPE_WINDOW_MS` so a claim only
 * wins rows that are still due for a reminder by the same rule
 * isReminderDue already applied to select the group; `remindNow` passes
 * `null` (DEC-319: an explicit organizer action deliberately ignores the
 * dedupe window) so its claim is unconditional — still idempotent under
 * retry (a second call simply re-claims and re-sends, exactly today's
 * remindNow behavior) without being gated on `lastRemindedAt`.
 *
 * A group with a mailer failure releases its claimed ids back to each
 * assignment's pre-claim `lastRemindedAt` (available on the OutstandingRow
 * already loaded into `outstandingByContact`), so today's "failed sends
 * retry on the next tick" behavior survives the claim. Used by both the
 * bulk 'remind now' endpoint (taskIds optional filter, ignores the
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
  kv: KVStore,
  origin: string,
  mintClaimTokens: boolean,
  claimCutoff: Date | null,
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

  // Pre-claim lastRemindedAt per assignment id, so a failed send can be
  // released back to exactly what it held before this call claimed it.
  const preClaimLastReminded = new Map<string, Date | null>();
  for (const rows of outstandingByContact.values()) {
    for (const r of rows) preClaimLastReminded.set(r.assignmentId, r.lastRemindedAt);
  }

  // DEC-023 amendment: claim BEFORE the mail loop — a conditional chunked
  // UPDATE per group of assignment ids, collecting only the ids this call's
  // own WHERE actually matched (RETURNING) into `claimedIds`. A group whose
  // claim loses every one of its assignments to a concurrent claimant is
  // dropped from the send set entirely (not counted in `sent`).
  const allAssignmentIds = groups.flatMap((group) => group.assignments.map((a) => a.assignmentId));
  const claimedIds = new Set<string>();
  for (const chunk of chunkIds(allAssignmentIds)) {
    const claimedRows = await db
      .update(schema.taskAssignment)
      .set({ lastRemindedAt: now, updatedAt: now })
      .where(
        and(
          inArray(schema.taskAssignment.id, chunk),
          claimCutoff
            ? or(isNull(schema.taskAssignment.lastRemindedAt), lte(schema.taskAssignment.lastRemindedAt, claimCutoff))
            : undefined,
        ),
      )
      .returning({ id: schema.taskAssignment.id });
    for (const row of claimedRows) claimedIds.add(row.id);
  }

  const claimedGroups = groups.filter((group) => group.assignments.some((a) => claimedIds.has(a.assignmentId)));
  if (claimedGroups.length === 0) return { sent: 0, failed: [] };

  // DEC-530: resolve every recipient's account identity in one batched query
  // instead of per-recipient (the capped group is bounded, so this stays a
  // single round trip regardless of group count).
  const accountMap = await findAccountUserIds(
    db,
    claimedGroups.map((group) => {
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
    claimedGroups.map((group) => ({ contactId: group.contactId, userId: accountMap.get(group.contactId) ?? null })),
    eventId,
    origin,
    mintClaimTokens,
  );

  // Ids to release back to their pre-claim lastRemindedAt on a mailer
  // failure, accumulated across the loop and applied after it (grouped by
  // the value being restored, since a chunked UPDATE carries one SET value).
  const toRelease = new Map<string, string[]>(); // key: "null" | epoch-ms string -> assignment ids

  // Groups with no outstanding rows (or an empty first row) never reach the
  // mailer at all -- filtered out here, exactly as the old loop's `continue`
  // skipped them before attempting a send, so they can never show up in
  // `sent` or `failed`.
  // The `!portalLink` check stays OUTSIDE the per-recipient failure unit
  // (unlike the mailer.send call): resolvePortalLinks having no entry for a
  // claimed group is an internal invariant violation, not a per-recipient
  // mail failure, so it must still throw and abort the whole call rather
  // than land in `failed[]`.
  const sendable = claimedGroups
    .map((group) => {
      const rows = outstandingByContact.get(group.contactId) ?? [];
      const first = rows[0];
      if (!first) return null;
      const portalLink = portalLinkMap.get(group.contactId);
      if (!portalLink) throw new Error(`no portal link resolved for contactId ${group.contactId}`);
      return { group, first, portalLink };
    })
    .filter((x): x is { group: (typeof claimedGroups)[number]; first: OutstandingRow; portalLink: string } => x !== null);

  // DEC-530 wave-70 amendment: up to MAIL_FANOUT_CONCURRENCY sends in
  // flight at once; results come back in INPUT order so sent/failed/
  // toRelease below reconstruct exactly what the old sequential loop
  // produced.
  const results = await mapWithConcurrency(sendable, MAIL_FANOUT_CONCURRENCY, async ({ group, first, portalLink }) => {
    const { subject, text: reminderText } = buildReminderMessage(eventName, group.assignments, portalLink);
    await mailer.send({
      to: { email: first.email, name: `${first.firstName} ${first.lastName}`.trim() },
      subject,
      text: reminderText,
      html: renderEmailHtml(reminderText, {
        eventName,
        reason: `you have outstanding tasks for ${eventName}`,
      }),
      eventId,
      contactId: group.contactId,
      batchId,
    });
  });

  results.forEach((result, i) => {
    const { group, first } = sendable[i]!;
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }
    const err = result.reason;
    console.error("reminder email failed for", first.email, err);
    failed.push({ email: first.email, message: err instanceof Error ? err.message : String(err) });
    for (const a of group.assignments) {
      if (!claimedIds.has(a.assignmentId)) continue;
      const preClaim = preClaimLastReminded.get(a.assignmentId) ?? null;
      const key = preClaim ? String(preClaim.getTime()) : "null";
      const idsForKey = toRelease.get(key) ?? [];
      idsForKey.push(a.assignmentId);
      toRelease.set(key, idsForKey);
    }
  });

  for (const [key, ids] of toRelease) {
    const restoreValue = key === "null" ? null : new Date(Number(key));
    for (const chunk of chunkIds(ids)) {
      await db
        .update(schema.taskAssignment)
        .set({ lastRemindedAt: restoreValue })
        .where(inArray(schema.taskAssignment.id, chunk));
    }
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
  const chosen = await listRemindableContactIds(db, eventId, {
    taskIds,
    contactIds,
    now: now.getTime(),
    dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
    max: MAX_REMINDER_BATCH,
  });
  if (chosen.contactIds.length === 0) {
    return { sent: 0, failed: [], skipped: chosen.skipped, remaining: chosen.remaining };
  }

  const outstanding = await listOutstandingForEvent(db, eventId, taskIds, chosen.contactIds);
  if (outstanding.length === 0) {
    return { sent: 0, failed: [], skipped: chosen.skipped, remaining: chosen.remaining };
  }
  const eventName = outstanding[0]?.eventName ?? "";

  const outstandingByContact = new Map<string, OutstandingRow[]>();
  for (const r of outstanding) {
    const arr = outstandingByContact.get(r.contactId) ?? [];
    arr.push(r);
    outstandingByContact.set(r.contactId, arr);
  }

  // wave-56 amendment: the SQL cap/dedupe already ran in
  // listRemindableContactIds — planManualReminders is now a validating
  // no-op over the narrowed `outstanding` set (it still groups by contact
  // and drops complete assignments, but every contact here already passed
  // the dedupe/cap gate).
  const plan = planManualReminders({
    assignments: outstanding.map(toReminderAssignment),
    now: now.getTime(),
  });
  if (plan.groups.length === 0) {
    return { sent: 0, failed: [], skipped: chosen.skipped, remaining: chosen.remaining };
  }

  const result = await sendReminderEmails(
    db,
    mailer,
    eventId,
    eventName,
    plan.groups,
    outstandingByContact,
    now,
    kv,
    origin,
    true,
    null,
  );
  return { ...result, skipped: chosen.skipped, remaining: chosen.remaining };
}

/** DEC-441: the per-recipient task summary the review dialog renders
 * (`Chautauqua Speakers.dc.html:504-541`'s per-recipient row) — built from
 * the SAME `group.assignments` buildReminderMessage consumes below, using
 * the shared sortReminderAssignments ordering (never a second sort that
 * could drift, DEC-613). `dueDate` on each ReminderAssignment is already
 * the assignment's EFFECTIVE due day label (listOutstandingForEvent), so
 * "overdue" is judged straight against dayLabelEndInstant — no second
 * effectiveAssignmentDueDayLabel pass, no assignedAt, no extra query. */
function buildReminderTaskSummaries(
  assignments: ReminderAssignment[],
  now: number,
  timeZone: string,
): { title: string; dueLabel: string; overdue: boolean }[] {
  return sortReminderAssignments(assignments).map((a) => {
    if (a.dueDate === null) {
      return { title: a.taskTitle, dueLabel: "No due date", overdue: false };
    }
    return {
      title: a.taskTitle,
      dueLabel: formatCalendarDate(a.dueDate),
      overdue: now > dayLabelEndInstant(a.dueDate, timeZone),
    };
  });
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
  drafts: {
    contactId: string;
    email: string;
    name: string;
    subject: string;
    text: string;
    tasks: { title: string; dueLabel: string; overdue: boolean }[];
  }[];
  skipped: number;
  remaining: number;
}> {
  const chosen = await listRemindableContactIds(db, eventId, {
    taskIds,
    contactIds,
    now: now.getTime(),
    dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
    max: MAX_REMINDER_BATCH,
  });
  if (chosen.contactIds.length === 0) return { drafts: [], skipped: chosen.skipped, remaining: chosen.remaining };

  const outstanding = await listOutstandingForEvent(db, eventId, taskIds, chosen.contactIds);
  if (outstanding.length === 0) return { drafts: [], skipped: chosen.skipped, remaining: chosen.remaining };
  const eventName = outstanding[0]?.eventName ?? "";

  const outstandingByContact = new Map<string, OutstandingRow[]>();
  for (const r of outstanding) {
    const arr = outstandingByContact.get(r.contactId) ?? [];
    arr.push(r);
    outstandingByContact.set(r.contactId, arr);
  }

  // wave-56 amendment: validating no-op — see remindNow's identical comment.
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

  const drafts: {
    contactId: string;
    email: string;
    name: string;
    subject: string;
    text: string;
    tasks: { title: string; dueLabel: string; overdue: boolean }[];
  }[] = [];
  for (const group of plan.groups) {
    const rows = outstandingByContact.get(group.contactId) ?? [];
    const first = rows[0];
    if (!first) continue;
    const portalLink = portalLinkMap.get(group.contactId);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${group.contactId}`);
    const { subject, text } = buildReminderMessage(eventName, group.assignments, portalLink);
    drafts.push({
      contactId: group.contactId,
      email: first.email,
      name: `${first.firstName} ${first.lastName}`.trim(),
      subject,
      text,
      tasks: buildReminderTaskSummaries(group.assignments, now.getTime(), first.timezone),
    });
  }
  return { drafts, skipped: chosen.skipped, remaining: chosen.remaining };
}

/** DEC-319 amendment (wave 38): bounds the cron's read instead of refusing
 * the pass. This is a COARSE SUPERSET pre-filter, ONLY a bound on how many
 * contacts the cron's per-event query loads downstream — mirroring the
 * wording on listEventIdsWithOutstandingAssignments's coarse pre-filter
 * above. It is NOT the authoritative "is this reminder due" verdict:
 * planReminders (via isReminderDue, same DUE_WINDOW_MS/DEDUPE_WINDOW_MS/
 * REMINDER_OVERDUE_TAIL_MS constants) remains the one authority for what
 * actually sends, applied afterward by sendDueRemindersForEvent over the
 * rows this function's contactIds narrow listOutstandingForEvent to.
 *
 * Composes the DEC-801 effective-due CASE expression in the same shape as
 * overdueAssignmentConditions (./crud) — task.dueDate, or, when the
 * assignment was created after that date, assignment.createdAt plus the
 * ASSIGNED_LATE_GRACE_DAYS grace window — between now - REMINDER_OVERDUE_
 * TAIL_MS and now + DUE_WINDOW_MS, and only contacts never reminded or last
 * reminded before now - DEDUPE_WINDOW_MS. Grouped by contact, ordered
 * contactId ascending, limited to `max` so a later tick's cap starts from
 * the next slice (DEC-535 capById convention) rather than repeating the
 * same head of the set forever. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function listDueReminderContactIds(
  db: Db,
  eventId: string,
  opts: { now: number; max: number },
): Promise<string[]> {
  const graceMs = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const effectiveDueDate = sql`(case when ${schema.task.dueDate} >= ${schema.taskAssignment.createdAt} then ${schema.task.dueDate} else ${schema.taskAssignment.createdAt} + ${graceMs} end)`;
  // wave-61 amendment (DEC-023): slack on both ends. The authoritative gate
  // (isReminderDue, via planReminders) now expands dueDate through
  // dayLabelEndInstant(dueDate, timeZone) before comparing. Measured against
  // dayLabelEndInstant directly: for America/Los_Angeles (UTC-8/-7) that gap
  // is ~31-32h, not <=24h — a single ONE_DAY_MS of slack provably fails to
  // be a superset (verified: a dueDate ~27h before now-TAIL is still
  // accepted by isReminderDue for an LA event, but sits outside a
  // one-day-widened window). The true max gap across real IANA offsets
  // (UTC-12..UTC+14) is ~36h, so TWO_DAY_MS of slack on each side is used
  // instead, with headroom. This function's own doc above already declares
  // it is a COARSE SUPERSET bound, not the verdict.
  const TWO_DAY_MS = 2 * ONE_DAY_MS;
  const windowStart = opts.now - REMINDER_OVERDUE_TAIL_MS - TWO_DAY_MS;
  const windowEnd = opts.now + DUE_WINDOW_MS + TWO_DAY_MS;
  const dedupeCutoff = opts.now - DEDUPE_WINDOW_MS;
  const lastRemindedMax = sql`max(${schema.taskAssignment.lastRemindedAt})`;

  const rows = await db
    .select({ contactId: schema.taskAssignment.contactId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(
      and(
        eq(schema.task.eventId, eventId),
        eq(schema.taskAssignment.status, "pending"),
        chaseableContactExists(eventId),
        sql`${schema.task.dueDate} is not null`,
        sql`${effectiveDueDate} >= ${windowStart} and ${effectiveDueDate} <= ${windowEnd}`,
      ),
    )
    .groupBy(schema.taskAssignment.contactId)
    .having(sql`${lastRemindedMax} is null or ${lastRemindedMax} <= ${dedupeCutoff}`)
    .orderBy(asc(schema.taskAssignment.contactId))
    .limit(opts.max);

  return rows.map((r) => r.contactId);
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
  const dueContactIds = await listDueReminderContactIds(db, eventId, {
    now: now.getTime(),
    max: MAX_REMINDER_BATCH,
  });
  if (dueContactIds.length === 0) return 0;

  const outstanding = await listOutstandingForEvent(db, eventId, undefined, dueContactIds);
  if (outstanding.length === 0) return 0;
  const eventName = outstanding[0]?.eventName ?? "";
  const eventTimezone = outstanding[0]?.timezone ?? "";
  const eventEndDate = outstanding[0]?.eventEndDate ?? "";

  const outstandingByContact = new Map<string, OutstandingRow[]>();
  for (const r of outstanding) {
    const arr = outstandingByContact.get(r.contactId) ?? [];
    arr.push(r);
    outstandingByContact.set(r.contactId, arr);
  }

  // wave-82 amendment (DEC-023): the guard MUST precede the computation it
  // protects — an empty timezone must surface this named error, not an
  // opaque RangeError from zonedMinutesToUtc one line below.
  if (!eventTimezone) throw new Error(`no event timezone resolved for eventId ${eventId}`);

  // wave-58 amendment (DEC-023): the event's own end-of-day instant, in the
  // event's timezone, is the cron's terminal gate — an incomplete task never
  // gets reminded past the event it belongs to.
  const eventEndsAt = zonedMinutesToUtc(eventEndDate, 24 * 60, eventTimezone).getTime();

  const plan = planReminders({
    assignments: outstanding.map(toReminderAssignment),
    now: now.getTime(),
    eventEndsAt,
    timeZone: eventTimezone,
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
    cappedGroups,
    outstandingByContact,
    now,
    kv,
    origin,
    true,
    new Date(now.getTime() - DEDUPE_WINDOW_MS),
  );
  return result.sent;
}

/** All event ids that have at least one non-complete task assignment — the
 * cron's outer loop, so each event's reminder pass stays a small, scoped
 * joined query rather than one unbounded cross-event query. DEC-537: the
 * dedupe is a SQL DISTINCT, not a whole-table scan reduced in JS.
 *
 * wave-58 amendment (DEC-023): also inner-joins schema.event and applies a
 * COARSE superset pre-filter (event.end_date >= now-2days, a lexicographic
 * text compare on the ISO YYYY-MM-DD column — 2 days of slack covers every
 * timezone offset around the true event-local end-of-day instant). This
 * pre-filter is ONLY a bound on the outer loop so a long-dead event's rows
 * stop being re-scanned every tick; it is NOT the authoritative terminal
 * gate — planReminders' per-assignment eventEndsAt check (computed from the
 * event's actual timezone) inside sendDueRemindersForEvent is. */
export async function listEventIdsWithOutstandingAssignments(db: Db, now: Date): Promise<string[]> {
  const cutoffDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  const rows = await db
    .selectDistinct({ eventId: schema.task.eventId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(
      and(
        eq(schema.taskAssignment.status, "pending"),
        isNull(schema.taskAssignment.completedAt),
        gte(schema.event.endDate, cutoff),
      ),
    );
  return rows.map((r) => r.eventId);
}
