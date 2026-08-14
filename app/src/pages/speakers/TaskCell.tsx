// DEC-933/DEC-934 (task-w24-c): the ONE onboarding-grid cell renderer,
// extracted out of OnboardingGrid.tsx's two near-identical blocks (the
// pinned <table> half and the phone-width <div> "card" half) -- the
// duplication was how the two drifted (DEC-920's file-link fix landed in
// only one of the two copies before it was caught). Both callers now share
// this single component; wrapping markup (a bare <td> vs. a labelled
// .chq-speakers-card-task) stays with the caller, since it differs by
// breakpoint.
import { effectiveAssignmentDueDate } from '../../../../src/domain/task-due';
import { countOf } from '../../lib/plural';
import { daysLate, isCellOverdue } from './overdue';
import type { AssignmentStatus, InviteStatus, OnboardingCell, OnboardingTask } from './types';

// DEC-829 amendment (wave 59): the ONE place this predicate is written -- a
// roster row is "not chased" (the reminder set will never include it, per
// DEC-829's ruling that the chase set is exactly the task-expansion set)
// when EVERY participation the contact carries has declined. Unlike
// DEC-934's invited/declined strip (which fires on ANY non-active mix and
// hides cells wholesale because no assignments exist yet for an
// invited-only row), a declined row can carry REAL assignment history --
// tasks assigned while the participant was still active -- so this
// predicate feeds a muted-cell treatment, not a strip, keeping that history
// visible (OnboardingGrid composes it for both the row marker/remind gate
// and this component's per-cell muting).
export function isRowNotChased(contact: { participations: readonly { inviteStatus: InviteStatus }[] }): boolean {
  return contact.participations.length > 0 && contact.participations.every((p) => p.inviteStatus === 'declined');
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Shared day/month(/year) formatter for a due date -- both the column
 * header caption (OnboardingGrid's taskDueLabel) and a cell's title/
 * aria-label read it, so the two can never disagree. Appends the 4-digit
 * UTC year only when the due date's UTC year differs from `now`'s, so a
 * far-dated column can't be mistaken for "this year" (DEC-852). Reads UTC
 * calendar parts directly (never toISOString/local) per DEC-146/153. */
export function formatDueDate(dueDate: number, now: number): string {
  const date = new Date(dueDate);
  const yearSuffix = date.getUTCFullYear() !== new Date(now).getUTCFullYear() ? ` ${date.getUTCFullYear()}` : '';
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}${yearSuffix}`;
}

/** v4 design copy for a pending, overdue cell — never colour alone, never
 * red (DEC-367). Complete is a filled pill, pending is an outline pill,
 * overdue is the same control family (box metrics, hover ring,
 * cursor:pointer) with an ink-outlined bold-caps "OVERDUE" mark (DEC-730,
 * DEC-789 — replaces the old "N DAYS LATE" copy). The day count isn't
 * dropped: it moves into the button's accessible name/title via
 * overdueTitle below, so no information is lost, just not shown inline. */
const OVERDUE_LABEL = 'OVERDUE';

function overdueTitle(dueDate: number, now: number): string {
  // DEC-925: the count phrase goes through the ONE plural helper, never a
  // hand-copied singular/plural ternary.
  return `${countOf(daysLate(dueDate, now), 'day')} late`;
}

/** The cell button's title/accessible-name suffix (DEC-852): an overdue
 * cell keeps today's "N days late" text verbatim; any other non-complete
 * cell with a known effective due date names that date instead, so a
 * grace-shifted deadline is visible before it bites, not only after. */
function cellDueTitle(
  status: AssignmentStatus,
  overdueTitleText: string | null,
  effectiveDueDate: number | null,
  now: number,
): string | null {
  if (overdueTitleText) return overdueTitleText;
  if (status === 'complete' || effectiveDueDate === null) return null;
  return `due ${formatDueDate(effectiveDueDate, now)}`;
}

/** One control family for all three cell states (DEC-730): complete/pending/
 * overdue share box metrics, a hover ring and cursor:pointer -- only the
 * fill/outline/ink-outline modifier differs. */
function statusCellClass(status: AssignmentStatus, overdue: boolean): string {
  const modifier = status === 'complete' ? 'complete' : overdue ? 'overdue' : 'pending';
  return `chq-speakers-status chq-speakers-status-${modifier}`;
}

interface TaskCellProps {
  task: OnboardingTask;
  cell: OnboardingCell | undefined;
  contactName: string;
  now: number;
  onToggle: (assignmentId: string, status: AssignmentStatus) => void;
  onOpenResponse: (assignmentId: string, contactName: string) => void;
  // DEC-829 amendment: true for a row whose every participation has
  // declined (isRowNotChased above) -- an incomplete cell renders muted;
  // a complete cell is unaffected, because the completion history is real
  // regardless of whether the product will chase this row further.
  notChased?: boolean;
}

/** Renders exactly one grid cell's contents -- the em-dash "no assignment"
 * state, or the status toggle + optional file link + optional Response
 * link. Callers supply their own wrapper (<td> for the pinned table, a
 * labelled <div> for the phone card list). */
export function TaskCell({ task, cell, contactName, now, onToggle, onOpenResponse, notChased = false }: TaskCellProps) {
  if (!cell) {
    return <span className="chq-speakers-cell-none">&mdash;</span>;
  }

  const overdue = isCellOverdue(cell, task, now);
  const cellClass = statusCellClass(cell.status, overdue);
  const effectiveDueDate = effectiveAssignmentDueDate(task.dueDate, cell.assignedAt);
  const overdueTitleText = overdue && effectiveDueDate !== null ? overdueTitle(effectiveDueDate, now) : null;
  const cellTitleText = cellDueTitle(cell.status, overdueTitleText, effectiveDueDate, now);
  const muted = notChased && cell.status !== 'complete';

  return (
    <div className={muted ? 'chq-speakers-cell chq-speakers-cell-muted' : 'chq-speakers-cell'}>
      <button
        type="button"
        className={cellClass}
        onClick={() => onToggle(cell.assignmentId, cell.status)}
        aria-label={
          cellTitleText
            ? `Toggle ${task.title} for ${contactName}, ${cellTitleText}`
            : `Toggle ${task.title} for ${contactName}`
        }
        title={cellTitleText ?? undefined}
      >
        {cell.status === 'complete' ? 'Complete' : overdueTitleText ? OVERDUE_LABEL : 'Pending'}
      </button>
      {cell.fileId && cell.fileName && (
        <a
          href={`/files/${cell.fileId}`}
          target="_blank"
          rel="noreferrer"
          className="chq-speakers-file-link"
          aria-label={`Download ${cell.fileName}`}
          title={cell.fileName}
        >
          {cell.fileName}
        </a>
      )}
      {task.kind === 'form' && cell.status === 'complete' && (
        <button
          type="button"
          className="chq-link-button chq-speakers-response-link"
          onClick={() => onOpenResponse(cell.assignmentId, contactName)}
        >
          Response
        </button>
      )}
    </div>
  );
}
