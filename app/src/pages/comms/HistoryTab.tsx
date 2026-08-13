import { useEffect, useState } from 'react';
import { apiList, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { RecentSends } from './RecentSends';
import type { EmailBatchRow, EmailTemplate } from './types';

// DEC-751: the batch-row + recipients-disclosure list moved into the shared
// RecentSends component (app/src/pages/comms/RecentSends.tsx); History
// fetches the full, paginated (unlimited/no `limit`) batch list and mounts
// RecentSends with no `onSeeAll`, so it keeps the recipients disclosure.
export function HistoryTab({ eventId }: { eventId: string }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EmailBatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-876 nit: a template-label for an opened send's detail. EmailBatchRow/
  // EmailLogListRow stay narrow (DEC-543) -- no templateId at list-row grain
  // -- but the per-row detail fetch (DEC-833) already returns templateId, so
  // this id->name map (fetched once, from the event's own template list) is
  // enough to label that detail once it's open, with no list-column widening
  // and no src/ change.
  const [templatesById, setTemplatesById] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('groupBy', 'batch');
    if (q.trim()) params.set('q', q.trim());
    apiList<EmailBatchRow>(`/events/${eventId}/email-log?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load email history'))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [eventId, q]);

  useEffect(() => {
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => {
        const map: Record<string, string> = {};
        for (const t of res.items) map[t.id] = t.name;
        setTemplatesById(map);
      })
      .catch(() => {
        // The template label is a courtesy annotation on an already-shown
        // send record, not the record itself -- a failure to load the
        // template list must not block or blank the history tab.
      });
  }, [eventId]);

  return (
    <div className="chq-comms-history-tab">
      {error && <div className="chq-error-banner">{error}</div>}

      <div className="chq-toolbar">
        <input
          className="chq-input"
          type="search"
          placeholder="Search subject or recipient..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search email history"
        />
      </div>

      {loading && <DelayedLoading />}
      {!loading && loaded && <RecentSends eventId={eventId} batches={items} templatesById={templatesById} />}

      <p className="chq-summary">{total} total</p>
    </div>
  );
}
