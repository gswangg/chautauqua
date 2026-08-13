import type { SubmissionStatus } from './types';

interface BulkActionBarProps {
  selectedCount: number;
  pending: boolean;
  statusFilter: SubmissionStatus | null;
  onApply: (status: SubmissionStatus) => void;
  onClear: () => void;
  onDelete: () => void;
}

interface BulkMove {
  status: SubmissionStatus;
  label: string;
  primary: boolean;
}

// DEC-752: the bulk bar offers the three moves relevant to the row's current
// stage, not all six statuses as equal buttons -- a "waitlisted" row does not
// need a "Mark waitlisted" button, it needs a way OUT.
function movesFor(statusFilter: SubmissionStatus | null): BulkMove[] {
  if (statusFilter === 'accept_queue') {
    return [
      { status: 'accepted', label: 'Mark accepted', primary: true },
      { status: 'decline_queue', label: 'Decline queue', primary: false },
      { status: 'waitlisted', label: 'Waitlist', primary: false },
    ];
  }
  if (statusFilter === 'decline_queue') {
    return [
      { status: 'declined', label: 'Mark declined', primary: true },
      { status: 'accept_queue', label: 'Accept queue', primary: false },
      { status: 'waitlisted', label: 'Waitlist', primary: false },
    ];
  }
  return [
    { status: 'accept_queue', label: 'Move to accept queue', primary: true },
    { status: 'decline_queue', label: 'Decline queue', primary: false },
    { status: 'waitlisted', label: 'Waitlist', primary: false },
  ];
}

export function BulkActionBar({ selectedCount, pending, statusFilter, onApply, onClear, onDelete }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="chq-submissions-bulkbar" role="toolbar" aria-label="Bulk actions">
      <span className="chq-submissions-bulkbar-count">{selectedCount} selected</span>
      <span className="chq-submissions-bulkbar-note">Kept across pages · sent in batches of 100</span>
      <div className="chq-submissions-bulkbar-actions">
        {movesFor(statusFilter).map((move) => (
          <button
            key={move.status}
            type="button"
            className={move.primary ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
            disabled={pending}
            onClick={() => onApply(move.status)}
          >
            {move.label}
          </button>
        ))}
        <button type="button" className="chq-btn chq-btn-tertiary" disabled={pending} onClick={onDelete}>
          Delete…
        </button>
        <button type="button" className="chq-btn chq-btn-tertiary" disabled={pending} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
