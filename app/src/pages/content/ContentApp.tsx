import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DeliverableDetail } from './DeliverableDetail';
import { SessionList } from './SessionList';
import { DELIVERABLE_KINDS, type ContentStatus, type ContentSubmissionListItem, type DeliverableFile } from './types';
import type { WorklistTab } from './worklist';

/** J8 content review loop entry point: worklist -> per-session deliverable detail. */
export function ContentApp() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get('submissionId');
  const tab = (searchParams.get('tab') as WorklistTab | null) ?? 'changes_requested';

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

  function onContentStatusChange(id: string, status: ContentStatus) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, contentStatus: status } : item)));
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

      {submissionId && selected ? (
        <DeliverableDetail
          submissionId={selected.id}
          title={selected.title}
          contentStatus={selected.contentStatus}
          onBack={backToWorklist}
          onContentStatusChange={onContentStatusChange}
        />
      ) : (
        <SessionList items={items} tab={tab} onTabChange={changeTab} onSelect={selectSubmission} loading={loading} />
      )}
    </div>
  );
}
