import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, apiGet, ApiError, apiPost } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { BulkActionBar } from './BulkActionBar';
import { deriveColumnsFromFormFields, formatAnswerValue, visibleColumns, type ColumnDef } from './columns';
import { ColumnPicker } from './ColumnPicker';
import { FilterBar } from './FilterBar';
import { buildSubmissionsQuery } from './filters';
import { NewSubmissionModal, type NewSubmissionInput } from './NewSubmissionModal';
import { EMPTY_SELECTION, isPageFullySelected, isPagePartiallySelected, selectionReducer } from './selection';
import {
  DEFAULT_FILTER_STATE,
  STATUS_LABELS,
  type FormField,
  type SubmissionListItem,
  type SubmissionsFilterState,
  type SubmissionStatus,
  type Track,
} from './types';
import { applyViewConfig, type SavedViewConfig } from './views';
import { ViewsDropdown } from './ViewsDropdown';

function formatDate(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString();
}

export function SubmissionsTable() {
  const { eventId } = useCurrentEvent();

  const [filters, setFilters] = useState<SubmissionsFilterState>({ ...DEFAULT_FILTER_STATE, includeAnswers: true });
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tracks] = useState<Track[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [visibleFieldIds, setVisibleFieldIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [loading, setLoading] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const columns: ColumnDef[] = useMemo(() => deriveColumnsFromFormFields(formFields), [formFields]);
  const shownColumns = useMemo(() => visibleColumns(columns, visibleFieldIds), [columns, visibleFieldIds]);

  useEffect(() => {
    if (!eventId) return;
    // GET /events/:id/forms returns the default form OBJECT (not a list); its
    // custom columns come from the form's own `fields` array.
    apiGet<{ fields: FormField[] }>(`/events/${eventId}/forms`)
      .then((res) => setFormFields(res.fields ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load form fields'));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    const qs = buildSubmissionsQuery(filters);
    apiList<SubmissionListItem>(`/events/${eventId}/submissions${qs}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [eventId, filters, refreshToken]);

  const pageIds = items.map((item) => item.id);

  function applySavedView(config: SavedViewConfig) {
    const { filters: nextFilters, visibleFieldIds: nextVisible } = applyViewConfig(config);
    setFilters(nextFilters);
    setVisibleFieldIds(nextVisible);
  }

  async function createSubmission(input: NewSubmissionInput) {
    if (!eventId) return;
    await apiPost(`/events/${eventId}/submissions`, {
      title: input.title,
      description: input.description || null,
      contact: input.contact,
    });
    setShowNewModal(false);
    setRefreshToken((n) => n + 1);
  }

  async function cloneSubmission(id: string) {
    setCloningId(id);
    setError(null);
    try {
      await apiPost(`/submissions/${id}/clone`);
      setRefreshToken((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? `Clone failed: ${err.message}` : 'Clone failed');
    } finally {
      setCloningId(null);
    }
  }

  async function applyBulkStatus(status: SubmissionStatus) {
    if (!eventId || selection.selectedIds.size === 0) return;
    const ids = [...selection.selectedIds];
    const previous = items;
    setBulkPending(true);
    setError(null);
    // Optimistic update.
    setItems((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, status } : item)));
    try {
      await apiPost<{ updated: number }>(`/events/${eventId}/submissions/status`, { ids, status });
      setSelection((s) => selectionReducer(s, { type: 'CLEAR' }));
    } catch (err) {
      // Loud rollback: restore prior state and surface the failure.
      setItems(previous);
      setError(err instanceof ApiError ? `Bulk status update failed: ${err.message}` : 'Bulk status update failed');
    } finally {
      setBulkPending(false);
    }
  }

  if (!eventId) {
    return (
      <div className="chq-page">
        <h1>Submissions</h1>
        <div className="chq-attention-frame">No event selected. Append ?eventId=&lt;id&gt; to the URL.</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-submissions-page">
      <h1>Submissions</h1>

      {error && <div className="chq-error-banner">{error}</div>}

      <div className="chq-submissions-toolbar">
        <ViewsDropdown
          eventId={eventId}
          filters={filters}
          visibleFieldIds={visibleFieldIds}
          onApply={applySavedView}
        />
        <button type="button" onClick={() => setShowNewModal(true)}>
          New submission
        </button>
      </div>

      {showNewModal && (
        <NewSubmissionModal onCancel={() => setShowNewModal(false)} onCreate={createSubmission} />
      )}

      <FilterBar filters={filters} tracks={tracks} onChange={setFilters} />
      <ColumnPicker
        columns={columns}
        visibleFieldIds={visibleFieldIds}
        onToggle={(fieldId) =>
          setVisibleFieldIds((prev) => {
            const next = new Set(prev);
            if (next.has(fieldId)) next.delete(fieldId);
            else next.add(fieldId);
            return next;
          })
        }
      />

      <BulkActionBar
        selectedCount={selection.selectedIds.size}
        pending={bulkPending}
        onApply={applyBulkStatus}
        onClear={() => setSelection((s) => selectionReducer(s, { type: 'CLEAR' }))}
      />

      <table className="chq-submissions-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select all on page"
                checked={isPageFullySelected(selection, pageIds)}
                ref={(el) => {
                  if (el) el.indeterminate = isPagePartiallySelected(selection, pageIds);
                }}
                onChange={() => setSelection((s) => selectionReducer(s, { type: 'TOGGLE_PAGE', pageIds }))}
              />
            </th>
            <th>Ref</th>
            <th>Title</th>
            <th>Speakers</th>
            <th>Tracks</th>
            <th>Status</th>
            <th>Submitted</th>
            {shownColumns.map((col) => (
              <th key={col.fieldId}>{col.label}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8 + shownColumns.length}>Loading...</td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={8 + shownColumns.length}>No submissions match the current filters.</td>
            </tr>
          )}
          {!loading &&
            items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.ref}`}
                    checked={selection.selectedIds.has(item.id)}
                    onChange={() => setSelection((s) => selectionReducer(s, { type: 'TOGGLE_ROW', id: item.id }))}
                  />
                </td>
                <td>{item.ref}</td>
                <td>
                  <Link to={`/submissions/${item.id}`}>{item.title}</Link>
                </td>
                <td>{item.speakers.map((s) => s.name).join(', ')}</td>
                <td>{item.trackIds.length}</td>
                <td>
                  <span className={`chq-status-pill chq-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
                </td>
                <td>{formatDate(item.submittedAt)}</td>
                {shownColumns.map((col) => (
                  <td key={col.fieldId}>{formatAnswerValue(item.answers?.[col.fieldId])}</td>
                ))}
                <td>
                  <button type="button" disabled={cloningId === item.id} onClick={() => cloneSubmission(item.id)}>
                    Clone
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <div className="chq-pagination">
        <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
          Previous
        </button>
        <span>
          Page {filters.page} &middot; {total} total
        </span>
        <button
          type="button"
          disabled={filters.page * filters.perPage >= total}
          onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
