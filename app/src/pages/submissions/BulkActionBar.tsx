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
    <div className="chq-bulk-action-bar" role="toolbar" aria-label="Bulk actions">
      <span>{selectedCount} selected</span>
      {SUBMISSION_STATUSES.map((status) => (
        <button key={status} type="button" disabled={pending} onClick={() => onApply(status)}>
          Mark {STATUS_LABELS[status]}
        </button>
      ))}
      <button type="button" disabled={pending} onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}
