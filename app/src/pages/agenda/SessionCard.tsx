import type { CSSProperties, DragEvent } from 'react';
import type { AgendaConflict, AgendaSessionBase, AgendaTrack } from './types';
import { ConflictChip } from './ConflictChip';

export const AGENDA_DRAG_MIME = 'application/x-chq-submission-id';

interface SessionCardProps {
  session: AgendaSessionBase;
  tracks: AgendaTrack[];
  conflicts: AgendaConflict[];
  style?: CSSProperties;
  className?: string;
  /** Placed cards fully cover the day-grid cell(s) beneath them (DEC-021
   * warn-never-block: an organizer must be able to drop a session directly
   * onto an already-occupied slot to intentionally create a room/speaker
   * conflict, since the conflict is only a warning, never a block). Without
   * these, the browser resolves the drop target to this card's own DOM
   * node instead of the grid cell underneath, and — because this card had
   * no onDrop handler — the drop was silently swallowed (verified via a
   * live browser drag: dropping a session directly onto an already-placed
   * card was a complete no-op, so a drag-drop conflict could never
   * actually be created through the UI). DayGrid passes its own
   * onDragOver/onDrop through so an occupied card is just as valid a drop
   * target as an empty cell. */
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
}

/** Drag-drop source card for a session; track colors render as a left
 * accent border (DEC-021). Draggable via HTML5 DnD, carrying the submission
 * id as plain text + a scoped MIME type. */
export function SessionCard({ session, tracks, conflicts, style, className, onDragOver, onDrop }: SessionCardProps) {
  const accentColor = tracks.find((t) => session.trackIds.includes(t.id))?.color ?? undefined;

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData(AGENDA_DRAG_MIME, session.submissionId);
    e.dataTransfer.setData('text/plain', session.submissionId);
    if ('startMin' in session && 'endMin' in session) {
      const placed = session as unknown as { startMin: number; endMin: number };
      e.dataTransfer.setData('application/x-chq-duration-min', String(placed.endMin - placed.startMin));
    }
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      className={`chq-session-card${className ? ` ${className}` : ''}`}
      style={{ borderLeftColor: accentColor ?? 'var(--chq-border)', ...style }}
      draggable
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-submission-id={session.submissionId}
    >
      <div className="chq-session-card-ref">{session.ref}</div>
      <div className="chq-session-card-title">{session.title}</div>
      {session.speakers.length > 0 && (
        <div className="chq-session-card-speakers">
          {session.speakers.map((s) => s.name).join(', ')}
        </div>
      )}
      <ConflictChip conflicts={conflicts} submissionId={session.submissionId} />
    </div>
  );
}
