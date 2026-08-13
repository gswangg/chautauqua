// Speaker portal settings section (w4-h, DEC-032; summary-first w3-c,
// DEC-747): the 'Speaker portal' read view (docs/design/Chautauqua
// Settings.dc.html:142-182) -- Welcome note, Speakers can edit (pills),
// Onboarding tasks, Resources (delegates to ResourcesPanel, unchanged
// endpoints/CRUD) and Access, with 'Open as a speaker' as the section's
// ONE rule action -- a real link to the portal, not an edit-drill toggle
// (DEC-747: "ONE action on its rule").
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
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ResourcesPanel } from './ResourcesPanel';

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

  return (
    <section className="chq-settings-panel chq-settings-numbered" aria-label="Speaker portal">
      <div className="chq-settings-section-head">
        <h2>Speaker portal</h2>
        <a className="chq-settings-section-action" href="/portal" target="_blank" rel="noopener noreferrer">
          Open as a speaker
        </a>
      </div>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}

      <div className="chq-settings-row">
        <span className="chq-settings-row-label">Welcome note</span>
        <div className="chq-settings-row-value">
          {!welcomeLoaded ? (
            <DelayedLoading />
          ) : (
            `Shown above the task list · ${paragraphs} paragraph${paragraphs === 1 ? '' : 's'}`
          )}
        </div>
      </div>

      <div className="chq-settings-row">
        <span className="chq-settings-row-label">Speakers can edit</span>
        <div className="chq-settings-row-value chq-settings-portal-pills">
          {SPEAKER_EDIT_FIELDS.map((field) => (
            <span
              key={field.label}
              className={field.editable ? 'chq-pill chq-pill-static is-active' : 'chq-pill chq-pill-static'}
            >
              {field.label}
            </span>
          ))}
        </div>
      </div>

      <div className="chq-settings-row">
        <span className="chq-settings-row-label">Onboarding tasks</span>
        <div className="chq-settings-row-value">
          {taskCount === null ? (
            <DelayedLoading />
          ) : (
            `${taskCount} task${taskCount === 1 ? '' : 's'} · created when a submission is accepted`
          )}
        </div>
      </div>

      <div className="chq-settings-row">
        <span className="chq-settings-row-label">Resources</span>
        <div className="chq-settings-row-value chq-settings-portal-resources">
          <ResourcesPanel />
        </div>
      </div>

      <div className="chq-settings-row">
        <span className="chq-settings-row-label">Access</span>
        <div className="chq-settings-row-value">Speakers claim their portal from a link in their acceptance email</div>
      </div>
    </section>
  );
}
