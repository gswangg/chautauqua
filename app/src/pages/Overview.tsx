// Overview worklist dashboard (DEC-370: "work happens here"). One round
// trip — GET .../overview returns the v2 payload (rows + deadlines) plus
// the retained v1 aggregates — and every row acts inline against the
// existing action endpoints, rendering optimistically and rolling back
// loudly on ApiError. Sole owner: this file + app/src/pages/overview/*.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { apiGet, apiPatch, apiPost, ApiError } from '../lib/api';
import type {
  ContentApprovalRow,
  OverdueTaskRow,
  OverviewPayload,
  TriageRow,
} from './overview/types';
import { buildDeadlineCells, buildNoActionRows, daysLateLabel, headlineText, pluralize } from './overview/rows';
import { conflictKindLabel } from './agenda/ConflictChip';
import './overview/overview.css';

type SubmissionStatus = 'accepted' | 'accept_queue' | 'declined';
type ContentDecision = 'approved' | 'changes_requested';

export function OverviewPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remindToast, setRemindToast] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    apiGet<OverviewPayload>(`/events/${eventId}/overview`)
      .then((res) => setPayload(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load overview'))
      .finally(() => setLoading(false));
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

  async function handleRemind(taskIds: string[]) {
    if (!eventId) return;
    setError(null);
    try {
      const res = await apiPost<{ sent: number; skipped: number; remaining: number }>(
        `/events/${eventId}/onboarding/remind`,
        { taskIds },
      );
      setRemindToast(
        `Reminded ${res.sent} contact${res.sent === 1 ? '' : 's'} · skipped ${res.skipped} · ${res.remaining} remaining.`,
      );
    } catch (err) {
      setError(describeApiError(err, 'Could not send reminders'));
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page">
        <p>Loading event…</p>
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page">
        <div className="chq-attention-frame">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  if (loading || !payload) {
    return (
      <div className="chq-page">
        {error && <div className="chq-error-banner">{error}</div>}
        {!error && <div className="chq-attention-frame">Loading overview…</div>}
      </div>
    );
  }

  const now = Date.now();
  const deadlineCells = buildDeadlineCells(payload.deadlines, now);
  const noActionRows = buildNoActionRows(payload, now);
  const oldestTriageDays =
    payload.triage.oldestSubmittedAt !== null
      ? Math.max(0, Math.round((now - payload.triage.oldestSubmittedAt) / 86_400_000))
      : null;

  return (
    <div className="chq-page">
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

      <h1 className="chq-overview-headline">{headlineText(payload)}</h1>

      <section className="chq-overview-section">
        <div className="chq-overview-section-header">
          <span className="chq-overview-section-label">01 — Overdue speaker tasks</span>
          {payload.overdueTasks.total > 0 && (
            <button
              type="button"
              className="chq-overview-section-action chq-overview-remind-all"
              onClick={() => handleRemind(payload.overdueTasks.rows.map((r) => r.taskId))}
            >
              Remind all {payload.overdueTasks.total}
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
                {row.speakerName} · {row.trackName ?? row.format} · {row.ref}
              </div>
              <div className="chq-overview-row-actions chq-overview-row-actions-stacked">
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
                {row.speakerName} · {row.fileName}
                {row.reuploaded ? ' · re-uploaded' : ''}
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

      <section className="chq-overview-section">
        <div className="chq-overview-section-header">
          <span className="chq-overview-section-label">04 — Unplaced sessions and conflicts</span>
          <Link to="/agenda" className="chq-overview-section-action">
            Open the grid
          </Link>
        </div>
        {payload.agendaWork.conflicts.length === 0 && payload.agendaWork.unplaced.length === 0 && (
          <div className="chq-overview-empty">Every accepted session is placed with no clashes.</div>
        )}
        {payload.agendaWork.conflicts.map((conflict, idx) => (
          <div key={`conflict-${idx}`} className="chq-overview-row chq-overview-row-agenda">
            <div>
              <div className="chq-overview-row-title chq-overview-row-title-sm">
                {conflict.day}
              </div>
              <div className="chq-overview-row-meta">{conflict.roomName}</div>
            </div>
            <div>
              <div className="chq-overview-row-late">
                {conflictKindLabel(conflict.kind)}
              </div>
              {conflict.entries.map((entry) => (
                <div key={entry.submissionId}>
                  {entry.title} <span className="chq-overview-row-meta">— {entry.speakerName} · {entry.ref}</span>
                </div>
              ))}
            </div>
            <div />
          </div>
        ))}
        {payload.agendaWork.unplaced.map((row) => (
          <div key={row.submissionId} className="chq-overview-row chq-overview-row-agenda">
            <span className="chq-overview-caption chq-overview-caption-flush">
              No slot yet
            </span>
            <div>
              <div>{row.title}</div>
              <div className="chq-overview-row-meta">
                {row.speakerName} · {row.durationMin} min · {row.ref}
              </div>
            </div>
            <Link to="/agenda" className="chq-overview-link-btn">
              Place it
            </Link>
          </div>
        ))}
      </section>

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
      </section>
    </div>
  );
}
