import { useEffect, useState } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { buildSubmissionsQuery } from '../submissions/filters';
import { DEFAULT_FILTER_STATE, STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionListItem, type SubmissionStatus } from '../submissions/types';
import { PreviewPane } from './PreviewPane';
import type { EmailTemplate, RenderedRecipient } from './types';

// J5's decide != notify: the picker defaults to the two decided statuses so
// organizers compose against the submissions they've already ruled on, but
// any status can be selected (this is a filter, not a hard restriction).
const DECIDED_STATUSES: SubmissionStatus[] = ['accepted', 'declined'];

type Step = 'select' | 'template' | 'preview' | 'sent';

export function ComposeWizard({ eventId }: { eventId: string }) {
  const [step, setStep] = useState<Step>('select');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus[]>(DECIDED_STATUSES);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [includeFeedback, setIncludeFeedback] = useState(false);
  const [attachIcs, setAttachIcs] = useState(false);

  const [preview, setPreview] = useState<RenderedRecipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capMessage, setCapMessage] = useState<string | null>(null);
  // DEC-051: submission ids the server rejected as "not scheduled" when
  // attachIcs was requested. Surfaced literally next to the toggle — never
  // pre-filtered client-side, since that would hide the server's contract.
  const [icsUnscheduledIds, setIcsUnscheduledIds] = useState<string[] | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    setLoadingSubmissions(true);
    setError(null);
    const qs = buildSubmissionsQuery({ ...DEFAULT_FILTER_STATE, status: statusFilter, perPage: 200 });
    apiList<SubmissionListItem>(`/events/${eventId}/submissions${qs}`)
      .then((res) => setSubmissions(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => setLoadingSubmissions(false));
  }, [eventId, statusFilter]);

  useEffect(() => {
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => setTemplates(res.items))
      .catch(() => undefined);
  }, [eventId]);

  function toggleStatus(status: SubmissionStatus) {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  }

  function toggleSubmission(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function composeBody(): Record<string, unknown> {
    const base: Record<string, unknown> = {
      submissionIds: [...selectedIds],
      includeFeedback,
      attachIcs,
    };
    if (templateId) {
      base.templateId = templateId;
    } else {
      base.subject = subject;
      base.bodyText = bodyText;
    }
    return base;
  }

  // DEC-051: pulls the { <submissionId>: 'not scheduled' } field errors out
  // of an ApiError so they can be listed next to the toggle, verbatim —
  // no client-side guessing at which submissions are unscheduled.
  function extractIcsUnscheduledIds(err: ApiError): string[] | null {
    if (!err.fields) return null;
    const ids = Object.entries(err.fields)
      .filter(([, message]) => message === 'not scheduled')
      .map(([submissionId]) => submissionId);
    return ids.length > 0 ? ids : null;
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    setCapMessage(null);
    setIcsUnscheduledIds(null);
    try {
      const res = await apiPost<{ items: RenderedRecipient[] }>(`/events/${eventId}/compose/preview`, composeBody());
      setPreview(res.items);
      setStep('preview');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid') {
        const unscheduled = extractIcsUnscheduledIds(err);
        if (unscheduled) {
          setIcsUnscheduledIds(unscheduled);
        } else if (/exceeds the .*-recipient cap/i.test(err.message)) {
          setCapMessage(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to render preview');
      }
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    setIcsUnscheduledIds(null);
    try {
      const res = await apiPost<{ sent: number }>(`/events/${eventId}/compose/send`, composeBody());
      setSentCount(res.sent);
      setStep('sent');
    } catch (err) {
      if (err instanceof ApiError) {
        const unscheduled = extractIcsUnscheduledIds(err);
        if (unscheduled) {
          setIcsUnscheduledIds(unscheduled);
        } else {
          setError(err.message);
        }
      } else {
        setError('Send failed');
      }
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep('select');
    setSelectedIds(new Set());
    setTemplateId('');
    setSubject('');
    setBodyText('');
    setAttachIcs(false);
    setPreview([]);
    setSentCount(null);
    setCapMessage(null);
    setIcsUnscheduledIds(null);
    setError(null);
  }

  return (
    <div className="chq-compose-wizard">
      {error && <div className="chq-error-banner">{error}</div>}
      {capMessage && (
        <div className="chq-error-banner" role="alert">
          {capMessage} Narrow your submission selection to 100 or fewer recipients and try again.
        </div>
      )}

      {step === 'select' && (
        <section>
          <h2>1. Pick submissions</h2>
          <div className="chq-status-filter">
            {SUBMISSION_STATUSES.map((status) => (
              <label key={status}>
                <input type="checkbox" checked={statusFilter.includes(status)} onChange={() => toggleStatus(status)} />
                {STATUS_LABELS[status]}
              </label>
            ))}
          </div>

          {loadingSubmissions && <p>Loading submissions...</p>}
          <table className="chq-compose-submissions-table">
            <thead>
              <tr>
                <th />
                <th>Title</th>
                <th>Speakers</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSubmission(s.id)}
                      aria-label={`Select ${s.title}`}
                    />
                  </td>
                  <td>{s.title}</td>
                  <td>{s.speakers.map((sp) => sp.name).join(', ')}</td>
                  <td>{STATUS_LABELS[s.status]}</td>
                </tr>
              ))}
              {!loadingSubmissions && submissions.length === 0 && (
                <tr>
                  <td colSpan={4}>No submissions match the selected statuses.</td>
                </tr>
              )}
            </tbody>
          </table>

          <button type="button" disabled={selectedIds.size === 0} onClick={() => setStep('template')}>
            Next: choose template ({selectedIds.size} submission{selectedIds.size === 1 ? '' : 's'} selected)
          </button>
        </section>
      )}

      {step === 'template' && (
        <section>
          <h2>2. Pick or edit a template</h2>
          <label>
            Template
            <select
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                const found = templates.find((t) => t.id === id);
                if (found) {
                  setSubject(found.subject);
                  setBodyText(found.bodyText);
                }
              }}
            >
              <option value="">Write from scratch</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label>
            Body
            <textarea rows={8} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={includeFeedback} onChange={(e) => setIncludeFeedback(e.target.checked)} />
            Include reviewer feedback ({'{feedback}'})
          </label>
          <label>
            <input
              type="checkbox"
              checked={attachIcs}
              onChange={(e) => {
                setAttachIcs(e.target.checked);
                setIcsUnscheduledIds(null);
              }}
            />
            Attach calendar invite (.ics)
          </label>
          {icsUnscheduledIds && (
            <div className="chq-error-banner" role="alert">
              These submissions aren't scheduled yet, so a calendar invite can't be attached: {icsUnscheduledIds.join(', ')}.
              Schedule them first, or uncheck &quot;Attach calendar invite&quot;.
            </div>
          )}

          <div>
            <button type="button" onClick={() => setStep('select')}>
              Back
            </button>
            <button type="button" disabled={busy || (!templateId && (!subject || !bodyText))} onClick={runPreview}>
              Next: preview
            </button>
          </div>
        </section>
      )}

      {step === 'preview' && (
        <section>
          <h2>3. Preview</h2>
          {icsUnscheduledIds && (
            <div className="chq-error-banner" role="alert">
              Send blocked: "Attach calendar invite" is checked, but these submissions aren't scheduled yet:{' '}
              {icsUnscheduledIds.join(', ')}. Schedule them first, or go back and uncheck the toggle.
            </div>
          )}
          <PreviewPane items={preview} />
          <div>
            <button type="button" onClick={() => setStep('template')}>
              Back
            </button>
            <button type="button" disabled={busy} onClick={send}>
              Send to {preview.length} recipient{preview.length === 1 ? '' : 's'}
            </button>
          </div>
        </section>
      )}

      {step === 'sent' && (
        <section>
          <h2>Sent</h2>
          <p>Sent {sentCount} email{sentCount === 1 ? '' : 's'}.</p>
          <button type="button" onClick={reset}>
            Compose another
          </button>
        </section>
      )}
    </div>
  );
}
