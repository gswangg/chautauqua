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
//
// DEC-651: mock copy at docs/design/Chautauqua Submissions.dc.html:454-480
// -- title, subtitle, field label ('Abstract'), placeholders and the
// primary-first ('Create it', then 'Cancel') action order all come from
// that frame.

import { useState, type FormEvent } from 'react';
import { ModalFrame } from '../../components/ModalFrame';
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

  return (
    <ModalFrame
      as="form"
      onSubmit={submit}
      title="New submission"
      subtitle="Invited talks and phone submissions"
      onClose={onCancel}
      closeDisabled={pending}
      modalClassName="chq-submissions-new-modal"
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
            Create it
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}

      <label className="chq-submissions-modal-field">
        <span className="chq-submissions-modal-label">Title</span>
        <input
          className="chq-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Opening Keynote"
          required
        />
      </label>
      <label className="chq-submissions-modal-field">
        <span className="chq-submissions-modal-label">Abstract</span>
        <textarea
          className="chq-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — you can fill this in later"
        />
      </label>

      {tracks.length > 0 && (
        <fieldset className="chq-submissions-modal-field">
          <legend className="chq-submissions-modal-label">Tracks</legend>
          {tracks.map((track) => (
            <label key={track.id} className="chq-checkbox-label">
              <input
                className="chq-check"
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
        <span className="chq-submissions-modal-label">Speaker name</span>
        <input
          className="chq-input"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Jordan Alvarez"
        />
      </label>
      <label className="chq-submissions-modal-field">
        <span className="chq-submissions-modal-label">Speaker last name</span>
        <input
          className="chq-input"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Alvarez"
        />
      </label>
      <label className="chq-submissions-modal-field">
        <span className="chq-submissions-modal-label">Speaker email (optional)</span>
        <input
          className="chq-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sbek-organizer@example.com"
        />
      </label>
    </ModalFrame>
  );
}
