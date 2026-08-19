import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
// DEC-755: createSubmission below no longer needs a follow-up apiPatch call
// now that trackIds/format ride the create POST body directly.
import { apiList, apiGet, ApiError, apiPost } from '../../lib/api';
import { useCachedList } from '../../lib/useCachedRead';
import { formatDate, formatDateOnly } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { BulkActionBar } from './BulkActionBar';
import { chunkSelection } from './bulk';
import { deriveColumnsFromFormFields, findFormatField, visibleColumns, type ColumnDef } from './columns';
import { answerDisplayText } from '../../../../src/domain/answer-text';
import { formatFormatLabel } from '../../lib/formatLabel';
import { FilterBar, FilterBarSearchSort } from './FilterBar';
import { buildSubmissionsQuery } from './filters';
import { NewSubmissionModal, type NewSubmissionInput } from './NewSubmissionModal';
import { paginationSummary } from '../../lib/pagination-summary';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
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
import { ViewTabs } from './ViewTabs';

/** DEC-243: render track NAMES, not the raw count of trackIds. */
function trackNames(trackIds: string[], tracks: Track[]): string {
  if (trackIds.length === 0) return '—';
  const byId = new Map(tracks.map((t) => [t.id, t.name]));
  return trackIds.map((id) => byId.get(id) ?? id).join(', ');
}

/** DEC-678 amendment (B7, wave 46): which of the query's narrowing facets
 * (q, status, trackId -- the only facets this filter state carries; a saved
 * view is just one of these three set from a preset) is the one to blame
 * for an empty result set, and what clearing exactly that facet (and no
 * other) looks like. Checked in a fixed priority order -- search first, then
 * status, then track -- so a query with more than one facet in flight still
 * names ONE reason and offers ONE escape, never a list. Returns null when no
 * facet narrows the query at all (the 'fresh' case). */
function describeActiveFacet(
  filters: SubmissionsFilterState,
  tracks: Track[],
): { reason: string; cleared: SubmissionsFilterState } | null {
  if (filters.q.trim().length > 0) {
    return {
      reason: `Search "${filters.q.trim()}" doesn't match any submissions.`,
      cleared: { ...filters, q: DEFAULT_FILTER_STATE.q, page: DEFAULT_FILTER_STATE.page },
    };
  }
  if (filters.status.length > 0) {
    return {
      reason: 'The selected status filter excludes every submission.',
      cleared: { ...filters, status: DEFAULT_FILTER_STATE.status, page: DEFAULT_FILTER_STATE.page },
    };
  }
  if (filters.trackId) {
    const trackName = tracks.find((t) => t.id === filters.trackId)?.name ?? 'this track';
    return {
      reason: `No submissions are in ${trackName}.`,
      cleared: { ...filters, trackId: DEFAULT_FILTER_STATE.trackId, page: DEFAULT_FILTER_STATE.page },
    };
  }
  return null;
}

/** DEC-649: the CSV export sits beside a filtered table, so it must carry
 * the same filter query string as the list -- minus page/perPage, which
 * describe a page of the SPA's table, not the export. */
export function exportHref(eventId: string, filters: SubmissionsFilterState): string {
  const params = new URLSearchParams(buildSubmissionsQuery(filters));
  params.delete('page');
  params.delete('perPage');
  params.set('format', 'csv');
  return `/api/v1/events/${eventId}/export/submissions?${params.toString()}`;
}

export function SubmissionsTable() {
  const { eventId } = useCurrentEvent();

  const [filters, setFilters] = useState<SubmissionsFilterState>({ ...DEFAULT_FILTER_STATE, includeAnswers: true });
  // null while in flight or on failure -- never a fabricated number.
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  // G13 lane-D (02-submissions--08/09): the CFP's open date (fresh empty
  // state) and the event's unfiltered submission count (triage-cleared
  // state) -- both null until their reads resolve.
  const [formOpenDate, setFormOpenDate] = useState<number | null>(null);
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [visibleFieldIds, setVisibleFieldIds] = useState<Set<string>>(new Set());
  // DEC-243: has the picker state been established yet, either by the user
  // toggling a column, or by applying a saved view? Until then, the Format
  // column (if the form has one) is auto-shown on first load.
  const [pickerInitialized, setPickerInitialized] = useState(false);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const columns: ColumnDef[] = useMemo(() => deriveColumnsFromFormFields(formFields), [formFields]);
  const shownColumns = useMemo(() => visibleColumns(columns, visibleFieldIds), [columns, visibleFieldIds]);
  // DEC-743 amendment (wave 4): the Format column's raw "Talk (30 min)"
  // answer runs through the ONE formatLabel formatter (abbreviated, to fit
  // the table's dense column width) instead of printing the server's
  // verbatim parenthetical.
  const formatFieldId = useMemo(() => findFormatField(formFields)?.id, [formFields]);

  useEffect(() => {
    if (!eventId) return;
    // GET /events/:id/forms returns the default form OBJECT (not a list); its
    // custom columns come from the form's own `fields` array.
    apiGet<{ fields: FormField[]; openDate: number | null }>(`/events/${eventId}/forms`)
      .then((res) => {
        setFormFields(res.fields ?? []);
        // G13 lane-D (02-submissions--08): the fresh empty state's reason
        // line states when the CFP opens -- read off the same form object,
        // never fabricated.
        setFormOpenDate(res.openDate ?? null);
      })
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

  // D21 (DEC_678/DEC_518/DEC_024): the main list's own path, memoised over
  // exactly the facets that change it -- null while inert (no eventId),
  // preserving today's `if (!eventId) return;` behaviour exactly.
  const submissionsPath = useMemo(() => {
    if (!eventId) return null;
    return `/events/${eventId}/submissions${buildSubmissionsQuery(filters)}`;
  }, [eventId, filters]);
  const submissions = useCachedList<SubmissionListItem>(submissionsPath, 'Failed to load submissions');
  const items = submissions.data?.items ?? [];
  const total = submissions.data?.total ?? 0;

  // D21: `items` is now a cache-derived value with no local setter, so the
  // row/bulk triage actions' optimistic flip (and loud rollback-on-failure)
  // are re-expressed as a thin display-only overlay keyed by id, cleared as
  // soon as either the write settles (success) or fails (letting the
  // cache-derived row show again, which for a single-row failure IS the old
  // setItems(previous) rollback since nothing on the server actually
  // changed).
  const [statusOverrides, setStatusOverrides] = useState<Map<string, SubmissionStatus>>(new Map());
  const displayItems = useMemo(
    () =>
      statusOverrides.size === 0
        ? items
        : items.map((item) => (statusOverrides.has(item.id) ? { ...item, status: statusOverrides.get(item.id)! } : item)),
    [items, statusOverrides],
  );

  // Second, independent parallel fetch for the head summary's "N awaiting
  // triage" figure -- a count of status='pending' regardless of the current
  // filters, not derived from the (possibly filtered) main list above.
  useEffect(() => {
    if (!eventId) return;
    apiList<SubmissionListItem>(`/events/${eventId}/submissions?status=pending&perPage=1`)
      .then((res) => setPendingTotal(res.total))
      .catch(() => setPendingTotal(null));
    // G13 lane-D (02-submissions--09): the triage-cleared state asserts
    // "All N submissions have a decision" -- N is the UNFILTERED count,
    // which no other fetch on this page carries.
    apiList<SubmissionListItem>(`/events/${eventId}/submissions?perPage=1`)
      .then((res) => setAllTotal(res.total))
      .catch(() => setAllTotal(null));
  }, [eventId, refreshToken]);

  const pageIds = displayItems.map((item) => item.id);

  // D21: one funnel refreshes both the counts effect (:185, keyed on
  // refreshToken) and the cached main list (useCachedList's own
  // mutationVersion re-read is not triggered by refreshToken, so the
  // explicit refetch is still required here).
  function reloadSubmissions() {
    setRefreshToken((n) => n + 1);
    void submissions.refetch();
  }

  function applySavedView(config: SavedViewConfig) {
    const { filters: nextFilters, visibleFieldIds: nextVisible } = applyViewConfig(config);
    setFilters(nextFilters);
    setVisibleFieldIds(nextVisible);
    setPickerInitialized(true);
  }

  async function createSubmission(input: NewSubmissionInput) {
    if (!eventId) return;
    // DEC-755: trackIds and format ride the create POST directly (ONE
    // writer per DEC-717 on the server side — no follow-up PATCH needed).
    await apiPost<{ id: string }>(`/events/${eventId}/submissions`, {
      title: input.title,
      description: input.description || null,
      contact: input.contact,
      trackIds: input.trackIds,
      ...(input.format ? { format: input.format } : {}),
    });
    setShowNewModal(false);
    reloadSubmissions();
  }

  async function cloneSubmission(id: string) {
    setCloningId(id);
    setError(null);
    try {
      const result = await apiPost<{ droppedFileAnswers: number }>(`/submissions/${id}/clone`);
      reloadSubmissions();
      if (result.droppedFileAnswers > 0) {
        const noun = result.droppedFileAnswers === 1 ? 'file answer was' : 'file answers were';
        setToast(`Copied. ${result.droppedFileAnswers} ${noun} not copied — uploads stay with the original session.`);
      }
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
    // D21: `items` has no local setter anymore -- the optimistic update is
    // a display-only overlay (see statusOverrides above), cleared on both
    // success and failure. DEC-193: on failure, batches already committed
    // must not be visually rolled back -- clearing the overlay and calling
    // reloadSubmissions() lets the cache's own refetch supply server truth
    // rather than restoring the stale pre-update snapshot.
    setStatusOverrides((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.set(id, status);
      return next;
    });
    const batches = chunkSelection(ids);
    let completed = 0;
    try {
      for (const batch of batches) {
        // eslint-disable-next-line no-await-in-loop
        await apiPost<{ updated: number }>(`/events/${eventId}/submissions/status`, { ids: batch, status });
        completed += 1;
      }
      setSelection((s) => selectionReducer(s, { type: 'CLEAR' }));
      setStatusOverrides((prev) => {
        const next = new Map(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    } catch (err) {
      setStatusOverrides((prev) => {
        const next = new Map(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      const message = err instanceof ApiError ? err.message : 'unknown error';
      setError(`Bulk status update failed after ${completed} of ${batches.length} batches: ${message}`);
      reloadSubmissions();
    } finally {
      setBulkPending(false);
    }
  }

  // Phone-width per-row triage (docs/mandates/SYNTHESIS.md Tier 3: 'phone
  // triage actions GONE'). Mirrors Overview.tsx's handleTriageAction mapping
  // (Accept -> accepted, Decline -> declined, Waitlist -> accept_queue), but
  // against a single id via the same POST /submissions/status endpoint. D21:
  // no client-side optimistic mutation -- `items` is derived from the
  // cache, and the apiPost below bumps mutationVersion on resolve, which
  // reconciles the row from server truth (DEC-518's replace-wholesale) with
  // no rollback branch needed.
  async function applyRowTriage(id: string, status: SubmissionStatus) {
    if (!eventId) return;
    setTriagingId(id);
    setError(null);
    setStatusOverrides((prev) => new Map(prev).set(id, status));
    try {
      await apiPost<{ updated: number }>(`/events/${eventId}/submissions/status`, { ids: [id], status });
      setStatusOverrides((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      // Nothing changed on the server -- dropping the overlay entry lets
      // the cache-derived row show again, which for a single id IS the old
      // setItems(previous) rollback.
      setStatusOverrides((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setError(err instanceof ApiError ? `Status update failed: ${err.message}` : 'Status update failed');
    } finally {
      setTriagingId(null);
    }
  }

  if (!eventId) {
    return (
      <div className="chq-page chq-measure-table">
        <h1 className="chq-page-title">Submissions</h1>
        <div className="chq-attention-frame">No event selected. Append ?eventId=&lt;id&gt; to the URL.</div>
      </div>
    );
  }

  // DEC-678 amendment (B7, wave 46): a real zero-row state, not the whole
  // <thead> parked over one message cell. 'filtered' (some facet excluded
  // every row) keeps the chrome above it; 'fresh' (no facet at all) drops
  // the chrome, column picker and pager entirely -- the page header's own
  // persistent "New submission" button already is the collection's one
  // primary action, so EmptyState renders no `action` of its own here
  // (a second identical button would break "exactly one primary action").
  const showEmpty = submissions.data !== undefined && items.length === 0;
  const activeFacet = showEmpty ? describeActiveFacet(filters, tracks) : null;
  const showChrome = !showEmpty || activeFacet !== null;
  // G13 lane-D fix (02-submissions--09): zero rows under ONLY the pending
  // status facet, with submissions on the event and none of them pending,
  // is the framed triage-cleared success state -- not a filter failure.
  const triageCleared =
    showEmpty &&
    filters.q.trim().length === 0 &&
    !filters.trackId &&
    filters.status.length === 1 &&
    filters.status[0] === 'pending' &&
    pendingTotal === 0 &&
    allTotal !== null &&
    allTotal > 0;

  return (
    <div className="chq-page chq-submissions-page chq-measure-table">
      <div className="chq-submissions-head">
        <div className="chq-submissions-head-titles">
          <h1 className="chq-page-title">Submissions</h1>
          {/* G13 lane-D fix (01-overview--06): the count appears once the
              list read resolves -- never '0 total' while rows are loading. */}
          {submissions.data !== undefined && (
            <span className="chq-summary">
              {total} total{pendingTotal !== null ? ` · ${pendingTotal} awaiting triage` : ''}
            </span>
          )}
        </div>
        <div className="chq-submissions-head-actions">
          <Link to="/submissions/forms" className="chq-btn chq-btn-secondary">
            Forms
          </Link>
          <a className="chq-btn chq-btn-secondary" download href={exportHref(eventId, filters)}>
            Export CSV
          </a>
          <button type="button" className="chq-btn chq-btn-primary" onClick={() => setShowNewModal(true)}>
            New submission
          </button>
        </div>
      </div>

      {(error ?? submissions.error) && <div className="chq-error">{error ?? submissions.error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {showNewModal && (
        <NewSubmissionModal
          tracks={tracks}
          formatField={findFormatField(formFields)}
          onCancel={() => setShowNewModal(false)}
          onCreate={createSubmission}
        />
      )}

      {showChrome && (
        <div className="chq-submissions-toolbar">
          <div className="chq-submissions-toolbar-row">
            <ViewTabs
              eventId={eventId}
              filters={filters}
              visibleFieldIds={visibleFieldIds}
              tracks={tracks}
              formFields={formFields}
              onApply={applySavedView}
            />
            <FilterBarSearchSort filters={filters} onChange={setFilters} />
          </div>
          <FilterBar
            filters={filters}
            tracks={tracks}
            columns={columns}
            visibleFieldIds={visibleFieldIds}
            onChange={setFilters}
            onToggleColumn={(fieldId) => {
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
      )}

      <BulkActionBar
        selectedCount={selection.selectedIds.size}
        pending={bulkPending}
        statusFilter={filters.status.length === 1 ? (filters.status[0] ?? null) : null}
        onApply={applyBulkStatus}
        onClear={() => setSelection((s) => selectionReducer(s, { type: 'CLEAR' }))}
        selectedIds={[...selection.selectedIds]}
      />

      {showEmpty ? (
        triageCleared ? (
          /* G13 lane-D fix (02-submissions--09, B7): the framed
             triage-cleared state -- a success report, not a filter failure.
             No escape link (clearing the filter is not the point) and the
             one action leads to the next queue. */
          <EmptyState
            variant="fresh"
            what="Nothing left to triage"
            reason={`All ${allTotal} submissions have a decision.`}
            secondary={{ label: 'Go to content ›', to: '/content' }}
          />
        ) : activeFacet ? (
          <EmptyState
            variant="filtered"
            what="No submissions match the current filters."
            reason={activeFacet.reason}
            escape={{ label: 'Clear filter', onClick: () => setFilters(activeFacet.cleared) }}
          />
        ) : (
          /* G13 lane-D fix (02-submissions--08, B7 rule 3): heading without
             the trailing period, the CFP-open reason when a date is set,
             and the frame's two actions. */
          <EmptyState
            variant="fresh"
            what="No submissions yet"
            reason={
              formOpenDate !== null && formOpenDate > Date.now()
                ? `The call for papers opens on ${formatDateOnly(formOpenDate)}. Anything submitted after that appears here for triage.`
                : undefined
            }
            action={{ label: 'Open the form now', to: '/submissions/forms' }}
            secondary={{ label: 'Add one by hand ›', onClick: () => setShowNewModal(true) }}
          />
        )
      ) : (
      <div className="chq-submissions-table-wrap">
        <table className="chq-table chq-submissions-table">
          <thead>
            <tr>
              <th className="chq-submissions-col-select">
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
              <th className="chq-submissions-col-ref">Ref</th>
              <th className="chq-submissions-col-title">Title</th>
              <th className="chq-submissions-col-speakers">Speakers</th>
              <th className="chq-submissions-col-track">Track</th>
              <th className="chq-submissions-col-status">Status</th>
              <th className="chq-submissions-col-sent">Sent</th>
              {shownColumns.map((col) => (
                <th key={col.fieldId} className="chq-submissions-col-custom">
                  {col.label}
                </th>
              ))}
              <th className="chq-submissions-col-clone"></th>
              <th className="chq-submissions-col-end"></th>
            </tr>
          </thead>
          <tbody>
            {submissions.loading && (
              <tr>
                <td className="chq-submissions-loading" colSpan={9 + shownColumns.length}>
                  <PageSkeleton variant="table" />
                </td>
              </tr>
            )}
            {!submissions.loading &&
              displayItems.map((item) => (
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
                    {/* DEC-761: the detail page re-derives its position from
                        the SAME filter/sort/page query the table used, so
                        the row link must carry that query string along —
                        the detail page must not depend on router state. */}
                    <Link
                      to={`/submissions/${item.id}${buildSubmissionsQuery(filters)}`}
                      className="chq-submissions-table-title"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td>{item.speakers.map((s) => s.name).join(', ')}</td>
                  <td className="chq-submissions-table-muted">{trackNames(item.trackIds, tracks)}</td>
                  <td>
                    {/* DEC-367: no per-status colour -- .chq-flag is the
                        whole of the type-only style; a per-value
                        chq-status-<status> modifier was dead weight (no
                        rule ever existed, and DEC-367 forbids adding one),
                        so it is dropped rather than given a rule (DEC-976). */}
                    <span className="chq-flag">{STATUS_LABELS[item.status]}</span>
                  </td>
                  <td className="chq-submissions-table-muted">{formatDate(item.submittedAt)}</td>
                  {shownColumns.map((col) => (
                    <td key={col.fieldId} className="chq-submissions-table-custom">
                      {col.fieldId === formatFieldId
                        ? formatFormatLabel(answerDisplayText(item.answers?.[col.fieldId]), { abbreviate: true })
                        : answerDisplayText(item.answers?.[col.fieldId])}
                    </td>
                  ))}
                  <td className="chq-submissions-table-clone-cell">
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
                        {/* DEC-610 amendment (v12 mobile campaign w1): the
                            phone card's third action is 'Read' -- a plain
                            navigation link to the detail page, not a status
                            write, so it carries no disabled/triagingId
                            wiring. Waitlist is removed from the card; it
                            remains reachable from the detail rail
                            (SubmissionDetailPage.tsx) and the bulk-action
                            bar (BulkActionBar.tsx). */}
                        <Link
                          to={`/submissions/${item.id}${buildSubmissionsQuery(filters)}`}
                          className="chq-btn chq-btn-secondary"
                        >
                          Read
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      )}

      {/* G13 lane-D fix (01-overview--06): no pagination summary while the
          list is still loading -- 'Showing 0 of 0' over a skeleton asserts
          a count not yet measured. */}
      {showChrome && submissions.data !== undefined && (
      <div className="chq-submissions-pagination">
        <span className="chq-submissions-pagination-summary">
          {paginationSummary(filters.page, filters.perPage, total)}
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
      )}
    </div>
  );
}
