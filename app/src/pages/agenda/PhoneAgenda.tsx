import { useState } from 'react';
import type { AgendaConflict, AgendaRoom, AgendaSummary, PlacedAgendaSession, UnscheduledAgendaSession } from './types';
import { buildPhoneSlots } from './phoneSlots';
import type { ScheduleBreakRow } from './BreaksPanel';
import { clockHHMM } from '../../lib/clock';
import { formatDayLabel } from '../../lib/dates';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { capitalizeFirst, plural, spellCount } from '../../lib/plural';
import { usePendingLabel } from '../../components/PendingAction';
import {
  nextFreeSlot,
  conflictMoveLabel,
  type PlacedSession,
  type BlockedInterval,
} from '../../lib/schedule-vocabulary';
import { DEC_895 } from '../../../../src/decisions';

void DEC_895;

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
  /** Every day the event runs (AgendaPayload.days), rendered as the head
   * band's day-pill row, in the order given -- this component never
   * re-sorts it. */
  days: string[];
  onDayChange: (day: string) => void;
  rooms: AgendaRoom[];
  placed: PlacedAgendaSession[];
  unscheduled: UnscheduledAgendaSession[];
  conflicts: AgendaConflict[];
  /** DEC-899: the head band's "N unplaced · M clash" counter reads this
   * directly -- it is never re-derived from `unscheduled`/`conflicts`,
   * which are scoped to the active room's slot list below and would
   * silently under/over-count a counter meant to summarise the whole
   * event. */
  summary: AgendaSummary;
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  /** DEC-895 (wave 33): the active day's breaks, threaded down from
   * Agenda.tsx's own `dayBreaks` (already day-scoped) -- the clash card's
   * one-tap resolution must never suggest a slot inside one. Agenda.tsx,
   * the only production caller, always passes this; optional only so
   * pre-existing render tests exercising unrelated slices of this
   * component don't all need a breaks fixture -- computeClashMove's own
   * `blocked` argument is never defaulted, only this prop is. */
  breaks?: ScheduleBreakRow[];
  onPlace: (submissionId: string, roomId: string | null, startMin: number, endMin: number) => void;
  onUnschedule: (submissionId: string) => void;
  onAutoSchedule: () => void;
  autoScheduling: boolean;
}

/** "Tue 12" -- weekday + bare day-of-month, dropping formatDayLabel's month
 * token (it renders "Tue 12 May"): the day pill has no room for the month
 * and every pill in the row shares one, so the month would only ever
 * repeat. */
function dayPillLabel(day: string): string {
  return formatDayLabel(day).split(' ').slice(0, 2).join(' ');
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

interface ClashMove {
  submissionId: string;
  ref: string;
  roomId: string;
  startMin: number;
  durationMin: number;
}

/** DEC-895 (wave 33): the phone clash card's one-tap "Move X to hh:mm"
 * resolution -- the SAME candidate scan buildConflictResolutionFor runs
 * server-side (src/server/repo/overview/scheduling.ts, DEC-652), computed
 * client-side here off the page's already-loaded placed sessions/breaks so
 * the clash card doesn't need a new endpoint. Picks the LATER of the
 * clashing pair (same rule as pickLaterConflictEntry: larger startMin
 * wins, a tie keeps the pair's last entry), searches only the room it
 * currently occupies, and excludes it from `existing` so it can't block
 * its own search. Returns null whenever nextFreeSlot finds nothing, or the
 * later session is unplaced into a room at all (TBD has no room to search
 * into -- no control renders for a TBD clash). */
function computeClashMove(
  sessions: PlacedAgendaSession[],
  day: string,
  allPlaced: PlacedAgendaSession[],
  dayStartMin: number,
  dayEndMin: number,
  gridMin: number,
  blocked: BlockedInterval[],
): ClashMove | null {
  let later = sessions[0]!;
  for (const s of sessions.slice(1)) {
    if (s.startMin >= later.startMin) later = s;
  }
  if (later.roomId === null) return null;
  const laterRoomId = later.roomId;

  const existing: PlacedSession[] = allPlaced
    .filter((p) => p.submissionId !== later.submissionId)
    .map((p) => ({
      submissionId: p.submissionId,
      roomId: p.roomId,
      day: p.day,
      startMin: p.startMin,
      endMin: p.endMin,
      speakerContactIds: p.speakers.map((sp) => sp.contactId),
    }));

  const durationMin = later.endMin - later.startMin;
  const slot = nextFreeSlot({
    session: { durationMin, speakerContactIds: later.speakers.map((sp) => sp.contactId) },
    rooms: [laterRoomId],
    days: [day],
    dayStartMin,
    dayEndMin,
    gridMin,
    existing,
    blocked,
  });
  if (!slot) return null;

  return { submissionId: later.submissionId, ref: later.ref, roomId: slot.roomId, startMin: slot.startMin, durationMin };
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
  days,
  onDayChange,
  rooms,
  placed,
  unscheduled,
  conflicts,
  summary,
  dayStartMin,
  dayEndMin,
  gridMin,
  breaks = [],
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
  // DEC-895 (wave 33): breaks -> BlockedInterval, the SAME shape
  // nextFreeSlot's `blocked` scan tests against -- never defaulted to
  // empty, a suggestion landing inside lunch is worse than none.
  const blockedBreaks: BlockedInterval[] = breaks.map((b) => ({
    day: b.day,
    startMin: b.startMin,
    endMin: b.startMin + b.durationMin,
  }));

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

  // frame docs/design/Chautauqua Agenda.dc.html:128 opens the 390x844
  // phone shell and makes THIS page's bordered head band its first child
  // (:128 `border-bottom:1px solid #1B1D17; padding:14px 16px;
  // flex-shrink:0; display:flex; flex-direction:column`), carrying the
  // wordmark at :130 beside the page-specific "6 unplaced · 2 clash"
  // counter at :131.
  //
  // DEC-919 (wave-20 amendment): the app-shell header ABOVE this page
  // already draws the identical "chautauqua" wordmark, so the frame's
  // single wordmark is drawn by the shell, not by this component -- no
  // `data-chq-phone-head` here. That attribute's contract
  // (`.chq-shell:has([data-chq-phone-head]) .chq-header`, styles.css) is
  // scoped to pages whose frame draws NO wordmark/identity at all (the
  // Review-queue drill-in, Scorecard); Agenda's frame draws a wordmark, so
  // setting the attribute here would stand the shell header down with
  // nothing standing in for it (this page's own `.chq-phone-agenda-
  // wordmark` is display:none at phone, agenda.css) and would also strand
  // `.chq-eventswitcher`, which has no phone rule anywhere in styles.css.
  // The counter itself stays a page-drawn element (`.chq-phone-agenda-
  // counts`, unaffected by this change).
  return (
    <div className="chq-phone-agenda">
      <div className="chq-phone-agenda-head">
        <div className="chq-phone-agenda-head-top">
          <span className="chq-phone-agenda-wordmark">chautauqua</span>
          <span className="chq-phone-agenda-counts">
            {summary.unplaced} unplaced &middot; {summary.conflicts} clash
          </span>
        </div>
        <h1 className="chq-phone-agenda-h1">Agenda</h1>
        <div className="chq-phone-day-chips">
          {days.map((d) => {
            const active = d === day;
            return (
              <button
                key={d}
                type="button"
                className={`chq-phone-day-chip${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => onDayChange(d)}
              >
                {dayPillLabel(d)}
              </button>
            );
          })}
        </div>
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
            // DEC-895 (wave 33): the ONE resolution for THIS clash card,
            // computed from its own sessions -- never re-derived per
            // session, matching the card's single control (frame
            // Agenda.dc.html:171, last child of the card).
            const move = computeClashMove(slot.sessions, day, placed, dayStartMin, dayEndMin, gridMin, blockedBreaks);
            return (
              <div key={key} className="chq-phone-slot">
                <span className="chq-phone-slot-time">{clockHHMM(slot.startMin)}</span>
                <div className="chq-panel chq-phone-slot-clash">
                  {/* DEC-380 wave-32: docs/design/Chautauqua Agenda.dc.html:161
                      draws this flag SPELLED ("Two sessions in this slot"),
                      not the numeral countOf() form used by the data-dense
                      registers elsewhere in this file. This one flag composes
                      the pack's own spelled-count grammar (capitalizeFirst +
                      spellCount + plural), already shipping in
                      app/src/pages/overview/AgendaWorkSection.tsx,
                      app/src/pages/overview/rows.ts and
                      src/domain/scorecardLogic.ts, all re-exported from
                      app/src/lib/plural.ts. countOf/count-copy.ts stay
                      unchanged -- they remain the numeral helper. */}
                  <span className="chq-flag">
                    {capitalizeFirst(spellCount(slot.sessions.length))} {plural(slot.sessions.length, 'session')} in this slot
                  </span>
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
                  {move && (
                    <button
                      type="button"
                      className="chq-phone-slot-clash-move"
                      onClick={() => onPlace(move.submissionId, move.roomId, move.startMin, move.startMin + move.durationMin)}
                    >
                      {conflictMoveLabel(move.ref, move.startMin)}
                    </button>
                  )}
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
