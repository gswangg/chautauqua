import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../lib/api';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { DayGrid } from './agenda/DayGrid';
import { UnscheduledTray } from './agenda/UnscheduledTray';
import { placeOptimistically, reconcileConflictsSummary, unscheduleOptimistically } from './agenda/state';
import type { AgendaPayload, RefreshedConflictsSummary } from './agenda/types';

const DAY_START_MIN = 540;
const DAY_END_MIN = 1080;
const GRID_MIN = 15;

export function AgendaPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [agenda, setAgenda] = useState<AgendaPayload | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      const placedCount = before - result.summary.unplaced;
      setToast(`Auto-schedule placed ${Math.max(placedCount, 0)} session(s). ${result.summary.unplaced} unplaced, ${result.summary.conflicts} conflict(s).`);
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
      const result = await apiPost<{ published: number }>(`/events/${eventId}/agenda/publish`, {});
      setToast(`Schedule live — ${result.published} sessions public.`);
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
      <h1>Agenda</h1>

      {error && <div className="chq-error-banner">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="chq-agenda-toolbar">
        <div className="chq-agenda-summary">
          <strong>{agenda?.summary.unplaced ?? 0}</strong> unplaced &middot; <strong>{agenda?.summary.conflicts ?? 0}</strong> conflicts
        </div>
        <button type="button" onClick={handleAutoSchedule} disabled={autoScheduling || !agenda}>
          {autoScheduling ? 'Auto-scheduling...' : 'Auto-schedule'}
        </button>
        <button type="button" onClick={handlePublish} disabled={publishing || !agenda}>
          {publishing ? 'Publishing...' : 'Publish schedule'}
        </button>
      </div>

      {loading && <p>Loading agenda...</p>}

      {!loading && agenda && (
        <>
          <div className="chq-agenda-day-tabs" role="tablist">
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
          </div>

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
              />
            )}
            <UnscheduledTray
              sessions={agenda.unscheduled}
              tracks={agenda.tracks}
              conflicts={agenda.conflicts}
              onDropUnschedule={handleUnschedule}
            />
          </div>
        </>
      )}
    </div>
  );
}
