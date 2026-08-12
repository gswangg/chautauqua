import {
  CONTENT_STATUS_LABELS,
  FILE_KINDS,
  DELIVERABLE_LABELS,
  type ContentStatus,
  type ContentSubmissionListItem,
} from './types';
import { WORKLIST_TABS, type WorklistTab } from './worklist';
import { DelayedLoading } from '../../components/DelayedLoading';

export const TAB_LABELS: Record<WorklistTab, string> = {
  all: 'All',
  changes_requested: 'Changes requested',
  pending: 'Pending',
  approved: 'Approved',
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
}: SessionListProps) {
  const visible = items;
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="chq-content-worklist">
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
          </button>
        ))}
      </div>

      {/* DEC-609: four fixed columns regardless of FILE_KINDS count —
          Session (ref/title/speakers stacked), Deliverables (one chip per
          kind, absent kinds shown explicitly rather than as a bare 0),
          Content status, Actions. A kind never gets its own header/column,
          so adding a kind can't widen the table or push counts away from
          the session they describe. */}
      <table className="chq-table chq-content-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Deliverables</th>
            <th>Content status</th>
            <th>Content actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4}>
                <DelayedLoading />
              </td>
            </tr>
          )}
          {loaded && !loading && visible.length === 0 && (
            <tr>
              <td colSpan={4} className="chq-empty">
                No submissions in this view.
              </td>
            </tr>
          )}
          {!loading &&
            visible.map((item) => (
              <tr key={item.id} className="chq-content-row" onClick={() => onSelect(item.id)}>
                <td className="chq-content-row-session">
                  <div className="chq-content-row-title">
                    {item.ref} · {item.title}
                  </div>
                  <div className="chq-content-row-speakers">
                    {item.speakers.length > 0 ? item.speakers.map((s) => s.name).join(', ') : 'No speakers'}
                  </div>
                </td>
                <td className="chq-content-deliverables">
                  {FILE_KINDS.map((kind) => {
                    const count = item.deliverableCounts[kind];
                    return count > 0 ? (
                      <span key={kind} className="chq-content-deliverable-chip">
                        {DELIVERABLE_LABELS[kind]} · {count}
                      </span>
                    ) : (
                      <span key={kind} className="chq-content-deliverable-chip is-absent">
                        {DELIVERABLE_LABELS[kind]} —
                      </span>
                    );
                  })}
                </td>
                <td>
                  <span
                    className={
                      item.contentStatus === 'changes_requested' ? 'chq-flag' : 'chq-flag chq-content-status-muted'
                    }
                  >
                    {CONTENT_STATUS_LABELS[item.contentStatus]}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()} className="chq-content-actions">
                  <button
                    type="button"
                    className="chq-btn chq-btn-primary"
                    disabled={item.contentStatus === 'approved'}
                    onClick={() => onContentStatusChange(item.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="chq-btn chq-btn-secondary"
                    disabled={item.contentStatus === 'changes_requested'}
                    onClick={() => onContentStatusChange(item.id, 'changes_requested')}
                  >
                    Ask for changes
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <div className="chq-content-pager">
        <button type="button" className="chq-btn chq-btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span>
          Showing {rangeStart}-{rangeEnd} of {total}
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
