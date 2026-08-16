import { useState } from 'react';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';
import { buildPhoneSlots } from './phoneSlots';
import { clockHHMM } from '../../lib/clock';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { countOf } from '../../lib/plural';
import { usePendingLabel } from '../../components/PendingAction';

interface Armed {
  submissionId: string;
  ref: string;
  title: string;
  durationMin: number;
  /** Whether this session was armed from an already-placed card (offers an
   * Unschedule action in the footer alongside Cancel) or from the
   * unscheduled sheet (Cancel only — there is nothing to unschedule yet). */
  origin: 'placed' | 'unscheduled';
}

interface PhoneAgendaProps {
  day: string;
  rooms: AgendaRoom[];
  placed: PlacedAgendaSession[];
  unscheduled: UnscheduledAgendaSession[];
  conflicts: AgendaConflict[];
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  onPlace: (submissionId: string, roomId: string | null, startMin: number, endMin: number) => void;
  onUnschedule: (submissionId: string) => void;
  onAutoSchedule: () => void;
  autoScheduling: boolean;
}

const TBD_ROOM_ID = null;
/** UnscheduledAgendaSession carries no duration (DEC-380): an unscheduled
 * session always places as a 30-minute block, matching DayGrid's existing
 * durationForDrag fallback. Re-arming a placed card instead preserves its
 * own endMin-startMin. */
const DEFAULT_PLACE_DURATION_MIN = 30;

function roomLabel(room: AgendaRoom | undefined): string {
  return room ? room.name : 'TBD';
}

// DEC-557 amendment (wave 71): the room chip's CLASH marker claims a room
// clash specifically — restrict to the kinds that actually implicate two
// sessions sharing a room (room_overlap, speaker_overlap) so a break_overlap
// (a session over a break, unrelated to which room it's in) doesn't
// silently light up a room chip's CLASH flag.
function roomHasConflict(roomId: string | null, day: string, placed: PlacedAgendaSession[], conflicts: AgendaConflict[]): boolean {
  const roomSessionIds = new Set(placed.filter((s) => s.day === day && s.roomId === roomId).map((s) => s.submissionId));
  return conflicts.some((c) => c.kind !== 'break_overlap' && c.submissionIds.some((id) => roomSessionIds.has(id)));
}

/** Phone tap-to-place agenda (DEC-380): one room at a time, arm a session
 * (from the unscheduled sheet or by tapping a placed/clashed card) then tap
 * a free run to write its slot via the SAME onPlace/onUnschedule handlers
 * the desktop DayGrid/UnscheduledTray already use — no new endpoint, no
 * change to the optimistic write-then-reconcile semantics. Placement never
 * refuses a slot (SPEC J9 / DEC-010): tapping a free run always places,
 * regardless of how much of the run the armed session's duration covers. */
export function PhoneAgenda({
  day,
  rooms,
  placed,
  unscheduled,
  conflicts,
  dayStartMin,
  dayEndMin,
  gridMin,
  onPlace,
  onUnschedule,
  onAutoSchedule,
  autoScheduling,
}: PhoneAgendaProps) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(rooms[0]?.id ?? TBD_ROOM_ID);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // DEC-733 (V11 pending grammar): same auto-schedule operation as the
  // desktop Agenda header button, wired here from the same
  // `autoScheduling` prop the parent already threads down.
  const autoSchedulePendingLabel = usePendingLabel({
    pending: autoScheduling,
    restLabel: 'Auto-schedule',
    participle: 'Auto-scheduling',
  });

  useEscapeKey(sheetOpen, () => setSheetOpen(false));

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const slots = buildPhoneSlots({ placed, day, roomId: activeRoomId, dayStartMin, dayEndMin, gridMin, conflicts });

  function armFromPlaced(session: PlacedAgendaSession) {
    setArmed({
      submissionId: session.submissionId,
      ref: session.ref,
      title: session.title,
      durationMin: session.endMin - session.startMin,
      origin: 'placed',
    });
  }

  function armFromUnscheduled(session: UnscheduledAgendaSession) {
    setArmed({
      submissionId: session.submissionId,
      ref: session.ref,
      title: session.title,
      durationMin: DEFAULT_PLACE_DURATION_MIN,
      origin: 'unscheduled',
    });
    setSheetOpen(false);
  }

  function placeArmedAt(startMin: number) {
    if (!armed) return;
    onPlace(armed.submissionId, activeRoomId, startMin, startMin + armed.durationMin);
    setArmed(null);
  }

  function unscheduleArmed() {
    if (!armed) return;
    onUnschedule(armed.submissionId);
    setArmed(null);
  }

  return (
    <div className="chq-phone-agenda">
      <div className="chq-chipstrip">
        {rooms.map((room) => {
          const active = activeRoomId === room.id;
          const conflicted = roomHasConflict(room.id, day, placed, conflicts);
          return (
            <button
              key={room.id}
              type="button"
              className={`chq-pill chq-phone-room-chip${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => setActiveRoomId(room.id)}
            >
              {room.name}
              {conflicted && <span className="chq-flag">CLASH</span>}
            </button>
          );
        })}
        <button
          type="button"
          className={`chq-pill chq-phone-room-chip${activeRoomId === TBD_ROOM_ID ? ' active' : ''}`}
          aria-pressed={activeRoomId === TBD_ROOM_ID}
          onClick={() => setActiveRoomId(TBD_ROOM_ID)}
        >
          TBD
          {roomHasConflict(TBD_ROOM_ID, day, placed, conflicts) && <span className="chq-flag">CLASH</span>}
        </button>
      </div>

      <div className="chq-phone-slots">
        {slots.map((slot) => {
          const key = `${slot.kind}-${slot.startMin}-${slot.endMin}`;
          const lengthLabel = `${slot.endMin - slot.startMin} min`;

          if (slot.kind === 'placed') {
            const sess = slot.sessions[0]!;
            return (
              <div key={key} className="chq-phone-slot">
                <span className="chq-phone-slot-time">{clockHHMM(slot.startMin)}</span>
                <button type="button" className="chq-phone-slot-card" onClick={() => armFromPlaced(sess)}>
                  <span className="chq-phone-slot-card-meta">
                    {sess.ref} &middot; {lengthLabel}
                  </span>
                  <span className="chq-phone-slot-card-title">{sess.title}</span>
                  {sess.speakers.length > 0 && (
                    <span className="chq-phone-slot-card-meta">{sess.speakers.map((sp) => sp.name).join(', ')}</span>
                  )}
                </button>
                {armed && (
                  <button
                    type="button"
                    className="chq-phone-slot-place-anyway"
                    onClick={() => placeArmedAt(slot.startMin)}
                  >
                    <span className="chq-phone-slot-free-label">Place here anyway</span>
                    <span className="chq-phone-slot-free-length">{lengthLabel}</span>
                  </button>
                )}
              </div>
            );
          }

          if (slot.kind === 'clash') {
            return (
              <div key={key} className="chq-phone-slot">
                <span className="chq-phone-slot-time">{clockHHMM(slot.startMin)}</span>
                <div className="chq-panel chq-phone-slot-clash">
                  <span className="chq-flag">{countOf(slot.sessions.length, 'session')} in this slot</span>
                  {slot.sessions.map((sess, idx) => (
                    <div key={sess.submissionId}>
                      {idx > 0 && <div className="chq-panel-rule" />}
                      <button type="button" className="chq-phone-slot-clash-item" onClick={() => armFromPlaced(sess)}>
                        <span className="chq-phone-slot-card-title">{sess.title}</span>
                        <span className="chq-panel-meta">
                          {sess.speakers.map((sp) => sp.name).join(', ')} &middot; {sess.ref}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                {armed && (
                  <button
                    type="button"
                    className="chq-phone-slot-place-anyway"
                    onClick={() => placeArmedAt(slot.startMin)}
                  >
                    <span className="chq-phone-slot-free-label">Place here anyway</span>
                    <span className="chq-phone-slot-free-length">{lengthLabel}</span>
                  </button>
                )}
              </div>
            );
          }

          // 'free' — only renders as a tap target while a session is armed.
          if (!armed) return null;
          return (
            <div key={key} className="chq-phone-slot">
              <span className="chq-phone-slot-time">{clockHHMM(slot.startMin)}</span>
              <button type="button" className="chq-phone-slot-free" onClick={() => placeArmedAt(slot.startMin)}>
                <span className="chq-phone-slot-free-label">Place here</span>
                <span className="chq-phone-slot-free-length">{lengthLabel} free</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="chq-phone-footer">
        {armed && (
          <div className="chq-phone-footer-armed">
            <div className="chq-phone-footer-armed-info">
              <span className="chq-flag">Placing &middot; tap a free slot</span>
              <span className="chq-phone-footer-armed-title">{armed.title}</span>
              <span className="chq-phone-footer-armed-ref">
                {armed.ref} &middot; {roomLabel(activeRoom)}
              </span>
            </div>
            {armed.origin === 'placed' && (
              <button type="button" className="chq-btn chq-btn-secondary chq-phone-footer-btn" onClick={unscheduleArmed}>
                Unschedule
              </button>
            )}
            <button type="button" className="chq-btn chq-btn-secondary chq-phone-footer-btn" onClick={() => setArmed(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="chq-phone-footer-actions">
          <button type="button" className="chq-btn chq-btn-secondary chq-phone-footer-btn" onClick={() => setSheetOpen(true)}>
            Unscheduled {unscheduled.length}
          </button>
          <button
            type="button"
            className={`chq-btn chq-btn-primary chq-phone-footer-btn ${autoSchedulePendingLabel.buttonProps.className}`.trim()}
            onClick={onAutoSchedule}
            disabled={autoSchedulePendingLabel.buttonProps.disabled}
          >
            {autoSchedulePendingLabel.label}
          </button>
        </div>
      </div>

      {sheetOpen && (
        <div className="chq-scrim" onClick={() => setSheetOpen(false)}>
          <div
            className="chq-modal chq-phone-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Unscheduled sessions"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="chq-modal-title">Unscheduled ({unscheduled.length})</h2>
            {unscheduled.length === 0 && <p>All accepted sessions are placed.</p>}
            <div className="chq-phone-sheet-list">
              {unscheduled.map((session) => (
                <button
                  key={session.submissionId}
                  type="button"
                  className="chq-phone-slot-card"
                  onClick={() => armFromUnscheduled(session)}
                >
                  <span className="chq-phone-slot-card-meta">{session.ref}</span>
                  <span className="chq-phone-slot-card-title">{session.title}</span>
                  {session.speakers.length > 0 && (
                    <span className="chq-phone-slot-card-meta">{session.speakers.map((sp) => sp.name).join(', ')}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="chq-modal-actions">
              <button
                type="button"
                className="chq-btn chq-btn-secondary chq-phone-footer-btn"
                onClick={() => setSheetOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
