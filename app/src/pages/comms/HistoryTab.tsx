import { useEffect, useState } from 'react';
import { apiList, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import type { EmailBatchRow, EmailLogRow } from './types';

// DEC-603: batch rows collapse a fan-out send's per-recipient rows into one
// "when · subject · N recipients · status tally" row; clicking one expands
// it into the per-recipient rows via ?batchId=<batchKey> (a legacy/NULL-
// batch row's own id is a valid batchKey too, so it still appears as its
// own one-recipient batch).
function statusTally(statusCounts: Record<string, number>): string {
  return Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, n]) => `${n} ${status}`)
    .join(', ');
}

function BatchRecipients({ eventId, batchKey }: { eventId: string; batchKey: string }) {
  const [items, setItems] = useState<EmailLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiList<EmailLogRow>(`/events/${eventId}/email-log?batchId=${encodeURIComponent(batchKey)}`)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load recipients');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, batchKey]);

  if (error) return <div className="chq-error-banner">{error}</div>;
  if (!items) return <p>Loading...</p>;

  return (
    <div className="chq-comms-batch-recipients">
      {items.map((row) => (
        <div key={row.id} className="chq-comms-history-row">
          <span className="chq-comms-history-when">{formatDateTime(row.sentAt)}</span>
          <span className="chq-comms-history-subject">{row.subject}</span>
          <span>{row.toEmail}</span>
          <span className="chq-meta">{row.status}</span>
        </div>
      ))}
    </div>
  );
}

export function HistoryTab({ eventId }: { eventId: string }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EmailBatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    const params = new URLSearchParams();
    params.set('groupBy', 'batch');
    if (q.trim()) params.set('q', q.trim());
    apiList<EmailBatchRow>(`/events/${eventId}/email-log?${params.toString()}`)
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
        items.map((batch) => {
          const isExpanded = expanded === batch.batchKey;
          return (
            <div key={batch.batchKey} className="chq-comms-batch">
              <button
                type="button"
                className="chq-comms-batch-row"
                aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : batch.batchKey)}
              >
                <span className="chq-comms-history-when">{formatDateTime(batch.sentAt)}</span>
                <span className="chq-comms-history-subject">{batch.subject}</span>
                <span>{batch.recipientCount} recipient{batch.recipientCount === 1 ? '' : 's'}</span>
                <span className="chq-meta">{statusTally(batch.statusCounts)}</span>
              </button>
              {isExpanded && <BatchRecipients eventId={eventId} batchKey={batch.batchKey} />}
            </div>
          );
        })}

      <p className="chq-summary">{total} total</p>
    </div>
  );
}
