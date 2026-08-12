import type { DragEvent } from 'react';
import type { AgendaConflict, AgendaTrack, UnscheduledAgendaSession } from './types';
import { SessionCard } from './SessionCard';
import type { ArmedAgendaSession } from './DayGrid';

interface UnscheduledTrayProps {
  sessions: UnscheduledAgendaSession[];
  tracks: AgendaTrack[];
  conflicts: AgendaConflict[];
  onDropUnschedule: (submissionId: string) => void;
  /** Keyboard/click placement path (DEC-570): armed session, if any, and the
   * arming callback. Unscheduled cards have no slot of their own, so
   * clicking one always (re-)arms it rather than placing anything. */
  armed?: ArmedAgendaSession | null;
  onArm?: (session: ArmedAgendaSession) => void;
}

const UNSCHEDULED_DURATION_MIN = 30;

/** Drag source AND drop target: dragging a placed card back here unschedules
 * it (DEC-021). Shows a persistent count in its header. */
export function UnscheduledTray({ sessions, tracks, conflicts, onDropUnschedule, armed, onArm }: UnscheduledTrayProps) {
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
          <SessionCard
            key={session.submissionId}
            session={session}
            tracks={tracks}
            conflicts={conflicts}
            dragHandle
            selected={armed?.submissionId === session.submissionId}
            onSelect={
              onArm
                ? () =>
                    onArm({
                      submissionId: session.submissionId,
                      ref: session.ref,
                      title: session.title,
                      durationMin: UNSCHEDULED_DURATION_MIN,
                    })
                : undefined
            }
          />
        ))}
      </div>
      <p className="chq-unscheduled-tray-hint">Drag to a slot &middot; drag back to unschedule</p>
    </div>
  );
}
