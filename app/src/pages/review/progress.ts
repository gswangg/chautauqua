// DEC-707: reviewerProgressState/selectRemindTargets are the domain's
// SINGLE predicate for who a reminder send targets -- imported here (never
// re-derived) so the SPA's counted label and POST /plans/:id/remind agree.
import { selectRemindTargets } from '../../../../src/domain/evaluation';
import type { ProgressRow } from './types';

/** Reviewers whose queue isn't fully rated yet -- the "laggards" a Remind click targets. */
export function reviewersWithIncompleteQueues(rows: ProgressRow[]): ProgressRow[] {
  return selectRemindTargets(rows, 'incomplete');
}

/** DEC-707: reviewers who have not started their queue at all -- the
 * landing page's "Remind the N not started" tertiary link count. */
export function reviewersNotStarted(rows: ProgressRow[]): ProgressRow[] {
  return selectRemindTargets(rows, 'not_started');
}

/** DEC-708: the label a reviewer row renders -- the resolved contact name
 * when present, else the bare email (never a fabricated name). */
export function reviewerDisplayLabel(row: { name: string | null; email: string }): string {
  return row.name ?? row.email;
}

/** Overall completion fraction across all assigned reviewers (0 when nobody is assigned). */
export function overallCompletion(rows: ProgressRow[]): number {
  const assigned = rows.reduce((sum, r) => sum + r.assigned, 0);
  if (assigned === 0) return 0;
  const completed = rows.reduce((sum, r) => sum + r.completed, 0);
  return completed / assigned;
}

/** DEC-587: the raw evaluations-in / evaluations-expected counts behind
 * overallCompletion's fraction -- PlanList's inline progress reads these
 * (never a second definition of the ratio, and never divided by a plan
 * count) from the SAME /plans/:id/progress aggregate ProgressPanel uses. */
export function progressTotals(rows: ProgressRow[]): { completed: number; assigned: number } {
  return {
    completed: rows.reduce((sum, r) => sum + r.completed, 0),
    assigned: rows.reduce((sum, r) => sum + r.assigned, 0),
  };
}
