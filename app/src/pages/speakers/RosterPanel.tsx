// DEC-290: SPK-01/02/03 -- add-speaker and import-CSV UI on /admin/speakers.
// Renders above OnboardingGrid. Add-speaker POSTs a single contact scoped to
// the current event; Import CSV reopens the CRM's ImportWizard with an
// `eventId` so its import also pushes matches onto this event's roster.
import { useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ImportWizard } from '../contacts/ImportWizard';

interface NewSpeakerForm {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  company: string;
  bio: string;
}

const EMPTY_FORM: NewSpeakerForm = {
  firstName: '',
  lastName: '',
  email: '',
  title: '',
  company: '',
  bio: '',
};

interface RosterPanelProps {
  onChanged?: () => void;
}

export function RosterPanel({ onChanged }: RosterPanelProps) {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [form, setForm] = useState<NewSpeakerForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  function updateField<K extends keyof NewSpeakerForm>(key: K, value: NewSpeakerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddSpeaker(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;
    setAdding(true);
    setError(null);
    try {
      await apiPost('/contacts', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        title: form.title || undefined,
        company: form.company || undefined,
        bio: form.bio || undefined,
        eventId,
      });
      setForm(EMPTY_FORM);
      setToast(`Added ${form.firstName} ${form.lastName}.`);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add speaker');
    } finally {
      setAdding(false);
    }
  }

  if (eventLoading) {
    return null;
  }

  if (eventError || !eventId) {
    return <div className="chq-attention-frame">{eventError ?? 'No event selected.'}</div>;
  }

  return (
    <section className="chq-attention-frame chq-roster-panel">
      {error && <div className="chq-error-banner">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <form onSubmit={handleAddSpeaker} className="chq-roster-add-form">
        <h2>Add speaker</h2>
        <label htmlFor="roster-first-name">
          First name
          <input
            id="roster-first-name"
            type="text"
            required
            value={form.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
          />
        </label>
        <label htmlFor="roster-last-name">
          Last name
          <input
            id="roster-last-name"
            type="text"
            required
            value={form.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
          />
        </label>
        <label htmlFor="roster-email">
          Email
          <input
            id="roster-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </label>
        <label htmlFor="roster-title">
          Title
          <input id="roster-title" type="text" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
        </label>
        <label htmlFor="roster-company">
          Company
          <input
            id="roster-company"
            type="text"
            value={form.company}
            onChange={(e) => updateField('company', e.target.value)}
          />
        </label>
        <label htmlFor="roster-bio">
          Bio
          <textarea id="roster-bio" value={form.bio} onChange={(e) => updateField('bio', e.target.value)} />
        </label>
        <button type="submit" disabled={adding}>
          {adding ? 'Adding...' : 'Add speaker'}
        </button>
      </form>

      <button type="button" onClick={() => setShowImport(true)}>
        Import CSV
      </button>

      {showImport && (
        <ImportWizard
          eventId={eventId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}
