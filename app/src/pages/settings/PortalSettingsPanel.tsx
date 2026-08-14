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
import { apiGet, apiPut, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ResourcesPanel } from './ResourcesPanel';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField } from './SettingsEditForm';
import { countOf } from '../../lib/plural';
import {
  buildPortalSettingsPayload,
  validatePortalSettingsForm,
  type PortalSettingsForm,
  type PortalSettingsFormErrors,
} from './formState';

const SECTION_KEY = 'portal';

interface PortalSettingsRecord {
  welcomeMessage: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  showResources: boolean;
}

const EMPTY_FORM: PortalSettingsForm = {
  logoUrl: '',
  accentColor: '',
  welcomeMessage: '',
  showResources: true,
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
  const [error, setError] = useState<string | undefined>(undefined);

  const [form, setForm] = useState<PortalSettingsForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<PortalSettingsFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const loadPortalSettings = useCallback(() => {
    if (!eventId) return;
    apiGet<PortalSettingsRecord>(`/events/${eventId}/portal-settings`)
      .then((record) => {
        setWelcomeMessage(record.welcomeMessage);
        setWelcomeLoaded(true);
        setForm(formFromRecord(record));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load portal settings'));
  }, [eventId]);

  useEffect(() => {
    loadPortalSettings();
    if (!eventId) return;
    apiGet<OnboardingSummary>(`/events/${eventId}/onboarding?page=1&perPage=1`)
      .then((res) => setTaskCount(res.tasks.length))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load onboarding tasks'));
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
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save portal settings');
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
      value: (
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
      ),
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
        <a href="/portal" target="_blank" rel="noopener noreferrer">
          Open as a speaker
        </a>
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
          consequence="Title and abstract stay organiser-only — a speaker editing them after acceptance would change what was accepted."
          footer={{
            primary: (
              <button type="submit" className="chq-btn chq-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            ),
            secondary: (
              <button type="button" className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
            ),
          }}
        >
          <SettingsField label="Welcome note" htmlFor="chq-portal-welcome" width="full">
            <textarea
              id="chq-portal-welcome"
              className="chq-input"
              value={form.welcomeMessage}
              onChange={(e) => setForm((current) => ({ ...current, welcomeMessage: e.target.value }))}
            />
          </SettingsField>
          <SettingsField label="Logo URL" htmlFor="chq-portal-logo-url" width="full">
            <input
              id="chq-portal-logo-url"
              className="chq-input"
              type="text"
              value={form.logoUrl}
              onChange={(e) => setForm((current) => ({ ...current, logoUrl: e.target.value }))}
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
          </SettingsField>
          {saveError ? <span role="alert">{saveError}</span> : null}
          <div className="chq-settings-row">
            <span className="chq-settings-row-label">Resources</span>
            <div className="chq-settings-row-value chq-settings-portal-resources">
              <ResourcesPanel />
            </div>
          </div>
        </SettingsEditForm>
      </SummarySection>
    </>
  );
}
