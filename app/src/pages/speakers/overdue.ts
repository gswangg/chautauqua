import type { OnboardingCell, OnboardingGridResponse, OnboardingTask } from './types';

/**
 * A cell is overdue when its task has a due date in the past, the assignment
 * is not yet complete. Tasks without a due date are never overdue.
 */
export function isCellOverdue(cell: OnboardingCell, task: OnboardingTask | undefined, now: number): boolean {
  if (!task || task.dueDate === null) return false;
  if (cell.status === 'complete') return false;
  return task.dueDate < now;
}

export interface OnboardingCounts {
  speakers: number;
  outstandingRequired: number;
  overdue: number;
}

/**
 * Header counts answering "what needs my attention": total accepted
 * speakers in the grid, how many required-task assignments are still
 * outstanding, and how many assignments (any task) are overdue.
 */
export function computeOnboardingCounts(grid: OnboardingGridResponse, now: number): OnboardingCounts {
  const taskById = new Map(grid.tasks.map((task) => [task.id, task]));
  let outstandingRequired = 0;
  let overdue = 0;

  for (const row of grid.rows) {
    for (const cell of row.cells) {
      const task = taskById.get(cell.taskId);
      if (!task) continue;
      if (cell.status !== 'complete' && task.required) outstandingRequired += 1;
      if (isCellOverdue(cell, task, now)) overdue += 1;
    }
  }

  return { speakers: grid.rows.length, outstandingRequired, overdue };
}

/** Distinct contacts with at least one incomplete assignment — the audience for "remind everyone". */
export function outstandingContactCount(grid: OnboardingGridResponse, taskIds?: string[]): number {
  const scope = taskIds && taskIds.length > 0 ? new Set(taskIds) : null;
  let count = 0;
  for (const row of grid.rows) {
    const hasOutstanding = row.cells.some((cell) => {
      if (scope && !scope.has(cell.taskId)) return false;
      return cell.status !== 'complete';
    });
    if (hasOutstanding) count += 1;
  }
  return count;
}
