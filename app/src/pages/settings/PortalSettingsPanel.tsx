// Speaker portal settings section (w4-h, DEC-032; summary-first w3-c,
// DEC-747; SummarySection adoption w6-e, DEC-815): the 'Speaker portal'
// read view (docs/design/Chautauqua Settings.dc.html:142-182) -- Welcome
// note, Speakers can edit (pills), Onboarding tasks, Resources and Access
// -- with 'Open as a speaker' kept as a row-level link (it is a live
// navigation, not an edit) and the section's ONE rule action now the
// SummarySection 'Change' drill (?section=portal&edit=1, DEC-728/DEC-710),
// which reveals the panel's one real edit surface: ResourcesPanel
// (delegates to it unchanged -- same endpoints/CRUD).
//
// GAP flagged for a follow-up task (not decided here): the mock's read
// view has no action on the Welcome note / Speakers can edit / Onboarding
// tasks / Access rows, so welcome-message/branding editing (previously
// this panel's whole form, PUT /events/:id/portal-settings) has no entry
// point from Settings after this conversion. The endpoint itself, and
// buildPortalSettingsPayload/validatePortalSettingsForm in formState.ts,
// are unchanged -- only the Settings UI's path to them is removed pending
// a decision on where that edit affordance should live.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ResourcesPanel } from './ResourcesPanel';
import { SummarySection } from './SummarySection';
import { countOf } from '../../lib/plural';

const SECTION_KEY = 'portal';

interface PortalSettingsRecord {
  welcomeMessage: string | null;
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
  const [searchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!eventId) return;
    apiGet<PortalSettingsRecord>(`/events/${eventId}/portal-settings`)
      .then((record) => {
        setWelcomeMessage(record.welcomeMessage);
        setWelcomeLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load portal settings'));
    apiGet<OnboardingSummary>(`/events/${eventId}/onboarding?page=1&perPage=1`)
      .then((res) => setTaskCount(res.tasks.length))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load onboarding tasks'));
  }, [eventId]);

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
    { label: 'Resources', value: 'Wiki pages and files speakers can access from their portal' },
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
        <div className="chq-settings-row">
          <span className="chq-settings-row-label">Resources</span>
          <div className="chq-settings-row-value chq-settings-portal-resources">
            <ResourcesPanel />
          </div>
        </div>
      </SummarySection>
    </>
  );
}
