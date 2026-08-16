import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { DuplicateEmailNotice } from './DuplicateEmailNotice';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface DuplicateCandidateMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  reason: 'email' | 'name';
}

// DEC-788: fields settle 400ms after the last keystroke before the
// create-time duplicate check fires — quiet enough not to hammer the
// endpoint on every keystroke, quick enough to feel live.
const DUPLICATE_CHECK_DEBOUNCE_MS = 400;

/** DEC-597: "New contact" — the directory's own create-one-person path,
 * same ModalFrame dialog contract as AddToEventModal (Escape closes, scrim
 * click closes), posting to the existing POST /contacts. */
export function NewContactModal({ onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCandidateMatch | null>(null);
  // DEC-755 amendment (wave 43) / DEC-788 amendment (wave 8): a 409 from
  // POST /contacts (find-or-REFUSE) renders the shared DuplicateEmailNotice,
  // which resolves the existing contact via GET /contacts?q=<email> and
  // offers to open it -- rather than leaving the organizer stuck on a
  // named-but-unreachable conflict.
  const [conflict, setConflict] = useState(false);

  // DEC-788: warn about a possible duplicate as the name/company/email
  // fields settle, using GET /contacts/duplicates/check — the same
  // pair-matching predicate the Duplicates tab uses. This NEVER blocks
  // Create; it's a quiet hint above the submit row. Cancelled on unmount
  // and whenever the fields change again before the debounce fires.
  useEffect(() => {
    if (firstName.trim() === '' && lastName.trim() === '' && email.trim() === '') {
      setDuplicateMatch(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set('firstName', firstName);
      params.set('lastName', lastName);
      params.set('email', email);
      if (company.trim() !== '') params.set('company', company);
      apiGet<{ items: DuplicateCandidateMatch[] }>(`/contacts/duplicates/check?${params.toString()}`)
        .then((res) => {
          if (!cancelled) setDuplicateMatch(res.items[0] ?? null);
        })
        .catch(() => {
          // A failed check is not itself an error worth surfacing — the
          // hint is advisory, never a save blocker.
          if (!cancelled) setDuplicateMatch(null);
        });
    }, DUPLICATE_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [firstName, lastName, email, company]);

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    setConflict(false);
    try {
      await apiPost('/contacts', {
        firstName,
        lastName,
        email,
        company: company.trim() === '' ? undefined : company,
        title: title.trim() === '' ? undefined : title,
      });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
        if (err.code === 'conflict') {
          setConflict(true);
        }
      } else {
        setError('Failed to create contact');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title="New contact"
      subtitle="Added to the org, not to an event"
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-new-contact-modal"
      actions={
        <>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={busy || firstName.trim() === '' || lastName.trim() === '' || email.trim() === ''}
            onClick={submit}
          >
            Add the contact
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </>
      }
    >
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {conflict && <DuplicateEmailNotice email={email} />}

      <div className="chq-contacts-new-contact-row-2up">
        <FormRow label="First name" htmlFor="new-contact-first-name" error={fields.firstName}>
          <input
            id="new-contact-first-name"
            className="chq-input"
            maxLength={MAX_NAME_LENGTH}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
          />
        </FormRow>
        <FormRow label="Last name" htmlFor="new-contact-last-name" error={fields.lastName}>
          <input
            id="new-contact-last-name"
            className="chq-input"
            maxLength={MAX_NAME_LENGTH}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
        </FormRow>
      </div>
      <FormRow
        label="Email"
        htmlFor="new-contact-email"
        error={fields.email}
        help="It's how contacts are matched and merged — the same key the CSV importer's dedupe and the merge tool use."
      >
        <input
          id="new-contact-email"
          className="chq-input"
          type="email"
          maxLength={MAX_NAME_LENGTH}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com"
        />
      </FormRow>
      <div className="chq-contacts-new-contact-row-2up">
        <FormRow label="Company" htmlFor="new-contact-company" error={fields.company} optional>
          <input
            id="new-contact-company"
            className="chq-input"
            maxLength={MAX_NAME_LENGTH}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
          />
        </FormRow>
        <FormRow label="Title" htmlFor="new-contact-title" error={fields.title} optional>
          <input
            id="new-contact-title"
            className="chq-input"
            maxLength={MAX_NAME_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title"
          />
        </FormRow>
      </div>
      {duplicateMatch && (
        <p className="chq-contacts-new-contact-duplicate-hint" role="status">
          Possible duplicate:{' '}
          {/* DEC-834 / DEC-837: the router's basename is already '/admin' -- a
              `to` starting with '/admin/contacts' resolves to
              '/admin/admin/contacts' and 404s. */}
          <Link to={`/contacts?openContact=${duplicateMatch.id}`} onClick={onClose}>
            {duplicateMatch.firstName} {duplicateMatch.lastName}
            {duplicateMatch.company ? `, ${duplicateMatch.company}` : ''}
          </Link>
        </p>
      )}
      {/* DEC-597 (wave 64 amendment): the modal closes by naming what it does
          not do -- adding someone here does not put them on an event; "Add
          to an event" on their directory row is the separate act. */}
      <p className="chq-contacts-new-contact-scope-note">
        Adding a contact here does not put them on an event — use &ldquo;Add to an event&rdquo; on their row for that.
      </p>
    </ModalFrame>
  );
}
