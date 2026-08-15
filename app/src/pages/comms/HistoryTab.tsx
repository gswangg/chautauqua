import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { RecentSends } from './RecentSends';
import type { SendRhythm } from './sendRhythm';
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
// DEC-905 (wave-59 amendment): `rhythm` is the send-rhythm figure Comms.tsx
// derives once from its own envelope totals -- passed straight through to
// RecentSends so History's mount states the same sentence as the head and
// the compose mount, never re-deriving it from `items`. Optional so this
// component doesn't need a fetch of its own to render before Comms.tsx's
// rhythm request settles.
export function HistoryTab({
  eventId,
  templatesById,
  rhythm,
}: {
  eventId: string;
  templatesById: Record<string, string>;
  rhythm?: SendRhythm | null;
}) {
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
      {/* B7 (DEC-678 amendment): a search that excludes every send keeps the
          search chrome above it, names the query as the excluding facet, and
          offers an escape that clears exactly that facet -- never the
          `chq-empty` one-line register, which is the retired flat message
          B7 rule 6 targets. */}
      {!loading && loaded && items.length === 0 && q.trim() !== '' && (
        <EmptyState
          variant="filtered"
          what="No sends match your search."
          reason={`No sends match “${q.trim()}”.`}
          escape={{ label: 'Clear the search', onClick: () => setQ('') }}
        />
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
          // Only mounted from inside `loaded && items.length > 0`.
          batchesLoaded
          templatesById={templatesById}
          expandBatchKey={expandBatchKey}
          rhythm={rhythm ?? null}
        />
      )}

      {items.length > 0 && <p className="chq-summary">{total} total</p>}
    </div>
  );
}
