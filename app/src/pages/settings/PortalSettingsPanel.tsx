// Speaker portal settings section (w4-h, DEC-032; summary-first w3-c,
// DEC-747; SummarySection adoption w6-e, DEC-815): the 'Speaker portal'
// read view (docs/design/Chautauqua Settings.dc.html:142-182) -- Welcome
// note, Speakers can edit (pills), Onboarding tasks, Resources and Access
// -- with 'Open as a speaker' kept as a row-level link (it is a live
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
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiList, apiPut, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ResourcesPanel } from './ResourcesPanel';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField, SettingsSaveButton } from './SettingsEditForm';
import { countOf } from '../../lib/plural';
import { DEFAULT_PORTAL_SETTINGS } from '../../lib/portal-defaults';
import {
  buildPortalSettingsPayload,
  validatePortalSettingsForm,
  type PortalSettingsForm,
  type PortalSettingsFormErrors,
} from './formState';
import { MAX_LONG_TEXT_LENGTH, MAX_TEXT_LENGTH } from '../../../../src/forms/validate';

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

interface OnboardingSummary {
  tasks: { id: string }[];
}

// DEC-747 pack: Bio/Headshot/Links are always speaker-editable (the
// portal profile form, src/routes/portal/profile.tsx); Session
// title/Abstract follow the submission edit-lock gate (canEditSubmission,
// src/domain/edit-lock.ts) instead of being unconditionally open -- a real
// architectural split, not fixture data.
const SPEAKER_EDIT_FIELDS: { label: string; editable: boolean }[] = [
  { label: 'Bio', editable: true },
  { label: 'Headshot', editable: true },
  { label: 'Links', editable: true },
  { label: 'Session title', editable: false },
  { label: 'Abstract', editable: false },
];

// w4-b: the SAME array renders in both the read row and the edit form's
// 'What speakers may edit' section -- never a second list.
function SpeakerEditPills() {
  return (
    <div className="chq-settings-portal-pills">
      {SPEAKER_EDIT_FIELDS.map((field) => (
        <span
          key={field.label}
          className={field.editable ? 'chq-pill chq-pill-static is-active' : 'chq-pill chq-pill-static'}
        >
          {field.label}
        </span>
      ))}
    </div>
  );
}

function paragraphCount(text: string | null): number {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\n\s*\n+/).filter((p) => p.trim().length > 0).length;
}

export function PortalSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
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
    apiGet<OnboardingSummary>(`/events/${eventId}/onboarding?page=1&perPage=1`)
      .then((res) => setTaskCount(res.tasks.length))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load onboarding tasks'));
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

  const paragraphs = paragraphCount(welcomeMessage);

  const rows = [
    {
      label: 'Welcome note',
      value: !welcomeLoaded ? (
        <DelayedLoading />
      ) : (
        `Shown above the task list · ${countOf(paragraphs, 'paragraph')}`
      ),
    },
    {
      label: 'Speakers can edit',
      value: <SpeakerEditPills />,
    },
    {
      label: 'Onboarding tasks',
      value:
        taskCount === null ? (
          <DelayedLoading />
        ) : (
          `${countOf(taskCount, 'task')} · created when a submission is accepted`
        ),
    },
    {
      label: 'Resources',
      value: <ResourcesPanel readOnly />,
    },
    { label: 'Access', value: 'Speakers claim their portal from a link in their acceptance email' },
    {
      label: 'Open the portal',
      value: (
        <>
          <a
            href={eventId ? `/portal/preview?eventId=${eventId}` : '/portal/preview'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open as a speaker
          </a>{' '}
          <span className="chq-meta">read-only preview · not a speaker's account</span>
        </>
      ),
    },
  ];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection sectionKey={SECTION_KEY} label="Speaker portal" rows={rows} actionLabel="Change" editing={editing}>
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
          <SettingsField
            label="Welcome note"
            htmlFor="chq-portal-welcome"
            width="full"
            hint={formErrors.welcomeMessage ? <span role="alert">{formErrors.welcomeMessage}</span> : undefined}
          >
            <textarea
              id="chq-portal-welcome"
              className="chq-input"
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

          <div className="chq-settings-section-head">
            <h3 className="chq-section-label">What speakers may edit</h3>
          </div>
          <SpeakerEditPills />
          <p className="chq-settings-edit-consequence">
            Title and abstract stay organiser-only — a speaker editing them after acceptance would change what was
            accepted.
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
