// DEC-021 amendment (wave 65): the agenda page owns break CRUD. Wave 63
// landed the whole server-side stack (src/server/repo/breaks.ts,
// src/routes/api/breaks.ts, mounted at src/index.ts) with no way in — this
// is that way in: a quiet Breaks section on /admin/agenda, scoped to the
// day the grid is currently showing, driving the existing three endpoints
// (GET/POST /events/:eventId/breaks, DELETE /breaks/:id).
//
// HARD BOUNDARY (restated from src/server/repo/breaks.ts's header): a break
// is not a submission. This file never touches the day grid's row-map/
// placement arithmetic, the conflict engine, auto-schedule, the
// unscheduled tray, or any export/.ics/feed path — it only adds and
// removes rows in the schedule_break table for the selected day (the
// selected day's rows themselves are read once by the parent Agenda page —
// see agenda/DayGrid.tsx, which renders those same rows as read-only bands
// — and handed down here as props, so this panel and the grid beside it
// never fall out of sync on an add/remove).
import { useState } from 'react';
import { apiDelete, apiPost, ApiError } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatMinutes } from './gridMath';
import { formatDayLabel } from '../../lib/dates';
import { DEC_021 } from '../../../../src/decisions';

void DEC_021;

export interface ScheduleBreakRow {
  id: string;
  eventId: string;
  day: string;
  label: string;
  location: string | null;
  startMin: number;
  durationMin: number;
  createdAt: number;
  updatedAt: number;
}

interface BreaksPanelProps {
  eventId: string;
  /** The day the day grid is currently scoped to. Absent (no day selected
   * yet, e.g. before the agenda payload loads) means there is nothing to
   * scope a break list to — per house affordance grammar (controls render
   * only when their action is possible) the whole section renders nothing
   * rather than an empty/day-less list. */
  day: string | null;
  /** The selected day's breaks, fetched once by the parent Agenda page and
   * shared with DayGrid — this panel no longer fetches its own copy. */
  breaks: ScheduleBreakRow[];
  /** DEC-021 amendment (w69-c, closes DEC-844's loop): breaks whose day fell
   * outside the event's current window (e.g. an organiser moved the dates
   * after the break was added) — invisible to the day-scoped `breaks` list
   * and the day tabs above it, but still rows in schedule_break that need a
   * way to be seen and removed. Rendered as a second quiet group, always
   * present (a day-scoped panel can't rely on `day` landing on one), so its
   * own array is what decides whether the group appears at all. */
  outsideWindow: ScheduleBreakRow[];
  /** Called after a successful add/remove so the parent can refetch the one
   * shared list (both this panel and DayGrid's bands pick up the change in
   * the same tick). */
  onChanged: () => void;
}

interface BreakFieldErrors {
  label?: string;
  day?: string;
  startMin?: string;
  durationMin?: string;
}

/** "HH:MM" (the browser's `<input type="time">` value shape) -> minutes
 * since midnight. Returns NaN for an unparsable/empty value — sent as-is
 * to the server, which rejects a non-integer startMin with its own field
 * error rather than this form silently guessing a default. */
function parseTimeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function minutesToTimeInput(startMin: number): string {
  const hours = Math.floor(startMin / 60);
  const minutes = startMin % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const EMPTY_FORM = { label: '', location: '', startTime: '', durationMin: '' };

/** Quiet Breaks section: list for the selected day, an inline add row, and
 * a tertiary Remove per row. No optimistic path (task scope) — every write
 * asks the parent (via onChanged) to refetch the day's shared list. */
export function BreaksPanel({ eventId, day, breaks, outsideWindow, onChanged }: BreaksPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<BreakFieldErrors>({});
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // DEC-941/DEC-631: removing a break is irreversible (no undo, no restore
  // path), so the Remove control opens the ONE shared ConfirmDialog rather
  // than firing the DELETE on click.
  const [pendingRemove, setPendingRemove] = useState<ScheduleBreakRow | null>(null);

  async function handleAdd() {
    if (!eventId || !day) return;
    setError(null);
    setFieldErrors({});
    setAdding(true);
    try {
      await apiPost(`/events/${eventId}/breaks`, {
        day,
        label: form.label,
        location: form.location.trim().length > 0 ? form.location : undefined,
        startMin: parseTimeToMinutes(form.startTime),
        durationMin: form.durationMin.trim().length > 0 ? Number(form.durationMin) : NaN,
      });
      setForm(EMPTY_FORM);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields as BreakFieldErrors);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to add break');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      await apiDelete(`/breaks/${id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove break');
    } finally {
      setRemovingId(null);
      setPendingRemove(null);
    }
  }

  // Controls render only when their action is possible (house affordance
  // grammar): with no day selected there is nothing to scope a break list
  // (or an add) to — UNLESS there are outside-window breaks to surface,
  // which have no day-scoped tab to live under and so must still get a
  // way in even when the grid has no active day.
  if (day === null && outsideWindow.length === 0) return null;

  return (
    <section className="chq-section chq-breaks-panel">
      {error && (
        <div className="chq-error-banner" role="alert">
          {error}
        </div>
      )}

      {day !== null && (
        <>
          <div className="chq-section-head">
            <h2 className="chq-section-label">Breaks</h2>
          </div>

          <ul className="chq-breaks-list">
            {breaks.length === 0 && <li className="chq-breaks-empty">No breaks yet.</li>}
            {breaks.map((b) => (
              <li key={b.id} className="chq-breaks-row">
                <span className="chq-breaks-row-time">{formatMinutes(b.startMin)}</span>
                <span className="chq-breaks-row-meta">
                  {b.label}
                  {b.location ? ` · ${b.location}` : ''}
                  {` · ${b.durationMin} min`}
                </span>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  onClick={() => setPendingRemove(b)}
                  disabled={removingId === b.id}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* DEC-021 amendment (w69-c, closes DEC-844's loop): breaks stranded
         outside the event's current window by an organiser moving the
         dates — Settings names these rows (breaksOutsideWindow notice) but
         had no screen that could delete one until now. Renders only when
         non-empty (affordance grammar) so a well-behaved event with no
         stranded rows never shows an always-empty section. */}
      {outsideWindow.length > 0 && (
        <div className="chq-breaks-outside-window">
          <div className="chq-section-head">
            <h2 className="chq-section-label">Outside the event dates</h2>
          </div>
          <p className="chq-breaks-outside-window-caption">
            These days sit outside the event&apos;s dates, so they no longer appear on the public agenda or the
            printable programme.
          </p>
          <ul className="chq-breaks-list">
            {outsideWindow.map((b) => (
              <li key={b.id} className="chq-breaks-row">
                <span className="chq-breaks-row-day">{formatDayLabel(b.day)}</span>
                <span className="chq-breaks-row-time">{formatMinutes(b.startMin)}</span>
                <span className="chq-breaks-row-meta">
                  {b.label}
                  {b.location ? ` · ${b.location}` : ''}
                  {` · ${b.durationMin} min`}
                </span>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  onClick={() => setPendingRemove(b)}
                  disabled={removingId === b.id}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {day !== null && (
      <div className="chq-breaks-add-row">
        <div className="chq-breaks-field">
          <label htmlFor="chq-break-label">Label</label>
          <input
            id="chq-break-label"
            className="chq-input"
            placeholder="Lunch"
            value={form.label}
            onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          />
          {fieldErrors.label && (
            <span role="alert" className="chq-field-error">
              {fieldErrors.label}
            </span>
          )}
        </div>
        <div className="chq-breaks-field">
          <label htmlFor="chq-break-location">Location (optional)</label>
          <input
            id="chq-break-location"
            className="chq-input"
            placeholder="Foyer"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          />
        </div>
        <div className="chq-breaks-field">
          <label htmlFor="chq-break-start">Start time</label>
          <input
            id="chq-break-start"
            className="chq-input"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
          />
          {fieldErrors.startMin && (
            <span role="alert" className="chq-field-error">
              {fieldErrors.startMin}
            </span>
          )}
        </div>
        <div className="chq-breaks-field">
          <label htmlFor="chq-break-duration">Duration (min)</label>
          <input
            id="chq-break-duration"
            className="chq-input"
            type="number"
            min={1}
            value={form.durationMin}
            onChange={(e) => setForm((prev) => ({ ...prev, durationMin: e.target.value }))}
          />
          {fieldErrors.durationMin && (
            <span role="alert" className="chq-field-error">
              {fieldErrors.durationMin}
            </span>
          )}
        </div>
        <button type="button" className="chq-btn chq-btn-primary" onClick={() => void handleAdd()} disabled={adding}>
          {adding ? 'Adding…' : 'Add a break'}
        </button>
        {fieldErrors.day && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.day}
          </span>
        )}
      </div>
      )}

      {pendingRemove && (
        <ConfirmDialog
          title="Remove this break?"
          body={
            <p>
              {formatMinutes(pendingRemove.startMin)} · {pendingRemove.label}
              {pendingRemove.location ? ` · ${pendingRemove.location}` : ''} will be removed from this day. This cannot
              be undone.
            </p>
          }
          confirmLabel="Remove break"
          destructive
          pending={removingId === pendingRemove.id}
          onConfirm={() => void handleRemove(pendingRemove.id)}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </section>
  );
}

// Exported for tests only — keeps the input's "HH:MM" -> minutes mapping
// and the render's minutes -> "HH:MM" mapping visibly inverse of each
// other rather than two independently-typed literals drifting apart.
export const __testHelpers = { parseTimeToMinutes, minutesToTimeInput };
