import { effectiveAssignmentDueDate } from '../../../../src/domain/task-due';
import { daysAgo } from '../../lib/dates';
import type { OnboardingCell, OnboardingTask } from './types';

/**
 * A cell is overdue when its task has a due date in the past, the assignment
 * is not yet complete. Tasks without a due date are never overdue. DEC-801:
 * lateness is judged against the assignment's EFFECTIVE due date (never the
 * raw task.dueDate), so a task assigned after its own due date isn't
 * overdue on arrival.
 */
export function isCellOverdue(cell: OnboardingCell, task: OnboardingTask | undefined, now: number): boolean {
  if (!task) return false;
  const effectiveDueDate = effectiveAssignmentDueDate(task.dueDate, cell.assignedAt);
  if (effectiveDueDate === null) return false;
  if (cell.status === 'complete') return false;
  return effectiveDueDate < now;
}

/**
 * Whole days between a past due date and now, floored at 1 -- feeds the
 * .chq-flag "N DAYS LATE" micro-label. Callers must only invoke this when
 * isCellOverdue is already true (dueDate non-null and in the past).
 */
export function daysLate(dueDate: number, now: number): number {
  return Math.max(1, daysAgo(dueDate, now));
}
