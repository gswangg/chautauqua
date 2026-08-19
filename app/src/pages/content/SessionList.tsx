import { DELIVERABLE_LABELS, FILE_KINDS, type ContentStatus, type ContentSubmissionListItem } from './types';
import { WORKLIST_TABS, worklistStatusLabel, worklistStatusEmphasisClass, type WorklistTab } from './worklist';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { formatRelativeDays, formatDayLabel } from '../../lib/dates';
import { paginationSummary } from '../../lib/pagination-summary';
import { publicRoomLabel } from '../../lib/room-label';
import { clockHHMM } from '../../lib/clock';
import { countOf, plural } from '../../lib/plural';

// w5-i (DEC-020 amendment quoted mock text, eval-findings.md STILL-PRESENT
// residue): the Latest file column names EVERY kind that has files ("Slides
// v3 · Recording v1"), not just the single most-recently-touched kind's
// filename+version -- a session with a re-uploaded deck AND a first-time
// recording otherwise hides the recording row entirely. FILE_KINDS order
// keeps the summary deterministic across renders.
function latestFileSummary(item: ContentSubmissionListItem): string {
  return FILE_KINDS.filter((kind) => item.latestFileByKind[kind] != null)
    .map((kind) => `${DELIVERABLE_LABELS[kind]} v${item.latestFileByKind[kind]}`)
    .join(' · ');
}

/** w41-b (DEC-902 amendment): the worklist SESSION cell's subtitle --
 * 'REF · <day> <start>, <room>' once placed on the agenda, or the bare ref
 * (no '· ,' residue) when the submission hasn't been scheduled yet. Time is
 * zero-padded HH:MM via the single clock owner (DEC-900). */
function formatSessionSubtitle(item: ContentSubmissionListItem): string {
  if (!item.scheduled) return item.ref;
  const dayLabel = formatDayLabel(item.scheduled.day);
  const timeLabel = clockHHMM(item.scheduled.startMin);
  const roomLabel = publicRoomLabel(item.scheduled.roomName);
  return `${item.ref} · ${dayLabel} ${timeLabel}, ${roomLabel}`;
}

// DEC-825: mock pill naming (docs/design/'Chautauqua Content.dc.html',
// screens/05-content.png) — the worklist now renders exactly the mock's
// three chips, in the mock's order (worklist.ts WORKLIST_TABS).
export const TAB_LABELS: Record<WorklistTab, string> = {
  needs_decision: 'Needs a decision',
  approved: 'Approved',
  all: 'All accepted sessions',
};


interface SessionListProps {
  items: ContentSubmissionListItem[];
  tab: WorklistTab;
  onTabChange: (tab: WorklistTab) => void;
  onSelect: (submissionId: string) => void;
  loading: boolean;
  // Distinct from `loading` (which also flips true on every refetch): only
  // true once the first load has resolved, so the empty state never renders
  // ahead of a fetch that simply hasn't started yet (loading starts false).
  loaded: boolean;
  // CNT-12: always-visible per-row content-status control, so approval
  // doesn't require drilling into a submission's deliverable detail first.
  onContentStatusChange: (submissionId: string, status: ContentStatus) => void;
  // DEC-341: server-driven pagination — the tab filter and worklist sort
  // are already applied server-side on `items`, so `total` reflects the
  // event-wide match count, not just this page.
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  // w1-f: epoch-ms 'now' for the Latest file column's relative date
  // ('2 days ago') — a prop rather than Date.now() inline so every row in
  // one render agrees on the same instant.
  now: number;
  // DEC-825: one bounded (perPage=1) count per chip, keyed by tab — null
  // until its own aggregate read resolves, rendered honestly absent (never
  // a placeholder 0) until then.
  counts: Record<WorklistTab, number | null>;
  // DEC-825 amendment: set-based bulk content-approval selection, scoped to
  // the current page (same pattern as the row-level approve/changes controls).
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  // DEC-825 amendment (wave 25, ruling A1): ONE primary — the bulk bar's
  // own "Approve N" button. The page-wide "Approve N ready" section-rule
  // button is gone: two olive primaries with different scopes (every
  // eligible row on the page vs. the ticked rows) left a user unable to
  // tell which one they were pressing.
  // DEC-720 wave-32 amendment: 'Request changes'/'Pending' join 'Approve'
  // as secondary actions in the same bar — all three are silent
  // content-status writes (no mail), so onBulkContentStatus takes the
  // target status rather than being hardwired to 'approved'.
  onBulkContentStatus: (status: ContentStatus) => void | Promise<void>;
  bulkPending: boolean;
  // w1-e (DEC-825 amendment, TIER 0 phone Select mode): the same UI-only
  // mode ContentApp's header Select/Done toggle owns — phone width only,
  // switches the worklist card between row verbs (Approve/Open) and the
  // docked bulk bar. See content.css's `.chq-content-worklist-selecting`.
  // Optional/defaulted false so every pre-existing render-test call site
  // (desktop-only, never exercises this mode) keeps compiling unchanged.
  phoneSelectMode?: boolean;
}

export function SessionList({
  items,
  tab,
  onTabChange,
  onSelect,
  loading,
  loaded,
  onContentStatusChange,
  total,
  page,
  perPage,
  onPageChange,
  now,
  counts,
  selectedIds,
  onSelectionChange,
  onBulkContentStatus,
  bulkPending,
  phoneSelectMode = false,
}: SessionListProps) {
  const visible = items;
  const pageIds = visible.map((item) => item.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  // USER RULING 2026-08-16 (supersedes the wave-25 pre-tick): selection
  // only ever comes from a user gesture — nothing is pre-ticked on fetch.
  // The one-gesture affordance for re-uploads lives in the idle bar's
  // hint instead: "N re-uploads are waiting for re-review — Select them"
  // (same Re-uploaded predicate the retired effect used).
  const reuploadedIds = visible
    .filter((item) => worklistStatusLabel(item.contentStatus, item.reuploaded) === 'Re-uploaded')
    .map((item) => item.id);

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function togglePage() {
    const next = new Set(selectedIds);
    if (allSelected) {
      for (const id of pageIds) next.delete(id);
    } else {
      for (const id of pageIds) next.add(id);
    }
    onSelectionChange(next);
  }

  return (
    <div
      className={
        phoneSelectMode ? 'chq-content-worklist chq-content-worklist-selecting' : 'chq-content-worklist'
      }
    >
      {/* G13 lane-D fix (05-content--00): the frame draws NO section label
          and NO 2px ink rule here — the header stack is title, 1px hairline,
          chips, 1px hairline, bulk bar. The hairlines are carried by
          .chq-content-worklist / .chq-chipstrip rules in content.css. */}
      <div className="chq-chipstrip" role="tablist" aria-label="Content status">
        {WORKLIST_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'chq-pill is-active' : 'chq-pill'}
            onClick={() => onTabChange(t)}
          >
            {TAB_LABELS[t]}
            {counts[t] !== null ? ` · ${counts[t]}` : ''}
          </button>
        ))}
      </div>

      {/* DEC-825 amendment (wave 25, ruling A1): ONE primary for bulk
          approval, scoped to the ticked rows only — no page-wide "Approve N
          ready" competitor. Sits below the chipstrip, directly above the
          table it acts on. Approving is a status change, never an email
          (house invariant), hence the consequence line rather than any
          "notify" language. */}
      {/* User-filed: always mounted — idle keeps the space so selecting
          never shifts the worklist. USER RULING 2026-08-16: idle is a real
          quiet state now — one muted hint line (.chq-bulkbar-hint, same
          height as the armed bar) instead of an invisible band, kept in
          the accessibility tree (no aria-hidden: the hint is real
          content). When Re-uploaded rows are on the page, the hint carries
          the one-gesture "Select them" quick-select that replaced the
          retired pre-tick. */}
      <div
        className={selectedIds.size > 0 ? 'chq-bulkbar' : 'chq-bulkbar chq-bulkbar-idle'}
        role="toolbar"
        aria-label="Bulk content actions"
      >
        {selectedIds.size === 0 ? (
          <span className="chq-bulkbar-hint">
            {reuploadedIds.length > 0 ? (
              <>
                {countOf(reuploadedIds.length, 're-upload')} {plural(reuploadedIds.length, 'is', 'are')} waiting for
                re-review —{' '}
                <button
                  type="button"
                  className="chq-bulkbar-hint-action"
                  onClick={() => onSelectionChange(new Set(reuploadedIds))}
                >
                  Select them
                </button>
              </>
            ) : (
              'Tick rows to approve in bulk.'
            )}
          </span>
        ) : (
          <>
          <span className="chq-bulkbar-count">{selectedIds.size} selected</span>
          <span className="chq-bulkbar-note">Approving sends nothing · the speaker sees it in their portal</span>
          <div className="chq-bulkbar-actions">
            {/* G13 lane-D fix (05-content--00, DESIGN-RULINGS A1: "One verb,
                one scope: the bar owns Approve") — the DEC-720 'Request
                changes'/'Pending' bulk verbs are removed; the frame draws
                [Approve N] + Clear only. The deliberate note+email path stays
                the per-submission content-note composer. */}
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={bulkPending}
              onClick={() => onBulkContentStatus('approved')}
            >
              Approve {selectedIds.size}
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={bulkPending}
              onClick={() => onSelectionChange(new Set())}
            >
              Clear
            </button>
          </div>
          </>
        )}
      </div>

      {/* v4 mock IA (docs/design/Chautauqua Content.dc.html, DEC-692): five
          columns — Session, Speaker, Latest file, Status, actions. 'Ask for
          changes' moved off this row onto the deliverable-detail screen
          (docs/design/README.md); the row keeps only Approve + Open, Open
          selecting the submission the same way the row click already does. */}
      {loading ? (
        <table className="chq-table chq-content-table chq-content-worklist-table">
          <thead>
            <tr>
              <th className="chq-content-worklist-col-select">
                <input
                  className="chq-check"
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={togglePage}
                />
              </th>
              <th>Session</th>
              <th className="chq-content-worklist-col-speaker">Speaker</th>
              <th className="chq-content-worklist-col-latest-file">Latest file</th>
              <th className="chq-content-worklist-col-status">Status</th>
              <th className="chq-content-worklist-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {/* DEC-678 (wave-3/wave-8, proven by app/src/admin-first-paint.
                render.test.tsx): the worklist IS Content's main region, so its
                wait renders shaped placeholder rows on the FIRST frame. A
                DelayedLoading here withheld everything for 250ms, which painted
                column headers over an empty body -- the "blank/heading-only on
                first load" report -- rather than the shape of what is coming. */}
            <tr>
              <td colSpan={6}>
                <PageSkeleton variant="table" label="Loading sessions…" />
              </td>
            </tr>
          </tbody>
        </table>
      ) : loaded && visible.length === 0 ? (
        // DEC-678 amendment (B7): a loaded, empty visible set never renders
        // the <table> — a full <thead> over a one-cell apology is exactly
        // the pattern B7 forbids. 'needs_decision'/'approved' narrow away
        // from 'all' (DEC-881's default), so an empty result there is
        // 'filtered' (names the tab, offers the existing "View all accepted
        // sessions" escape back to 'all'); an empty 'all' tab has no facet
        // narrowing it, so it's 'fresh' (no escape -- there is nothing to
        // clear -- and no fabricated action, since sessions arrive here via
        // acceptance/scheduling, not a control on this page).
        tab === 'needs_decision' ? (
          <EmptyState
            variant="filtered"
            what="Nothing needs a decision right now."
            reason={`Filtered by the "${TAB_LABELS.needs_decision}" tab.`}
            escape={{ label: 'View all accepted sessions', onClick: () => onTabChange('all') }}
          />
        ) : tab !== 'all' ? (
          <EmptyState
            variant="filtered"
            what="No submissions in this view."
            reason={`Filtered by the "${TAB_LABELS[tab]}" tab.`}
            escape={{ label: 'View all accepted sessions', onClick: () => onTabChange('all') }}
          />
        ) : (
          <EmptyState variant="fresh" what="No accepted sessions yet." />
        )
      ) : (
        <table className="chq-table chq-content-table chq-content-worklist-table">
          <thead>
            <tr>
              {/* DEC-825 amendment: selection column leads the DEC-692 column
                  set (Session · Speaker · Latest file · Status · actions) —
                  bulk selection is added TO that IA, it does not replace it. */}
              <th className="chq-content-worklist-col-select">
                <input
                  className="chq-check"
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={togglePage}
                />
              </th>
              <th>Session</th>
              <th className="chq-content-worklist-col-speaker">Speaker</th>
              <th className="chq-content-worklist-col-latest-file">Latest file</th>
              <th className="chq-content-worklist-col-status">Status</th>
              <th className="chq-content-worklist-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const [firstSpeaker, ...restSpeakers] = item.speakers;
              return (
                <tr key={item.id} className="chq-content-row" onClick={() => onSelect(item.id)}>
                  {/* DEC-825 amendment: row selection cell — stops propagation
                      so ticking a box never opens the submission. */}
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      className="chq-check"
                      type="checkbox"
                      aria-label={`Select ${item.title}`}
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleRow(item.id)}
                    />
                  </td>
                  <td>
                    <div className="chq-content-row-session">
                      <div className="chq-content-row-title">{item.title}</div>
                      <div className="chq-content-row-ref">{formatSessionSubtitle(item)}</div>
                    </div>
                  </td>
                  <td className="chq-content-row-speaker">
                    {firstSpeaker ? (
                      <>
                        {firstSpeaker.name}
                        {restSpeakers.length > 0 ? ` +${restSpeakers.length}` : ''}
                      </>
                    ) : (
                      'No speakers'
                    )}
                  </td>
                  <td>
                    <div className="chq-content-row-latest-file">
                      {item.latestFile ? (
                        <>
                          <div className="chq-content-latest-file-name">{latestFileSummary(item)}</div>
                          <div className="chq-content-latest-file-date">
                            {formatRelativeDays(item.latestFile.uploadedAt, now)}
                          </div>
                        </>
                      ) : (
                        <span className="chq-content-latest-file-empty">No files yet</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {/* DEC-825 amendment (wave 72) / w6-e (DEC-881): weight
                        carries the state, never colour (DEC-367/DEC-730) —
                        worklistStatusLabel decides the text,
                        worklistStatusEmphasisClass decides the emphasis
                        (worklist.ts), the SAME class mapping the
                        deliverable-detail band's status value consumes —
                        never two per-surface conditionals. */}
                    {(() => {
                      const label = worklistStatusLabel(item.contentStatus, item.reuploaded);
                      const className = ['chq-flag', worklistStatusEmphasisClass(label)].filter(Boolean).join(' ');
                      return <span className={className}>{label}</span>;
                    })()}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="chq-content-actions">
                      {/* w1-f: Approve is ABSENT (never disabled) once a row is
                          already approved — a disabled control implies the
                          action might apply again later, which it never does
                          from here (re-review happens via 'Ask for changes'
                          in the deliverable detail). */}
                      {item.contentStatus !== 'approved' && (
                        <button
                          type="button"
                          className="chq-btn chq-btn-primary"
                          onClick={() => onContentStatusChange(item.id, 'approved')}
                        >
                          Approve
                        </button>
                      )}
                      <button type="button" className="chq-btn chq-btn-secondary" onClick={() => onSelect(item.id)}>
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state (the
          unfiltered 'all' tab, never held a row) hides the pager -- chrome
          over nothing. A FILTERED zero-state (needs_decision / any other
          tab) keeps it: chrome is how a filter gets undone. */}
      {!(loaded && visible.length === 0 && tab === 'all') && (
        <div className="chq-content-pager">
          <button type="button" className="chq-btn chq-btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <span>
            {paginationSummary(page, perPage, total)}
          </span>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={page * perPage >= total}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
