import type { OnboardingCell, OnboardingTask } from './types';

/**
 * A cell is overdue when its task has a due date in the past, the assignment
 * is not yet complete. Tasks without a due date are never overdue.
 */
export function isCellOverdue(cell: OnboardingCell, task: OnboardingTask | undefined, now: number): boolean {
  if (!task || task.dueDate === null) return false;
  if (cell.status === 'complete') return false;
  return task.dueDate < now;
}

/**
 * Whole days between a past due date and now, floored at 1 -- feeds the
 * .chq-flag "N DAYS LATE" micro-label. Callers must only invoke this when
 * isCellOverdue is already true (dueDate non-null and in the past).
 */
export function daysLate(dueDate: number, now: number): number {
  return Math.max(1, Math.floor((now - dueDate) / (24 * 60 * 60 * 1000)));
}
