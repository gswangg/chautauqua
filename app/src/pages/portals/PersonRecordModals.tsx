// Person record dialogs: reopen one closed item for this person only,
// invite them to speak on an accepted session (flow 8, the organizer's
// side; the email links to /portal/invitations/:token), and give them one
// library task directly.
import { useEffect, useState, type FormEvent } from 'react';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { DateField } from '../../components/DateField';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { msToDateInput } from '../../lib/dates';
import { PARTICIPANT_ROLE_OPTIONS, DEFAULT_PARTICIPANT_ROLE } from '../../../../src/domain/participant-roles';
import { MAX_INVITATION_MESSAGE } from '../../lib/domain-caps';
import type { SubmissionListItem } from '../submissions/types';
import type { LibraryListing, ViewItemJson } from './types';
import { dayLabel } from './PersonRecordTables';

// yyyy-mm-dd, n calendar days from today
function daysFromToday(n: number): string {
  const now = new Date();
  return msToDateInput(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n));
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Reopen
// ---------------------------------------------------------------------------

export function ReopenModal(props: {
  eventId: string;
  contactId: string;
  firstName: string;
  item: ViewItemJson;
  onClose: () => void;
  onReopened: (until: string) => void;
}) {
  const { eventId, contactId, item } = props;
  // a week from today is the usual ask; the organizer can pick any day
  const [until, setUntil] = useState(() => daysFromToday(7));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!item.assignmentId) return;
    if (until === '') {
      setFieldError('Choose the last day it stays open.');
      return;
    }
    if (until < daysFromToday(0)) {
      setFieldError('Choose today or a later day.');
      return;
    }
    setFieldError(null);
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/events/${eventId}/people/${contactId}/reopen`, { assignmentId: item.assignmentId, until });
      props.onReopened(until);
    } catch (err) {
      if (err instanceof ApiError && err.fields?.until) setFieldError(err.message);
      else setError(errorMessage(err, 'Reopen failed'));
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={submit}
      title={`Reopen ${item.title}`}
      subtitle={`For ${props.firstName} only. ${item.dueDay !== null ? `It closed after ${dayLabel(item.dueDay)}.` : 'It is closed.'}`}
      onClose={props.onClose}
      closeDisabled={saving}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving}>
            {saving ? 'Reopening…' : 'Reopen'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={props.onClose} disabled={saving}>
            Cancel
          </button>
        </>
      }
    >
      {error ? <div className="chq-error">{error}</div> : null}
      <FormRow
        label="Open until"
        htmlFor="person-record-reopen-until"
        error={fieldError}
        help={`${props.firstName} can still send it until the end of this day. Everyone else keeps the deadline.`}
      >
        <DateField id="person-record-reopen-until" value={until} onChange={setUntil} required />
      </FormRow>
    </ModalFrame>
  );
}

// ---------------------------------------------------------------------------
// Invite to speak
// ---------------------------------------------------------------------------

type InviteField = 'submissionId' | 'role' | 'message' | 'replyBy';

export function InviteToSpeakModal(props: {
  eventId: string;
  contactId: string;
  name: string;
  // sessions they are already on (any status): the API refuses a second seat
  onSessionIds: Set<string>;
  onClose: () => void;
  onSent: () => void;
}) {
  const { eventId, contactId, onSessionIds } = props;
  const [sessions, setSessions] = useState<SubmissionListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState('');
  const [role, setRole] = useState(DEFAULT_PARTICIPANT_ROLE);
  const [message, setMessage] = useState('');
  const [replyBy, setReplyBy] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InviteField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    // accepted sessions only: an invitation onto a session still in review
    // would promise a slot the programme hasn't given
    apiList<SubmissionListItem>(`/events/${eventId}/submissions?status=accepted&perPage=200&sort=ref`)
      .then((res) => {
        if (live) setSessions(res.items.filter((s) => !onSessionIds.has(s.id)));
      })
      .catch((err) => {
        if (live) setLoadError(errorMessage(err, 'Failed to load sessions'));
      });
    return () => {
      live = false;
    };
  }, [eventId, onSessionIds]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submissionId === '') {
      setFieldErrors({ submissionId: 'Choose the session to invite them to.' });
      return;
    }
    if (replyBy !== '' && replyBy < daysFromToday(0)) {
      setFieldErrors({ replyBy: 'Choose today or a later day.' });
      return;
    }
    setFieldErrors({});
    setError(null);
    setSending(true);
    try {
      await apiPost(`/events/${eventId}/invitations`, {
        submissionId,
        contactId,
        role,
        message: message.trim() === '' ? null : message,
        replyBy: replyBy === '' ? null : replyBy,
      });
      props.onSent();
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : undefined;
      const field = (['submissionId', 'role', 'message', 'replyBy'] as const).find((f) => fields?.[f]);
      if (field) setFieldErrors({ [field]: errorMessage(err, 'Invalid value') });
      else setError(errorMessage(err, 'The invitation was not sent'));
      setSending(false);
    }
  }

  const noSessions = sessions !== null && sessions.length === 0;

  return (
    <ModalFrame
      as="form"
      onSubmit={submit}
      title="Invite to speak"
      subtitle={`${props.name} gets an email to accept or decline.`}
      onClose={props.onClose}
      closeDisabled={sending}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={sending || sessions === null || noSessions}>
            {sending ? 'Sending…' : 'Send invitation'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={props.onClose} disabled={sending}>
            Cancel
          </button>
        </>
      }
    >
      {error ? <div className="chq-error">{error}</div> : null}
      {loadError ? <div className="chq-error">{loadError}</div> : null}
      <FormRow
        label="Session"
        htmlFor="person-record-invite-session"
        error={fieldErrors.submissionId}
        help={noSessions ? `No accepted session ${props.name} isn't already on.` : undefined}
      >
        <select
          id="person-record-invite-session"
          className="chq-select"
          value={submissionId}
          onChange={(e) => setSubmissionId(e.target.value)}
          disabled={sessions === null || noSessions}
        >
          <option value="">Choose a session</option>
          {(sessions ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.ref} {s.title}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Role" htmlFor="person-record-invite-role" error={fieldErrors.role}>
        <select id="person-record-invite-role" className="chq-select" value={role} onChange={(e) => setRole(e.target.value)}>
          {PARTICIPANT_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow
        label="Personal message"
        htmlFor="person-record-invite-message"
        optional
        error={fieldErrors.message}
        help={`Shown in the email and on the invitation page. Up to ${MAX_INVITATION_MESSAGE} characters.`}
      >
        <textarea
          id="person-record-invite-message"
          className="chq-textarea"
          rows={4}
          value={message}
          maxLength={MAX_INVITATION_MESSAGE}
          onChange={(e) => setMessage(e.target.value)}
        />
      </FormRow>
      <FormRow label="Reply by" htmlFor="person-record-invite-reply-by" optional error={fieldErrors.replyBy}>
        <DateField id="person-record-invite-reply-by" value={replyBy} onChange={setReplyBy} />
      </FormRow>
    </ModalFrame>
  );
}

// ---------------------------------------------------------------------------
// Give an item (multi-portal decision 77): hand one library task to this
// person directly, beside whatever their portals bring. The assign door
// takes people on this event's roster (an accepted session) only.
// ---------------------------------------------------------------------------

export function GiveItemModal(props: {
  eventId: string;
  contactId: string;
  firstName: string;
  heldTaskIds: ReadonlySet<string>;
  onClose: () => void;
  onGiven: (title: string) => void;
}) {
  const { eventId, contactId, heldTaskIds } = props;
  const [tasks, setTasks] = useState<{ id: string; title: string }[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<LibraryListing>(`/events/${eventId}/library`)
      .then((res) => {
        if (cancelled) return;
        const open = res.entries.flatMap((e) =>
          'taskId' in e.ref && !heldTaskIds.has(e.ref.taskId) ? [{ id: e.ref.taskId, title: e.title }] : [],
        );
        setTasks(open);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'The library could not be loaded.'));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, heldTaskIds]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (taskId === '') {
      setFieldError('Choose an item to give.');
      return;
    }
    setFieldError(null);
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/tasks/${taskId}/assign`, { contactIds: [contactId] });
      props.onGiven(tasks?.find((t) => t.id === taskId)?.title ?? 'The item');
    } catch (err) {
      if (err instanceof ApiError && err.fields?.contactIds) setError(err.fields.contactIds);
      else setError(errorMessage(err, 'Giving the item failed'));
      setSaving(false);
    }
  }

  const none = tasks !== null && tasks.length === 0;
  return (
    <ModalFrame
      as="form"
      onSubmit={submit}
      title="Give an item"
      subtitle={`For ${props.firstName} only, beside what their portals bring.`}
      onClose={props.onClose}
      closeDisabled={saving}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving || tasks === null || none}>
            {saving ? 'Giving…' : 'Give it'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={props.onClose} disabled={saving}>
            Cancel
          </button>
        </>
      }
    >
      {error ? (
        <div className="chq-error" role="alert">
          {error}
        </div>
      ) : null}
      {loadError ? (
        <div className="chq-error" role="alert">
          {loadError}
        </div>
      ) : null}
      {tasks === null && !loadError ? <DelayedLoading label="Loading the library…" /> : null}
      <FormRow
        label="Item"
        htmlFor="person-record-give-item"
        error={fieldError}
        help={none ? `${props.firstName} already has every task in the library.` : 'Any task in the library. They get it now, and keep it whichever portals they join or leave.'}
      >
        <select
          id="person-record-give-item"
          className="chq-select"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          disabled={tasks === null || none}
        >
          <option value="">Choose an item</option>
          {(tasks ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </FormRow>
    </ModalFrame>
  );
}
