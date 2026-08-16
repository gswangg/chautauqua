import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import type { ContactDetail, ContactListItem } from './types';
// DEC-714: the role control offers the app's OWN role vocabulary, imported
// -- never a hardcoded Speaker/Reviewer/Guest list, which would be a
// control that lies about two of its options ('reviewer' is an account
// role, 'guest' has no representation in the data model).
import { PARTICIPANT_ROLE_OPTIONS, participantRoleLabel } from '../../../../src/domain/participant-roles';
import { DEC_764, DEC_765, DEC_795 } from '../../../../src/decisions';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { plural } from '../../lib/plural';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';

// Compile-checked dependency markers: no `Invited: <name>` prefill, the
// title field is required before submit, and the confirmation names the
// role actually chosen (DEC-764); role is threaded through to the POST
// body (DEC-765). The Event select defaults to the event in context, and an
// existing roster spot on the selected event is an advisory, never a block
// (DEC-795).
void DEC_764;
void DEC_765;
void DEC_795;

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
  const { eventId: currentEventId } = useCurrentEvent();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState('');
  // DEC-764: no prefill -- a session title is something a person types, not
  // something the modal invents on their behalf.
  const [title, setTitle] = useState('');
  // DEC-714: default to the vocabulary's own first option ('speaker') --
  // never a bare string literal duplicating PARTICIPANT_ROLE_OPTIONS[0].
  const [role, setRole] = useState(PARTICIPANT_ROLE_OPTIONS[0]!.value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  // DEC-795: the contact's own submission history, fetched on mount, so the
  // modal can tell whether the SELECTED event already has this person on it.
  const [detail, setDetail] = useState<ContactDetail | null>(null);

  useEffect(() => {
    apiList<EventOption>('/events')
      .then((res) => {
        setEvents(res.items);
        // DEC-795: default to the event in context (when it's actually in
        // the returned list) -- never the arbitrary first row, which is how
        // a speaker got added to the wrong event.
        const inContext = currentEventId && res.items.some((ev) => ev.id === currentEventId);
        if (inContext) setEventId(currentEventId!);
        else if (res.items[0]) setEventId(res.items[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load events'));
  }, [currentEventId]);

  useEffect(() => {
    apiGet<ContactDetail>(`/contacts/${contact.id}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contact'));
  }, [contact.id]);

  // DEC-795: submissions this contact already has on the SELECTED event --
  // an advisory, never a block (a second session is legitimate).
  const submissionsOnSelectedEvent =
    detail?.history.submissions.filter((s) => s.eventId === eventId) ?? [];
  const alreadyOnRoster = eventId !== '' && submissionsOnSelectedEvent.length > 0;

  async function confirm() {
    if (!eventId) {
      setError('Select an event.');
      return;
    }
    if (title.trim() === '') {
      setError('Enter a session title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ submissionId: string }>(`/contacts/${contact.id}/add-to-event`, {
        eventId,
        title: title.trim(),
        role,
      });
      setSubmissionId(res.submissionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add contact to event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title="Add to an event"
      subtitle={`${contact.firstName} ${contact.lastName}`}
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-add-to-event-modal"
      actions={
        submissionId === null ? (
          <>
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={busy || !eventId || title.trim() === ''}
              onClick={confirm}
            >
              {alreadyOnRoster ? 'Add another session' : 'Add them'}
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
            Done
          </button>
        )
      }
    >
      {error && <div className="chq-error">{error}</div>}

      {submissionId === null && (
        <>
          <FormRow label="Event" htmlFor="add-to-event-select">
            <select
              id="add-to-event-select"
              className="chq-select"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              {events.length === 0 && <option value="">No events</option>}
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="As">
            <div className="chq-segmented" role="group" aria-label="As">
              {PARTICIPANT_ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={role === opt.value ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
                  aria-pressed={role === opt.value}
                  onClick={() => setRole(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label="Session title" htmlFor="add-to-event-title">
            <input
              id="add-to-event-title"
              className="chq-input"
              maxLength={MAX_NAME_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scaling Kubernetes at 2am"
            />
          </FormRow>
          {alreadyOnRoster && (
            // DEC-795: named in the person's own words, above the actions --
            // a second session is legitimate, so this never disables 'Add
            // them' (relabelled below), only tells the organizer what
            // they're about to do.
            <p className="chq-contacts-advisory chq-add-to-event-advisory">
              {contact.firstName} {contact.lastName} is already on this event — {submissionsOnSelectedEvent.length}{' '}
              {plural(submissionsOnSelectedEvent.length, 'session')}
            </p>
          )}
          <p className="chq-contacts-pipeline-caption">
            This creates an accepted session on that event. No email is sent.
          </p>
        </>
      )}

      {submissionId !== null && (
        <div className="chq-add-to-event-result">
          <p>
            {contact.firstName} {contact.lastName} was added as an accepted {participantRoleLabel(role).toLowerCase()}.
          </p>
          {/* DEC-834 / DEC-837: the router's basename is already '/admin' -- a
              `to` starting with '/admin/speakers' resolves to
              '/admin/admin/speakers' and 404s. */}
          <Link to={`/speakers?eventId=${eventId}`}>View in Speakers</Link>
        </div>
      )}
    </ModalFrame>
  );
}
