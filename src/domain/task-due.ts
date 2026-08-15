// DEC-801: a task cannot be late before it was assigned. A task's own
// dueDate can predate the moment a given assignment was created (e.g. a
// task assigned to a speaker who accepted after the task's original due
// window) — judging lateness against the raw task.dueDate in that case
// would mark the assignment overdue on arrival. This is the ONE function
// every surface that judges lateness (grid cell/badge, onboarding counts,
// reminder emails) must call, so they cannot disagree (see grid.ts,
// app/src/pages/speakers/overdue.ts, reminders.ts).
//
// DEC-801 (wave 58 amendment, J6): task.dueDate is a DAY LABEL (UTC-midnight
// stand-in for a calendar date), not an instant. Comparing it directly to
// `now` flags a task overdue as soon as UTC midnight passes, which for an
// America/Los_Angeles event is ~16 hours before the due day even begins
// locally. isAssignmentOverdue/overdueDayCutoff expand the day label into
// the event's own timezone via dayLabelEndInstant/dayLabelOfInstant (see
// ../lib/timezone.ts) before comparing. Pure-core: only imports from
// ../lib/timezone (also pure-core, no node:/cf).

import { dayLabelEndInstant, dayLabelOfInstant } from "../lib/timezone";

export const ASSIGNED_LATE_GRACE_DAYS = 7;

const GRACE_MS = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;

/** Returns the due date an assignment is actually held to: null stays
 * null (no due date == never overdue); a task due date at or after the
 * assignment's creation is returned unchanged; otherwise the assignment
 * is given a grace window from the moment it was actually created. */
export function effectiveAssignmentDueDate(taskDueDate: number | null, assignmentCreatedAt: number): number | null {
  if (taskDueDate === null) return null;
  if (taskDueDate >= assignmentCreatedAt) return taskDueDate;
  return assignmentCreatedAt + GRACE_MS;
}

/** DEC-801 (wave 58 amendment): the ONE predicate every surface that judges
 * lateness must call. A null task due date is never overdue. When the task's
 * own due date holds (>= the assignment's creation), lateness is judged
 * against the END of that day-label's calendar date in the event's own
 * timezone (dayLabelEndInstant) — not the UTC-midnight instant the day label
 * literally stores. Otherwise (the grace-window branch) the due date is
 * already a real instant (assignmentCreatedAt + GRACE_MS), so it is compared
 * directly. */
export function isAssignmentOverdue(
  taskDueDate: number | null,
  assignmentCreatedAt: number,
  now: number,
  timeZone: string,
): boolean {
  if (taskDueDate === null) return false;
  if (taskDueDate >= assignmentCreatedAt) {
    return now > dayLabelEndInstant(taskDueDate, timeZone);
  }
  return now > assignmentCreatedAt + GRACE_MS;
}

/** DEC-801 (wave 58 amendment): the SQL-friendly form of the day-label-end
 * comparison used by isAssignmentOverdue's first branch — the day label
 * (UTC-midnight stand-in) of `now`'s calendar date in `timeZone`. A task's
 * due-date day label is "still due" (not yet overdue) while it is >= this
 * cutoff; it becomes overdue once the task's due-date day label falls
 * strictly before it. Named overdueDayCutoff (not dayLabelOfInstant) so SQL
 * call sites read as what they mean, not just what they compute. */
export function overdueDayCutoff(now: number, timeZone: string): number {
  return dayLabelOfInstant(now, timeZone);
}
