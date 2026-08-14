// DEC-788 amendment (wave 8): the 409-duplicate-email forward path --
// resolve the existing contact by email and offer to open it, shared by
// NewContactModal (directory create) and RosterPanel's Add-speaker (event
// roster create). Renders nothing on a failed or empty lookup; the 409
// message itself already named the person, so a broken lookup must never
// replace that with a worse message.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../../lib/api';

interface DuplicateContact {
  id: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  email: string;
}

interface AddToEvent {
  eventId: string;
  sessionTitle: string;
  onAdded: (name: string) => void;
}

interface Props {
  email: string;
  addToEvent?: AddToEvent;
}

export function DuplicateEmailNotice({ email, addToEvent }: Props) {
  const [contact, setContact] = useState<DuplicateContact | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    setContact(null);
    setAddError(null);
    const trimmed = email.trim();
    if (trimmed === '') return;
    let cancelled = false;
    apiGet<{ items: DuplicateContact[] }>(`/contacts?q=${encodeURIComponent(trimmed)}`)
      .then((res) => {
        if (cancelled) return;
        const lower = trimmed.toLowerCase();
        const match = res.items.find((item) => item.email.toLowerCase() === lower) ?? res.items[0] ?? null;
        setContact(match);
      })
      .catch(() => {
        // Advisory only -- the 409 message already named the existing
        // contact; a failed lookup just drops the link/actions.
        if (!cancelled) setContact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  if (!contact) return null;

  const name = `${contact.firstName} ${contact.lastName}`;

  async function handleAddToEvent() {
    if (!addToEvent || !contact) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await apiPost(`/contacts/${contact.id}/add-to-event`, {
        eventId: addToEvent.eventId,
        title: addToEvent.sessionTitle.trim(),
        role: 'speaker',
      });
      addToEvent.onAdded(name);
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to add to event');
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <p className="chq-contacts-duplicate-email-notice">
      {name}
      {contact.company ? `, ${contact.company}` : ''}{' '}
      {/* DEC-834 / DEC-837: the router's basename is already '/admin' -- a
          `to` starting with '/admin/contacts' resolves to
          '/admin/admin/contacts' and 404s. */}
      <Link to={`/contacts?openContact=${contact.id}`}>Open this contact</Link>
      {addToEvent && (
        <>
          {' '}
          <button type="button" className="chq-btn chq-btn-secondary" onClick={handleAddToEvent} disabled={addBusy}>
            Add {name} to this event
          </button>
        </>
      )}
      {addError && (
        <span className="chq-error" role="alert">
          {' '}
          {addError}
        </span>
      )}
    </p>
  );
}
