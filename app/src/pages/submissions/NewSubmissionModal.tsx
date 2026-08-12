// 'New submission' modal (DEC-031, J3 manual session creation): title
// required, description + optional speaker email/first/last, posts to the
// landed POST /api/v1/events/:eventId/submissions.

import { useState, type FormEvent, type MouseEvent } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';

export interface NewSubmissionInput {
  title: string;
  description: string;
  contact: { email: string; firstName: string; lastName: string } | null;
}

interface NewSubmissionModalProps {
  onCancel: () => void;
  onCreate: (input: NewSubmissionInput) => Promise<void>;
}

export function NewSubmissionModal({ onCancel, onCreate }: NewSubmissionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    const trimmedEmail = email.trim();
    const contact = trimmedEmail
      ? { email: trimmedEmail, firstName: firstName.trim(), lastName: lastName.trim() }
      : null;

    setPending(true);
    setError(null);
    try {
      await onCreate({ title: trimmedTitle, description: description.trim(), contact });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create submission');
    } finally {
      setPending(false);
    }
  }

  useEscapeKey(true, onCancel);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !pending) onCancel();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="New submission" onClick={handleScrimClick}>
      <form className="chq-modal" onSubmit={submit}>
        <h2>New submission</h2>
        {error && <div className="chq-error">{error}</div>}

        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Title</span>
          <input className="chq-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Description</span>
          <textarea className="chq-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Speaker email (optional)</span>
          <input className="chq-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Speaker first name</span>
          <input className="chq-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Speaker last name</span>
          <input className="chq-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>

        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
