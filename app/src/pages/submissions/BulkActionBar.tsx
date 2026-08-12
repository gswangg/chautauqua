import { STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionStatus } from './types';

interface BulkActionBarProps {
  selectedCount: number;
  pending: boolean;
  onApply: (status: SubmissionStatus) => void;
  onClear: () => void;
}

export function BulkActionBar({ selectedCount, pending, onApply, onClear }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="chq-submissions-bulkbar" role="toolbar" aria-label="Bulk actions">
      <span className="chq-submissions-bulkbar-count">{selectedCount} selected</span>
      <span className="chq-submissions-bulkbar-note">Kept across pages · sent in batches of 100</span>
      <div className="chq-submissions-bulkbar-actions">
        {SUBMISSION_STATUSES.map((status, index) => (
          <button
            key={status}
            type="button"
            className={index === 0 ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
            disabled={pending}
            onClick={() => onApply(status)}
          >
            Mark {STATUS_LABELS[status]}
          </button>
        ))}
        <button type="button" className="chq-btn chq-btn-tertiary" disabled={pending} onClick={onClear}>
          Clear selection
        </button>
      </div>
    </div>
  );
}
