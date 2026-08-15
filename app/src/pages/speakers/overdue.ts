import { effectiveAssignmentDueDate, isAssignmentOverdue } from '../../../../src/domain/task-due';
import { daysAgo } from '../../lib/dates';
import type { OnboardingCell, OnboardingTask } from './types';

/**
 * A cell is overdue when its task has a due date in the past, the assignment
 * is not yet complete. Tasks without a due date are never overdue. DEC-801:
 * lateness is judged against the assignment's EFFECTIVE due date (never the
 * raw task.dueDate), so a task assigned after its own due date isn't
 * overdue on arrival. DEC-801 (wave 58 amendment): task.dueDate is a DAY
 * LABEL, not an instant -- delegates to isAssignmentOverdue (the ONE
 * predicate) so this grid agrees with the portal worklist and reminders.
 */
export function isCellOverdue(
  cell: OnboardingCell,
  task: OnboardingTask | undefined,
  now: number,
  timezone: string,
): boolean {
  if (!task) return false;
  if (cell.status === 'complete') return false;
  return isAssignmentOverdue(task.dueDate, cell.assignedAt, now, timezone);
}

/**
 * Whole days between a past due date and now, floored at 1 -- feeds the
 * .chq-flag "N DAYS LATE" micro-label. Callers must only invoke this when
 * isCellOverdue is already true (dueDate non-null and in the past).
 */
export function daysLate(dueDate: number, now: number): number {
  return Math.max(1, daysAgo(dueDate, now));
}
