import { useState } from 'react';
import type { CfpForm, EventTrack } from './types';

export interface FormSettingsPatch {
  intro?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  tracks?: string[] | null;
}

interface FormSettingsProps {
  form: CfpForm;
  tracks: EventTrack[];
  eventSlug: string;
  onSave: (patch: FormSettingsPatch) => Promise<void>;
}

function toDateInputValue(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): number | null {
  if (value.length === 0) return null;
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

/** Form settings strip: title (read-only — the w2-c API has no title-patch
 * endpoint), intro/description, open/close dates, tracks offered, and the
 * copyable public submission link. */
export function FormSettings({ form, tracks, eventSlug, onSave }: FormSettingsProps) {
  const [intro, setIntro] = useState(form.intro ?? '');
  const [openDate, setOpenDate] = useState(toDateInputValue(form.openDate));
  const [closeDate, setCloseDate] = useState(toDateInputValue(form.closeDate));
  const [selectedTracks, setSelectedTracks] = useState<string[]>(form.tracks ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        openDate: fromDateInputValue(openDate),
        closeDate: fromDateInputValue(closeDate),
        tracks: selectedTracks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(publicLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="chq-forms-settings">
      {error && <div className="chq-error-banner">{error}</div>}

      <label>
        Title
        <input type="text" value={form.title} disabled />
      </label>

      <label>
        Intro / description
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} />
      </label>

      <label>
        Opens
        <input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
      </label>

      <label>
        Closes
        <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
      </label>

      <fieldset>
        <legend>Tracks offered</legend>
        {tracks.length === 0 && <p>No tracks configured for this event yet.</p>}
        {tracks.map((track) => (
          <label key={track.id} className="chq-checkbox-label">
            <input
              type="checkbox"
              checked={selectedTracks.includes(track.id)}
              onChange={() => toggleTrack(track.id)}
            />
            {track.name}
          </label>
        ))}
      </fieldset>

      <label>
        Public link
        <div className="chq-forms-public-link">
          <input type="text" value={publicLink} readOnly />
          <button type="button" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </label>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save settings'}
      </button>
    </section>
  );
}
