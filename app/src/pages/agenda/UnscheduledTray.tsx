import type { DragEvent } from 'react';
import type { AgendaConflict, AgendaTrack, DescribedUnplaced, UnscheduledAgendaSession } from './types';
import { SessionCard } from './SessionCard';
import type { ArmedAgendaSession } from './DayGrid';

interface UnscheduledTrayProps {
  sessions: UnscheduledAgendaSession[];
  tracks: AgendaTrack[];
  conflicts: AgendaConflict[];
  /** DEC-615: per-item reasons from the most recent auto-schedule run,
   * keyed by submissionId — a session with no entry has simply never been
   * through the placer (never run, or run and succeeded). */
  unplacedReasons: DescribedUnplaced[];
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
export function UnscheduledTray({
  sessions,
  tracks,
  conflicts,
  unplacedReasons,
  onDropUnschedule,
  armed,
  onArm,
}: UnscheduledTrayProps) {
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const submissionId = e.dataTransfer.getData('text/plain');
    if (submissionId) onDropUnschedule(submissionId);
  }

  const reasonBySubmissionId = new Map(unplacedReasons.map((u) => [u.submissionId, u]));

  return (
    <div className="chq-unscheduled-tray" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="chq-unscheduled-tray-header">
        <span>Unscheduled</span>
        <span className="chq-unscheduled-tray-count">{` (${sessions.length})`}</span>
      </div>
      <div className="chq-unscheduled-tray-list">
        {sessions.length === 0 && <p className="chq-unscheduled-tray-empty">All accepted sessions are placed.</p>}
        {sessions.map((session) => {
          const reason = reasonBySubmissionId.get(session.submissionId);
          // DEC-615/DEC-900: the tray shows the duration a placement of this
          // session would actually use — the reason the last auto-schedule
          // run computed for it if there is one, otherwise the same
          // UNSCHEDULED_DURATION_MIN fallback the click-to-arm path below
          // uses, so the printed minutes always match what arming produces.
          const durationMin = reason?.durationMin ?? UNSCHEDULED_DURATION_MIN;
          return (
            <div key={session.submissionId} className="chq-unscheduled-tray-item">
              <SessionCard
                session={session}
                tracks={tracks}
                conflicts={conflicts}
                className="chq-unscheduled-tray-card"
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
              <p className="chq-unscheduled-tray-duration">{`· ${durationMin} min`}</p>
              {reason && <p className="chq-unscheduled-reason">{reason.detail}</p>}
            </div>
          );
        })}
      </div>
      <p className="chq-unscheduled-tray-hint">
        Click a session, then click a time slot &middot; drag back to unschedule
      </p>
    </div>
  );
}
