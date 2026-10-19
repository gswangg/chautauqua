// Person record (/contacts/:contactId; Portals frame 05, flow 3 "What a
// person gets, and why"): one person at the current event -- every
// participation and the portals it matched, every item and the portal that
// brought it -- built from the same person view the participant home and
// preview-as-participant render (src/server/repo/portals/view.ts), with
// finished work from portals they've left kept on the record. From here an
// organizer reopens a closed item for this person, gives them an event role
// (Press, Volunteer), invites them to speak, gives them a library task
// directly, or previews their portal.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { dateInputToMs } from '../../lib/dates';
import { isActiveParticipant } from '../../../../src/domain/acceptance';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import type { PersonRecord, ViewItemJson } from './types';
import { ItemsTable, ParticipationsTable, dayLabel, itemCount, itemGroups } from './PersonRecordTables';
import { EventRolesSection } from './PersonRecordEventRoles';
import { GiveItemModal, InviteToSpeakModal, ReopenModal } from './PersonRecordModals';
import { ContactDrawer } from '../contacts/ContactDrawer';
import './person-record.css';

// Role and invitation changes re-match portals in the background
// (scheduleReconcile); one later re-read picks up the items they bring.
const RECONCILE_REFETCH_MS = 2500;

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; record: PersonRecord }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

function displayName(c: PersonRecord['contact']): string {
  return `${c.firstName} ${c.lastName}`.trim() || c.email;
}

export function PersonRecordPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reopening, setReopening] = useState<ViewItemJson | null>(null);
  const [inviting, setInviting] = useState(false);
  const [giving, setGiving] = useState(false);
  // the person's contact details (name, email, profile, notes) are the
  // Contacts drawer; this page is their event record
  const [editingDetails, setEditingDetails] = useState(false);
  const timers = useRef<number[]>([]);

  const ready = Boolean(eventId && contactId);

  const fetchRecord = useCallback(
    async (initial: boolean) => {
      if (!eventId || !contactId) return;
      try {
        const record = await apiGet<PersonRecord>(`/events/${eventId}/people/${contactId}/portal`);
        setLoad({ kind: 'ready', record });
        setRefreshError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setLoad({ kind: 'not_found' });
        else if (initial) setLoad({ kind: 'error', message: err instanceof ApiError ? err.message : 'Failed to load this person' });
        // a failed re-read keeps the record on screen and says so
        else setRefreshError(err instanceof ApiError ? err.message : 'Failed to refresh this person');
      }
    },
    [eventId, contactId],
  );

  useEffect(() => {
    setLoad({ kind: 'loading' });
    void fetchRecord(true);
  }, [fetchRecord]);

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );

  const refetchNowAndAfterReconcile = useCallback(() => {
    void fetchRecord(false);
    timers.current.push(window.setTimeout(() => void fetchRecord(false), RECONCILE_REFETCH_MS));
  }, [fetchRecord]);

  const record = load.kind === 'ready' ? load.record : null;
  const onSessionIds = useMemo(
    () =>
      new Set(
        (record?.view.participations ?? [])
          .map((p) => p.participation.session?.submissionId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    [record],
  );
  // the tasks this person already holds, from any portal or given directly
  const heldTaskIds = useMemo(
    () =>
      new Set(
        [...(record?.view.profileItems ?? []), ...(record?.view.sections ?? []).flatMap((s) => s.items)]
          .filter((i) => i.assignmentId !== null && i.taskId !== null)
          .map((i) => i.taskId as string),
      ),
    [record],
  );
  // the assign door takes the event's roster (people on an accepted
  // session); like Speakers, an invited person gets tasks once they confirm
  const onRoster = (record?.view.participations ?? []).some(
    (p) =>
      p.participation.kind === 'session' &&
      p.participation.session?.status === 'accepted' &&
      isActiveParticipant(p.participation.participationStatus),
  );

  if (eventLoading || (ready && load.kind === 'loading')) {
    return (
      <div className="chq-page chq-measure-table chq-person-record-page">
        <PageSkeleton variant="table" label="Loading this person…" />
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-measure-table chq-person-record-page">
        <h1 className="chq-page-title">Person</h1>
        <div className="chq-error">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  // the link itself is the flex item (as the task view's back link is): a
  // wrapper around it measured 12px short, since a link button's negative
  // margins cancel its padding, and the label wrapped after the chevron
  const back = (
    <Link className="chq-link-button chq-person-record-back" to="/contacts">
      &lsaquo; Contacts
    </Link>
  );

  if (load.kind === 'not_found') {
    return (
      <div className="chq-page chq-measure-table chq-person-record-page">
        <div className="chq-person-record-titles">
          {back}
          <h1 className="chq-page-title">Contact not found</h1>
        </div>
        <EmptyState
          variant="fresh"
          what="There's no contact at this link in your organization."
          reason="It may have been deleted, or merged into another contact."
          action={{ label: 'Back to Contacts', to: '/contacts' }}
        />
      </div>
    );
  }

  if (load.kind === 'error' || !record) {
    return (
      <div className="chq-page chq-measure-table chq-person-record-page">
        <div className="chq-person-record-titles">
          {back}
          <h1 className="chq-page-title">Person</h1>
        </div>
        <div className="chq-error" role="alert">
          {load.kind === 'error' ? load.message : 'Failed to load this person'}{' '}
          <button type="button" className="chq-link-button" onClick={() => void fetchRecord(true)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { contact, view, eventRoles } = record;
  const name = displayName(contact);
  const firstName = contact.firstName.trim() || name;
  const meta = [contact.company, contact.title, contact.email].filter((v): v is string => !!v && v.trim() !== '').join(' · ');
  const groups = itemGroups(view);
  const items = itemCount(groups);
  const participations = view.participations;

  return (
    <div className="chq-page chq-measure-table chq-person-record-page">
      {toast ? (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
      {refreshError ? <div className="chq-error">{refreshError}</div> : null}

      <div className="chq-person-record-head">
        <div className="chq-person-record-titles">
          {back}
          <span className="chq-section-label">Event record · {view.eventName}</span>
          <h1 className="chq-page-title">{name}</h1>
          {meta ? <p className="chq-person-record-meta">{meta}</p> : null}
        </div>
        <div className="chq-person-record-tools">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setEditingDetails(true)}>
            Edit contact details
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setInviting(true)}>
            Invite to speak
          </button>
          {onRoster ? (
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setGiving(true)}>
              Give an item
            </button>
          ) : null}
          {/* a full page load: the preview is a logged, server-rendered page */}
          <a className="chq-btn chq-btn-secondary" href={`/portal/preview/people/${eventId}/${contact.id}`}>
            Preview as {firstName}
          </a>
        </div>
      </div>

      <section className="chq-section" aria-label="Participations">
        <div className="chq-section-head">
          <span className="chq-section-label">Participations · {participations.length}</span>
        </div>
        {participations.length === 0 ? (
          <EmptyState
            variant="fresh"
            what={`${firstName} has no participations in ${view.eventName}.`}
            reason="Invite them to speak, or give them an event role below, and the portals that match will bring their items."
          />
        ) : (
          <ParticipationsTable participations={participations} />
        )}
      </section>

      {participations.length > 0 || items > 0 ? (
        <section className="chq-section" aria-label="Every item">
          <div className="chq-section-head">
            <span className="chq-section-label">Every item, and the portal that brought it · {items}</span>
          </div>
          {items === 0 ? (
            <p className="chq-person-record-caption">No items yet. None of the portals {firstName} matches brings any.</p>
          ) : (
            <ItemsTable view={view} groups={groups} firstName={firstName} onReopen={(item) => setReopening(item)} />
          )}
        </section>
      ) : null}

      <EventRolesSection
        eventId={eventId}
        contactId={contact.id}
        firstName={firstName}
        roles={eventRoles}
        onChanged={(message) => {
          setToast(message);
          refetchNowAndAfterReconcile();
        }}
      />

      {reopening ? (
        <ReopenModal
          eventId={eventId}
          contactId={contact.id}
          firstName={firstName}
          item={reopening}
          onClose={() => setReopening(null)}
          onReopened={(until) => {
            const day = dateInputToMs(until);
            setToast(`${reopening.title} is open for ${firstName} until ${day !== null ? dayLabel(day) : until}.`);
            setReopening(null);
            void fetchRecord(false);
          }}
        />
      ) : null}

      {giving ? (
        <GiveItemModal
          eventId={eventId}
          contactId={contact.id}
          firstName={firstName}
          heldTaskIds={heldTaskIds}
          onClose={() => setGiving(false)}
          onGiven={(title) => {
            setGiving(false);
            setToast(`${title} given to ${firstName}.`);
            void fetchRecord(false);
          }}
        />
      ) : null}

      {editingDetails ? (
        <ContactDrawer
          contactId={contact.id}
          onClose={() => setEditingDetails(false)}
          onSaved={() => {
            setEditingDetails(false);
            void fetchRecord(false);
          }}
          onContactChanged={() => void fetchRecord(false)}
        />
      ) : null}

      {inviting ? (
        <InviteToSpeakModal
          eventId={eventId}
          contactId={contact.id}
          name={name}
          onSessionIds={onSessionIds}
          onClose={() => setInviting(false)}
          onSent={() => {
            setInviting(false);
            setToast(`Invitation sent to ${name}`);
            refetchNowAndAfterReconcile();
          }}
        />
      ) : null}
    </div>
  );
}
