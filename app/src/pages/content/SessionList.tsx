import {
  CONTENT_STATUS_LABELS,
  DELIVERABLE_KINDS,
  DELIVERABLE_LABELS,
  type ContentStatus,
  type ContentSubmissionListItem,
} from './types';
import { filterByContentStatus, sortForWorklist, WORKLIST_TABS, type WorklistTab } from './worklist';

const TAB_LABELS: Record<WorklistTab, string> = {
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
  // CNT-12: always-visible per-row content-status control, so approval
  // doesn't require drilling into a submission's deliverable detail first.
  onContentStatusChange: (submissionId: string, status: ContentStatus) => void;
}

export function SessionList({ items, tab, onTabChange, onSelect, loading, onContentStatusChange }: SessionListProps) {
  const visible = sortForWorklist(filterByContentStatus(items, tab));

  return (
    <div className="chq-content-worklist">
      <div className="chq-tab-bar" role="tablist">
        {WORKLIST_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'chq-tab active' : 'chq-tab'}
            onClick={() => onTabChange(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <table className="chq-content-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Title</th>
            <th>Speakers</th>
            <th>Content status</th>
            <th>Content actions</th>
            {DELIVERABLE_KINDS.map((kind) => (
              <th key={kind}>{DELIVERABLE_LABELS[kind]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5 + DELIVERABLE_KINDS.length}>Loading...</td>
            </tr>
          )}
          {!loading && visible.length === 0 && (
            <tr>
              <td colSpan={5 + DELIVERABLE_KINDS.length}>No submissions in this view.</td>
            </tr>
          )}
          {!loading &&
            visible.map((item) => (
              <tr key={item.id} className="chq-content-row" onClick={() => onSelect(item.id)} style={{ cursor: 'pointer' }}>
                <td>{item.ref}</td>
                <td>{item.title}</td>
                <td>{item.speakers.map((s) => s.name).join(', ')}</td>
                <td>
                  <span className={`chq-status-pill chq-content-status-${item.contentStatus}`}>
                    {CONTENT_STATUS_LABELS[item.contentStatus]}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={item.contentStatus === 'approved'}
                    onClick={() => onContentStatusChange(item.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={item.contentStatus === 'changes_requested'}
                    onClick={() => onContentStatusChange(item.id, 'changes_requested')}
                  >
                    Request changes
                  </button>
                </td>
                {DELIVERABLE_KINDS.map((kind) => (
                  <td key={kind}>{item.deliverableCounts?.[kind] ?? 0}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
