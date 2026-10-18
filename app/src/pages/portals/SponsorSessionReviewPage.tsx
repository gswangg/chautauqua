// One sponsor session, reviewed (Portals frame, flow 5, "Sponsor session ·
// review a resubmission", /admin/speakers/sponsor-sessions/:sessionId).
// GET /events/:id/sponsor-sessions/:sessionId returns the session and its
// audit history. On a resubmission the last note the organizers sent is
// pinned above the submission so they can check it was addressed. The
// right panel is the sponsor's package (which slot this session holds,
// what else is used) and, while the session waits (status submitted), the
// three decisions; otherwise it states the decision already made.
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { useCachedGet } from '../../lib/useCachedRead';
import { PageSkeleton } from '../../components/PageSkeleton';
import { organizerCanDecide, slotLabel } from '../../../../src/domain/sponsors';
import {
  SLOT_STATUS_WORDS,
  historyLabel,
  historyWhen,
  isResubmission,
  slotMark,
  slotWords,
  submittedPhrase,
  zonedDay,
} from './sponsorCopy';
import { useSponsorDecisions } from './SponsorDecisionModals';
import type { AuditEventRow, Slot, SponsorSessionDetail, SponsorSessionReview } from './types';
import './sponsorships.css';

interface EventTimezone {
  timezone: string;
}

function BackLink() {
  return (
    <Link to="/speakers/sponsor-sessions" className="chq-link-button chq-queue-back">
      &lsaquo; Sponsor sessions
    </Link>
  );
}

function SpeakersValue({ session }: { session: SponsorSessionDetail }) {
  if (session.speakers.length === 0) return <>No speakers yet</>;
  const newNote = session.status === 'approved' ? '(new — invited)' : '(new — invited on approval)';
  return (
    <>
      {session.speakers.map((sp, i) => (
        <span key={sp.id}>
          {i > 0 ? ' · ' : null}
          {sp.name}
          {sp.isNew ? <span className="chq-review-aside"> {newNote}</span> : null}
        </span>
      ))}
    </>
  );
}

function slotSub(slot: Slot, sessionId: string): string {
  if (!slot.session) return 'Not started';
  if (slot.session.id === sessionId) return slot.session.status === 'approved' ? 'This session · approved' : 'This session';
  return SLOT_STATUS_WORDS[slot.session.status];
}

/** "By Jordan Alvarez. " -- the organizer who made the last decision. */
function decidedBy(session: SponsorSessionDetail): string {
  return session.lastNoteBy ? `By ${session.lastNoteBy}. ` : '';
}

/** The decided state, in place of the actions. */
function DecidedState({ session, timeZone, now }: { session: SponsorSessionDetail; timeZone: string | null; now: number }) {
  const day = (ms: number | null) => (ms !== null && timeZone ? ` · ${zonedDay(ms, timeZone, now)}` : '');
  if (session.status === 'approved') {
    return (
      <div className="chq-review-decided">
        <span className="chq-review-decided-label">{`Approved${day(session.decidedAt)}`}</span>
        <span className="chq-review-decided-text">{`${decidedBy(session)}In the program as an accepted session.`}</span>
        {session.submissionId ? (
          <Link to={`/submissions/${session.submissionId}`} className="chq-link-button chq-review-decided-link">
            Open in Submissions
          </Link>
        ) : null}
      </div>
    );
  }
  if (session.status === 'declined') {
    return (
      <div className="chq-review-decided">
        <span className="chq-review-decided-label">{`Not accepted${day(session.decidedAt)}`}</span>
        {session.declineReason ? <span className="chq-review-decided-text">{`“${session.declineReason}”`}</span> : null}
        <span className="chq-review-decided-text">{`${decidedBy(session)}The slot went back to ${session.companyName}.`}</span>
      </div>
    );
  }
  if (session.status === 'changes_requested') {
    return (
      <div className="chq-review-decided">
        <span className="chq-review-decided-label">{`Changes requested${day(session.lastNoteAt)}`}</span>
        <span className="chq-review-decided-text">{`${decidedBy(session)}Waiting on ${session.companyName} to edit and resubmit.`}</span>
      </div>
    );
  }
  return (
    <div className="chq-review-decided">
      <span className="chq-review-decided-label">Withdrawn to edit</span>
      <span className="chq-review-decided-text">{`${session.companyName} took it back to draft. It returns here when they send it again.`}</span>
    </div>
  );
}

function HistoryRow({ row, pinnedNote, timeZone, now }: { row: AuditEventRow; pinnedNote: string | null; timeZone: string | null; now: number }) {
  const when = timeZone ? historyWhen(row.createdAt, timeZone, now) : '';
  const note = row.action === 'sponsor_session.request_changes' ? row.details.note : row.action === 'sponsor_session.decline' ? row.details.reason : null;
  const noteText = typeof note === 'string' && note !== '' ? note : null;
  const pinned = noteText !== null && noteText === pinnedNote;
  return (
    <li className="chq-review-history-row">
      <span className="chq-review-history-what">{historyLabel(row)}</span>
      <span className="chq-review-history-when">{pinned ? `${when} · note shown above` : when}</span>
      {noteText && !pinned ? <span className="chq-review-history-note">{`“${noteText}”`}</span> : null}
    </li>
  );
}

export function SponsorSessionReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { eventId, error: eventError } = useCurrentEvent();
  const reviewPath = useMemo(
    () => (eventId && sessionId ? `/events/${eventId}/sponsor-sessions/${sessionId}` : null),
    [eventId, sessionId],
  );
  const review = useCachedGet<SponsorSessionReview>(reviewPath, 'Could not load this session.');
  // the event's own timezone, for the history's and the decisions' dates
  const eventPath = useMemo(() => (eventId ? `/events/${eventId}` : null), [eventId]);
  const event = useCachedGet<EventTimezone>(eventPath, 'Could not load the event.');
  const decisions = useSponsorDecisions(() => navigate('/speakers/sponsor-sessions'));
  const now = Date.now();
  const tz = event.data?.timezone ?? null;

  if (!review.data) {
    return (
      <div className="chq-page chq-measure-wide chq-review-page">
        <div className="chq-queue-head">
          <BackLink />
        </div>
        {eventError || review.error ? (
          <>
            <h1 className="chq-page-title chq-queue-h1">Sponsor session</h1>
            <div className="chq-error" role="alert">
              {eventError ?? review.error}
            </div>
          </>
        ) : (
          <PageSkeleton variant="detail" label="Loading this session…" />
        )}
      </div>
    );
  }

  const { session, history } = review.data;
  const waiting = organizerCanDecide(session.status);
  const when = submittedPhrase(session, now);
  const meta = [session.companyName, session.tierName, slotWords(session), when].filter((x): x is string => Boolean(x)).join(' · ');
  // the note pinned above the submission: on a resubmission (did they
  // address it?) and while the sponsor still has it
  const pinNote = (isResubmission(session) || session.status === 'changes_requested') && session.lastNote ? session.lastNote : null;
  const newestFirst = [...history].reverse();

  return (
    <div className="chq-page chq-measure-wide chq-review-page">
      {decisions.toast ? (
        <div className="chq-toast" role="status">
          {decisions.toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={decisions.dismissToast} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
      <div className="chq-queue-head">
        <BackLink />
        <h1 className="chq-page-title chq-queue-h1">{session.title || 'Untitled session'}</h1>
        <span className="chq-queue-count">{meta}</span>
      </div>
      {decisions.error ? (
        <div className="chq-error" role="alert">
          {decisions.error}
        </div>
      ) : null}
      <div className="chq-review-layout">
        <div className="chq-review-main">
          {pinNote ? (
            <div className="chq-review-pinned">
              <span className="chq-review-pinned-label">
                {session.lastNoteAt !== null && tz ? `You asked · ${zonedDay(session.lastNoteAt, tz, now)}` : 'You asked'}
              </span>
              <span className="chq-review-pinned-note">{`“${pinNote}”`}</span>
            </div>
          ) : null}
          <section className="chq-review-section" aria-labelledby="review-submission">
            <div className="chq-section-head">
              <span className="chq-section-label" id="review-submission">
                Submission
              </span>
            </div>
            <dl className="chq-review-fields">
              <div className="chq-review-field">
                <dt>Title</dt>
                <dd>{session.title || 'No title yet'}</dd>
              </div>
              <div className="chq-review-field">
                <dt>Abstract</dt>
                <dd>{session.abstract ?? 'No abstract yet'}</dd>
              </div>
              <div className="chq-review-field">
                <dt>Format</dt>
                <dd>{slotLabel(session)}</dd>
              </div>
              <div className="chq-review-field">
                <dt>Speakers</dt>
                <dd>
                  <SpeakersValue session={session} />
                </dd>
              </div>
            </dl>
          </section>
        </div>
        <div className="chq-review-main chq-review-history-col">
          <section className="chq-review-section" aria-labelledby="review-history">
            <div className="chq-section-head">
              <span className="chq-section-label" id="review-history">
                History
              </span>
            </div>
            {newestFirst.length === 0 ? (
              <p className="chq-review-history-empty">Nothing recorded yet.</p>
            ) : (
              <ul className="chq-review-history">
                {newestFirst.map((row) => (
                  <HistoryRow key={row.id} row={row} pinnedNote={pinNote} timeZone={tz} now={now} />
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="chq-review-panel" aria-label={`${session.companyName} package`}>
          <span className="chq-review-panel-label">{session.tierName ? `${session.companyName} · ${session.tierName}` : session.companyName}</span>
          <ul className="chq-review-slots">
            {session.slots.map((slot, i) => {
              const mark = slotMark(slot);
              const mine = slot.session?.id === session.id;
              return (
                <li className="chq-review-slot" key={`${slot.entitlementId}-${i}`}>
                  <span className="chq-review-slot-text">
                    <span className="chq-review-slot-name">{slotLabel(slot)}</span>
                    <span className="chq-review-slot-sub">{slotSub(slot, session.id)}</span>
                  </span>
                  <span className={mine ? 'chq-review-slot-mark chq-review-slot-mark-mine' : 'chq-review-slot-mark'}>{mark}</span>
                </li>
              );
            })}
          </ul>
          {waiting ? (
            <div className="chq-review-actions">
              <button
                type="button"
                className="chq-btn chq-btn-primary"
                onClick={() => void decisions.approve(session)}
                disabled={decisions.approvingId !== null}
              >
                {decisions.approvingId === session.id ? 'Approving…' : 'Approve'}
              </button>
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                onClick={() => decisions.requestChanges(session)}
                disabled={decisions.approvingId !== null}
              >
                Request changes
              </button>
              <button
                type="button"
                className="chq-btn chq-btn-tertiary chq-queue-decline"
                onClick={() => decisions.decline(session)}
                disabled={decisions.approvingId !== null}
              >
                Decline
              </button>
            </div>
          ) : (
            <DecidedState session={session} timeZone={tz} now={now} />
          )}
        </aside>
      </div>
      {decisions.modals}
    </div>
  );
}
