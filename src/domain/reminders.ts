// J6 reminder planner (DEC-023): pure, schedule-driven selection of
// task_assignment rows due for a reminder email. NEVER decision-driven
// (DEC-009 invariant #1 companion rule) — this module reacts only to
// dueDate/now/lastRemindedAt, never to a status transition event.

import { formatCalendarDate } from "../lib/event-time";
import { dayLabelEndInstant } from "../lib/timezone";

// DEC-319 amendment (wave 38): exported so the cron's SQL bounding
// pre-filter (listDueReminderContactIds, repo/tasks/reminders.ts) derives
// its window from the SAME constants planReminders/isReminderDue gate on
// below, instead of a hand-typed SQL duplicate that could drift.
export const DUE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h
export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// DEC-023 (wave-58 amendment): the cron's automatic reminder gate has a
// terminal tail -- an assignment more than 7 days past its due date stops
// being nagged forever. planManualReminders (the organizer's explicit
// "remind now" action) deliberately does NOT observe this tail.
export const REMINDER_OVERDUE_TAIL_MS = 7 * 24 * 60 * 60 * 1000;

// DEC-319: manual "remind now" batches are capped and de-duped separately
// from the cron's DUE_WINDOW/DEDUPE_WINDOW gate above.
export const MAX_REMINDER_BATCH = 100;
export const MANUAL_DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1h

// DEC-535: bounds the J4 bulk reviewer nudge the same way DEC-319 bounds its
// J6 sibling above -- matching DEC-019's 100-recipient compose cap.
export const MAX_REVIEWER_REMINDER_BATCH = 100;

export interface ReminderAssignment {
  assignmentId: string;
  contactId: string;
  status: "pending" | "complete" | string;
  dueDate: number | null;
  lastRemindedAt: number | null;
  taskId: string;
  taskTitle: string;
}

export interface PlanRemindersInput {
  assignments: ReminderAssignment[];
  now: number;
  eventEndsAt: number | null;
  timeZone: string;
}

/** DEC-023 (wave-9 amendment): planManualReminders never reads
 * eventEndsAt/timeZone — remind-now deliberately ignores the cron's
 * terminal/timezone-expanded due-window gate (see planManualReminders'
 * own doc comment) — so its input type only declares what it actually
 * reads, instead of PlanRemindersInput's full cron-shaped surface. */
export interface ManualReminderInput {
  assignments: ReminderAssignment[];
  now: number;
}

export interface ReminderGroup {
  contactId: string;
  assignments: ReminderAssignment[];
}

/**
 * DEC-564/DEC-792: the ONE task-line renderer, shared by the reminder email
 * (buildReminderMessage) and the DEC-792 compose {task_list} merge field —
 * both must render byte-identical lines for the same assignments. Sorts
 * dueDate ascending with null (no due date) last, then taskTitle ascending,
 * then assignmentId ascending as the final tiebreak of record, so a preview
 * and the send it previewed (and two sends of the same group) are always
 * byte-identical regardless of the caller's array order. dueDate is a
 * calendar day (DEC-522), not an instant — rendered via formatCalendarDate,
 * never re-zoned to a reader's/event's timezone.
 */
export function formatTaskLines(assignments: ReminderAssignment[]): string[] {
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    }
    if (a.taskTitle !== b.taskTitle) return a.taskTitle.localeCompare(b.taskTitle);
    return a.assignmentId.localeCompare(b.assignmentId);
  });
  return sortedAssignments.map((a) => {
    if (a.dueDate === null) return `- ${a.taskTitle} — No due date`;
    return `- ${a.taskTitle} — due ${formatCalendarDate(a.dueDate)}`;
  });
}

export interface PlanRemindersResult {
  groups: ReminderGroup[];
}

/** True when an assignment is incomplete AND (overdue OR due within 72h) AND
 * (never reminded OR last reminded more than 24h ago) — DEC-023. Also
 * terminal: never fires once the owning event has ended, or once the
 * assignment is more than REMINDER_OVERDUE_TAIL_MS past its due date --
 * wave-58 amendment, stops the forever drip on an incomplete task nobody
 * ever completes.
 *
 * DEC-023 (wave-61 amendment): a.dueDate is a DAY LABEL (DEC-522), not an
 * instant. Both the terminal tail and the due window are expanded through
 * dayLabelEndInstant(a.dueDate, timeZone) — the event's own timezone — before
 * comparison, so a task due "today" in the event's zone is not treated as
 * already past its 7-day tail, and the 72h window opens/closes at the
 * event-local end of the due day, not at UTC midnight. */
export function isReminderDue(
  a: ReminderAssignment,
  now: number,
  eventEndsAt: number | null,
  timeZone: string,
): boolean {
  if (a.status === "complete") return false;
  if (a.dueDate === null) return false;

  if (eventEndsAt !== null && now > eventEndsAt) return false;

  const dueEnd = dayLabelEndInstant(a.dueDate, timeZone);
  if (now > dueEnd + REMINDER_OVERDUE_TAIL_MS) return false;

  const isOverdueOrSoon = dueEnd <= now + DUE_WINDOW_MS;
  if (!isOverdueOrSoon) return false;

  if (a.lastRemindedAt === null) return true;
  return now - a.lastRemindedAt > DEDUPE_WINDOW_MS;
}

/**
 * Selects reminder-due assignments per DEC-023 and groups them per contact
 * (one email per contact listing all their outstanding tasks).
 */
export function planReminders(input: PlanRemindersInput): PlanRemindersResult {
  const byContact = new Map<string, ReminderAssignment[]>();
  for (const a of input.assignments) {
    if (!isReminderDue(a, input.now, input.eventEndsAt, input.timeZone)) continue;
    const arr = byContact.get(a.contactId) ?? [];
    arr.push(a);
    byContact.set(a.contactId, arr);
  }
  const groups: ReminderGroup[] = [...byContact.entries()].map(([contactId, assignments]) => ({
    contactId,
    assignments,
  }));
  return { groups };
}

/**
 * DEC-535: generic "sort ascending by id, slice to max, report the
 * remainder" rule -- the single implementation shared by every caller that
 * needs a deterministic, resumable batch cap (a second pass over the same
 * outstanding set advances to the next slice rather than repeating the
 * first `max`).
 */
export function capById<T>(items: T[], idOf: (t: T) => string, max: number): { items: T[]; remaining: number } {
  const sorted = [...items].sort((a, b) => {
    const ai = idOf(a);
    const bi = idOf(b);
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
  const capped = sorted.slice(0, max);
  const remaining = sorted.length - capped.length;
  return { items: capped, remaining };
}

/**
 * DEC-319: caps a list of per-contact reminder groups at `max` (default
 * MAX_REMINDER_BATCH). Thin delegate over capById (DEC-535).
 */
export function capReminderGroups<T extends { contactId: string }>(
  groups: T[],
  max: number = MAX_REMINDER_BATCH,
): { groups: T[]; remaining: number } {
  const { items, remaining } = capById(groups, (g) => g.contactId, max);
  return { groups: items, remaining };
}

/**
 * DEC-319: groups ALL outstanding assignments per contact regardless of
 * dueDate (remind-now deliberately overrides the 72h DUE_WINDOW gate used by
 * the cron's planReminders), drops any contact whose most recent
 * lastRemindedAt falls within MANUAL_DEDUPE_WINDOW_MS of `now` (counted in
 * `skipped`), then applies capReminderGroups.
 */
export function planManualReminders(input: ManualReminderInput): {
  groups: ReminderGroup[];
  skipped: number;
  remaining: number;
} {
  const byContact = new Map<string, ReminderAssignment[]>();
  for (const a of input.assignments) {
    if (a.status === "complete") continue;
    const arr = byContact.get(a.contactId) ?? [];
    arr.push(a);
    byContact.set(a.contactId, arr);
  }

  let skipped = 0;
  const eligible: ReminderGroup[] = [];
  for (const [contactId, assignments] of byContact.entries()) {
    const mostRecentRemindedAt = assignments.reduce<number | null>((latest, a) => {
      if (a.lastRemindedAt === null) return latest;
      if (latest === null || a.lastRemindedAt > latest) return a.lastRemindedAt;
      return latest;
    }, null);
    if (mostRecentRemindedAt !== null && input.now - mostRecentRemindedAt < MANUAL_DEDUPE_WINDOW_MS) {
      skipped += 1;
      continue;
    }
    eligible.push({ contactId, assignments });
  }

  const { groups, remaining } = capReminderGroups(eligible);
  return { groups, skipped, remaining };
}
