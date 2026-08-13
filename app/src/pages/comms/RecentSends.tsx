import { useState } from 'react';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { formatDateTime, formatDateTimeWeekday } from '../../lib/dates';
import { DelayedLoading } from '../../components/DelayedLoading';
import type { EmailBatchRow, EmailLogDetail, EmailLogRow } from './types';

// w41-g: seven days, matching Comms.tsx's own "N sent in the last 7 days"
// window -- the section-head subtitle here is a second, component-local
// reading of the same rhythm, computed from the rows the component was
// given rather than a fetched total, so it works identically on both
// mounts (the compose mount never fetches its own aggregate).
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
function SendDetailDisclosure({
  eventId,
  emailId,
  templatesById,
}: {
  eventId: string;
  emailId: string;
  templatesById?: Record<string, string>;
}) {
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
              <div className="chq-comms-history-when">{formatDateTime(detail.sentAt)}</div>
              {detail.templateId && templatesById?.[detail.templateId] && (
                <div className="chq-comms-send-detail-template">
                  Template: {templatesById[detail.templateId]}
                </div>
              )}
              <div className="chq-comms-history-subject">{detail.subject}</div>
              <pre className="chq-comms-send-detail-text">{detail.bodyText}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BatchRecipients({
  eventId,
  items,
  error,
  templatesById,
  batchSubject,
  statusCounts,
}: RecipientsState & {
  eventId: string;
  templatesById?: Record<string, string>;
  batchSubject: string;
  statusCounts: Record<string, number>;
}) {
  return (
    <div className="chq-comms-batch-recipients">
      {/* DEC-751 amendment (w41-g): the full per-status tally moved here
          from the collapsed batch row -- an all-failed batch is still
          auditable via this line even while the recipient list below is
          still loading or failed to load, since it's read straight off the
          batch prop rather than the fetched rows. */}
      <div className="chq-meta chq-comms-batch-tally">{statusTally(statusCounts)}</div>
      {error && <div className="chq-error-banner">{error}</div>}
      {!error && !items && <DelayedLoading />}
      {!error && items && items.map((row) => (
        <div key={row.id} className="chq-comms-recipient-row">
          <span className="chq-comms-recipient-to">{row.toEmail}</span>
          <span className="chq-meta">{row.status}</span>
          {/* DEC-846's "history owes the WORDS" half is served by DEC-833's
              disclosure below: the list projection stays narrow (DEC-543,
              which DEC-833 explicitly keeps), and the stored body is fetched
              one row at a time and rendered verbatim, whitespace preserved,
              for a failed attempt exactly as for a sent one. */}
          <SendDetailDisclosure eventId={eventId} emailId={row.id} templatesById={templatesById} />
          {/* A subject only differs when a merge field made it real (e.g. a
              per-recipient token) -- that's exactly when it's worth the
              second line; the shared batch subject is already printed once
              at the batch-row level. */}
          {row.subject !== batchSubject && (
            <span className="chq-comms-recipient-subject">Subject: {row.subject}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// w41-g (DEC-751 amendment): the collapsed row's SENT count -- 'N sent',
// appending ' · N failed' only when a failure exists, so an all-failed
// batch is still auditable at a glance without every healthy row carrying
// a zero. Derived from batch.statusCounts, never fabricated.
function sentCountLabel(statusCounts: Record<string, number>): string {
  const sent = statusCounts.sent ?? 0;
  const failed = statusCounts.failed ?? 0;
  return failed > 0 ? `${sent} sent · ${failed} failed` : `${sent} sent`;
}

export interface RecentSendsProps {
  eventId: string;
  batches: EmailBatchRow[];
  limit?: number;
  /** When given, renders "All history" as the section-rule link instead of
   * the per-row recipients disclosure -- the compose mount is read-only and
   * hands off to the full History tab rather than drilling in place. */
  onSeeAll?: () => void;
  /** DEC-876 nit + DEC-751 amendment (w41-g): id->name map, used both for
   * the collapsed row's template column (batch.templateId looked up here,
   * else an em dash) and the per-row send-detail disclosure's template
   * label. Optional and additive -- a missing/empty map just falls back to
   * an em dash / omits the label rather than failing. */
  templatesById?: Record<string, string>;
}

export function RecentSends({ eventId, batches, limit, onSeeAll, templatesById }: RecentSendsProps) {
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

  // w41-g: the section-head subtitle is computed from the FULL batches prop
  // (never the limit-sliced `rows`) -- the compose mount's cap is a display
  // cap on the list, not on what the subtitle claims. Withheld entirely
  // when there are no batches at all, matching the "No emails sent yet."
  // empty state below.
  const subtitle = (() => {
    if (batches.length === 0) return null;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const sentIn7Days = batches
      .filter((b) => b.sentAt >= cutoff)
      .reduce((sum, b) => sum + (b.statusCounts.sent ?? 0), 0);
    return `${sentIn7Days} sent in 7 days · last ${formatDateTimeWeekday(batches[0]!.sentAt)}`;
  })();

  return (
    <div className="chq-comms-recent-sends">
      <div className="chq-section-head">
        <div className="chq-comms-recent-sends-head-titles">
          <span className="chq-section-label">Recent sends</span>
          {subtitle && <p className="chq-comms-recent-sends-subtitle">{subtitle}</p>}
        </div>
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
        const templateLabel =
          batch.templateId && templatesById?.[batch.templateId] ? templatesById[batch.templateId] : '—';
        return (
          <div key={batch.batchKey} className="chq-comms-batch">
            {/* DEC-751 amendment (w41-g): exactly five columns --
                [when][subject][N sent][template][Open]. The count column
                states the SENT count and appends '· N failed' only when a
                failure exists (sentCountLabel); the full per-status tally
                lives in the expanded recipients disclosure instead. */}
            <div className="chq-comms-batch-row">
              <span className="chq-comms-history-when">{formatDateTime(batch.sentAt)}</span>
              <span className="chq-comms-history-subject">{batch.subject}</span>
              <span className="chq-comms-batch-count">{sentCountLabel(batch.statusCounts)}</span>
              <span className="chq-comms-batch-template">{templateLabel}</span>
              {/* DEC-732 (eval-findings 59): an explicit bordered control,
                  not the whole row silently doubling as a toggle. On the
                  compose mount (onSeeAll given) "Open" hands off to the
                  full History tab instead of drilling in place. */}
              {onSeeAll ? (
                <button
                  type="button"
                  className="chq-link-button chq-comms-batch-open"
                  onClick={onSeeAll}
                >
                  Open
                </button>
              ) : (
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary chq-comms-batch-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => toggle(batch.batchKey)}
                >
                  {isExpanded ? 'Close' : 'Open'}
                </button>
              )}
            </div>
            {!onSeeAll && isExpanded && (
              <BatchRecipients
                eventId={eventId}
                items={entry?.items ?? null}
                error={entry?.error ?? null}
                templatesById={templatesById}
                batchSubject={batch.subject}
                statusCounts={batch.statusCounts}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
