// Event settings panel (w4-h, DEC-032): name, slug, dates, location,
// timezone, record prefix (read-only), branding logo URL + accent color.
// PATCH /api/v1/events/:id (endpoint landed in w2-b's events.ts).
import { useEffect, useState } from 'react';
import { apiGet, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { buildEventPatch, type EventSettingsForm } from './formState';

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

export function EventSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [initial, setInitial] = useState<EventSettingsForm | null>(null);
  const [form, setForm] = useState<EventSettingsForm | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  async function handleSave() {
    if (!eventId || !initial || !form) return;
    const patch = buildEventPatch(initial, form);
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await apiPatch<EventDetail>(`/events/${eventId}`, patch);
      const f = toForm(updated);
      setInitial(f);
      setForm(f);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save event settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="chq-settings-panel" aria-label="Event settings">
      <h2>Event settings</h2>
      {eventLoading ? <p>Loading…</p> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
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
          {saved ? <span role="status"> Saved.</span> : null}
        </form>
      ) : null}
    </section>
  );
}
