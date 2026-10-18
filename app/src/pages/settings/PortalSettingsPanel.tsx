// Speaker portal settings section (w4-h, DEC-032; summary-first w3-c,
// DEC-747; SummarySection adoption w6-e, DEC-815): the 'Speaker portal'
// read view (docs/design/Chautauqua Settings.dc.html:142-182) -- Welcome
// note, Speakers can edit (pills), Onboarding tasks, Resources and Access
// -- with 'Preview the portal' (once 'Open as a speaker') kept as a row-level link (it is a live
// navigation, not an edit) and the section's ONE rule action now the
// SummarySection 'Change' drill (?section=portal&edit=1, DEC-728/DEC-710),
// which reveals the panel's edit surfaces: the branding/welcome form
// (PUT /events/:eventId/portal-settings) above ResourcesPanel (delegated
// to unchanged -- same endpoints/CRUD).
//
// DEC-988: closes the round trip -- buildPortalSettingsPayload /
// validatePortalSettingsForm (formState.ts) were previously wired only to
// their own unit test with no caller in the SPA. This panel is now that
// caller: it hydrates a PortalSettingsForm from the GET response, PUTs the
// full payload on save, and re-reads the record so the read view updates
// without a reload.
//
// DEC-815 amendment (wave 4): the summary Resources row used to describe
// the set ("Wiki pages and files speakers can access from their portal")
// rather than list it. It now renders ResourcesPanel itself in its new
// `readOnly` mode -- the same component the edit branch already uses,
// never a second list renderer, with no add/delete control at rest.
//
// Multi-portal (docs/design/multi-portal/, flow 1): the section is now
// "Portals". Its read rows summarise the event's portals, their coverage,
// the item library and how participants get in; the head action is "Manage
// portals", a link to the Portals sub-page. What speakers may edit, the
// onboarding items and the welcome note moved into the portals themselves
// (field permissions, items, Profile basics' note). The edit drill keeps
// the portal's branding, the welcome note (the same stored note Profile
// basics edits) and resource files, reached from the Branding row.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiList, apiPut, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ResourcesPanel } from './ResourcesPanel';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField, SettingsSaveButton } from './SettingsEditForm';
import { countOf } from '../../lib/plural';
import type { LibraryEntry, LibraryListing, PortalOverview } from '../portals/types';
import { DEFAULT_PORTAL_SETTINGS } from '../../lib/portal-defaults';
import {
  buildPortalSettingsPayload,
  validatePortalSettingsForm,
  type PortalSettingsForm,
  type PortalSettingsFormErrors,
} from './formState';
import { MAX_LONG_TEXT_LENGTH, MAX_TEXT_LENGTH } from '../../../../src/forms/validate';
import { DEC_896, DEC_919 } from '../../../../src/decisions';
import './settings-drill-rows.css';

// DEC-896 (wave-133 amendment): the Welcome note field's persistent hint
// and the 'What speakers may edit' closing line below are the
// section/field-scoped half of B10's consequence text.
void DEC_896;
// DEC-919 wave-157 clause (a): the read drill renders the STORED welcome
// text verbatim inside the boxed readout the frame draws, not a computed
// summary of it.
void DEC_919;

const SECTION_KEY = 'portal';

interface PortalSettingsRecord {
  welcomeMessage: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  showResources: boolean;
}

const EMPTY_FORM: PortalSettingsForm = {
  logoUrl: DEFAULT_PORTAL_SETTINGS.logoUrl ?? '',
  accentColor: DEFAULT_PORTAL_SETTINGS.accentColor ?? '',
  welcomeMessage: DEFAULT_PORTAL_SETTINGS.welcomeMessage ?? '',
  showResources: DEFAULT_PORTAL_SETTINGS.showResources,
};

function formFromRecord(record: PortalSettingsRecord): PortalSettingsForm {
  return {
    logoUrl: record.logoUrl ?? '',
    accentColor: record.accentColor ?? '',
    welcomeMessage: record.welcomeMessage ?? '',
    showResources: record.showResources,
  };
}

// "14 tasks · 6 forms · 4 file requests · 7 resources": the item library
// by kind (built-in items aren't the organizer's to count).
const LIBRARY_KINDS: { type: LibraryEntry['type']; noun: string }[] = [
  { type: 'task', noun: 'task' },
  { type: 'form', noun: 'form' },
  { type: 'file_request', noun: 'file request' },
  { type: 'share_kit', noun: 'share kit' },
  { type: 'resource', noun: 'resource' },
];

function libraryLine(entries: LibraryEntry[]): string {
  const parts = LIBRARY_KINDS.map(({ type, noun }) => ({ n: entries.filter((e) => e.type === type).length, noun }))
    .filter(({ n }) => n > 0)
    .map(({ n, noun }) => countOf(n, noun));
  return parts.length > 0 ? parts.join(' · ') : 'No library items yet';
}

function paragraphCount(text: string | null): number {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\n\s*\n+/).filter((p) => p.trim().length > 0).length;
}

// multi-portal decision 71: branding is the event's, so the line says it
// covers every portal (it read as the speaker portal's own setting)
function brandingLine(form: PortalSettingsForm): string {
  const logo = form.logoUrl.trim() !== '';
  const accent = form.accentColor.trim();
  if (logo && accent) return `Logo · ${accent} accent · all portals ·`;
  if (logo) return 'Logo · default accent · all portals ·';
  if (accent) return `No logo · ${accent} accent · all portals ·`;
  return 'No logo · default accent · all portals ·';
}

// docs/design/Chautauqua Settings.dc.html:518 (phone drill): the Welcome
// note row draws a boxed readout of the STORED text, verbatim (DEC-919
// wave-157 clause (a)); desktop keeps its computed "Shown above the task
// list · N paragraphs" line, and CSS (settings-drill-rows.css) decides
// which shows at which width. The edit drill mounts the same readout above
// its field (DEC-919 wave-9 amendment, :905). Multi-portal: the note is
// Profile basics' note too -- the same stored value, edited from either.
function WelcomeNoteReadout({ text, className }: { text: string | null; className?: string }) {
  const trimmed = (text ?? '').trim();
  const content = trimmed.length === 0 ? 'No welcome note set.' : text;
  const classes = className ? `chq-settings-portal-welcome-readout ${className}` : 'chq-settings-portal-welcome-readout';
  return <div className={classes}>{content}</div>;
}

export function PortalSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [resourceCount, setResourceCount] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const [form, setForm] = useState<PortalSettingsForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<PortalSettingsFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const loadPortalSettings = useCallback(() => {
    if (!eventId) return;
    // DEC-856 (wave 71 amendment): clear the page-level banner at the start
    // of the load, before any read is issued -- so a stale refusal never
    // sits beside a later successful reload (TracksRoomsPanel's shape).
    setError(undefined);
    apiGet<PortalSettingsRecord>(`/events/${eventId}/portal-settings`)
      .then((record) => {
        setWelcomeMessage(record.welcomeMessage);
        setWelcomeLoaded(true);
        setForm(formFromRecord(record));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load portal settings'));
  }, [eventId]);

  useEffect(() => {
    // DEC-856 (wave 71 amendment): clear the page-level banner before the
    // onboarding/resources reads below are issued too -- loadPortalSettings
    // already clears for its own read, but this effect fires two more reads
    // of its own into the SAME `error` state.
    setError(undefined);
    loadPortalSettings();
    if (!eventId) return;
    apiGet<PortalOverview>(`/events/${eventId}/portals`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load portals'));
    apiGet<LibraryListing>(`/events/${eventId}/library`)
      .then((res) => setLibrary(res.entries))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the item library'));
    apiList<{ id: string }>(`/events/${eventId}/resources`)
      .then((res) => setResourceCount(res.total))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load resources'));
  }, [eventId, loadPortalSettings]);

  function closeEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('section');
      params.delete('edit');
      return params;
    });
  }

  function openEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('section', SECTION_KEY);
      params.set('edit', '1');
      return params;
    });
  }

  async function handleSave() {
    const errors = validatePortalSettingsForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!eventId) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await apiPut(`/events/${eventId}/portal-settings`, buildPortalSettingsPayload(form));
      loadPortalSettings();
    } catch (err) {
      // DEC-958: mirrors RosterPanel.tsx/EventSettingsPanel.tsx -- a
      // fields-map refusal (src/routes/api/portal-config.ts's wire keys:
      // logoUrl, accentColor, welcomeMessage, showResources) merges into
      // the SAME formErrors state the client-side validator already
      // populates, so client and server errors merge rather than
      // replace each other. saveError stays reserved for the fields-less
      // case.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFormErrors((current) => ({ ...current, ...err.fields }));
      } else {
        setSaveError(err instanceof ApiError ? err.message : 'Failed to save portal settings');
      }
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    {
      label: 'Portals',
      value:
        overview === null ? (
          <DelayedLoading />
        ) : overview.portals.length === 0 ? (
          'No portals yet'
        ) : (
          `${overview.portals.length} · ${overview.portals.map((p) => p.name).join(', ')}`
        ),
    },
    {
      label: 'Coverage',
      value:
        overview === null ? (
          <DelayedLoading />
        ) : overview.total === 0 ? (
          'No participations yet'
        ) : (
          `${overview.covered} of ${countOf(overview.total, 'participation')} covered`
        ),
      hint:
        overview !== null && overview.notInAny > 0 ? (
          <Link className="chq-settings-row-link" to="/speakers?portal=none">
            {`${overview.notInAny} not in any portal`}
          </Link>
        ) : undefined,
    },
    {
      label: 'Libraries',
      value: library === null ? <DelayedLoading /> : libraryLine(library),
    },
    { label: 'Access', value: 'Participants claim their portal from a link in their acceptance or invitation email' },
    {
      label: 'Welcome note',
      value: !welcomeLoaded ? (
        <DelayedLoading />
      ) : (
        <>
          <span className="chq-settings-portal-welcome-summary">
            {`Shown above the task list · ${countOf(paragraphCount(welcomeMessage), 'paragraph')}`}
          </span>
          <WelcomeNoteReadout text={welcomeMessage} />
        </>
      ),
      rowClassName: 'chq-settings-drill-field-row',
    },
    {
      label: 'Branding',
      value: (
        <>
          <span>{brandingLine(form)}</span>{' '}
          <a
            className="chq-settings-portal-preview-link"
            href={eventId ? `/portal/preview?eventId=${eventId}` : '/portal/preview'}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* the branding is the event's, shared by every portal; this
                opens how the portal looks with nobody signed in */}
            Preview the portal
          </a>
        </>
      ),
      hint: (
        <button type="button" className="chq-link-button" onClick={openEdit}>
          Change
        </button>
      ),
    },
  ];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Portals"
        rows={rows}
        actionLabel="Manage portals"
        actionTo="/settings/portals"
        editing={editing}
      >
        <SettingsEditForm
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          footer={{
            primary: <SettingsSaveButton pending={saving} />,
            secondary: (
              <button type="button" className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
            ),
          }}
        >
          {/* DEC-919 wave-9 amendment: docs/design/Chautauqua
              Settings.dc.html:905's boxed static readout of the STORED
              welcome text, above the editable field -- fed by
              `welcomeMessage` (the loaded record), never `form.welcomeMessage`
              (the in-progress edit). :906's caption sits directly below the
              readout, a single copy no longer doubling as the textarea's
              hint (DEC-613). */}
          <WelcomeNoteReadout text={welcomeMessage} className="chq-settings-portal-welcome-readout-edit" />
          <p className="chq-settings-field-hint">Takes the full measure · appears above the task list</p>
          <SettingsField
            label="Welcome note"
            htmlFor="chq-portal-welcome"
            width="full"
            hint={formErrors.welcomeMessage ? <span role="alert">{formErrors.welcomeMessage}</span> : undefined}
          >
            {/* G13 fix (frames 09--07/09--13): the welcome note draws ~96px
                tall -- the shared textarea class, never the 44px single-line
                input height. */}
            <textarea
              id="chq-portal-welcome"
              className="chq-textarea"
              value={form.welcomeMessage}
              onChange={(e) => setForm((current) => ({ ...current, welcomeMessage: e.target.value }))}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </SettingsField>
          <SettingsField
            label="Logo URL"
            htmlFor="chq-portal-logo-url"
            width="full"
            hint={formErrors.logoUrl ? <span role="alert">{formErrors.logoUrl}</span> : undefined}
          >
            <input
              id="chq-portal-logo-url"
              className="chq-input"
              type="text"
              value={form.logoUrl}
              onChange={(e) => setForm((current) => ({ ...current, logoUrl: e.target.value }))}
              maxLength={MAX_TEXT_LENGTH}
            />
          </SettingsField>
          <SettingsField
            label="Accent colour"
            htmlFor="chq-portal-accent-color"
            width="name"
            hint={formErrors.accentColor ? <span role="alert">{formErrors.accentColor}</span> : undefined}
          >
            <input
              id="chq-portal-accent-color"
              className="chq-input"
              type="text"
              placeholder="#336699"
              value={form.accentColor}
              onChange={(e) => setForm((current) => ({ ...current, accentColor: e.target.value }))}
            />
          </SettingsField>
          <SettingsField label="Show resources" htmlFor="chq-portal-show-resources" width="name">
            <input
              id="chq-portal-show-resources"
              className="chq-check"
              type="checkbox"
              checked={form.showResources}
              onChange={(e) => setForm((current) => ({ ...current, showResources: e.target.checked }))}
            />
            {formErrors.showResources ? <span role="alert">{formErrors.showResources}</span> : null}
          </SettingsField>
          {saveError ? <span role="alert">{saveError}</span> : null}

          <p className="chq-settings-edit-consequence">
            What participants may edit, and what they're asked for, is set per portal in{' '}
            <Link className="chq-settings-row-link" to="/settings/portals">
              Manage portals
            </Link>
            .
          </p>

          <div className="chq-settings-section-head">
            <h3 className="chq-section-label">{`Resources · ${resourceCount ?? 0}`}</h3>
          </div>
          <ResourcesPanel />
        </SettingsEditForm>
      </SummarySection>
    </>
  );
}
