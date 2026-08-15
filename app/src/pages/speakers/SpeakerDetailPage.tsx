// DEC-930: per-speaker detail page. One bounded GET
// (/api/v1/events/:eventId/speakers/:contactId) rendered as a page whose
// rows are links -- session -> /admin/submissions/:id, deliverable -> its
// download -- so every action the onboarding grid offers is one click from
// one snapshot.
//
// DEC-930 amendment (wave 26): the page is now the 1180 pair (820 main +
// 60 gap + 300 rail) frame B3 delivers -- the participation control moves
// into the header row beside Email/Remind (the roster's real control, not
// a restatement of its label); the main column carries Sessions, Tasks
// (clickable statuses, per-task Remind) and Files; the rail carries the
// contact block, cross-event history and Notes.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { PageSkeleton } from '../../components/PageSkeleton';
import { formatDateOnly, formatDayLabel } from '../../lib/dates';
import type { AssignmentStatus, InviteStatus, ReminderDraft } from './types';
import { ParticipationMenu } from './ParticipationMenu';
import { RemindPreviewModal } from './RemindPreviewModal';
import { describeSendResult, failureLines, type SendResult } from '../../lib/sendResult';
import { STATUS_LABELS } from '../submissions/types';
import { CONTENT_STATUS_LABELS } from '../content/types';
import { EmptyState } from '../../components/EmptyState';
import { formatBytes } from '../content/format';
import { publicRoomLabel } from '../../lib/room-label';
import { DEC_930 } from '../../../../src/decisions';
import type { SpeakerDetailResponse, SpeakerDetailTaskStatus } from './speakerDetail';
import './speakers.css';

void DEC_930;

// DEC-930 amendment (wave 26): cross-event history is a COUNT plus up to
// five names, never an unbounded list -- the server already caps this, but
// the page defensively re-caps rather than trusting a single writer.
const OTHER_EVENTS_LIMIT = 5;

const TASK_STATUS_LABELS: Record<SpeakerDetailTaskStatus, string> = {
  pending: 'Pending',
  complete: 'Complete',
};

// DEC-930 (wave 54 amendment): session/content status have no decided
// complete/pending/overdue meaning (richer enums than the invite/task-done
// axis), so both share the one added neutral modifier -- the label text,
// not the pill shape, carries the distinction (DEC-367).
function neutralStatusClass(): string {
  return 'chq-speakers-status chq-speakers-status-neutral';
}

// Task status is the SAME binary domain TaskCell.tsx's onboarding grid cells
// already use ('pending' | 'complete'), so it reuses those two modifiers
// directly rather than the neutral one above.
function taskStatusClass(status: SpeakerDetailTaskStatus): string {
  return `chq-speakers-status chq-speakers-status-${status}`;
}

function formatClockTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function scheduledLabel(scheduled: SpeakerDetailResponse['sessions'][number]['scheduled']): string {
  if (!scheduled) return 'Not placed';
  const slot = `${formatDayLabel(scheduled.day)} ${formatClockTime(scheduled.startMin)}–${formatClockTime(scheduled.endMin)}`;
  return `${slot}, ${publicRoomLabel(scheduled.roomName)}`;
}

export function SpeakerDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [detail, setDetail] = useState<SpeakerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // DEC-441/DEC-829: the same review-before-send reminder flow the
  // onboarding grid uses (RemindPreviewModal fed by the read-only preview
  // endpoint), scoped to this one contact -- both the header's "Remind"
  // action and each task row's "Remind this task" link open it (there is
  // no per-task-scoped reminder endpoint; both name the same underlying
  // send, which reminds about every outstanding task for this contact).
  const [reviewingRemind, setReviewingRemind] = useState(false);
  const [remindPreviewLoading, setRemindPreviewLoading] = useState(false);
  const [remindPreviewError, setRemindPreviewError] = useState<string | null>(null);
  const [remindDrafts, setRemindDrafts] = useState<ReminderDraft[] | null>(null);
  const [remindSkipped, setRemindSkipped] = useState(0);
  const [remindRemaining, setRemindRemaining] = useState(0);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    if (!eventId || !contactId) return;
    setLoading(true);
    setError(null);
    apiGet<SpeakerDetailResponse>(`/events/${eventId}/speakers/${contactId}`)
      .then((res) => setDetail(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load speaker'))
      .finally(() => setLoading(false));
  }, [eventId, contactId]);

  async function setInviteStatus(desired: InviteStatus) {
    if (!detail) return;
    const previous = detail;
    setDetail({ ...detail, participation: { ...detail.participation, inviteStatus: desired } });
    setError(null);
    try {
      await apiPatch(`/submissions/${detail.participation.submissionId}/participants/${detail.participation.participantId}`, {
        inviteStatus: desired,
      });
    } catch (err) {
      setDetail(previous);
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    }
  }

  async function sendPortalInvite() {
    if (!eventId || !detail) return;
    try {
      const res = await apiPost<SendResult>(`/events/${eventId}/portal-invites`, { contactIds: [detail.contact.id] });
      const lines = failureLines(res);
      setToast(`${describeSendResult(res, { one: 'contact', many: 'contacts' })}${lines ? ` ${lines}.` : ''}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Send failed: ${err.message}` : 'Send failed');
    }
  }

  async function toggleTaskStatus(assignmentId: string, current: AssignmentStatus) {
    if (!detail) return;
    const desired: AssignmentStatus = current === 'complete' ? 'pending' : 'complete';
    const previous = detail;
    const now = Date.now();
    setDetail({
      ...detail,
      tasks: detail.tasks.map((t) =>
        t.assignmentId === assignmentId ? { ...t, status: desired, completedAt: desired === 'complete' ? now : null } : t,
      ),
    });
    setError(null);
    try {
      await apiPatch(`/task-assignments/${assignmentId}`, { status: desired });
    } catch (err) {
      setDetail(previous);
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    }
  }

  async function openRemindReview() {
    if (!eventId || !detail) return;
    setReviewingRemind(true);
    setRemindPreviewLoading(true);
    setRemindPreviewError(null);
    setRemindDrafts(null);
    setRemindSkipped(0);
    setRemindRemaining(0);
    try {
      const res = await apiPost<{ drafts: ReminderDraft[]; skipped: number; remaining: number }>(
        `/events/${eventId}/onboarding/remind/preview`,
        { contactIds: [detail.contact.id] },
      );
      setRemindDrafts(res.drafts);
      setRemindSkipped(res.skipped);
      setRemindRemaining(res.remaining);
    } catch (err) {
      setRemindPreviewError(err instanceof ApiError ? err.message : 'Failed to load reminder preview');
    } finally {
      setRemindPreviewLoading(false);
    }
  }

  function closeRemindReview() {
    setReviewingRemind(false);
    setRemindPreviewError(null);
    setRemindDrafts(null);
    setRemindSkipped(0);
    setRemindRemaining(0);
  }

  async function handleRemindSend() {
    if (!eventId || !detail) return;
    setReminding(true);
    setError(null);
    try {
      const res = await apiPost<SendResult>(`/events/${eventId}/onboarding/remind`, { contactIds: [detail.contact.id] });
      const lines = failureLines(res);
      setToast(`${describeSendResult(res, { one: 'contact', many: 'contacts' })}${lines ? ` ${lines}.` : ''}`);
      closeRemindReview();
      const refreshed = await apiGet<SpeakerDetailResponse>(`/events/${eventId}/speakers/${detail.contact.id}`);
      setDetail(refreshed);
    } catch (err) {
      setRemindPreviewError(err instanceof ApiError ? `Send failed: ${err.message}` : 'Send failed');
    } finally {
      setReminding(false);
    }
  }

  if (eventLoading) {
    return (
      <div className="chq-page chq-speaker-detail-page chq-measure-table">
        <PageSkeleton variant="detail" label="Loading event…" />
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

  // DEC-678 (wave-3/wave-8, proven by app/src/admin-first-paint.render.test.
  // tsx): the speaker-detail fetch occupies this page's ENTIRE main region --
  // until it settles there is nothing else on the page. It was previously
  // gated behind DelayedLoading, whose 250ms withholding is correct only for
  // a sub-region inside an already-structured page; here it painted an empty
  // chq-page div for the first frames (the common returning-admin path, where
  // eventLoading is already false because localStorage carries the event id).
  // The page-level wait therefore renders PageSkeleton on the first frame,
  // exactly as the eventLoading branch above already does.
  if (loading) {
    return (
      <div className="chq-page chq-speaker-detail-page chq-measure-table">
        <PageSkeleton variant="detail" label="Loading speaker…" />
      </div>
    );
  }

  const files = detail
    ? detail.tasks.filter((t): t is typeof t & { file: NonNullable<typeof t.file> } => t.file !== null)
    : [];
  const otherEvents = detail ? detail.otherEvents.slice(0, OTHER_EVENTS_LIMIT) : [];

  return (
    <div className="chq-page chq-speaker-detail-page chq-measure-table">
      {error && <div className="chq-error">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}
      {!loading && detail && (
        <>
          <div className="chq-speaker-detail-head">
            <div className="chq-speaker-detail-identity">
              {detail.contact.headshotFileId ? (
                <div className="chq-speaker-detail-headshot-wrap">
                  <img
                    className="chq-speaker-detail-headshot"
                    src={`/headshots/${detail.contact.headshotFileId}`}
                    alt={`${detail.contact.name} headshot`}
                  />
                  <a
                    className="chq-btn chq-btn-tertiary chq-speaker-detail-headshot-download"
                    href={`/headshots/${detail.contact.headshotFileId}`}
                    download
                  >
                    Download
                  </a>
                </div>
              ) : (
                <div className="chq-speaker-detail-headshot-placeholder" aria-hidden="true" />
              )}
              <div className="chq-speaker-detail-titles">
                <Link className="chq-link-button chq-speaker-detail-back" to="/speakers">
                  &lsaquo; Speakers
                </Link>
                <h1 className="chq-page-title">{detail.contact.name}</h1>
                <p className="chq-meta chq-speaker-detail-subtitle">
                  {detail.contact.company ?? '—'}
                  {' · '}
                  {detail.contact.title ?? '—'}
                  {' · '}
                  {detail.contact.hasAccount ? 'has an account' : 'no account'}
                </p>
              </div>
            </div>

            <div className="chq-speaker-detail-actions">
              <ParticipationMenu
                contactName={detail.contact.name}
                status={detail.participation.inviteStatus}
                onSelectStatus={setInviteStatus}
                onSendInvite={sendPortalInvite}
                company={detail.contact.company}
                hasAccount={detail.contact.hasAccount}
              />
              <a className="chq-btn chq-btn-secondary" href={`mailto:${detail.contact.email}`}>
                Email {detail.contact.name.split(' ')[0]}
              </a>
              <button type="button" className="chq-btn chq-btn-primary" onClick={openRemindReview}>
                Remind {detail.contact.name.split(' ')[0]}
              </button>
            </div>
          </div>

          <div className="chq-speaker-detail-grid">
            <div className="chq-speaker-detail-main">
              <section className="chq-section chq-speaker-detail-sessions">
                <div className="chq-section-head">
                  <span className="chq-section-label">Sessions &middot; {detail.sessions.length}</span>
                </div>
                {detail.sessions.length === 0 ? (
                  // DEC-678: this list has no filter axis of its own (it's
                  // this one speaker's whole session set, not a facet of a
                  // larger table), so it only ever ships the fresh variant.
                  <EmptyState variant="fresh" what="No sessions." />
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
                            <span className={neutralStatusClass()}>{STATUS_LABELS[session.status]}</span>
                          </td>
                          <td>
                            <span className={neutralStatusClass()}>{CONTENT_STATUS_LABELS[session.contentStatus]}</span>
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
                  // DEC-678: no filter axis here either -- fresh only.
                  <EmptyState variant="fresh" what="No tasks." />
                ) : (
                  <table className="chq-table chq-speaker-detail-tasks-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th></th>
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
                            <button
                              type="button"
                              className={taskStatusClass(task.status)}
                              onClick={() => toggleTaskStatus(task.assignmentId, task.status)}
                              aria-label={`Toggle ${task.title} for ${detail.contact.name}`}
                            >
                              {TASK_STATUS_LABELS[task.status]}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="chq-link-button chq-speaker-detail-task-remind"
                              onClick={openRemindReview}
                            >
                              Remind this task
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="chq-section chq-speaker-detail-files">
                <div className="chq-section-head">
                  <span className="chq-section-label">Files &middot; {files.length}</span>
                </div>
                {files.length === 0 ? (
                  // DEC-678: no filter axis -- fresh only.
                  <EmptyState variant="fresh" what="No files." />
                ) : (
                  <table className="chq-table chq-speaker-detail-files-table">
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Size</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((task) => (
                        <tr key={task.assignmentId}>
                          <td>{task.file.filename}</td>
                          <td>{formatBytes(task.file.sizeBytes)}</td>
                          <td>
                            <a
                              href={`/files/${task.file.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="chq-speakers-file-link"
                              title={task.file.filename}
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>

            <aside className="chq-speaker-detail-rail">
              <section className="chq-section chq-speaker-detail-contact">
                <div className="chq-section-head">
                  <span className="chq-section-label">Contact</span>
                </div>
                <div className="chq-speaker-detail-contact-body">
                  <span>{detail.contact.email}</span>
                  {detail.contact.phone && <span className="chq-meta">{detail.contact.phone}</span>}
                  <Link className="chq-link-button" to={`/contacts?openContact=${detail.contact.id}`}>
                    Open the contact record &rsaquo;
                  </Link>
                </div>
              </section>

              <section className="chq-section chq-speaker-detail-other-events">
                <div className="chq-section-head">
                  <span className="chq-section-label">Across your events &middot; {detail.otherEventsCount}</span>
                </div>
                {otherEvents.length === 0 ? (
                  // DEC-678: no filter axis -- fresh only.
                  <EmptyState variant="fresh" what="No other events." />
                ) : (
                  <ul className="chq-speaker-detail-other-events-list">
                    {otherEvents.map((e) => (
                      <li key={e.eventId}>{e.name}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="chq-section chq-speaker-detail-notes">
                <div className="chq-section-head">
                  <span className="chq-section-label">Notes</span>
                </div>
                {detail.contact.notes ? (
                  <p className="chq-speaker-detail-notes-body">{detail.contact.notes}</p>
                ) : (
                  <p className="chq-empty">No notes.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      {reviewingRemind && (
        <RemindPreviewModal
          loading={remindPreviewLoading}
          error={remindPreviewError}
          drafts={remindDrafts}
          skipped={remindSkipped}
          remaining={remindRemaining}
          sending={reminding}
          onSend={handleRemindSend}
          onCancel={closeRemindReview}
        />
      )}
    </div>
  );
}
