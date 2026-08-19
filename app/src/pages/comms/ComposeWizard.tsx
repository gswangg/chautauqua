import { useEffect, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { buildSubmissionsQuery } from '../submissions/filters';
import { DEFAULT_FILTER_STATE, STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionListItem, type SubmissionStatus } from '../submissions/types';
import {
  EMPTY_SELECTION,
  isPageFullySelected,
  isPagePartiallySelected,
  selectionReducer,
} from '../submissions/selection';
import { PreviewPane } from './PreviewPane';
import { usePendingLabel } from '../../components/PendingAction';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { SendFailures } from '../../components/SendFailures';
import { FormRow } from '../../components/ModalFrame';
import { COMPOSE_MERGE_FIELDS, MAX_COMPOSE_RECIPIENTS, type MergeField } from '../../lib/merge-fields';
import { InsertFieldMenu } from './InsertFieldMenu';
import { countOf, capitalizeFirst, plural, spellCount } from '../../lib/plural';
import { isoToMs, formatDayLabel } from '../../lib/dates';
import { clockHHMM } from '../../lib/clock';
import { paginationSummary } from '../../lib/pagination-summary';
import { writeComposeDraft, clearComposeDraft } from './composeDraft';
import type { ComposePreviewPlan, ComposeSendResult, EmailTemplate, RenderedRecipient } from './types';
import type { EvaluationPlan } from '../review/types';
import { DEC_317, DEC_793, DEC_967, DEC_993 } from '../../../../src/decisions';
import { MAX_TEXT_LENGTH, MAX_RICH_TEXT_LENGTH } from '../../lib/text-caps';

void DEC_317;
void DEC_793;
void DEC_967;
void DEC_993;

// DEC-967 amendment (wave 18): the picker defaults to Accepted alone -- the
// shortest path (arrive, Next, Next) must compose against the talks that
// are actually going forward, never accepted+declined unioned into one
// message. Declined stays a reachable filter (organizers do mail declines),
// it's simply not pre-checked.
const DECIDED_STATUSES: SubmissionStatus[] = ['accepted'];

const PER_PAGE = 50;
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
  // Frame 07-comms--05: the status filter is drawn as counted pills
  // ("Accepted · 23"), not bare checkboxes -- one perPage:1 read per status
  // (same envelope-total idiom Comms.tsx's own sentLast7Days pair already
  // uses) gives the real count without widening the row-fetch payload. Never
  // filtered by `q`: the pills name the audience segments themselves, not a
  // search result. Starts at null per status so an unloaded/failed count
  // renders no number rather than a fabricated 0.
  const [statusCounts, setStatusCounts] = useState<Record<SubmissionStatus, number | null>>(() => {
    const init = {} as Record<SubmissionStatus, number | null>;
    for (const s of SUBMISSION_STATUSES) init[s] = null;
    return init;
  });
  // Step 1's "N have no slot yet" footer note (ruling B1) needs slot data for
  // every SELECTED submission, but `submissions` only ever holds the current
  // page/filter's rows. This accumulates every row this session has actually
  // fetched (any page, any filter) keyed by id, so the note stays accurate
  // for a selection that spans pages without fabricating a count for a
  // submission this session has never loaded.
  const [knownSubmissions, setKnownSubmissions] = useState<Map<string, SubmissionListItem>>(new Map());
  // DEC-350: selection spans pages — never cleared on page/q/status change.
  // Reducer + predicates are shared with ../submissions/selection.ts (the
  // same select-all/indeterminate contract as SubmissionsTable/ContactsTable).
  const [selection, dispatchSelection] = useReducer(selectionReducer, EMPTY_SELECTION);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  // DEC-518 wave-76 amendment: an empty `templates` list renders identically
  // to "this event has no templates" (the select just shows "Write from
  // scratch" with no other options) -- indistinguishable from a load
  // failure unless the failure names itself, so a failed fetch sets this
  // instead of being silently absorbed into the same empty array.
  const [templatesLoadError, setTemplatesLoadError] = useState(false);
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
  // DEC-518 wave-76 amendment: same fabrication risk as templatesLoadError
  // above -- an empty `plans` list reads as "this event has no evaluation
  // plans" (feedback merge hidden, plan picker offers nothing) when it may
  // just be a failed fetch.
  const [plansLoadError, setPlansLoadError] = useState(false);
  const [feedbackPlanId, setFeedbackPlanId] = useState<string>('');
  const [attachIcs, setAttachIcs] = useState(false);

  const [preview, setPreview] = useState<RenderedRecipient[]>([]);
  // wave-60 amendment (DEC-238, P1 cluster 4): the dedupe plan
  // /compose/preview computes -- `willSend` is the number the step-3/4
  // primaries must display, never `preview.length` (the raw
  // (contact,submission) expansion). Defaults to "nothing skipped yet" so a
  // server that hasn't returned `plan` renders the pre-DEC-238 behavior
  // rather than a fabricated zero.
  const [previewPlan, setPreviewPlan] = useState<ComposePreviewPlan>({ willSend: 0, skipped: [] });
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  // DEC-733 (V11 pending grammar): bulk-send is one of the four slow
  // operations -- the Send button becomes its own progress indicator
  // rather than a spinner. No live incremental count comes back from
  // /compose/send (it resolves once with the final tally), so this
  // renders the single-line "Sending…" form (no done/total).
  const sendPendingLabel = usePendingLabel({
    pending: busy,
    restLabel: `Send ${countOf(previewPlan.willSend, 'email')}`,
    participle: 'Sending',
  });
  const [error, setError] = useState<string | null>(null);
  const [capMessage, setCapMessage] = useState<string | null>(null);
  // DEC-051: submission ids the server rejected as "not scheduled" when
  // attachIcs was requested. Surfaced literally next to the toggle — never
  // pre-filtered client-side, since that would hide the server's contract.
  const [icsUnscheduledIds, setIcsUnscheduledIds] = useState<string[] | null>(null);
  const [sendResult, setSendResult] = useState<ComposeSendResult | null>(null);
  // DEC-967 amendment (wave 25, ruling B1): step 4 IS the confirmation --
  // there is no separate dialog. `sentAt` is stamped the instant the send
  // resolves, purely for the post-send report's "when" line (never posted).
  const [sentAt, setSentAt] = useState<number | null>(null);
  // DEC-793: when the server rejects recipients for a missing merge field,
  // one line per rejected person is rendered inside the error banner,
  // resolved through the already-loaded submissions rather than raw ids.
  const [missingMergeFieldLines, setMissingMergeFieldLines] = useState<string[] | null>(null);
  // DEC-793 amendment (wave 28): when the organizer takes the partial-send
  // path off a blocked banner, the submission ids excluded (unscheduled) are
  // remembered here so the post-send report can list them under an
  // "excluded" heading and state the reduced count — never a silent
  // narrowing of the audience.
  const [partialExcludedIds, setPartialExcludedIds] = useState<string[] | null>(null);
  // DEC-317 amendment (wave 60): the third fields-map refusal shape
  // (`no eligible recipients`) resolved to labels through submissionLabel,
  // exactly like icsUnscheduledIds -- never rendered as a raw id, and never
  // left to fall into the generic error banner unnamed.
  const [noRecipientRefs, setNoRecipientRefs] = useState<string[] | null>(null);
  // w11-d: the receiving side of the DECIDE->NOTIFY handoff states its own
  // truncation. `idsArrivedCount` is the non-empty comma-separated entries
  // BEFORE filtering; `idsKeptCount` is what actually got dispatched into
  // the selection. Both null until a non-empty ?ids= is hydrated (no ?ids=
  // at all renders nothing, same as counts agreeing).
  const [idsArrivedCount, setIdsArrivedCount] = useState<number | null>(null);
  const [idsKeptCount, setIdsKeptCount] = useState<number | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  // w12-c: Enter-to-advance and focus-on-arrival need a handle on each
  // step's own existing primary -- never a synthesized action, so a
  // disabled primary silently blocks Enter exactly as it blocks a click.
  const selectPrimaryRef = useRef<HTMLButtonElement | null>(null);
  const templatePrimaryRef = useRef<HTMLButtonElement | null>(null);
  const previewPrimaryRef = useRef<HTMLButtonElement | null>(null);

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
        setKnownSubmissions((prev) => {
          const next = new Map(prev);
          for (const item of res.items) next.set(item.id, item);
          return next;
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions'))
      .finally(() => setLoadingSubmissions(false));
  }, [eventId, statusFilter, q, page]);

  // Frame 07-comms--05: each status pill states its own count ("Declined ·
  // 11"). One perPage:1 request per status, read off the same DEC-013
  // envelope total every other list read uses -- never a client-side count
  // of whatever happens to be on the current page/filter.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SUBMISSION_STATUSES.map((status) => {
        // The query string is built BEFORE the template rather than inline
        // inside it: DEC-817's path scan erases a `${...}` span at the first
        // `}` it meets, so a nested object literal in the template leaves it
        // with a torn path that resolves to no route. Same `${qs}` shape the
        // list read above (and SubmissionsTable) already uses.
        const statusCountQs = buildSubmissionsQuery({ ...DEFAULT_FILTER_STATE, status: [status], perPage: 1 });
        return apiList<SubmissionListItem>(`/events/${eventId}/submissions${statusCountQs}`).then(
          (res) => [status, res.total] as const,
        );
      }),
    )
      .then((pairs) => {
        if (cancelled) return;
        setStatusCounts((prev) => {
          const next = { ...prev };
          for (const [status, count] of pairs) next[status] = count;
          return next;
        });
      })
      // A failed count read leaves every pill's count null (no number
      // shown) rather than surfacing a second error banner over the step-1
      // table for a courtesy annotation.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    setTemplatesLoadError(false);
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => setTemplates(res.items))
      .catch(() => setTemplatesLoadError(true));
  }, [eventId]);

  // DEC-967 amendment (findings wave 8, w8-b): DECIDE -> NOTIFY handoff.
  // BulkActionBar hands off the decided selection as `?ids=<comma-joined>` --
  // parsed ONCE per mount, bounded (garbage/over-long entries dropped rather
  // than thrown on) and capped at MAX_COMPOSE_RECIPIENTS, same cap the
  // step-1 bulkbar states. Feeds the existing selectionReducer via the same
  // 'SET' action the reducer already exposes, and (only when the hydrated
  // selection is non-empty) opens the wizard straight at step 2 -- arrival
  // must never start by going backwards through an already-decided
  // selection. A ?ids= that parses to nothing leaves the wizard on step 1,
  // same as no ?ids= at all.
  const appliedIdsParam = useRef(false);
  useEffect(() => {
    if (appliedIdsParam.current) return;
    appliedIdsParam.current = true;
    const raw = new URLSearchParams(window.location.search).get('ids');
    if (!raw) return;
    const arrived = raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const ids = arrived.filter((id) => id.length <= 64).slice(0, MAX_COMPOSE_RECIPIENTS);
    if (ids.length === 0) return;
    setIdsArrivedCount(arrived.length);
    setIdsKeptCount(ids.length);
    dispatchSelection({ type: 'SET', ids });
    setStep('template');
  }, []);

  // DEC-890 (Templates "Use in a send"): a ?template=<id> landing preselects
  // that template exactly as the template <select>'s own onChange does --
  // prefill subject/body from the template. DEC-846 amendment (wave 3):
  // templateId itself IS recorded here (provenance, not authority -- see
  // composeBody below), since this landing names the exact template the
  // batch was seeded from just as plainly as a manual dropdown pick. Reads
  // location.search directly (this component isn't otherwise router-aware)
  // once templates have loaded, and only once per mount (a later template
  // list refresh must not re-fire it).
  // DEC-967 amendment (findings wave 8, w8-b): the landing step is now ONE
  // rule shared with the ?ids= handoff above -- a ?template= with no
  // hydrated ids applies the template but stays on step 1 (there is nothing
  // to compose FOR yet); a non-empty selection (from ?ids=, regardless of
  // whether ?template= is also present) opens straight at step 2.
  const appliedTemplateParam = useRef(false);
  useEffect(() => {
    if (appliedTemplateParam.current || templates.length === 0) return;
    const wanted = new URLSearchParams(window.location.search).get('template');
    if (!wanted) return;
    const found = templates.find((t) => t.id === wanted);
    if (!found) return;
    appliedTemplateParam.current = true;
    setTemplateName(found.name);
    setSubject(found.subject);
    setBodyText(found.bodyText);
    setTemplateId(found.id);
  }, [templates]);

  // w12-c's templates[0] auto-apply is REMOVED (user ruling, gate-9): an
  // eval turn-diet must never degrade the real product, and silently
  // pre-filling the composer made the "Write from scratch" label lie —
  // ruling A19's own default is "No template — write it here". Step 2 now
  // arrives blank; picking a template is one explicit select.

  useEffect(() => {
    setPlansLoadError(false);
    apiList<EvaluationPlan>(`/events/${eventId}/plans`)
      .then((res) => setPlans(res.items))
      .catch(() => setPlansLoadError(true));
  }, [eventId]);

  function toggleStatus(status: SubmissionStatus) {
    setStatusFilter((prev) => {
      // Deselecting the last remaining status is a no-op — an empty status
      // filter is unreachable, same contract as before this wave's default
      // change.
      if (prev.includes(status)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
    setPage(1);
  }

  function handleSearchChange(next: string) {
    setQ(next);
    setPage(1);
  }

  // Frame 07-comms--05: "Select all N accepted" beside Clear. `total` is
  // already the exact count the active filter matches (the same figure the
  // pill states), but `submissions` only holds the current page -- so this
  // fetches every id the CURRENT filter/search matches in one call (perPage
  // set to the known total) and unions them into the existing selection via
  // the selection reducer's own TOGGLE_PAGE action, which adds every given
  // id when they aren't all already selected and never touches ids selected
  // under a different filter (the same guarantee DEC-350's cross-page
  // selection already depends on for the per-page header checkbox).
  const [selectingAll, setSelectingAll] = useState(false);
  async function selectAllShown() {
    if (total === 0 || selectingAll) return;
    setSelectingAll(true);
    try {
      const qs = buildSubmissionsQuery({ ...DEFAULT_FILTER_STATE, status: statusFilter, q, page: 1, perPage: total });
      const res = await apiList<SubmissionListItem>(`/events/${eventId}/submissions${qs}`);
      setKnownSubmissions((prev) => {
        const next = new Map(prev);
        for (const item of res.items) next.set(item.id, item);
        return next;
      });
      dispatchSelection({ type: 'TOGGLE_PAGE', pageIds: res.items.map((item) => item.id) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to select every shown submission');
    } finally {
      setSelectingAll(false);
    }
  }

  function composeBody(overrides?: {
    includeFeedback?: boolean;
    feedbackPlanId?: string;
    attachIcs?: boolean;
    submissionIds?: string[];
  }): Record<string, unknown> {
    const effectiveIncludeFeedback = overrides?.includeFeedback ?? includeFeedback;
    const effectiveFeedbackPlanId = overrides?.feedbackPlanId ?? feedbackPlanId;
    const base: Record<string, unknown> = {
      submissionIds: overrides?.submissionIds ?? [...selection.selectedIds],
      includeFeedback: effectiveIncludeFeedback,
      attachIcs: overrides?.attachIcs ?? attachIcs,
    };
    if (effectiveIncludeFeedback && effectiveFeedbackPlanId) {
      base.feedbackPlanId = effectiveFeedbackPlanId;
    }
    // DEC-846 amendment (wave 3): templateId is PROVENANCE, not authority --
    // two different questions get two different answers. subject/bodyText
    // (below) answer "what went out": a template is a starting point, not a
    // mode, so selecting one only prefills these fields (in the template
    // <select> onChange / the ?template= landing effect) and the composer
    // thereafter ALWAYS posts its own subject/bodyText -- every later edit
    // (including DEC-793 merge chip inserts) is what actually goes out and
    // history shows the words, never the stored template. templateId
    // answers "where did this send come from": when the composer still
    // holds one (unedited-away by a dropdown re-pick), it's posted too, so
    // Recent Sends/Templates' "Last used" aren't permanently blank for the
    // product's main send path. The server validates it belongs to this
    // event and renders exclusively from the posted subject/bodyText.
    if (templateId) base.templateId = templateId;
    base.subject = subject;
    base.bodyText = bodyText;
    return base;
  }

  // DEC-955: names a rejected submission by its talk ref + name, resolved
  // through the already-loaded preview rather than the raw id -- a 409/400
  // that counts rows still refuses to name them otherwise. Falls back to
  // the raw id only when the row isn't in the (possibly stale) preview.
  function submissionLabel(submissionId: string, rows: RenderedRecipient[]): string {
    const row = rows.find((r) => r.submissionId === submissionId);
    if (row) return `${row.ref} — ${row.name}`;
    // A no-eligible-recipients refusal names submissions that never rendered
    // a preview row (they have zero eligible participants), so fall back to
    // the already-loaded submission list before giving up to a raw id.
    const submission = submissions.find((s) => s.id === submissionId);
    return submission ? `${submission.ref} — ${submission.title}` : submissionId;
  }

  // DEC-238 amendment (findings wave 5): the skipped section's per-row retry
  // action ("Send in N minutes") is derived from the server's own
  // retryAtIso -- never a client-guessed window -- measured from the
  // instant this batch's send resolved (sentAt), so the minute count stays
  // fixed for the life of this report instead of ticking down as the
  // organizer reads it. Floors at 1 (a retry time already in the past --
  // clock skew, or a slow render -- still reads as "eligible again very
  // soon", never zero/negative minutes).
  function retryMinutes(retryAtIso: string): number {
    const retryMs = isoToMs(retryAtIso);
    const fromMs = sentAt ?? Date.now();
    if (retryMs === null) return 1;
    return Math.max(1, Math.ceil((retryMs - fromMs) / 60000));
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

  // DEC-793/DEC-993: inserts a merge-field token at the textarea's current
  // caret (not appended blindly) and restores focus + caret after the
  // insert.
  function insertMergeField(field: MergeField) {
    const token = `{${field}}`;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? bodyText.length;
    const end = el?.selectionEnd ?? bodyText.length;
    pendingCaretRef.current = start + token.length;
    setBodyText(bodyText.slice(0, start) + token + bodyText.slice(end));
  }

  // DEC-317 amendment (wave 60): pulls the { <submissionId>: 'no eligible
  // recipients' } field errors out of an ApiError -- the third fields-map
  // refusal shape the compose routes can emit, alongside 'not scheduled'
  // (extractIcsUnscheduledIds) and 'missing merge fields: …'
  // (extractMissingMergeFieldLines). Every entry is resolved through
  // submissionLabel before rendering, never a raw id.
  function extractNoRecipientRefs(err: ApiError): string[] | null {
    if (!err.fields) return null;
    const ids = Object.entries(err.fields)
      .filter(([, message]) => message === 'no eligible recipients')
      .map(([submissionId]) => submissionId);
    return ids.length > 0 ? ids : null;
  }

  // DEC-856: the server rejects recipients with fields keyed
  // `<contactId>:<submissionId>` and messages
  // `missing merge fields: <field>[, <field>...]` — one entry per recipient,
  // naming every field they're missing (not just the first). Resolved
  // through the already-loaded submissions' speakers, naming the PERSON —
  // falling back to the submission's title when the contact doesn't
  // resolve, never a raw id.
  function extractMissingMergeFieldLines(err: ApiError): string[] | null {
    if (!err.fields) return null;
    const lines: string[] = [];
    for (const [key, message] of Object.entries(err.fields)) {
      const keyMatch = /^(.+):([^:]+)$/.exec(key);
      const msgMatch = /^missing merge fields: (.+)$/.exec(message);
      if (!keyMatch || !msgMatch) continue;
      const [, contactId, submissionId] = keyMatch;
      const fieldList = msgMatch[1];
      if (!fieldList) continue;
      const fields = fieldList.split(', ');
      const submission = submissions.find((s) => s.id === submissionId);
      const speaker = submission?.speakers.find((sp) => sp.contactId === contactId);
      const label = speaker?.name ?? submission?.title ?? contactId;
      const tokens = fields.map((field) => `{${field}}`).join(', ');
      lines.push(`${label} — missing ${tokens}`);
    }
    return lines.length > 0 ? lines : null;
  }

  async function runPreview(overrides?: { includeFeedback?: boolean; feedbackPlanId?: string; attachIcs?: boolean }) {
    setBusy(true);
    setError(null);
    setCapMessage(null);
    setIcsUnscheduledIds(null);
    setMissingMergeFieldLines(null);
    setNoRecipientRefs(null);
    try {
      const res = await apiPost<{ items: RenderedRecipient[]; plan?: ComposePreviewPlan }>(
        `/events/${eventId}/compose/preview`,
        composeBody(overrides),
      );
      setPreview(res.items);
      // Server-default fallback: a plan-less response (should not happen
      // post-wave-60, but the field is optional on the wire type) is
      // treated as "nothing skipped" rather than desyncing the button
      // count from what actually rendered.
      setPreviewPlan(res.plan ?? { willSend: res.items.length, skipped: [] });
      setPreviewIndex(0);
      setStep('preview');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid') {
        const unscheduled = extractIcsUnscheduledIds(err);
        const missingMergeFields = extractMissingMergeFieldLines(err);
        const noRecipients = extractNoRecipientRefs(err);
        if (unscheduled) {
          setIcsUnscheduledIds(unscheduled);
        } else if (/exceeds the .*-recipient cap/i.test(err.message)) {
          setCapMessage(err.message);
        } else if (missingMergeFields) {
          setError(err.message);
          setMissingMergeFieldLines(missingMergeFields);
        } else if (noRecipients) {
          setError(err.message);
          setNoRecipientRefs(noRecipients);
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
    if (next) {
      // DEC-882/DEC-683: checking the box alone must never fire a request —
      // the server rejects includeFeedback without a plan. Just reveal the
      // plan picker (below) and wait for a choice.
      if (feedbackPlanId === '') return;
      void runPreview({ includeFeedback: true });
    } else {
      setFeedbackPlanId('');
      void runPreview({ includeFeedback: false, feedbackPlanId: '' });
    }
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

  // DEC-967 amendment (wave 25, ruling B1): step 4 pre-send IS the
  // confirmation -- the batch still asks exactly once before it leaves, but
  // that ask is this step's own primary button, not a second dialog on top
  // of it.
  // DEC-793 amendment (wave 28): `excludeIds`, when passed, is the
  // "Send to the N who have a slot" partial path off a blocked banner — it
  // actually removes those submission ids from the posted submissionIds
  // (never a silent narrowing elsewhere) and is remembered in
  // partialExcludedIds so the post-send report can name who was left out.
  async function send(options?: { excludeIds?: string[] }) {
    setBusy(true);
    setError(null);
    setIcsUnscheduledIds(null);
    setMissingMergeFieldLines(null);
    setNoRecipientRefs(null);
    const excludeIds = options?.excludeIds ?? null;
    try {
      const body =
        excludeIds && excludeIds.length > 0
          ? composeBody({ submissionIds: [...selection.selectedIds].filter((id) => !excludeIds.includes(id)) })
          : composeBody();
      const res = await apiPost<ComposeSendResult>(`/events/${eventId}/compose/send`, body);
      setSendResult(res);
      setSentAt(Date.now());
      setPartialExcludedIds(excludeIds);
      // v12 mobile campaign w5 (DEC-621 wave-87 amendment): a successful
      // send is the draft record's one clear point -- there is no longer an
      // in-progress draft once this batch is logged.
      clearComposeDraft(eventId);
    } catch (err) {
      if (err instanceof ApiError) {
        const unscheduled = extractIcsUnscheduledIds(err);
        const missingMergeFields = extractMissingMergeFieldLines(err);
        const noRecipients = extractNoRecipientRefs(err);
        if (unscheduled) {
          setIcsUnscheduledIds(unscheduled);
        } else if (missingMergeFields) {
          setError(err.message);
          setMissingMergeFieldLines(missingMergeFields);
        } else if (noRecipients) {
          setError(err.message);
          setNoRecipientRefs(noRecipients);
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

  // w12-c: primary receives focus on arrival at steps 2 and 3 -- step 1
  // never steals focus on mount (nothing to arrive AT), step 4's Send is a
  // deliberate click, never a focus-then-Enter reflex.
  useEffect(() => {
    if (step === 'template') templatePrimaryRef.current?.focus();
    else if (step === 'preview') previewPrimaryRef.current?.focus();
  }, [step]);

  // v12 mobile campaign w5 (DEC-621 wave-87 amendment): the Comms phone
  // landing's "Draft in progress" card (composeDraft.ts) is written HERE --
  // on step advance -- and nowhere else. The effect's dependency array is
  // `[step]` alone (not subject/bodyText/templateName), so it fires exactly
  // once per step transition and never on a keystroke; `prevStepIndexRef`
  // further limits it to a FORWARD transition, so pressing Back never
  // overwrites the record with an earlier step's now-stale figures. Step 1
  // has nothing worth recording yet (no template, no rendered subject), so
  // the first write happens on arrival at step 2.
  const prevStepIndexRef = useRef(STEP_ORDER.indexOf('select'));
  useEffect(() => {
    const idx = STEP_ORDER.indexOf(step);
    const advanced = idx > prevStepIndexRef.current;
    prevStepIndexRef.current = idx;
    if (!advanced || step === 'select') return;
    // Same resolved-subject rule as `resolvedSendSubject` below (DEC-967):
    // merge fields applied where a preview row exists, the raw typed
    // subject otherwise.
    writeComposeDraft(eventId, {
      templateName: templateName || null,
      subject: preview[0]?.subject ?? subject,
      recipientCount: selection.selectedIds.size,
      updatedAt: Date.now(),
    });
  }, [step]);

  // w12-c (DEC-967 amendment): Enter advances steps 1-3 via each step's own
  // existing primary -- .click() on a disabled <button> is a no-op, so this
  // never bypasses a step's own disabled gate. A textarea's Enter is left
  // alone (it inserts a newline in the message body, it never submits).
  // Step 4's Send is explicitly excluded -- a deliberate send stays a
  // deliberate click.
  function handleStepEnterKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (step === 'select') {
      e.preventDefault();
      selectPrimaryRef.current?.click();
    } else if (step === 'template') {
      e.preventDefault();
      templatePrimaryRef.current?.click();
    } else if (step === 'preview') {
      e.preventDefault();
      previewPrimaryRef.current?.click();
    }
  }

  function reset() {
    setStep('select');
    dispatchSelection({ type: 'CLEAR' });
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
    setPreviewPlan({ willSend: 0, skipped: [] });
    setPreviewIndex(0);
    setSendResult(null);
    setSentAt(null);
    setCapMessage(null);
    setIcsUnscheduledIds(null);
    setMissingMergeFieldLines(null);
    setPartialExcludedIds(null);
    setNoRecipientRefs(null);
    setError(null);
  }


  const stepMeta: StepMeta[] = [
    {
      step: 'select',
      title: 'Recipients',
      detail:
        selection.selectedIds.size === 0
          ? 'None selected yet'
          : `${countOf(selection.selectedIds.size, 'submission')} selected`,
    },
    {
      step: 'template',
      title: 'Template',
      detail: templateName ? `From "${templateName}"` : subject ? 'Custom message' : 'Not started',
    },
    { step: 'preview', title: 'Preview', detail: 'One email per recipient' },
    { step: 'sent', title: 'Send', detail: 'Logged in History' },
  ];

  const currentIndex = STEP_ORDER.indexOf(step);
  const pageIds = submissions.map((s) => s.id);

  // DEC-954: `ics` is only populated when the server actually ran the ICS
  // preflight for THIS preview call -- after a rejected attachIcs toggle the
  // stale preview would report every row as slotless even though every row
  // prints 'Scheduled'. `scheduled` is rendered unconditionally (DEC-912),
  // so it's the truthful predicate for this caption too.
  const noSlotCount = preview.filter((r) => !r.scheduled).length;
  // Frame 07-comms--05's step-1 footer note ("N have no slot yet"), counted
  // over the SELECTED ids whose slot data this session has actually loaded
  // (knownSubmissions -- see its declaration above). A selected id from a
  // page/filter never visited this session is not counted here (there is no
  // selected-submissions-by-id endpoint to fetch it exhaustively) -- see the
  // fidelity report for this gap.
  const selectedNoSlotCount = [...selection.selectedIds].filter((id) => {
    const known = knownSubmissions.get(id);
    return known ? known.slot === null : false;
  }).length;
  // DEC-793 amendment (wave 28): the partial-send count named on the
  // blocked banner's secondary action — always preview.length minus the
  // named-blocked ids, never a client-side guess at who's scheduled.
  const scheduledCount = icsUnscheduledIds ? preview.length - icsUnscheduledIds.length : 0;
  const overflowCount = Math.max(0, preview.length - RECIPIENT_PREVIEW_ROWS);
  const previewClamped = preview.length === 0 ? 0 : Math.min(previewIndex, preview.length - 1);
  const currentPreview = preview[previewClamped];
  // DEC-967: names the resolved subject (merge fields applied), falling
  // back to the raw typed subject only when no preview row has rendered
  // yet.
  const resolvedSendSubject = preview[0]?.subject ?? subject;
  // Ruling B1: the post-send report's headline audience count. `total` is
  // every recipient the server actually attempted (sent + named failures) --
  // never the pre-send preview count, which can't see per-recipient
  // failures the server hasn't reported yet.
  const sentFailedCount = sendResult?.failed?.length ?? 0;
  // DEC-238 amendment (wave 3): the ruling's three plain lines. `skipped`
  // defaults to [] client-side (ComposeSendResult) so a server that hasn't
  // landed the dedupe field yet reports zero, never a fabricated count.
  // `remaining` is the failed set -- a recipient the product still owes a
  // message, never a second server-posted field.
  const skippedRecipients = sendResult?.skipped ?? [];
  // wave-60 amendment (DEC-238, P1 cluster 4): the denominator must include
  // every recipient the batch actually contained, not just sent+failed --
  // otherwise a batch that skipped 30 of 36 reports "6 of 6", which reads
  // as complete. sent + failed + skipped is the same arithmetic
  // /compose/send's own toSend.length + skipped.length runs internally.
  const sentTotal = sendResult ? sendResult.sent + sentFailedCount + skippedRecipients.length : 0;

  return (
    <div className="chq-compose-wizard" onKeyDown={handleStepEnterKeyDown}>
      {error && (
        <div className="chq-error-banner" role="alert">
          {error}
          {missingMergeFieldLines && missingMergeFieldLines.length > 0 && (
            <ul>
              {missingMergeFieldLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {/* DEC-317 amendment (wave 60): the third refusal shape --
              'no eligible recipients' -- names each blocked submission the
              same way the merge-field list above does, resolved through
              submissionLabel, beside the recipient selection it refuses. */}
          {noRecipientRefs && noRecipientRefs.length > 0 && (
            <ul className="chq-comms-blocked-list">
              {noRecipientRefs.map((id) => (
                <li key={id}>{submissionLabel(id, preview)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {capMessage && (
        <div className="chq-error-banner" role="alert">
          {capMessage} Narrow your submission selection to {MAX_COMPOSE_RECIPIENTS} or fewer recipients and try again.
        </div>
      )}
      {/* DEC-317 amendment (wave 18): the ics-unscheduled refusal fires from
          runPreview, which can be called off step 2's "Next: preview"
          button (attachIcs was toggled on back on step 3, then the
          organizer went Back and edited the body) -- when it does, the
          wizard stays on the step that issued the request instead of
          advancing, so this refusal has to be visible there too, not only
          inside the preview/sent panels below. Same named list, same
          escape affordances (schedule them / send without them) as the
          preview-step panel -- no press through this wizard can be a
          silent no-op. */}
      {icsUnscheduledIds && step !== 'preview' && step !== 'sent' && (
        <div className="chq-error-banner chq-comms-refusal-banner" role="alert">
          <p>
            Send blocked: these submissions aren&apos;t scheduled yet:{' '}
            {icsUnscheduledIds.map((id) => submissionLabel(id, preview)).join(', ')}. Schedule
            them first, or uncheck &quot;Attach calendar invite&quot;.
          </p>
          <ul className="chq-comms-blocked-list">
            {icsUnscheduledIds.map((id) => (
              <li key={id}>
                {submissionLabel(id, preview)}{' '}
                <Link to="/agenda" className="chq-link-button">
                  Place on the agenda &rsaquo;
                </Link>
              </li>
            ))}
          </ul>
          {scheduledCount > 0 && (
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={busy}
              onClick={() => {
                setStep('sent');
                void send({ excludeIds: icsUnscheduledIds });
              }}
            >
              Send to the {scheduledCount} who have a slot
            </button>
          )}
          <p className="chq-comms-panel-note">Sending cannot be undone, so this is the last point at which it is cheap to fix.</p>
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
          {/* Frame 07-comms--05 + ruling B1: a question heading (never just
              the step-strip's micro-label) plus the reassurance that this
              step alone never sends anything. */}
          <div className="chq-comms-step1-head">
            <h2 className="chq-comms-step1-question">Who is this going to?</h2>
            <span className="chq-comms-step1-reassurance">Nothing sends until step 4</span>
          </div>
          <div className="chq-comms-status-filter">
            <div className="chq-comms-status-pills" role="group" aria-label="Status">
              {SUBMISSION_STATUSES.map((status) => {
                const count = statusCounts[status];
                return (
                  <label
                    key={status}
                    className={
                      statusFilter.includes(status) ? 'chq-pill chq-comms-status-pill is-active' : 'chq-pill chq-comms-status-pill'
                    }
                  >
                    <input
                      type="checkbox"
                      className="chq-comms-status-pill-input"
                      checked={statusFilter.includes(status)}
                      onChange={() => toggleStatus(status)}
                    />
                    {STATUS_LABELS[status]}
                    {/* aria-hidden: the count is a courtesy annotation, not
                        part of the pill's name -- 'Accepted' must stay
                        'Accepted' for a screen reader (and for every
                        existing getByRole('checkbox', { name: 'Accepted' })
                        test) whether or not the count has loaded. */}
                    {count !== null && (
                      <span className="chq-comms-status-pill-count" aria-hidden="true">
                        {' '}
                        &middot; {count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {/* A visible-but-visually-hidden wrapping label element (rather
                than aria-label) keeps this control's accessible name "Search"
                while its placeholder stays the string the text-caps
                exemption ledger names it by (app/src/text-caps.scan.test.ts,
                out of this page's ownership) -- an aria-label here would win
                over the placeholder in that scan's id>aria-label>placeholder
                priority and orphan the ledger entry. */}
            <label className="chq-comms-status-search-label">
              <span className="chq-comms-visually-hidden">Search</span>
              <input
                type="text"
                className="chq-input chq-comms-status-search"
                value={q}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search submissions"
              />
            </label>
          </div>
          {/* DEC-350 amendment (wave 51, ruling A1): the selection bar sits
              below the filters and directly above the table, only when the
              selection is non-empty. It keeps both constraints the panel
              note used to carry alone -- selection survives filter changes,
              and the recipient cap fact -- in chrome voice (counts and
              nouns, no explanatory clauses). Frame 07-comms--05: the action
              cluster (Select all &middot; Clear) is right-flushed, never
              mid-row. */}
          {selection.selectedIds.size > 0 && (
            <div className="chq-bulkbar" role="toolbar" aria-label="Selection">
              <span className="chq-bulkbar-count">{countOf(selection.selectedIds.size, 'submission')} selected</span>
              <span className="chq-bulkbar-note">
                Kept as you change filters &middot; {selection.selectedIds.size} is{' '}
                {selection.selectedIds.size > MAX_COMPOSE_RECIPIENTS ? 'over' : 'under'} the {MAX_COMPOSE_RECIPIENTS}-recipient cap
              </span>
              <div className="chq-bulkbar-actions">
                <button type="button" className="chq-btn chq-btn-tertiary" disabled={total === 0} onClick={() => void selectAllShown()}>
                  {statusFilter.length === 1
                    ? `Select all ${total} ${STATUS_LABELS[statusFilter[0]!].toLowerCase()}`
                    : `Select all ${total} shown`}
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  onClick={() => dispatchSelection({ type: 'CLEAR' })}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* DEC-678 (wave-3/wave-8, proven by app/src/admin-first-paint.
              render.test.tsx): the recipient table is Comms' main region on
              first load, so its wait paints shaped placeholder rows on the
              FIRST frame. DelayedLoading withheld for 250ms and left column
              headers over an empty body -- structure flicker is not the risk
              DEC-678 opened with, label flicker is. */}
          {loadingSubmissions && <PageSkeleton variant="table" label="Loading submissions…" />}
          {!loadingSubmissions && submissions.length === 0 ? (
            // DEC-678 (B7 rule 6, wave 47): the status set IS the facet
            // narrowing this list to nothing -- a full <thead> over a
            // one-cell apology is exactly the pattern B7 forbids. 'filtered'
            // names the selected statuses in `reason` and offers the one
            // escape that clears the facet (restores the default status
            // selection); it never renders a primary action here (the fix is
            // "change the filter", not "do a new thing").
            <EmptyState
              variant="filtered"
              what="No submissions match the selected statuses."
              reason={
                statusFilter.length > 0
                  ? `Filtered by status: ${statusFilter.map((s) => STATUS_LABELS[s]).join(', ')}`
                  : 'No statuses are selected.'
              }
              escape={{
                label: 'Select every status',
                onClick: () => {
                  setStatusFilter(DECIDED_STATUSES);
                  setPage(1);
                },
              }}
            />
          ) : (
            <table className="chq-table chq-comms-compose-table">
              <thead>
                <tr>
                  <th className="chq-comms-compose-col-select">
                    <input
                      type="checkbox"
                      className="chq-check"
                      checked={isPageFullySelected(selection, pageIds)}
                      ref={(el) => {
                        if (el) el.indeterminate = isPagePartiallySelected(selection, pageIds);
                      }}
                      onChange={() => dispatchSelection({ type: 'TOGGLE_PAGE', pageIds })}
                      aria-label="Select every submission on this page"
                    />
                  </th>
                  <th className="chq-comms-compose-col-title">Submission</th>
                  <th className="chq-comms-compose-col-speaker">Speakers</th>
                  <th className="chq-comms-compose-col-status">Status</th>
                  <th className="chq-comms-compose-col-slot">Slot</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        className="chq-check"
                        checked={selection.selectedIds.has(s.id)}
                        onChange={() => dispatchSelection({ type: 'TOGGLE_ROW', id: s.id })}
                        aria-label={`Select ${s.title}`}
                      />
                    </td>
                    <td data-label="Title">{s.title}</td>
                    <td data-label="Speakers">{s.speakers.map((sp) => sp.name).join(', ')}</td>
                    <td data-label="Status" className="chq-comms-compose-status-cell">
                      {STATUS_LABELS[s.status]}
                    </td>
                    {/* DEC-051/DEC-780 amendment (findings wave 8): the fact
                        that decides whether a calendar invite can be
                        attached moves here, from step 3's icsUnscheduledIds
                        refusal -- step 1 informs, it never gates or
                        pre-filters. 'No slot yet' in the ink micro-label
                        register (chq-flag, DEC-367 type-only), never a
                        dash. Frame 07-comms--05: kept on one line (never
                        inflating the row) via the shared column class below. */}
                    <td data-label="Slot">
                      {s.slot ? (
                        `${formatDayLabel(s.slot.day)} ${clockHHMM(s.slot.startMin)}`
                      ) : (
                        <span className="chq-flag">No slot yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* DEC-678 amendment (B7 rule 5, wave 53): this step-1 result is
              NEVER fresh -- the selected status set is always the facet
              narrowing it (see the EmptyState above), so unlike a true
              fresh zero-state the pager is never chrome over a collection
              that has never held a row; it stays, because chrome is how a
              filter gets undone. */}
          {!loadingSubmissions && (
            <div className="chq-pager">
              <span>
                {paginationSummary(page, PER_PAGE, total)}
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
          )}

          {/* w8-d (DEC-051/DEC-780 amendment): the step-1 primary moves into
              a footer row, matching step 2/3's chq-comms-*-actions rows,
              instead of sitting loose under the pager. Frame 07-comms--05:
              a left note naming who has no slot yet, and a right-flushed
              Cancel/primary pair. */}
          <div className="chq-comms-select-footer">
            <span className="chq-comms-select-footer-note">
              {selectedNoSlotCount > 0
                ? `${selectedNoSlotCount} ${plural(selectedNoSlotCount, 'has', 'have')} no slot yet — they can still be emailed, but not sent a calendar invite`
                : null}
            </span>
            <div className="chq-comms-select-actions">
              <Link to="/comms" className="chq-btn chq-btn-secondary">
                Cancel
              </Link>
              <button
                type="button"
                ref={selectPrimaryRef}
                className="chq-btn chq-btn-primary"
                disabled={selection.selectedIds.size === 0}
                onClick={() => setStep('template')}
              >
                Next: choose a template
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 'template' && (
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">2. Pick or edit a template</span>
          </div>
          {idsKeptCount !== null && idsArrivedCount !== null && idsKeptCount < idsArrivedCount && (
            <p className="chq-comms-panel-note">
              {idsKeptCount} of {idsArrivedCount} kept &middot; a send is capped at {MAX_COMPOSE_RECIPIENTS}
            </p>
          )}
          {templatesLoadError && (
            <p className="chq-field-error">
              Templates could not be loaded &mdash; write your message from scratch, or reload the page to try again.
            </p>
          )}
          <FormRow label="Template" htmlFor="compose-template" optional>
            <select
              id="compose-template"
              className="chq-select"
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                const found = templates.find((t) => t.id === id);
                if (found) {
                  // DEC-832 (DEC-846 amendment, wave 66): copy the template's
                  // text into the composer's own fields AND keep the
                  // selection — templateId tracks the picked template so the
                  // send carries provenance (History's TEMPLATE cell,
                  // template chips, Templates' "Last used"). Further edits to
                  // subject/body are still what get sent, not the stored
                  // template text, but the id travels with the send.
                  setTemplateName(found.name);
                  setSubject(found.subject);
                  setBodyText(found.bodyText);
                  setTemplateId(found.id);
                } else if (id === '') {
                  // User-filed (gate-9): with the w12-c auto-apply having
                  // pre-filled the composer, the dropdown already READS
                  // "Write from scratch" while holding template text — so an
                  // EXPLICIT scratch pick must mean what it says: empty the
                  // composer, not just the selection.
                  setTemplateName('');
                  setTemplateId('');
                  setSubject('');
                  setBodyText('');
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
            <input id="compose-subject" className="chq-input" maxLength={MAX_TEXT_LENGTH} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </FormRow>
          <FormRow label="Body" htmlFor="compose-body">
            <textarea
              id="compose-body"
              className="chq-textarea"
              rows={8}
              ref={bodyRef}
              maxLength={MAX_RICH_TEXT_LENGTH}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </FormRow>
          <div className="chq-comms-template-body-merge-chips">
            <InsertFieldMenu
              fields={COMPOSE_MERGE_FIELDS.filter((field) => field !== 'feedback' || plans.length > 0)}
              onInsert={insertMergeField}
            />
          </div>
          <p className="chq-comms-panel-note">
            Merge fields fill in per recipient &mdash; shown resolved in Preview.
          </p>
          {/* DEC-955: {feedback} needs a plan named before composeBody() can
              carry includeFeedback -- reveal the plan picker right where the
              chip was inserted rather than letting the preview 400 for a
              missing field the organizer had no way to fix here. */}
          {bodyText.includes('{feedback}') && !includeFeedback && (
            <label className="chq-comms-template-label">
              {'{feedback}'} needs a plan
              <select
                className="chq-select"
                value={feedbackPlanId}
                onChange={(e) => {
                  const next = e.target.value;
                  setFeedbackPlanId(next);
                  setIncludeFeedback(true);
                }}
              >
                <option value="">Choose a plan&hellip;</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Gate-8 P0: the wizard's one error banner renders at the very
              top, off-viewport from this scrolled step — a preview refusal
              (e.g. an unknown merge field in an edited body) read as a
              silent dead-end at the button. The refusal repeats HERE, at
              the control that produced it (DEC-856 grammar). */}
          {error ? (
            <p className="chq-field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="chq-comms-template-actions">
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('select')}>
              Back
            </button>
            <button
              type="button"
              ref={templatePrimaryRef}
              className="chq-btn chq-btn-primary"
              disabled={busy || !subject || !bodyText}
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
                  <div className="chq-comms-recipient-meta">
                    {r.email} &middot; {r.ref}
                  </div>
                </div>
                {/* DEC-912: the scheduled flag names the talk's slot state
                    unconditionally -- never gated on the attachIcs toggle,
                    which only governs whether an invite is attached. */}
                <span className="chq-flag">{r.scheduled ? 'Scheduled' : 'No slot yet'}</span>
              </div>
            ))}
            {preview.length === 0 && <p>No recipients to preview.</p>}
            {preview.length > 0 && (
              <div className="chq-comms-overflow">
                {overflowCount > 0 && <>{overflowCount} more &middot; </>}
                {preview.length} is {preview.length >= MAX_COMPOSE_RECIPIENTS ? 'at' : 'under'} the {MAX_COMPOSE_RECIPIENTS}-recipient
                cap
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
              {plansLoadError && (
                <p className="chq-field-error">
                  Evaluation plans could not be loaded &mdash; feedback merge is unavailable this session.
                </p>
              )}
              {/* Ruling A18: the plan select is a PARAMETER of "Include
                  reviewer feedback", not a peer field -- indented under the
                  checkbox it belongs to and revealed only by it. */}
              {includeFeedback && (
                <div className="chq-comms-panel-indent">
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
                  </label>
                  <span className="chq-comms-panel-note">Only submitted, non-recused reviews are merged.</span>
                  {feedbackPlanId === '' && (
                    <span className="chq-comms-panel-note">Choose a plan to merge its feedback.</span>
                  )}
                  {feedbackPlanId &&
                    (() => {
                      const selectedPlan = plans.find((p) => p.id === feedbackPlanId);
                      return selectedPlan ? (
                        <span className="chq-comms-panel-note">
                          Round {selectedPlan.currentRound} of {selectedPlan.name}
                        </span>
                      ) : null;
                    })()}
                </div>
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
              {attachIcs && noSlotCount > 0 && (
                <span className="chq-comms-panel-note">
                  {noSlotCount} of {preview.length} have no slot yet &mdash; those get no invite
                </span>
              )}
              {/* Frame 07-comms--13 ("Check before sending"): the compose
                  pre-flight refusal -- ink-edged register (chq-comms-
                  refusal-banner), and a right-flushed three-action row
                  instead of the single left-aligned secondary this used to
                  end on. */}
              {icsUnscheduledIds && (
                <div className="chq-error-banner chq-comms-refusal-banner" role="alert">
                  <p>
                    Send blocked: these submissions aren&apos;t scheduled yet:{' '}
                    {icsUnscheduledIds.map((id) => submissionLabel(id, preview)).join(', ')}. Schedule
                    them first, or uncheck &quot;Attach calendar invite&quot;.
                  </p>
                  <ul className="chq-comms-blocked-list">
                    {icsUnscheduledIds.map((id) => (
                      <li key={id}>
                        {submissionLabel(id, preview)}{' '}
                        <Link to="/agenda" className="chq-link-button">
                          Place on the agenda &rsaquo;
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="chq-comms-refusal-footer">
                    <p className="chq-comms-panel-note chq-comms-refusal-caption">
                      Sending cannot be undone, so this is the last point at which it is cheap to fix.
                    </p>
                    <div className="chq-comms-refusal-actions">
                      {/* DEC-793 amendment (wave 28): the hard block on the
                          unmodified Send stays -- this is an additional path,
                          never a replacement, and it actually reduces the
                          posted submissionIds rather than silently narrowing
                          the audience. */}
                      {scheduledCount > 0 && (
                        <button
                          type="button"
                          className="chq-btn chq-btn-secondary"
                          disabled={busy}
                          onClick={() => {
                            setStep('sent');
                            void send({ excludeIds: icsUnscheduledIds });
                          }}
                        >
                          Send to the {scheduledCount} who have a slot
                        </button>
                      )}
                      <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('template')}>
                        Edit the template
                      </button>
                      <Link to="/agenda" className="chq-btn chq-btn-primary">
                        {icsUnscheduledIds.length === 1 ? 'Place it first' : `Place all ${spellCount(icsUnscheduledIds.length)} first`}
                      </Link>
                    </div>
                  </div>
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
              {/* Ruling B1: Send moves to step 4 -- this primary only
                  advances; the dedicated ConfirmDialog is gone because
                  step 4 pre-send IS the confirmation (one ask, same click
                  depth). The hard ICS block still gates advancing past
                  this step, since step 4 no longer has a way back into the
                  attachments toggle that produced it. */}
              <button
                type="button"
                ref={previewPrimaryRef}
                className="chq-btn chq-btn-primary"
                disabled={busy || icsUnscheduledIds !== null}
                onClick={() => setStep('sent')}
              >
                Next: send &rsaquo;
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('template')}>
                Back to the template
              </button>
            </div>
          </section>
        </section>
      )}

      {step === 'sent' && !sendResult && (
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">4. Send</span>
          </div>
          <p>
            {countOf(preview.length, 'recipient')} &middot; {resolvedSendSubject}
          </p>
          {/* Pre-flight exclusions, named individually -- never just a
              count. The wizard already computed both of these on the
              preview step; step 4 restates them right before the
              irreversible action. */}
          {attachIcs && noSlotCount > 0 && (
            <div className="chq-comms-panel-note">
              <p>
                {noSlotCount} of {preview.length} have no slot yet &mdash; excluded from the calendar invite:
              </p>
              <ul>
                {preview
                  .filter((r) => !r.scheduled)
                  .map((r) => (
                    <li key={r.contactId + r.submissionId}>
                      {r.ref} &mdash; {r.name}: no slot yet, no invite attached
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {icsUnscheduledIds && (
            <div className="chq-error-banner chq-comms-refusal-banner" role="alert">
              <p>
                Send blocked: these submissions aren&apos;t scheduled yet:{' '}
                {icsUnscheduledIds.map((id) => submissionLabel(id, preview)).join(', ')}. Schedule
                them first, or uncheck &quot;Attach calendar invite&quot;.
              </p>
              <ul className="chq-comms-blocked-list">
                {icsUnscheduledIds.map((id) => (
                  <li key={id}>
                    {submissionLabel(id, preview)}{' '}
                    <Link to="/agenda" className="chq-link-button">
                      Place on the agenda &rsaquo;
                    </Link>
                  </li>
                ))}
              </ul>
              {/* DEC-793 amendment (wave 28): same partial path as the
                  preview step's banner -- the hard block on the unmodified
                  Send below stays. */}
              {scheduledCount > 0 && (
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  disabled={busy}
                  onClick={() => void send({ excludeIds: icsUnscheduledIds })}
                >
                  Send to the {scheduledCount} who have a slot
                </button>
              )}
              <p className="chq-comms-panel-note">Sending cannot be undone, so this is the last point at which it is cheap to fix.</p>
            </div>
          )}
          <div className="chq-comms-preview-actions">
            <button
              type="button"
              className={`chq-btn chq-btn-primary ${sendPendingLabel.buttonProps.className}`.trim()}
              disabled={sendPendingLabel.buttonProps.disabled || icsUnscheduledIds !== null}
              onClick={() => void send()}
            >
              {/* wave-60 amendment (DEC-238, P1 cluster 4): the button names
                  the count the server will actually attempt -- the same
                  dedupe plan preview computed -- never the raw
                  (contact,submission) expansion (preview.length), which is
                  what produced "Send 36 emails" against a 6-sent history
                  row. DEC-733: while sending, the label itself becomes the
                  progress indicator (usePendingLabel) instead. */}
              {sendPendingLabel.label}
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setStep('preview')}>
              Back to the preview
            </button>
          </div>
          {/* A collapsed recipient is named quietly here, before the send,
              never only after (the result panel below repeats it with full
              per-recipient reasons). No count on this screen is invented:
              previewPlan.skipped is the exact list /compose/send is about
              to compute the same way. */}
          {previewPlan.skipped.length > 0 && (
            <p className="chq-comms-panel-note">
              {countOf(previewPlan.skipped.length, 'duplicate/recently-sent recipient')} will be skipped.
            </p>
          )}
        </section>
      )}

      {step === 'sent' && sendResult && (
        <section>
          {/* DEC-238 amendment (findings wave 5): the framed send REPORT
              (docs/design/Chautauqua Comms.dc.html :495-536) -- eyebrow +
              headline carry `sent`, the skipped section carries `skipped`,
              and <SendFailures/> below carries `remaining`. No separate
              counts stack: the interim wave-3 paragraph is gone, per the
              amendment. */}
          <div className="chq-comms-send-report-head">
            <div className="chq-comms-send-report-head-titles">
              <span className="chq-comms-send-report-eyebrow">Send complete</span>
              <h1 className="chq-comms-send-report-headline">
                {sendResult.sent} of {sentTotal} speakers were emailed
                {partialExcludedIds && partialExcludedIds.length > 0
                  ? ` — ${partialExcludedIds.length} excluded (not yet scheduled)`
                  : ''}
              </h1>
            </div>
            {/* DEC-834 / DEC-837: the router's basename is already '/admin' -- a
                `to` starting with '/admin/comms' resolves to
                '/admin/admin/comms' and 404s. */}
            <Link to="/comms?tab=history" className="chq-comms-send-report-all-history">
              All history &rsaquo;
            </Link>
          </div>

          <div className="chq-comms-send-report-grid">
            <span className="chq-comms-send-report-grid-label">Template</span>
            <span className="chq-comms-send-report-grid-value">{templateName || 'No template'}</span>
            <span className="chq-comms-send-report-grid-label">Subject they saw</span>
            <span className="chq-comms-send-report-grid-value">{resolvedSendSubject}</span>
            <span className="chq-comms-send-report-grid-label">Sent</span>
            {/* The client never invents/hard-codes a from-address -- this
                composer holds no such field, so the value states only the
                fact it does have (when, by whom). A future wave that gives
                the composer a from-address appends " · from <address>". */}
            <span className="chq-comms-send-report-grid-value">Just now, by you</span>
          </div>

          {/* DEC-238 amendment (wave 3): a skip is never silent -- every
              recipient the dedupe window held back is named here with the
              time it becomes eligible again. DEC-238 ruling item 4: no
              'send anyway' override this wave -- the retry action states
              WHEN, never a control that fires early. */}
          {skippedRecipients.length > 0 && (
            <section className="chq-comms-send-report-skipped">
              <div className="chq-comms-send-report-skipped-head">
                <span className="chq-comms-send-report-skipped-label">
                  {capitalizeFirst(spellCount(skippedRecipients.length))}{' '}
                  {plural(skippedRecipients.length, 'was', 'were')} skipped
                </span>
                <span className="chq-comms-send-report-skipped-caption">
                  Nothing was sent to these {spellCount(skippedRecipients.length)}
                </span>
              </div>
              {skippedRecipients.map((r) => (
                <div className="chq-comms-send-report-skipped-row" key={r.email + r.submissionId}>
                  <div className="chq-comms-send-report-skipped-who">
                    <span className="chq-comms-send-report-skipped-name">{r.name}</span>
                    <span className="chq-comms-send-report-skipped-email">{r.email}</span>
                  </div>
                  <span className="chq-comms-send-report-skipped-reason">
                    {r.reason === 'duplicate_in_batch'
                      ? 'Same message, same address, already in this batch.'
                      : `Already sent within the hour, for ${submissionLabel(r.submissionId, preview)}.`}
                  </span>
                  {r.reason === 'already_sent_recently' && (
                    <span className="chq-comms-send-report-skipped-retry">
                      Send in {retryMinutes(r.retryAtIso!)} minutes
                    </span>
                  )}
                </div>
              ))}
              <p className="chq-comms-send-report-skipped-note">
                The dedupe window stops a speaker being emailed twice in an hour by two organisers
                working at once. It clears on its own.
              </p>
            </section>
          )}

          {/* DEC-793 amendment (wave 28): the partial-send path never
              silently shrinks the audience -- every excluded recipient is
              named here under its own heading, same as the failed list
              below. */}
          {partialExcludedIds && partialExcludedIds.length > 0 && (
            <div className="chq-comms-panel-note">
              <p>Excluded ({partialExcludedIds.length} not yet scheduled):</p>
              <ul>
                {partialExcludedIds.map((id) => (
                  <li key={id}>{submissionLabel(id, preview)}</li>
                ))}
              </ul>
            </div>
          )}
          {sentFailedCount > 0 && <SendFailures failed={sendResult.failed ?? []} />}

          <div className="chq-comms-send-report-footer">
            <span className="chq-comms-send-report-footer-note">
              All {sendResult.sent} are in History, each with the address it went to
            </span>
            <div className="chq-comms-send-report-footer-actions">
              <button type="button" className="chq-btn chq-btn-secondary" onClick={reset}>
                Compose another
              </button>
              <Link to="/comms" className="chq-btn chq-btn-primary">
                Back to Comms
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
