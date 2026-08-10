import type { AgendaConflict } from './types';

interface ConflictChipProps {
  conflicts: AgendaConflict[];
  submissionId: string;
}

/** Warning chip for a session card, listing the kind(s) of conflict it's
 * involved in; full detail surfaces on the title/hover per DEC-021. */
export function ConflictChip({ conflicts, submissionId }: ConflictChipProps) {
  const mine = conflicts.filter((c) => c.submissionIds.includes(submissionId));
  if (mine.length === 0) return null;

  const kinds = [...new Set(mine.map((c) => c.kind))];
  const label = kinds
    .map((k) => (k === 'room_overlap' ? 'Room' : 'Speaker'))
    .join(' + ');
  const title = mine.map((c) => c.detail).join('\n');

  return (
    <span className="chq-conflict-chip" title={title}>
      ⚠ {label} conflict
    </span>
  );
}
