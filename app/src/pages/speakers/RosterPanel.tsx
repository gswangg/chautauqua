// DEC-290: SPK-01/02/03 -- add-speaker and import-CSV UI on /admin/speakers.
// The add-speaker form and the ImportWizard launch live here; their trigger
// buttons live in OnboardingGrid's single title action row (DEC-662 --
// restoring mock density means exactly one <h1> and one action row on this
// page). RosterPanel is a controlled panel: `mode` says which body (if any)
// is open, `onClose` collapses it (Cancel / successful add / wizard close),
// `onChanged` tells the page to reload the grid. The panel itself stays
// mounted across a close (it owns the post-add toast), so each body it opens
// is a SEPARATE mount-gated component holding its own state -- see
// AddSpeakerModal below.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ImportWizard } from '../contacts/ImportWizard';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { DuplicateEmailNotice } from '../contacts/DuplicateEmailNotice';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH } from '../../lib/text-caps';
import { ParticipationMenu } from './ParticipationMenu';
import type { InviteStatus, OnboardingRow } from './types';

// DEC-958 (wave 58): every wire key POST /contacts's crud.ts validator can
// name on this form's own submitted body (src/routes/api/contacts/crud.ts
// firstName/lastName/email/company/title/bio + the eventId-scoped
// sessionTitle field, src/domain/contacts.ts) gets a stable id, a display
// label for the ErrorSummary anchor list, and its own entry in the field
// order below (form layout order, so the summary's problem list reads
// top-to-bottom the same way the form does).
const FIELD_ORDER = ['firstName', 'lastName', 'sessionTitle', 'email', 'title', 'company', 'bio'] as const;
type SpeakerField = (typeof FIELD_ORDER)[number];

const FIELD_IDS: Record<SpeakerField, string> = {
  firstName: 'roster-first-name',
  lastName: 'roster-last-name',
  sessionTitle: 'roster-session-title',
  email: 'roster-email',
  title: 'roster-title',
  company: 'roster-company',
  bio: 'roster-bio',
};

const FIELD_LABELS: Record<SpeakerField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  sessionTitle: 'Session title',
  email: 'Email',
  title: 'Title',
  company: 'Company',
  bio: 'Bio',
};

interface DuplicateCandidateMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  reason: 'email' | 'name';
}

// DEC-788: fields settle 400ms after the last keystroke before the
// create-time duplicate check fires -- the same debounce NewContactModal
// uses, reusing its query-param shape verbatim so the two surfaces cannot
// drift.
const DUPLICATE_CHECK_DEBOUNCE_MS = 400;

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

interface AddSpeakerModalProps {
  eventId: string;
  onClose: () => void;
  /** Called with the added person's name once the add succeeded -- the parent
   * owns the toast (which outlives this dialog) and the grid reload. */
  onAdded: (name: string) => void;
}

// Eval finding (wave-5 retest): the add-speaker dialog owns its own state and
// is MOUNTED ONLY WHILE OPEN -- the same shape ContactsApp gives every one of
// its dialogs (`{showNewContact && <NewContactModal ... />}`), where closing
// unmounts and reopening therefore starts clean. RosterPanel itself cannot be
// unmounted (it still renders the post-add toast under mode 'none'), so the
// form/refusal/duplicate-check state lives HERE rather than there: while it
// sat on RosterPanel it survived a close, and reopening Add speaker
// redisplayed the previous attempt's typed values and its 409 banner
// ("<someone> already uses this email") on top of the new person being typed.
function AddSpeakerModal({ eventId, onClose, onAdded }: AddSpeakerModalProps) {
  const [form, setForm] = useState<NewSpeakerForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-958: the WHOLE err.fields map, keyed by the server's own wire keys
  // -- never just the values (a values-only join discards which control
  // to blame). Seeded fresh on every refusal; never cleared by a refetch,
  // so the user's typed values in `form` are the only source of truth and
  // are never reset here.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCandidateMatch | null>(null);

  function updateField<K extends keyof NewSpeakerForm>(key: K, value: NewSpeakerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // DEC-788: warn about a possible duplicate as the name/company/email
  // fields settle, using GET /contacts/duplicates/check -- the same
  // pair-matching predicate the Duplicates tab uses. This NEVER blocks Add;
  // it's a quiet hint above the submit row.
  useEffect(() => {
    if (form.firstName.trim() === '' && form.lastName.trim() === '' && form.email.trim() === '') {
      setDuplicateMatch(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set('firstName', form.firstName);
      params.set('lastName', form.lastName);
      params.set('email', form.email);
      if (form.company.trim() !== '') params.set('company', form.company);
      apiGet<{ items: DuplicateCandidateMatch[] }>(`/contacts/duplicates/check?${params.toString()}`)
        .then((res) => {
          if (!cancelled) setDuplicateMatch(res.items[0] ?? null);
        })
        .catch(() => {
          if (!cancelled) setDuplicateMatch(null);
        });
    }, DUPLICATE_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.firstName, form.lastName, form.email, form.company]);

  async function handleAddSpeaker(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setConflict(false);
    setFieldErrors({});
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
      onAdded(`${form.firstName} ${form.lastName}`);
    } catch (err) {
      if (err instanceof ApiError) {
        // DEC-788/DEC-958: the conflict path forwards to
        // DuplicateEmailNotice below (which already carries the email
        // detail) -- it stays a single top-of-form line, never the field
        // summary, even though the server's conflict body also sets
        // fields.email.
        if (err.code === 'conflict') {
          setConflict(true);
          setError(err.message);
        } else if (err.fields && Object.keys(err.fields).length > 0) {
          setFieldErrors(err.fields);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to add speaker');
      }
    } finally {
      setAdding(false);
    }
  }

  function fieldClassName(key: SpeakerField, base: string) {
    return fieldErrors[key] ? `${base} chq-field-invalid` : base;
  }

  function fieldAriaInvalid(key: SpeakerField): 'true' | undefined {
    return fieldErrors[key] ? 'true' : undefined;
  }

  const errorSummaryProblems = FIELD_ORDER.filter((key) => fieldErrors[key] !== undefined).map((key) => ({
    anchorId: FIELD_IDS[key],
    label: FIELD_LABELS[key],
  }));

  return (
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
      {/* G13 lane-D fix (04-speakers--00, ruling A13): 'the roster is
          where adding people lives' — the CSV-import link sits here
          beside Add a speaker, off the grid's title row, carrying the
          event id so the Contacts wizard preselects this event. */}
      <Link
        to={`/contacts?import=1&eventId=${encodeURIComponent(eventId)}`}
        className="chq-link-button chq-speakers-import-link"
      >
        Import speakers from a CSV
      </Link>
      {error && <div className="chq-error">{error}</div>}
      {errorSummaryProblems.length > 0 && (
        <ErrorSummary
          heading={countHeading(errorSummaryProblems.length, 'before this speaker can be added')}
          kept="Nothing was lost. Your typed values are still below."
          problems={errorSummaryProblems}
        />
      )}
      {conflict && (
        <DuplicateEmailNotice
          email={form.email}
          addToEvent={{
            eventId,
            sessionTitle: form.sessionTitle,
            onAdded,
          }}
        />
      )}
      <FormRow label="First name" htmlFor="roster-first-name" error={fieldErrors.firstName}>
        <input
          id="roster-first-name"
          className={fieldClassName('firstName', 'chq-input')}
          type="text"
          maxLength={MAX_NAME_LENGTH}
          required
          aria-invalid={fieldAriaInvalid('firstName')}
          value={form.firstName}
          onChange={(e) => updateField('firstName', e.target.value)}
        />
      </FormRow>
      <FormRow label="Last name" htmlFor="roster-last-name" error={fieldErrors.lastName}>
        <input
          id="roster-last-name"
          className={fieldClassName('lastName', 'chq-input')}
          type="text"
          maxLength={MAX_NAME_LENGTH}
          required
          aria-invalid={fieldAriaInvalid('lastName')}
          value={form.lastName}
          onChange={(e) => updateField('lastName', e.target.value)}
        />
      </FormRow>
      <FormRow
        label="Session title"
        htmlFor="roster-session-title"
        help="Added as an accepted session on this event. No email is sent."
        error={fieldErrors.sessionTitle}
      >
        <input
          id="roster-session-title"
          className={fieldClassName('sessionTitle', 'chq-input')}
          type="text"
          maxLength={MAX_NAME_LENGTH}
          required
          placeholder="e.g. Scaling Kubernetes at 2am"
          aria-invalid={fieldAriaInvalid('sessionTitle')}
          value={form.sessionTitle}
          onChange={(e) => updateField('sessionTitle', e.target.value)}
        />
      </FormRow>
      <FormRow label="Email" htmlFor="roster-email" error={fieldErrors.email}>
        <input
          id="roster-email"
          className={fieldClassName('email', 'chq-input')}
          type="email"
          maxLength={MAX_NAME_LENGTH}
          required
          aria-invalid={fieldAriaInvalid('email')}
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
        />
      </FormRow>
      <FormRow label="Title" htmlFor="roster-title" optional error={fieldErrors.title}>
        <input
          id="roster-title"
          className={fieldClassName('title', 'chq-input')}
          type="text"
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={fieldAriaInvalid('title')}
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
        />
      </FormRow>
      <FormRow label="Company" htmlFor="roster-company" optional error={fieldErrors.company}>
        <input
          id="roster-company"
          className={fieldClassName('company', 'chq-input')}
          type="text"
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={fieldAriaInvalid('company')}
          value={form.company}
          onChange={(e) => updateField('company', e.target.value)}
        />
      </FormRow>
      <FormRow label="Bio" htmlFor="roster-bio" optional error={fieldErrors.bio}>
        <textarea
          id="roster-bio"
          className={fieldClassName('bio', 'chq-textarea')}
          maxLength={MAX_LONG_TEXT_LENGTH}
          aria-invalid={fieldAriaInvalid('bio')}
          value={form.bio}
          onChange={(e) => updateField('bio', e.target.value)}
        />
      </FormRow>
      {duplicateMatch && (
        <p className="chq-speakers-roster-duplicate-hint" role="status">
          Possible duplicate:{' '}
          {/* DEC-834 / DEC-837: the router's basename is already '/admin' -- a
              `to` starting with '/admin/contacts' resolves to
              '/admin/admin/contacts' and 404s. */}
          <Link to={`/contacts?openContact=${duplicateMatch.id}`}>
            {duplicateMatch.firstName} {duplicateMatch.lastName}
            {duplicateMatch.company ? `, ${duplicateMatch.company}` : ''}
          </Link>
        </p>
      )}
    </ModalFrame>
  );
}

export function RosterPanel({ mode, onClose, onChanged }: RosterPanelProps) {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  // The toast outlives the dialog that produced it -- it is what the closed
  // panel renders under mode 'none' -- so it stays here while every piece of
  // add-form state lives on the mount-gated AddSpeakerModal above.
  const [toast, setToast] = useState<string | null>(null);

  function handleAdded(name: string) {
    setToast(`Added ${name}.`);
    onChanged();
    onClose();
  }

  if (eventLoading) {
    return null;
  }

  if (mode === 'none') {
    return toast ? (
      <div className="chq-toast" role="status">
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
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {mode === 'add' && <AddSpeakerModal eventId={eventId} onClose={onClose} onAdded={handleAdded} />}

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

// docs/design/Chautauqua Speakers.dc.html:260 `Roster · 390` -- a drill-in
// off the Speakers phone cluster (the entry link lives in OnboardingGrid's
// phone head, itself hidden above 700px, so this screen is a phone-only
// state and never contests the frozen desktop layout). It reuses the SAME
// roster rows and invite-status handlers OnboardingGrid already threads
// into its phone cards -- no second fetch, no second mutation path, just a
// simpler read of a shared data source.
export interface RosterDrillInProps {
  rows: readonly OnboardingRow[];
  acceptedCount: number;
  notClaimedCount: number;
  // DEC-662/DEC-746: 'Add speaker' opens RosterPanel's own 'add' mode, which
  // Speakers.tsx (outside this task's owned files) already wires to
  // OnboardingGrid's `onAddSpeaker` prop -- reused verbatim rather than
  // inventing a second trigger path.
  onAddSpeaker: () => void;
  onBack: () => void;
  eventId: string;
  onSelectStatus: (contactId: string, submissionId: string, participantId: string, status: InviteStatus) => void;
  onSendInvite: (contactId: string) => void;
  invitingContactIds: ReadonlySet<string>;
}

export function RosterDrillIn({
  rows,
  acceptedCount,
  notClaimedCount,
  onAddSpeaker,
  onBack,
  eventId,
  onSelectStatus,
  onSendInvite,
  invitingContactIds,
}: RosterDrillInProps) {
  return (
    <div className="chq-speakers-roster-drillin">
      {/* docs/design/Chautauqua Speakers.dc.html:261
          `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0;
          display:flex; flex-direction:column; gap:7px` -- the drill-in
          register (25px H1), landed classes shared with every other 390
          drill-in (DEC-643 amendment). */}
      <div className="chq-phone-head chq-phone-head-drill">
        <button type="button" className="chq-phone-back" onClick={onBack}>
          &lsaquo; Speakers
        </button>
        <h1 className="chq-page-title">Roster</h1>
        <span className="chq-summary">
          <strong>{acceptedCount}</strong> accepted &middot; <strong>{notClaimedCount}</strong> not claimed
        </span>
      </div>

      {/* DEC-937 w9-d: the shared .chq-phone-body already supplies the
          scroll/flex geometry (styles.css) and .chq-speakers-roster-row
          supplies its own row padding/border-bottom (speakers.css) -- no
          rule ever existed for a distinct roster-body class, so the extra
          hook is dropped rather than left dead. */}
      <div className="chq-phone-body">
        {rows.map((row) => (
          <div key={row.contact.id} className="chq-speakers-roster-row">
            <div className="chq-speakers-roster-row-identity">
              <Link className="chq-row-title chq-speakers-name-link" to={`/speakers/${row.contact.id}`}>
                {row.contact.name}
              </Link>
              <span className="chq-meta chq-speakers-roster-row-meta">{row.contact.company ?? '—'}</span>
              {row.contact.participations.map((participation) => (
                <ParticipationMenu
                  key={participation.participantId}
                  contactName={row.contact.name}
                  label={row.contact.participations.length > 1 ? participation.ref : undefined}
                  status={participation.inviteStatus}
                  company={row.contact.company}
                  hasAccount={row.contact.hasAccount}
                  onSelectStatus={(status) =>
                    onSelectStatus(row.contact.id, participation.submissionId, participation.participantId, status)
                  }
                  onSendInvite={() => onSendInvite(row.contact.id)}
                  sendInviteDisabled={invitingContactIds.has(row.contact.id)}
                  density="dense"
                />
              ))}
            </div>
            <Link className="chq-btn chq-btn-secondary chq-speakers-roster-open" to={`/speakers/${row.contact.id}`}>
              Open
            </Link>
          </div>
        ))}
      </div>

      {/* docs/design/Chautauqua Speakers.dc.html:278
          `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF;
          padding:12px 16px 16px; display:flex; gap:8px` -- 'Add a speaker'
          opens RosterPanel's own 'add' mode (DEC-290); 'Import CSV' points
          at the SAME Contacts-page import link this file's own 'add' modal
          already carries a few lines above (Import speakers from a CSV),
          since G13 lane-D fix (04-speakers--00) moved CSV import off this
          page's grid and onto Contacts -- there is no second import path to
          invent here. */}
      <div className="chq-phone-dock">
        <button type="button" className="chq-btn chq-btn-primary" onClick={onAddSpeaker}>
          Add a speaker
        </button>
        <Link
          className="chq-btn chq-btn-secondary"
          to={`/contacts?import=1&eventId=${encodeURIComponent(eventId)}`}
        >
          Import CSV
        </Link>
      </div>
    </div>
  );
}
