import { useEffect, useRef } from 'react';
import { DELIVERABLE_LABELS, FILE_KINDS, type ContentStatus, type ContentSubmissionListItem } from './types';
import { WORKLIST_TABS, worklistStatusLabel, worklistStatusEmphasisClass, type WorklistTab } from './worklist';
import { DelayedLoading } from '../../components/DelayedLoading';
import { formatRelativeDays, formatDayLabel } from '../../lib/dates';
import { paginationSummary } from '../../lib/pagination-summary';

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

/** Render minutes-from-midnight as a zero-padded HH:MM clock time (same
 * grammar as DeliverableDetail.tsx / submissions/schedule.ts). */
function formatClockTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ROOM_TBA_LABEL = 'To be announced';

/** w41-b (DEC-902 amendment): the worklist SESSION cell's subtitle --
 * 'REF · <day> <start>, <room>' once placed on the agenda, or the bare ref
 * (no '· ,' residue) when the submission hasn't been scheduled yet. */
function formatSessionSubtitle(item: ContentSubmissionListItem): string {
  if (!item.scheduled) return item.ref;
  const dayLabel = formatDayLabel(item.scheduled.day);
  const timeLabel = formatClockTime(item.scheduled.startMin);
  const roomLabel = item.scheduled.roomName ?? ROOM_TBA_LABEL;
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
  onBulkApprove: () => void | Promise<void>;
  bulkPending: boolean;
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
  onBulkApprove,
  bulkPending,
}: SessionListProps) {
  const visible = items;
  const pageIds = visible.map((item) => item.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  // DEC-825 amendment (wave 25, ruling A1): pre-tick re-uploads only, once
  // per `items` identity (a fresh page/tab load or refresh) — never
  // 'Not reviewed' rows, and never fighting a tick the user makes
  // afterwards. Keyed on the items array reference so this seeds exactly
  // once per fetch, not on every render.
  const seededForRef = useRef<ContentSubmissionListItem[] | null>(null);
  useEffect(() => {
    if (seededForRef.current === items) return;
    seededForRef.current = items;
    const reuploaded = items.filter((item) => worklistStatusLabel(item.contentStatus, item.reuploaded) === 'Re-uploaded');
    if (reuploaded.length === 0) return;
    onSelectionChange(new Set(reuploaded.map((item) => item.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
    <div className="chq-content-worklist">
      {/* DEC-825 amendment (wave 25, ruling A1): the section rule carries no
          action now — bulk approval lives in the bar below, scoped to the
          ticked rows, so this rule never competes with it as a second
          primary. */}
      <div className="chq-section-head chq-content-worklist-head">
        <h2 className="chq-section-label">Worklist</h2>
      </div>
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
      {selectedIds.size > 0 && (
        <div className="chq-bulkbar" role="toolbar" aria-label="Bulk content actions">
          <span className="chq-bulkbar-count">{selectedIds.size} selected</span>
          <span className="chq-bulkbar-note">Approving sends nothing · the speaker sees it in their portal</span>
          <div className="chq-bulkbar-actions">
            <button type="button" className="chq-btn chq-btn-primary" disabled={bulkPending} onClick={onBulkApprove}>
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
        </div>
      )}

      {/* v4 mock IA (docs/design/Chautauqua Content.dc.html, DEC-692): five
          columns — Session, Speaker, Latest file, Status, actions. 'Ask for
          changes' moved off this row onto the deliverable-detail screen
          (docs/design/README.md); the row keeps only Approve + Open, Open
          selecting the submission the same way the row click already does. */}
      <table className="chq-table chq-content-table">
        <thead>
          <tr>
            {/* DEC-825 amendment: selection column leads the DEC-692 column
                set (Session · Speaker · Latest file · Status · actions) —
                bulk selection is added TO that IA, it does not replace it. */}
            <th>
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
            <th>Speaker</th>
            <th>Latest file</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={6}>
                <DelayedLoading />
              </td>
            </tr>
          )}
          {/* DEC-881: the default tab is now 'needs_decision' — its empty
              state must read honestly ("nothing needs a decision") rather
              than defaulting away from the frame (which is what DEC-665's
              'all' default did), and offers one click to All so an empty
              needs-decision queue never reads as an empty event. */}
          {loaded && !loading && visible.length === 0 && tab === 'needs_decision' && (
            <tr>
              <td colSpan={6} className="chq-empty">
                Nothing needs a decision right now.{' '}
                <button type="button" className="chq-link-button" onClick={() => onTabChange('all')}>
                  View all accepted sessions
                </button>
              </td>
            </tr>
          )}
          {loaded && !loading && visible.length === 0 && tab !== 'needs_decision' && (
            <tr>
              <td colSpan={6} className="chq-empty">
                No submissions in this view.
              </td>
            </tr>
          )}
          {!loading &&
            visible.map((item) => {
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
    </div>
  );
}
