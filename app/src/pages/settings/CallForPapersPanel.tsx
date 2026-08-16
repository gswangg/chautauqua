// Call for papers settings panel (w2-i, DEC-588 Tier 2 item 13; summary-
// first w2-j, DEC-781): a read-only summary (SummarySection) of the
// event's default CFP form -- public link, close date/relative state,
// and custom question count -- with the existing intro/open/close/tracks
// form living under the drill (`?section=cfp&edit=1`, DEC-728/DEC-710).
// Field editing itself stays in the dedicated form builder
// (/admin/submissions/forms); this panel only links there rather than
// re-implementing it. Zero new server endpoints.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DateField } from '../../components/DateField';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiList, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { dateInputToMs, msToDateInput, formatDateTimeInZone, daysUntil } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { formWindowState } from '../../../../src/lib/submit-core';
import { dayLabelEndInstant } from '../../../../src/lib/timezone';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField, SettingsFieldPair, SettingsSaveButton } from './SettingsEditForm';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { countOf } from '../../lib/plural';
import { DEC_888, DEC_731 } from '../../../../src/decisions';
import { MAX_LONG_TEXT_LENGTH, MAX_NAME_LENGTH } from '../../../../src/forms/validate';

void DEC_888;
void DEC_731;

const SECTION_KEY = 'cfp';

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

/** DEC-731: the call's LIVE state, rendered from a formWindowState value
 * already read by the caller (the wave-44 amendment: the window is read
 * once and both the printed copy and the action control derive from that
 * one reading, never a second independent call to formWindowState). */
function callStateLabel(state: ReturnType<typeof formWindowState>, closeMs: number | null): string {
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
  const daysLeft = daysUntil(closeMs, timezone, Date.now());
  return `IN ${countOf(daysLeft, 'day')}`.toUpperCase();
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
  title: string;
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
  const [title, setTitle] = useState('');
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
  // DEC-896: the edit view's consequence line names a real read of the
  // submissions list total (same read FormsPage's own received-count uses),
  // never a fabricated/derived number.
  const [receivedTotal, setReceivedTotal] = useState<number | null>(null);
  // CFP-S4 turn-diet fast path: close the call from the read view in one
  // click behind a confirm, without entering the edit screen.
  const [pendingCloseNow, setPendingCloseNow] = useState(false);
  const [closingNow, setClosingNow] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<EventSummary>(`/events/${eventId}`),
      apiGet<CfpForm>(`/events/${eventId}/forms`),
      apiList<EventTrack>(`/events/${eventId}/tracks`),
      apiList<unknown>(`/events/${eventId}/submissions?perPage=1`),
    ])
      .then(([ev, formResult, tracksResult, submissionsResult]) => {
        setEvent(ev);
        setForm(formResult);
        setTracks(tracksResult.items);
        setTitle(formResult.title);
        setIntro(formResult.intro ?? '');
        setOpenDate(msToDateInput(formResult.openDate ?? null));
        setCloseDate(msToDateInput(formResult.closeDate ?? null));
        setSelectedTracks(formResult.tracks ?? []);
        setReceivedTotal(submissionsResult.total);
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
        title,
        intro: intro.trim().length > 0 ? intro : null,
        openDate: dateInputToMs(openDate),
        closeDate: dateInputToMs(closeDate),
        tracks: selectedTracks,
      });
      setForm(updated);
      setTitle(updated.title);
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

  // CFP-S4: the same PATCH the edit form's "Close the call now" control
  // uses (openDate/closeDate are the ONE write path, DEC-731) -- this just
  // reaches it from the read view instead of the drilled form.
  async function confirmCloseNow() {
    if (!form) return;
    setClosingNow(true);
    setError(null);
    setFieldErrors({});
    const today = todayDayLabelMs();
    try {
      const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, { closeDate: today });
      setForm(updated);
      setCloseDate(msToDateInput(today));
      setPendingCloseNow(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close the call');
      setPendingCloseNow(false);
    } finally {
      setClosingNow(false);
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

  // DEC-731 (wave-44 amendment): the edit form's window state is read ONCE
  // from the in-progress openDate/closeDate inputs and reused for both the
  // printed status copy and the single action control it enables --
  // never a second, independent formWindowState call per consumer.
  const editWindowState = event
    ? formWindowState(dateInputToMs(openDate), dateInputToMs(closeDate), Date.now(), event.timezone)
    : null;

  // DEC-731: the call's LIVE state read off the SAVED form (never the
  // in-progress edit-view fields) -- this is what the read view's fast
  // path gates on.
  const readWindowState =
    event && form ? formWindowState(form.openDate ?? null, form.closeDate ?? null, Date.now(), event.timezone) : null;

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

  // CFP-S4 turn-diet fast path: only while the call is actually open,
  // sitting beside the Closes row's own value rather than a new row.
  const closeCallFastPath =
    readWindowState === 'open' ? (
      <button type="button" className="chq-link-button chq-settings-inline-action" onClick={() => setPendingCloseNow(true)}>
        Close the call
      </button>
    ) : null;

  const rows =
    event && form
      ? [
          { label: 'Public link', value: publicLinkValue },
          {
            label: 'Closes',
            value: (
              <>
                {form.closeDate !== null && form.closeDate !== undefined ? closesValue : 'No close date set'}
                {closeCallFastPath}
              </>
            ),
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
        <SettingsEditForm
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          consequence={
            receivedTotal !== null ? `${countOf(receivedTotal, 'submission')} received · changes do not affect them` : undefined
          }
          footer={{
            primary: <SettingsSaveButton pending={saving} />,
            secondary: (
              <button type="button" className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
            ),
            // Frame 09--10 (`Chautauqua Settings.dc.html:684`): "Close the
            // form now" sits far left in the footer, not a mid-form row.
            // DEC-731 (wave-44 amendment): a window has ONE possible next
            // move, so this renders only while the call is actually open --
            // never disabled-with-a-reason, since there IS no reason, the
            // action is simply not the current move.
            destructive:
              editWindowState === 'open' ? (
                <button
                  type="button"
                  className="chq-link-button"
                  disabled={saving}
                  onClick={() => void handleWindowNow('closeDate')}
                >
                  Close the form now
                </button>
              ) : undefined,
          }}
        >
          <div className="chq-settings-edit-section">
            <div className="chq-settings-section-head">
              <h2>When it runs</h2>
            </div>
            {event && editWindowState ? (
              <p role="status" className="chq-settings-row">
                {callStateLabel(editWindowState, dateInputToMs(closeDate))}
              </p>
            ) : null}
            <SettingsFieldPair>
              <SettingsField label="Opens" htmlFor="cfp-open-date" width="date">
                <DateField
                  id="cfp-open-date"
                  value={openDate}
                  onChange={(next) => {
                    setOpenDate(next);
                    setSaved(false);
                    setFieldErrors((prev) => ({ ...prev, openDate: '' }));
                  }}
                />
                {fieldErrors.openDate ? <span className="chq-field-error">{fieldErrors.openDate}</span> : null}
              </SettingsField>
              <SettingsField label="Closes" htmlFor="cfp-close-date" width="date">
                <DateField
                  id="cfp-close-date"
                  value={closeDate}
                  onChange={(next) => {
                    setCloseDate(next);
                    setSaved(false);
                    setFieldErrors((prev) => ({ ...prev, closeDate: '' }));
                  }}
                />
                {fieldErrors.closeDate ? <span className="chq-field-error">{fieldErrors.closeDate}</span> : null}
              </SettingsField>
            </SettingsFieldPair>
            {/* DEC-731 (wave 8 amendment): the frame draws Time zone as a
                select, but event.timezone already has ONE writer
                (EventSettingsPanel's PATCH /api/v1/events/:eventId, which
                also bumps ics_sequence for every calendar subscriber and
                cold-caches every public page). A second writer here would
                let one Save issue two PATCHes with partial-failure
                semantics against the repo's most blast-heavy field. The
                frame's label/position/measure bind; the affordance does
                not -- this is a read-only fact plus a deep link, not a
                second control. Documented deviation, do not re-file. */}
            {event ? (
              <SettingsField label="Time zone" width="date" hint={
                <a href="?section=event&edit=1" className="chq-settings-inline-action">
                  Change it in Event settings
                </a>
              }>
                <input
                  id="cfp-timezone-readonly"
                  className="chq-input"
                  readOnly
                  value={event.timezone}
                  aria-readonly="true"
                />
              </SettingsField>
            ) : null}
            {event && editWindowState !== 'open' ? (
              <div className="chq-settings-row">
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  disabled={saving}
                  onClick={() => void handleWindowNow('openDate')}
                >
                  Open the call now
                </button>
              </div>
            ) : null}
          </div>

          <div className="chq-settings-edit-section">
            <div className="chq-settings-section-head">
              <h2>What submitters read</h2>
            </div>
            <SettingsField label="Form name" htmlFor="cfp-title" width="slug">
              <input
                id="cfp-title"
                className="chq-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSaved(false);
                }}
                maxLength={MAX_NAME_LENGTH}
              />
              {fieldErrors.title ? <span className="chq-field-error">{fieldErrors.title}</span> : null}
            </SettingsField>
            <SettingsField
              label="Intro shown above the form"
              width="full"
              hint="Takes the full measure · about three lines on the public form"
            >
              <textarea
                className="chq-textarea"
                value={intro}
                onChange={(e) => {
                  setIntro(e.target.value);
                  setSaved(false);
                }}
                maxLength={MAX_LONG_TEXT_LENGTH}
              />
            </SettingsField>
          </div>

          <div className="chq-settings-edit-section">
            <div className="chq-settings-section-head">
              <h2>Questions · {form.fields?.length ?? 0}</h2>
              <Link to="/submissions/forms" className="chq-settings-inline-action">
                Open the form builder ›
              </Link>
            </div>
            <p className="chq-settings-row-hint">
              Adding, reordering and removing questions happens in the builder — this page owns the window and the
              wording around the form.
            </p>
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
          {saved ? <span role="status"> Saved.</span> : null}
        </SettingsEditForm>
      ) : null}
      </SummarySection>
      {pendingCloseNow ? (
        <ConfirmDialog
          title="Close the call for papers?"
          body="Speakers will no longer be able to submit. You can reopen the call later from Settings."
          confirmLabel="Close the call now"
          pending={closingNow}
          onConfirm={() => void confirmCloseNow()}
          onCancel={() => setPendingCloseNow(false)}
        />
      ) : null}
    </>
  );
}
