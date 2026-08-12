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
  const [expanded, setExpanded] = useState(false);
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
      setExpanded(false);
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
    return <div className="chq-error">{eventError ?? 'No event selected.'}</div>;
  }

  return (
    <section className="chq-speakers-roster">
      {error && <div className="chq-error">{error}</div>}
      {toast && (
        <div className="chq-error" role="status">
          {toast}
          <button type="button" className="chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {!expanded && (
        <div className="chq-speakers-roster-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setExpanded(true)}>
            Add speaker
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowImport(true)}>
            Import CSV
          </button>
        </div>
      )}

      {expanded && (
        <form onSubmit={handleAddSpeaker} className="chq-speakers-roster-form">
          <h2 className="chq-section-label">Add speaker</h2>
          <label className="chq-speakers-roster-field" htmlFor="roster-first-name">
            First name
            <input
              id="roster-first-name"
              className="chq-input"
              type="text"
              required
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
            />
          </label>
          <label className="chq-speakers-roster-field" htmlFor="roster-last-name">
            Last name
            <input
              id="roster-last-name"
              className="chq-input"
              type="text"
              required
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
            />
          </label>
          <label className="chq-speakers-roster-field" htmlFor="roster-email">
            Email
            <input
              id="roster-email"
              className="chq-input"
              type="email"
              required
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </label>
          <label className="chq-speakers-roster-field" htmlFor="roster-title">
            Title
            <input
              id="roster-title"
              className="chq-input"
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
            />
          </label>
          <label className="chq-speakers-roster-field" htmlFor="roster-company">
            Company
            <input
              id="roster-company"
              className="chq-input"
              type="text"
              value={form.company}
              onChange={(e) => updateField('company', e.target.value)}
            />
          </label>
          <label className="chq-speakers-roster-field" htmlFor="roster-bio">
            Bio
            <textarea
              id="roster-bio"
              className="chq-textarea"
              value={form.bio}
              onChange={(e) => updateField('bio', e.target.value)}
            />
          </label>
          <div className="chq-speakers-roster-actions">
            <button type="submit" className="chq-btn chq-btn-primary" disabled={adding}>
              {adding ? 'Adding...' : 'Add speaker'}
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setExpanded(false)}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
