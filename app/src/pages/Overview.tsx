// Overview worklist dashboard (DEC-370: "work happens here"). One round
// trip — GET .../overview returns the v2 payload (rows + deadlines) plus
// the retained v1 aggregates — and every row acts inline against the
// existing action endpoints, rendering optimistically and rolling back
// loudly on ApiError. Sole owner: this file + app/src/pages/overview/*.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { DelayedLoading } from '../components/DelayedLoading';
import { apiGet, apiList, apiPatch, apiPost, ApiError } from '../lib/api';
import { describeSendResult, type SendResult } from '../lib/sendResult';
import type {
  ContentApprovalRow,
  OverdueTaskRow,
  OverviewPayload,
  TriageRow,
} from './overview/types';
import { buildDeadlineCells, buildNoActionRows, daysLateLabel, headlineText, joinSegments, pluralize } from './overview/rows';
import { AgendaWorkSection } from './overview/AgendaWorkSection';
import './overview/overview.css';

type SubmissionStatus = 'accepted' | 'accept_queue' | 'declined';
type ContentDecision = 'approved' | 'changes_requested';

// DEC-611: Overview names the public surfaces it produces and links to them
// by the event's own slug, never a guessed slugification of the name. The
// slug comes from GET /api/v1/events (toEventRecord always returns it) —
// this extends the local list-item shape with it, matching on eventId.
interface EventListItem {
  id: string;
  slug: string;
  timezone: string;
}

// Mirrors src/routes/public/shell.tsx's SURFACES tuple plus the CFP form
// route (src/routes/public/submit.tsx) — the exhaustive set of public pages
// an organiser might want to hand out for the current event. DEC-877: the
// row no longer links each surface individually — it names them in one
// sentence and links only the event's own public root.
const PUBLIC_SURFACES: ReadonlyArray<{ label: string }> = [
  { label: 'Sessions' },
  { label: 'Speakers' },
  { label: 'Gallery' },
  { label: 'Agenda' },
  { label: 'Schedule' },
  { label: 'CFP form' },
];

// DEC-735: a dangling clause with no computed value must never render — this
// is always computable from the row's own submittedAt, so it's computed,
// never dropped like the unplaced row's duration (which the server never
// sends — see AgendaWorkSection.tsx).
function waitingDaysLabel(submittedAt: number, now: number): string {
  const days = Math.max(0, Math.round((now - submittedAt) / 86_400_000));
  return `waiting ${days} ${pluralize(days, 'day')}`;
}

export function OverviewPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remindToast, setRemindToast] = useState<string | null>(null);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [eventTimezone, setEventTimezone] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  async function loadPayload() {
    if (!eventId) return;
    const res = await apiGet<OverviewPayload>(`/events/${eventId}/overview`);
    setPayload(res);
  }

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    loadPayload()
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    setSlugError(null);
    apiList<EventListItem>('/events')
      .then((res) => {
        const match = res.items.find((item) => item.id === eventId);
        if (!match) {
          setSlugError('Event not found in the events list');
          return;
        }
        setEventSlug(match.slug);
        setEventTimezone(match.timezone);
      })
      .catch((err) => {
        setSlugError(err instanceof ApiError ? err.message : 'Could not resolve the public link');
      });
  }, [eventId]);

  function describeApiError(err: unknown, fallback: string): string {
    return err instanceof ApiError ? `${fallback}: ${err.message}` : fallback;
  }

  async function handleTriageAction(row: TriageRow, status: SubmissionStatus) {
    if (!eventId || !payload) return;
    const previous = payload;
    setPayload({
      ...payload,
      triage: {
        ...payload.triage,
        total: Math.max(0, payload.triage.total - 1),
        rows: payload.triage.rows.filter((r) => r.submissionId !== row.submissionId),
      },
    });
    setError(null);
    try {
      await apiPost(`/events/${eventId}/submissions/status`, { ids: [row.submissionId], status });
    } catch (err) {
      setPayload(previous);
      setError(describeApiError(err, 'Could not update the submission'));
    }
  }

  async function handleContentAction(row: ContentApprovalRow, contentStatus: ContentDecision) {
    if (!payload) return;
    const previous = payload;
    setPayload({
      ...payload,
      contentApproval: {
        ...payload.contentApproval,
        total: Math.max(0, payload.contentApproval.total - 1),
        rows: payload.contentApproval.rows.filter((r) => r.submissionId !== row.submissionId),
      },
    });
    setError(null);
    try {
      await apiPost(`/submissions/${row.submissionId}/content-status`, { contentStatus });
    } catch (err) {
      setPayload(previous);
      setError(describeApiError(err, 'Could not update content status'));
    }
  }

  async function handleMarkComplete(row: OverdueTaskRow) {
    if (!payload) return;
    const previous = payload;
    setPayload({
      ...payload,
      overdueTasks: {
        ...payload.overdueTasks,
        total: Math.max(0, payload.overdueTasks.total - 1),
        rows: payload.overdueTasks.rows.filter((r) => r.assignmentId !== row.assignmentId),
      },
    });
    setError(null);
    try {
      await apiPatch(`/task-assignments/${row.assignmentId}`, { status: 'complete' });
    } catch (err) {
      setPayload(previous);
      setError(describeApiError(err, 'Could not mark the task complete'));
    }
  }

  async function refetchOverview() {
    try {
      await loadPayload();
    } catch (err) {
      setError(describeApiError(err, 'Failed to refresh the overview'));
    }
  }

  async function handleRemind(taskIds: string[]) {
    if (!eventId) return;
    setError(null);
    try {
      const res = await apiPost<SendResult>(`/events/${eventId}/onboarding/remind`, { taskIds });
      setRemindToast(describeSendResult(res, { one: 'contact', many: 'contacts' }));
    } catch (err) {
      setError(describeApiError(err, 'Could not send reminders'));
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page chq-measure">
        <DelayedLoading label="Loading event…" />
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-measure">
        <div className="chq-attention-frame">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  if (loading || !payload) {
    return (
      <div className="chq-page chq-measure">
        {error && <div className="chq-error-banner">{error}</div>}
        {!error && <DelayedLoading label="Loading overview…" />}
      </div>
    );
  }

  const now = Date.now();
  // DEC-831: the deadline strip's day counts need the owning event's own
  // timezone (never a UTC default) -- the strip renders empty until the
  // small dedicated /events fetch above resolves it, rather than guessing.
  const deadlineCells = eventTimezone ? buildDeadlineCells(payload.deadlines, now, eventTimezone) : [];
  const noActionRows = buildNoActionRows(payload, now);
  const oldestTriageDays =
    payload.triage.oldestSubmittedAt !== null
      ? Math.max(0, Math.round((now - payload.triage.oldestSubmittedAt) / 86_400_000))
      : null;

  return (
    <div className="chq-page chq-measure">
      {error && <div className="chq-error-banner">{error}</div>}
      {remindToast && (
        <div className="chq-toast" role="status">
          {remindToast}
          <button
            type="button"
            className="chq-link-button"
            onClick={() => setRemindToast(null)}
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <div className="chq-overview-deadlines">
        {deadlineCells.map((cell) => (
          <Link key={cell.key} to={cell.href} className="chq-overview-deadline-cell">
            <span className="chq-overview-deadline-label">{cell.label}</span>
            <span
              className={
                cell.isNearest
                  ? 'chq-overview-deadline-value chq-overview-deadline-nearest'
                  : 'chq-overview-deadline-value'
              }
            >
              {cell.display}
            </span>
          </Link>
        ))}
      </div>

      <div className="chq-overview-headline-row">
        <h1 className="chq-overview-headline">{headlineText(payload)}</h1>
        <div className="chq-overview-toolbar">
          <a
            className="chq-overview-toolbar-btn"
            href={`/api/v1/events/${eventId}/export/submissions`}
          >
            Export
          </a>
          <Link className="chq-overview-toolbar-btn chq-overview-toolbar-btn-primary" to="/submissions">
            New submission
          </Link>
        </div>
      </div>

      <section className="chq-overview-section">
        <div className="chq-overview-section-header">
          <span className="chq-overview-section-label">01 — Overdue speaker tasks</span>
          {payload.overdueTasks.rows.length > 0 && (
            <button
              type="button"
              className="chq-overview-section-action chq-overview-remind-all"
              onClick={() => handleRemind(payload.overdueTasks.rows.map((r) => r.taskId))}
            >
              Remind all {payload.overdueTasks.rows.length}
            </button>
          )}
        </div>
        {payload.overdueTasks.rows.length > 0 && (
          <div className="chq-overview-caption">Skips anyone reminded in the last hour</div>
        )}
        {payload.overdueTasks.rows.length === 0 && (
          <div className="chq-overview-empty">No overdue speaker tasks.</div>
        )}
        {payload.overdueTasks.rows.map((row) => (
          <div key={row.assignmentId} className="chq-overview-row chq-overview-row-overdue">
            <div>
              <div className="chq-overview-row-title">{row.contactName}</div>
              <div className="chq-overview-row-meta">{row.company}</div>
            </div>
            <div>
              <div>{row.taskTitle}</div>
              <div className="chq-overview-row-late">{daysLateLabel(row.daysLate)}</div>
            </div>
            <div className="chq-overview-row-actions">
              <button type="button" className="chq-overview-link-btn" onClick={() => handleRemind([row.taskId])}>
                Remind
              </button>
              <button
                type="button"
                className="chq-overview-link-btn chq-overview-link-muted"
                onClick={() => handleMarkComplete(row)}
              >
                Mark complete
              </button>
            </div>
          </div>
        ))}
        {/* DEC-877: overflow is a summary line BELOW the list, never a nav
            link above it — the same shape §04 uses for its own overflow. */}
        {payload.overdueTasks.total > payload.overdueTasks.rows.length && (
          <div className="chq-overview-overflow">
            {payload.overdueTasks.total - payload.overdueTasks.rows.length} more overdue
          </div>
        )}
      </section>

      <section className="chq-overview-section">
        <div className="chq-overview-section-header">
          <span className="chq-overview-section-label">02 — Submissions awaiting triage</span>
          {payload.triage.total > 0 && (
            <Link to="/submissions?status=pending" className="chq-overview-section-action">
              All {payload.triage.total}
              {oldestTriageDays !== null ? ` · oldest ${oldestTriageDays} ${pluralize(oldestTriageDays, 'day')}` : ''}
            </Link>
          )}
        </div>
        {payload.triage.rows.length === 0 && <div className="chq-overview-empty">Nothing waiting for triage.</div>}
        {payload.triage.rows.map((row) => (
          <div key={row.submissionId} className="chq-overview-row chq-overview-row-single">
            <div>
              <div className="chq-overview-row-title chq-overview-row-title-lg">
                {row.title}
              </div>
              <div className="chq-overview-row-meta">
                {joinSegments([row.speakerName, row.trackName ?? row.format, row.ref, waitingDaysLabel(row.submittedAt, now)])}
              </div>
              <div className="chq-overview-row-actions-inline">
                <button
                  type="button"
                  className="chq-overview-btn chq-overview-btn-primary"
                  onClick={() => handleTriageAction(row, 'accepted')}
                >
                  Accept
                </button>
                <button type="button" className="chq-overview-btn" onClick={() => handleTriageAction(row, 'declined')}>
                  Decline
                </button>
                <button
                  type="button"
                  className="chq-overview-btn"
                  onClick={() => handleTriageAction(row, 'accept_queue')}
                >
                  Waitlist
                </button>
                <Link to={`/submissions/${row.submissionId}`} className="chq-overview-link-btn">
                  Read the abstract
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="chq-overview-section">
        <div className="chq-overview-section-header">
          <span className="chq-overview-section-label">03 — Session content awaiting approval</span>
          {payload.contentApproval.total > 0 && (
            <Link to="/content" className="chq-overview-section-action">
              All {payload.contentApproval.total} · {payload.contentApproval.reuploadedCount} re-uploaded
            </Link>
          )}
        </div>
        {payload.contentApproval.rows.length === 0 && (
          <div className="chq-overview-empty">Nothing waiting on content approval.</div>
        )}
        {payload.contentApproval.rows.map((row) => (
          <div key={row.submissionId} className="chq-overview-row chq-overview-row-content">
            <div>
              <div className="chq-overview-row-title chq-overview-row-title-md">
                {row.title}
              </div>
              <div className="chq-overview-row-meta">
                {joinSegments([row.speakerName, row.fileName, row.reuploaded ? 're-uploaded' : null])}
              </div>
            </div>
            <div className="chq-overview-row-actions">
              <button
                type="button"
                className="chq-overview-btn chq-overview-btn-primary"
                onClick={() => handleContentAction(row, 'approved')}
              >
                Approve
              </button>
              <button
                type="button"
                className="chq-overview-btn"
                onClick={() => handleContentAction(row, 'changes_requested')}
              >
                Ask for changes
              </button>
            </div>
          </div>
        ))}
      </section>

      <AgendaWorkSection payload={payload} setPayload={setPayload} setError={setError} refetch={refetchOverview} />

      <section className="chq-overview-section">
        <div className="chq-overview-section-header">
          <span className="chq-overview-section-label">No action needed</span>
        </div>
        {noActionRows.map((row) => (
          <div key={row.key} className="chq-overview-row chq-overview-row-quiet">
            <span className="chq-overview-row-title chq-overview-row-title-sm">
              {row.title}
            </span>
            <span className="chq-overview-row-meta chq-overview-row-meta-sm">
              {row.detail}
            </span>
          </div>
        ))}
        {/* DEC-877: Public pages is ONE summary sentence, not a chip per
            surface — the sentence names every live surface but the event's
            own public root (`/e/<slug>`) is the only link, matching the
            frame's convention that a row states its fact in prose and links
            out exactly once. */}
        <div className="chq-overview-row chq-overview-row-public">
          <span className="chq-overview-row-title chq-overview-row-title-sm">Public pages</span>
          {eventSlug ? (
            <span className="chq-overview-row-meta">
              {joinSegments(PUBLIC_SURFACES.map((s) => s.label))} are live at{' '}
              <a href={`/e/${eventSlug}`} target="_blank" rel="noreferrer" className="chq-overview-link-btn">
                /e/{eventSlug}
              </a>
              .
            </span>
          ) : (
            <span className="chq-overview-row-meta">{slugError ?? 'Resolving link…'}</span>
          )}
        </div>
      </section>
    </div>
  );
}
