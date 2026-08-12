import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DeliverableDetail } from './DeliverableDetail';
import { FilesLibrary } from './FilesLibrary';
import { SessionList, TAB_LABELS } from './SessionList';
import { type ContentStatus, type ContentSubmissionListItem } from './types';
import { WORKLIST_TABS, type WorklistTab } from './worklist';

// CNT-D1: shape carried by GET /api/v1/submissions/:id (SubmissionDetail in
// src/server/repo/submissions/detail.ts) — only the fields DeliverableDetail
// actually needs, since a submission opened from the Files library is almost
// never present in the current worklist page.
interface SubmissionLookup {
  id: string;
  title: string;
  contentStatus: ContentStatus;
}

type ContentView = 'worklist' | 'files';

const PER_PAGE = 50;

// w11-e (DEC-665): WORKLIST_TABS[0] is 'all' -- named here (rather than
// indexed inline) since noUncheckedIndexedAccess types a bare array index
// as possibly undefined.
const DEFAULT_WORKLIST_TAB: WorklistTab = WORKLIST_TABS[0] ?? 'all';

/** J8 content review loop entry point: worklist -> per-session deliverable detail. */
export function ContentApp() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get('submissionId');
  // w11-e: default to the unfiltered worklist (DEC-665) — opening on
  // 'changes_requested' reads '0 submissions' on a populated event whenever
  // nothing needs changes yet; needs-decision stays one click away via the
  // tab row.
  const tab = (searchParams.get('tab') as WorklistTab | null) ?? DEFAULT_WORKLIST_TAB;
  const view = (searchParams.get('view') as ContentView | null) ?? 'worklist';
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [items, setItems] = useState<ContentSubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // CNT-D1: the worklist's current page almost never contains the submission
  // a Files-library click resolves to (different sort, different tab filter,
  // possibly a different page) — so a submissionId not in `items` must be
  // fetched directly rather than silently falling through to the list.
  const [fetchedSubmission, setFetchedSubmission] = useState<SubmissionLookup | null>(null);
  const [fetchedSubmissionId, setFetchedSubmissionId] = useState<string | null>(null);
  const [submissionFetchLoading, setSubmissionFetchLoading] = useState(false);
  const [submissionFetchError, setSubmissionFetchError] = useState<'not_found' | 'other' | null>(null);

  const worklistMatch = submissionId ? items.find((i) => i.id === submissionId) : undefined;

  useEffect(() => {
    if (!submissionId || worklistMatch) return;
    if (fetchedSubmissionId === submissionId) return;
    setSubmissionFetchLoading(true);
    setSubmissionFetchError(null);
    apiGet<SubmissionLookup>(`/submissions/${submissionId}`)
      .then((detail) => {
        setFetchedSubmission(detail);
        setFetchedSubmissionId(submissionId);
      })
      .catch((err) => {
        setFetchedSubmission(null);
        setFetchedSubmissionId(submissionId);
        setSubmissionFetchError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'other');
      })
      .finally(() => setSubmissionFetchLoading(false));
  }, [submissionId, worklistMatch, fetchedSubmissionId]);

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

  const selected: SubmissionLookup | undefined =
    worklistMatch ?? (submissionId && fetchedSubmissionId === submissionId ? (fetchedSubmission ?? undefined) : undefined);

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

      {submissionId && selected ? (
        <DeliverableDetail
          submissionId={selected.id}
          title={selected.title}
          contentStatus={selected.contentStatus}
          onBack={backToWorklist}
          onContentStatusChange={onContentStatusChange}
          onUploaded={() => setFilesReloadKey((k) => k + 1)}
        />
      ) : submissionId && submissionFetchLoading ? (
        <p>Loading submission...</p>
      ) : submissionId && submissionFetchError ? (
        <div className="chq-error" role="alert">
          {submissionFetchError === 'not_found' ? 'Submission not found.' : 'Failed to load submission.'}
        </div>
      ) : submissionId ? (
        // A submissionId is present but not yet resolved (fetch not yet
        // kicked off / in flight before submissionFetchLoading is set) —
        // never fall through to the list view underneath it.
        <p>Loading submission...</p>
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
        />
      )}
    </div>
  );
}
