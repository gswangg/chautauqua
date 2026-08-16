import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  BULK_EMAIL_MERGE_FIELDS,
  MAX_COMPOSE_RECIPIENTS as BULK_EMAIL_RECIPIENT_CAP,
  missingMergeFields,
} from '../../lib/merge-fields';
import { describeSendResult, type SendResult } from '../../lib/sendResult';
import { SendFailures } from '../../components/SendFailures';
import { countOf, plural } from '../../lib/plural';
import { DEC_793, DEC_856, DEC_967 } from '../../../../src/decisions';
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from '../../lib/text-caps';

void DEC_793;
void DEC_856;
void DEC_967;

// DEC-856 (wave 1 amendment): the bulk context only resolves
// BULK_EMAIL_MERGE_FIELDS (speaker_name/event_name/portal_link) -- a template
// with any other placeholder (e.g. {talk_title}) 400s on preview/send. This
// stub vars object exists only to probe presence via missingMergeFields; its
// values are never rendered.
const BULK_CONTEXT_VARS: Record<string, string> = Object.fromEntries(
  BULK_EMAIL_MERGE_FIELDS.map((f) => [f, '']),
);

function missingFieldsForTemplate(t: { subject: string; bodyText: string }): string[] {
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const f of [...missingMergeFields(t.subject, BULK_CONTEXT_VARS), ...missingMergeFields(t.bodyText, BULK_CONTEXT_VARS)]) {
    if (!seen.has(f)) {
      seen.add(f);
      combined.push(f);
    }
  }
  return combined;
}

interface Props {
  contactIds: string[];
  eventId: string | null;
  onClose: () => void;
  // Item 9 (frame 08-contacts--10): the frame heads the modal with the
  // recipients' actual names beneath the H1 ('Priya Raman, Marcus Okafor'),
  // not just a count -- callers already hold these (the directory table's
  // loaded rows, or the drawer's own contact), so this is threaded through
  // rather than a second contacts fetch by id.
  recipientNames: string[];
}

// A subtitle line of names is fine for a handful of recipients but unbounded
// for a large bulk selection -- cap it the same way a sentence would ("and N
// more") rather than letting the header wrap for pages.
const RECIPIENT_NAMES_SHOWN = 6;

function recipientNamesLine(names: string[]): string {
  if (names.length <= RECIPIENT_NAMES_SHOWN) return names.join(', ');
  const shown = names.slice(0, RECIPIENT_NAMES_SHOWN);
  const rest = names.length - shown.length;
  return `${shown.join(', ')} and ${countOf(rest, 'more')}`;
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

// DEC-856: modelled verbatim on the sibling splitter in ComposeWizard.tsx
// (extractMissingMergeFieldLines) -- the bulk-email routes' merge-field
// refusal (bulkEmailMergeFieldError) keys its fields map by the recipient's
// EMAIL with the value "<Name> is missing {token}[, {token}...]", already
// naming the person. Every OTHER fields-map entry (validateBulkEmailRequest's
// eventId/subject/bodyText 'required'/'Max <n>') is a per-control refusal
// that must be shown beside its own control, never dumped as an anonymous
// bullet.
function extractMissingMergeFieldLines(err: ApiError): string[] | null {
  if (!err.fields) return null;
  const lines: string[] = [];
  for (const message of Object.values(err.fields)) {
    if (/^(.+) is missing (\{.+)$/.test(message)) {
      lines.push(message);
    }
  }
  return lines.length > 0 ? lines : null;
}

// The complement of extractMissingMergeFieldLines: every fields-map entry
// that is NOT a merge-field refusal, keyed by its own field name so the
// caller can route subject/bodyText inline and render anything else as a
// labelled '<key>: <message>' line -- never an unlabelled bullet.
function extractFieldErrors(err: ApiError): Record<string, string> {
  const out: Record<string, string> = {};
  if (!err.fields) return out;
  for (const [key, message] of Object.entries(err.fields)) {
    if (/^(.+) is missing (\{.+)$/.test(message)) continue;
    out[key] = message;
  }
  return out;
}

export function BulkEmailModal({ contactIds, eventId, onClose, recipientNames }: Props) {
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('compose');
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  // DEC-856 (wave 60 amendment): keyed by email -> "Name is missing {token}"
  // -- the server's own vocabulary, never re-derived client-side.
  const [missingMergeFieldLines, setMissingMergeFieldLines] = useState<string[] | null>(null);
  // DEC-856 (wave 63 amendment): every fields-map entry that is NOT a
  // merge-field refusal (validateBulkEmailRequest's eventId/subject/bodyText
  // 'required'/'Max <n>'), keyed by field name -- fed to subject/bodyText's
  // own FormRow and any other key as a labelled line, never an anonymous
  // bullet.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // DEC-967: an email batch asks once before it leaves -- the terminal Send
  // opens this confirmation instead of posting directly.
  const [confirmingSend, setConfirmingSend] = useState(false);

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
    setMissingMergeFieldLines(null);
    setFieldErrors({});
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
      if (err instanceof ApiError) {
        setError(err.message);
        setMissingMergeFieldLines(extractMissingMergeFieldLines(err));
        setFieldErrors(extractFieldErrors(err));
      } else {
        setError('Preview failed');
      }
    } finally {
      setBusy(false);
    }
  }

  // DEC-967: fires only from the ConfirmDialog's onConfirm -- never called
  // directly from the Send button. Stays open (pending=busy) until the
  // request settles.
  async function confirmSend() {
    try {
      await send();
    } finally {
      setConfirmingSend(false);
    }
  }

  async function send() {
    if (!eventId) return;
    setBusy(true);
    setError(null);
    setMissingMergeFieldLines(null);
    setFieldErrors({});
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
      if (err instanceof ApiError) {
        setError(err.message);
        setMissingMergeFieldLines(extractMissingMergeFieldLines(err));
        setFieldErrors(extractFieldErrors(err));
      } else {
        setError('Bulk email failed');
      }
    } finally {
      setBusy(false);
    }
  }

  const title = `Email ${countOf(contactIds.length, 'contact')}`;
  // Item 9 (frame 08-contacts--10): the recipients' names sit beneath the
  // H1, in the modal sub -- the header states WHO, not just how many.
  const subtitle = recipientNames.length > 0 ? recipientNamesLine(recipientNames) : undefined;
  // DEC-967: names the resolved subject (merge fields applied), falling back
  // to the raw typed subject only when no preview row has rendered yet.
  const resolvedSendSubject = preview[0]?.subject ?? subject;

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
        {/* Item 9 (frame 08-contacts--10): the frame's footer primary reads
            'Send N emails' -- this dialog keeps the existing preview step as
            a genuine pre-flight (frame 08-contacts--02's "Pre-flight the
            irreversible" rule: an email send cannot be undone, and the
            preview is what catches an unresolved merge field before it
            goes out), so this button still opens the confirm step rather
            than sending directly. Its label now matches the frame's and the
            confirm dialog's own wording instead of "Send to N recipients". */}
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={busy}
          onClick={() => setConfirmingSend(true)}
        >
          Send {countOf(contactIds.length, 'email')}
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
      subtitle={subtitle}
      ariaLabel="Bulk email"
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-bulk-email-modal"
      actions={actions}
    >
      {error && (
        <div className="chq-error" role="alert">
          {error}
          {missingMergeFieldLines && missingMergeFieldLines.length > 0 && (
            <ul>
              {missingMergeFieldLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {Object.entries(fieldErrors).filter(([key]) => key !== 'subject' && key !== 'bodyText').length > 0 && (
            <ul>
              {Object.entries(fieldErrors)
                .filter(([key]) => key !== 'subject' && key !== 'bodyText')
                .map(([key, message]) => (
                  <li key={key}>{`${key}: ${message}`}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* Item 9 (frame 08-contacts--10): field order follows the frame --
          SUBJECT, MESSAGE, TEMPLATE (with its own unavailability sentence),
          then the merge-fields footnote -- replacing the old
          template-first / four-link-list layout. The recipient count moved
          into the header subtitle (recipient names) above; only the
          over-cap warning stays here, since it is a real blocker on this
          step's own action. */}
      {step === 'compose' && (
        <>
          {overCap && (
            <p className="chq-cap-warning" role="alert">
              Exceeds the {BULK_EMAIL_RECIPIENT_CAP}-recipient cap; narrow your selection to send.
            </p>
          )}
          <FormRow label="Subject" htmlFor="bulk-email-subject" error={fieldErrors.subject}>
            <input
              id="bulk-email-subject"
              className="chq-input"
              maxLength={MAX_TEXT_LENGTH}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="A quick question about your {event_name} session"
              aria-invalid={fieldErrors.subject ? true : undefined}
            />
          </FormRow>
          <FormRow label="Body" htmlFor="bulk-email-body" error={fieldErrors.bodyText}>
            <textarea
              id="bulk-email-body"
              className="chq-textarea"
              rows={8}
              maxLength={MAX_LONG_TEXT_LENGTH}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Hi {speaker_name}, ..."
              aria-invalid={fieldErrors.bodyText ? true : undefined}
            />
          </FormRow>
          {templates.length > 0 && (
            <FormRow label="Template" htmlFor="bulk-email-template" optional>
              <select
                id="bulk-email-template"
                className="chq-select"
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">No template — write it here</option>
                {templates.map((t) => {
                  const missing = missingFieldsForTemplate(t);
                  const blocked = missing.length > 0;
                  return (
                    <option key={t.id} value={t.id} disabled={blocked}>
                      {blocked ? `${t.name} — needs ${missing.map((f) => `{${f}}`).join(', ')}` : t.name}
                    </option>
                  );
                })}
              </select>
            </FormRow>
          )}
          {(() => {
            const unavailable = templates.filter((t) => missingFieldsForTemplate(t).length > 0);
            if (unavailable.length === 0) return null;
            // Ruling A19/item 9: the submission-scoped templates are named
            // as unavailable WITH the reason, in ONE sentence -- e.g.
            // "Acceptance, Decline and Schedule live need a submission, so
            // they are not available here — send those from Comms." Names
            // come from the templates themselves (event-defined, never
            // hardcoded). The four-item "Use in Comms compose" link list
            // this sentence used to sit above is gone -- the sentence
            // itself is the one A19 draws, and the disabled option already
            // names each template's blocking token individually.
            const names = unavailable.map((t) => t.name);
            const joined =
              names.length === 1
                ? names[0]
                : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
            const verb = plural(names.length, 'needs', 'need');
            const pronoun = plural(names.length, 'it is', 'they are');
            return (
              <p className="chq-bulk-email-unsendable-note">
                {joined} {verb} a submission, so {pronoun} not available here — send those from Comms.
              </p>
            );
          })()}
          <p className="chq-meta chq-bulk-email-merge-footnote">
            Sent one at a time · logged in Comms history · merge fields:{' '}
            {BULK_EMAIL_MERGE_FIELDS.map((f) => `{${f}}`).join(', ')}
          </p>
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
          <SendFailures failed={sendResult.failed ?? []} />
          <Link to="/comms?tab=history">View in Comms history</Link>
        </div>
      )}

      {confirmingSend && (
        <ConfirmDialog
          title="Send this email?"
          body={`${countOf(contactIds.length, 'recipient')} · ${resolvedSendSubject}`}
          confirmLabel={`Send ${countOf(contactIds.length, 'email')}`}
          cancelLabel="Cancel"
          pending={busy}
          onConfirm={confirmSend}
          onCancel={() => setConfirmingSend(false)}
        />
      )}
    </ModalFrame>
  );
}
