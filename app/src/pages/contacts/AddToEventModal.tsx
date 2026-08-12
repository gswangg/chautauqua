import { useEffect, useState, type MouseEvent } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { useEscapeKey } from '../../lib/useEscapeKey';
import type { ContactListItem } from './types';

interface EventOption {
  id: string;
  name: string;
}

interface Props {
  contact: ContactListItem;
  onClose: () => void;
}

/** CRM-10 (DEC-156): "Add to event…" — pushes a contact into an event
 * directly as an accepted submission (no email). */
export function AddToEventModal({ contact, onClose }: Props) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState('');
  const [title, setTitle] = useState(`Invited: ${contact.firstName} ${contact.lastName}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    apiList<EventOption>('/events')
      .then((res) => {
        setEvents(res.items);
        if (res.items[0]) setEventId(res.items[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load events'));
  }, []);

  async function confirm() {
    if (!eventId) {
      setError('Select an event.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ submissionId: string }>(`/contacts/${contact.id}/add-to-event`, {
        eventId,
        title: title.trim() === '' ? undefined : title,
      });
      setSubmissionId(res.submissionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add contact to event');
    } finally {
      setBusy(false);
    }
  }

  useEscapeKey(true, () => {
    if (!busy) onClose();
  });

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Add to event" onClick={handleScrimClick}>
      <div className="chq-modal chq-contacts-add-to-event-modal">
        <div className="chq-contacts-modal-head">
          <div className="chq-contacts-modal-heading">
            <h2>Add to an event</h2>
            <span className="chq-meta">
              {contact.firstName} {contact.lastName}
            </span>
          </div>
          <button type="button" className="chq-btn-tertiary" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {error && <div className="chq-error">{error}</div>}

        {submissionId === null && (
          <>
            <p>
              Adding {contact.firstName} {contact.lastName} directly as an accepted speaker — no email is sent.
            </p>
            <label>
              Event
              <select className="chq-select" aria-label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {events.length === 0 && <option value="">No events</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input className="chq-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="chq-contacts-modal-actions">
              <button type="button" className="chq-btn chq-btn-primary" disabled={busy || !eventId} onClick={confirm}>
                Add them
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {submissionId !== null && (
          <div className="chq-add-to-event-result">
            <p>
              {contact.firstName} {contact.lastName} was added as an accepted speaker.
            </p>
            <a href="/admin/speakers">View in Speakers</a>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
