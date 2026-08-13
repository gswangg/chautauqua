import { useEffect, useRef, useState } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { buildSubmissionsQuery } from '../submissions/filters';
import { DEFAULT_FILTER_STATE, STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionListItem, type SubmissionStatus } from '../submissions/types';
import { PreviewPane } from './PreviewPane';
import { describeSendResult, type SendResult } from '../../lib/sendResult';
import { DelayedLoading } from '../../components/DelayedLoading';
import { FormRow } from '../../components/ModalFrame';
import { COMPOSE_MERGE_FIELDS } from '../../lib/merge-fields';
import type { EmailTemplate, RenderedRecipient } from './types';
import type { EvaluationPlan } from '../review/types';
import { DEC_793 } from '../../../../src/decisions';

void DEC_793;

// J5's decide != notify: the picker defaults to the two decided statuses so
// organizers compose against the submissions they've already ruled on, but
// any status can be selected (this is a filter, not a hard restriction).
const DECIDED_STATUSES: SubmissionStatus[] = ['accepted', 'declined'];

const PER_PAGE = 50;
const RECIPIENT_CAP = 100;
const RECIPIENT_PREVIEW_ROWS = 5;

type Step = 'select' | 'template' | 'preview' | 'sent';

const STEP_ORDER: Step[] = ['select', 'template', 'preview', 'sent'];

interface StepMeta {
  step: Step;
  title: string;
  detail: string;
}

export function ComposeWizard({ eventId }: { eventId: string }) {
  const [step, setStep] = useState<Step>('select');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus[]>(DECIDED_STATUSES);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  // DEC-350: selection spans pages — never cleared on page/q/status change,
  // exactly like ../submissions/selection.ts.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [includeFeedback, setIncludeFeedback] = useState(false);
  // DEC-682: a decision mailer must never invent/leak another plan's or
  // round's feedback -- the organizer names exactly which plan (and,
  // implicitly, its current round) to attach before includeFeedback is
  // honored server-side.
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [feedbackPlanId, setFeedbackPlanId] = useState<string>('');
  const [attachIcs, setAttachIcs] = useState(false);

  const [preview, setPreview] = useState<RenderedRecipient[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capMessage, setCapMessage] = useState<string | null>(null);
  // DEC-051: submission ids the server rejected as "not scheduled" when
  // attachIcs was requested. Surfaced literally next to the toggle — never
  // pre-filtered client-side, since that would hide the server's contract.
  const [icsUnscheduledIds, setIcsUnscheduledIds] = useState<string[] | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  // DEC-793: when the server rejects recipients for a missing merge field,
  // one line per rejected person is rendered inside the error banner,
  // resolved through the already-loaded submissions rather than raw ids.
  const [missingMergeFieldLines, setMissingMergeFieldLines] = useState<string[] | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCaretRef.current !== null && bodyRef.current) {
      const pos = pendingCaretRef.current;
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(pos, pos);
      pendingCaretRef.current = null;
    }
  }, [bodyText]);

  useEffect(() => {
    setLoadingSubmissions(true);
    setError(null);
    const qs = buildSubmissionsQuery({ ...DEFAULT_FILTER_STATE, status: statusFilter, q, page, perPage: PER_PAGE });
    apiList<SubmissionListItem>(`/events/${eventId}/submissions${qs}`)
      .then((res) => {
        setSubmissions(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => setLoadingSubmissions(false));
  }, [eventId, statusFilter, q, page]);

  useEffect(() => {
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => setTemplates(res.items))
      .catch(() => undefined);
  }, [eventId]);

  useEffect(() => {
    apiList<EvaluationPlan>(`/events/${eventId}/plans`)
      .then((res) => setPlans(res.items))
      .catch(() => undefined);
  }, [eventId]);

  function toggleStatus(status: SubmissionStatus) {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
    setPage(1);
  }

  function handleSearchChange(next: string) {
    setQ(next);
    setPage(1);
  }

  function toggleSubmission(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function composeBody(overrides?: { includeFeedback?: boolean; feedbackPlanId?: string; attachIcs?: boolean }): Record<string, unknown> {
    const effectiveIncludeFeedback = overrides?.includeFeedback ?? includeFeedback;
    const effectiveFeedbackPlanId = overrides?.feedbackPlanId ?? feedbackPlanId;
    const base: Record<string, unknown> = {
      submissionIds: [...selectedIds],
      includeFeedback: effectiveIncludeFeedback,
      attachIcs: overrides?.attachIcs ?? attachIcs,
    };
    if (effectiveIncludeFeedback && effectiveFeedbackPlanId) {
      base.feedbackPlanId = effectiveFeedbackPlanId;
    }
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

  // DEC-793: inserts a merge-field token at the textarea's current caret
  // (not appended blindly) and restores focus + caret after the insert.
  function insertMergeField(field: string) {
    const token = `{${field}}`;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? bodyText.length;
    const end = el?.selectionEnd ?? bodyText.length;
    pendingCaretRef.current = start + token.length;
    setBodyText(bodyText.slice(0, start) + token + bodyText.slice(end));
  }

  // DEC-793: the server rejects recipients with fields keyed
  // `<contactId>:<submissionId>` and messages `missing merge field '<field>'`.
  // Resolved through the already-loaded submissions' speakers, naming the
  // PERSON — falling back to the submission's title when the contact
  // doesn't resolve, never a raw id.
  function extractMissingMergeFieldLines(err: ApiError): string[] | null {
    if (!err.fields) return null;
    const lines: string[] = [];
    for (const [key, message] of Object.entries(err.fields)) {
      const keyMatch = /^(.+):([^:]+)$/.exec(key);
      const msgMatch = /^missing merge field '(.+)'$/.exec(message);
      if (!keyMatch || !msgMatch) continue;
      const [, contactId, submissionId] = keyMatch;
      const field = msgMatch[1];
      const submission = submissions.find((s) => s.id === submissionId);
      const speaker = submission?.speakers.find((sp) => sp.contactId === contactId);
      const label = speaker?.name ?? submission?.title ?? contactId;
      lines.push(`${label} — missing {${field}}`);
    }
    return lines.length > 0 ? lines : null;
  }

  async function runPreview(overrides?: { includeFeedback?: boolean; feedbackPlanId?: string; attachIcs?: boolean }) {
    setBusy(true);
    setError(null);
    setCapMessage(null);
    setIcsUnscheduledIds(null);
    setMissingMergeFieldLines(null);
    try {
      const res = await apiPost<{ items: RenderedRecipient[] }>(`/events/${eventId}/compose/preview`, composeBody(overrides));
      setPreview(res.items);
      setPreviewIndex(0);
      setStep('preview');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid') {
        const unscheduled = extractIcsUnscheduledIds(err);
        const missingMergeFields = extractMissingMergeFieldLines(err);
        if (unscheduled) {
          setIcsUnscheduledIds(unscheduled);
        } else if (/exceeds the .*-recipient cap/i.test(err.message)) {
          setCapMessage(err.message);
        } else if (missingMergeFields) {
          setError(err.message);
          setMissingMergeFieldLines(missingMergeFields);
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

  // The attachments panel lives on the preview step (mock step 3), so
  // flipping a toggle there re-renders the merged preview immediately
  // rather than silently going stale — send-immediately semantics and the
  // ICS resolution itself are untouched (DEC-051/DEC-366).
  function handleIncludeFeedbackChange(next: boolean) {
    setIncludeFeedback(next);
    void runPreview({ includeFeedback: next });
  }

  function handleFeedbackPlanChange(next: string) {
    setFeedbackPlanId(next);
    if (includeFeedback) void runPreview({ feedbackPlanId: next });
  }

  function handleAttachIcsChange(next: boolean) {
    setAttachIcs(next);
    setIcsUnscheduledIds(null);
    void runPreview({ attachIcs: next });
  }

  async function send() {
    setBusy(true);
    setError(null);
    setIcsUnscheduledIds(null);
    setMissingMergeFieldLines(null);
    try {
      const res = await apiPost<SendResult>(`/events/${eventId}/compose/send`, composeBody());
      setSendResult(res);
      setStep('sent');
    } catch (err) {
      if (err instanceof ApiError) {
        const unscheduled = extractIcsUnscheduledIds(err);
        const missingMergeFields = extractMissingMergeFieldLines(err);
        if (unscheduled) {
          setIcsUnscheduledIds(unscheduled);
        } else if (missingMergeFields) {
          setError(err.message);
          setMissingMergeFieldLines(missingMergeFields);
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
    setPage(1);
    setQ('');
    setTemplateId('');
    setTemplateName('');
    setSubject('');
    setBodyText('');
    setIncludeFeedback(false);
    setFeedbackPlanId('');
    setAttachIcs(false);
    setPreview([]);
    setPreviewIndex(0);
    setSendResult(null);
    setCapMessage(null);
    setIcsUnscheduledIds(null);
    setMissingMergeFieldLines(null);
    setError(null);
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * PER_PAGE, total);

  const stepMeta: StepMeta[] = [
    {
      step: 'select',
      title: 'Recipients',
      detail:
        selectedIds.size === 0 ? 'None selected yet' : `${selectedIds.size} submission${selectedIds.size === 1 ? '' : 's'} selected`,
    },
    {
      step: 'template',
      title: 'Template',
      detail: templateId ? templateName || 'Saved template' : subject ? 'Custom message' : 'Not started',
    },
    { step: 'preview', title: 'Preview', detail: 'One email per recipient' },
    { step: 'sent', title: 'Send', detail: 'Logged in History' },
  ];

  const currentIndex = STEP_ORDER.indexOf(step);

  const noSlotCount = preview.filter((r) => !r.ics).length;
  const overflowCount = Math.max(0, preview.length - RECIPIENT_PREVIEW_ROWS);
  const previewClamped = preview.length === 0 ? 0 : Math.min(previewIndex, preview.length - 1);
  const currentPreview = preview[previewClamped];

  return (
    <div className="chq-compose-wizard">
      {error && (
        <div className="chq-error-banner">
          {error}
          {missingMergeFieldLines && missingMergeFieldLines.length > 0 && (
            <ul>
              {missingMergeFieldLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {capMessage && (
        <div className="chq-error-banner" role="alert">
          {capMessage} Narrow your submission selection to {RECIPIENT_CAP} or fewer recipients and try again.
        </div>
      )}

      <div className="chq-steps">
        {stepMeta.map((s, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div key={s.step} className={`chq-step${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}>
              <span className="chq-step-num">{isDone ? '✓' : idx + 1}</span>
              <div className="chq-comms-step-copy">
                <span className="chq-comms-step-title">{s.title}</span>
                <span className="chq-comms-step-detail">{s.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {step === 'select' && (
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">1. Pick submissions</span>
          </div>
          <div className="chq-status-filter">
            {SUBMISSION_STATUSES.map((status) => (
              <label key={status} className="chq-comms-status-filter-item">
                <input
                  type="checkbox"
                  className="chq-check"
                  checked={statusFilter.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {STATUS_LABELS[status]}
              </label>
            ))}
          </div>
          <label className="chq-comms-template-label">
            Search
            <input
              type="text"
              className="chq-input"
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search submissions"
            />
          </label>

          {loadingSubmissions && <DelayedLoading label="Loading submissions…" />}
          <table className="chq-table chq-comms-compose-table">
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
                  <td data-label="Select">
                    <input
                      type="checkbox"
                      className="chq-check"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSubmission(s.id)}
                      aria-label={`Select ${s.title}`}
                    />
                  </td>
                  <td data-label="Title">{s.title}</td>
                  <td data-label="Speakers">{s.speakers.map((sp) => sp.name).join(', ')}</td>
                  <td data-label="Status">{STATUS_LABELS[s.status]}</td>
                </tr>
              ))}
              {!loadingSubmissions && submissions.length === 0 && (
                <tr>
                  <td colSpan={4}>No submissions match the selected statuses.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="chq-pager">
            <span>
              Showing {rangeStart}-{rangeEnd} of {total}
            </span>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * PER_PAGE >= total}
            >
              Next
            </button>
          </div>

          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={selectedIds.size === 0}
            onClick={() => setStep('template')}
          >
            Next: choose template ({selectedIds.size} submission{selectedIds.size === 1 ? '' : 's'} selected)
          </button>
        </section>
      )}

      {step === 'template' && (
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">2. Pick or edit a template</span>
          </div>
          <FormRow label="Template" htmlFor="compose-template">
            <select
              id="compose-template"
              className="chq-select"
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                const found = templates.find((t) => t.id === id);
                if (found) {
                  setTemplateName(found.name);
                  setSubject(found.subject);
                  setBodyText(found.bodyText);
                } else {
                  setTemplateName('');
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
          </FormRow>
          <FormRow label="Subject" htmlFor="compose-subject">
            <input id="compose-subject" className="chq-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </FormRow>
          <FormRow label="Body" htmlFor="compose-body">
            <textarea
              id="compose-body"
              className="chq-textarea"
              rows={8}
              ref={bodyRef}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </FormRow>
          <div className="chq-comms-merge-chips chq-comms-template-body-merge-chips">
            {COMPOSE_MERGE_FIELDS.map((field) => (
              <button key={field} type="button" className="chq-pill" onClick={() => insertMergeField(field)}>
                {`{${field}}`}
              </button>
            ))}
          </div>
          <p className="chq-comms-panel-note">
            Merge fields fill in per recipient &mdash; shown resolved in Preview.
          </p>

          <div className="chq-comms-template-actions">
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('select')}>
              Back
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={busy || (!templateId && (!subject || !bodyText))}
              onClick={() => runPreview()}
            >
              Next: preview
            </button>
          </div>
        </section>
      )}

      {step === 'preview' && (
        <section className="chq-comms-review">
          <section>
            <div className="chq-section-head">
              <span className="chq-section-label">Recipients &middot; {preview.length}</span>
              <button type="button" className="chq-link-button" onClick={() => setStep('select')}>
                Change selection
              </button>
            </div>
            {preview.slice(0, RECIPIENT_PREVIEW_ROWS).map((r) => (
              <div key={r.contactId + r.submissionId} className="chq-comms-recipient-row">
                <div>
                  <div className="chq-comms-recipient-name">{r.name}</div>
                  <div className="chq-comms-recipient-meta">{r.email}</div>
                </div>
                {attachIcs && <span className="chq-flag">{r.ics ? 'Scheduled' : 'No slot yet'}</span>}
              </div>
            ))}
            {preview.length === 0 && <p>No recipients to preview.</p>}
            {overflowCount > 0 && (
              <div className="chq-comms-overflow">
                {overflowCount} more &middot; {preview.length} is under the {RECIPIENT_CAP}-recipient cap
              </div>
            )}

            <div className="chq-comms-panel">
              <span className="chq-comms-panel-title">Attachments</span>
              <label className="chq-comms-toggle">
                <input
                  type="checkbox"
                  className="chq-check"
                  checked={includeFeedback}
                  onChange={(e) => handleIncludeFeedbackChange(e.target.checked)}
                />
                Include reviewer feedback
              </label>
              {includeFeedback && (
                <label className="chq-comms-template-label">
                  Evaluation plan
                  <select
                    className="chq-select"
                    value={feedbackPlanId}
                    required
                    onChange={(e) => handleFeedbackPlanChange(e.target.value)}
                  >
                    <option value="">Choose a plan&hellip;</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {feedbackPlanId &&
                    (() => {
                      const selectedPlan = plans.find((p) => p.id === feedbackPlanId);
                      return selectedPlan ? (
                        <span className="chq-comms-panel-note">
                          Round {selectedPlan.currentRound} of {selectedPlan.name}
                        </span>
                      ) : null;
                    })()}
                </label>
              )}
              <label className="chq-comms-toggle">
                <input
                  type="checkbox"
                  className="chq-check"
                  checked={attachIcs}
                  onChange={(e) => handleAttachIcsChange(e.target.checked)}
                />
                Attach calendar invite
              </label>
              {attachIcs && preview.length > 0 && (
                <span className="chq-comms-panel-note">
                  {noSlotCount} of {preview.length} have no slot yet &mdash; those get no invite
                </span>
              )}
              {icsUnscheduledIds && (
                <div className="chq-error-banner" role="alert">
                  Send blocked: these submissions aren&apos;t scheduled yet: {icsUnscheduledIds.join(', ')}. Schedule
                  them first, or uncheck &quot;Attach calendar invite&quot;.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="chq-section-head">
              <span className="chq-section-label">Preview{currentPreview ? ` · ${currentPreview.name}` : ''}</span>
              <div className="chq-comms-preview-nav">
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  disabled={previewClamped <= 0}
                  onClick={() => setPreviewIndex((i) => i - 1)}
                >
                  &lsaquo; Prev
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  disabled={previewClamped >= preview.length - 1}
                  onClick={() => setPreviewIndex((i) => i + 1)}
                >
                  Next &rsaquo;
                </button>
              </div>
            </div>
            <PreviewPane item={currentPreview} attachIcs={attachIcs} />
            <div className="chq-comms-preview-actions">
              <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={send}>
                Send {preview.length} email{preview.length === 1 ? '' : 's'}
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('template')}>
                Back to the template
              </button>
            </div>
          </section>
        </section>
      )}

      {step === 'sent' && (
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">Sent</span>
          </div>
          {sendResult && <p>{describeSendResult(sendResult, { one: 'email', many: 'emails' })}</p>}
          {sendResult?.failed && sendResult.failed.length > 0 && (
            <ul>
              {sendResult.failed.map((f) => (
                <li key={f.email}>{f.email}</li>
              ))}
            </ul>
          )}
          <button type="button" className="chq-btn chq-btn-primary" onClick={reset}>
            Compose another
          </button>
        </section>
      )}
    </div>
  );
}
