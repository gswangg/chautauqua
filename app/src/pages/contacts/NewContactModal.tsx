import { useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { ModalFrame } from '../../components/ModalFrame';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

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
    </ModalFrame>
  );
}
