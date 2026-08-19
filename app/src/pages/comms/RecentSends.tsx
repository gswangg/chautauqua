import { useEffect, useState } from 'react';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { formatSendRhythm, type SendRhythm } from './sendRhythm';
import type { EmailBatchRow, EmailLogDetail, EmailLogRow } from './types';

// DEC-905 (wave-59 amendment): RecentSends renders no aggregate of its own
// -- the send-rhythm sentence ("N sent in the last 7 days …") is built ONCE
// by Comms.tsx from its own envelope totals and handed down as `rhythm`;
// this component only formats it (via the shared formatSendRhythm, so the
// wording can never diverge from the head's) and withholds the subtitle
// entirely when the caller hasn't supplied one yet.

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
  // DEC-905: the recipients read's OWN envelope total -- the only honest
  // source for "how many rows does this batch have", and the reason this
  // component still derives no aggregate of its own (never a sum over the
  // batch's statusCounts, which answers a different question and would be
  // exactly the re-derived figure DEC-905 removed from here).
  total: number | null;
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
      // DEC-856: clear at the start of the read that can replace it -- a
      // retry (reopen after a failed fetch, since !detail stays true) must
      // not keep a stale refusal on screen once it settles.
      setError(null);
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
  total,
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
      {/* DEC-603 amendment (wave 66, gate-11 sweep item 6): a head row over
          the SAME five-track grid the recipient rows below use -- empty /
          RECIPIENT / RESULT / empty / empty -- so a reader opening the
          disclosure sees what each of the five cells means. Rendered only
          once there is at least one recipient row (never over the loading
          or error states, which have nothing to head). The head class rides
          the same comms.css rule as `.chq-comms-recipient-row` (see the
          selector list there) so heads and cells cannot drift apart. */}
      {!error && items && items.length > 0 && (
        <div className="chq-comms-recipient-row chq-comms-recipient-col-heads-row">
          <span aria-hidden="true" />
          <span>Recipient</span>
          <span>Result</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </div>
      )}
      {/* DEC-751 (wave-21 amendment, B8): each recipient row is FIVE cells,
          matching the batch row's own five tracks exactly (Recipient sits
          under Subject, Result under the count) -- an empty leading cell,
          the recipient, the result, their submission's differing subject
          (or nothing, when it matches the batch subject), and an empty
          trailing cell holding the per-row disclosure. */}
      {!error && items && items.map((row) => (
        <div key={row.id} className="chq-comms-recipient-row">
          <span aria-hidden="true" />
          <span className="chq-comms-recipient-to">{row.toEmail}</span>
          {/* Frame 07-comms--08: SENT/SKIPPED/FAILED as a bold uppercase
              micro-label. The frame also shows a failed row's "provider
              said: <reason>" line -- EmailLogRow (the list projection this
              disclosure is fed from) carries no such field, only a
              `status` string, so that line can't be rendered honestly here;
              see the fidelity report for this gap. */}
          <span className="chq-comms-recipient-result">{row.status}</span>
          {/* A subject only differs when a merge field made it real (e.g. a
              per-recipient token) -- that's exactly when it's worth this
              cell; the shared batch subject is already printed once at the
              batch-row level, and this cell is otherwise left empty rather
              than dropped, so the row's five tracks never shift. */}
          {row.subject !== batchSubject ? (
            <span className="chq-comms-recipient-subject">Subject: {row.subject}</span>
          ) : (
            <span aria-hidden="true" />
          )}
          {/* DEC-846's "history owes the WORDS" half is served by DEC-833's
              disclosure here: the list projection stays narrow (DEC-543,
              which DEC-833 explicitly keeps), and the stored body is fetched
              one row at a time and rendered verbatim, whitespace preserved,
              for a failed attempt exactly as for a sent one. */}
          <SendDetailDisclosure eventId={eventId} emailId={row.id} templatesById={templatesById} />
        </div>
      ))}
      {/* Frame 07-comms--08's footer honesty line -- shown only when this
          fetch is a truncated projection of the batch, measured against the
          recipients read's OWN envelope total (DEC-905: a printed count is
          its own query's count), never a sum re-derived here over the batch
          row's statusCounts. */}
      {!error && items && total !== null && items.length < total && (
        <p className="chq-comms-batch-recipients-footer">
          {total - items.length} more &middot; sent means the provider accepted it &mdash; whether it landed in an
          inbox is not something we hear back about
        </p>
      )}
    </div>
  );
}

// w41-g (DEC-751 amendment), w8-e (DEC-238 amendment, sha efb77e4a, frame
// `docs/design/Chautauqua Comms.dc.html:827-832`): the collapsed row's
// count column follows the frame's own grammar, 'N sent · N skipped ·
// N failed', appending each clause ONLY when its count is non-zero and
// always in that order, so an all-failed or all-skipped batch is still
// auditable at a glance without every healthy row carrying a zero.
// Derived from batch.statusCounts (grouped by status in
// src/server/repo/email.ts), never fabricated.
export function sentCountLabel(statusCounts: Record<string, number>): string {
  const sent = statusCounts.sent ?? 0;
  const skipped = statusCounts.skipped ?? 0;
  const failed = statusCounts.failed ?? 0;
  const clauses = [`${sent} sent`];
  if (skipped > 0) clauses.push(`${skipped} skipped`);
  if (failed > 0) clauses.push(`${failed} failed`);
  return clauses.join(' · ');
}

export interface RecentSendsProps {
  eventId: string;
  batches: EmailBatchRow[];
  limit?: number;
  /** DEC-751 amendment (w15-d): when given, renders the section head's "All
   * history" link, which switches to the full History tab. The per-row
   * "Open" control is no longer gated by this prop -- BOTH mounts drill in
   * place (expand/collapse the recipients disclosure), so this callback
   * takes no argument; a per-row handoff to History is no longer a thing. */
  onSeeAll?: () => void;
  /** w1-g: expand+load this batch's recipients on mount -- the History mount
   * uses this to land already-open on the batch a compose-mount "Open"
   * handed off to via ?batch=<key>. Ignored on the compose mount (which has
   * no recipients disclosure to expand). */
  expandBatchKey?: string | null;
  /** DEC-876 nit + DEC-751 amendment (w41-g), required per w1-g: id->name
   * map, used both for the collapsed row's template column
   * (batch.templateId looked up here, else an em dash) and the per-row
   * send-detail disclosure's template label. Required (not optional) so a
   * caller cannot forget to fetch and pass it -- an empty map just falls
   * back to an em dash / omits the label rather than failing. */
  templatesById: Record<string, string>;
  /** DEC-678 (wave-36, app/src/admin-first-paint.render.test.tsx): "No emails
   * sent yet." is an EMPTY STATE, and an empty state is only reachable from a
   * settled load. `batches=[]` alone cannot tell "this event has never sent
   * anything" apart from "the batches request has not come back yet", and the
   * compose mount hits the second case on every first paint -- so the caller
   * states which one it is rather than this component guessing. */
  batchesLoaded: boolean;
  /** DEC-905 (wave-59 amendment): the send-rhythm figure, built once by
   * Comms.tsx from its own envelope totals -- this component never
   * re-derives it from `batches`. `null` (or omitted) withholds the
   * subtitle entirely, matching the "not loaded yet" case. */
  rhythm?: SendRhythm | null;
  /** DEC-603 (wave-56 amendment): when true, emits a column-head row (WHEN /
   * SUBJECT / RECIPIENTS / TEMPLATE / blank) over the SAME
   * --chq-comms-batch-grid the batch rows use (so heads and cells cannot
   * drift), and suppresses this component's own "Recent sends" section
   * head. Only the History tab's frame draws these heads (frame
   * :634-636); the Compose mount is unchanged (default false). */
  columnHeads?: boolean;
}

export function RecentSends({
  eventId,
  batches,
  limit,
  onSeeAll,
  expandBatchKey,
  templatesById,
  batchesLoaded,
  rhythm,
  columnHeads = false,
}: RecentSendsProps) {
  const [expanded, setExpanded] = useState<string | null>(expandBatchKey ?? null);
  const [recipients, setRecipients] = useState<Record<string, RecipientsState>>({});

  const rows = typeof limit === 'number' ? batches.slice(0, limit) : batches;

  function loadRecipients(batchKey: string) {
    if (recipients[batchKey]) return;
    apiList<EmailLogRow>(`/events/${eventId}/email-log?batchId=${encodeURIComponent(batchKey)}`)
      .then((res) => {
        setRecipients((prev) => ({ ...prev, [batchKey]: { items: res.items, total: res.total, error: null } }));
      })
      .catch((err) => {
        setRecipients((prev) => ({
          ...prev,
          [batchKey]: {
            items: null,
            total: null,
            error: err instanceof ApiError ? err.message : 'Failed to load recipients',
          },
        }));
      });
  }

  // w1-g: land already-expanded on the batch a compose-mount "Open" handed
  // off to (?tab=history&batch=<key>) -- runs once per incoming key, not on
  // every batches refetch, so a later mutationVersion-driven refetch doesn't
  // re-force this batch back open after the reader has since closed it.
  useEffect(() => {
    if (!expandBatchKey) return;
    setExpanded(expandBatchKey);
    loadRecipients(expandBatchKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandBatchKey]);

  function toggle(batchKey: string) {
    if (expanded === batchKey) {
      setExpanded(null);
      return;
    }
    setExpanded(batchKey);
    loadRecipients(batchKey);
  }

  // DEC-905 (wave-59 amendment): the subtitle is the SAME sentence the head
  // states, formatted from the SAME figure -- never re-derived here, and
  // withheld when the caller hasn't supplied one yet (matches the "No
  // emails sent yet." empty state's own settled/unsettled distinction).
  const subtitle = rhythm ? formatSendRhythm(rhythm) : null;

  return (
    <div className="chq-comms-recent-sends">
      {!columnHeads && (
        <div className="chq-section-head">
          <div className="chq-comms-recent-sends-head-titles">
            <span className="chq-section-label">Recent sends</span>
            {subtitle && <p className="chq-comms-recent-sends-subtitle">{subtitle}</p>}
          </div>
          {onSeeAll && (
            <button type="button" className="chq-link-button" onClick={() => onSeeAll()}>
              All history
            </button>
          )}
        </div>
      )}

      {/* DEC-603 (wave-56 amendment, frame :634-636): the History tab's own
          column-head row, over the SAME --chq-comms-batch-grid the rows
          below use, so heads and cells cannot drift out of alignment. */}
      {columnHeads && rows.length > 0 && (
        <div className="chq-comms-batch-col-heads chq-comms-batch">
          <div className="chq-comms-batch-row chq-comms-batch-col-heads-row">
            <span>When</span>
            <span>Subject</span>
            <span>Recipients</span>
            <span>Template</span>
            <span aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Frame 07-comms--07 + ruling B7: a fresh (never-sent) empty state
          gets a real primary action, not a bare "No emails sent yet."
          apology. RecentSends is fed only batches/templatesById/rhythm --
          it has no decision-count data of its own, so the reason clause
          stays static (no fabricated "N submissions" figure) rather than
          inventing a number this component cannot verify. The primary
          links into Compose, which already defaults step 1's status filter
          to Accepted alone (DEC-967), so "accepted speakers" is the real
          audience that lands, not just a label. */}
      {batchesLoaded && rows.length === 0 && (
        <EmptyState
          variant="fresh"
          what="You have not emailed anyone yet"
          reason="Every send is logged here afterwards."
          action={{ label: 'Tell your accepted speakers', to: '/comms?tab=compose' }}
          secondary={{ label: 'Read the templates ›', to: '/comms?tab=templates' }}
        />
      )}

      {rows.map((batch) => {
        const isExpanded = expanded === batch.batchKey;
        const entry = recipients[batch.batchKey];
        const templateLabel =
          batch.templateId && templatesById?.[batch.templateId] ? templatesById[batch.templateId] : '—';
        return (
          <div key={batch.batchKey} className="chq-comms-batch">
            {/* DEC-751 amendment (w41-g), w8-e (DEC-238 amendment, sha
                efb77e4a): exactly five columns --
                [when][subject][N sent · N skipped · N failed][template][Open].
                The count column follows the frame's grammar (sentCountLabel),
                appending each non-zero clause in order; the full per-status
                tally lives in the expanded recipients disclosure instead. */}
            <div className="chq-comms-batch-row">
              <span className="chq-comms-history-when">{formatDateTime(batch.sentAt)}</span>
              <span className="chq-comms-history-subject">{batch.subject}</span>
              <span className="chq-comms-batch-count">{sentCountLabel(batch.statusCounts)}</span>
              <span className="chq-comms-batch-template">{templateLabel}</span>
              {/* DEC-732 (eval-findings 59): an explicit bordered control,
                  not the whole row silently doubling as a toggle. DEC-751
                  amendment (w15-d): both mounts drill in place -- "Open"
                  always toggles this row's own recipients disclosure; the
                  compose mount no longer hands off to History per row. */}
              <button
                type="button"
                className={
                  columnHeads
                    ? 'chq-btn chq-btn-secondary chq-comms-batch-toggle chq-comms-batch-toggle-recipients'
                    : 'chq-btn chq-btn-secondary chq-comms-batch-toggle'
                }
                aria-expanded={isExpanded}
                onClick={() => toggle(batch.batchKey)}
              >
                {isExpanded ? 'Close' : 'Open'}
              </button>
            </div>
            {isExpanded && (
              <BatchRecipients
                eventId={eventId}
                items={entry?.items ?? null}
                total={entry?.total ?? null}
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
