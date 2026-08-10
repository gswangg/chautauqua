import type { DragEvent } from 'react';
import type { AgendaConflict, AgendaTrack, UnscheduledAgendaSession } from './types';
import { SessionCard } from './SessionCard';

interface UnscheduledTrayProps {
  sessions: UnscheduledAgendaSession[];
  tracks: AgendaTrack[];
  conflicts: AgendaConflict[];
  onDropUnschedule: (submissionId: string) => void;
}

/** Drag source AND drop target: dragging a placed card back here unschedules
 * it (DEC-021). Shows a persistent count in its header. */
export function UnscheduledTray({ sessions, tracks, conflicts, onDropUnschedule }: UnscheduledTrayProps) {
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const submissionId = e.dataTransfer.getData('text/plain');
    if (submissionId) onDropUnschedule(submissionId);
  }

  return (
    <div className="chq-unscheduled-tray" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="chq-unscheduled-tray-header">Unscheduled ({sessions.length})</div>
      <div className="chq-unscheduled-tray-list">
        {sessions.length === 0 && <p className="chq-unscheduled-tray-empty">All accepted sessions are placed.</p>}
        {sessions.map((session) => (
          <SessionCard key={session.submissionId} session={session} tracks={tracks} conflicts={conflicts} />
        ))}
      </div>
    </div>
  );
}
