import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { filterOnboardingRows } from './rowFilters';
import { GridFilters } from './GridFilters';
import { computeOnboardingCounts, isCellOverdue, outstandingContactCount } from './overdue';
import { TaskModal } from './TaskModal';
import { formatDateOnly } from '../../lib/dates';
import {
  DEFAULT_GRID_FILTERS,
  type AssignmentStatus,
  type GridFilterState,
  type NewTaskInput,
  type OnboardingGridResponse,
} from './types';

function nextStatus(status: AssignmentStatus): AssignmentStatus {
  return status === 'complete' ? 'pending' : 'complete';
}

export function OnboardingGrid() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [grid, setGrid] = useState<OnboardingGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GridFilterState>(DEFAULT_GRID_FILTERS);
  const [showNewTask, setShowNewTask] = useState(false);
  const [confirmingRemind, setConfirmingRemind] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function loadGrid(id: string) {
    setLoading(true);
    setError(null);
    return apiGet<OnboardingGridResponse>(`/events/${id}/onboarding`)
      .then((res) => setGrid(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load onboarding grid'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!eventId) return;
    loadGrid(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const now = Date.now();
  const counts = useMemo(() => (grid ? computeOnboardingCounts(grid, now) : null), [grid, now]);
  const visibleRows = useMemo(
    () => (grid ? filterOnboardingRows(grid, filters, now) : []),
    [grid, filters, now],
  );
  const remindCount = useMemo(
    () => (grid ? outstandingContactCount(grid) : 0),
    [grid],
  );

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
      const res = await apiPost<{ sent: number }>(`/events/${eventId}/onboarding/remind`, {});
      setToast(`Reminder sent to ${res.sent} contact${res.sent === 1 ? '' : 's'}.`);
      setConfirmingRemind(false);
      await loadGrid(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? `Remind failed: ${err.message}` : 'Remind failed');
    } finally {
      setReminding(false);
    }
  }

  async function handleCreateTask(input: NewTaskInput) {
    if (!eventId) return;
    await apiPost(`/events/${eventId}/tasks`, input);
    setShowNewTask(false);
    setToast('Task created.');
    await loadGrid(eventId);
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
        {grid && <GridFilters tasks={grid.tasks} filters={filters} onChange={setFilters} />}
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
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showNewTask && <TaskModal onCancel={() => setShowNewTask(false)} onSubmit={handleCreateTask} />}
    </div>
  );
}
