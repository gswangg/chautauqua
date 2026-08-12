import { useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { GridFilters } from './GridFilters';
import { daysLate, isCellOverdue } from './overdue';
import { TaskModal } from './TaskModal';
import { ResponseModal } from './ResponseModal';
import { RemindPreviewModal } from './RemindPreviewModal';
import { formatDateOnly } from '../../lib/dates';
import { describeSendResult, type SendResult } from '../../lib/sendResult';
import {
  DEFAULT_GRID_FILTERS,
  type AssignmentResponseDetail,
  type AssignmentStatus,
  type EventForm,
  type GridFilterState,
  type NewTaskInput,
  type OnboardingGridResponse,
  type ReminderDraft,
} from './types';

function nextStatus(status: AssignmentStatus): AssignmentStatus {
  return status === 'complete' ? 'pending' : 'complete';
}

const PER_PAGE = 50;

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
  return params.toString();
}

/** Label for a pending, overdue cell — never colour alone, never red
 * (DEC-367). Complete is a filled pill, pending is an outline pill, overdue
 * drops the pill entirely for a .chq-flag "N DAYS LATE" typographic mark. */
function lateLabel(dueDate: number, now: number): string {
  const d = daysLate(dueDate, now);
  return `${d} DAY${d === 1 ? '' : 'S'} LATE`;
}

export function OnboardingGrid() {
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
  const [reminding, setReminding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewingResponse, setViewingResponse] = useState<{ assignmentId: string; contactName: string } | null>(
    null,
  );
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responseDetail, setResponseDetail] = useState<AssignmentResponseDetail | null>(null);

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

  // SPEC §10 #3 (DEC-441): "Remind all outstanding" no longer sends
  // directly — it opens a review dialog fed by the read-only preview
  // endpoint, rendered from the identical builder the real send uses.
  async function openRemindReview() {
    if (!eventId) return;
    setReviewingRemind(true);
    setRemindPreviewLoading(true);
    setRemindPreviewError(null);
    setRemindDrafts(null);
    try {
      const res = await apiPost<{ drafts: ReminderDraft[]; skipped: number; remaining: number }>(
        `/events/${eventId}/onboarding/remind/preview`,
        {},
      );
      setRemindDrafts(res.drafts);
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
  }

  async function handleRemind() {
    if (!eventId) return;
    setReminding(true);
    setError(null);
    try {
      const res = await apiPost<SendResult>(`/events/${eventId}/onboarding/remind`, {});
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

  // DEC-599: 'Mark complete' / 'Ask for more' in the response modal write
  // the same PATCH /task-assignments/:id status the grid cells write, and
  // reconcile optimistically with loud rollback on ApiError (matching
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

  if (eventLoading) {
    return (
      <div className="chq-page chq-speakers-page">
        <h1 className="chq-page-title">Speakers</h1>
        <p>Loading event...</p>
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-speakers-page">
        <h1 className="chq-page-title">Speakers</h1>
        <div className="chq-error">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-speakers-page">
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
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowNewTask(true)}>
            New task
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            onClick={openRemindReview}
            disabled={!grid || grid.rows.length === 0}
          >
            Remind all outstanding
          </button>
        </div>
      </div>

      <div className="chq-speakers-toolbar">
        {grid && <GridFilters tasks={grid.tasks} filters={filters} onChange={handleFiltersChange} />}
        <span className="chq-speakers-toolbar-caption">Skips anyone reminded in the last hour</span>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && grid && (
        <>
          <div className="chq-speakers-grid-wrap">
            <table className="chq-table chq-speakers-grid">
              <thead>
                <tr>
                  <th>Speaker</th>
                  {grid.tasks.map((task) => (
                    <th key={task.id}>
                      {task.title}
                      {task.required && <span className="chq-speakers-required-marker"> *</span>}
                      <div className="chq-speakers-task-due">{formatDateOnly(task.dueDate)}</div>
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
                {visibleRows.map((row) => (
                  <tr key={row.contact.id}>
                    <td>
                      <div className="chq-row-title">{row.contact.name}</div>
                      <div className="chq-meta">
                        {row.contact.company ?? '—'} &middot; {row.contact.email}
                        {row.contact.hasAccount && (
                          <span className="chq-pill chq-speakers-has-account">Has account</span>
                        )}
                      </div>
                    </td>
                    {grid.tasks.map((task) => {
                      const cell = row.cells.find((c) => c.taskId === task.id);
                      if (!cell) {
                        return (
                          <td key={task.id}>
                            <span className="chq-speakers-cell-none">&mdash;</span>
                          </td>
                        );
                      }
                      const overdue = isCellOverdue(cell, task, now);
                      const cellClass =
                        cell.status === 'complete'
                          ? 'chq-speakers-cell-fill'
                          : overdue
                            ? 'chq-flag chq-speakers-cell-late'
                            : 'chq-speakers-cell-outline';
                      return (
                        <td key={task.id}>
                          <div className="chq-speakers-cell">
                            <button
                              type="button"
                              className={cellClass}
                              onClick={() => toggleCell(cell.assignmentId, cell.status)}
                              aria-label={`Toggle ${task.title} for ${row.contact.name}`}
                            >
                              {cell.status === 'complete'
                                ? 'Complete'
                                : overdue && task.dueDate !== null
                                  ? lateLabel(task.dueDate, now)
                                  : 'Pending'}
                            </button>
                            {cell.fileId && (
                              <a
                                href={`/files/${cell.fileId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="chq-speakers-file-link"
                                aria-label="Has file"
                                title="Has file"
                              >
                                File
                              </a>
                            )}
                            {task.kind === 'form' && (
                              <button
                                type="button"
                                className="chq-btn-tertiary chq-speakers-view-response"
                                onClick={() => openResponse(cell.assignmentId, row.contact.name)}
                              >
                                View response
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chq-speakers-cards">
            {visibleRows.length === 0 && <p className="chq-empty">No speakers match the current filters.</p>}
            {visibleRows.map((row) => (
              <div key={row.contact.id} className="chq-speakers-card">
                <div className="chq-speakers-card-head">
                  <span className="chq-row-title">{row.contact.name}</span>
                  <span className="chq-meta">
                    {row.contact.company ?? '—'} &middot; {row.contact.email}
                  </span>
                </div>
                <div className="chq-speakers-card-tasks">
                  {grid.tasks.map((task) => {
                    const cell = row.cells.find((c) => c.taskId === task.id);
                    if (!cell) {
                      return (
                        <div key={task.id} className="chq-speakers-card-task">
                          <span className="chq-speakers-card-task-label">{task.title}</span>
                          <span className="chq-speakers-cell-none">&mdash;</span>
                        </div>
                      );
                    }
                    const overdue = isCellOverdue(cell, task, now);
                    const cellClass =
                      cell.status === 'complete'
                        ? 'chq-speakers-cell-fill'
                        : overdue
                          ? 'chq-flag chq-speakers-cell-late'
                          : 'chq-speakers-cell-outline';
                    return (
                      <div key={task.id} className="chq-speakers-card-task">
                        <span className="chq-speakers-card-task-label">{task.title}</span>
                        <button
                          type="button"
                          className={cellClass}
                          onClick={() => toggleCell(cell.assignmentId, cell.status)}
                          aria-label={`Toggle ${task.title} for ${row.contact.name}`}
                        >
                          {cell.status === 'complete'
                            ? 'Complete'
                            : overdue && task.dueDate !== null
                              ? lateLabel(task.dueDate, now)
                              : 'Pending'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && grid && (
        <div className="chq-speakers-pager">
          <span className="chq-summary">
            Showing {rangeStart}-{rangeEnd} of {total}
          </span>
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
        <TaskModal onCancel={() => setShowNewTask(false)} onSubmit={handleCreateTask} forms={taskForms} />
      )}

      {reviewingRemind && (
        <RemindPreviewModal
          loading={remindPreviewLoading}
          error={remindPreviewError}
          drafts={remindDrafts}
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
