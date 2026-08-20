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
import { formatDateOnly, formatDateTime, formatDayLabel } from '../../lib/dates';
import { type AssignmentStatus, type InviteStatus, type ReminderDraft } from './types';
import { ParticipationMenu } from './ParticipationMenu';
import { RemindPreviewModal } from './RemindPreviewModal';
import { describeSendResult, failureLines, type SendResult } from '../../lib/sendResult';
import { STATUS_LABELS } from '../submissions/types';
import { CONTENT_STATUS_LABELS } from '../content/types';
import { EmptyState } from '../../components/EmptyState';
import { formatBytes } from '../content/format';
import { publicRoomLabel } from '../../lib/room-label';
import { clockHHMM } from '../../lib/clock';
import { firstNameOf } from '../../lib/identity';
import { DEC_930 } from '../../../../src/decisions';
import type { SpeakerDetailFile, SpeakerDetailResponse, SpeakerDetailTask, SpeakerDetailTaskStatus } from './speakerDetail';
import { OVERDUE_LABEL, statusCellClass } from './TaskCell';
import { toRows, fromRows, reservedValue, RESERVED_CUSTOM_FIELD_KEYS, RESERVED_CUSTOM_FIELD_LABELS } from '../contacts/customFields';
// DEC-417/DEC-660: the same cap the Contacts drawer declares on these three
// reserved fields -- the two surfaces PATCH the same /contacts/:id route, so
// they must not disagree about the length it enforces.
import { MAX_TEXT_LENGTH } from '../../lib/text-caps';
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
//
// v12 density: DENSE. These are read-only LABELS on a session/content row,
// not controls -- the roomy half of the pair is for a row that is a real
// target, and inflating a label to a 44px box would claim a tap that leads
// nowhere. The task rows below take 'roomy'; these do not.
function neutralStatusClass(): string {
  return 'chq-speakers-status chq-speakers-status-neutral chq-speakers-status-dense';
}

// User-filed (speaker detail, Elliot Ekström): the tasks list arrived in
// whatever order the assignment join produced -- completes and pendings
// interleaved, due dates jumping backwards -- so the one row that needed
// chasing could sit last. Outstanding work reads first, oldest deadline
// first: overdue, then the rest of the pendings, then the completed history.
// Within each band, by due date ascending; a task with no due date sorts to
// the end of its own band (it names no deadline to be early or late for),
// and ties keep the server's order (stable), so the page never invents an
// ordering the payload didn't carry.
const TASK_BAND_OVERDUE = 0;
const TASK_BAND_PENDING = 1;
const TASK_BAND_COMPLETE = 2;

function taskBand(task: SpeakerDetailTask): number {
  if (task.status === 'complete') return TASK_BAND_COMPLETE;
  return task.overdue ? TASK_BAND_OVERDUE : TASK_BAND_PENDING;
}

export function sortSpeakerDetailTasks(tasks: readonly SpeakerDetailTask[]): SpeakerDetailTask[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const bandDelta = taskBand(a.task) - taskBand(b.task);
      if (bandDelta !== 0) return bandDelta;
      const dueA = a.task.dueDate;
      const dueB = b.task.dueDate;
      if (dueA === null && dueB === null) return a.index - b.index;
      if (dueA === null) return 1;
      if (dueB === null) return -1;
      if (dueA !== dueB) return dueA - dueB;
      return a.index - b.index;
    })
    .map((entry) => entry.task);
}

// Task status is the SAME binary domain TaskCell.tsx's onboarding grid cells
// already use ('pending' | 'complete') over the SAME three-modifier control
// family (DEC-730), so the class comes from that component's own
// statusCellClass -- never a second mapping here. The overdue arm is what
// the user-filed report was missing: a past-due pending row rendered
// identically to an on-time one while the section header counted it.
//
// v12 density: ROOMY. The pack's rule is that the roomy half belongs
// "anywhere a row can carry a real target -- phone cards, the speaker
// detail, the task views", and every one of these rows IS a click that
// flips the status. Same colour and weight as the matrix's dense cells;
// only min-height and horizontal padding differ, so a speaker's Overdue
// reads identically here and in the grid.
function taskStatusClass(status: SpeakerDetailTaskStatus, overdue: boolean): string {
  return statusCellClass(status, overdue, 'roomy');
}

function taskStatusLabel(status: SpeakerDetailTaskStatus, overdue: boolean): string {
  if (status !== 'complete' && overdue) return OVERDUE_LABEL;
  return TASK_STATUS_LABELS[status];
}

// Design pack v12 (wave 118 amendment): the row's Remind link carries its
// own reminder ORDINAL ("Remind · never sent" / "Remind · sent once" /
// "Remind · 3rd time" in the frame), server-derived from email_log via the
// ONE shared reader (task-view.ts's countRemindSends windowing rule, spent
// here through SpeakerDetailTask.remindCount) rather than a fabricated
// tally -- see repo/tasks/speaker-detail.ts.
function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function taskRemindLabel(remindCount: number): string {
  if (remindCount === 0) return 'Remind · never sent';
  if (remindCount === 1) return 'Remind · sent once';
  return `Remind · ${remindCount}${ordinalSuffix(remindCount)} time`;
}

/** The most recent reminder this speaker received about ANY of their tasks,
 * or null if they have never been reminded -- the header caption's "last
 * 4 Aug" half; the N× half is detail.counts.remindCount, the person-level
 * total the server derives from the same email_log reader. */
export function lastRemindedAcross(tasks: readonly SpeakerDetailTask[]): number | null {
  const sent = tasks.map((t) => t.lastRemindedAt).filter((v): v is number => v !== null);
  return sent.length === 0 ? null : Math.max(...sent);
}

// Design pack v12 (wave 118 amendment): the Tasks section's 2nd cell carries
// TENSE -- "Was due 1 Apr" once the date has passed, "Due 10 Apr" while it
// hasn't -- judged purely against the due date, never against the task's
// own status (a complete task can still read "Due 25 Apr" per the frame).
export function taskDueCaption(dueDate: number | null): string {
  if (dueDate === null) return formatDateOnly(dueDate);
  const verb = dueDate < Date.now() ? 'Was due' : 'Due';
  return `${verb} ${formatDateOnly(dueDate)}`;
}

// DEC-930 wave-19 amendment: the Files row-grid's 52px lead track is a
// short file-kind tag (frame :385's `{{ v.tag }}`) -- derived client-side
// from the filename already on the wire, never a new server field.
function fileKindTag(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot > -1 ? filename.slice(dot + 1) : '';
  return (ext || 'FILE').slice(0, 4).toUpperCase();
}

function scheduledLabel(scheduled: SpeakerDetailResponse['sessions'][number]['scheduled']): string {
  if (!scheduled) return 'Not placed';
  const slot = `${formatDayLabel(scheduled.day)} ${clockHHMM(scheduled.startMin)}–${clockHHMM(scheduled.endMin)}`;
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

  // DEC-738 amendment (wave 71): the person's org-wide logistics facts
  // (dietary/travel/accessibility) -- same customFields the CRM drawer
  // edits, so save round-trips through the SAME pure helpers
  // (toRows/fromRows/reservedValue) rather than a second normalization.
  const [editingLogistics, setEditingLogistics] = useState(false);
  const [logisticsDraft, setLogisticsDraft] = useState({ dietary: '', travel: '', accessibility: '' });
  const [savingLogistics, setSavingLogistics] = useState(false);

  useEffect(() => {
    if (!eventId || !contactId) return;
    setLoading(true);
    setError(null);
    apiGet<SpeakerDetailResponse>(`/events/${eventId}/speakers/${contactId}`)
      .then((res) => setDetail(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load speaker'))
      .finally(() => setLoading(false));
  }, [eventId, contactId]);

  // USER RULING (release night, final form): participation is controlled
  // per session, in the Sessions rows -- exactly the roster grid's surface,
  // no person-level master switch and no separate header chip restating a
  // status. Each menu writes only its own participation row.
  async function setSessionInviteStatus(
    target: { participantId: string; submissionId: string },
    desired: InviteStatus,
  ) {
    if (!detail) return;
    const previous = detail;
    const bySubmission = detail.participationRollup.bySubmission.map((row) =>
      row.participantId === target.participantId ? { ...row, inviteStatus: desired } : row,
    );
    const first = bySubmission[0];
    setDetail({
      ...detail,
      participation:
        detail.participation.participantId === target.participantId
          ? { ...detail.participation, inviteStatus: desired }
          : detail.participation,
      participationRollup:
        first !== undefined && bySubmission.every((row) => row.inviteStatus === first.inviteStatus)
          ? { status: first.inviteStatus, bySubmission }
          : { status: 'mixed', bySubmission },
    });
    setError(null);
    try {
      await apiPatch(`/submissions/${target.submissionId}/participants/${target.participantId}`, {
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
      // The send mints inviteStatus='invited' server-side (DEC-805/DEC-869):
      // refetch so the session rows' participation menus show the state the
      // action's caption promised, without waiting for a reload. Same shape
      // as handleRemindSend's refresh below — never an optimistic guess,
      // since the server decides which participations were bumped.
      const refreshed = await apiGet<SpeakerDetailResponse>(`/events/${eventId}/speakers/${detail.contact.id}`);
      setDetail(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? `Send failed: ${err.message}` : 'Send failed');
    }
  }

  function startEditLogistics() {
    if (!detail) return;
    setLogisticsDraft({
      dietary: reservedValue(detail.contact.customFields, RESERVED_CUSTOM_FIELD_KEYS.dietary),
      travel: reservedValue(detail.contact.customFields, RESERVED_CUSTOM_FIELD_KEYS.travel),
      accessibility: reservedValue(detail.contact.customFields, RESERVED_CUSTOM_FIELD_KEYS.accessibility),
    });
    setError(null);
    setEditingLogistics(true);
  }

  async function saveLogistics() {
    if (!detail) return;
    const rows = toRows(detail.contact.customFields);
    const result = fromRows(logisticsDraft, rows);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const previous = detail;
    setSavingLogistics(true);
    setError(null);
    setDetail({ ...detail, contact: { ...detail.contact, customFields: result.fields } });
    setEditingLogistics(false);
    try {
      await apiPatch(`/contacts/${detail.contact.id}`, { customFields: result.fields });
    } catch (err) {
      setDetail(previous);
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    } finally {
      setSavingLogistics(false);
    }
  }

  async function toggleTaskStatus(assignmentId: string, current: AssignmentStatus) {
    if (!detail) return;
    const desired: AssignmentStatus = current === 'complete' ? 'pending' : 'complete';
    const previous = detail;
    const now = Date.now();
    const tasks = detail.tasks.map((t) =>
      t.assignmentId === assignmentId ? { ...t, status: desired, completedAt: desired === 'complete' ? now : null } : t,
    );
    // User-filed: the section header states these two counts over the rows
    // directly beneath it, so the optimistic flip has to restate them from
    // the flipped rows -- otherwise ticking the one overdue task complete
    // leaves the header claiming an overdue row the reader can no longer
    // find. Same two derivations the server makes (repo/tasks/
    // speaker-detail.ts): required-and-not-complete, and late-and-not-
    // complete (lateness itself is the server's DEC-801 read, never
    // re-judged here).
    setDetail({
      ...detail,
      tasks,
      counts: {
        outstandingRequired: tasks.filter((t) => t.status !== 'complete' && t.required).length,
        overdue: tasks.filter((t) => t.status !== 'complete' && t.overdue).length,
        // Toggling status doesn't touch email_log -- this optimistic patch
        // carries the server's last remindCount through unchanged.
        remindCount: detail.counts.remindCount,
      },
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

  // DEC-930 (amendment, wave 115): the Files section lists EVERY file object
  // this record owns -- the task uploads AND the speaker's current headshot,
  // which used to render only as an avatar plus a bare Download and appeared
  // nowhere in this table. Each row carries the same four cells the frame
  // draws (docs/design/Chautauqua Speakers.dc.html:391-396: tag, name, when,
  // Download), with the uploader folded into the name cell's subline the way
  // the admin Files library already does it (FilesLibrary.tsx's whoLine).
  // A headshot downloads through /headshots/:id -- the gated headshot route
  // -- while a task upload downloads through /files/:id; that split is the
  // same one FilesLibrary's downloadHref makes. Task files first, headshot
  // last: the same tiering files-library-list.ts applies (DEC-669).
  const files: { key: string; file: SpeakerDetailFile; isHeadshot: boolean }[] = detail
    ? [
        ...detail.tasks
          .filter((t): t is typeof t & { file: NonNullable<typeof t.file> } => t.file !== null)
          .map((t) => ({ key: `task-${t.assignmentId}`, file: t.file, isHeadshot: false })),
        ...(detail.headshotFile
          ? [{ key: `headshot-${detail.headshotFile.id}`, file: detail.headshotFile, isHeadshot: true }]
          : []),
      ]
    : [];
  // DEC-829 amendment (wave 112): the label drops its `· {otherEventsCount}`
  // suffix (frame :414 draws "Across your events" with no count), but
  // otherEventsCount keeps a real reader here as the list's own cap -- never
  // a declared value nobody reads (DEC-851/988).
  const otherEvents = detail ? detail.otherEvents.slice(0, Math.min(OTHER_EVENTS_LIMIT, detail.otherEventsCount)) : [];
  // docs/design/Chautauqua Speakers.dc.html:362 draws `Sessions · 1 accepted`
  // -- the accepted aggregate, not the raw session count -- derived from the
  // same detail.sessions[].status already on the DEC-930 payload.
  const acceptedSessionCount = detail
    ? detail.sessions.filter((session) => session.status === 'accepted').length
    : 0;

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
              {/* DEC-930 (amendment, wave 115): the bare Download beside the
                  avatar is gone -- the headshot is now a full row in the Files
                  section below, with its filename, uploader and timestamp
                  beside the same link. The portrait stays a portrait. */}
              {detail.contact.headshotFileId ? (
                <div className="chq-speaker-detail-headshot-wrap">
                  <img
                    className="chq-speaker-detail-headshot"
                    src={`/headshots/${detail.contact.headshotFileId}`}
                    alt={`${detail.contact.name} headshot`}
                  />
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
                {/* USER RULING (release night, final form): no participation
                    chip in the header at all -- no master switch, no static
                    restatement. Participation is read AND set per session in
                    the Sessions rows below (grid parity); DEC-936's "header
                    never contradicts the roster" is satisfied by the header
                    asserting nothing. */}
              </div>
            </div>

            {/* DEC-738 amendment (wave 75): the bio/social links the speaker
                wrote through their portal profile -- read-only here (the CRM
                contact drawer stays the one place a person's org-wide record
                is edited, so this block links there rather than embedding a
                second form). Nothing renders when both are empty. */}
            {(detail.contact.bio || detail.contact.socialLinks.length > 0) && (
              <div className="chq-speaker-detail-portal-bio">
                {detail.contact.bio && <p className="chq-speaker-detail-portal-bio-text">{detail.contact.bio}</p>}
                {detail.contact.socialLinks.length > 0 && (
                  <p className="chq-speaker-detail-portal-bio-links">
                    {detail.contact.socialLinks.map((link) => (
                      <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ))}
                  </p>
                )}
                <Link className="chq-link-button" to={`/contacts?openContact=${detail.contact.id}`}>
                  Edit in contact record &rsaquo;
                </Link>
              </div>
            )}

            <div className="chq-speaker-detail-actions">
              <a className="chq-btn chq-btn-secondary" href={`mailto:${detail.contact.email}`}>
                Email {firstNameOf(detail.contact.name)}
              </a>
              {/* DEC-829 amendment (w61-e): a header-level Remind control
                  only where something on this speaker's task list is
                  outstanding -- a fully-complete speaker has nothing this
                  send would ever reach. */}
              {detail.tasks.some((t) => t.status !== 'complete') && (
                <button type="button" className="chq-btn chq-btn-primary" onClick={openRemindReview}>
                  Remind {firstNameOf(detail.contact.name)}
                </button>
              )}
              {/* Design pack v12 (wave 118 amendment) adds a reminder-history
                  caption beside the two 46px controls, so "Remind" is
                  pressed against what has already been sent rather than in
                  the dark: "Reminded 3× · last 4 Aug", absent entirely when
                  nothing has ever been sent. */}
              {detail.counts.remindCount > 0 && (
                <span className="chq-speaker-detail-remind-history">
                  Reminded {detail.counts.remindCount}&times; &middot; last {formatDateOnly(lastRemindedAcross(detail.tasks))}
                </span>
              )}
            </div>
          </div>

          <div className="chq-speaker-detail-grid">
            <div className="chq-speaker-detail-main">
              <section className="chq-section chq-speaker-detail-sessions">
                <div className="chq-section-head">
                  <span className="chq-section-label">Sessions &middot; {acceptedSessionCount} accepted</span>
                </div>
                {detail.sessions.length === 0 ? (
                  // DEC-678: this list has no filter axis of its own (it's
                  // this one speaker's whole session set, not a facet of a
                  // larger table), so it only ever ships the fresh variant.
                  <EmptyState variant="fresh" what="No sessions." />
                ) : (
                  // DEC-930 wave-19 amendment: the frame's row track is
                  // link/slot/status (3 tracks, :357) -- status and content
                  // status share the one status track (both spans of the
                  // same evaluation-lattice axis, DEC-367) rather than
                  // dropping either value.
                  <div role="table" aria-label="Sessions">
                    {detail.sessions.map((session) => {
                      // USER RULING (release night): per-session state is
                      // settable HERE too, not only on the roster grid --
                      // each row carries its own menu, writing exactly its
                      // own participation.
                      const participation = detail.participationRollup.bySubmission.find(
                        (row) => row.submissionId === session.submissionId,
                      );
                      return (
                        <div className="chq-speaker-detail-sessions-row" role="row" key={session.submissionId}>
                          <span role="cell">
                            <Link to={`/submissions/${session.submissionId}`}>
                              {session.ref} &middot; {session.title}
                            </Link>
                          </span>
                          <span role="cell">{scheduledLabel(session.scheduled)}</span>
                          <span role="cell" className={neutralStatusClass()}>
                            {STATUS_LABELS[session.status]} &middot; {CONTENT_STATUS_LABELS[session.contentStatus]}
                          </span>
                          <span role="cell">
                            {participation && (
                              <ParticipationMenu
                                contactName={detail.contact.name}
                                label={session.ref}
                                status={participation.inviteStatus}
                                onSelectStatus={(desired) => setSessionInviteStatus(participation, desired)}
                                onSendInvite={sendPortalInvite}
                                /* USER RULING: the participation control sits at
                                   its NATURAL chip size on this page. Dense. */
                                density="dense"
                                company={detail.contact.company}
                                hasAccount={detail.contact.hasAccount}
                              />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="chq-section chq-speaker-detail-tasks">
                <div className="chq-section-head">
                  {/* docs/design/Chautauqua Speakers.dc.html:373 draws
                      `Tasks · 2 outstanding` -- the single outstanding
                      aggregate. The overdue figure belongs on the rows
                      (task.overdue, styled per-row below), not restated on
                      this line; detail.counts.overdue keeps a real reader
                      via this aria-label so a screen reader still hears the
                      count the rows only convey visually. */}
                  <span
                    className="chq-section-label"
                    aria-label={`Tasks, ${detail.counts.outstandingRequired} outstanding, ${detail.counts.overdue} overdue`}
                  >
                    Tasks &middot; {detail.counts.outstandingRequired} outstanding
                  </span>
                  {detail.tasks.length > 0 && (
                    <span className="chq-speaker-detail-tasks-caption">Click a status to change it</span>
                  )}
                </div>
                {detail.tasks.length === 0 ? (
                  // DEC-678: no filter axis here either -- fresh only.
                  <EmptyState variant="fresh" what="No tasks." />
                ) : (
                  <div role="table" aria-label="Tasks">
                    {sortSpeakerDetailTasks(detail.tasks).map((task) => (
                      <div className="chq-speaker-detail-tasks-row" role="row" key={task.assignmentId}>
                        <span role="cell">
                          {task.title}
                          {task.required && <span className="chq-speaker-detail-required"> Required</span>}
                        </span>
                        <span role="cell">{taskDueCaption(task.dueDate)}</span>
                        <span role="cell">
                          <button
                            type="button"
                            className={taskStatusClass(task.status, task.overdue)}
                            onClick={() => toggleTaskStatus(task.assignmentId, task.status)}
                            aria-label={
                              task.status !== 'complete' && task.overdue
                                ? `Toggle ${task.title} for ${detail.contact.name}, overdue`
                                : `Toggle ${task.title} for ${detail.contact.name}`
                            }
                          >
                            {taskStatusLabel(task.status, task.overdue)}
                          </button>
                        </span>
                        {/* DEC-829 amendment (w61-e): quiet on an
                            already-complete task row -- nothing this send
                            would ever reach for that assignment. */}
                        {task.status !== 'complete' ? (
                          <span role="cell">
                            <button
                              type="button"
                              className="chq-link-button chq-speaker-detail-task-remind"
                              onClick={openRemindReview}
                            >
                              {taskRemindLabel(task.remindCount)}
                            </button>
                          </span>
                        ) : (
                          <span role="cell" />
                        )}
                      </div>
                    ))}
                  </div>
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
                  <div role="table" aria-label="Files">
                    {files.map((row) => (
                      <div className="chq-speaker-detail-files-row" role="row" key={row.key}>
                        <span className="chq-speaker-detail-file-tag" role="cell" aria-hidden="true">
                          {fileKindTag(row.file.filename)}
                        </span>
                        <span className="chq-speaker-detail-file-name" role="cell">
                          <span>{row.file.filename}</span>
                          <span className="chq-speaker-detail-file-who">
                            {row.file.uploaderName ?? '—'} &middot; {formatDateTime(row.file.uploadedAt)}
                          </span>
                        </span>
                        <span role="cell">{formatBytes(row.file.sizeBytes)}</span>
                        {/* Two literal hrefs rather than one computed one: a
                            headshot serves from the gated /headshots/:id route
                            and a task upload from /files/:id (the same split
                            FilesLibrary's downloadHref makes), and
                            test/link-targets-scan.test.ts's allowlist only
                            sees an href it can read literally. */}
                        <span role="cell">
                          {row.isHeadshot ? (
                            <a
                              href={`/headshots/${row.file.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="chq-speakers-file-link"
                              title={row.file.filename}
                            >
                              Download
                            </a>
                          ) : (
                            <a
                              href={`/files/${row.file.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="chq-speakers-file-link"
                              title={row.file.filename}
                            >
                              Download
                            </a>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
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
                  {/* docs/design/Chautauqua Speakers.dc.html:414 draws
                      `Across your events` with no count -- otherEventsCount
                      no longer appears here (see the otherEvents cap above
                      for its remaining reader). */}
                  <span className="chq-section-label">Across your events</span>
                </div>
                {otherEvents.length === 0 ? (
                  // DEC-678: no filter axis -- fresh only.
                  <EmptyState variant="fresh" what="No other events." />
                ) : (
                  <ul className="chq-speaker-detail-other-events-list">
                    {otherEvents.map((e) => (
                      <li key={e.eventId}>
                        <span className="chq-speaker-detail-other-event-name">{e.name}</span>
                        {e.participation && (
                          <span className="chq-speaker-detail-other-event-participation">{e.participation}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* DEC-738 amendment (wave 71): the person's org-wide logistics
                  facts -- the SAME customFields record the Contacts drawer
                  edits, not an event-scoped copy, and no promise of travel
                  booking. */}
              <section className="chq-section chq-speaker-detail-logistics">
                <div className="chq-section-head">
                  <span className="chq-section-label">Logistics &middot; org-wide</span>
                  {!editingLogistics && (
                    <button type="button" className="chq-link-button" onClick={startEditLogistics}>
                      Edit
                    </button>
                  )}
                </div>
                {editingLogistics ? (
                  <div className="chq-speaker-detail-logistics-form">
                    {(
                      [
                        ['dietary', RESERVED_CUSTOM_FIELD_KEYS.dietary],
                        ['travel', RESERVED_CUSTOM_FIELD_KEYS.travel],
                        ['accessibility', RESERVED_CUSTOM_FIELD_KEYS.accessibility],
                      ] as const
                    ).map(([draftKey, reservedKey]) => (
                      <label key={reservedKey} className="chq-speaker-detail-logistics-field">
                        <span className="chq-section-label">{RESERVED_CUSTOM_FIELD_LABELS[reservedKey]}</span>
                        <textarea
                          className="chq-textarea"
                          maxLength={MAX_TEXT_LENGTH}
                          value={logisticsDraft[draftKey]}
                          onChange={(e) => setLogisticsDraft({ ...logisticsDraft, [draftKey]: e.target.value })}
                        />
                      </label>
                    ))}
                    <div className="chq-speaker-detail-logistics-actions">
                      <button type="button" className="chq-btn chq-btn-primary" onClick={saveLogistics} disabled={savingLogistics}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-tertiary"
                        onClick={() => setEditingLogistics(false)}
                        disabled={savingLogistics}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="chq-speaker-detail-logistics-body">
                    {(
                      [RESERVED_CUSTOM_FIELD_KEYS.dietary, RESERVED_CUSTOM_FIELD_KEYS.travel, RESERVED_CUSTOM_FIELD_KEYS.accessibility] as const
                    ).map((key) => (
                      <div key={key} className="chq-speaker-detail-logistics-row">
                        <dt className="chq-meta">{RESERVED_CUSTOM_FIELD_LABELS[key]}</dt>
                        <dd>
                          {reservedValue(detail.contact.customFields, key) || <span className="chq-empty">Not set.</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
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
