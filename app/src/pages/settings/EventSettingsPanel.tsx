// Event settings panel (w4-h, DEC-032; summary-first w1-b, DEC-728): name,
// slug, dates, location, timezone, record prefix (read-only), branding
// logo URL + accent color. Renders as a read-only summary (SummarySection)
// with a single 'Change' action that drills into the existing form; the
// drilled state is `?section=event&edit=1` in the URL (DEC-728/DEC-710),
// so it is bookmarkable and Back leaves it. The form itself, its
// PATCH /api/v1/events/:id endpoint and buildEventPatch diffing are
// unchanged from before this wave.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DateField } from '../../components/DateField';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { buildEventPatch, type EventSettingsForm } from './formState';
import { SummarySection } from './SummarySection';
import { plural } from '../../lib/plural';
import { dateInputToMs, daysUntil } from '../../lib/dates';
import { formatEventDayRange } from '../../../../src/lib/event-time';

const SECTION_KEY = 'event';

interface EventDetail {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  timezone: string;
  recordPrefix: string;
  branding: { logoUrl?: string; accentColor?: string } | null;
  unscheduledByWindow?: {
    count: number;
    sessions: { submissionId: string; ref: string; title: string; day: string }[];
  };
  breaksOutsideWindow?: {
    count: number;
    breaks: { id: string; day: string; label: string; startMin: number }[];
  };
}

interface OutsideWindowNotice {
  sessions: EventDetail['unscheduledByWindow'] | null;
  breaks: EventDetail['breaksOutsideWindow'] | null;
}

function toForm(event: EventDetail): EventSettingsForm {
  return {
    name: event.name,
    slug: event.slug,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location ?? '',
    timezone: event.timezone,
    recordPrefix: event.recordPrefix,
    logoUrl: event.branding?.logoUrl ?? '',
    accentColor: event.branding?.accentColor ?? '',
  };
}

// DEC-896: the Dates row's relative hint -- "N days away" counted from the
// event's own timezone against its start date, through the SPA's ONE
// days-until reader (dates.ts daysUntil) so it agrees with every other
// countdown in the app rather than a bespoke Math.round.
function datesHint(startMs: number, timezone: string): string {
  const days = daysUntil(startMs, timezone, Date.now());
  if (days === 0) return 'Today';
  return `${days} ${plural(days, 'day')} away`;
}

// Both dates are required event fields (never '' once loaded from the API),
// so a null here is a data-integrity bug -- fail loudly rather than render
// a silently-blank Dates row.
function requireDateMs(value: string): number {
  const ms = dateInputToMs(value);
  if (ms === null) throw new Error(`EventSettingsPanel: expected a non-empty date, got "${value}"`);
  return ms;
}

function brandingSummary(form: EventSettingsForm): string {
  const parts: string[] = [];
  if (form.logoUrl) parts.push('Logo set');
  if (form.accentColor) parts.push(`Accent ${form.accentColor}`);
  return parts.length > 0 ? parts.join(' · ') : 'Not set';
}

// DEC-996 amendment (wave 43): mail configuration is a first-class READ,
// surfaced here so a missing key is discoverable in Settings rather than
// only as a 500 when a speaker submits.
interface MailStatus {
  provider: 'dev-sink' | 'email-binding' | 'none';
  configured: boolean;
  fromEmail: string | null;
}

function mailStatusSummary(status: MailStatus): string {
  if (status.provider === 'dev-sink') return 'Dev mailbox (/dev/mailbox)';
  if (status.configured && status.fromEmail) return `Sending as ${status.fromEmail}`;
  return 'NOT CONFIGURED — sends will fail';
}

export function EventSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [initial, setInitial] = useState<EventSettingsForm | null>(null);
  const [form, setForm] = useState<EventSettingsForm | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unscheduledNotice, setUnscheduledNotice] = useState<OutsideWindowNotice | null>(null);
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);

  useEffect(() => {
    if (!eventId) return;
    apiGet<EventDetail>(`/events/${eventId}`)
      .then((event) => {
        const f = toForm(event);
        setInitial(f);
        setForm(f);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event'));
  }, [eventId]);

  useEffect(() => {
    apiGet<MailStatus>('/mail-status')
      .then((status) => setMailStatus(status))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load mail status'));
  }, []);

  function update<K extends keyof EventSettingsForm>(key: K, value: EventSettingsForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function closeEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('section');
      params.delete('edit');
      return params;
    });
  }

  async function handleSave() {
    if (!eventId || !initial || !form) return;
    const patch = buildEventPatch(initial, form);
    if (Object.keys(patch).length === 0) {
      closeEdit();
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const updated = await apiPatch<EventDetail>(`/events/${eventId}`, patch);
      const f = toForm(updated);
      setInitial(f);
      setForm(f);
      setSaved(true);
      const sessionsNotice =
        updated.unscheduledByWindow && updated.unscheduledByWindow.count > 0 ? updated.unscheduledByWindow : null;
      const breaksNotice =
        updated.breaksOutsideWindow && updated.breaksOutsideWindow.count > 0 ? updated.breaksOutsideWindow : null;
      setUnscheduledNotice(
        sessionsNotice || breaksNotice ? { sessions: sessionsNotice, breaks: breaksNotice } : null,
      );
      closeEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save event settings');
    } finally {
      setSaving(false);
    }
  }

  const rows = form
    ? [
        { label: 'Name', value: form.name },
        // DEC-896: matches the 09-settings frame's Slug row hint verbatim
        // ('Used in every public URL' -- submit/schedule/agenda links all
        // key off this, per the record scoping this panel already saves).
        { label: 'Slug', value: form.slug, hint: 'Used in every public URL' },
        // DEC-896: 'Starts'/'Ends' collapsed into one human-grammar range
        // row -- the two ISO dates now live only in the edit form's two
        // DateFields (below), never in the read view.
        {
          label: 'Dates',
          value: formatEventDayRange(requireDateMs(form.startDate), requireDateMs(form.endDate)),
          hint: datesHint(requireDateMs(form.startDate), form.timezone),
        },
        // DEC-896: the time zone note -- every date on this row and every
        // deadline elsewhere in the event (CFP closes, agenda times) reads
        // through event-time.ts against this same zone, not the viewer's.
        { label: 'Time zone', value: form.timezone, hint: 'Applies to every date and deadline in this event' },
        { label: 'Venue', value: form.location || 'Not set' },
        { label: 'Record prefix', value: form.recordPrefix },
        { label: 'Branding', value: brandingSummary(form) },
        ...(mailStatus ? [{ label: 'Email', value: mailStatusSummary(mailStatus) }] : []),
      ]
    : [];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      {unscheduledNotice ? (
        <p role="status" className="chq-event-unscheduled-notice">
          {unscheduledNotice.sessions ? (
            <>
              {unscheduledNotice.sessions.count} placed {plural(unscheduledNotice.sessions.count, 'session')} now
              fall{unscheduledNotice.sessions.count === 1 ? 's' : ''} outside these dates and{' '}
              {unscheduledNotice.sessions.count === 1 ? 'has' : 'have'} been unscheduled:{' '}
              {unscheduledNotice.sessions.sessions.map((s) => s.ref).join(', ')}.{' '}
            </>
          ) : null}
          {unscheduledNotice.breaks ? (
            <>
              {unscheduledNotice.breaks.count} {plural(unscheduledNotice.breaks.count, 'break')} now fall
              {unscheduledNotice.breaks.count === 1 ? 's' : ''} outside these dates:{' '}
              {unscheduledNotice.breaks.breaks.map((b) => b.label).join(', ')}.{' '}
            </>
          ) : null}
          <Link to="/agenda">View agenda</Link>
        </p>
      ) : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Event"
        rows={rows}
        actionLabel="Change"
        editing={editing}
      >
        {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <label>
            Name
            <input className="chq-input" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </label>
          <label>
            Slug
            <input className="chq-input" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          </label>
          <label htmlFor="event-settings-start-date">
            Start date
            <DateField
              id="event-settings-start-date"
              value={form.startDate}
              onChange={(next) => update('startDate', next)}
            />
          </label>
          <label htmlFor="event-settings-end-date">
            End date
            <DateField
              id="event-settings-end-date"
              value={form.endDate}
              onChange={(next) => update('endDate', next)}
            />
          </label>
          <label>
            Location
            <input className="chq-input" value={form.location} onChange={(e) => update('location', e.target.value)} />
          </label>
          <label>
            Timezone
            <input className="chq-input" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} />
          </label>
          <label>
            Record prefix
            <input className="chq-input" value={form.recordPrefix} readOnly disabled />
          </label>
          <label>
            Logo URL
            <input className="chq-input" value={form.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} />
          </label>
          <label>
            Accent color
            <input
              className="chq-input"
              value={form.accentColor}
              onChange={(e) => update('accentColor', e.target.value)}
            />
          </label>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={closeEdit} disabled={saving}>
            Cancel
          </button>
          {saved ? <span role="status"> Saved.</span> : null}
        </form>
        ) : null}
      </SummarySection>
    </>
  );
}
