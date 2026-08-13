// J6 reminder planner (DEC-023): pure, schedule-driven selection of
// task_assignment rows due for a reminder email. NEVER decision-driven
// (DEC-009 invariant #1 companion rule) — this module reacts only to
// dueDate/now/lastRemindedAt, never to a status transition event.

import { formatCalendarDate } from "../lib/event-time";

const DUE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

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
 * (never reminded OR last reminded more than 24h ago) — DEC-023. */
export function isReminderDue(a: ReminderAssignment, now: number): boolean {
  if (a.status === "complete") return false;
  if (a.dueDate === null) return false;

  const isOverdueOrSoon = a.dueDate <= now + DUE_WINDOW_MS;
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
    if (!isReminderDue(a, input.now)) continue;
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
export function planManualReminders(input: PlanRemindersInput): {
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
