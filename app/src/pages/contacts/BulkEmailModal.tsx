import { useEffect, useState } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { BULK_EMAIL_MERGE_FIELDS, BULK_EMAIL_RECIPIENT_CAP } from './types';

interface Props {
  contactIds: string[];
  eventId: string | null;
  onClose: () => void;
}

interface EmailTemplate {
  id: string;
  eventId: string;
  name: string;
  subject: string;
  bodyText: string;
}

interface PreviewItem {
  contactId: string;
  email: string;
  subject: string;
  bodyText: string;
}

type Step = 'compose' | 'preview' | 'sent';

export function BulkEmailModal({ contactIds, eventId, onClose }: Props) {
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('compose');
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [sent, setSent] = useState<number | null>(null);

  const overCap = contactIds.length > BULK_EMAIL_RECIPIENT_CAP;

  useEffect(() => {
    if (!eventId) return;
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => setTemplates(res.items))
      .catch(() => {
        // Template picker is a convenience; failing to load it shouldn't
        // block composing a bulk email by hand.
      });
  }, [eventId]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === '') return;
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBodyText(tpl.bodyText);
    }
  }

  async function goToPreview() {
    if (!eventId) {
      setError('No event selected — bulk email requires an event context for {event_name}/{portal_link}.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ items: PreviewItem[] }>('/contacts/bulk-email/preview', {
        contactIds,
        eventId,
        subject,
        bodyText,
      });
      setPreview(res.items);
      setStep('preview');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!eventId) return;
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
      setStep('sent');
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

        {step === 'compose' && (
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
            {templates.length > 0 && (
              <label>
                Template
                <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">Custom (no template)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
              onClick={goToPreview}
            >
              Preview
            </button>
          </>
        )}

        {step === 'preview' && (
          <>
            <p>
              Previewing {preview.length} of {contactIds.length} recipient{contactIds.length === 1 ? '' : 's'} with
              merge fields resolved.
            </p>
            <ul className="chq-bulk-email-preview-list">
              {preview.map((item) => (
                <li key={item.contactId} className="chq-bulk-email-preview-item">
                  <div className="chq-bulk-email-preview-to">{item.email}</div>
                  <div className="chq-bulk-email-preview-subject">{item.subject}</div>
                  <pre className="chq-bulk-email-preview-body">{item.bodyText}</pre>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setStep('compose')} disabled={busy}>
              Back to edit
            </button>
            <button type="button" disabled={busy} onClick={send}>
              Send to {contactIds.length} recipient{contactIds.length === 1 ? '' : 's'}
            </button>
          </>
        )}

        {step === 'sent' && sent !== null && (
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
