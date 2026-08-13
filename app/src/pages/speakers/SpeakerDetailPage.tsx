// DEC-930: per-speaker detail page. One bounded GET
// (/api/v1/events/:eventId/speakers/:contactId) rendered as a page whose
// rows are links -- session -> /admin/submissions/:id, deliverable -> its
// download -- so every action the onboarding grid offers is one click from
// one snapshot.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DelayedLoading } from '../../components/DelayedLoading';
import { formatDateOnly, formatDayLabel } from '../../lib/dates';
import { INVITE_STATUS_LABELS } from './types';
import { participationStatusClass } from './ParticipationMenu';
import { STATUS_LABELS } from '../submissions/types';
import { CONTENT_STATUS_LABELS } from '../content/types';
import { DEC_930 } from '../../../../src/decisions';
import type { SpeakerDetailResponse, SpeakerDetailTaskStatus } from './speakerDetail';
import './speakers.css';

void DEC_930;

const TASK_STATUS_LABELS: Record<SpeakerDetailTaskStatus, string> = {
  pending: 'Pending',
  complete: 'Complete',
};

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatClockTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function scheduledLabel(scheduled: SpeakerDetailResponse['sessions'][number]['scheduled']): string {
  if (!scheduled) return 'Not placed';
  const slot = `${formatDayLabel(scheduled.day)} ${formatClockTime(scheduled.startMin)}–${formatClockTime(scheduled.endMin)}`;
  return `${slot}, ${scheduled.roomName ?? 'To be announced'}`;
}

export function SpeakerDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [detail, setDetail] = useState<SpeakerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !contactId) return;
    setLoading(true);
    setError(null);
    apiGet<SpeakerDetailResponse>(`/events/${eventId}/speakers/${contactId}`)
      .then((res) => setDetail(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load speaker'))
      .finally(() => setLoading(false));
  }, [eventId, contactId]);

  if (eventLoading) {
    return (
      <div className="chq-page chq-speaker-detail-page chq-measure-table">
        <DelayedLoading label="Loading event…" />
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-speaker-detail-page chq-measure-table">
        <h1 className="chq-page-title">Speaker</h1>
        <div className="chq-error">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-speaker-detail-page chq-measure-table">
      <div className="chq-speaker-detail-topbar">
        <Link className="chq-link-button chq-speaker-detail-back" to="/speakers">
          &lsaquo; Speakers
        </Link>
      </div>

      {error && <div className="chq-error">{error}</div>}
      {loading && <DelayedLoading label="Loading speaker…" />}

      {!loading && detail && (
        <>
          <div className="chq-speaker-detail-head">
            <h1 className="chq-page-title">{detail.contact.name}</h1>
            <p className="chq-meta chq-speaker-detail-subtitle">
              {detail.contact.company ?? '—'}
              {' · '}
              {detail.contact.hasAccount ? 'Has account' : 'No account'}
            </p>
          </div>

          <p className="chq-meta chq-speaker-detail-participation">
            Participation:{' '}
            <span className={participationStatusClass(detail.participation.inviteStatus)}>
              {INVITE_STATUS_LABELS[detail.participation.inviteStatus]}
            </span>
          </p>

          <section className="chq-section chq-speaker-detail-sessions">
            <div className="chq-section-head">
              <span className="chq-section-label">Sessions &middot; {detail.sessions.length}</span>
            </div>
            {detail.sessions.length === 0 ? (
              <p className="chq-empty">No sessions.</p>
            ) : (
              <table className="chq-table chq-speaker-detail-sessions-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Content status</th>
                    <th>Slot / room</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sessions.map((session) => (
                    <tr key={session.submissionId}>
                      <td>
                        <Link to={`/submissions/${session.submissionId}`}>
                          {session.ref} &middot; {session.title}
                        </Link>
                      </td>
                      <td>
                        <span className="chq-flag">{STATUS_LABELS[session.status]}</span>
                      </td>
                      <td>
                        <span className="chq-flag">{CONTENT_STATUS_LABELS[session.contentStatus]}</span>
                      </td>
                      <td>{scheduledLabel(session.scheduled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="chq-section chq-speaker-detail-tasks">
            <div className="chq-section-head">
              <span className="chq-section-label">
                Tasks &middot; {detail.tasks.length}
                {' · '}
                {detail.counts.outstandingRequired} outstanding
                {' · '}
                {detail.counts.overdue} overdue
              </span>
            </div>
            {detail.tasks.length === 0 ? (
              <p className="chq-empty">No tasks.</p>
            ) : (
              <table className="chq-table chq-speaker-detail-tasks-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Deliverable</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.tasks.map((task) => (
                    <tr key={task.assignmentId}>
                      <td>
                        {task.title}
                        {task.required && <span className="chq-speaker-detail-required"> Required</span>}
                      </td>
                      <td>{formatDateOnly(task.dueDate)}</td>
                      <td>
                        <span className="chq-flag">{TASK_STATUS_LABELS[task.status]}</span>
                      </td>
                      <td>
                        {/* DEC-920/DEC-930: a deliverable link is named by the
                            file's own filename -- never the word 'File' --
                            and is absent entirely (not a disabled control)
                            when no file exists yet. */}
                        {task.file ? (
                          <a
                            href={`/files/${task.file.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="chq-speakers-file-link"
                            title={task.file.filename}
                          >
                            {task.file.filename} ({formatBytes(task.file.sizeBytes)})
                          </a>
                        ) : (
                          <span className="chq-speakers-cell-none">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
