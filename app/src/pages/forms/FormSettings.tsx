import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CfpForm, EventTrack } from './types';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';

export interface FormSettingsPatch {
  intro?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  tracks?: string[] | null;
}

export interface FormSettingsHandle {
  /** Commits the current draft via onSave. Exposed so the page-level header
   * Save button (DEC-650 mock) can trigger this secondary panel's save
   * without a separate in-panel button. */
  save: () => Promise<void>;
}

interface FormSettingsProps {
  form: CfpForm;
  tracks: EventTrack[];
  eventSlug: string;
  onSave: (patch: FormSettingsPatch) => Promise<void>;
}

/** Form settings panel (DEC-650: secondary panel below the field list):
 * title (read-only — the w2-c API has no title-patch endpoint),
 * intro/description, open/close dates, tracks offered, and the copyable
 * public submission link. Saving is triggered by the page header's Save
 * button via the imperative `save()` handle, not an in-panel button. */
export const FormSettings = forwardRef<FormSettingsHandle, FormSettingsProps>(function FormSettings(
  { form, tracks, eventSlug, onSave },
  ref,
) {
  const [intro, setIntro] = useState(form.intro ?? '');
  const [openDate, setOpenDate] = useState(msToDateInput(form.openDate));
  const [closeDate, setCloseDate] = useState(msToDateInput(form.closeDate));
  const [selectedTracks, setSelectedTracks] = useState<string[]>(form.tracks ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  const publicLink = `${window.location.origin}/submit/${eventSlug}`;

  function toggleTrack(trackId: string) {
    setSelectedTracks((prev) => (prev.includes(trackId) ? prev.filter((t) => t !== trackId) : [...prev, trackId]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        intro: intro.trim().length > 0 ? intro : null,
        openDate: dateInputToMs(openDate),
        closeDate: dateInputToMs(closeDate),
        tracks: selectedTracks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form settings');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }), [intro, openDate, closeDate, selectedTracks]);

  async function handleCopyLink() {
    const ok = await copyText(publicLink);
    setCopyResult({ ok, text: publicLink });
    if (ok) {
      window.setTimeout(() => setCopyResult(null), 2000);
    }
  }

  useEffect(() => {
    if (copyResult && !copyResult.ok) {
      failedCopyRef.current?.focus();
      failedCopyRef.current?.select();
    }
  }, [copyResult]);

  return (
    <section className="chq-forms-settings">
      {error && <div className="chq-error-banner">{error}</div>}
      {saving && (
        <div role="status" aria-live="polite" className="chq-forms-settings-saving">
          Saving...
        </div>
      )}

      <label className="chq-field">
        Title
        <input type="text" className="chq-input chq-forms-settings-title" value={form.title} disabled />
      </label>

      <label className="chq-field">
        Intro / description
        <textarea className="chq-textarea" value={intro} onChange={(e) => setIntro(e.target.value)} />
      </label>

      <label className="chq-field">
        Opens
        <input type="date" className="chq-input" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
      </label>

      <label className="chq-field">
        Closes
        <input type="date" className="chq-input" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
      </label>

      <fieldset className="chq-forms-settings-tracks">
        <legend className="chq-section-label">Tracks offered</legend>
        {tracks.length === 0 && <p>No tracks configured for this event yet.</p>}
        <div className="chq-chipstrip">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              className={selectedTracks.includes(track.id) ? 'chq-pill is-active' : 'chq-pill'}
              aria-pressed={selectedTracks.includes(track.id)}
              onClick={() => toggleTrack(track.id)}
            >
              {track.name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="chq-field">
        Public link
        <div className="chq-forms-public-link">
          <input type="text" className="chq-input" value={publicLink} readOnly />
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void handleCopyLink()}>
            {copyResult?.ok ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div role="status" aria-live="polite" className="chq-copy-status">
          {copyResult ? (copyResult.ok ? 'Copied' : 'Copy failed — select the text and copy it manually') : null}
        </div>
        {copyResult && !copyResult.ok ? (
          <input
            ref={failedCopyRef}
            className="chq-input"
            readOnly
            value={copyResult.text}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Public link to copy manually"
          />
        ) : null}
      </label>
    </section>
  );
});
