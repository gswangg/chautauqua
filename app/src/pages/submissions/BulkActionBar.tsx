import { Link } from 'react-router-dom';
import { countOf } from '../../lib/plural';
import { MAX_COMPOSE_RECIPIENTS } from '../../lib/merge-fields';
import type { SubmissionStatus } from './types';

interface BulkActionBarProps {
  selectedCount: number;
  pending: boolean;
  statusFilter: SubmissionStatus | null;
  onApply: (status: SubmissionStatus) => void;
  onClear: () => void;
  // DEC-967 (findings wave 8, w8-b): the ids backing selectedCount, in
  // stable selection order -- carried into Comms via the "Email these N
  // submissions" link so decide -> notify never asks for the same
  // selection twice.
  selectedIds: string[];
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

export function BulkActionBar({ selectedCount, pending, statusFilter, onApply, onClear, selectedIds }: BulkActionBarProps) {
  // User-filed (gate-12 era): never unmount — idle renders the same box
  // invisible (.chq-bulkbar-idle) so first selection cannot shift the
  // table under the cursor.
  const idle = selectedCount === 0;

  // DEC-967 (findings wave 8, w8-b): the compose link carries at most
  // MAX_COMPOSE_RECIPIENTS ids, in the selection's own (stable) order --
  // never a silent truncation, the over-cap case gets its own sentence
  // below instead.
  const emailIds = selectedIds.slice(0, MAX_COMPOSE_RECIPIENTS);
  const overCap = selectedIds.length > MAX_COMPOSE_RECIPIENTS;

  return (
    <div
      className={idle ? 'chq-submissions-bulkbar chq-bulkbar chq-bulkbar-idle' : 'chq-submissions-bulkbar chq-bulkbar'}
      role="toolbar"
      aria-label="Bulk actions"
      aria-hidden={idle ? 'true' : undefined}
    >
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
        <Link
          to={`/comms?tab=compose&ids=${emailIds.join(',')}`}
          className="chq-btn chq-btn-secondary"
        >
          Email these {countOf(emailIds.length, 'submission')}
        </Link>
        <button type="button" className="chq-btn chq-btn-tertiary" disabled={pending} onClick={onClear}>
          Clear
        </button>
      </div>
      {overCap && (
        <span className="chq-submissions-bulkbar-note">
          first {MAX_COMPOSE_RECIPIENTS} of {selectedIds.length} · a send is capped at {MAX_COMPOSE_RECIPIENTS}
        </span>
      )}
    </div>
  );
}
