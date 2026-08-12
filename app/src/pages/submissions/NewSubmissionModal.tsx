// 'New submission' modal (DEC-031, J3 manual session creation): title
// required, description + optional speaker email/first/last, posts to the
// landed POST /api/v1/events/:eventId/submissions.
//
// DEC-598 (closes CNT-D6): a submission created here previously could never
// be given a track, which silently removed it from track-scoped reviewer
// assignment, the public track filter and the agenda's track identity. The
// Track control below is MULTI-select checkboxes, not radios (DEC-579: the
// data model is multi-track — the reported 'bug' was the label, not the
// model). The Format select is populated from the default form's Format
// dropdown field (same {'format','session format'} label match the
// Submissions table's default-shown column uses, DEC-243/DEC-249).

import { useState, type FormEvent, type MouseEvent } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';
import type { FormField, Track } from './types';

export interface NewSubmissionInput {
  title: string;
  description: string;
  contact: { email: string; firstName: string; lastName: string } | null;
  trackIds: string[];
}

interface NewSubmissionModalProps {
  tracks: Track[];
  formatField?: FormField;
  onCancel: () => void;
  onCreate: (input: NewSubmissionInput) => Promise<void>;
}

export function NewSubmissionModal({ tracks, formatField, onCancel, onCreate }: NewSubmissionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [format, setFormat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleTrack(trackId: string) {
    setTrackIds((prev) => (prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]));
  }

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
      await onCreate({ title: trimmedTitle, description: description.trim(), contact, trackIds });
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

        {tracks.length > 0 && (
          <fieldset className="chq-submissions-modal-field">
            <legend className="chq-submissions-modal-label">Tracks</legend>
            {tracks.map((track) => (
              <label key={track.id} className="chq-submissions-modal-checkbox">
                <input
                  type="checkbox"
                  checked={trackIds.includes(track.id)}
                  onChange={() => toggleTrack(track.id)}
                />
                {track.name}
              </label>
            ))}
          </fieldset>
        )}

        {formatField && (
          <label className="chq-submissions-modal-field">
            <span className="chq-submissions-modal-label">{formatField.label}</span>
            <select className="chq-select" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Select...</option>
              {(formatField.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

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
