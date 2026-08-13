import type { DragEvent, MouseEvent } from 'react';
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
 * it (DEC-021). Also a click target for an armed placed card (DEC-021
 * amendment, w55) — the accessible click/keyboard path lives as an
 * "Unschedule" button in the armed bar (see Agenda.tsx), and clicking
 * anywhere in the tray while that session is armed does the same thing.
 * Shows a persistent count in its header. */
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

  /** DEC-021 amendment (w55): the tray is a click target for an armed
   * PLACED card as well as a drop target — "click the card, click the
   * tray" mirrors "click the card, click a slot" (DayGrid's
   * handleCellPlace). Routes through the SAME onDropUnschedule the drag
   * path already uses — one reader, no second unschedule code path. A
   * click that lands on a tray session card itself is left alone (that
   * click arms/re-arms the clicked card via its own onSelect); only a
   * click elsewhere in the tray (header, background, footer hint) counts
   * as "click the tray". An armed session that IS one of this tray's own
   * cards has nothing to unschedule, so it's excluded too. */
  function handleTrayClick(e: MouseEvent<HTMLDivElement>) {
    if (!armed) return;
    if ((e.target as HTMLElement).closest('.chq-session-card')) return;
    if (sessions.some((s) => s.submissionId === armed.submissionId)) return;
    onDropUnschedule(armed.submissionId);
  }

  return (
    <div className="chq-unscheduled-tray" onDragOver={handleDragOver} onDrop={handleDrop} onClick={handleTrayClick}>
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
        Click a session, then click a time slot &middot; click Unschedule (or drag back) to remove
      </p>
    </div>
  );
}
