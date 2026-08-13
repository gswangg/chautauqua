// DEC-801: a task cannot be late before it was assigned. A task's own
// dueDate can predate the moment a given assignment was created (e.g. a
// task assigned to a speaker who accepted after the task's original due
// window) — judging lateness against the raw task.dueDate in that case
// would mark the assignment overdue on arrival. This is the ONE function
// every surface that judges lateness (grid cell/badge, onboarding counts,
// reminder emails) must call, so they cannot disagree (see grid.ts,
// app/src/pages/speakers/overdue.ts, reminders.ts).
//
// Pure-core: no imports (node:/cf forbidden here per the pure-core rule).

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
