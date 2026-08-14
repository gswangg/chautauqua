import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DeliverableDetail } from './DeliverableDetail';
import { FilesLibrary } from './FilesLibrary';
import { SessionList } from './SessionList';
import { DelayedLoading } from '../../components/DelayedLoading';
import { PageSkeleton } from '../../components/PageSkeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { type ContentStatus, type ContentSubmissionListItem } from './types';
import { WORKLIST_TAB_CONTENT_STATUS, WORKLIST_TABS, type WorklistTab } from './worklist';

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

// DEC-881: default tab is 'needs_decision' per the mock — this narrows
// DEC-665, whose 'all' default existed only to avoid landing on a "0
// submissions" screen. That concern is now answered by copy instead of by
// defaulting away from the frame: SessionList's needs_decision empty state
// links back to All (see SessionList.tsx), so an event with nothing
// currently needing a decision still reads honestly rather than blankly.
const DEFAULT_WORKLIST_TAB: WorklistTab = 'needs_decision';

/** J8 content review loop entry point: worklist -> per-session deliverable detail. */
export function ContentApp() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // DEC-935: the id is a route param (/content/:submissionId), not a
  // ?submissionId= query param -- /content itself carries no param, so
  // this reads as undefined there.
  const { submissionId: routeSubmissionId } = useParams<{ submissionId: string }>();
  const submissionId = routeSubmissionId ?? null;
  // DEC-881: defaults to 'needs_decision' — see DEFAULT_WORKLIST_TAB above.
  const tab = (searchParams.get('tab') as WorklistTab | null) ?? DEFAULT_WORKLIST_TAB;
  const view = (searchParams.get('view') as ContentView | null) ?? 'worklist';
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [items, setItems] = useState<ContentSubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-913: chip counts + the 're-uploaded' headline are ONE grouped
  // aggregate riding the SAME response as the worklist rows (see
  // loadWorklist below) — no per-tab/per-chip fetch. contentStatusCounts is
  // keyed by contentStatus and unaffected by the active tab's own narrowing
  // (server strips that narrowing before grouping), so switching tabs never
  // moves these numbers.
  const [contentStatusCounts, setContentStatusCounts] = useState<{
    pending: number;
    approved: number;
    changes_requested: number;
  } | null>(null);
  // w1-f (DEC-733/eval 60/37): the mock's header reads 'N need a decision ·
  // M re-uploaded' regardless of which tab is active.
  const [reUploadedCount, setReUploadedCount] = useState<number | null>(null);

  // DEC-913: derives a tab's chip count from the single contentStatusCounts
  // aggregate by reading the SAME WORKLIST_TAB_CONTENT_STATUS entry the
  // tab's own list filter reads (DEC-825's single predicate owner) —
  // summing its comma-separated statuses, or the full total for 'all'.
  const counts: Record<WorklistTab, number | null> = Object.fromEntries(
    WORKLIST_TABS.map((t) => {
      if (!contentStatusCounts) return [t, null];
      const filter = WORKLIST_TAB_CONTENT_STATUS[t];
      if (!filter) {
        return [t, contentStatusCounts.pending + contentStatusCounts.approved + contentStatusCounts.changes_requested];
      }
      const sum = filter
        .split(',')
        .reduce((acc, status) => acc + (contentStatusCounts[status as keyof typeof contentStatusCounts] ?? 0), 0);
      return [t, sum];
    }),
  ) as Record<WorklistTab, number | null>;

  // DEC-825 amendment: set-based bulk content-approval selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  // w42-c/DEC-825 amendment (wave 72): "Approve N ready" — every row on the
  // CURRENT worklist page whose contentStatus isn't already 'approved',
  // independent of the row-selection bulk bar above (no selection
  // required). Rendered as a section action on the worklist's own rule
  // (SessionList), not the title row.
  const [showApproveReadyConfirm, setShowApproveReadyConfirm] = useState(false);
  const [approveReadyPending, setApproveReadyPending] = useState(false);
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
    // DEC-825: the tab's contentStatus filter is read from the same map the
    // chip counts read from, so the list and its own chip's count can never
    // disagree on what the tab means.
    const tabStatusFilter = WORKLIST_TAB_CONTENT_STATUS[tab];
    if (tabStatusFilter) params.set('contentStatus', tabStatusFilter);
    apiList<ContentSubmissionListItem>(`/events/${eventId}/submissions?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        // DEC-913: the same response carries the grouped chip/headline
        // counts — no separate count fetch.
        setContentStatusCounts(res.contentStatusCounts ?? null);
        setReUploadedCount(res.reuploadedCount ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
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

  // A page/tab change means the visible row set changed under the
  // selection — clear it rather than carrying stale ids across views.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, page]);

  function selectSubmission(id: string) {
    // DEC-935: the id travels in the path (/content/:submissionId);
    // ?tab=/?view=/?page= worklist state carries over unchanged so
    // backToWorklist lands where the row was opened from.
    navigate({ pathname: `/content/${id}`, search: searchParams.toString() });
  }

  function backToWorklist() {
    navigate({ pathname: '/content', search: searchParams.toString() });
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
      // DEC-913: loadWorklist's own response carries the chip/headline
      // counts — no separate refresh needed.
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
      // DEC-913: refresh the worklist so its response's grouped counts pick
      // up the change — no standalone count fetch to call instead.
      loadWorklist();
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

  // w42-c: ready-to-approve rows on the current worklist page.
  const notApprovedIds = items.filter((item) => item.contentStatus !== 'approved').map((item) => item.id);

  async function confirmApproveReady() {
    if (!eventId || notApprovedIds.length === 0) return;
    setError(null);
    setApproveReadyPending(true);
    try {
      await apiPost(`/events/${eventId}/submissions/content-status`, {
        ids: notApprovedIds,
        contentStatus: 'approved',
      });
      setShowApproveReadyConfirm(false);
      loadWorklist();
    } catch (err) {
      setError(err instanceof ApiError ? `Approve failed: ${err.message}` : 'Approve failed');
    } finally {
      setApproveReadyPending(false);
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page chq-measure-table">
        <h1 className="chq-page-title">Content</h1>
        <PageSkeleton variant="table" label="Loading event…" />
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="chq-page chq-measure-table">
        <h1 className="chq-page-title">Content</h1>
        <div className="chq-error">{eventError ?? 'No event selected. Append ?eventId=<id> to the URL.'}</div>
      </div>
    );
  }

  const selected: SubmissionLookup | undefined =
    worklistMatch ?? (submissionId && fetchedSubmissionId === submissionId ? (fetchedSubmission ?? undefined) : undefined);

  // DEC-952 (one <h1> per state, innermost owner): ContentApp names the
  // page only where no child view mounts its own heading — the worklist
  // (view === 'files' hands the title to FilesLibrary) and the
  // submissionId states that haven't resolved to a DeliverableDetail yet
  // (loading / not-found / unresolved). Once selected resolves,
  // DeliverableDetail owns the <h1>.
  const showOwnHeading = submissionId ? !selected : view !== 'files';

  return (
    <div className="chq-page chq-content-page chq-measure-table">
      {(showOwnHeading || !submissionId) && (
        <div className="chq-content-summary-row">
          {showOwnHeading && <h1 className="chq-page-title">Content</h1>}
          {/* w1-f (DEC-733/eval 60/37): decision-framing copy, matching the
              mock's header text ('N need a decision · M re-uploaded') —
              withheld (not '0 · 0') until both aggregate reads resolve, per
              DEC-665's "never assert a fact not yet measured". */}
          {!submissionId && view === 'worklist' && counts.needs_decision !== null && reUploadedCount !== null && (
            <span className="chq-summary">
              {counts.needs_decision} need a decision &middot; {reUploadedCount} re-uploaded
            </span>
          )}
          {/* w41-b (DEC-902 amendment): Worklist/Files are destinations, not
              tabs of one surface — the toolbar's role=tablist pills are gone;
              the title row carries the one button that switches destination
              (named for where it goes, not where you are) plus Refresh. */}
          {!submissionId && (
            <div className="chq-content-summary-actions">
              {view === 'worklist' ? (
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => changeView('files')}>
                  All files
                </button>
              ) : (
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => changeView('worklist')}>
                  Worklist
                </button>
              )}
              <button type="button" className="chq-btn chq-btn-secondary" aria-label="Refresh" onClick={refresh}>
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
      {error && <div className="chq-error" role="alert">{error}</div>}

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
      ) : submissionId && submissionFetchLoading ? (
        <DelayedLoading label="Loading submission…" />
      ) : submissionId && submissionFetchError ? (
        <div className="chq-error" role="alert">
          {submissionFetchError === 'not_found' ? 'Submission not found.' : 'Failed to load submission.'}
        </div>
      ) : submissionId ? (
        // A submissionId is present but not yet resolved (fetch not yet
        // kicked off / in flight before submissionFetchLoading is set) —
        // never fall through to the list view underneath it.
        <DelayedLoading label="Loading submission…" />
      ) : view === 'files' ? (
        <FilesLibrary
          key={filesReloadKey}
          eventId={eventId}
          onSelectSubmission={selectSubmission}
          onBack={() => changeView('worklist')}
        />
      ) : (
        <SessionList
          items={items}
          tab={tab}
          onTabChange={changeTab}
          onSelect={selectSubmission}
          loading={loading}
          loaded={loaded}
          onContentStatusChange={requestContentStatus}
          total={total}
          page={page}
          perPage={PER_PAGE}
          onPageChange={changePage}
          now={Date.now()}
          counts={counts}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          // DEC-825 amendment (wave 72): 'Approve N ready' leaves the title
          // row and becomes a section action on the worklist's own rule
          // (house link-on-the-rule treatment) — same page-scoped
          // notApprovedIds set, same confirm dialog, just relocated so an
          // event-wide write isn't the most prominent element on a scanning
          // surface.
          approveReady={notApprovedIds.length > 0 ? { count: notApprovedIds.length, onOpen: () => setShowApproveReadyConfirm(true) } : null}
        />
      )}
      {showApproveReadyConfirm && (
        <ConfirmDialog
          title={`Approve ${notApprovedIds.length} ready`}
          body="Unapproved sessions stay off the public site."
          confirmLabel={`Approve ${notApprovedIds.length}`}
          pending={approveReadyPending}
          onConfirm={confirmApproveReady}
          onCancel={() => setShowApproveReadyConfirm(false)}
        />
      )}
    </div>
  );
}
