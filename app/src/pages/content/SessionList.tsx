import { CONTENT_STATUS_LABELS, type ContentStatus, type ContentSubmissionListItem } from './types';
import { WORKLIST_TABS, type WorklistTab } from './worklist';
import { DelayedLoading } from '../../components/DelayedLoading';
import { formatDate } from '../../lib/dates';

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

      {/* v4 mock IA (docs/design/Chautauqua Content.dc.html, DEC-692): five
          columns — Session, Speaker, Latest file, Status, actions. 'Ask for
          changes' moved off this row onto the deliverable-detail screen
          (docs/design/README.md); the row keeps only Approve + Open, Open
          selecting the submission the same way the row click already does. */}
      <table className="chq-table chq-content-table">
        <thead>
          <tr>
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
              <td colSpan={5}>
                <DelayedLoading />
              </td>
            </tr>
          )}
          {loaded && !loading && visible.length === 0 && (
            <tr>
              <td colSpan={5} className="chq-empty">
                No submissions in this view.
              </td>
            </tr>
          )}
          {!loading &&
            visible.map((item) => {
              const [firstSpeaker, ...restSpeakers] = item.speakers;
              return (
                <tr key={item.id} className="chq-content-row" onClick={() => onSelect(item.id)}>
                  <td className="chq-content-row-session">
                    <div className="chq-content-row-title">{item.title}</div>
                    <div className="chq-content-row-ref">{item.ref}</div>
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
                  <td className="chq-content-row-latest-file">
                    {item.latestFile ? (
                      <>
                        <div className="chq-content-latest-file-name">
                          {item.latestFile.filename} · v{item.latestFile.versionCount}
                        </div>
                        <div className="chq-content-latest-file-date">{formatDate(item.latestFile.uploadedAt)}</div>
                      </>
                    ) : (
                      <span className="chq-content-latest-file-empty">No files yet</span>
                    )}
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
                    <button type="button" className="chq-btn chq-btn-secondary" onClick={() => onSelect(item.id)}>
                      Open
                    </button>
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
