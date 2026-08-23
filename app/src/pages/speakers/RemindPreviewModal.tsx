// SPEC §10 #3 (DEC-441): assisted chasing — a review dialog rendered from
// the server's preview endpoint (itself built from the same
// buildReminderMessage the real send uses), so the organizer sees exactly
// who gets emailed and what the first draft reads like before committing
// to the send. Reuses the ONE dialog contract (ModalFrame).

import { ModalFrame } from '../../components/ModalFrame';
import { DelayedLoading } from '../../components/DelayedLoading';
import { countOf } from '../../lib/plural';
import type { ReminderDraft } from './types';
import { OVERDUE_LABEL } from './TaskCell';
import { REMIND_SKIP_RULE } from './remindSkipVocabulary';
import { DEC_441 } from '../../../../src/decisions';

void DEC_441;

// DEC-613: derived from the ONE skip-rule phrase remindSkipVocabulary.ts
// owns (REMIND_SKIP_RULE) rather than retyping its trailing clause as a
// fifth copy of the same sentence fragment.
const REMINDED_IN_LAST_HOUR = REMIND_SKIP_RULE.replace(/^skips anyone /, '');

/** DEC-441 wave-110 amendment: the row's right-flushed flag is the SAME
 * OVERDUE vocabulary the grid/detail page use (TaskCell.tsx) -- never a
 * third phrasing. A recipient's row flags OVERDUE the moment any one of
 * their outstanding tasks is overdue; a due-soon-but-not-overdue recipient
 * carries no flag (no "due soon" vocabulary exists anywhere else in the
 * app to reuse, and DEC-441 forbids inventing one). */
function firstNameOf(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

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
      // v12 frame `Chautauqua Speakers.dc.html`:491
      // (`<span style="font-family:'Familjen Grotesk', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Review these reminders</span>`)
      title="Review these reminders"
      subtitle={
        loading
          ? 'Loading...'
          : isZeroState
            ? undefined
            : skipped === 0
              ? `${countOf(count, 'speaker')} · nothing has been sent yet`
              : `${countOf(count, 'speaker')} · ${countOf(skipped, 'contact')} skipped — ${REMINDED_IN_LAST_HOUR}`
      }
      onClose={onCancel}
      closeDisabled={sending}
      modalClassName="chq-speakers-modal"
      actions={
        <>
          <button type="button" className="chq-btn chq-btn-primary" onClick={onSend} disabled={loading || sending || count === 0}>
            {/* v12 frame :549 (`<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Send these 3</span>`) */}
            {sending ? 'Sending...' : `Send these ${count}`}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={sending}>
            Cancel
          </button>
          {/* v12 frame :540 (`<span style="font-size:12px; color:#565A4B; line-height:1.5">Logged in Comms history</span>`) */}
          {!isZeroState && <span className="chq-speakers-remind-logged">Logged in Comms history</span>}
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
          {/* v12 frame :504-513: per-recipient row -- name over that
              person's outstanding task names, overdue flag right-flushed. */}
          <ul className="chq-speakers-remind-recipients">
            {drafts.map((d) => {
              const overdue = d.tasks.some((t) => t.overdue);
              return (
                <li key={d.contactId} className="chq-speakers-remind-recipient">
                  <div className="chq-speakers-remind-recipient-info">
                    <span className="chq-speakers-remind-recipient-name">{d.name}</span>
                    <span className="chq-speakers-remind-recipient-tasks">
                      {d.tasks.map((t) => t.title).join(', ')}
                    </span>
                  </div>
                  {overdue && <span className="chq-speakers-remind-flag">{OVERDUE_LABEL}</span>}
                </li>
              );
            })}
          </ul>

          {first && (
            <div className="chq-speakers-remind-draft">
              {/* v12 frame :517 (`What Marcus will read` eyebrow). */}
              <div className="chq-speakers-modal-label">What {firstNameOf(first.name)} will read</div>
              {/* v12 frame :518-530: inset #E9E7E2 band holding the
                  #F4F1E8 email card -- nearest palette tokens (surface-sunk
                  / paper), the closure scan forbids a new hex literal. */}
              <div className="chq-speakers-remind-card-band">
                <div className="chq-speakers-remind-card">
                  {/* v12 frame :523-524: subject header band with a bottom
                      rule -- DEC-441 (wave-7 amendment): NOT the frame's
                      event-letterhead block (no such data exists on a send),
                      the subject is the honest header instead. */}
                  <div className="chq-speakers-remind-card-header">
                    <span className="chq-speakers-remind-card-subject">{first.subject}</span>
                  </div>
                  <span className="chq-speakers-remind-card-greeting">{first.parts.greeting}</span>
                  <span className="chq-speakers-remind-card-nudge">{first.parts.nudge}</span>
                  {/* v12 frame :525-528: left-ruled "Still to do" block. */}
                  <div className="chq-speakers-remind-card-todo">
                    <span className="chq-speakers-remind-card-todo-eyebrow">Still to do</span>
                    <span className="chq-speakers-remind-card-todo-lines">{first.parts.stillToDoRun}</span>
                  </div>
                  <a
                    className="chq-speakers-remind-card-cta"
                    href={first.parts.portalLine}
                  >
                    Open your tasks
                  </a>
                  <span className="chq-speakers-remind-card-paste">
                    Or paste this into your browser: {first.parts.portalLine}
                  </span>
                  {/* v12 frame :531 ("— Jordan Alvarez, DevFlow Conf",
                      font-size:15px; line-height:1.6; color:#3F4237). */}
                  <span className="chq-speakers-remind-card-signature">{first.parts.signature}</span>
                </div>
              </div>
              {/* v12 frame :533 caption, verbatim. */}
              <div className="chq-speakers-remind-draft-note">
                Each speaker's list is their own &middot; the body is built from their outstanding tasks, not typed
              </div>
            </div>
          )}
        </>
      )}
    </ModalFrame>
  );
}
