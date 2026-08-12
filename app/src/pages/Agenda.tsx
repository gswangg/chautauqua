import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../lib/api';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { useIsPhone } from '../lib/useIsPhone';
import { useEscapeKey } from '../lib/useEscapeKey';
import { DayGrid, type ArmedAgendaSession } from './agenda/DayGrid';
import { UnscheduledTray } from './agenda/UnscheduledTray';
import { PhoneAgenda } from './agenda/PhoneAgenda';
import { placeOptimistically, reconcileConflictsSummary, unscheduleOptimistically } from './agenda/state';
import type { AgendaPayload, DescribedUnplaced, RefreshedConflictsSummary, UnplacedReason } from './agenda/types';
import './agenda/agenda.css';

const DAY_START_MIN = 540;
const DAY_END_MIN = 1080;
const GRID_MIN = 15;

// DEC-615/DEC-667: closed vocabulary mirroring UnplacedReason — used only to
// summarize why nothing got placed this run, never to invent a reason the
// server didn't compute.
const UNPLACED_REASON_LABELS: Record<UnplacedReason, string> = {
  no_rooms_configured: 'no rooms configured',
  duration_exceeds_day: 'longer than the day',
  no_free_slot: 'no free slot available',
  speaker_double_booked: 'speaker already booked elsewhere',
};

/** DEC-667: when a run places nothing, name why from the typed reasons the
 * run itself computed rather than reporting a bare "0 session(s)". */
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [armed, setArmed] = useState<ArmedAgendaSession | null>(null);

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

  async function handlePlace(submissionId: string, roomId: string | null, startMin: number, endMin: number) {
    if (!agenda) return;
    const previous = agenda;
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

  async function handleUnschedule(submissionId: string) {
    if (!agenda) return;
    const previous = agenda;
    setAgenda(unscheduleOptimistically(agenda, submissionId));
    setError(null);
    try {
      const refreshed = await apiDelete<RefreshedConflictsSummary>(`/submissions/${submissionId}/slot`);
      setAgenda((current) => (current ? reconcileConflictsSummary(current, refreshed) : current));
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
          ? ` ${result.summary.conflicts} pre-existing conflict(s) left in place.`
          : '';
      const placedClause =
        placedCount > 0
          ? `Auto-schedule placed ${placedCount} session(s). ${result.summary.unplaced} unplaced.`
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
        <p>Loading event...</p>
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
      </div>

      {armed && (
        <div className="chq-agenda-armed-bar" role="status">
          Placing {armed.ref} — Esc to cancel
          <button type="button" className="chq-link-button" onClick={() => setArmed(null)}>
            Cancel
          </button>
        </div>
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

      <div className="chq-toolbar chq-agenda-toolbar">
        <div className="chq-summary chq-agenda-summary">
          <strong>{agenda?.summary.unplaced ?? 0}</strong> unplaced &middot; <strong>{agenda?.summary.conflicts ?? 0}</strong> conflicts
        </div>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={handleAutoSchedule} disabled={autoScheduling || !agenda}>
          {autoScheduling ? 'Auto-scheduling...' : 'Auto-schedule'}
        </button>
        <button type="button" className="chq-btn chq-btn-primary" onClick={handlePublish} disabled={publishing || !agenda}>
          {publishing ? 'Publishing...' : 'Publish schedule'}
        </button>
      </div>

      {loading && <p>Loading agenda...</p>}

      {!loading && agenda && (
        <>
          <div className="chq-agenda-day-tabs chq-chipstrip" role="tablist">
            {agenda.days.map((day) => (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={activeDay === day}
                className={`chq-pill${activeDay === day ? ' active' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
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
              {activeDay && (
                <DayGrid
                  day={activeDay}
                  rooms={agenda.rooms}
                  tracks={agenda.tracks}
                  placed={agenda.placed}
                  conflicts={agenda.conflicts}
                  dayStartMin={DAY_START_MIN}
                  dayEndMin={DAY_END_MIN}
                  gridMin={GRID_MIN}
                  onDropPlace={handlePlace}
                  armed={armed}
                  onArm={setArmed}
                  onPlaceAt={handlePlaceAt}
                />
              )}
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
    </div>
  );
}
