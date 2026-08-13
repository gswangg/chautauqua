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
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}

export function RemindPreviewModal({ loading, error, drafts, sending, onSend, onCancel }: RemindPreviewModalProps) {
  const count = drafts?.length ?? 0;
  const first = drafts && drafts.length > 0 ? drafts[0]! : null;

  return (
    <ModalFrame
      title="Review reminders"
      subtitle={loading ? 'Loading...' : countOf(count, 'recipient')}
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

      {!loading && !error && drafts && (
        <>
          <ul className="chq-speakers-remind-recipients">
            {drafts.map((d) => (
              <li key={d.contactId}>
                {d.name} &middot; {d.email}
              </li>
            ))}
          </ul>

          {first && (
            <div className="chq-speakers-remind-draft">
              <div className="chq-speakers-modal-label">Draft &mdash; {first.subject}</div>
              <pre className="chq-speakers-remind-draft-text">{first.text}</pre>
            </div>
          )}
        </>
      )}
    </ModalFrame>
  );
}
