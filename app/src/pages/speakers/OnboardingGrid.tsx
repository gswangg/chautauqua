import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { DEC_827 } from '../../../../src/decisions';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DelayedLoading } from '../../components/DelayedLoading';
import { GridFilters } from './GridFilters';
import { TaskCell, formatDueDate, isRowNotChased } from './TaskCell';
import { TaskModal } from './TaskModal';
import { ResponseModal } from './ResponseModal';
import { RemindPreviewModal } from './RemindPreviewModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { describeSendResult, type SendResult } from '../../lib/sendResult';
import { ParticipationMenu } from './ParticipationMenu';
import {
  DEFAULT_GRID_FILTERS,
  type AssignmentResponseDetail,
  type AssignmentStatus,
  type EventForm,
  type GridFilterState,
  type InviteStatus,
  type NewTaskInput,
  type OnboardingGridResponse,
  type OnboardingTask,
  type ReminderDraft,
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

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// DEC-934: a roster row whose participation is 'invited'/'declined' is one
// the product will never chase (task expansion only covers
// ACTIVE_INVITE_STATUSES) -- it renders ONE muted strip instead of N blank
// task cells, so the emptiness reads as a stated decision, not an accident.
const NOT_CHASING_STATUSES: readonly InviteStatus[] = ['invited', 'declined'];

function notChasingMessage(status: InviteStatus): string {
  return `Not chasing - invite ${status}. Set participation to Confirmed to assign this event's tasks.`;
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
  const [reviewingRemind, setReviewingRemind] = useState(false);
  const [remindPreviewLoading, setRemindPreviewLoading] = useState(false);
  const [remindPreviewError, setRemindPreviewError] = useState<string | null>(null);
  const [remindDrafts, setRemindDrafts] = useState<ReminderDraft[] | null>(null);
  // DEC-441 amendment (DEC-829): the server's own skipped figure, threaded
  // through verbatim rather than recomputed client-side, so the modal can
  // never claim a different number than the send performs.
  const [remindSkipped, setRemindSkipped] = useState(0);
  const [reminding, setReminding] = useState(false);
  // DEC-694: undefined => "Remind all outstanding" (today's behaviour);
  // a one-element array => the per-row "Remind ‹first name›" quiet control.
  // Both paths share the identical preview->confirm->send flow/dialog.
  const [remindContactIds, setRemindContactIds] = useState<string[] | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  // DEC-805: tracks in-flight per-row portal-invite sends so the quiet
  // control can't be double-clicked into two overlapping sends.
  const [invitingContactIds, setInvitingContactIds] = useState<Set<string>>(new Set());
  const [viewingResponse, setViewingResponse] = useState<{ assignmentId: string; contactName: string } | null>(
    null,
  );
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responseDetail, setResponseDetail] = useState<AssignmentResponseDetail | null>(null);
  // DEC-933: the task column being edited (Edit control) / offered for
  // removal (Remove control) -- null when neither modal/dialog is open.
  const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);
  const [removingTask, setRemovingTask] = useState<OnboardingTask | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

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

  function handleFiltersChange(next: GridFilterState) {
    setFilters(next);
    setPage(1);
  }

  const now = Date.now();
  const counts = grid?.counts ?? null;
  const visibleRows = grid?.rows ?? [];
  const total = grid?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * PER_PAGE, total);

  async function toggleCell(assignmentId: string, currentStatus: AssignmentStatus) {
    if (!grid || !eventId) return;
    const previous = grid;
    const desired = nextStatus(currentStatus);

    // Optimistic render with rollback on ApiError (SPEC §7).
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
    } catch (err) {
      setGrid(previous);
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    }
  }

  // DEC-789/DEC-830: writes the roster row's invite status through
  // PATCH /submissions/:submissionId/participants/:participantId (task-w3-c,
  // mocked in tests -- this file never imports src/routes/api/submissions.ts).
  // Optimistic, with rollback on ApiError (matching toggleCell/
  // changeResponseStatus's established pattern on this page). Driven by an
  // explicit menu selection (ParticipationMenu) rather than a click-to-cycle
  // control -- the desired state is chosen, never advanced.
  async function setInviteStatus(contactId: string, submissionId: string, participantId: string, desired: InviteStatus) {
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
    } catch (err) {
      setGrid(previous);
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    }
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
    try {
      const res = await apiPost<{ drafts: ReminderDraft[]; skipped: number; remaining: number }>(
        `/events/${eventId}/onboarding/remind/preview`,
        contactIds ? { contactIds } : {},
      );
      setRemindDrafts(res.drafts);
      setRemindSkipped(res.skipped);
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
      const failedNames = res.failed && res.failed.length > 0 ? ` ${res.failed.map((f) => f.message).join('; ')}.` : '';
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

  async function openResponse(assignmentId: string, contactName: string) {
    setViewingResponse({ assignmentId, contactName });
    setResponseDetail(null);
    setResponseError(null);
    setResponseLoading(true);
    try {
      const detail = await apiGet<AssignmentResponseDetail>(`/task-assignments/${assignmentId}/response`);
      setResponseDetail(detail);
    } catch (err) {
      setResponseError(err instanceof ApiError ? err.message : 'Failed to load response');
    } finally {
      setResponseLoading(false);
    }
  }

  function closeResponse() {
    setViewingResponse(null);
    setResponseDetail(null);
    setResponseError(null);
  }

  // DEC-599/DEC-694: 'Reopen this task' in the response modal writes the
  // same PATCH /task-assignments/:id status the grid cells write, and
  // reconciles optimistically with loud rollback on ApiError (matching
  // toggleCell) -- the grid row AND the open modal's status must agree.
  async function changeResponseStatus(assignmentId: string, desired: AssignmentStatus) {
    if (!grid) return;
    const previousGrid = grid;
    const previousDetail = responseDetail;
    const completedAt = desired === 'complete' ? now : null;

    setGrid({
      ...grid,
      rows: grid.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) =>
          cell.assignmentId === assignmentId ? { ...cell, status: desired, completedAt } : cell,
        ),
      })),
    });
    setResponseDetail((prev) => (prev ? { ...prev, status: desired, completedAt } : prev));
    setResponseError(null);

    try {
      await apiPatch(`/task-assignments/${assignmentId}`, { status: desired });
    } catch (err) {
      setGrid(previousGrid);
      setResponseDetail(previousDetail);
      setResponseError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
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

  // DEC-933: N/M are read straight off the grid rows already fetched into
  // state -- never a new count endpoint, never a query per row.
  function taskAssignmentCounts(task: OnboardingTask): { assigned: number; completed: number } {
    let assigned = 0;
    let completed = 0;
    for (const row of visibleRows) {
      const cell = row.cells.find((c) => c.taskId === task.id);
      if (!cell) continue;
      assigned += 1;
      if (cell.status === 'complete') completed += 1;
    }
    return { assigned, completed };
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
        <DelayedLoading label="Loading event…" />
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
        <div className="chq-error" role="status">
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
            <strong>{counts?.speakers ?? 0}</strong> accepted &middot; <strong>{counts?.outstandingRequired ?? 0}</strong>{' '}
            tasks open &middot; <strong>{counts?.overdue ?? 0}</strong> overdue
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
          {/* DEC-662/DEC-827 amendment (wave 55): the roster's only mention
              of import is a quiet link, not a second importer -- it joins
              this same title-action row rather than opening a new band, and
              carries the current event id so the Contacts import wizard
              preselects this event rather than making the organizer
              re-pick it. */}
          {eventId && (
            <Link
              to={`/contacts?import=1&eventId=${encodeURIComponent(eventId)}`}
              className="chq-link-button chq-speakers-import-link"
            >
              Import speakers from a CSV
            </Link>
          )}
        </div>
      </div>

      <div className="chq-speakers-toolbar">
        {grid && <GridFilters tasks={grid.tasks} filters={filters} onChange={handleFiltersChange} />}
        <span className="chq-speakers-toolbar-caption">Skips anyone reminded in the last hour</span>
      </div>

      {loading && <DelayedLoading />}

      {!loading && grid && (
        <>
          <div className="chq-speakers-grid-wrap">
            <table className="chq-table chq-speakers-grid">
              <thead>
                <tr>
                  <th>Speaker &middot; Participation</th>
                  {grid.tasks.map((task) => (
                    <th key={task.id}>
                      <div className="chq-speakers-task-title">{task.title}</div>
                      <div className="chq-speakers-task-due">{taskDueLabel(task, now)}</div>
                      {/* DEC-933: quiet Edit/Remove controls -- the grid's
                          columns are otherwise write-once. */}
                      <div className="chq-speakers-task-header-actions">
                        <button
                          type="button"
                          className="chq-link-button chq-speakers-task-edit"
                          onClick={() => setEditingTask(task)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="chq-link-button chq-speakers-task-remove"
                          onClick={() => setRemovingTask(task)}
                        >
                          Remove
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={1 + grid.tasks.length} className="chq-empty">
                      No speakers match the current filters.
                    </td>
                  </tr>
                )}
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
                            &middot; <span className="chq-pill chq-speakers-has-account">Has account</span>
                          </>
                        )}
                      </div>
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
                      {/* DEC-829 amendment: a declined-only row offers no
                          per-row remind action (nothing will ever be sent)
                          and says so with one quiet marker, instead of a
                          live control nothing will act on. */}
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
                      {!row.contact.hasAccount && alreadyInvited(row.contact) && (
                        <span className="chq-speakers-invited-marker">EMAILED</span>
                      )}
                    </td>
                    {notChased !== null ? (
                      <td colSpan={grid.tasks.length} className="chq-speakers-not-chasing">
                        {notChasingMessage(notChased)}
                      </td>
                    ) : (
                      grid.tasks.map((task) => (
                        <td key={task.id}>
                          <TaskCell
                            task={task}
                            cell={row.cells.find((c) => c.taskId === task.id)}
                            contactName={row.contact.name}
                            now={now}
                            onToggle={toggleCell}
                            onOpenResponse={openResponse}
                            notChased={declinedOnly}
                          />
                        </td>
                      ))
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="chq-speakers-cards">
            {visibleRows.length === 0 && <p className="chq-empty">No speakers match the current filters.</p>}
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
                        &middot; <span className="chq-pill chq-speakers-has-account">Has account</span>
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
                </div>
                <div className="chq-speakers-card-tasks">
                  {notChased !== null ? (
                    <div className="chq-speakers-not-chasing">{notChasingMessage(notChased)}</div>
                  ) : (
                    grid.tasks.map((task) => (
                      <div key={task.id} className="chq-speakers-card-task">
                        <span className="chq-speakers-card-task-label">{task.title}</span>
                        <TaskCell
                          task={task}
                          cell={row.cells.find((c) => c.taskId === task.id)}
                          contactName={row.contact.name}
                          now={now}
                          onToggle={toggleCell}
                          onOpenResponse={openResponse}
                          notChased={declinedOnly}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && grid && (
        <div className="chq-speakers-pager">
          <span className="chq-summary">
            Showing {rangeStart}-{rangeEnd} of {total}
          </span>
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
        />
      )}

      {editingTask && (
        <TaskModal
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSubmit={handleEditTask}
          forms={taskForms}
          acceptedCount={counts?.speakers ?? 0}
        />
      )}

      {removingTask && (
        <ConfirmDialog
          title="Remove task"
          body={(() => {
            const { assigned, completed } = taskAssignmentCounts(removingTask);
            return `${assigned} speakers are assigned this task and ${completed} have completed it. Their uploaded files stay in the files library; their form responses do not.`;
          })()}
          confirmLabel="Remove"
          destructive
          pending={removingBusy}
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
          sending={reminding}
          onSend={handleRemind}
          onCancel={closeRemindReview}
        />
      )}

      {viewingResponse && (
        <ResponseModal
          contactName={viewingResponse.contactName}
          loading={responseLoading}
          error={responseError}
          detail={responseDetail}
          onStatusChange={(status) => changeResponseStatus(viewingResponse.assignmentId, status)}
          onClose={closeResponse}
        />
      )}
    </div>
  );
}
