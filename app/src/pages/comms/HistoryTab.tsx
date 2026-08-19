import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { RecentSends } from './RecentSends';
import { paginationSummary } from '../../lib/pagination-summary';
import { countOf } from '../../lib/plural';
import type { SendRhythm } from './sendRhythm';
import type { EmailBatchRow } from './types';

// DEC-603 amendment (findings wave 8): GET /email-log pages like every list
// route (server default 50/page, src/routes/api/email-log.ts) -- History
// must send page/perPage and render the same pager chrome compose step 1
// uses, instead of printing a `total` it can never fully show.
const PER_PAGE = 50;

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
  onBack,
}: {
  eventId: string;
  templatesById: Record<string, string>;
  rhythm?: SendRhythm | null;
  onBack?: () => void;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EmailBatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // w1-g: a compose-mount "Open" hands off here via ?tab=history&batch=<key>
  // -- read once on arrival so the matching batch lands already expanded.
  const [searchParams, setSearchParams] = useSearchParams();
  const expandBatchKey = searchParams.get('batch');
  // DEC-603 (wave-56 amendment, frame :625-631): the chips row's active
  // facet -- carried in the existing ?tab= search params (as `templateId`)
  // so a reload keeps the facet, the same way `batch` already survives a
  // reload above.
  const templateId = searchParams.get('templateId') || '';

  function selectTemplate(next: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set('templateId', next);
      else params.delete('templateId');
      return params;
    });
    setPage(1);
  }

  // DEC-603 (wave-56 amendment): 'All sends' plus one chip per template,
  // sorted by name.
  const templateChips = Object.entries(templatesById).sort(([, a], [, b]) => a.localeCompare(b));

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
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    if (q.trim()) params.set('q', q.trim());
    if (templateId) params.set('templateId', templateId);
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
  }, [eventId, q, page, templateId]);

  // DEC-603 amendment (wave 18): the head mirrors TemplatesTab's exactly --
  // a breadcrumb back to Compose, the page title, and a count line -- plus a
  // plain cookie-authed Export CSV anchor onto the SAME email-log export the
  // row-level exports already ship (src/routes/api/exports.ts,
  // kind=email-log), carrying only the filter this tab actually has (q).
  // NOTE: Comms.tsx already renders its own "Comms" h1 unconditionally, and
  // TemplatesTab already renders a second, page-scoped "Templates" h1 while
  // mounted alongside it (see app/src/pages/comms/TemplatesTab.tsx:185) --
  // there is no single-h1 rule on this page to reconcile with, so History
  // follows the same two-h1 precedent rather than inventing a third pattern.
  // DEC-603 amendment (wave 66, gate-11 sweep item 6): the rhythm clause was
  // dropped from this line -- Comms.tsx already renders the SAME
  // formatSendRhythm(rhythm) sentence, once, in the page head directly above
  // this tab's own titles block (Comms.tsx:225). Printing it a second time
  // here made the tab's own caption an unlabelled echo of the page head. The
  // `rhythm` prop is kept unused-here but still threaded to RecentSends
  // below, which needs it for its own (columnHeads-suppressed) subtitle
  // slot -- see RecentSends.tsx's own rhythm doc comment.
  const countLine = countOf(total, 'send');
  const exportParams = new URLSearchParams();
  exportParams.set('format', 'csv');
  if (q.trim()) exportParams.set('q', q.trim());
  const exportHref = `/api/v1/events/${eventId}/export/email-log?${exportParams.toString()}`;

  return (
    <div className="chq-comms-history-tab">
      <div className="chq-comms-history-head">
        {/* docs/design/Chautauqua Comms.dc.html:337 (Send history, 390)
            draws this band as the shell's own drill head -- mount the
            shared .chq-phone-head/.chq-phone-head-drill vocabulary (DEC-576
            wave-7 amendment) rather than a second declaration. At desktop
            widths neither class carries a top-level rule, so this wrapper
            stays an unstyled div in normal flow and the desktop titles
            block is unchanged. */}
        <div className="chq-comms-history-titles chq-phone-head chq-phone-head-drill">
          <button
            type="button"
            className="chq-link-button chq-comms-history-breadcrumb chq-phone-back"
            onClick={() => {
              onBack?.();
              goToCompose();
            }}
          >
            &lsaquo; Comms
          </button>
          <h1 className="chq-page-title">History</h1>
          <p className="chq-comms-head-subtitle">{countLine}</p>
        </div>
        {/* Plain cookie-authed anchor, same idiom as
            app/src/pages/settings/ExportsPanel.tsx:87 -- no fetch, no blob. */}
        {/* Frame 07-comms--08: Export CSV + a filled Compose button,
            right-flushed in the page header. The frame draws ONE page
            title here; Comms.tsx (app/src/pages/Comms.tsx, out of this
            page's ownership under app/src/pages/comms/**) unconditionally
            renders its own "Comms" H1 + tab pills above every tab's own
            content, which this file cannot remove -- see the fidelity
            report for that cross-file gap. This adds the Compose pairing
            achievable from inside this file alone. */}
        <div className="chq-comms-history-head-actions">
          <a className="chq-btn chq-btn-secondary chq-comms-history-export" href={exportHref}>
            Export CSV
          </a>
          <button type="button" className="chq-btn chq-btn-primary" onClick={goToCompose}>
            Compose
          </button>
        </div>
      </div>

      {error && <div className="chq-error-banner">{error}</div>}

      {/* DEC-603 (wave-56 amendment, frame :625-631): 'All sends' plus one
          chip per template, sorted by name -- the active chip is the
          filled/inverted state. The existing search input moves INTO this
          row, pushed right. */}
      <div className="chq-comms-history-chips">
        <button
          type="button"
          className={templateId === '' ? 'chq-pill is-active' : 'chq-pill'}
          aria-pressed={templateId === ''}
          onClick={() => selectTemplate('')}
        >
          All sends
        </button>
        {templateChips.map(([id, name]) => (
          <button
            key={id}
            type="button"
            className={templateId === id ? 'chq-pill is-active' : 'chq-pill'}
            aria-pressed={templateId === id}
            onClick={() => selectTemplate(id)}
          >
            {name}
          </button>
        ))}
        <input
          className="chq-input chq-comms-history-search"
          type="search"
          placeholder="Search a subject or a person…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
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
          escape={{
            label: 'Clear the search',
            onClick: () => {
              setQ('');
              setPage(1);
            },
          }}
        />
      )}
      {/* DEC-603 (wave-56 amendment): a template chip that excludes every
          send (no search text applied) names the CHIP as the excluding
          facet and offers an escape that clears exactly that facet -- the
          same B7 `variant="filtered"` idiom the search case above uses. */}
      {!loading && loaded && items.length === 0 && q.trim() === '' && templateId !== '' && (
        <EmptyState
          variant="filtered"
          what="No sends match this template."
          reason={`No sends match “${templatesById[templateId] ?? templateId}”.`}
          escape={{
            label: 'Clear the filter',
            onClick: () => selectTemplate(''),
          }}
        />
      )}
      {/* B7 (DEC-678 amendment): totally fresh (never sent anything, no
          search or chip filter applied) REPLACES the batch table entirely --
          it never renders RecentSends' own section head/table chrome over
          zero rows. */}
      {!loading && loaded && items.length === 0 && q.trim() === '' && templateId === '' && (
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
          columnHeads
        />
      )}

      {items.length > 0 && (
        <div className="chq-pager">
          <span>{paginationSummary(page, PER_PAGE, total)}</span>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * PER_PAGE >= total}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
