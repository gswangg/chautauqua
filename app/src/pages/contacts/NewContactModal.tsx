import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { ModalFrame } from '../../components/ModalFrame';

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
            Create contact
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

      <label>
        First name
        <input
          className="chq-input"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Priya"
        />
        {fields.firstName && <span className="chq-field-error">{fields.firstName}</span>}
      </label>
      <label>
        Last name
        <input
          className="chq-input"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Raman"
        />
        {fields.lastName && <span className="chq-field-error">{fields.lastName}</span>}
      </label>
      <label>
        Email
        <input
          className="chq-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="priya.raman@example.com"
        />
        {fields.email && <span className="chq-field-error">{fields.email}</span>}
      </label>
      <label>
        Company
        <input
          className="chq-input"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Latticework Systems"
        />
      </label>
      <label>
        Title
        <input
          className="chq-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Principal Engineer"
        />
      </label>
      {duplicateMatch && (
        <p className="chq-contacts-new-contact-duplicate-hint" role="status">
          Possible duplicate:{' '}
          <Link to={`/admin/contacts?openContact=${duplicateMatch.id}`} onClick={onClose}>
            {duplicateMatch.firstName} {duplicateMatch.lastName}
            {duplicateMatch.company ? `, ${duplicateMatch.company}` : ''}
          </Link>
        </p>
      )}
    </ModalFrame>
  );
}
