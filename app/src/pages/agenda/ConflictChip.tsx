import type { AgendaConflict } from './types';
// DEC-615 (wave 71 amendment): conflictKindLabel moved to
// src/domain/schedule-copy.ts (re-exported via the schedule-vocabulary
// crossing module) so SSR/domain callers can reach it without importing a
// component file. This file keeps its own conflictChipLabel-style
// composition (captionForConflicts/clusterConflictCaption below) local —
// only the single-kind label moved.
import { conflictKindLabel } from '../../lib/schedule-vocabulary';

interface ConflictChipProps {
  conflicts: AgendaConflict[];
  submissionId: string;
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
