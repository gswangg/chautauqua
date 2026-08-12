// Portal settings panel (w4-h, DEC-032): portal branding + welcome message
// + showResources toggle. PUT /api/v1/events/:id/portal-settings (upsert).
import { useEffect, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiPut, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import {
  buildPortalSettingsPayload,
  validatePortalSettingsForm,
  type PortalSettingsForm,
  type PortalSettingsFormErrors,
} from './formState';

interface PortalSettingsRecord {
  logoUrl: string | null;
  accentColor: string | null;
  welcomeMessage: string | null;
  showResources: boolean;
}

function toForm(record: PortalSettingsRecord): PortalSettingsForm {
  return {
    logoUrl: record.logoUrl ?? '',
    accentColor: record.accentColor ?? '',
    welcomeMessage: record.welcomeMessage ?? '',
    showResources: record.showResources,
  };
}

export function PortalSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [form, setForm] = useState<PortalSettingsForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PortalSettingsFormErrors>({});
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    apiGet<PortalSettingsRecord>(`/events/${eventId}/portal-settings`)
      .then((record) => setForm(toForm(record)))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load portal settings'));
  }, [eventId]);

  function update<K extends keyof PortalSettingsForm>(key: K, value: PortalSettingsForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSave() {
    if (!eventId || !form) return;
    const errors = validatePortalSettingsForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await apiPut<PortalSettingsRecord>(
        `/events/${eventId}/portal-settings`,
        buildPortalSettingsPayload(form),
      );
      setForm(toForm(updated));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save portal settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="chq-settings-panel" aria-label="Portal settings">
      <h2>Portal settings</h2>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
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
          {fieldErrors.accentColor ? <span role="alert">{fieldErrors.accentColor}</span> : null}
          <label>
            Welcome message
            <textarea
              className="chq-textarea"
              value={form.welcomeMessage}
              onChange={(e) => update('welcomeMessage', e.target.value)}
            />
          </label>
          <label>
            <input
              className="chq-check"
              type="checkbox"
              checked={form.showResources}
              onChange={(e) => update('showResources', e.target.checked)}
            />
            Show resources in portal
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
