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
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { ApiError } from '../../lib/api';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import type { FormField, Track } from './types';

// DEC-958 (wave 64 amendment): every wire key POST /api/v1/events/:eventId/
// submissions's validator can name on this modal's own submitted body
// (src/routes/api/submissions.ts -- title/description/trackIds/format plus
// the nested 'contact.email') gets a stable anchor id and a display label
// for the ErrorSummary anchor list. A key the map below doesn't recognize
// still renders in the summary, labelled by its own raw wire key, rather
// than being dropped.
const KNOWN_FIELD_ANCHORS: Record<string, { anchorId: string; label: string }> = {
  title: { anchorId: 'new-submission-title', label: 'Title' },
  description: { anchorId: 'new-submission-description', label: 'Abstract' },
  trackIds: { anchorId: 'new-submission-tracks', label: 'Tracks' },
  format: { anchorId: 'new-submission-format', label: 'Format' },
  'contact.email': { anchorId: 'new-submission-email', label: 'Speaker email' },
};

export interface NewSubmissionInput {
  title: string;
  description: string;
  contact: { email: string; firstName: string; lastName: string } | null;
  trackIds: string[];
  format: string;
}

/** DEC-749: splits "Jordan Alvarez" into { firstName: 'Jordan', lastName:
 * 'Alvarez' }. Splits on the FINAL run of whitespace -- everything before
 * it is firstName, the last token is lastName -- so a middle name/multi-word
 * given name ("Mary Jane Watson") stays with firstName. A single token (no
 * whitespace) yields firstName only, with an empty lastName. Nothing beyond
 * that is inferred. */
export function splitSpeakerName(value: string): { firstName: string; lastName: string } {
  const trimmed = value.trim();
  if (trimmed === '') return { firstName: '', lastName: '' };
  const idx = trimmed.search(/\s+\S+$/);
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, idx).trim(), lastName: trimmed.slice(idx).trim() };
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
  const [speakerName, setSpeakerName] = useState('');
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [format, setFormat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // DEC-958 (wave 64 amendment): the WHOLE err.fields map, keyed by the
  // server's own wire keys -- never just the joined values. Seeded fresh on
  // every refusal; the typed values above are never cleared on a refusal.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    const trimmedName = speakerName.trim();
    if (trimmedName !== '' && trimmedEmail === '') {
      setEmailError('Add an email — a speaker record needs one');
      return;
    }
    const contact = trimmedEmail ? { email: trimmedEmail, ...splitSpeakerName(speakerName) } : null;

    setPending(true);
    setError(null);
    setEmailError(null);
    setFieldErrors({});
    try {
      await onCreate({ title: trimmedTitle, description: description.trim(), contact, trackIds, format });
    } catch (err) {
      // DEC-958 (wave 64 amendment): a refusal carrying a named-field map
      // marks each offending control instead of collapsing to the (often
      // placeholder) top-line message -- 'Validation failed' with the real
      // information in err.fields never renders as just that placeholder.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create submission');
      }
    } finally {
      setPending(false);
    }
  }

  function fieldAriaInvalid(hasError: boolean): 'true' | undefined {
    return hasError ? 'true' : undefined;
  }

  const errorSummaryProblems = Object.keys(fieldErrors).map((key) => {
    const meta = KNOWN_FIELD_ANCHORS[key];
    // An unmatched key has no control to blame -- it still renders,
    // labelled by its own raw wire key (plus the server's message, since
    // there is no FormRow for it to print the message next to) rather than
    // being silently dropped.
    return meta ?? { anchorId: key, label: `${key}: ${fieldErrors[key]}` };
  });

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

      {errorSummaryProblems.length > 0 && (
        <ErrorSummary
          heading={countHeading(errorSummaryProblems.length, 'before this submission can be created')}
          kept="Nothing was lost. Your typed values are still below."
          problems={errorSummaryProblems}
        />
      )}

      <FormRow label="Title" htmlFor="new-submission-title" error={fieldErrors.title}>
        <input
          id="new-submission-title"
          className="chq-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Opening Keynote"
          required
          aria-invalid={fieldAriaInvalid(!!fieldErrors.title)}
        />
      </FormRow>
      <FormRow label="Abstract" htmlFor="new-submission-description" optional error={fieldErrors.description}>
        <textarea
          id="new-submission-description"
          className="chq-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — you can fill this in later"
          aria-invalid={fieldAriaInvalid(!!fieldErrors.description)}
        />
      </FormRow>

      {tracks.length > 0 && (
        <FormRow label="Tracks" htmlFor="new-submission-tracks" error={fieldErrors.trackIds}>
          <div id="new-submission-tracks">
            {tracks.map((track) => (
              <label key={track.id} className="chq-checkbox-label">
                <input
                  className="chq-check"
                  type="checkbox"
                  checked={trackIds.includes(track.id)}
                  onChange={() => toggleTrack(track.id)}
                  aria-invalid={fieldAriaInvalid(!!fieldErrors.trackIds)}
                />
                {track.name}
              </label>
            ))}
          </div>
        </FormRow>
      )}

      {formatField && (
        <FormRow label={formatField.label} htmlFor="new-submission-format" optional error={fieldErrors.format}>
          <select
            id="new-submission-format"
            className="chq-select"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            aria-invalid={fieldAriaInvalid(!!fieldErrors.format)}
          >
            <option value="">Select...</option>
            {(formatField.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormRow>
      )}

      <FormRow label="Speaker name" htmlFor="new-submission-speaker-name" optional>
        <input
          id="new-submission-speaker-name"
          className="chq-input"
          value={speakerName}
          onChange={(e) => setSpeakerName(e.target.value)}
          placeholder="Jordan Alvarez"
        />
      </FormRow>
      <FormRow
        label="Speaker email"
        htmlFor="new-submission-email"
        optional
        error={emailError ?? fieldErrors['contact.email']}
      >
        <input
          id="new-submission-email"
          className="chq-input"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          placeholder="jordan.alvarez@example.com"
          aria-invalid={fieldAriaInvalid(!!(emailError ?? fieldErrors['contact.email']))}
        />
      </FormRow>
    </ModalFrame>
  );
}
