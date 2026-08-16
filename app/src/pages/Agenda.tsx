import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../lib/api';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { useIsPhone } from '../lib/useIsPhone';
import { useEscapeKey } from '../lib/useEscapeKey';
import { PageSkeleton } from '../components/PageSkeleton';
import { DayGrid, type ArmedAgendaSession } from './agenda/DayGrid';
import { UnscheduledTray } from './agenda/UnscheduledTray';
import { PhoneAgenda } from './agenda/PhoneAgenda';
import { BreaksPanel, type ScheduleBreakRow } from './agenda/BreaksPanel';
import { ModalFrame } from '../components/ModalFrame';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { placeOptimistically, reconcileConflictsSummary, unscheduleOptimistically } from './agenda/state';
import type { AgendaPayload, DescribedUnplaced, RefreshedConflictsSummary, UnplacedReason } from './agenda/types';
import { formatDayLabel } from '../lib/dates';
import { countOf } from '../lib/plural';
import { clockHHMM } from '../lib/clock';
import './agenda/agenda.css';

const DAY_START_MIN = 540;
const DAY_END_MIN = 1080;
const GRID_MIN = 15;

// DEC-615/DEC-667: closed vocabulary mirroring UnplacedReason — used only to
// summarize why nothing got placed this run, never to invent a reason the
// server didn't compute.
// DEC-615 (wave 43 amendment): 'slot_outside_event_range' and
// 'write_cap_reached' are server-side UnplacedReason literals (src/domain/
// schedule.ts) not yet mirrored into agenda/types.ts's UnplacedReason union
// (out of this lane's file ownership) — widened locally so this lookup
// covers every reason the server can actually send.
const UNPLACED_REASON_LABELS: Record<UnplacedReason | 'slot_outside_event_range' | 'write_cap_reached', string> = {
  no_rooms_configured: 'no rooms configured',
  duration_exceeds_day: 'longer than the day',
  no_free_slot: 'no free slot available',
  speaker_double_booked: 'speaker already booked elsewhere',
  slot_outside_event_range: 'scheduled day outside the event range',
  write_cap_reached: "this run's write cap reached",
};

/** Finds a session's ref (placed or unscheduled) for toast copy — the click
 * that triggers a placement/move/unschedule always originates from a card
 * already present in the current state, so this is only ever missing on a
 * genuine bug (fall back to the id itself rather than throw mid-toast). */
function findSessionRef(state: AgendaPayload, submissionId: string): string {
  return (
    state.placed.find((s) => s.submissionId === submissionId)?.ref ??
    state.unscheduled.find((s) => s.submissionId === submissionId)?.ref ??
    submissionId
  );
}

/** DEC-853/DEC-724: room name resolved the same way DayGrid resolves it
 * (name lookup, falling back to the raw id) — except the room-less slot,
 * which is named 'no room yet', never 'TBD'. */
function resolveRoomName(rooms: AgendaPayload['rooms'], roomId: string | null): string {
  if (roomId === null) return 'no room yet';
  return rooms.find((r) => r.id === roomId)?.name ?? roomId;
}

/** DEC-899/900: the summary's "% placed" is derived from the same placed +
 * unscheduled counts the rest of the page renders (never a server-supplied
 * shortcut field) so the printed percentage always matches the arithmetic a
 * reader could do themselves from what's on screen. Zero total sessions
 * reads as 0% rather than dividing by zero. */
function placedPercent(agenda: AgendaPayload | null): number {
  if (!agenda) return 0;
  const total = agenda.placed.length + agenda.unscheduled.length;
  if (total === 0) return 0;
  return Math.round((agenda.placed.length / total) * 100);
}

/** DEC-667: when a run places nothing, name why from the typed reasons the
 * run itself computed rather than reporting a bare "0 sessions". */
function describeUnplaced(reasons: DescribedUnplaced[]): string {
  if (reasons.length === 0) return 'nothing to place';
  const counts = new Map<UnplacedReason, number>();
  for (const r of reasons) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([reason, count]) => `${count} ${UNPLACED_REASON_LABELS[reason]}`)
    .join(', ');
}

export function AgendaPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const isPhone = useIsPhone();

  const [agenda, setAgenda] = useState<AgendaPayload | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [allBreaks, setAllBreaks] = useState<ScheduleBreakRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [armed, setArmed] = useState<ArmedAgendaSession | null>(null);
  // DEC-941: the click/keyboard "Unschedule" button (armed bar) is
  // irreversible, so it opens the shared ConfirmDialog naming the session
  // and the slot it's giving up first -- drag-drop-onto-the-tray stays the
  // established instant gesture (the drop IS the deliberate second action).
  const [pendingUnschedule, setPendingUnschedule] = useState<ArmedAgendaSession | null>(null);
  // DEC-021/DEC-900 amendment (wave 72): the breaks editor is a disclosure
  // on the head row, not a band that displaces the canvas -- opens the ONE
  // shared dialog frame (ModalFrame, DEC-651) rather than its own inline
  // band between the head and the grid.
  const [breaksOpen, setBreaksOpen] = useState(false);

  useEscapeKey(armed !== null, () => setArmed(null));

  function loadAgenda(id: string) {
    setLoading(true);
    setError(null);
    return apiGet<AgendaPayload>(`/events/${id}/agenda`)
      .then((res) => {
        setAgenda(res);
        setActiveDay((prev) => (prev && res.days.includes(prev) ? prev : (res.days[0] ?? null)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load agenda'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!eventId) return;
    loadAgenda(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // DEC-021 amendment (w67-b, w69-c): one reader for every break on the
  // event, shared by DayGrid (renders the active day's rows as bands) and
  // BreaksPanel (list/add/remove, plus the outside-window group) — hoisted
  // out of BreaksPanel so a POST/DELETE there refreshes the grid in the
  // same tick instead of the two staying independently stale copies. Fetched
  // once per event (no ?day filter — the route already bounds the result to
  // MAX_BREAKS_PER_EVENT) rather than once per day, so a break whose day
  // fell outside the event window after an organiser moved the dates is
  // still fetched and can be found/removed (DEC-844).
  function reloadBreaks() {
    if (!eventId) {
      setAllBreaks([]);
      return;
    }
    apiGet<{ items: ScheduleBreakRow[] }>(`/events/${eventId}/breaks`)
      .then((res) => setAllBreaks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load breaks'));
  }

  useEffect(() => {
    reloadBreaks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const dayBreaks = allBreaks.filter((b) => b.day === activeDay);
  const outsideWindowBreaks = agenda
    ? allBreaks
        .filter((b) => !agenda.days.includes(b.day))
        .sort((a, b) => (a.day === b.day ? a.startMin - b.startMin : a.day < b.day ? -1 : 1))
    : [];

  async function handlePlace(submissionId: string, roomId: string | null, startMin: number, endMin: number) {
    if (!agenda) return;
    const previous = agenda;
    const ref = findSessionRef(previous, submissionId);
    setAgenda(placeOptimistically(agenda, submissionId, { day: activeDay ?? previous.days[0] ?? '', startMin, endMin, roomId }));
    setError(null);
    try {
      const refreshed = await apiPut<RefreshedConflictsSummary>(`/submissions/${submissionId}/slot`, {
        day: activeDay,
        startMin,
        endMin,
        roomId,
      });
      setAgenda((current) => (current ? reconcileConflictsSummary(current, refreshed) : current));
      // DEC-853/SPEC §2.3 warn-never-block: a placement/move can create a new
      // clash — allowed, but never unannounced. The delta comes from the
      // server's own before/after conflict counts, never re-derived
      // client-side.
      const roomName = resolveRoomName(previous.rooms, roomId);
      const clashDelta = refreshed.summary.conflicts - previous.summary.conflicts;
      const clashClause =
        clashDelta > 0 ? ` ${countOf(clashDelta, 'new clash', 'new clashes')} — flagged, not blocked.` : '';
      setToast(`Placed ${ref} in ${roomName} at ${clockHHMM(startMin)}.${clashClause}`);
    } catch (err) {
      setAgenda(previous);
      setError(err instanceof ApiError ? `Placement failed: ${err.message}` : 'Placement failed');
    }
  }

  function handlePlaceAt(roomId: string | null, startMin: number) {
    if (!armed) return;
    const current = armed;
    setArmed(null);
    void handlePlace(current.submissionId, roomId, startMin, startMin + current.durationMin);
  }

  /** DEC-021 amendment (w55): click/keyboard unschedule for an armed PLACED
   * session — routes through the same handleUnschedule the drag-drop-onto-
   * the-tray path already uses (one reader, no second unschedule code
   * path), then clears the arming so the bar returns to its idle state. */
  function handleUnscheduleArmed() {
    if (!armed) return;
    // DEC-941: names the confirm dialog rather than firing the DELETE
    // straight off the click -- the dialog's own confirm control calls
    // handleUnschedule.
    setPendingUnschedule(armed);
  }

  function confirmUnschedule() {
    if (!pendingUnschedule) return;
    const submissionId = pendingUnschedule.submissionId;
    setPendingUnschedule(null);
    setArmed(null);
    void handleUnschedule(submissionId);
  }

  async function handleUnschedule(submissionId: string) {
    if (!agenda) return;
    const previous = agenda;
    const ref = findSessionRef(previous, submissionId);
    setAgenda(unscheduleOptimistically(agenda, submissionId));
    setError(null);
    try {
      const refreshed = await apiDelete<RefreshedConflictsSummary>(`/submissions/${submissionId}/slot`);
      setAgenda((current) => (current ? reconcileConflictsSummary(current, refreshed) : current));
      setToast(`Unscheduled ${ref}.`);
    } catch (err) {
      setAgenda(previous);
      setError(err instanceof ApiError ? `Unschedule failed: ${err.message}` : 'Unschedule failed');
    }
  }

  async function handleAutoSchedule() {
    if (!eventId) return;
    setAutoScheduling(true);
    setError(null);
    try {
      const before = agenda?.summary.unplaced ?? 0;
      const result = await apiPost<AgendaPayload>(`/events/${eventId}/agenda/auto-schedule`, {});
      setAgenda(result);
      setActiveDay((prev) => (prev && result.days.includes(prev) ? prev : (result.days[0] ?? null)));
      const placedCount = Math.max(before - result.summary.unplaced, 0);
      // DEC-667/SPEC J9: the scheduler warns, never blocks — conflicts
      // reported here were already on the agenda before this run, not
      // created by it, and this run left them in place rather than
      // resolving them.
      const conflictsClause =
        result.summary.conflicts > 0
          ? ` ${countOf(result.summary.conflicts, 'pre-existing conflict')} left in place.`
          : '';
      const placedClause =
        placedCount > 0
          ? `Auto-schedule placed ${countOf(placedCount, 'session')}. ${result.summary.unplaced} unplaced.`
          : `Auto-schedule placed no sessions: ${describeUnplaced(result.unplacedReasons)}.`;
      setToast(`${placedClause}${conflictsClause}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Auto-schedule failed: ${err.message}` : 'Auto-schedule failed');
    } finally {
      setAutoScheduling(false);
    }
  }

  async function handlePublish() {
    if (!eventId) return;
    setPublishing(true);
    setError(null);
    try {
      const result = await apiPost<{ placed: number; public: number; heldBack: number }>(
        `/events/${eventId}/agenda/publish`,
        {},
      );
      const base = `Schedule live — ${result.public} of ${result.placed} placed sessions are public.`;
      setToast(result.heldBack > 0 ? `${base} ${result.heldBack} held back: content not approved.` : base);
    } catch (err) {
      setError(err instanceof ApiError ? `Publish failed: ${err.message}` : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page">
        <h1>Agenda</h1>
        <PageSkeleton variant="table" label="Loading event…" />
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page">
        <h1>Agenda</h1>
        <div className="chq-attention-frame">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-agenda-page">
      <div className="chq-agenda-head">
        <h1 className="chq-page-title">Agenda</h1>
        <div className="chq-summary chq-agenda-summary">
          {`${agenda?.summary.unplaced ?? 0} unplaced · `}
          <strong>{countOf(agenda?.summary.conflicts ?? 0, 'conflict')}</strong>
          {` · ${placedPercent(agenda)}% placed`}
        </div>
        <div className="chq-agenda-head-actions">
          {/* DEC-021/DEC-900 amendment (wave 72): renders whenever the panel
             itself would have rendered -- a selected day OR a non-empty
             outside-window set -- so the stranded-break path (DEC-021 w69-c)
             keeps its way in even with no day selected. */}
          {(activeDay !== null || outsideWindowBreaks.length > 0) && (
            <button
              type="button"
              className="chq-link-button chq-section-action"
              onClick={() => setBreaksOpen(true)}
            >
              Breaks ›
            </button>
          )}
          <button type="button" className="chq-btn chq-btn-secondary" onClick={handleAutoSchedule} disabled={autoScheduling || !agenda}>
            {autoScheduling ? 'Auto-scheduling...' : 'Auto-schedule'}
          </button>
          <button type="button" className="chq-btn chq-btn-primary" onClick={handlePublish} disabled={publishing || !agenda}>
            {publishing ? 'Publishing...' : 'Publish schedule'}
          </button>
        </div>
      </div>

      {breaksOpen && (
        <ModalFrame title="Breaks" onClose={() => setBreaksOpen(false)}>
          <BreaksPanel
            eventId={eventId}
            day={activeDay}
            breaks={dayBreaks}
            outsideWindow={outsideWindowBreaks}
            onChanged={reloadBreaks}
          />
        </ModalFrame>
      )}

      {error && <div className="chq-error-banner">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-link-button" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {loading && <PageSkeleton variant="table" label="Loading agenda…" />}

      {!loading && agenda && (
        <>
          <div className="chq-agenda-day-tabs chq-chipstrip" role="tablist">
          <div className="chq-agenda-armed-bar" role="status" aria-hidden={armed ? undefined : true}>
            {armed && (
              <>
                Placing {armed.ref} — Esc to cancel
                {/* DEC-021 amendment (w55): only when the armed session already
                   has a slot — arming an unscheduled-tray card has nothing to
                   unschedule, so this affordance is absent for that case. */}
                {agenda?.placed.some((s) => s.submissionId === armed.submissionId) && (
                  <button type="button" className="chq-btn chq-btn-secondary chq-agenda-unschedule-btn" onClick={handleUnscheduleArmed}>
                    Unschedule
                  </button>
                )}
                <button type="button" className="chq-link-button" onClick={() => setArmed(null)}>
                  Cancel
                </button>
              </>
            )}
          </div>
            {agenda.days.map((day) => (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={activeDay === day}
                className={`chq-pill${activeDay === day ? ' active' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {formatDayLabel(day)}
              </button>
            ))}
            <span className="chq-agenda-clash-note">Clashes are flagged, not blocked</span>
          </div>

          {isPhone ? (
            activeDay && (
              <PhoneAgenda
                day={activeDay}
                rooms={agenda.rooms}
                placed={agenda.placed}
                unscheduled={agenda.unscheduled}
                conflicts={agenda.conflicts}
                dayStartMin={DAY_START_MIN}
                dayEndMin={DAY_END_MIN}
                gridMin={GRID_MIN}
                onPlace={handlePlace}
                onUnschedule={handleUnschedule}
                onAutoSchedule={handleAutoSchedule}
                autoScheduling={autoScheduling}
              />
            )
          ) : (
            <div className="chq-agenda-layout">
              <div className="chq-agenda-main">
                {agenda.rooms.length === 0 ? (
                  // DEC-899/900: "Add a room or track" is only ever the
                  // grid's own empty state — there is nothing to drop a
                  // session onto until a room exists, so it appears here
                  // instead of as a permanent toolbar control that implies
                  // rooms/tracks always need attention.
                  <div className="chq-agenda-empty-state">
                    <p>No rooms configured yet — add one to start placing sessions.</p>
                    {/* DEC-834 / DEC-837: the router's basename is already '/admin' -- a
                        `to` starting with '/admin/settings' resolves to
                        '/admin/admin/settings' and 404s. */}
                    <Link to="/settings?section=tracks-rooms" className="chq-toolbar-link">
                      Add a room or track
                    </Link>
                  </div>
                ) : (
                  activeDay && (
                    <DayGrid
                      day={activeDay}
                      rooms={agenda.rooms}
                      tracks={agenda.tracks}
                      placed={agenda.placed}
                      conflicts={agenda.conflicts}
                      breaks={dayBreaks}
                      dayStartMin={DAY_START_MIN}
                      dayEndMin={DAY_END_MIN}
                      gridMin={GRID_MIN}
                      onDropPlace={handlePlace}
                      armed={armed}
                      onArm={setArmed}
                      onPlaceAt={handlePlaceAt}
                    />
                  )
                )}
              </div>
              <UnscheduledTray
                sessions={agenda.unscheduled}
                tracks={agenda.tracks}
                conflicts={agenda.conflicts}
                unplacedReasons={agenda.unplacedReasons}
                onDropUnschedule={handleUnschedule}
                armed={armed}
                onArm={setArmed}
              />
            </div>
          )}
        </>
      )}

      {pendingUnschedule &&
        (() => {
          const placedSession = agenda?.placed.find((s) => s.submissionId === pendingUnschedule.submissionId) ?? null;
          const slotClause = placedSession
            ? ` from ${resolveRoomName(agenda?.rooms ?? [], placedSession.roomId)} at ${clockHHMM(placedSession.startMin)}`
            : '';
          return (
            <ConfirmDialog
              title="Unschedule this session?"
              body={
                <p>
                  {pendingUnschedule.ref} will be removed{slotClause}. This cannot be undone.
                </p>
              }
              confirmLabel="Unschedule session"
              onConfirm={confirmUnschedule}
              onCancel={() => setPendingUnschedule(null)}
            />
          );
        })()}
    </div>
  );
}
