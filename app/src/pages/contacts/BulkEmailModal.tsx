import { useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { BULK_EMAIL_MERGE_FIELDS, BULK_EMAIL_RECIPIENT_CAP } from './types';

interface Props {
  contactIds: string[];
  eventId: string | null;
  onClose: () => void;
}

export function BulkEmailModal({ contactIds, eventId, onClose }: Props) {
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const overCap = contactIds.length > BULK_EMAIL_RECIPIENT_CAP;

  async function send() {
    if (!eventId) {
      setError('No event selected — bulk email requires an event context for {event_name}/{portal_link}.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ sent: number }>('/contacts/bulk-email', {
        contactIds,
        eventId,
        subject,
        bodyText,
      });
      setSent(res.sent);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk email failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chq-modal-backdrop" role="dialog" aria-label="Bulk email">
      <div className="chq-modal chq-bulk-email-modal">
        <button type="button" className="chq-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Bulk email</h2>

        {error && <div className="chq-error-banner">{error}</div>}

        {sent === null && (
          <>
            <p>
              {contactIds.length} recipient{contactIds.length === 1 ? '' : 's'} selected
              {overCap && (
                <strong className="chq-cap-warning">
                  {' '}
                  — exceeds the {BULK_EMAIL_RECIPIENT_CAP}-recipient cap; narrow your selection to send.
                </strong>
              )}
            </p>
            <label>
              Subject
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label>
              Body
              <textarea rows={8} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
            </label>
            <p className="chq-merge-field-hint">
              Available merge fields: {BULK_EMAIL_MERGE_FIELDS.map((f) => `{${f}}`).join(', ')}
            </p>
            <button
              type="button"
              disabled={busy || overCap || contactIds.length === 0 || subject.trim() === '' || bodyText.trim() === ''}
              onClick={send}
            >
              Send to {contactIds.length} recipient{contactIds.length === 1 ? '' : 's'}
            </button>
          </>
        )}

        {sent !== null && (
          <div className="chq-bulk-email-result">
            <p>Sent {sent} email{sent === 1 ? '' : 's'}.</p>
            <a href="/admin/comms">View in Comms history</a>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
