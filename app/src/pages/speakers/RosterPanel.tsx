// DEC-290: SPK-01/02/03 -- add-speaker and import-CSV UI on /admin/speakers.
// The add-speaker form and the ImportWizard launch live here; their trigger
// buttons live in OnboardingGrid's single title action row (DEC-662 --
// restoring mock density means exactly one <h1> and one action row on this
// page). RosterPanel is a controlled panel: `mode` says which body (if any)
// is open, `onClose` collapses it (Cancel / successful add / wizard close),
// `onChanged` tells the page to reload the grid.
import { useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ImportWizard } from '../contacts/ImportWizard';
import { FormRow, ModalFrame } from '../../components/ModalFrame';

interface NewSpeakerForm {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  company: string;
  bio: string;
  sessionTitle: string;
}

const EMPTY_FORM: NewSpeakerForm = {
  firstName: '',
  sessionTitle: '',
  lastName: '',
  email: '',
  title: '',
  company: '',
  bio: '',
};

export type RosterPanelMode = 'none' | 'add' | 'import';

interface RosterPanelProps {
  mode: RosterPanelMode;
  onClose: () => void;
  onChanged: () => void;
}

export function RosterPanel({ mode, onClose, onChanged }: RosterPanelProps) {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [form, setForm] = useState<NewSpeakerForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
        // DEC-810: the server never invents a session title; adding to an
        // event requires naming the session here.
        sessionTitle: form.sessionTitle,
      });
      setToast(`Added ${form.firstName} ${form.lastName}.`);
      setForm(EMPTY_FORM);
      onChanged();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldDetail = err.fields ? Object.values(err.fields).join(' · ') : '';
        setError(fieldDetail ? `${err.message} — ${fieldDetail}` : err.message);
      } else {
        setError('Failed to add speaker');
      }
    } finally {
      setAdding(false);
    }
  }

  if (eventLoading) {
    return null;
  }

  if (mode === 'none') {
    return toast ? (
      <div className="chq-error" role="status">
        {toast}
        <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
          &times;
        </button>
      </div>
    ) : null;
  }

  if (eventError || !eventId) {
    return <div className="chq-error">{eventError ?? 'No event selected.'}</div>;
  }

  return (
    <>
      {toast && (
        <div className="chq-error" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {mode === 'add' && (
        <ModalFrame
          as="form"
          onSubmit={handleAddSpeaker}
          title="Add speaker"
          onClose={onClose}
          closeDisabled={adding}
          modalClassName="chq-speakers-add-modal"
          actions={
            <>
              <button type="submit" className="chq-btn chq-btn-primary" disabled={adding}>
                {adding ? 'Adding...' : 'Add speaker'}
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={adding}>
                Cancel
              </button>
            </>
          }
        >
          {error && <div className="chq-error">{error}</div>}
          <FormRow label="First name" htmlFor="roster-first-name">
            <input
              id="roster-first-name"
              className="chq-input"
              type="text"
              required
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
            />
          </FormRow>
          <FormRow label="Last name" htmlFor="roster-last-name">
            <input
              id="roster-last-name"
              className="chq-input"
              type="text"
              required
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
            />
          </FormRow>
          <FormRow
            label="Session title"
            htmlFor="roster-session-title"
            help="Added as an accepted session on this event. No email is sent."
          >
            <input
              id="roster-session-title"
              className="chq-input"
              type="text"
              required
              placeholder="e.g. Scaling Kubernetes at 2am"
              value={form.sessionTitle}
              onChange={(e) => updateField('sessionTitle', e.target.value)}
            />
          </FormRow>
          <FormRow label="Email" htmlFor="roster-email">
            <input
              id="roster-email"
              className="chq-input"
              type="email"
              required
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </FormRow>
          <FormRow label="Title" htmlFor="roster-title">
            <input
              id="roster-title"
              className="chq-input"
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
            />
          </FormRow>
          <FormRow label="Company" htmlFor="roster-company">
            <input
              id="roster-company"
              className="chq-input"
              type="text"
              value={form.company}
              onChange={(e) => updateField('company', e.target.value)}
            />
          </FormRow>
          <FormRow label="Bio" htmlFor="roster-bio">
            <textarea
              id="roster-bio"
              className="chq-textarea"
              value={form.bio}
              onChange={(e) => updateField('bio', e.target.value)}
            />
          </FormRow>
        </ModalFrame>
      )}

      {mode === 'import' && (
        <ImportWizard
          eventId={eventId}
          onClose={onClose}
          onImported={() => {
            onChanged();
          }}
        />
      )}
    </>
  );
}
