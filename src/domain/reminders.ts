// J6 reminder planner (DEC-023): pure, schedule-driven selection of
// task_assignment rows due for a reminder email. NEVER decision-driven
// (DEC-009 invariant #1 companion rule) — this module reacts only to
// dueDate/now/lastRemindedAt, never to a status transition event.

const DUE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

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
