import { isCellOverdue } from './overdue';
import type { GridFilterState, OnboardingGridResponse, OnboardingRow } from './types';

/**
 * A row survives the filter if it has at least one cell that matches every
 * active filter simultaneously (task, status, overdue-only). With no
 * filters active every row with cells passes through unchanged.
 */
export function filterOnboardingRows(grid: OnboardingGridResponse, filters: GridFilterState, now: number): OnboardingRow[] {
  const taskById = new Map(grid.tasks.map((task) => [task.id, task]));

  return grid.rows.filter((row) =>
    row.cells.some((cell) => {
      if (filters.taskId && cell.taskId !== filters.taskId) return false;
      if (filters.status && cell.status !== filters.status) return false;
      if (filters.overdueOnly && !isCellOverdue(cell, taskById.get(cell.taskId), now)) return false;
      return true;
    }),
  );
}
