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
