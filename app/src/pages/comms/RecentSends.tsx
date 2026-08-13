import { useState } from 'react';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import { DelayedLoading } from '../../components/DelayedLoading';
import type { EmailBatchRow, EmailLogDetail, EmailLogRow } from './types';

// DEC-751: "Recent sends" is ONE presentational component, mounted twice —
// once (capped, read-only, with an "All history" link) at the bottom of the
// Compose column, and once (uncapped, expandable) as History's own list.
// Both mounts are fed the same GET .../email-log?groupBy=batch rows by their
// callers; this component never fetches for itself and never fabricates a
// count it wasn't given. A batch whose statusCounts are all failures renders
// exactly like any other batch -- an attempted send is auditable whatever
// the transport did.
function statusTally(statusCounts: Record<string, number>): string {
  return Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, n]) => `${n} ${status}`)
    .join(', ');
}

interface RecipientsState {
  items: EmailLogRow[] | null;
  error: string | null;
}

// DEC-833: per-row "Show what was sent" disclosure — fetches the full
// stored row once (never re-rendered from the live template/merge fields)
// and renders subject+bodyText verbatim, including for a failed attempt
// (the stored row is the audit record either way).
function SendDetailDisclosure({ eventId, emailId }: { eventId: string; emailId: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EmailLogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading) {
      setLoading(true);
      apiGet<EmailLogDetail>(`/events/${eventId}/email-log/${emailId}`)
        .then((res) => setDetail(res))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load what was sent'))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className="chq-comms-send-detail">
      <button type="button" className="chq-link-button" aria-expanded={open} onClick={toggle}>
        {open ? 'Hide what was sent' : 'Show what was sent'}
      </button>
      {open && (
        <div className="chq-comms-send-detail-body">
          {loading && <DelayedLoading />}
          {error && <div className="chq-error-banner">{error}</div>}
          {detail && (
            <>
              <div className="chq-comms-history-subject">{detail.subject}</div>
              <pre className="chq-comms-send-detail-text">{detail.bodyText}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BatchRecipients({ eventId, items, error }: RecipientsState & { eventId: string }) {
  if (error) return <div className="chq-error-banner">{error}</div>;
  if (!items) return <DelayedLoading />;

  return (
    <div className="chq-comms-batch-recipients">
      {items.map((row) => (
        <div key={row.id} className="chq-comms-history-row">
          <span className="chq-comms-history-when">{formatDateTime(row.sentAt)}</span>
          <span className="chq-comms-history-subject">{row.subject}</span>
          <span>{row.toEmail}</span>
          <span className="chq-meta">{row.status}</span>
          {/* DEC-846's "history owes the WORDS" half is served by DEC-833's
              disclosure below: the list projection stays narrow (DEC-543,
              which DEC-833 explicitly keeps), and the stored body is fetched
              one row at a time and rendered verbatim, whitespace preserved,
              for a failed attempt exactly as for a sent one. */}
          <SendDetailDisclosure eventId={eventId} emailId={row.id} />
        </div>
      ))}
    </div>
  );
}

export interface RecentSendsProps {
  eventId: string;
  batches: EmailBatchRow[];
  limit?: number;
  /** When given, renders "All history" as the section-rule link instead of
   * the per-row recipients disclosure -- the compose mount is read-only and
   * hands off to the full History tab rather than drilling in place. */
  onSeeAll?: () => void;
}

export function RecentSends({ eventId, batches, limit, onSeeAll }: RecentSendsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Record<string, RecipientsState>>({});

  const rows = typeof limit === 'number' ? batches.slice(0, limit) : batches;

  function toggle(batchKey: string) {
    if (expanded === batchKey) {
      setExpanded(null);
      return;
    }
    setExpanded(batchKey);
    if (!recipients[batchKey]) {
      apiList<EmailLogRow>(`/events/${eventId}/email-log?batchId=${encodeURIComponent(batchKey)}`)
        .then((res) => {
          setRecipients((prev) => ({ ...prev, [batchKey]: { items: res.items, error: null } }));
        })
        .catch((err) => {
          setRecipients((prev) => ({
            ...prev,
            [batchKey]: { items: null, error: err instanceof ApiError ? err.message : 'Failed to load recipients' },
          }));
        });
    }
  }

  return (
    <div className="chq-comms-recent-sends">
      <div className="chq-section-head">
        <span className="chq-section-label">Recent sends</span>
        {onSeeAll && (
          <button type="button" className="chq-link-button" onClick={onSeeAll}>
            All history
          </button>
        )}
      </div>

      {rows.length === 0 && <p className="chq-empty">No emails sent yet.</p>}

      {rows.map((batch) => {
        const isExpanded = expanded === batch.batchKey;
        const entry = recipients[batch.batchKey];
        return (
          <div key={batch.batchKey} className="chq-comms-batch">
            <div className="chq-comms-batch-row">
              <span className="chq-comms-history-when">{formatDateTime(batch.sentAt)}</span>
              <span className="chq-comms-history-subject">{batch.subject}</span>
              <span>
                {batch.recipientCount} recipient{batch.recipientCount === 1 ? '' : 's'}
              </span>
              <span className="chq-meta">{statusTally(batch.statusCounts)}</span>
              {/* DEC-732 (eval-findings 59): an explicit bordered control,
                  not the whole row silently doubling as a toggle. The
                  compose mount (onSeeAll given) omits this disclosure --
                  that drill-in belongs to the full History tab. */}
              {!onSeeAll && (
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary chq-comms-batch-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => toggle(batch.batchKey)}
                >
                  {isExpanded ? 'Hide the recipients' : 'See the recipients'}
                </button>
              )}
            </div>
            {!onSeeAll && isExpanded && (
              <BatchRecipients eventId={eventId} items={entry?.items ?? null} error={entry?.error ?? null} />
            )}
          </div>
        );
      })}
    </div>
  );
}
