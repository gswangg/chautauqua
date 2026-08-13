// Call for papers settings panel (w2-i, DEC-588 Tier 2 item 13; summary-
// first w2-j, DEC-781): a read-only summary (SummarySection) of the
// event's default CFP form -- public link, close date/relative state,
// and custom question count -- with the existing intro/open/close/tracks
// form living under the drill (`?section=cfp&edit=1`, DEC-728/DEC-710).
// Field editing itself stays in the dedicated form builder
// (/admin/submissions/forms); this panel only links there rather than
// re-implementing it. Zero new server endpoints.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiList, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { dateInputToMs, msToDateInput, formatDateTimeInZone } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { formWindowState } from '../../../../src/lib/submit-core';
import { dayLabelEndInstant } from '../../../../src/lib/timezone';
import { SummarySection } from './SummarySection';
import { DEC_888 } from '../../../../src/decisions';

void DEC_888;

const SECTION_KEY = 'cfp';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface EventSummary {
  id: string;
  slug: string;
  timezone: string;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Renders a day-label epoch-ms value (UTC-midnight of the intended
 * calendar day, DEC-153/DEC-522) as "16 Aug" -- read via UTC field getters,
 * never a timezone conversion (the calendar day itself doesn't move with
 * the viewer's zone). */
function formatDayMonth(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

/** Today's calendar day as a day-label epoch-ms value (UTC midnight). */
function todayDayLabelMs(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** DEC-731: the call's LIVE state, derived from open_date/close_date via
 * the same pure formWindowState the public submit route gates on -- never
 * a separate published flag. */
function callStateLabel(openMs: number | null, closeMs: number | null, timezone: string): string {
  const state = formWindowState(openMs, closeMs, Date.now(), timezone);
  if (state === 'not_yet_open') return 'Not yet open';
  if (state === 'closed') return 'Closed';
  return closeMs !== null ? `Open · closes ${formatDayMonth(closeMs)}` : 'Open';
}

/** DEC-781: the summary's right-aligned uppercase relative note next to
 * the Closes row -- derived from the same pure formWindowState the live
 * gate uses (never a second, independently-computed "days left"), so the
 * summary can never disagree with the actual gate. */
function closesRelativeNote(openMs: number | null, closeMs: number | null, timezone: string): string {
  const state = formWindowState(openMs, closeMs, Date.now(), timezone);
  if (state === 'closed') return 'CLOSED';
  if (closeMs === null) return '';
  const daysLeft = Math.ceil((dayLabelEndInstant(closeMs, timezone) - Date.now()) / MS_PER_DAY);
  return `IN ${Math.max(daysLeft, 0)} DAY${daysLeft === 1 ? '' : 'S'}`;
}

interface EventTrack {
  id: string;
  name: string;
}

interface CfpField {
  id: string;
  label: string;
  locked: boolean;
}

interface CfpForm {
  id: string;
  eventId: string;
  intro?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  tracks?: string[] | null;
  fields?: CfpField[];
}

/** DEC-781: "N — label, label, ..." built from the form's non-core (not
 * locked) fields, i.e. the questions an organiser actually added. If the
 * fields list isn't available (fetch failure) the count alone renders,
 * never a fabricated label list. */
function customQuestionsSummary(fields: CfpField[] | undefined): string {
  if (!fields) return '';
  const custom = fields.filter((f) => !f.locked);
  if (custom.length === 0) return '0';
  return `${custom.length} — ${custom.map((f) => f.label).join(', ')}`;
}

export function CallForPapersPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [form, setForm] = useState<CfpForm | null>(null);
  const [tracks, setTracks] = useState<EventTrack[]>([]);
  const [intro, setIntro] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // DEC-731: field-level errors (openDate/closeDate order refusal) surface
  // inline at the field they belong to, never as a quiet banner alone.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<EventSummary>(`/events/${eventId}`),
      apiGet<CfpForm>(`/events/${eventId}/forms`),
      apiList<EventTrack>(`/events/${eventId}/tracks`),
    ])
      .then(([ev, formResult, tracksResult]) => {
        setEvent(ev);
        setForm(formResult);
        setTracks(tracksResult.items);
        setIntro(formResult.intro ?? '');
        setOpenDate(msToDateInput(formResult.openDate ?? null));
        setCloseDate(msToDateInput(formResult.closeDate ?? null));
        setSelectedTracks(formResult.tracks ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the CFP form'))
      .finally(() => setLoading(false));
  }, [eventId]);

  function toggleTrack(trackId: string) {
    setSelectedTracks((prev) => (prev.includes(trackId) ? prev.filter((t) => t !== trackId) : [...prev, trackId]));
    setSaved(false);
  }

  function closeEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('section');
      params.delete('edit');
      return params;
    });
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, {
        intro: intro.trim().length > 0 ? intro : null,
        openDate: dateInputToMs(openDate),
        closeDate: dateInputToMs(closeDate),
        tracks: selectedTracks,
      });
      setForm(updated);
      setSaved(true);
      closeEdit();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof ApiError ? err.message : 'Failed to save the CFP form');
    } finally {
      setSaving(false);
    }
  }

  // DEC-731: "Open/Close the call now" write open_date/close_date directly
  // -- no new column, no published flag. The server's PATCH validator is
  // still the ONE place close-before-open is refused (DEC-517); a
  // rejection surfaces at the Opens/Closes field it belongs to.
  async function handleWindowNow(which: 'openDate' | 'closeDate') {
    if (!form) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const today = todayDayLabelMs();
    try {
      const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, { [which]: today });
      setForm(updated);
      if (which === 'openDate') setOpenDate(msToDateInput(today));
      else setCloseDate(msToDateInput(today));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof ApiError ? err.message : 'Failed to update the call window');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink(publicLink: string) {
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

  const publicLink = event ? `${window.location.origin}/submit/${event.slug}` : '';

  const publicLinkValue = (
    <>
      <span>{publicLink}</span>
      <a href={publicLink} className="chq-settings-inline-action">
        Open
      </a>
      <button type="button" className="chq-link-button" onClick={() => void handleCopyLink(publicLink)}>
        {copyResult?.ok ? 'Copied!' : 'Copy'}
      </button>
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
    </>
  );

  const closesValue =
    event && form ? (
      <>
        <span>
          {formatDateTimeInZone(dayLabelEndInstant(form.closeDate ?? 0, event.timezone), event.timezone)} ·{' '}
          {event.timezone}
        </span>
        <span className="chq-settings-row-note">
          {closesRelativeNote(form.openDate ?? null, form.closeDate ?? null, event.timezone)}
        </span>
      </>
    ) : null;

  const rows =
    event && form
      ? [
          { label: 'Public link', value: publicLinkValue },
          {
            label: 'Closes',
            value: form.closeDate !== null && form.closeDate !== undefined ? closesValue : 'No close date set',
          },
          { label: 'Custom questions', value: customQuestionsSummary(form.fields) },
        ]
      : [];

  return (
    <>
      {eventLoading || loading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Call for papers"
        rows={rows}
        actionLabel="Edit the form"
        editing={editing}
      >
      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div className="chq-settings-row">
            <label>
              Intro text
              <textarea
                className="chq-textarea"
                value={intro}
                onChange={(e) => {
                  setIntro(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          {event ? (
            <p role="status" className="chq-settings-row">
              {callStateLabel(dateInputToMs(openDate), dateInputToMs(closeDate), event.timezone)}
            </p>
          ) : null}
          <div className="chq-settings-row">
            <label>
              Opens
              <input
                className="chq-input"
                type="date"
                value={openDate}
                onChange={(e) => {
                  setOpenDate(e.target.value);
                  setSaved(false);
                  setFieldErrors((prev) => ({ ...prev, openDate: '' }));
                }}
              />
              {fieldErrors.openDate ? <span className="chq-field-error">{fieldErrors.openDate}</span> : null}
            </label>
          </div>
          <div className="chq-settings-row">
            <label>
              Closes
              <input
                className="chq-input"
                type="date"
                value={closeDate}
                onChange={(e) => {
                  setCloseDate(e.target.value);
                  setSaved(false);
                  setFieldErrors((prev) => ({ ...prev, closeDate: '' }));
                }}
              />
              {fieldErrors.closeDate ? <span className="chq-field-error">{fieldErrors.closeDate}</span> : null}
            </label>
          </div>
          <div className="chq-settings-row">
            <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={() => void handleWindowNow('openDate')}>
              Open the call now
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={() => void handleWindowNow('closeDate')}>
              Close the call now
            </button>
          </div>
          <div className="chq-settings-row">
            <span className="chq-settings-row-label">Tracks offered</span>
            <div className="chq-settings-row-value chq-settings-row-value-stack">
              <div className="chq-chipstrip" role="group" aria-label="Tracks offered">
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
              {tracks.length === 0 ? (
                <p className="chq-settings-row-hint">No tracks configured for this event yet.</p>
              ) : null}
            </div>
          </div>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={closeEdit} disabled={saving}>
            Cancel
          </button>
          {saved ? <span role="status"> Saved.</span> : null}
        </form>
      ) : null}
      </SummarySection>
    </>
  );
}
