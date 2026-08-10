// Overview worklist dashboard (DEC-030, J-level "what needs my attention").
// One round trip: a single apiGet to GET .../overview builds all six cards.
// Sole owner: app/src/pages/Overview.tsx (+ app/src/pages/overview/cards.ts).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { apiGet, ApiError } from '../lib/api';
import { buildOverviewCards, type OverviewPayload } from './overview/cards';

export function OverviewPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    apiGet<OverviewPayload>(`/events/${eventId}/overview`)
      .then((res) => setPayload(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <div className="chq-page">
      <h1>Overview</h1>

      {eventError && <div className="chq-error-banner">{eventError}</div>}
      {error && <div className="chq-error-banner">{error}</div>}

      {(eventLoading || loading) && !error && !eventError && (
        <div className="chq-attention-frame">Loading overview…</div>
      )}

      {!eventLoading && !eventError && eventId && payload && (
        <div className="chq-overview-grid">
          {buildOverviewCards(payload).map((card) => (
            <Link key={card.key} to={card.link} className="chq-overview-card">
              <div className="chq-overview-card-title">{card.title}</div>
              <div className="chq-overview-card-count">{card.count}</div>
              <div className="chq-overview-card-sentence">
                {card.count === 0 ? card.zeroSentence : card.sentence}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
