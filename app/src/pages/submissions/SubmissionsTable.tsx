import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, apiGet, ApiError, apiPatch, apiPost } from '../../lib/api';
import { formatDate } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { BulkActionBar } from './BulkActionBar';
import { chunkSelection } from './bulk';
import { deriveColumnsFromFormFields, findFormatField, formatAnswerValue, visibleColumns, type ColumnDef } from './columns';
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

/** DEC-243: render track NAMES, not the raw count of trackIds. */
function trackNames(trackIds: string[], tracks: Track[]): string {
  if (trackIds.length === 0) return '—';
  const byId = new Map(tracks.map((t) => [t.id, t.name]));
  return trackIds.map((id) => byId.get(id) ?? id).join(', ');
}

export function SubmissionsTable() {
  const { eventId } = useCurrentEvent();

  const [filters, setFilters] = useState<SubmissionsFilterState>({ ...DEFAULT_FILTER_STATE, includeAnswers: true });
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [visibleFieldIds, setVisibleFieldIds] = useState<Set<string>>(new Set());
  // DEC-243: has the picker state been established yet, either by the user
  // toggling a column, or by applying a saved view? Until then, the Format
  // column (if the form has one) is auto-shown on first load.
  const [pickerInitialized, setPickerInitialized] = useState(false);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [loading, setLoading] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [triagingId, setTriagingId] = useState<string | null>(null);

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
    if (pickerInitialized || formFields.length === 0) return;
    const formatField = findFormatField(formFields);
    if (formatField) {
      setVisibleFieldIds((prev) => new Set(prev).add(formatField.id));
    }
    setPickerInitialized(true);
  }, [formFields, pickerInitialized]);

  useEffect(() => {
    if (!eventId) return;
    apiList<Track>(`/events/${eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
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
    setPickerInitialized(true);
  }

  async function createSubmission(input: NewSubmissionInput) {
    if (!eventId) return;
    const created = await apiPost<{ id: string }>(`/events/${eventId}/submissions`, {
      title: input.title,
      description: input.description || null,
      contact: input.contact,
    });
    // DEC-598 (closes CNT-D6): the create endpoint doesn't take trackIds
    // directly — apply the organizer's track selection through the same
    // full-set-replace PATCH the detail page's track editor uses, so a
    // submission created here can be track-scoped from the start instead of
    // never being assignable to a track.
    if (input.trackIds.length > 0) {
      await apiPatch(`/submissions/${created.id}`, { trackIds: input.trackIds });
    }
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
    setBulkPending(true);
    setError(null);
    // Optimistic update.
    setItems((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, status } : item)));
    const batches = chunkSelection(ids);
    let completed = 0;
    try {
      for (const batch of batches) {
        // eslint-disable-next-line no-await-in-loop
        await apiPost<{ updated: number }>(`/events/${eventId}/submissions/status`, { ids: batch, status });
        completed += 1;
      }
      setSelection((s) => selectionReducer(s, { type: 'CLEAR' }));
    } catch (err) {
      // DEC-193: batches already committed on the server must not be
      // visually rolled back. Refetch server truth instead of restoring
      // the stale pre-update snapshot.
      const message = err instanceof ApiError ? err.message : 'unknown error';
      setError(`Bulk status update failed after ${completed} of ${batches.length} batches: ${message}`);
      setRefreshToken((n) => n + 1);
    } finally {
      setBulkPending(false);
    }
  }

  // Phone-width per-row triage (docs/mandates/SYNTHESIS.md Tier 3: 'phone
  // triage actions GONE'). Mirrors Overview.tsx's handleTriageAction mapping
  // (Accept -> accepted, Decline -> declined, Waitlist -> accept_queue) and
  // applyBulkStatus's optimistic-update / loud-rollback shape, but against a
  // single id via the same POST /submissions/status endpoint.
  async function applyRowTriage(id: string, status: SubmissionStatus) {
    if (!eventId) return;
    setTriagingId(id);
    setError(null);
    const previous = items;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    try {
      await apiPost<{ updated: number }>(`/events/${eventId}/submissions/status`, { ids: [id], status });
    } catch (err) {
      setItems(previous);
      setError(err instanceof ApiError ? `Status update failed: ${err.message}` : 'Status update failed');
    } finally {
      setTriagingId(null);
    }
  }

  if (!eventId) {
    return (
      <div className="chq-page">
        <h1 className="chq-page-title">Submissions</h1>
        <div className="chq-attention-frame">No event selected. Append ?eventId=&lt;id&gt; to the URL.</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-submissions-page">
      <div className="chq-submissions-head">
        <div className="chq-submissions-head-titles">
          <h1 className="chq-page-title">Submissions</h1>
          <span className="chq-summary">{total} total</span>
        </div>
        <div className="chq-submissions-head-actions">
          <button type="button" className="chq-btn chq-btn-primary" onClick={() => setShowNewModal(true)}>
            New submission
          </button>
        </div>
      </div>

      {error && <div className="chq-error">{error}</div>}

      {showNewModal && (
        <NewSubmissionModal
          tracks={tracks}
          formatField={findFormatField(formFields)}
          onCancel={() => setShowNewModal(false)}
          onCreate={createSubmission}
        />
      )}

      <div className="chq-submissions-toolbar">
        <div className="chq-submissions-toolbar-row">
          <ViewsDropdown
            eventId={eventId}
            filters={filters}
            visibleFieldIds={visibleFieldIds}
            onApply={applySavedView}
          />
          <FilterBar filters={filters} tracks={tracks} onChange={setFilters} />
        </div>
        <div className="chq-submissions-status-row">
          <span className="chq-submissions-status-label">Columns</span>
          <ColumnPicker
            columns={columns}
            visibleFieldIds={visibleFieldIds}
            onToggle={(fieldId) => {
              setPickerInitialized(true);
              setVisibleFieldIds((prev) => {
                const next = new Set(prev);
                if (next.has(fieldId)) next.delete(fieldId);
                else next.add(fieldId);
                return next;
              });
            }}
          />
        </div>
      </div>

      <BulkActionBar
        selectedCount={selection.selectedIds.size}
        pending={bulkPending}
        onApply={applyBulkStatus}
        onClear={() => setSelection((s) => selectionReducer(s, { type: 'CLEAR' }))}
      />

      <div className="chq-submissions-table-wrap">
        <table className="chq-table chq-submissions-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  className="chq-check"
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
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="chq-submissions-loading" colSpan={9 + shownColumns.length}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td className="chq-submissions-empty" colSpan={9 + shownColumns.length}>
                  No submissions match the current filters.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="chq-check"
                      aria-label={`Select ${item.ref}`}
                      checked={selection.selectedIds.has(item.id)}
                      onChange={() => setSelection((s) => selectionReducer(s, { type: 'TOGGLE_ROW', id: item.id }))}
                    />
                  </td>
                  <td className="chq-submissions-table-ref">{item.ref}</td>
                  <td>
                    <Link to={`/submissions/${item.id}`} className="chq-submissions-table-title">
                      {item.title}
                    </Link>
                  </td>
                  <td>{item.speakers.map((s) => s.name).join(', ')}</td>
                  <td className="chq-submissions-table-muted">{trackNames(item.trackIds, tracks)}</td>
                  <td>
                    <span className={`chq-flag chq-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
                  </td>
                  <td className="chq-submissions-table-muted">{formatDate(item.submittedAt)}</td>
                  {shownColumns.map((col) => (
                    <td key={col.fieldId}>{formatAnswerValue(item.answers?.[col.fieldId])}</td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="chq-submissions-clone"
                      disabled={cloningId === item.id}
                      onClick={() => cloneSubmission(item.id)}
                    >
                      Clone
                    </button>
                  </td>
                  <td>
                    {item.status === 'pending' && (
                      <div className="chq-submissions-row-triage" role="group" aria-label={`Triage ${item.ref}`}>
                        <button
                          type="button"
                          className="chq-btn chq-btn-primary"
                          disabled={triagingId === item.id}
                          onClick={() => applyRowTriage(item.id, 'accepted')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="chq-btn chq-btn-secondary"
                          disabled={triagingId === item.id}
                          onClick={() => applyRowTriage(item.id, 'declined')}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="chq-btn chq-btn-tertiary"
                          disabled={triagingId === item.id}
                          onClick={() => applyRowTriage(item.id, 'accept_queue')}
                        >
                          Waitlist
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="chq-submissions-pagination">
        <span className="chq-submissions-pagination-summary">
          Page {filters.page} &middot; {total} total
        </span>
        <div className="chq-submissions-pagination-actions">
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
          >
            Previous
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={filters.page * filters.perPage >= total}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
