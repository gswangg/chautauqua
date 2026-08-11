import { useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { GridFilters } from './GridFilters';
import { isCellOverdue } from './overdue';
import { TaskModal } from './TaskModal';
import { ResponseModal } from './ResponseModal';
import { formatDateOnly } from '../../lib/dates';
import {
  DEFAULT_GRID_FILTERS,
  type AssignmentResponseDetail,
  type AssignmentStatus,
  type GridFilterState,
  type NewTaskInput,
  type OnboardingGridResponse,
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

export function OnboardingGrid() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [grid, setGrid] = useState<OnboardingGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GridFilterState>(DEFAULT_GRID_FILTERS);
  const [page, setPage] = useState(1);
  const [showNewTask, setShowNewTask] = useState(false);
  const [confirmingRemind, setConfirmingRemind] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewingResponse, setViewingResponse] = useState<{ contactName: string } | null>(null);
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

  function handleFiltersChange(next: GridFilterState) {
    setFilters(next);
    setPage(1);
  }

  const now = Date.now();
  const counts = grid?.counts ?? null;
  const visibleRows = grid?.rows ?? [];
  const remindCount = counts?.outstandingContacts ?? 0;
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

  async function handleRemind() {
    if (!eventId) return;
    setReminding(true);
    setError(null);
    try {
      const res = await apiPost<{ sent: number; skipped: number; remaining: number }>(
        `/events/${eventId}/onboarding/remind`,
        {},
      );
      const parts = [`Reminder sent to ${res.sent} contact${res.sent === 1 ? '' : 's'}.`];
      if (res.skipped > 0) {
        parts.push(`${res.skipped} contact${res.skipped === 1 ? '' : 's'} skipped (reminded recently).`);
      }
      if (res.remaining > 0) {
        parts.push(
          `${res.remaining} contact${res.remaining === 1 ? '' : 's'} still outstanding — click Remind again to continue.`,
        );
      }
      setToast(parts.join(' '));
      setConfirmingRemind(false);
      await loadGrid(eventId, filters, page);
    } catch (err) {
      setError(err instanceof ApiError ? `Remind failed: ${err.message}` : 'Remind failed');
    } finally {
      setReminding(false);
    }
  }

  async function openResponse(assignmentId: string, contactName: string) {
    setViewingResponse({ contactName });
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

  async function handleCreateTask(input: NewTaskInput) {
    if (!eventId) return;
    await apiPost(`/events/${eventId}/tasks`, input);
    setShowNewTask(false);
    setToast('Task created.');
    await loadGrid(eventId, filters, page);
  }

  if (eventLoading) {
    return (
      <div className="chq-page">
        <h1>Speakers</h1>
        <p>Loading event...</p>
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page">
        <h1>Speakers</h1>
        <div className="chq-attention-frame">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-onboarding-page">
      <h1>Speakers</h1>

      {error && <div className="chq-error-banner">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="chq-attention-frame chq-onboarding-counts">
        <div>
          <strong>{counts?.speakers ?? 0}</strong> accepted speakers
        </div>
        <div>
          <strong>{counts?.outstandingRequired ?? 0}</strong> outstanding required tasks
        </div>
        <div className={counts && counts.overdue > 0 ? 'chq-overdue-count' : ''}>
          <strong>{counts?.overdue ?? 0}</strong> overdue
        </div>
      </div>

      <div className="chq-onboarding-toolbar">
        {grid && <GridFilters tasks={grid.tasks} filters={filters} onChange={handleFiltersChange} />}
        <div className="chq-onboarding-actions">
          <button type="button" onClick={() => setShowNewTask(true)}>
            New task
          </button>
          <button type="button" onClick={() => setConfirmingRemind(true)} disabled={!grid || grid.rows.length === 0}>
            Remind everyone outstanding
          </button>
        </div>
      </div>

      {confirmingRemind && (
        <div className="chq-attention-frame chq-remind-confirm">
          <p>
            This will email <strong>{remindCount}</strong> contact{remindCount === 1 ? '' : 's'} with outstanding
            tasks. Continue?
          </p>
          <button type="button" onClick={handleRemind} disabled={reminding}>
            {reminding ? 'Sending...' : 'Confirm and send'}
          </button>
          <button type="button" onClick={() => setConfirmingRemind(false)} disabled={reminding}>
            Cancel
          </button>
        </div>
      )}

      {loading && <p>Loading...</p>}

      {!loading && grid && (
        <table className="chq-onboarding-table">
          <thead>
            <tr>
              <th>Speaker</th>
              {grid.tasks.map((task) => (
                <th key={task.id}>
                  {task.title}
                  {task.required && <span className="chq-required-marker"> *</span>}
                  <div className="chq-task-due">{formatDateOnly(task.dueDate)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={1 + grid.tasks.length}>No speakers match the current filters.</td>
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr key={row.contact.id}>
                <td>
                  <div>{row.contact.name}</div>
                  <div className="chq-contact-meta">
                    {row.contact.company ?? '—'} &middot; {row.contact.email}
                    {row.contact.hasAccount && <span className="chq-pill chq-has-account">Has account</span>}
                  </div>
                </td>
                {grid.tasks.map((task) => {
                  const cell = row.cells.find((c) => c.taskId === task.id);
                  if (!cell) {
                    return <td key={task.id}>&mdash;</td>;
                  }
                  const overdue = isCellOverdue(cell, task, now);
                  return (
                    <td key={task.id}>
                      <button
                        type="button"
                        className={`chq-status-pill chq-status-${cell.status}${overdue ? ' chq-overdue' : ''}`}
                        onClick={() => toggleCell(cell.assignmentId, cell.status)}
                        aria-label={`Toggle ${task.title} for ${row.contact.name}`}
                      >
                        {cell.status === 'complete' ? 'Complete' : overdue ? 'Overdue' : 'Pending'}
                      </button>
                      {cell.fileId && (
                        <a
                          href={`/files/${cell.fileId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="chq-paperclip"
                          aria-label="Has file"
                          title="Has file"
                        >
                          {'📎'}
                        </a>
                      )}
                      {task.kind === 'form' && (
                        <button
                          type="button"
                          className="chq-view-response-link"
                          onClick={() => openResponse(cell.assignmentId, row.contact.name)}
                        >
                          View response
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && grid && (
        <div className="chq-pager">
          <span>
            Showing {rangeStart}-{rangeEnd} of {total}
          </span>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </button>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={rangeEnd >= total}>
            Next
          </button>
        </div>
      )}

      {showNewTask && <TaskModal onCancel={() => setShowNewTask(false)} onSubmit={handleCreateTask} />}

      {viewingResponse && (
        <ResponseModal
          contactName={viewingResponse.contactName}
          loading={responseLoading}
          error={responseError}
          detail={responseDetail}
          onClose={closeResponse}
        />
      )}
    </div>
  );
}
