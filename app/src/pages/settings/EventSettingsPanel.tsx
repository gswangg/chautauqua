// Event settings panel (w4-h, DEC-032; summary-first w1-b, DEC-728): name,
// slug, dates, location, timezone, record prefix (read-only), branding
// logo URL + accent color. Renders as a read-only summary (SummarySection)
// with a single 'Change' action that drills into the existing form; the
// drilled state is `?section=event&edit=1` in the URL (DEC-728/DEC-710),
// so it is bookmarkable and Back leaves it. The form itself, its
// PATCH /api/v1/events/:id endpoint and buildEventPatch diffing are
// unchanged from before this wave.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DateField } from '../../components/DateField';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { buildEventPatch, type EventSettingsForm } from './formState';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField, SettingsFieldPair, SettingsSaveButton } from './SettingsEditForm';
import { plural } from '../../lib/plural';
import { dateInputToMs, daysUntil } from '../../lib/dates';
import { formatEventDayRange } from '../../../../src/lib/event-time';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../../../../src/forms/validate';

const SECTION_KEY = 'event';

// DEC-124 amendment (wave 56): every control PATCH /api/v1/events/:id can
// refuse (src/routes/api/events.ts:317-355) gets a stable id, a display
// label for the ErrorSummary anchor list, and its own entry in the field
// order below (form layout order, used so the summary's problem list reads
// top-to-bottom the same way the form does).
const FIELD_ORDER = ['name', 'slug', 'startDate', 'endDate', 'timezone', 'location'] as const;
type EventPatchField = (typeof FIELD_ORDER)[number];

const FIELD_IDS: Record<EventPatchField, string> = {
  name: 'event-settings-name',
  slug: 'event-settings-slug',
  startDate: 'event-settings-start-date',
  endDate: 'event-settings-end-date',
  timezone: 'event-settings-timezone',
  location: 'event-settings-location',
};

const FIELD_LABELS: Record<EventPatchField, string> = {
  name: 'Name',
  slug: 'Slug',
  startDate: 'Start date',
  endDate: 'End date',
  timezone: 'Time zone',
  location: 'Venue',
};

// Rule 12: never blame the input for a refusal the input didn't cause. The
// slug and end-date refusals are the two cases where the server's own
// message would read as if the value the user typed were malformed --
// every other key's server message renders verbatim.
const FIELD_ERROR_COPY: Partial<Record<EventPatchField, string>> = {
  slug: 'That slug is already taken by another event in this org.',
  endDate: 'The end date must be on or after the start date.',
};

interface EventDetail {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  timezone: string;
  recordPrefix: string;
  branding: { logoUrl?: string; accentColor?: string };
  unscheduledByWindow?: {
    count: number;
    sessions: { submissionId: string; ref: string; title: string; day: string }[];
  };
  breaksOutsideWindow?: {
    count: number;
    breaks: { id: string; day: string; label: string; startMin: number }[];
  };
}

interface OutsideWindowNotice {
  sessions: EventDetail['unscheduledByWindow'] | null;
  breaks: EventDetail['breaksOutsideWindow'] | null;
}

function toForm(event: EventDetail): EventSettingsForm {
  return {
    name: event.name,
    slug: event.slug,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location ?? '',
    timezone: event.timezone,
    recordPrefix: event.recordPrefix,
    logoUrl: event.branding?.logoUrl ?? '',
    accentColor: event.branding?.accentColor ?? '',
  };
}

// DEC-896: the Dates row's relative hint -- "N days away" counted from the
// event's own timezone against its start date, through the SPA's ONE
// days-until reader (dates.ts daysUntil) so it agrees with every other
// countdown in the app rather than a bespoke Math.round.
function datesHint(startMs: number, timezone: string): string {
  const days = daysUntil(startMs, timezone, Date.now());
  if (days === 0) return 'Today';
  return `${days} ${plural(days, 'day')} away`;
}

// Both dates are required event fields (never '' once loaded from the API),
// so a null here is a data-integrity bug -- fail loudly rather than render
// a silently-blank Dates row.
function requireDateMs(value: string): number {
  const ms = dateInputToMs(value);
  if (ms === null) throw new Error(`EventSettingsPanel: expected a non-empty date, got "${value}"`);
  return ms;
}

function brandingSummary(form: EventSettingsForm): string {
  const parts: string[] = [];
  if (form.logoUrl) parts.push('Logo set');
  if (form.accentColor) parts.push(`Accent ${form.accentColor}`);
  return parts.length > 0 ? parts.join(' · ') : 'Not set';
}

// DEC-996 amendment (wave 43): mail configuration is a first-class READ,
// surfaced here so a missing key is discoverable in Settings rather than
// only as a 500 when a speaker submits.
interface MailStatus {
  provider: 'dev-sink' | 'email-binding' | 'none';
  configured: boolean;
  fromEmail: string | null;
}

function mailStatusSummary(status: MailStatus): string {
  if (status.provider === 'dev-sink') return 'Dev mailbox (/dev/mailbox)';
  if (status.configured && status.fromEmail) return `Sending as ${status.fromEmail}`;
  return 'NOT CONFIGURED — sends will fail';
}

export function EventSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [initial, setInitial] = useState<EventSettingsForm | null>(null);
  const [form, setForm] = useState<EventSettingsForm | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  // DEC-897/DEC-124 server-only-conflict shape: a save refusal the server
  // attributes to a specific field (fields map, or a conflict/409 code --
  // when the server sends no fields map at all the only server-side
  // uniqueness check on this form is the slug, so a bare conflict still
  // marks Slug) renders under that field's own control instead of the page
  // banner, and never resets/refetches the form -- the user's unsaved edits
  // in every other field survive the refusal untouched.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unscheduledNotice, setUnscheduledNotice] = useState<OutsideWindowNotice | null>(null);
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);

  useEffect(() => {
    if (!eventId) return;
    // DEC-856 (wave 71 amendment): clear the page-level banner before the
    // read is issued -- so a stale refusal never sits beside a later
    // successful reload (TracksRoomsPanel's shape).
    setError(undefined);
    apiGet<EventDetail>(`/events/${eventId}`)
      .then((event) => {
        const f = toForm(event);
        setInitial(f);
        setForm(f);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event'));
  }, [eventId]);

  useEffect(() => {
    setError(undefined);
    apiGet<MailStatus>('/mail-status')
      .then((status) => setMailStatus(status))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load mail status'));
  }, []);

  function update<K extends keyof EventSettingsForm>(key: K, value: EventSettingsForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
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
    if (!eventId || !initial || !form) return;
    const patch = buildEventPatch(initial, form);
    if (Object.keys(patch).length === 0) {
      closeEdit();
      return;
    }
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const updated = await apiPatch<EventDetail>(`/events/${eventId}`, patch);
      const f = toForm(updated);
      setInitial(f);
      setForm(f);
      setSaved(true);
      const sessionsNotice =
        updated.unscheduledByWindow && updated.unscheduledByWindow.count > 0 ? updated.unscheduledByWindow : null;
      const breaksNotice =
        updated.breaksOutsideWindow && updated.breaksOutsideWindow.count > 0 ? updated.breaksOutsideWindow : null;
      setUnscheduledNotice(
        sessionsNotice || breaksNotice ? { sessions: sessionsNotice, breaks: breaksNotice } : null,
      );
      closeEdit();
    } catch (err) {
      // DEC-897/DEC-124: a field-scoped refusal (the server's `fields` map,
      // populated in full -- every key it names renders inline under that
      // key's own control) or a bare conflict/409 with no fields map at all
      // (the only server-side uniqueness check on this form is the slug,
      // so that case still marks Slug) renders under each offending
      // control instead of the page banner. No refetch, no reset: `form`
      // and `initial` are left exactly as the user had them.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        const serverFields = err.fields;
        const mapped: Record<string, string> = {};
        for (const key of Object.keys(serverFields)) {
          const serverMessage = serverFields[key];
          if (serverMessage === undefined) continue;
          mapped[key] = FIELD_ERROR_COPY[key as EventPatchField] ?? serverMessage;
        }
        setFieldErrors(mapped);
      } else if (err instanceof ApiError && err.code === 'conflict') {
        setFieldErrors({ slug: FIELD_ERROR_COPY.slug! });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save event settings');
      }
    } finally {
      setSaving(false);
    }
  }

  // The error copy renders through `hint`, i.e. as a sibling AFTER
  // </label> rather than inside children (which sit inside the <label>) --
  // text inside a <label> becomes part of the control's accessible name,
  // which would silently break every getByLabelText(...) lookup (and any
  // real screen reader's field announcement) the moment an error appears.
  function fieldErrorHint(key: EventPatchField) {
    const message = fieldErrors[key];
    if (!message) return undefined;
    return (
      <span className="chq-field-error" role="alert">
        {message}
      </span>
    );
  }

  // The chq-input/chq-field-invalid ternary is written inline on each
  // control (the PlanEditor.tsx spelling) rather than hoisted into a
  // helper: DEC-406's guard is a source regex, so it only sees class
  // literals that appear in the JSX itself. A helper call also hides the
  // class from it AND feeds the helper's own string argument in as a bogus
  // token, so `className={f('name')}` reads as the class `name` and fails.
  function fieldAriaInvalid(key: EventPatchField) {
    return fieldErrors[key] ? 'true' : undefined;
  }

  const errorSummaryProblems = FIELD_ORDER.filter((key) => fieldErrors[key] !== undefined).map((key) => ({
    anchorId: FIELD_IDS[key],
    label: FIELD_LABELS[key],
  }));

  const rows = form
    ? [
        { label: 'Name', value: form.name },
        // DEC-896: matches the 09-settings frame's Slug row hint verbatim
        // ('Used in every public URL' -- submit/schedule/agenda links all
        // key off this, per the record scoping this panel already saves).
        { label: 'Slug', value: form.slug, hint: 'Used in every public URL' },
        // DEC-896: 'Starts'/'Ends' collapsed into one human-grammar range
        // row -- the two ISO dates now live only in the edit form's two
        // DateFields (below), never in the read view.
        {
          label: 'Dates',
          value: formatEventDayRange(requireDateMs(form.startDate), requireDateMs(form.endDate)),
          hint: datesHint(requireDateMs(form.startDate), form.timezone),
        },
        // DEC-896: the time zone note -- every date on this row and every
        // deadline elsewhere in the event (CFP closes, agenda times) reads
        // through event-time.ts against this same zone, not the viewer's.
        { label: 'Time zone', value: form.timezone, hint: 'Applies to every date and deadline in this event' },
        { label: 'Venue', value: form.location || 'Not set' },
        { label: 'Record prefix', value: form.recordPrefix },
        { label: 'Branding', value: brandingSummary(form) },
        ...(mailStatus ? [{ label: 'Email', value: mailStatusSummary(mailStatus) }] : []),
      ]
    : [];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      {unscheduledNotice ? (
        <p role="status" className="chq-event-unscheduled-notice">
          {unscheduledNotice.sessions ? (
            <>
              {unscheduledNotice.sessions.count} placed {plural(unscheduledNotice.sessions.count, 'session')} now{' '}
              {plural(unscheduledNotice.sessions.count, 'falls', 'fall')} outside these dates and{' '}
              {plural(unscheduledNotice.sessions.count, 'has', 'have')} been unscheduled:{' '}
              {unscheduledNotice.sessions.sessions.map((s) => s.ref).join(', ')}.{' '}
            </>
          ) : null}
          {unscheduledNotice.breaks ? (
            <>
              {unscheduledNotice.breaks.count} {plural(unscheduledNotice.breaks.count, 'break')} now{' '}
              {plural(unscheduledNotice.breaks.count, 'falls', 'fall')} outside these dates:{' '}
              {unscheduledNotice.breaks.breaks.map((b) => b.label).join(', ')}.{' '}
            </>
          ) : null}
          <Link to="/agenda">View agenda</Link>
        </p>
      ) : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Event"
        rows={rows}
        actionLabel="Change"
        editing={editing}
      >
        {form ? (
        <SettingsEditForm
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          consequence="Changing the slug breaks every link already shared, including saved embeds"
          footer={{
            primary: <SettingsSaveButton pending={saving} />,
            secondary: (
              <button type="button" className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
            ),
          }}
        >
          {errorSummaryProblems.length > 0 ? (
            <ErrorSummary
              heading={countHeading(errorSummaryProblems.length, 'before these settings can be saved')}
              kept="Nothing was lost. Your edits are still below."
              problems={errorSummaryProblems}
            />
          ) : null}
          <SettingsField label="Name" htmlFor={FIELD_IDS.name} width="name" hint={fieldErrorHint('name')}>
            <input
              id={FIELD_IDS.name}
              className={fieldErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              aria-invalid={fieldAriaInvalid('name')}
              maxLength={MAX_NAME_LENGTH}
            />
          </SettingsField>
          <SettingsField
            label="Slug"
            htmlFor={FIELD_IDS.slug}
            width="slug"
            hint={fieldErrorHint('slug') ?? 'Used in every public URL'}
          >
            <input
              id={FIELD_IDS.slug}
              className={fieldErrors.slug ? 'chq-input chq-field-invalid' : 'chq-input'}
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              aria-invalid={fieldAriaInvalid('slug')}
              maxLength={MAX_NAME_LENGTH}
            />
          </SettingsField>
          <SettingsFieldPair>
            <SettingsField
              label="Start date"
              htmlFor={FIELD_IDS.startDate}
              width="date"
              hint={fieldErrorHint('startDate')}
            >
              <DateField
                id={FIELD_IDS.startDate}
                value={form.startDate}
                onChange={(next) => update('startDate', next)}
              />
            </SettingsField>
            <SettingsField
              label="End date"
              htmlFor={FIELD_IDS.endDate}
              width="date"
              hint={fieldErrorHint('endDate')}
            >
              <DateField
                id={FIELD_IDS.endDate}
                value={form.endDate}
                onChange={(next) => update('endDate', next)}
              />
            </SettingsField>
          </SettingsFieldPair>
          <SettingsField label="Venue" htmlFor={FIELD_IDS.location} width="name" hint={fieldErrorHint('location')}>
            <input
              id={FIELD_IDS.location}
              className={fieldErrors.location ? 'chq-input chq-field-invalid' : 'chq-input'}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              aria-invalid={fieldAriaInvalid('location')}
              maxLength={MAX_TEXT_LENGTH}
            />
          </SettingsField>
          <SettingsField
            label="Time zone"
            htmlFor={FIELD_IDS.timezone}
            width="name"
            hint={fieldErrorHint('timezone')}
          >
            <input
              id={FIELD_IDS.timezone}
              className={fieldErrors.timezone ? 'chq-input chq-field-invalid' : 'chq-input'}
              value={form.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              aria-invalid={fieldAriaInvalid('timezone')}
              maxLength={MAX_NAME_LENGTH}
            />
          </SettingsField>
          <SettingsField label="Record prefix" width="name">
            <input
              id="event-settings-record-prefix"
              className="chq-input"
              value={form.recordPrefix}
              readOnly
              disabled
            />
          </SettingsField>
          <SettingsField label="Logo URL" width="full">
            <input
              className="chq-input"
              value={form.logoUrl}
              onChange={(e) => update('logoUrl', e.target.value)}
              maxLength={MAX_TEXT_LENGTH}
            />
          </SettingsField>
          <SettingsField label="Accent color" width="name">
            <input
              id="event-settings-accent-color"
              className="chq-input"
              value={form.accentColor}
              onChange={(e) => update('accentColor', e.target.value)}
            />
          </SettingsField>
          {saved ? <span role="status"> Saved.</span> : null}
        </SettingsEditForm>
        ) : null}
      </SummarySection>
    </>
  );
}
