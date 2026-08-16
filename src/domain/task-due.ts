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

/** DEC-801 (wave 38 amendment): the ONE reader-facing conversion — every
 * surface that displays or emails an assignment's due date must call this. A
 * null task due date stays null. When the task's own due date holds
 * (>= the assignment's creation) it is already a day label and is
 * returned byte-identical — no re-zoning. Otherwise the grace-window
 * instant (assignmentCreatedAt + GRACE_MS) is collapsed into the
 * event-local calendar day via dayLabelOfInstant, so a reader never sees
 * a raw instant masquerading as a day label. */
export function effectiveAssignmentDueDayLabel(
  taskDueDate: number | null,
  assignmentCreatedAt: number,
  timeZone: string,
): number | null {
  if (taskDueDate === null) return null;
  if (taskDueDate >= assignmentCreatedAt) return taskDueDate;
  return dayLabelOfInstant(assignmentCreatedAt + GRACE_MS, timeZone);
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** DEC-801 (wave 63 amendment): the days-late COUNT that agrees with
 * isAssignmentOverdue's own predicate — the w63-b fix for the pair of
 * hand-rolled, UTC-only "daysLate" copies (server aggregate.ts's
 * `Math.floor((now - dueDate) / DAY_MS)` and the SPA's
 * `Math.max(1, daysAgo(dueDate, now))`) that could both disagree with the
 * timezone-aware predicate that selected the row as overdue in the first
 * place (see src/lib/event-time.ts's daysUntilCalendarDay for the same
 * calendar-day-vs-instant discipline). Returns 0 when taskDueDate is null
 * or the assignment is not overdue by isAssignmentOverdue's own rule (so a
 * caller can call this unconditionally without re-deriving the predicate).
 * Otherwise counts WHOLE EVENT-LOCAL CALENDAR DAYS between the deadline's
 * calendar day and now's calendar day, mirroring isAssignmentOverdue's own
 * two branches so the two functions can never disagree about WHICH rows are
 * overdue while giving a different answer for HOW overdue:
 *   - day-label branch (taskDueDate >= assignmentCreatedAt): the raw
 *     taskDueDate is already a day-label instant, so it is diffed directly
 *     against dayLabelOfInstant(now, timeZone) in day-label space.
 *   - grace branch: both sides are collapsed to day labels via
 *     dayLabelOfInstant before diffing, since assignmentCreatedAt + GRACE_MS
 *     is a real instant, not a day label.
 * Never below 1 once isAssignmentOverdue is true — the row is by definition
 * at least one calendar day past its deadline. */
export function assignmentDaysLate(
  taskDueDate: number | null,
  assignmentCreatedAt: number,
  now: number,
  timeZone: string,
): number {
  if (!isAssignmentOverdue(taskDueDate, assignmentCreatedAt, now, timeZone)) return 0;
  const nowDayLabel = dayLabelOfInstant(now, timeZone);
  if (taskDueDate! >= assignmentCreatedAt) {
    return Math.max(1, Math.round((nowDayLabel - taskDueDate!) / DAY_MS));
  }
  const graceDayLabel = dayLabelOfInstant(assignmentCreatedAt + GRACE_MS, timeZone);
  return Math.max(1, Math.round((nowDayLabel - graceDayLabel) / DAY_MS));
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
