// SPEC §10 #3 (DEC-441): assisted chasing — a review dialog rendered from
// the server's preview endpoint (itself built from the same
// buildReminderMessage the real send uses), so the organizer sees exactly
// who gets emailed and what the first draft reads like before committing
// to the send. Reuses the ONE dialog contract (ModalFrame).

import { ModalFrame } from '../../components/ModalFrame';
import { DelayedLoading } from '../../components/DelayedLoading';
import { countOf } from '../../lib/plural';
import type { ReminderDraft } from './types';

interface RemindPreviewModalProps {
  loading: boolean;
  error: string | null;
  drafts: ReminderDraft[] | null;
  // DEC-441 amendment (DEC-829): the server's own skipped-recipient count
  // (dedupe window / declined-only exclusion), printed verbatim -- never
  // recomputed here, so this dialog can never claim a different number
  // than the send it previews actually performs.
  skipped: number;
  // DEC-441 amendment (w52-a): the server's batch-cap remainder (eligible
  // recipients past MAX_REMINDER_BATCH), printed verbatim in the same
  // sentence family sendResult.ts uses -- never recomputed here -- so the
  // review dialog names the part of the batch this send will NOT reach.
  remaining: number;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}

// DEC-829 amendment (w61-e): the modal's own emptiness, named -- an empty
// drafts array is never rendered as a bare <ul> plus a "0 recipients"
// subtitle (both were the B7 violation, chrome around nothing). Which
// sentence fires depends on WHY nothing's outstanding: skipped > 0 means
// real recipients exist but were deduped (reminded in the last hour);
// skipped === 0 means there was nothing to remind about in the first
// place.
function zeroStateMessage(skipped: number): string {
  if (skipped > 0) {
    return `Nobody to remind right now — ${countOf(skipped, 'contact')} reminded in the last hour.`;
  }
  return 'Nothing outstanding to remind about.';
}

export function RemindPreviewModal({ loading, error, drafts, skipped, remaining, sending, onSend, onCancel }: RemindPreviewModalProps) {
  // DEC-829 amendment: the recipient count IS the server's drafts array
  // length -- one draft per recipient the send will actually reach -- never
  // a separately recomputed figure.
  const count = drafts?.length ?? 0;
  const first = drafts && drafts.length > 0 ? drafts[0]! : null;
  const isZeroState = !loading && !!drafts && count === 0;

  return (
    <ModalFrame
      title="Review reminders"
      subtitle={loading ? 'Loading...' : isZeroState ? undefined : countOf(count, 'recipient')}
      onClose={onCancel}
      closeDisabled={sending}
      modalClassName="chq-speakers-modal"
      actions={
        <>
          <button type="button" className="chq-btn chq-btn-primary" onClick={onSend} disabled={loading || sending || count === 0}>
            {sending ? 'Sending...' : `Send ${countOf(count, 'reminder')}`}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={sending}>
            Cancel
          </button>
        </>
      }
    >
      {loading && <DelayedLoading />}
      {error && <div className="chq-error">{error}</div>}

      {!loading && !error && drafts && isZeroState && (
        <>
          <p className="chq-speakers-remind-empty">{zeroStateMessage(skipped)}</p>
          {remaining > 0 && (
            <div className="chq-speakers-remind-remaining">{countOf(remaining, 'contact')} still outstanding &mdash; run it again to continue.</div>
          )}
        </>
      )}

      {!loading && !error && drafts && !isZeroState && (
        <>
          {skipped > 0 && (
            <div className="chq-speakers-remind-skipped">{countOf(skipped, 'contact')} skipped &mdash; reminded in the last hour</div>
          )}
          {remaining > 0 && (
            <div className="chq-speakers-remind-remaining">{countOf(remaining, 'contact')} still outstanding &mdash; run it again to continue.</div>
          )}
          <ul className="chq-speakers-remind-recipients">
            {drafts.map((d) => (
              <li key={d.contactId}>
                {d.name} &middot; {d.email}
              </li>
            ))}
          </ul>

          {first && (
            <div className="chq-speakers-remind-draft">
              {/* User-filed (release night): the single draft read as a
                  shared superset message. It is one PERSONALIZED draft per
                  contact (buildReminderMessage renders each recipient's own
                  assignment list) -- say so, and name whose draft this is. */}
              <div className="chq-speakers-modal-label">Draft for {first.name} &mdash; {first.subject}</div>
              <pre className="chq-speakers-remind-draft-text">{first.text}</pre>
              <div className="chq-speakers-remind-draft-note">
                Each speaker gets their own message listing only their outstanding tasks.
              </div>
            </div>
          )}
        </>
      )}
    </ModalFrame>
  );
}
