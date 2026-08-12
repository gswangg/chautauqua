import { useEffect, useState } from 'react';
import { apiList, ApiError } from '../../lib/api';
import type { EmailLogRow } from './types';

function formatSentAt(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function HistoryTab({ eventId }: { eventId: string }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EmailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    apiList<EmailLogRow>(`/events/${eventId}/email-log${qs ? `?${qs}` : ''}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load email history'))
      .finally(() => setLoading(false));
  }, [eventId, q]);

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

      <div className="chq-section-head">
        <span className="chq-section-label">Recent sends</span>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && items.length === 0 && <p className="chq-empty">No emails sent yet.</p>}
      {!loading &&
        items.map((row) => (
          <div key={row.id} className="chq-comms-history-row">
            <span className="chq-comms-history-when">{formatSentAt(row.sentAt)}</span>
            <span className="chq-comms-history-subject">{row.subject}</span>
            <span>{row.toEmail}</span>
            <span className="chq-meta">{row.status}</span>
          </div>
        ))}

      <p className="chq-summary">{total} total</p>
    </div>
  );
}
