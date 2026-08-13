import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DeliverableDetail } from './DeliverableDetail';
import { FilesLibrary } from './FilesLibrary';
import { SessionList, TAB_LABELS } from './SessionList';
import { type ContentStatus, type ContentSubmissionListItem } from './types';
import type { WorklistTab } from './worklist';

type ContentView = 'worklist' | 'files';

const PER_PAGE = 50;

/** J8 content review loop entry point: worklist -> per-session deliverable detail. */
export function ContentApp() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get('submissionId');
  const tab = (searchParams.get('tab') as WorklistTab | null) ?? 'changes_requested';
  const view = (searchParams.get('view') as ContentView | null) ?? 'worklist';
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [items, setItems] = useState<ContentSubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-825 amendment: set-based bulk content-approval selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  // w1-e: bumping this remounts FilesLibrary (its own load() effect keys on
  // eventId, not on time), which forces a fresh fetch — used on view
  // switch, the explicit Refresh button, and after a deliverable upload so
  // the library's version counts never go stale.
  const [filesReloadKey, setFilesReloadKey] = useState(0);

  // DEC-341: one server round trip per view — the list endpoint carries
  // deliverableCounts (chain roots, DEC-247) and applies the tab filter +
  // worklist sort server-side, so no client-side fan-out or re-filtering
  // of a single page is needed (SPEC §7).
  const loadWorklist = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('sort', 'worklist');
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    if (tab !== 'all') params.set('contentStatus', tab);
    apiList<ContentSubmissionListItem>(`/events/${eventId}/submissions?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [eventId, tab, page]);

  useEffect(() => {
    loadWorklist();
  }, [loadWorklist]);

  // A page/tab change means the visible row set changed under the
  // selection — clear it rather than carrying stale ids across views.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, page]);

  function selectSubmission(id: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('submissionId', id);
      return next;
    });
  }

  function backToWorklist() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('submissionId');
      return next;
    });
    // Whichever list we're returning to may be stale (e.g. an upload just
    // happened in DeliverableDetail) — reload it rather than trusting
    // first-mount data.
    if (view === 'files') {
      setFilesReloadKey((k) => k + 1);
    } else {
      loadWorklist();
    }
  }

  function refresh() {
    if (view === 'files') {
      setFilesReloadKey((k) => k + 1);
    } else {
      loadWorklist();
    }
  }

  function changeTab(next: WorklistTab) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', next);
      params.set('page', '1');
      return params;
    });
  }

  function changePage(next: number) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(next));
      return params;
    });
  }

  function changeView(next: ContentView) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('view', next);
      params.delete('submissionId');
      return params;
    });
    // Reload whichever list backs the view being switched to, so a
    // Worklist <-> Files toggle never surfaces data captured on first
    // mount (the "stale rows appeared 10 min later" P3).
    if (next === 'worklist') {
      loadWorklist();
    } else {
      setFilesReloadKey((k) => k + 1);
    }
  }

  function onContentStatusChange(id: string, status: ContentStatus) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, contentStatus: status } : item)));
  }

  // Row-level content-status control (CNT-12: the content-status endpoint
  // was previously only reachable by drilling into a submission's
  // deliverable detail). Optimistic with loud rollback, per SPEC §7.
  async function requestContentStatus(id: string, status: ContentStatus) {
    const previous = items;
    setError(null);
    onContentStatusChange(id, status);
    try {
      await apiPost(`/submissions/${id}/content-status`, { contentStatus: status });
    } catch (err) {
      setItems(previous);
      setError(err instanceof ApiError ? `Content status update failed: ${err.message}` : 'Content status update failed');
    }
  }

  // DEC-825 amendment: set-based bulk content-approval — approve, request
  // changes, or mark pending across every selected row in one round trip
  // (DEC-568's bulk write). Loud failure surfaced the same way
  // requestContentStatus's single-row rollback does; no optimistic update
  // here since a failed preflight leaves every row untouched server-side.
  async function bulkContentStatus(status: ContentStatus) {
    if (!eventId || selectedIds.size === 0) return;
    setError(null);
    setBulkPending(true);
    try {
      await apiPost(`/events/${eventId}/submissions/content-status`, {
        ids: [...selectedIds],
        contentStatus: status,
      });
      setSelectedIds(new Set());
      loadWorklist();
    } catch (err) {
      setError(err instanceof ApiError ? `Bulk content status update failed: ${err.message}` : 'Bulk content status update failed');
    } finally {
      setBulkPending(false);
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page">
        <h1 className="chq-page-title">Content</h1>
        <p>Loading event...</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="chq-page">
        <h1 className="chq-page-title">Content</h1>
        <div className="chq-error">{eventError ?? 'No event selected. Append ?eventId=<id> to the URL.'}</div>
      </div>
    );
  }

  const selected = submissionId ? items.find((i) => i.id === submissionId) : undefined;

  return (
    <div className="chq-page chq-content-page">
      <div className="chq-content-summary-row">
        <h1 className="chq-page-title">Content</h1>
        {!submissionId && (
          <span className="chq-summary">
            {total} {total === 1 ? 'submission' : 'submissions'} &middot; {TAB_LABELS[tab]} view
          </span>
        )}
      </div>
      {error && <div className="chq-error" role="alert">{error}</div>}

      {!submissionId && (
        <div className="chq-toolbar">
          <div className="chq-chipstrip" role="tablist" aria-label="Content view">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'worklist'}
              className={view === 'worklist' ? 'chq-pill is-active' : 'chq-pill'}
              onClick={() => changeView('worklist')}
            >
              Worklist
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'files'}
              className={view === 'files' ? 'chq-pill is-active' : 'chq-pill'}
              onClick={() => changeView('files')}
            >
              Files
            </button>
          </div>
          <button type="button" className="chq-btn chq-btn-secondary" aria-label="Refresh" onClick={refresh}>
            Refresh
          </button>
        </div>
      )}

      {!submissionId && view === 'worklist' && selectedIds.size > 0 && (
        <div className="chq-bulkbar" role="toolbar" aria-label="Bulk content actions">
          <span className="chq-bulkbar-count">{selectedIds.size} selected</span>
          <div className="chq-bulkbar-actions">
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={bulkPending}
              onClick={() => bulkContentStatus('approved')}
            >
              Approve
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={bulkPending}
              onClick={() => bulkContentStatus('changes_requested')}
            >
              Request changes
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={bulkPending}
              onClick={() => bulkContentStatus('pending')}
            >
              Mark pending
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={bulkPending}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {submissionId && selected ? (
        <DeliverableDetail
          submissionId={selected.id}
          title={selected.title}
          contentStatus={selected.contentStatus}
          onBack={backToWorklist}
          onContentStatusChange={onContentStatusChange}
          onUploaded={() => setFilesReloadKey((k) => k + 1)}
        />
      ) : view === 'files' ? (
        <FilesLibrary key={filesReloadKey} eventId={eventId} onSelectSubmission={selectSubmission} />
      ) : (
        <SessionList
          items={items}
          tab={tab}
          onTabChange={changeTab}
          onSelect={selectSubmission}
          loading={loading}
          onContentStatusChange={requestContentStatus}
          total={total}
          page={page}
          perPage={PER_PAGE}
          onPageChange={changePage}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}
    </div>
  );
}
