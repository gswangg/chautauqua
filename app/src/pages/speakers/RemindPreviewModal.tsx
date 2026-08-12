// SPEC §10 #3 (DEC-441): assisted chasing — a review dialog rendered from
// the server's preview endpoint (itself built from the same
// buildReminderMessage the real send uses), so the organizer sees exactly
// who gets emailed and what the first draft reads like before committing
// to the send. Reuses the ONE dialog contract (ResponseModal/TaskModal).

import type { MouseEvent } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';
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
  useEscapeKey(true, onCancel);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !sending) onCancel();
  }

  const count = drafts?.length ?? 0;
  const first = drafts && drafts.length > 0 ? drafts[0]! : null;

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Review reminders" onClick={handleScrimClick}>
      <div className="chq-modal chq-speakers-modal">
        <div className="chq-speakers-modal-head">
          <div className="chq-speakers-modal-head-titles">
            <h2 className="chq-speakers-modal-title">Review reminders</h2>
            <span className="chq-summary">{loading ? 'Loading...' : `${count} recipient${count === 1 ? '' : 's'}`}</span>
          </div>
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={onCancel} disabled={sending}>
            Close
          </button>
        </div>

        {loading && <p>Loading...</p>}
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

        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-primary" onClick={onSend} disabled={loading || sending || count === 0}>
            {sending ? 'Sending...' : `Send ${count} reminder${count === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={sending}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
