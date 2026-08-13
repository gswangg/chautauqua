import { useEffect, useState, type ReactNode } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { BULK_EMAIL_MERGE_FIELDS, MAX_COMPOSE_RECIPIENTS as BULK_EMAIL_RECIPIENT_CAP } from '../../lib/merge-fields';
import { describeSendResult, type SendResult } from '../../lib/sendResult';
import { countOf } from '../../lib/plural';
import { DEC_793 } from '../../../../src/decisions';

void DEC_793;

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
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

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
      const res = await apiPost<SendResult>('/contacts/bulk-email', {
        contactIds,
        eventId,
        subject,
        bodyText,
      });
      setSendResult(res);
      setStep('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk email failed');
    } finally {
      setBusy(false);
    }
  }

  const title = `Email ${countOf(contactIds.length, 'contact')}`;

  let actions: ReactNode = null;
  if (step === 'compose') {
    actions = (
      <>
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={busy || overCap || contactIds.length === 0 || subject.trim() === '' || bodyText.trim() === ''}
          onClick={goToPreview}
        >
          Preview
        </button>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </>
    );
  } else if (step === 'preview') {
    actions = (
      <>
        <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={send}>
          Send to {countOf(contactIds.length, 'recipient')}
        </button>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('compose')} disabled={busy}>
          Back to edit
        </button>
      </>
    );
  } else if (step === 'sent' && sendResult !== null) {
    actions = (
      <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
        Done
      </button>
    );
  }

  return (
    <ModalFrame
      title={title}
      ariaLabel="Bulk email"
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-bulk-email-modal"
      actions={actions}
    >
      {error && <div className="chq-error">{error}</div>}

      {step === 'compose' && (
        <>
          <p>
            {countOf(contactIds.length, 'recipient')} selected
            {overCap && (
              <strong className="chq-cap-warning">
                {' '}
                — exceeds the {BULK_EMAIL_RECIPIENT_CAP}-recipient cap; narrow your selection to send.
              </strong>
            )}
          </p>
          {templates.length > 0 && (
            <FormRow label="Template" htmlFor="bulk-email-template" optional>
              <select
                id="bulk-email-template"
                className="chq-select"
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">Custom (no template)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormRow>
          )}
          <FormRow label="Subject" htmlFor="bulk-email-subject">
            <input
              id="bulk-email-subject"
              className="chq-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="A quick question about your {event_name} session"
            />
          </FormRow>
          <FormRow
            label="Body"
            htmlFor="bulk-email-body"
            help={
              <>
                Sent one at a time · logged in Comms history · merge fields:{' '}
                {BULK_EMAIL_MERGE_FIELDS.map((f) => `{${f}}`).join(', ')}
              </>
            }
          >
            <textarea
              id="bulk-email-body"
              className="chq-textarea"
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Hi {speaker_name}, ..."
            />
          </FormRow>
        </>
      )}

      {step === 'preview' && (
        <>
          <p>
            Previewing {preview.length} of {countOf(contactIds.length, 'recipient')} with
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
        </>
      )}

      {step === 'sent' && sendResult && (
        <div className="chq-bulk-email-result">
          <p>{describeSendResult(sendResult, { one: 'email', many: 'emails' })}</p>
          {sendResult.failed && sendResult.failed.length > 0 && (
            <ul>
              {sendResult.failed.map((f) => (
                <li key={f.email}>{f.email}</li>
              ))}
            </ul>
          )}
          <a href="/admin/comms?tab=history">View in Comms history</a>
        </div>
      )}
    </ModalFrame>
  );
}
