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
    <div className="chq-history-tab">
      {error && <div className="chq-error-banner">{error}</div>}

      <input
        type="search"
        placeholder="Search subject or recipient..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search email history"
      />

      <table className="chq-history-table">
        <thead>
          <tr>
            <th>Sent</th>
            <th>To</th>
            <th>Subject</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4}>Loading...</td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={4}>No emails sent yet.</td>
            </tr>
          )}
          {!loading &&
            items.map((row) => (
              <tr key={row.id}>
                <td>{formatSentAt(row.sentAt)}</td>
                <td>{row.toEmail}</td>
                <td>{row.subject}</td>
                <td>{row.status}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <p>{total} total</p>
    </div>
  );
}
