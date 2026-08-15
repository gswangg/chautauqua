import type { AgendaConflict } from './types';
import { plural, spellCount } from '../../lib/plural';

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
 * `speaker_overlap` has no room-count analogue and keeps its fixed caption.
 * `break_overlap` (DEC-557 amendment, wave 71) likewise has a fixed caption
 * — a session scheduled over a break has exactly one participant, never a
 * count of clashing sessions. */
export function conflictKindLabel(kind: 'room_overlap' | 'speaker_overlap' | 'break_overlap', count = 2): string {
  if (kind === 'speaker_overlap') return 'Speaker double-booked';
  if (kind === 'break_overlap') return 'Scheduled over a break';
  return `${numberWord(count)} ${plural(count, 'session')} in one room`;
}

// DEC-925 (amendment, wave 52): spells its count via the shared
// src/domain/count-copy.ts spellCount (0-10 word, numeral above), then
// capitalizes for the chip's sentence-head position -- the same
// capitalize-the-result pattern root.tsx and ErrorSummary.tsx use.
function numberWord(n: number): string {
  const word = spellCount(n);
  return word.length === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/** DEC-557 amendment (wave 48): the caption logic for a SET of conflicts
 * touching a SET of submissions (a single card's own conflicts, or an
 * entire merged clash cluster's union) — the one place this derivation
 * lives, so ConflictChip and DayGrid's clash card can never disagree on
 * what "kind" a group of conflicts is. `conflicts` should already be
 * filtered to the ones relevant to `submissionIds` (ConflictChip filters to
 * a single card's own conflicts; DayGrid passes the full conflict list
 * scoped to a cluster's member ids — see clusterConflictCaption below for
 * the cluster case). Returns null when there is nothing to caption. */
function captionForConflicts(mine: AgendaConflict[]): string | null {
  if (mine.length === 0) return null;
  // DEC-557: the caption is derived from `kind`, never assumed — a
  // speaker_overlap must never render the room caption and vice versa.
  const roomConflicts = mine.filter((c) => c.kind === 'room_overlap');
  const hasRoom = roomConflicts.length > 0;
  const hasSpeaker = mine.some((c) => c.kind === 'speaker_overlap');
  const hasBreak = mine.some((c) => c.kind === 'break_overlap');
  if (!hasRoom && !hasSpeaker && !hasBreak) return null;
  // DEC-701: conflicts are recorded pairwise (each entry's submissionIds is
  // exactly two), so a 3-way room clash surfaces as 2 pairs touching this
  // submission. The union of every submissionId across this submission's
  // room_overlap pairs IS the full clashing set (each other session in the
  // slot appears in at least one pair with this one), so its size is the
  // true count — never assume a pair.
  const roomCount = new Set(roomConflicts.flatMap((c) => c.submissionIds)).size;
  // DEC-557 amendment (wave 71): precedence is pinned — room+speaker beats
  // either alone, room beats speaker, speaker beats break, and a break-only
  // set gets its own caption rather than falling through to null.
  if (hasRoom && hasSpeaker) return 'Room & speaker conflict';
  if (hasRoom) return conflictKindLabel('room_overlap', roomCount);
  if (hasSpeaker) return conflictKindLabel('speaker_overlap');
  return conflictKindLabel('break_overlap');
}

/** DEC-557 amendment (wave 48): caption for a DayGrid merged clash cluster.
 * `conflicts` is the full agenda conflict list; `submissionIds` are the
 * cluster's member ids. A conflict counts toward the cluster's caption when
 * its pair INTERSECTS the cluster — mirroring the single-card `mine` filter
 * above (`c.submissionIds.includes(submissionId)`) generalised to a set —
 * so a clustered session's speaker_overlap with a session outside the
 * cluster (e.g. the same speaker double-booked into a different room) is
 * still announced on the card, not just same-room room_overlap pairs.
 * Returns null for an empty intersection (e.g. two room-less sessions
 * overlapping in time have no room_overlap record — schedule.ts never
 * emits one for a null roomId — and, absent a shared speaker, no conflict
 * at all) — callers must not render a clash caption in that case. */
export function clusterConflictCaption(conflicts: AgendaConflict[], submissionIds: string[]): string | null {
  const ids = new Set(submissionIds);
  const relevant = conflicts.filter((c) => c.submissionIds.some((id) => ids.has(id)));
  return captionForConflicts(relevant);
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
  const caption = captionForConflicts(mine);

  return (
    <span className="chq-conflict-caption" title={title}>
      {caption}
    </span>
  );
}
