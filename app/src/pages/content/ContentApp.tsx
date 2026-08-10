import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DeliverableDetail } from './DeliverableDetail';
import { FilesLibrary } from './FilesLibrary';
import { SessionList } from './SessionList';
import { DELIVERABLE_KINDS, type ContentStatus, type ContentSubmissionListItem, type DeliverableFile } from './types';
import type { WorklistTab } from './worklist';

type ContentView = 'worklist' | 'files';

/** J8 content review loop entry point: worklist -> per-session deliverable detail. */
export function ContentApp() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get('submissionId');
  const tab = (searchParams.get('tab') as WorklistTab | null) ?? 'changes_requested';
  const view = (searchParams.get('view') as ContentView | null) ?? 'worklist';

  const [items, setItems] = useState<ContentSubmissionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorklist = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    apiList<ContentSubmissionListItem>(`/events/${eventId}/submissions`)
      .then(async (res) => {
        setItems(res.items);
        // Fill in per-kind deliverable/version counts by composing the
        // DEC-020 per-submission files endpoint (no bulk-counts endpoint
        // exists on the submissions list).
        const withCounts = await Promise.all(
          res.items.map(async (item) => {
            try {
              const files = await apiList<DeliverableFile>(`/submissions/${item.id}/files`);
              const counts: Partial<Record<(typeof DELIVERABLE_KINDS)[number], number>> = {};
              for (const kind of DELIVERABLE_KINDS) {
                counts[kind] = files.items.filter((f) => f.kind === kind).length;
              }
              return { ...item, deliverableCounts: counts };
            } catch {
              return item;
            }
          }),
        );
        setItems(withCounts);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    loadWorklist();
  }, [loadWorklist]);

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
  }

  function changeTab(next: WorklistTab) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', next);
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
        <h1>Content</h1>
        <p>Loading event...</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="chq-page">
        <h1>Content</h1>
        <div className="chq-attention-frame">{eventError ?? 'No event selected. Append ?eventId=<id> to the URL.'}</div>
      </div>
    );
  }

  const selected = submissionId ? items.find((i) => i.id === submissionId) : undefined;

  return (
    <div className="chq-page chq-content-page">
      <h1>Content</h1>
      {error && <div className="chq-error-banner">{error}</div>}

      {!submissionId && (
        <div className="chq-tab-bar" role="tablist" aria-label="Content view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'worklist'}
            className={view === 'worklist' ? 'chq-tab active' : 'chq-tab'}
            onClick={() => changeView('worklist')}
          >
            Worklist
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'files'}
            className={view === 'files' ? 'chq-tab active' : 'chq-tab'}
            onClick={() => changeView('files')}
          >
            Files
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
        />
      ) : view === 'files' ? (
        <FilesLibrary eventId={eventId} onSelectSubmission={selectSubmission} />
      ) : (
        <SessionList
          items={items}
          tab={tab}
          onTabChange={changeTab}
          onSelect={selectSubmission}
          loading={loading}
          onContentStatusChange={requestContentStatus}
        />
      )}
    </div>
  );
}
