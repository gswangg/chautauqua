// DEC-933/DEC-934 (task-w24-c): the ONE onboarding-grid cell renderer,
// extracted out of OnboardingGrid.tsx's two near-identical blocks (the
// pinned <table> half and the phone-width <div> "card" half) -- the
// duplication was how the two drifted (DEC-920's file-link fix landed in
// only one of the two copies before it was caught). Both callers now share
// this single component; wrapping markup (a bare <td> vs. a labelled
// .chq-speakers-card-task) stays with the caller, since it differs by
// breakpoint.
import { assignmentDaysLate, effectiveAssignmentDueDayLabel } from '../../../../src/domain/task-due';
import { countOf } from '../../lib/plural';
import { isCellOverdue } from './overdue';
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
export const OVERDUE_LABEL = 'OVERDUE';

function overdueTitle(task: OnboardingTask, cell: OnboardingCell, now: number, timezone: string): string {
  // DEC-925: the count phrase goes through the ONE plural helper, never a
  // hand-copied singular/plural ternary. DEC-801 (wave 63 amendment): the
  // count comes from assignmentDaysLate, the ONE days-late reader that
  // agrees with isCellOverdue's own timezone-aware predicate.
  return `${countOf(assignmentDaysLate(task.dueDate, cell.assignedAt, now, timezone), 'day')} late`;
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

/** The DENSITY half of the v12 status token pair (design pack v12,
 * DESIGN-RULINGS "Status tokens pair by density, not by device").
 *
 *   'dense' -- a matrix cell that must fit a 178px column twelve times
 *              over: ~20px tall, no horizontal padding.
 *   'roomy' -- anywhere a row is a REAL TARGET: the phone cards, the
 *              speaker detail's task rows, the task views. min-height 44px
 *              plus horizontal padding, which is what actually reaches the
 *              tap floor (padding alone does not; without padding the hit
 *              box is only as wide as the text).
 *
 * Colour and weight are identical in both -- ONLY geometry differs -- so
 * the same field never changes vocabulary between screens. The parameter is
 * required rather than defaulted: a default is how the pair drifts, and the
 * ruling names the exact regression (a bordered Pending box back on three
 * phone frames after the desktop one had gone bare). */
export type StatusDensity = 'dense' | 'roomy';

/** One control family for all three cell states (DEC-730): complete/pending/
 * overdue share a hover ring and cursor:pointer -- only the weight/fill
 * modifier differs. Exported because the speaker DETAIL page's task rows and
 * the task view's rows are the same status control over the same
 * pending|complete domain: a second hand-rolled mapping is exactly how the
 * detail page ended up showing no overdue mark at all (user-filed, Elliot
 * Ekström) while its header counted one.
 *
 * Design pack v12 INVERTS what the three modifiers look like -- overdue
 * fills, pending is bold ink, complete recedes to muted 600 -- but not
 * which one a given (status, overdue) pair selects, so every call site is
 * unchanged apart from naming its density. */
export function statusCellClass(status: AssignmentStatus, overdue: boolean, density: StatusDensity): string {
  const modifier = status === 'complete' ? 'complete' : overdue ? 'overdue' : 'pending';
  return `chq-speakers-status chq-speakers-status-${modifier} chq-speakers-status-${density}`;
}

interface TaskCellProps {
  task: OnboardingTask;
  cell: OnboardingCell | undefined;
  contactName: string;
  now: number;
  timezone: string;
  onToggle: (assignmentId: string, status: AssignmentStatus) => void;
  // DEC-829 amendment: true for a row whose every participation has
  // declined (isRowNotChased above) -- an incomplete cell renders muted;
  // a complete cell is unaffected, because the completion history is real
  // regardless of whether the product will chase this row further.
  notChased?: boolean;
  // DEC-934 amendment (wave 4): false for a row whose participation is
  // invited/mixed-invited (OnboardingGrid's notChasingStatus) -- the cell
  // still RENDERS (a stray assignment can exist even though the product
  // will never chase it further) but carries no assign/complete/toggle
  // affordance: a plain <span>, never a <button>. Defaults true (every
  // other caller keeps the live control).
  interactive?: boolean;
  // DEC-265 amendment (error-states rule 8): true while this cell's last
  // write is the one a rollback banner names -- the optimistic flip was
  // reverted but the cell must keep announcing that until the banner is
  // dismissed (Try again / Reload the grid), never quietly settle back to
  // its pre-click look (that reads as the click never registering). Reuses
  // the overdue vocabulary -- weight and fill, never a new colour (DEC-367:
  // there is no red in this system).
  notSaved?: boolean;
  // v12: which half of the status token pair this caller wants. The pinned
  // matrix is 'dense' (a 178px column, twelve times over); the phone card
  // list is 'roomy' (a card row is a real target). Required, never
  // defaulted -- a default is how the pair drifts (see statusCellClass).
  density: StatusDensity;
}

/** Renders exactly one grid cell's contents -- the em-dash "no assignment"
 * state, or the status control, and NOTHING ELSE.
 *
 * Design pack v12 removed the per-cell File and Response links: they were a
 * third path to two things already routed -- one speaker (row -> detail) and
 * one task across everyone (column head -> task view). An interim design
 * replaced them with a muted attachment glyph, which the pack rejected for a
 * sharper reason: "is something attached?" is not a question anyone asks
 * while scanning, because it is not actionable -- the task is done either
 * way. What IS actionable at a glance is per-column progress, which now
 * lives in the column head (OnboardingGrid.tsx).
 *
 * This OVERRIDES DEC-920 (which made the cell's file link NAME its file
 * rather than say "File") and the per-cell arm of DEC-291 (the Response
 * link): the v12 pack supersedes both rather than fixing them. Neither
 * artifact became unreachable -- the speaker detail lists deliverables and
 * the task view reads answers -- only un-duplicated.
 *
 * Callers supply their own wrapper (<td> for the pinned table, a labelled
 * <div> for the phone card list). */
export function TaskCell({
  task,
  cell,
  contactName,
  now,
  timezone,
  onToggle,
  notChased = false,
  interactive = true,
  notSaved = false,
  density,
}: TaskCellProps) {
  if (!cell) {
    return <span className="chq-speakers-cell-none">&mdash;</span>;
  }

  const overdue = isCellOverdue(cell, task, now, timezone);
  // DEC-265 amendment: a rolled-back write borrows the overdue class family
  // too -- weight/rule, never a new colour -- so the reverted cell keeps
  // announcing itself until the banner is dismissed.
  const cellClass = statusCellClass(cell.status, overdue || notSaved, density);
  const effectiveDueDate = effectiveAssignmentDueDayLabel(task.dueDate, cell.assignedAt, timezone);
  const overdueTitleText = overdue && effectiveDueDate !== null ? overdueTitle(task, cell, now, timezone) : null;
  const cellTitleText = cellDueTitle(cell.status, overdueTitleText, effectiveDueDate, now);
  const muted = (notChased && cell.status !== 'complete') || !interactive;
  const baseLabel = cell.status === 'complete' ? 'Complete' : overdueTitleText ? OVERDUE_LABEL : 'Pending';
  const label = notSaved ? `${baseLabel} · not saved` : baseLabel;

  return (
    <div className={muted ? 'chq-speakers-cell chq-speakers-cell-muted' : 'chq-speakers-cell'}>
      {interactive ? (
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
          {label}
        </button>
      ) : (
        <span className={cellClass} title={cellTitleText ?? undefined}>
          {label}
        </span>
      )}
    </div>
  );
}
