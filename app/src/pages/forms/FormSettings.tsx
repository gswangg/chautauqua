import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CfpForm, EventTrack } from './types';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { ApiError } from '../../lib/api';
import { formWindowState } from '../../../../src/lib/submit-core';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Renders a day-label epoch-ms value (UTC-midnight of the intended
 * calendar day, DEC-153/DEC-522) as "16 Aug" -- day + short month, read via
 * UTC field getters, never a timezone conversion (the calendar day itself
 * doesn't move with the viewer's zone). */
function formatDayMonth(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

/** Today's calendar day as a day-label epoch-ms value (UTC midnight),
 * matching the same date-only convention dateInputToMs/msToDateInput use
 * for every other open/close date in this panel. */
function todayDayLabelMs(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** DEC-731: the builder states the call's LIVE state derived from
 * open/close dates via the same pure formWindowState the public submit
 * route gates on -- never a separate published flag. */
function callStateLabel(openMs: number | null, closeMs: number | null, timezone: string): string {
  const state = formWindowState(openMs, closeMs, Date.now(), timezone);
  if (state === 'not_yet_open') return 'Not yet open';
  if (state === 'closed') return 'Closed';
  return closeMs !== null ? `Open · closes ${formatDayMonth(closeMs)}` : 'Open';
}

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
  timezone: string;
  onSave: (patch: FormSettingsPatch) => Promise<void>;
}

/** Form settings panel (DEC-650: secondary panel below the field list):
 * title (read-only — the w2-c API has no title-patch endpoint),
 * intro/description, open/close dates, tracks offered, and the copyable
 * public submission link. Saving is triggered by the page header's Save
 * button via the imperative `save()` handle, not an in-panel button. */
export const FormSettings = forwardRef<FormSettingsHandle, FormSettingsProps>(function FormSettings(
  { form, tracks, eventSlug, timezone, onSave },
  ref,
) {
  const [intro, setIntro] = useState(form.intro ?? '');
  const [openDate, setOpenDate] = useState(msToDateInput(form.openDate));
  const [closeDate, setCloseDate] = useState(msToDateInput(form.closeDate));
  const [selectedTracks, setSelectedTracks] = useState<string[]>(form.tracks ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-731: field-level errors (openDate/closeDate order refusal) surface
  // inline at the field they belong to, never as a quiet top-of-panel
  // banner alone.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  const publicLink = `${window.location.origin}/submit/${eventSlug}`;

  function toggleTrack(trackId: string) {
    setSelectedTracks((prev) => (prev.includes(trackId) ? prev.filter((t) => t !== trackId) : [...prev, trackId]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSave({
        intro: intro.trim().length > 0 ? intro : null,
        openDate: dateInputToMs(openDate),
        closeDate: dateInputToMs(closeDate),
        tracks: selectedTracks,
      });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof Error ? err.message : 'Failed to save form settings');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }), [intro, openDate, closeDate, selectedTracks]);

  // DEC-731: "Open/Close the call now" write open_date/close_date directly
  // -- no new column, no published flag. The server's PATCH validator is
  // still the ONE place close-before-open is refused (DEC-517); a rejection
  // here surfaces at the Opens/Closes field it belongs to, not a banner.
  async function handleWindowNow(which: 'openDate' | 'closeDate') {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const today = todayDayLabelMs();
    try {
      await onSave({ [which]: today });
      if (which === 'openDate') setOpenDate(msToDateInput(today));
      else setCloseDate(msToDateInput(today));
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof Error ? err.message : 'Failed to update the call window');
    } finally {
      setSaving(false);
    }
  }

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

      <p role="status" className="chq-forms-call-state">
        {callStateLabel(dateInputToMs(openDate), dateInputToMs(closeDate), timezone)}
      </p>

      <label className="chq-field">
        Opens
        <input
          type="date"
          className="chq-input"
          value={openDate}
          onChange={(e) => {
            setOpenDate(e.target.value);
            setFieldErrors((prev) => ({ ...prev, openDate: '' }));
          }}
        />
        {fieldErrors.openDate ? <span className="chq-field-error">{fieldErrors.openDate}</span> : null}
      </label>

      <label className="chq-field">
        Closes
        <input
          type="date"
          className="chq-input"
          value={closeDate}
          onChange={(e) => {
            setCloseDate(e.target.value);
            setFieldErrors((prev) => ({ ...prev, closeDate: '' }));
          }}
        />
        {fieldErrors.closeDate ? <span className="chq-field-error">{fieldErrors.closeDate}</span> : null}
      </label>

      <div className="chq-forms-call-actions">
        <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={() => void handleWindowNow('openDate')}>
          Open the call now
        </button>
        <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={() => void handleWindowNow('closeDate')}>
          Close the call now
        </button>
      </div>

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
