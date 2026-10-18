// The sponsor-session approval queue (Portals frame, flow 5, /admin/
// speakers/sponsor-sessions): sessions sponsors designed on their package
// and sent for review. GET /events/:id/sponsor-sessions groups them:
// waiting (oldest first, decided inline: Approve / Request changes /
// Decline), back with the sponsor (changes requested, or withdrawn to
// edit -- a group the frame doesn't draw, so a request the organizer sent
// doesn't vanish from the page), and decided (newest first).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { useCachedGet } from '../../lib/useCachedRead';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { capitalizeFirst } from '../../lib/plural';
import { slotWords, speakerList, submittedPhrase, zonedDay } from './sponsorCopy';
import { useSponsorDecisions } from './SponsorDecisionModals';
import type { SponsorSessionDetail, SponsorSessionQueue } from './types';
import './sponsorships.css';

interface EventTimezone {
  timezone: string;
}

function sessionTitle(session: SponsorSessionDetail): string {
  return session.title || 'Untitled session';
}

function QueueIdentity({ session }: { session: SponsorSessionDetail }) {
  return (
    <span className="chq-queue-cell">
      <span className="chq-queue-strong">{session.tierName ? `${session.companyName} · ${session.tierName}` : session.companyName}</span>
      <span className="chq-queue-meta">{slotWords(session)}</span>
    </span>
  );
}

function QueueSession({ session, now, showSubmitted }: { session: SponsorSessionDetail; now: number; showSubmitted: boolean }) {
  const when = showSubmitted ? submittedPhrase(session, now) : '';
  return (
    <span className="chq-queue-cell">
      <Link to={`/speakers/sponsor-sessions/${session.id}`} className="chq-link-button chq-queue-title">
        {sessionTitle(session)}
      </Link>
      <span className="chq-queue-meta">{when ? `${speakerList(session.speakers)} · ${when}` : speakerList(session.speakers)}</span>
    </span>
  );
}

/** The right-hand state of a row that isn't waiting on the organizers. */
function stateLabel(session: SponsorSessionDetail, timeZone: string | null, now: number): string {
  const day = (ms: number | null) => (ms !== null && timeZone ? ` ${zonedDay(ms, timeZone, now)}` : '');
  switch (session.status) {
    case 'approved':
      return `Approved${day(session.decidedAt)}`;
    case 'declined':
      return `Not accepted${day(session.decidedAt)}`;
    case 'changes_requested':
      return `Changes requested${day(session.lastNoteAt)}`;
    case 'draft':
      return 'Withdrawn to edit';
    default:
      return capitalizeFirst(session.status);
  }
}

export function SponsorSessionsPage() {
  const { eventId, error: eventError } = useCurrentEvent();
  const queuePath = useMemo(() => (eventId ? `/events/${eventId}/sponsor-sessions` : null), [eventId]);
  const queue = useCachedGet<SponsorSessionQueue>(queuePath, 'Could not load sponsor sessions.');
  // the event's own timezone, for the decided dates
  const eventPath = useMemo(() => (eventId ? `/events/${eventId}` : null), [eventId]);
  const event = useCachedGet<EventTimezone>(eventPath, 'Could not load the event.');
  // "Back to the queue" from the Approved receipt: this is the queue
  const decisions = useSponsorDecisions(() => undefined);
  const now = Date.now();
  const tz = event.data?.timezone ?? null;
  const data = queue.data;
  const nothingAtAll = data && data.waiting.length === 0 && data.withSponsor.length === 0 && data.decided.length === 0;

  return (
    <div className="chq-page chq-measure-table">
      {decisions.toast ? (
        <div className="chq-toast" role="status">
          {decisions.toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={decisions.dismissToast} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
      <div className="chq-queue-head">
        <Link to="/speakers" className="chq-link-button chq-queue-back">
          &lsaquo; Speakers
        </Link>
        <div className="chq-queue-titles">
          <h1 className="chq-page-title chq-queue-h1">Sponsor sessions</h1>
          {data ? <span className="chq-queue-count">{`${data.waiting.length} waiting`}</span> : null}
        </div>
      </div>
      {eventError || (queue.error && !data) ? (
        <div className="chq-error" role="alert">
          {eventError ?? queue.error}
        </div>
      ) : null}
      {decisions.error ? (
        <div className="chq-error" role="alert">
          {decisions.error}
        </div>
      ) : null}
      {!data && !queue.error && !eventError ? <PageSkeleton variant="list" label="Loading sponsor sessions…" /> : null}
      {nothingAtAll ? (
        <EmptyState
          variant="fresh"
          what="No sponsor sessions yet"
          reason="When a sponsor contact sends a session they designed on their package, it waits here for your approval."
          secondary={{ label: 'Sponsorships', to: '/settings/sponsorships' }}
        />
      ) : null}
      {data && !nothingAtAll ? (
        <>
          <section className="chq-queue-section" aria-labelledby="queue-waiting">
            <div className="chq-section-head">
              <span className="chq-section-label" id="queue-waiting">{`Waiting · ${data.waiting.length}`}</span>
            </div>
            {data.waiting.length === 0 ? (
              <EmptyState variant="fresh" what="Nothing waiting for approval" reason="When a sponsor sends a session for review, it waits here." />
            ) : (
              <ul className="chq-queue-list">
                {data.waiting.map((session) => {
                  const approving = decisions.approvingId === session.id;
                  return (
                    <li className="chq-queue-row" key={session.id}>
                      <QueueIdentity session={session} />
                      <QueueSession session={session} now={now} showSubmitted />
                      <span className="chq-queue-actions">
                        <button
                          type="button"
                          className="chq-btn chq-btn-primary"
                          onClick={() => void decisions.approve(session)}
                          disabled={decisions.approvingId !== null}
                          aria-label={`Approve ${sessionTitle(session)}`}
                        >
                          {approving ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="chq-btn chq-btn-secondary"
                          onClick={() => decisions.requestChanges(session)}
                          disabled={decisions.approvingId !== null}
                          aria-label={`Request changes to ${sessionTitle(session)}`}
                        >
                          Request changes
                        </button>
                        <button
                          type="button"
                          className="chq-btn chq-btn-tertiary chq-queue-decline"
                          onClick={() => decisions.decline(session)}
                          disabled={decisions.approvingId !== null}
                          aria-label={`Decline ${sessionTitle(session)}`}
                        >
                          Decline
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {data.withSponsor.length > 0 ? (
            <section className="chq-queue-section" aria-labelledby="queue-with-sponsor">
              <div className="chq-section-head">
                <span className="chq-section-label" id="queue-with-sponsor">{`With the sponsor · ${data.withSponsor.length}`}</span>
              </div>
              <ul className="chq-queue-list">
                {data.withSponsor.map((session) => (
                  <li className="chq-queue-row" key={session.id}>
                    <QueueIdentity session={session} />
                    <QueueSession session={session} now={now} showSubmitted={false} />
                    <span className="chq-queue-state">{stateLabel(session, tz, now)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.decided.length > 0 ? (
            <section className="chq-queue-section" aria-labelledby="queue-decided">
              <div className="chq-section-head">
                <span className="chq-section-label" id="queue-decided">
                  Decided
                </span>
              </div>
              <ul className="chq-queue-list">
                {data.decided.map((session) => (
                  <li className="chq-queue-row" key={session.id}>
                    <QueueIdentity session={session} />
                    <QueueSession session={session} now={now} showSubmitted={false} />
                    <span className="chq-queue-state">{stateLabel(session, tz, now)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      {decisions.modals}
    </div>
  );
}
