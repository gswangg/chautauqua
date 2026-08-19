import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { DEC_827 } from '../../../../src/decisions';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { useMenu } from '../../lib/useMenu';
import { PageSkeleton } from '../../components/PageSkeleton';
import { GridFilters } from './GridFilters';
import { TaskCell, formatDueDate, isRowNotChased } from './TaskCell';
import { TaskModal } from './TaskModal';
import { RemindPreviewModal } from './RemindPreviewModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { describeSendResult, failureLines, type SendResult } from '../../lib/sendResult';
import { ParticipationMenu } from './ParticipationMenu';
import { countOf } from '../../lib/plural';
import { paginationSummary } from '../../lib/pagination-summary';
import { firstNameOf } from '../../lib/identity';
import { MAX_TASK_ASSIGNEES } from '../../lib/batch-caps';
import {
  DEFAULT_GRID_FILTERS,
  INVITE_STATUS_LABELS,
  type AssignmentStatus,
  type EventForm,
  type GridFilterState,
  type InviteStatus,
  type NewTaskInput,
  type OnboardingGridResponse,
  type OnboardingTask,
  type ReminderDraft,
  type TaskDeleteImpact,
} from './types';

// Compile-checked dependency marker: DEC-827 (import lives in Contacts;
// Speakers links to it with the event already chosen).
void DEC_827;

function nextStatus(status: AssignmentStatus): AssignmentStatus {
  return status === 'complete' ? 'pending' : 'complete';
}

const PER_PAGE = 50;

/** Task column header caption, design v4's "Due 10 Apr · Required" shape
 * (rendered upper-case via .chq-speakers-task-due's text-transform) --
 * replaces the old title + bare '*' + plain date pattern. */
function taskDueLabel(task: { dueDate: number | null; required: boolean }, now: number): string {
  const suffix = task.required ? ' · Required' : '';
  if (task.dueDate === null) return `No due date${suffix}`;
  const base = `Due ${formatDueDate(task.dueDate, now)}`;
  return `${base}${suffix}`;
}

/** Design pack v12: the column head's third line -- the per-task aggregate.
 *
 * The pack arrived at this by rejecting two weaker marks in the cells
 * themselves: the per-cell File/Response links (a third route to two things
 * already routed) and then a muted attachment glyph ("is something
 * attached?" is not a question anyone asks while scanning, because it is not
 * actionable). What IS actionable at a glance is which task is lagging
 * across the roster, and the head is the one place that belongs.
 *
 * `settled` is the weight decision, not a second sentence: a finished column
 * recedes to muted 600 and an unfinished one reads in ink. Note that a
 * finished column is deliberately NOT rendered in --chq-disabled --
 * DESIGN-RULINGS names "a finished-column count" as one of the three places
 * that token escaped into a design as "the quiet version of something", and
 * it fails the contrast floor at 3.06:1. De-emphasis is weight, not
 * lightness. */
export function taskDoneLabel(task: OnboardingTask): { text: string; settled: boolean } | null {
  const { assigned, complete } = task;
  if (assigned === undefined || complete === undefined) return null;
  // Nobody carries this task, so there is no progress to state. Saying "all
  // 0 done" would read as finished; this says what is actually true.
  if (assigned === 0) return { text: 'Assigned to no one', settled: true };
  if (complete >= assigned) return { text: `All ${assigned} done`, settled: true };
  return { text: `${complete} of ${assigned} done`, settled: false };
}

/** Frame Chautauqua Speakers.dc.html:73, quoted verbatim. The frame's own
 * legend and the RULINGS prose disagree on the middle clause -- the prose
 * says "pending outlined", the frame says "pending is bold ink" and its PEND
 * constant carries no border at all. The frame is what the screens render,
 * so the frame wins, here and in speakers.css. */
export const GRID_STATUS_LEGEND =
  'Overdue is filled · pending is bold ink · complete recedes · a task name opens that task across every speaker';

/** The single "Edit tasks" control v12 puts beside the Speaker column head,
 * in place of the six per-column Edit links.
 *
 * The frame draws the control but not what it opens, so this reuses what
 * already exists rather than inventing a screen: a menu of the event's
 * tasks, each row opening THAT task's existing editor (TaskModal, which
 * still owns Remove per Ruling A12). Same useMenu primitive and the same
 * anchored-panel shape as ParticipationMenu -- DEC-969's one menu
 * behaviour, not a second dropdown idiom. */
function EditTasksMenu({
  tasks,
  now,
  onEdit,
}: {
  tasks: OnboardingTask[];
  now: number;
  onEdit: (task: OnboardingTask) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { containerRef, onPanelKeyDown } = useMenu(open, close);

  return (
    <span className="chq-speakers-task-edit-menu" ref={containerRef}>
      <button
        type="button"
        className="chq-link-button chq-speakers-task-edit"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Edit tasks
      </button>
      {open && (
        <div className="chq-speakers-task-edit-panel" role="menu" aria-label="Edit tasks" onKeyDown={onPanelKeyDown}>
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              role="menuitem"
              className="chq-speakers-task-edit-item"
              onClick={() => {
                onEdit(task);
                close();
              }}
            >
              <span>{task.title}</span>
              <span className="chq-speakers-task-edit-item-due">{taskDueLabel(task, now)}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Builds the DEC-340 query string from the current filters + page — every
 * active predicate is server-side, so the SPA never filters rows itself. */
function buildGridQuery(filters: GridFilterState, page: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', String(PER_PAGE));
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.taskId) params.set('taskId', filters.taskId);
  if (filters.status) params.set('status', filters.status);
  if (filters.overdueOnly) params.set('overdueOnly', '1');
  if (filters.inviteStatus) params.set('inviteStatus', filters.inviteStatus);
  return params.toString();
}

// DEC-265 amendment (error-states rule 8): a rolled-back optimistic write on
// this page (toggleCell, the response modal's reopen, or a participation
// change) must announce itself -- a silent-looking revert reads as the
// click never registering, so the organiser clicks again. The banner NAMES
// the row (speaker + task title for a cell write; speaker alone for a
// participation write), gives the likely cause in the server-fault
// register (never blaming the input), and offers Try again (re-issues
// exactly the write that failed) and Reload the grid. `assignmentId` is
// set only for a cell write -- that's what lets the reverted TaskCell keep
// its 'not saved' marker until the banner clears.
interface PendingWriteFailure {
  assignmentId: string | null;
  // Set only for a participation write -- lets a successful retry clear
  // exactly the failure it belongs to rather than an unrelated one still
  // showing assignmentId: null.
  participantId?: string | null;
  message: string;
  retry: () => void;
}

const WRITE_FAILURE_CAUSE = 'Someone else may have edited this speaker.';

// DEC-856 (wave-13 amendment): a bound ApiError carries the server's own
// wording (and, where the row has no separate field to show it, the first
// `fields` entry) inside the existing "speaker · task" naming frame --
// never collapsed to the generic WRITE_FAILURE_CAUSE sentence, matching
// Agenda.tsx:182 ("Placement failed: ${err.message}").
function serverRefusalDetail(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const fieldDetail = err.fields ? Object.values(err.fields)[0] : undefined;
  return fieldDetail && fieldDetail !== err.message ? `${err.message} (${fieldDetail})` : err.message;
}

function cellFailureMessage(speakerName: string, taskTitle: string, err: unknown): string {
  const detail = serverRefusalDetail(err);
  if (detail) return `${speakerName} · ${taskTitle}: ${detail}`;
  return `${speakerName} · ${taskTitle} didn't save. ${WRITE_FAILURE_CAUSE}`;
}

function participationFailureMessage(speakerName: string, err: unknown): string {
  const detail = serverRefusalDetail(err);
  if (detail) return `${speakerName}: ${detail}`;
  return `${speakerName} didn't save. ${WRITE_FAILURE_CAUSE}`;
}

// Looks up the row/task naming for a cell write from a known-good grid
// snapshot (the one taken just before the optimistic flip) -- the cell
// always exists there because it's the same grid that rendered the button
// the organiser just clicked. A miss is a bug, not a silent fallback.
function findCellNaming(
  source: OnboardingGridResponse,
  assignmentId: string,
): { speakerName: string; taskTitle: string } {
  for (const row of source.rows) {
    const cell = row.cells.find((c) => c.assignmentId === assignmentId);
    if (cell) {
      const task = source.tasks.find((t) => t.id === cell.taskId);
      if (!task) throw new Error(`findCellNaming: no task ${cell.taskId} for assignment ${assignmentId}`);
      return { speakerName: row.contact.name, taskTitle: task.title };
    }
  }
  throw new Error(`findCellNaming: no cell for assignment ${assignmentId}`);
}

function findContactName(source: OnboardingGridResponse, contactId: string): string {
  const row = source.rows.find((r) => r.contact.id === contactId);
  if (!row) throw new Error(`findContactName: no row for contact ${contactId}`);
  return row.contact.name;
}

/** True when any of the five narrowing predicates the server applies
 * (q/taskId/status/overdueOnly/inviteStatus) is set. `q` (free-text search)
 * IS a narrowing predicate -- buildGridQuery sends it to the server and it
 * can empty the roster on its own (DEC-678 amendment, w3-d), so a search
 * miss must render the FILTERED empty state, not the fresh one. */
function hasActiveNarrowing(filters: GridFilterState): boolean {
  return !!(
    filters.q.trim() ||
    filters.taskId ||
    filters.status ||
    filters.overdueOnly ||
    filters.inviteStatus
  );
}

/** Prose naming what's currently narrowing the roster -- read straight off
 * the same filter state buildGridQuery sends the server, so the caption can
 * never name a predicate the request didn't actually apply. */
function narrowingDescription(filters: GridFilterState, tasks: OnboardingTask[]): string {
  const parts: string[] = [];
  if (filters.q.trim()) parts.push(`matching "${filters.q.trim()}"`);
  if (filters.taskId) {
    const task = tasks.find((t) => t.id === filters.taskId);
    parts.push(task ? `task "${task.title}"` : 'a specific task');
  }
  if (filters.status) parts.push(`at least one ${filters.status} task`);
  if (filters.overdueOnly) parts.push('overdue');
  if (filters.inviteStatus) parts.push(`participation ${INVITE_STATUS_LABELS[filters.inviteStatus].toLowerCase()}`);
  return parts.join(' and ');
}

// DEC-934: a roster row whose participation is 'invited'/'declined' is one
// the product will never chase (task expansion only covers
// ACTIVE_INVITE_STATUSES) -- it now renders ITS ACTUAL task cells (quiet,
// non-actionable per TaskCell's `interactive` gate) plus ONE caption
// naming why, beneath the identity cell, rather than a strip that hid the
// cells entirely.
const NOT_CHASING_STATUSES: readonly InviteStatus[] = ['invited', 'declined'];

// DEC-934 amendment (wave 4): names the state in prose, one sentence per
// status -- the old "invite invited" echo is gone. NOT_CHASING_STATUSES is
// the only source of valid inputs (notChasingStatus below only ever returns
// a value drawn from that set), so an unmatched status is a bug, not a
// silent fallback.
function notChasingMessage(status: InviteStatus): string {
  if (status === 'invited') {
    return "Invited - not confirmed yet. Confirm participation to assign this event's tasks.";
  }
  if (status === 'declined') {
    return "Declined. Confirm participation to assign this event's tasks.";
  }
  throw new Error(`notChasingMessage: unexpected status ${status}`);
}

// DEC-934 under DEC-936: a row now carries EVERY participation the contact
// covers, so "will we chase this row?" is an EXISTS-any question, not a
// single scalar's. The row is chased when ANY participation is active
// ('none'/'accepted', ACTIVE_INVITE_STATUSES) -- exactly the predicate the
// server's outstanding/overdue aggregate composes
// (acceptedSpeakerExistsForContact), which is what keeps the printed summary
// and the rendered strip agreeing on the same set of rows as DEC-934
// requires. Returns the status to print when the row is NOT chased, else
// null.
function notChasingStatus(contact: { id: string; participations: readonly { inviteStatus: InviteStatus }[] }): InviteStatus | null {
  const first = contact.participations[0];
  // DEC-936: the array is never empty (rosterParticipantExistsForContact
  // guarantees at least one) -- a loud throw, never a silent blank row.
  if (!first) throw new Error(`roster row for contact ${contact.id} carries no participations`);
  // DEC-829 amendment: an all-declined row now composes isRowNotChased's
  // muted-cell treatment instead of this spanning strip, so real assignment
  // history (a completed cell) stays visible -- this predicate stays for
  // the remaining invited/mixed case, where no assignment ever existed.
  if (isRowNotChased(contact)) return null;
  if (!contact.participations.every((p) => NOT_CHASING_STATUSES.includes(p.inviteStatus))) return null;
  return first.inviteStatus;
}

// DEC-829 amendment (wave 59): the quiet row-level marker a declined-only
// row shows beside its participation control -- read alongside
// isRowNotChased's per-cell muting, never inlined twice.
const NOT_CHASED_MARKER = 'Not chased';

// DEC-829 amendment (w61-e): a second, independent reason the per-row
// Remind control goes quiet -- a fully-complete row (every assigned cell
// already 'complete') has nothing outstanding to chase, even when the
// participation is fully active. This does NOT replace declinedOnly above;
// the two conditions are checked separately and a row with no cell for a
// given task is never itself "outstanding" (only an existing 'pending'
// cell counts).
function hasOutstandingWork(row: { cells: readonly { status: AssignmentStatus }[] }): boolean {
  return row.cells.some((c) => c.status !== 'complete');
}

// DEC-934 amendment: the matrix answers ONE question -- who still needs
// inviting -- so the standalone "Send portal invite" control (below) must
// gate on not-yet-invited as well as no-account, reading the SAME
// participations[].inviteStatus the row model already carries (the
// participation menu's own footer already documents 'invited' as "records
// that the invite went out"). A row is already invited only once EVERY
// participation has moved past 'none' -- the same all-must-agree shape
// notChasingStatus above uses, so a row with a still-'none' session keeps
// offering the control rather than going quiet on a session nobody's
// invited yet.
function alreadyInvited(contact: { participations: readonly { inviteStatus: InviteStatus }[] }): boolean {
  return contact.participations.every((p) => p.inviteStatus !== 'none');
}

// DEC-662/DEC-746: the roster's Add-speaker trigger lives here now (see
// RosterPanel), beside New task/Remind all outstanding, so the page renders
// exactly one title action row -- Import CSV stays the Contacts page's job,
// this row never grows a second importer. DEC-662 amendment (wave 55): that
// left the roster with no way IN to the importer at all, so a single quiet
// link joins this same title-action row (no new band) and carries the
// current event id (/contacts?import=1&eventId=<id>) so the wizard lands
// with this event preselected instead of making the organizer re-pick it.
interface OnboardingGridProps {
  onAddSpeaker: () => void;
}

export function OnboardingGrid({ onAddSpeaker }: OnboardingGridProps) {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [grid, setGrid] = useState<OnboardingGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GridFilterState>(DEFAULT_GRID_FILTERS);
  const [page, setPage] = useState(1);
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskForms, setTaskForms] = useState<EventForm[]>([]);
  // DEC-746 (wave-59 amendment): the New task modal's subset picker
  // roster, fetched with the SAME effect shape as taskForms above -- only
  // while the modal is open, never on the grid's initial load.
  const [taskAssignees, setTaskAssignees] = useState<{ contactId: string; name: string }[]>([]);
  const [taskAssigneesTruncated, setTaskAssigneesTruncated] = useState(false);
  const [reviewingRemind, setReviewingRemind] = useState(false);
  const [remindPreviewLoading, setRemindPreviewLoading] = useState(false);
  const [remindPreviewError, setRemindPreviewError] = useState<string | null>(null);
  const [remindDrafts, setRemindDrafts] = useState<ReminderDraft[] | null>(null);
  // DEC-441 amendment (DEC-829): the server's own skipped figure, threaded
  // through verbatim rather than recomputed client-side, so the modal can
  // never claim a different number than the send performs.
  const [remindSkipped, setRemindSkipped] = useState(0);
  const [remindRemaining, setRemindRemaining] = useState(0);
  const [reminding, setReminding] = useState(false);
  // DEC-694: undefined => "Remind all outstanding" (today's behaviour);
  // a one-element array => the per-row "Remind ‹first name›" quiet control.
  // Both paths share the identical preview->confirm->send flow/dialog.
  const [remindContactIds, setRemindContactIds] = useState<string[] | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  // DEC-805: tracks in-flight per-row portal-invite sends so the quiet
  // control can't be double-clicked into two overlapping sends.
  const [invitingContactIds, setInvitingContactIds] = useState<Set<string>>(new Set());
  // Design pack v12: the response READER moved off this page entirely. The
  // per-cell "Response" link was its only entry point, and v12 deletes that
  // link (a grid cell carries status and nothing else) -- answers are read
  // on the task view, where one task's answers sit side by side and can
  // actually be compared. ResponseModal + its open/patch/rollback state
  // went with it rather than being left here unreachable.
  // DEC-933: the task column being edited (Edit control) / offered for
  // removal (Remove control) -- null when neither modal/dialog is open.
  const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);
  const [removingTask, setRemovingTask] = useState<OnboardingTask | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  // DEC-933 amendment (wave 63): fetched from the read-only, event-wide
  // delete-preview endpoint -- never derived from visibleRows, which is
  // only the current filtered/paginated grid page.
  const [removePreview, setRemovePreview] = useState<TaskDeleteImpact | null>(null);
  const [removePreviewLoading, setRemovePreviewLoading] = useState(false);
  const [removePreviewError, setRemovePreviewError] = useState<string | null>(null);
  // DEC-265 amendment: the one rolled-back write currently announcing
  // itself via the banner + (for a cell write) the reverted TaskCell's
  // 'not saved' marker. Null once the write succeeds (first try or Try
  // again) or the organiser reloads the grid.
  const [pendingFailure, setPendingFailure] = useState<PendingWriteFailure | null>(null);

  function loadGrid(id: string, currentFilters: GridFilterState, currentPage: number) {
    setLoading(true);
    setError(null);
    const qs = buildGridQuery(currentFilters, currentPage);
    return apiGet<OnboardingGridResponse>(`/events/${id}/onboarding?${qs}`)
      .then((res) => setGrid(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load onboarding grid'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!eventId) return;
    loadGrid(eventId, filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, filters, page]);

  // DEC-398: the form-task picker needs the event's forms {id, title,
  // isDefault} — fetched only when the New task modal opens (not on the
  // grid's initial load path, per SPEC 7's one-round-trip-per-view rule).
  // A failed fetch fails loudly IN the modal: taskForms stays empty, which
  // TaskModal renders as a disabled select plus an inline explanatory line
  // and a blocked submit, rather than silently posting no formId.
  useEffect(() => {
    if (!showNewTask || !eventId) return;
    let cancelled = false;
    apiGet<{ forms: EventForm[] }>(`/events/${eventId}/forms`)
      .then((res) => {
        if (!cancelled) setTaskForms(res.forms);
      })
      .catch(() => {
        if (!cancelled) setTaskForms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showNewTask, eventId]);

  // DEC-746 (wave-59 amendment): the subset picker's roster -- same DEC-398
  // effect shape as taskForms above (fetched only while the New task modal
  // is open). page=1&perPage=MAX_TASK_ASSIGNEES (DEC-422 wave-77 amendment,
  // src/domain/task-kinds.ts) -- the picker's fetch ceiling matches the
  // largest assignee set the assign/create doors will actually accept; a
  // roster past that ceiling states it and offers only "Everyone accepted"
  // (assigneesTruncated), never a truncated list presented as the whole
  // roster. A failed fetch fails loudly in the modal the same way
  // taskForms does: the picker stays offering only "Everyone accepted"
  // rather than silently rendering an empty checkbox list.
  useEffect(() => {
    if (!showNewTask || !eventId) return;
    let cancelled = false;
    apiGet<OnboardingGridResponse>(`/events/${eventId}/onboarding?page=1&perPage=${MAX_TASK_ASSIGNEES}`)
      .then((res) => {
        if (cancelled) return;
        setTaskAssignees(res.rows.map((r) => ({ contactId: r.contact.id, name: r.contact.name })));
        setTaskAssigneesTruncated(res.total > MAX_TASK_ASSIGNEES);
      })
      .catch(() => {
        if (!cancelled) {
          setTaskAssignees([]);
          setTaskAssigneesTruncated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showNewTask, eventId]);

  // DEC-933 amendment (wave 63): the remove-task confirm dialog opens
  // immediately (so Cancel is always instant) but its body never renders a
  // number that might be wrong -- it fetches the event-wide tally from the
  // server the moment removingTask is set, and shows a "counting" state
  // (confirm disabled) until that resolves.
  useEffect(() => {
    if (!removingTask) {
      setRemovePreview(null);
      setRemovePreviewError(null);
      setRemovePreviewLoading(false);
      return;
    }
    let cancelled = false;
    setRemovePreview(null);
    setRemovePreviewError(null);
    setRemovePreviewLoading(true);
    apiGet<{ taskId: string; title: string; counts: TaskDeleteImpact }>(`/tasks/${removingTask.id}/delete-preview`)
      .then((res) => {
        if (cancelled) return;
        setRemovePreview(res.counts);
      })
      .catch((err) => {
        if (cancelled) return;
        setRemovePreviewError(err instanceof ApiError ? err.message : 'Failed to load delete preview');
      })
      .finally(() => {
        if (!cancelled) setRemovePreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [removingTask]);

  function handleFiltersChange(next: GridFilterState) {
    setFilters(next);
    setPage(1);
  }

  // DEC-678 amendment (B7, wave 47; w3-d): the 'filtered' EmptyState's
  // escape -- resets every narrowing predicate hasActiveNarrowing reads
  // (q/taskId/status/overdueOnly/inviteStatus). `q` is included: it's a
  // narrowing predicate like the rest, and leaving it set left the escape
  // link unable to actually restore the full roster it claims to restore.
  // The search input is bound straight to filters.q (GridFilters), so
  // clearing it here clears the box too -- no separate DOM state to sync.
  function clearNarrowingFacets() {
    handleFiltersChange({ ...filters, q: '', taskId: null, status: null, overdueOnly: false, inviteStatus: null });
  }

  const now = Date.now();
  const counts = grid?.counts ?? null;
  const visibleRows = grid?.rows ?? [];
  const total = grid?.total ?? 0;
  // P3 #21 (DEC-678 amendment, wave 59): the taskId facet is a ROW predicate
  // server-side (grid.ts:220-224) -- every surviving row still carries a
  // cell for every task, so narrowing "shows nothing a reader can see"
  // unless the SPA itself collapses the rendered columns to match. Only the
  // COLUMNS collapse: grid.tasks stays untouched on the wire (the task
  // picker in GridFilters reads grid.tasks directly, so it keeps offering
  // every task while the filter is active), and clearing the facet
  // (clearNarrowingFacets) restores visibleTasks to the full list.
  const visibleTasks = filters.taskId ? grid?.tasks.filter((t) => t.id === filters.taskId) ?? [] : grid?.tasks ?? [];
  const rangeEnd = total === 0 ? 0 : Math.min(page * PER_PAGE, total);

  // DEC-265 amendment: the shared cell-status write both toggleCell (below)
  // and its Try again retry issue -- exactly the same PATCH, exactly the
  // same optimistic flip/rollback, so a retry can never drift from the
  // click that failed.
  async function applyCellStatus(assignmentId: string, desired: AssignmentStatus, speakerName: string, taskTitle: string) {
    if (!grid) return;
    const previous = grid;

    setGrid({
      ...grid,
      rows: grid.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) =>
          cell.assignmentId === assignmentId
            ? { ...cell, status: desired, completedAt: desired === 'complete' ? now : null }
            : cell,
        ),
      })),
    });
    setError(null);

    try {
      await apiPatch(`/task-assignments/${assignmentId}`, { status: desired });
      setPendingFailure((prev) => (prev && prev.assignmentId === assignmentId ? null : prev));
    } catch (err) {
      setGrid(previous);
      setPendingFailure({
        assignmentId,
        message: cellFailureMessage(speakerName, taskTitle, err),
        retry: () => {
          void applyCellStatus(assignmentId, desired, speakerName, taskTitle);
        },
      });
    }
  }

  async function toggleCell(assignmentId: string, currentStatus: AssignmentStatus) {
    if (!grid || !eventId) return;
    const desired = nextStatus(currentStatus);
    const { speakerName, taskTitle } = findCellNaming(grid, assignmentId);
    await applyCellStatus(assignmentId, desired, speakerName, taskTitle);
  }

  // DEC-265 amendment: reloading refetches the grid from the current
  // filters/page -- whatever the server now holds wins, and the banner +
  // any cell marker it was driving clear because pendingFailure resets.
  async function reloadGridAfterFailure() {
    if (!eventId) return;
    setPendingFailure(null);
    await loadGrid(eventId, filters, page);
  }

  // DEC-789/DEC-830: writes the roster row's invite status through
  // PATCH /submissions/:submissionId/participants/:participantId (task-w3-c,
  // mocked in tests -- this file never imports src/routes/api/submissions.ts).
  // Optimistic, with rollback on ApiError (matching toggleCell/
  // changeResponseStatus's established pattern on this page). Driven by an
  // explicit menu selection (ParticipationMenu) rather than a click-to-cycle
  // control -- the desired state is chosen, never advanced.
  async function applyInviteStatus(
    contactId: string,
    submissionId: string,
    participantId: string,
    desired: InviteStatus,
    speakerName: string,
  ) {
    if (!grid) return;
    const previous = grid;

    setGrid({
      ...grid,
      rows: grid.rows.map((row) =>
        row.contact.id === contactId
          ? {
              ...row,
              contact: {
                ...row.contact,
                participations: row.contact.participations.map((p) =>
                  p.participantId === participantId ? { ...p, inviteStatus: desired } : p,
                ),
              },
            }
          : row,
      ),
    });
    setError(null);

    try {
      await apiPatch(`/submissions/${submissionId}/participants/${participantId}`, { inviteStatus: desired });
      setPendingFailure((prev) => (prev && prev.participantId === participantId ? null : prev));
    } catch (err) {
      setGrid(previous);
      setPendingFailure({
        assignmentId: null,
        participantId,
        message: participationFailureMessage(speakerName, err),
        retry: () => {
          void applyInviteStatus(contactId, submissionId, participantId, desired, speakerName);
        },
      });
    }
  }

  async function setInviteStatus(contactId: string, submissionId: string, participantId: string, desired: InviteStatus) {
    if (!grid) return;
    const speakerName = findContactName(grid, contactId);
    await applyInviteStatus(contactId, submissionId, participantId, desired, speakerName);
  }

  // SPEC §10 #3 (DEC-441): "Remind all outstanding" no longer sends
  // directly — it opens a review dialog fed by the read-only preview
  // endpoint, rendered from the identical builder the real send uses.
  async function openRemindReview(contactIds?: string[]) {
    if (!eventId) return;
    setRemindContactIds(contactIds);
    setReviewingRemind(true);
    setRemindPreviewLoading(true);
    setRemindPreviewError(null);
    setRemindDrafts(null);
    setRemindSkipped(0);
    setRemindRemaining(0);
    try {
      const res = await apiPost<{ drafts: ReminderDraft[]; skipped: number; remaining: number }>(
        `/events/${eventId}/onboarding/remind/preview`,
        contactIds ? { contactIds } : {},
      );
      setRemindDrafts(res.drafts);
      setRemindSkipped(res.skipped);
      setRemindRemaining(res.remaining);
    } catch (err) {
      setRemindPreviewError(err instanceof ApiError ? err.message : 'Failed to load reminder preview');
    } finally {
      setRemindPreviewLoading(false);
    }
  }

  function closeRemindReview() {
    setReviewingRemind(false);
    setRemindPreviewError(null);
    setRemindDrafts(null);
    setRemindSkipped(0);
    setRemindRemaining(0);
    setRemindContactIds(undefined);
  }

  async function handleRemind() {
    if (!eventId) return;
    setReminding(true);
    setError(null);
    try {
      const res = await apiPost<SendResult>(
        `/events/${eventId}/onboarding/remind`,
        remindContactIds ? { contactIds: remindContactIds } : {},
      );
      setToast(describeSendResult(res, { one: 'contact', many: 'contacts' }));
      closeRemindReview();
      await loadGrid(eventId, filters, page);
    } catch (err) {
      // Not optimistic: a bulk send failure must surface loudly in the
      // review dialog rather than closing silently.
      setRemindPreviewError(err instanceof ApiError ? `Send failed: ${err.message}` : 'Send failed');
    } finally {
      setReminding(false);
    }
  }

  // DEC-805: "Inviting a speaker to the portal is a send, not a pill" — one
  // POST per click, reported through the same describeSendResult reporter
  // every other send uses, with any recipient lacking an address named in
  // the toast (never silently dropped) rather than restated as a bare count.
  async function sendPortalInvite(contactId: string) {
    if (!eventId) return;
    setInvitingContactIds((prev) => new Set(prev).add(contactId));
    setError(null);
    try {
      const res = await apiPost<SendResult>(`/events/${eventId}/portal-invites`, { contactIds: [contactId] });
      const lines = failureLines(res);
      const failedNames = lines ? ` ${lines}.` : '';
      setToast(`${describeSendResult(res, { one: 'portal invite', many: 'portal invites' })}${failedNames}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Portal invite failed: ${err.message}` : 'Portal invite failed');
    } finally {
      setInvitingContactIds((prev) => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  }

  async function handleCreateTask(input: NewTaskInput) {
    if (!eventId) return;
    await apiPost(`/events/${eventId}/tasks`, input);
    setShowNewTask(false);
    setToast('Task created.');
    await loadGrid(eventId, filters, page);
  }

  // DEC-933: PATCHes ONLY title/description/dueDate/required/deliverableKind
  // -- kind and formId never leave this handler, even though TaskModal's
  // onSubmit hands back a full NewTaskInput shape (formId/deliverableKind
  // are undefined in edit mode -- see TaskModal's isEdit gating -- so this
  // is a belt-and-braces filter, not the only guard). A task's kind is its
  // shape; changing it would orphan the responses already stored against it.
  async function handleEditTask(input: NewTaskInput) {
    if (!editingTask) return;
    await apiPatch(`/tasks/${editingTask.id}`, {
      title: input.title,
      dueDate: input.dueDate,
      required: input.required,
    });
    setEditingTask(null);
    setToast('Task updated.');
    if (eventId) await loadGrid(eventId, filters, page);
  }

  async function confirmRemoveTask() {
    if (!removingTask || !eventId) return;
    setRemovingBusy(true);
    setError(null);
    try {
      await apiDelete(`/tasks/${removingTask.id}`);
      setRemovingTask(null);
      setToast('Task removed.');
      // DEC-933: refetch rather than splice, so the column count and the
      // counts panel can't disagree.
      await loadGrid(eventId, filters, page);
    } catch (err) {
      setError(err instanceof ApiError ? `Remove failed: ${err.message}` : 'Remove failed');
    } finally {
      setRemovingBusy(false);
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page chq-speakers-page chq-measure-table">
        <h1 className="chq-page-title">Speakers</h1>
        <PageSkeleton variant="table" label="Loading event…" />
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-speakers-page chq-measure-table">
        <h1 className="chq-page-title">Speakers</h1>
        <div className="chq-error">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-speakers-page chq-measure-table">
      {error && <div className="chq-error">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="chq-speakers-head">
        <div className="chq-speakers-head-titles">
          <h1 className="chq-page-title">Speakers</h1>
          <span className="chq-summary">
            {/* v12 drops the middle "N tasks open" clause: the column
                heads now carry per-task progress, which is the same fact
                broken down usefully, and the page line is left with the
                two numbers that are actually a summary. */}
            <strong>{counts?.speakers ?? 0}</strong> accepted &middot; <strong>{counts?.overdue ?? 0}</strong> overdue
          </span>
        </div>
        <div className="chq-speakers-head-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onAddSpeaker}>
            Add speaker
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowNewTask(true)}>
            New task
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            onClick={() => openRemindReview()}
            disabled={!grid || grid.rows.length === 0}
          >
            Remind all outstanding
          </button>
          {/* G13 lane-D fix (04-speakers--00, ruling A13): the frame draws
              three controls here with the primary flush at the content
              edge, and A13 places the CSV-import link on the ROSTER, not
              the grid — the link now lives in RosterPanel's Add-speaker
              dialog. */}
        </div>
      </div>

      {/* DEC-265 amendment / G13 lane-D fix (04-speakers--09): the
          rolled-back-write banner sits BELOW the H1 and meta (the frame
          draws it under the title band, never above it), with a bold title
          line over the recovery actions — 'Reload the grid' secondary then
          'Try again' primary, right-flushed to the measure edge. */}
      {pendingFailure && (
        <div className="chq-error chq-speakers-write-failure" role="alert">
          <p className="chq-speakers-write-failure-title">{pendingFailure.message}</p>
          <div className="chq-speakers-write-failure-actions">
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void reloadGridAfterFailure()}>
              Reload the grid
            </button>
            <button type="button" className="chq-btn chq-btn-primary" onClick={() => pendingFailure.retry()}>
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="chq-speakers-toolbar">
        {grid && <GridFilters tasks={grid.tasks} filters={filters} onChange={handleFiltersChange} />}
        {/* w7-f: "Remind all outstanding" (this page's bulk send) runs
            planManualReminders, which drops any assignment whose
            lastRemindedAt falls within MANUAL_DEDUPE_WINDOW_MS of now --
            src/domain/reminders.ts:20,175. That is the same one-hour
            window Overview.tsx:276 names, so this caption uses its
            sentence verbatim (DEC-934: an honest caption beats a novel
            one, but a real match beats inventing a third phrasing). */}
        <span className="chq-speakers-toolbar-caption">Skips anyone reminded in the last hour</span>
      </div>

      {/* DEC-934 amendment (wave 4): ONE caption naming the active
          narrowing -- read straight off the payload's own total/counts
          (never a second query) so it can never disagree with the rows
          rendered below it. */}
      {grid && hasActiveNarrowing(filters) && (
        <div className="chq-speakers-narrowing-caption">
          Showing {grid.total} of {counts?.speakers ?? 0} speakers &middot; {narrowingDescription(filters, grid.tasks)}
        </div>
      )}

      {/* Post-eval polish: the skeleton's accessible label names its own
         noun, like every other list in the product -- the generic default
         told a screen-reader user nothing about which region was busy. */}
      {loading && <PageSkeleton variant="table" label="Loading speakers…" />}

      {/* DEC-678 amendment (B7, wave 47): a settled, zero-row grid never
          parks a full <thead> (or the phone card list) over one
          filtered-voice sentence -- 'filtered' iff hasActiveNarrowing is
          true, read off the SAME filters/narrowingDescription the caption
          above uses, so this message and that caption can never disagree.
          'fresh' (no facet at all -- the roster has never held a row) never
          claims a filter excluded anything. */}
      {!loading && grid && visibleRows.length === 0 && (
        <EmptyState
          variant={hasActiveNarrowing(filters) ? 'filtered' : 'fresh'}
          what={hasActiveNarrowing(filters) ? 'No speakers match the current filters.' : 'No speakers on the roster yet.'}
          reason={
            hasActiveNarrowing(filters)
              ? narrowingDescription(filters, grid.tasks)
              : 'Speakers appear here once a submission is accepted.'
          }
          action={null}
          escape={hasActiveNarrowing(filters) ? { label: 'Clear filters', onClick: clearNarrowingFacets } : null}
        />
      )}

      {!loading && grid && visibleRows.length > 0 && (
        <>
          <div className="chq-speakers-grid-wrap">
            <table className="chq-table chq-speakers-grid">
              <thead>
                <tr>
                  {/* Design pack v12 finishes the collapse Ruling A12
                      (DEC-662 amendment, wave 25) started: A12 cut each
                      column's Edit+Remove pair down to one Edit, and v12
                      cuts the six surviving Edits down to ONE "Edit tasks"
                      beside the Speaker head. Six columns whose job is
                      labelling carried six controls; now they carry none,
                      and the one control that remains sits where a
                      table-wide action belongs. */}
                  <th>
                    <div className="chq-speakers-task-title-row">
                      <span>Speaker &middot; Participation</span>
                      <EditTasksMenu tasks={visibleTasks} now={now} onEdit={setEditingTask} />
                    </div>
                  </th>
                  {visibleTasks.map((task) => {
                    const done = taskDoneLabel(task);
                    return (
                      <th key={task.id}>
                        {/* v12: name · due · "N of M done". The NAME is the
                            link into the task view -- the head is both the
                            aggregate and the entry point, so the grid adds
                            no controls and answers a question it previously
                            could not. */}
                        <div className="chq-speakers-task-head">
                          <Link className="chq-speakers-task-title" to={`/speakers/tasks/${task.id}`}>
                            {task.title}
                          </Link>
                          <span className="chq-speakers-task-due">{taskDueLabel(task, now)}</span>
                          {done && (
                            <span
                              className={
                                done.settled
                                  ? 'chq-speakers-task-done chq-speakers-task-done-settled'
                                  : 'chq-speakers-task-done'
                              }
                            >
                              {done.text}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const notChased = notChasingStatus(row.contact);
                  const declinedOnly = isRowNotChased(row.contact);
                  return (
                  <tr key={row.contact.id}>
                    <td>
                      {/* DEC-930: the grid's name cell is the link into the
                          per-speaker detail page -- every action the grid
                          offers is one click from that one snapshot. */}
                      <Link className="chq-row-title chq-speakers-name-link" to={`/speakers/${row.contact.id}`}>
                        {row.contact.name}
                      </Link>
                      <div className="chq-meta">
                        {row.contact.company ?? '—'}
                        {row.contact.hasAccount && (
                          <>
                            {' '}
                            &middot; has account
                          </>
                        )}
                      </div>
                      {/* Frame stacks this identity block 4 lines deep: name,
                          "company · has account", the participation pills
                          with its Send-portal-invite sibling on one line, then
                          Remind alone on its own line beneath -- so the
                          participation menus and the invite control
                          share a row wrapper instead of flowing inline with
                          Remind. */}
                      <div className="chq-speakers-row-participation">
                        {row.contact.participations.map((participation) => (
                          <ParticipationMenu
                            key={participation.participantId}
                            contactName={row.contact.name}
                            label={row.contact.participations.length > 1 ? participation.ref : undefined}
                            status={participation.inviteStatus}
                            company={row.contact.company}
                            hasAccount={row.contact.hasAccount}
                            onSelectStatus={(status) =>
                              setInviteStatus(row.contact.id, participation.submissionId, participation.participantId, status)
                            }
                            onSendInvite={() => sendPortalInvite(row.contact.id)}
                            sendInviteDisabled={invitingContactIds.has(row.contact.id)}
                          />
                        ))}
                        {/* DEC-805/DEC-934: quiet, conditional — a contact who
                            already has an account has no use for a claim-link
                            invite, and a contact already invited has nothing
                            left for this control to do (the frame's one
                            question is "who still needs inviting"). */}
                        {!row.contact.hasAccount && !alreadyInvited(row.contact) && (
                          <button
                            type="button"
                            className="chq-btn chq-btn-tertiary chq-speakers-invite-one"
                            onClick={() => sendPortalInvite(row.contact.id)}
                            disabled={invitingContactIds.has(row.contact.id)}
                          >
                            Send portal invite
                          </button>
                        )}
                      </div>
                      {/* DEC-829 amendment: a declined-only row offers no
                          per-row remind action (nothing will ever be sent)
                          and says so with one quiet marker, instead of a
                          live control nothing will act on. */}
                      {declinedOnly ? (
                        <span className="chq-speakers-not-chased-marker">{NOT_CHASED_MARKER}</span>
                      ) : (
                        hasOutstandingWork(row) && (
                          <button
                            type="button"
                            className="chq-btn chq-btn-tertiary chq-speakers-remind-one"
                            onClick={() => openRemindReview([row.contact.id])}
                          >
                            Remind {firstNameOf(row.contact.name)}
                          </button>
                        )
                      )}
                      {/* DEC-934 amendment (wave 4): the not-chasing sentence
                          is the row's caption, beneath the identity cell --
                          the task cells to its right still render (quiet,
                          non-actionable), so a stray/stale assignment stays
                          visible instead of being hidden by a strip. */}
                      {notChased !== null && (
                        <div className="chq-speakers-not-chasing">{notChasingMessage(notChased)}</div>
                      )}
                    </td>
                    {visibleTasks.map((task) => (
                      <td key={task.id}>
                        <TaskCell
                          task={task}
                          cell={row.cells.find((c) => c.taskId === task.id)}
                          contactName={row.contact.name}
                          now={now}
                          timezone={grid.timezone}
                          onToggle={toggleCell}
                          density="dense"
                          notChased={declinedOnly}
                          interactive={notChased === null}
                          notSaved={
                            pendingFailure?.assignmentId !== null &&
                            row.cells.some((c) => c.taskId === task.id && c.assignmentId === pendingFailure?.assignmentId)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="chq-speakers-cards">
            {visibleRows.map((row) => {
              const notChased = notChasingStatus(row.contact);
              const declinedOnly = isRowNotChased(row.contact);
              return (
              <div key={row.contact.id} className="chq-speakers-card">
                <div className="chq-speakers-card-head">
                  <Link className="chq-row-title chq-speakers-name-link" to={`/speakers/${row.contact.id}`}>
                    {row.contact.name}
                  </Link>
                  <span className="chq-meta">
                    {row.contact.company ?? '—'}
                    {row.contact.hasAccount && (
                      <>
                        {' '}
                        &middot; has account
                      </>
                    )}
                  </span>
                  {row.contact.participations.map((participation) => (
                    <ParticipationMenu
                      key={participation.participantId}
                      contactName={row.contact.name}
                      label={row.contact.participations.length > 1 ? participation.ref : undefined}
                      status={participation.inviteStatus}
                      company={row.contact.company}
                      hasAccount={row.contact.hasAccount}
                      onSelectStatus={(status) =>
                        setInviteStatus(row.contact.id, participation.submissionId, participation.participantId, status)
                      }
                      onSendInvite={() => sendPortalInvite(row.contact.id)}
                      sendInviteDisabled={invitingContactIds.has(row.contact.id)}
                    />
                  ))}
                  {declinedOnly ? (
                    <span className="chq-speakers-not-chased-marker">{NOT_CHASED_MARKER}</span>
                  ) : (
                    <button
                      type="button"
                      className="chq-btn chq-btn-tertiary chq-speakers-remind-one"
                      onClick={() => openRemindReview([row.contact.id])}
                    >
                      Remind {firstNameOf(row.contact.name)}
                    </button>
                  )}
                  {/* DEC-934 amendment (wave 4): same identity-cell caption
                      as the pinned table -- the cells below still render. */}
                  {notChased !== null && (
                    <div className="chq-speakers-not-chasing">{notChasingMessage(notChased)}</div>
                  )}
                </div>
                <div className="chq-speakers-card-tasks">
                  {visibleTasks.map((task) => (
                    <div key={task.id} className="chq-speakers-card-task">
                      <span className="chq-speakers-card-task-label">{task.title}</span>
                      <TaskCell
                        task={task}
                        cell={row.cells.find((c) => c.taskId === task.id)}
                        contactName={row.contact.name}
                        now={now}
                        timezone={grid.timezone}
                        onToggle={toggleCell}
                        density="roomy"
                        notChased={declinedOnly}
                        interactive={notChased === null}
                        notSaved={
                          pendingFailure?.assignmentId !== null &&
                          row.cells.some((c) => c.taskId === task.id && c.assignmentId === pendingFailure?.assignmentId)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}

      {/* DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state (no
          narrowing facet active) hides the pager -- 'Showing 0 of 0' with
          Prev/Next under a block that says the roster has never held a row
          is chrome over nothing. A FILTERED zero-state keeps it: chrome is
          how a filter gets undone. */}
      {!loading && grid && !(visibleRows.length === 0 && !hasActiveNarrowing(filters)) && (
        <div className="chq-speakers-pager">
          <span className="chq-summary">{paginationSummary(page, PER_PAGE, total, visibleRows.length)}</span>
          <span className="chq-speakers-grid-legend">{GRID_STATUS_LEGEND}</span>
          <span className="chq-speakers-grid-caption">Click any status to mark it complete or pending</span>
          <div className="chq-speakers-pager-actions">
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={rangeEnd >= total}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showNewTask && (
        <TaskModal
          onCancel={() => setShowNewTask(false)}
          onSubmit={handleCreateTask}
          forms={taskForms}
          acceptedCount={counts?.speakers ?? 0}
          assignees={taskAssignees}
          assigneesTruncated={taskAssigneesTruncated}
        />
      )}

      {editingTask && (
        <TaskModal
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSubmit={handleEditTask}
          forms={taskForms}
          acceptedCount={counts?.speakers ?? 0}
          // Ruling A12: Remove now opens from inside the editor -- swap the
          // Edit modal for the existing Remove confirm flow (removingTask
          // drives the same delete-preview + ConfirmDialog as before).
          onRemove={() => {
            setRemovingTask(editingTask);
            setEditingTask(null);
          }}
        />
      )}

      {removingTask && (
        <ConfirmDialog
          title="Remove task"
          body={
            removePreviewError
              ? `Could not load the delete preview: ${removePreviewError}`
              : removePreviewLoading || !removePreview
                ? 'Counting affected speakers…'
                : `${removePreview.assigned} speakers are assigned this task and ${removePreview.completed} have completed it. Their uploaded files stay in the files library; their form responses do not — ${countOf(removePreview.responses, 'response')} will be deleted.`
          }
          confirmLabel="Remove task"
          pending={removingBusy}
          confirmDisabled={removePreviewLoading || !!removePreviewError || !removePreview}
          onConfirm={confirmRemoveTask}
          onCancel={() => setRemovingTask(null)}
        />
      )}

      {reviewingRemind && (
        <RemindPreviewModal
          loading={remindPreviewLoading}
          error={remindPreviewError}
          drafts={remindDrafts}
          skipped={remindSkipped}
          remaining={remindRemaining}
          sending={reminding}
          onSend={handleRemind}
          onCancel={closeRemindReview}
        />
      )}

    </div>
  );
}
