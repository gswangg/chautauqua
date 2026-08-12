import type { AgendaConflict } from './types';

interface ConflictChipProps {
  conflicts: AgendaConflict[];
  submissionId: string;
}

/** The human wording for a single conflict `kind` (DEC-557/DEC-589/DEC-701) —
 * the ONE place this vocabulary is spelled out. Overview.tsx (the worklist's
 * "04 — Unplaced sessions and conflicts" section) imports this rather than
 * keeping a second copy, which is exactly how the raw `room_overlap` enum
 * leaked into that page's rendered output before. `count` is the number of
 * sessions actually sharing the slot — assignLanes (gridMath.ts) already
 * proves a room can hold N > 2 overlapping sessions, so the wording must
 * count instead of assuming a pair ("Two sessions in one room").
 * `speaker_overlap` has no room-count analogue and keeps its fixed caption. */
export function conflictKindLabel(kind: 'room_overlap' | 'speaker_overlap', count = 2): string {
  if (kind !== 'room_overlap') return 'Speaker double-booked';
  return `${numberWord(count)} session${count === 1 ? '' : 's'} in one room`;
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
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
  const roomConflicts = mine.filter((c) => c.kind === 'room_overlap');
  const hasRoom = roomConflicts.length > 0;
  const hasSpeaker = mine.some((c) => c.kind === 'speaker_overlap');
  // DEC-701: conflicts are recorded pairwise (each entry's submissionIds is
  // exactly two), so a 3-way room clash surfaces as 2 pairs touching this
  // submission. The union of every submissionId across this submission's
  // room_overlap pairs IS the full clashing set (each other session in the
  // slot appears in at least one pair with this one), so its size is the
  // true count — never assume a pair.
  const roomCount = new Set(roomConflicts.flatMap((c) => c.submissionIds)).size;
  const caption =
    hasRoom && hasSpeaker
      ? 'Room & speaker conflict'
      : conflictKindLabel(hasSpeaker ? 'speaker_overlap' : 'room_overlap', roomCount);

  return (
    <span className="chq-conflict-caption" title={title}>
      {caption}
    </span>
  );
}
