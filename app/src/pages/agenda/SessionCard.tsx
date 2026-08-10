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
}

/** Drag-drop source card for a session; track colors render as a left
 * accent border (DEC-021). Draggable via HTML5 DnD, carrying the submission
 * id as plain text + a scoped MIME type. */
export function SessionCard({ session, tracks, conflicts, style, className }: SessionCardProps) {
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
