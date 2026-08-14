import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { RecentSends } from './RecentSends';
import type { EmailBatchRow } from './types';

// DEC-751: the batch-row + recipients-disclosure list moved into the shared
// RecentSends component (app/src/pages/comms/RecentSends.tsx); History
// fetches the full, paginated (unlimited/no `limit`) batch list and mounts
// RecentSends with no `onSeeAll`, so it keeps the recipients disclosure.
//
// w1-g: templatesById is now fetched ONCE by the Comms.tsx parent and
// passed to both RecentSends mounts (History and Compose) -- History no
// longer fetches its own copy, so the same batch renders the same template
// name under either tab.
export function HistoryTab({ eventId, templatesById }: { eventId: string; templatesById: Record<string, string> }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EmailBatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // w1-g: a compose-mount "Open" hands off here via ?tab=history&batch=<key>
  // -- read once on arrival so the matching batch lands already expanded.
  const [searchParams, setSearchParams] = useSearchParams();
  const expandBatchKey = searchParams.get('batch');

  // B7 (DEC-678 amendment): the same tab-switch path Comms.tsx's own
  // "All history" link uses in reverse -- ?tab= on this same route, never a
  // route navigation.
  function goToCompose() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'compose');
      return params;
    });
  }

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

  return (
    <div className="chq-comms-history-tab">
      {error && <div className="chq-error-banner">{error}</div>}

      <div className="chq-toolbar">
        <input
          className="chq-input chq-comms-history-search"
          type="search"
          placeholder="Search subject or recipient..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search email history"
        />
      </div>

      {loading && <DelayedLoading />}
      {!loading && loaded && items.length === 0 && q.trim() !== '' && (
        <p className="chq-empty">No sends match &ldquo;{q.trim()}&rdquo;.</p>
      )}
      {/* B7 (DEC-678 amendment): totally fresh (never sent anything, no
          search applied) REPLACES the batch table entirely -- it never
          renders RecentSends' own section head/table chrome over zero
          rows. */}
      {!loading && loaded && items.length === 0 && q.trim() === '' && (
        <EmptyState
          variant="fresh"
          what="Nothing has been sent yet"
          action={{ label: 'Compose', onClick: goToCompose }}
        />
      )}
      {!loading && loaded && items.length > 0 && (
        <RecentSends
          eventId={eventId}
          batches={items}
          templatesById={templatesById}
          expandBatchKey={expandBatchKey}
        />
      )}

      <p className="chq-summary">{total} total</p>
    </div>
  );
}
