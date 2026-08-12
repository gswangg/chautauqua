import type { AgendaConflict } from './types';

interface ConflictChipProps {
  conflicts: AgendaConflict[];
  submissionId: string;
}

/** The human wording for a single conflict `kind` (DEC-557/DEC-589) — the
 * ONE place this vocabulary is spelled out. Overview.tsx (the worklist's
 * "04 — Unplaced sessions and conflicts" section) imports this rather than
 * keeping a second copy, which is exactly how the raw `room_overlap` enum
 * leaked into that page's rendered output before. */
export function conflictKindLabel(kind: 'room_overlap' | 'speaker_overlap'): string {
  return kind === 'room_overlap' ? 'Two sessions in one room' : 'Speaker double-booked';
}

/** Caption for a conflicted session card (DEC-367/369 redesign): the card
 * itself inverts to ink/on-ink (see SessionCard's `chq-session-card-conflict`
 * class); this renders the caption inside it — no red chip, since the
 * redesign's palette has no third accent and lateness/clash are always type,
 * never colour. The write is never blocked (DEC-010, warn-never-block); full
 * per-conflict detail (which two sessions, which room) surfaces on hover via
 * the title attribute. */
export function ConflictChip({ conflicts, submissionId }: ConflictChipProps) {
  const mine = conflicts.filter((c) => c.submissionIds.includes(submissionId));
  if (mine.length === 0) return null;

  const title = mine.map((c) => c.detail).join('\n');

  // DEC-557: the caption is derived from `kind`, never assumed — a
  // speaker_overlap must never render the room caption and vice versa.
  const hasRoom = mine.some((c) => c.kind === 'room_overlap');
  const hasSpeaker = mine.some((c) => c.kind === 'speaker_overlap');
  const caption =
    hasRoom && hasSpeaker
      ? 'Room & speaker conflict'
      : conflictKindLabel(hasSpeaker ? 'speaker_overlap' : 'room_overlap');

  return (
    <span className="chq-conflict-caption" title={title}>
      {caption}
    </span>
  );
}
