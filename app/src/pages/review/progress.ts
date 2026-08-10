import type { ProgressRow } from './types';

/** Reviewers whose queue isn't fully rated yet -- the "laggards" a Remind click targets. */
export function reviewersWithIncompleteQueues(rows: ProgressRow[]): ProgressRow[] {
  return rows.filter((r) => r.completed < r.assigned);
}

/** Overall completion fraction across all assigned reviewers (0 when nobody is assigned). */
export function overallCompletion(rows: ProgressRow[]): number {
  const assigned = rows.reduce((sum, r) => sum + r.assigned, 0);
  if (assigned === 0) return 0;
  const completed = rows.reduce((sum, r) => sum + r.completed, 0);
  return completed / assigned;
}
