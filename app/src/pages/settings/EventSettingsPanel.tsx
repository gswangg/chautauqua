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
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { buildEventPatch, type EventSettingsForm } from './formState';
import { SummarySection } from './SummarySection';

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

function brandingSummary(form: EventSettingsForm): string {
  const parts: string[] = [];
  if (form.logoUrl) parts.push('Logo set');
  if (form.accentColor) parts.push(`Accent ${form.accentColor}`);
  return parts.length > 0 ? parts.join(' · ') : 'Not set';
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
  const [unscheduledNotice, setUnscheduledNotice] = useState<EventDetail['unscheduledByWindow'] | null>(null);

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
      setUnscheduledNotice(
        updated.unscheduledByWindow && updated.unscheduledByWindow.count > 0 ? updated.unscheduledByWindow : null,
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
        { label: 'Slug', value: form.slug },
        { label: 'Starts', value: form.startDate },
        { label: 'Ends', value: form.endDate },
        { label: 'Time zone', value: form.timezone },
        { label: 'Venue', value: form.location || 'Not set' },
        { label: 'Record prefix', value: form.recordPrefix },
        { label: 'Branding', value: brandingSummary(form) },
      ]
    : [];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      {unscheduledNotice ? (
        <p role="status" className="chq-event-unscheduled-notice">
          {unscheduledNotice.count} placed session{unscheduledNotice.count === 1 ? '' : 's'} now fall
          {unscheduledNotice.count === 1 ? 's' : ''} outside these dates and{' '}
          {unscheduledNotice.count === 1 ? 'has' : 'have'} been unscheduled:{' '}
          {unscheduledNotice.sessions.map((s) => s.ref).join(', ')}. <Link to="/agenda">View agenda</Link>
        </p>
      ) : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Event settings"
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
          <label>
            Start date
            <input
              className="chq-input"
              type="date"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </label>
          <label>
            End date
            <input
              className="chq-input"
              type="date"
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
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
