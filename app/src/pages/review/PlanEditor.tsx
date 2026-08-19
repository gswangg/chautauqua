import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { useIsPhone } from '../../lib/useIsPhone';
import { setNavLeaveGuard } from '../../lib/useNavExceptions';
import { copyText } from '../../lib/clipboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateField } from '../../components/DateField';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import {
  addCriterion,
  addCriterionOption,
  moveCriterionOption,
  removeCriterion,
  removeCriterionOption,
  updateCriterion,
  updateCriterionOption,
  validateCriteriaList,
  validatePlanDraft,
  type PlanValidationErrors,
} from './planForm';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { OPTIONAL_SUFFIX } from '../../../../src/domain/form-copy';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';
import { plural } from '../../lib/plural';
// DEC-708: the same name-or-email resolver ProgressPanel uses -- a plan
// reviewer row names a person by their resolved contact, never a
// fabricated name, falling back to the bare email.
import { progressTotals, reviewerDisplayLabel } from './progress';
import './review.css';
import {
  DEFAULT_PLAN_DRAFT,
  type CriterionKind,
  type EvaluationCriterion,
  type EvaluationPlan,
  type PlanDraft,
  type DistributePreview,
  type PlanDeleteImpact,
  type PlanReviewer,
  type ProgressRow,
  type ReviewerOption,
  type ScopePreview,
  type Track,
} from './types';
// DEC-676: the plan editor's weighted-share display and new-plan defaults
// are computed by the same pure domain functions the server uses -- no
// re-derivation of the weight-share math client-side.
import {
  criterionWeightShares,
  DEFAULT_PLAN_CRITERIA,
  isPlanOpen,
} from '../../../../src/domain/evaluation';
import { MAX_CRITERION_GUIDANCE_LENGTH } from '../../lib/domain-caps';
import { DEC_745, DEC_786, DEC_824, DEC_882, DEC_715, DEC_213, DEC_124, DEC_958, DEC_018 } from '../../../../src/decisions';
import { countOf } from '../../lib/plural';
// w40-e/DEC-745 amendment: the reviewer roster is the ONE place an
// assignment can be Removed, so it must request/page through the site-wide
// cap like ReviewerQueue.tsx's own "Show all N" affordance, never silently
// truncate at listPerPage's default.
import { MAX_PER_PAGE, MAX_PAGE } from '../../../../src/lib/pagination';
import { MAX_PLAN_CRITERIA, MIN_CRITERION_OPTIONS, MAX_CRITERION_OPTIONS } from '../../lib/batch-caps';
import { CRITERION_KIND_LABELS } from '../../lib/criterion-kind';

void DEC_745; // v4 shell: title-row NAME/Duplicate/Save, 2x2 field grid, "Who reviews what" below
void DEC_786; // "Distribute evenly" link below: preview-then-confirm, zero non-GET requests before confirm
void DEC_824; // cap-per-reviewer input + shortfall/note rendering in the confirm dialog below
void DEC_018; // Amendment (wave 102): editable criterion row's per-row TYPE <select>, six-track grid
void DEC_882; // locked criteria render as read-only text rows below a CRITERION|GUIDANCE|WEIGHT
// header, lock card moved below the rows, and the open-plan header reads
// "Open · N of M reviews in" from progressRows via progressTotals -- never
// a second count derived here.
// w41-f/DEC-715: every criterion row (locked, unlocked, new-plan) carries
// the ONE reorder affordance -- a keyboard-operable drag-handle <button>,
// reusing the form-builder's markup/class (chq-forms-field-drag, see
// app/src/pages/forms/FieldList.tsx) rather than a second implementation.
// Locked criteria cannot reorder, so the handle is ABSENT (not disabled)
// on a locked row.
void DEC_715;
// w25-g/DEC-745 amendment (A9/A10): the anonymise toggle and Delete plan
// both freeze at the plan's first submitted review, using the SAME
// predicate the per-round criteria freeze already reads (DEC-213) --
// summed across every round rather than scoped to the active tab, since
// both are plan-wide, not round-scoped.
void DEC_213;
// w28-b/DEC-124: the plan editor's save-rejection reuses the ONE admin-SPA
// error vocabulary -- ErrorSummary at the top of the form plus a
// .chq-field-error/chq-field-invalid pair on every offending control, never
// a page-local error style.
void DEC_124;

// DEC-958 (wave-64 amendment): POST /plans/:id/reviewers throws SIX distinct
// refusals from three call sites (assign-one, assign-all-in-track,
// assign-chosen) that all share the top-level message "Invalid reviewer
// assignment" -- the fields-map KEY is the only thing that distinguishes
// them. A per-key matcher (not a per-message one) below renders every known
// key against the control that owns it and any UNKNOWN key by its own name,
// so a seventh shape lands as `<key>: <message>` rather than falling
// through to the generic four-word top-level message.
void DEC_958;
const REVIEWER_ASSIGN_FIELD_LABELS: Record<string, { anchorId: string; label: string }> = {
  userId: { anchorId: 'plan-reviewer-select', label: 'Reviewer' },
  trackId: { anchorId: 'plan-reviewer-track-select', label: 'Track' },
  submissionId: { anchorId: 'plan-reviewer-submission-select', label: 'Submission' },
  submissionIds: { anchorId: 'plan-reviewer-choose-submissions', label: 'Submissions' },
};

/** Walks the WHOLE err.fields map (never a single named key) against a
 * given field-label map -- known keys anchor to the control that owns
 * them, unknown keys anchor to their own key name rather than being
 * dropped. Shared by reviewerAssignProblems and planSaveErrorProblems
 * (DEC-124 wave-56 amendment) below, so this file has ONE err.fields
 * walker rather than one per call site. */
function fieldProblems(
  err: ApiError,
  labels: Record<string, { anchorId: string; label: string }>,
): { anchorId: string; label: string }[] {
  if (!err.fields) return [];
  return Object.entries(err.fields).map(([key, message]) => {
    const known = labels[key];
    return known
      ? { anchorId: known.anchorId, label: `${known.label}: ${message}` }
      : { anchorId: key, label: `${key}: ${message}` };
  });
}

function reviewerAssignProblems(err: ApiError): { anchorId: string; label: string }[] {
  return fieldProblems(err, REVIEWER_ASSIGN_FIELD_LABELS);
}

// DEC-124 (wave-56 amendment): the field-label map for a rejected plan
// save (POST /events/:eventId/plans, PATCH /plans/:id) -- keyed against
// src/routes/review/plans-crud.ts:88/:151's `errors` object, which speaks
// the SERVER's wire vocabulary (maxEvaluations/openDate/closeDate), not
// the client draft's PlanValidationErrors vocabulary above
// (maxEvaluationsPerSubmission/openAt/closeAt -- a different map, for a
// different, client-side-only validation pass). Keys with no editable
// control in this editor yet (instructions has no field here; rounds only
// advances via "Start a new wave"; roundCriteria/roundMeta are whole-map
// errors with no single control to anchor to) fall through to
// fieldProblems' own-key-name fallback rather than pointing at a fake id.
const SAVE_ERROR_FIELD_LABELS: Record<string, { anchorId: string; label: string }> = {
  name: { anchorId: 'plan-name', label: 'Name' },
  scale: { anchorId: 'plan-scale-min', label: 'Rating scale' },
  criteria: { anchorId: 'plan-criteria', label: 'Scoring criteria' },
  maxEvaluations: { anchorId: 'plan-max-evaluations', label: 'Reviews per talk' },
  openDate: { anchorId: 'plan-open-at', label: 'Opens' },
  closeDate: { anchorId: 'plan-close-at', label: 'Closes' },
};

function planSaveErrorProblems(err: ApiError): { anchorId: string; label: string }[] {
  return fieldProblems(err, SAVE_ERROR_FIELD_LABELS);
}

// w28-b/DEC-745/DEC-124: fields the summary can anchor to. 'rounds' has no
// editable control in this editor (rounds only advances via "Start a new
// wave"), so a rounds error -- currently unreachable from this UI -- is
// deliberately left out of both maps rather than pointed at a fake id.
const PLAN_ERROR_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  scale: 'Rating scale',
  maxEvaluationsPerSubmission: 'Reviews per talk',
  closeAt: 'Closes',
  criteria: 'Scoring criteria',
};
const PLAN_ERROR_FIELD_ANCHORS: Record<string, string> = {
  name: 'plan-name',
  scale: 'plan-scale-min',
  maxEvaluationsPerSubmission: 'plan-max-evaluations',
  closeAt: 'plan-close-at',
  criteria: 'plan-criteria',
};

/** Builds the ErrorSummary's one-problem-per-error list, each anchorId a
 * real element id in the form below -- top-level fields via the map above,
 * per-criterion shape errors via the row's own id convention. */
function planErrorSummaryProblems(errors: PlanValidationErrors): { anchorId: string; label: string }[] {
  const problems: { anchorId: string; label: string }[] = [];
  for (const key of Object.keys(errors)) {
    const anchorId = PLAN_ERROR_FIELD_ANCHORS[key];
    if (anchorId) {
      problems.push({ anchorId, label: PLAN_ERROR_FIELD_LABELS[key]! });
      continue;
    }
    const match = key.match(/^criterion\.(.+)\.(label|weight|options)$/);
    if (match) {
      const [, criterionId, sub] = match;
      const subLabel = sub === 'label' ? 'Criterion label' : sub === 'weight' ? 'Criterion weight' : 'Criterion options';
      problems.push({ anchorId: `criterion-${criterionId}-${sub}`, label: subLabel });
    }
  }
  return problems;
}

function defaultDraftCriteria(): EvaluationCriterion[] {
  return DEFAULT_PLAN_CRITERIA.map((c) => ({ ...c }));
}

// DEC-715: the ONE reorder write path for the criteria list -- both the
// keyboard (ArrowUp/ArrowDown on the handle button) and the drag-drop paths
// below call this, mirroring FieldList.tsx's onMove(field, delta) contract.
function moveCriterion(criteria: EvaluationCriterion[], id: string, delta: number): EvaluationCriterion[] {
  const index = criteria.findIndex((c) => c.id === id);
  if (index < 0) return criteria;
  const target = index + delta;
  if (target < 0 || target >= criteria.length) return criteria;
  const next = [...criteria];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

// DEC-674 (wave-58 amendment, mirrored from PlanList's isWindowOpen): a
// plan's window is "open" iff the shared domain isPlanOpen (which expands
// the day-label openAt/closeAt through the event's own timezone) says so --
// never a bare `< now`/`> now` comparison against a day label here.
function isPlanOpenNow(openAt: number | null, closeAt: number | null, now: number, timeZone: string): boolean {
  return isPlanOpen(openAt, closeAt, now, timeZone);
}

// DEC-840: a non-empty shortfall renders as a sentence naming the
// constraint AND the track -- grouped by (reason, track) so a run with
// several stuck submissions in the same track reads as one honest count,
// not a wall of per-submission lines.
// DEC-840 amendment (wave 51): frame 03's distribute-preview anatomy --
// "N talks · M reviews needed at K each · R reviewers" -- computed from the
// preview payload the editor already has, never a second fetch. `talks` is
// the distinct submissions this run touches (items ∪ shortfall); `reviews`
// is talks × the plan's own reviews-per-talk setting.
// DEC-840 wave-51 / DEC-745 wave-72: the ONE "N talks · M reviews needed at
// K each · R reviewers" grammar -- both the confirm panel's post-preview
// summary and the persistent cap row's pre-click summary read through this,
// never a second wording of the same sentence.
function distributeSummaryText(talks: number, reviewsPerTalk: number, reviewers: number): string {
  const reviewsNeeded = talks * reviewsPerTalk;
  return `${countOf(talks, 'talk')} · ${countOf(reviewsNeeded, 'review')} needed at ${reviewsPerTalk} each · ${countOf(reviewers, 'reviewer')}`;
}

// DEC-745 (wave-72 amendment): the persistent cap row's summary before any
// Distribute click -- fed from the progress endpoint's submissionsInScope +
// the plan's own reviews-per-talk + the reviewer roster already on the
// page, through the SAME distributeSummaryText grammar. DEC-745 also
// retires the confirm panel's own copy of this line (it repeated the cap
// row, DEC-840 wave-51) -- this is now the ONE place the sentence renders.
function capRowSummaryLine(submissionsInScope: number, reviewsPerTalk: number, reviewerCount: number): string {
  return distributeSummaryText(submissionsInScope, reviewsPerTalk, reviewerCount);
}

// DEC-840: a reviewer the run could not use is LISTED with its reason,
// never omitted -- this is the closed-vocabulary text for the "unchanged"
// cell, shared with the sentence-form shortfall summaries above.
function distributeReviewerCell(pr: DistributePreview['perReviewer'][number]): string {
  if (pr.added > 0) return `${pr.before} → ${pr.after} talks`;
  if (!pr.reason) return 'unchanged';
  return `unchanged · ${pr.reason === 'wrong_track' ? 'wrong track' : 'at cap'}`;
}

function shortfallSummaries(shortfall: DistributePreview['shortfall']): { key: string; text: string }[] {
  const groups = new Map<string, { reason: 'cap_reached' | 'no_eligible_reviewer'; trackName: string | null; needed: number }>();
  for (const s of shortfall) {
    const key = `${s.reason}::${s.trackName ?? ''}`;
    const existing = groups.get(key);
    if (existing) existing.needed += s.needed;
    else groups.set(key, { reason: s.reason, trackName: s.trackName, needed: s.needed });
  }
  return [...groups.entries()].map(([key, g]) => {
    const noun = plural(g.needed, 'review stays', 'reviews stay');
    const constraint =
      g.reason === 'cap_reached'
        ? g.trackName
          ? `the cap is reached and nobody else covers ${g.trackName}`
          : 'the cap is reached'
        : g.trackName
          ? `no eligible reviewer covers ${g.trackName}`
          : 'no eligible reviewer remains';
    return { key, text: `${g.needed} ${noun} unassigned — ${constraint}.` };
  });
}

export function PlanEditor() {
  const { planId } = useParams<{ planId: string }>();
  const isNew = !planId || planId === 'new';
  const navigate = useNavigate();
  const { eventId } = useCurrentEvent();
  // w1-g/DEC-745 wave-98 amendment: the same matchMedia(700px) hook
  // Scorecard.tsx/Agenda.tsx already use to split their phone-only trees --
  // gates the below-roster "Assign a reviewer" trigger (frame :663) so it
  // exists only on a phone render, never hidden-by-CSS-but-present-in-the-
  // DOM on desktop.
  const isPhone = useIsPhone();

  // DEC-676: a brand-new plan prefills the three editable defaults instead
  // of an empty criteria list (isNew is stable for the component's life --
  // planId only changes via a route remount).
  const [draft, setDraft] = useState<PlanDraft>(
    isNew ? { ...DEFAULT_PLAN_DRAFT, criteria: defaultDraftCriteria() } : DEFAULT_PLAN_DRAFT,
  );
  // wave 49/DEC-745 amendment: the dirty-navigation-guard baseline. Captured
  // once at load (isNew's initial draft above is already the pristine
  // value for a brand-new plan) and reset only by save() -- same shape as
  // TracksRoomsPanel.tsx's trackBaseline/isTrackDirty pair, never
  // re-derived from the server mid-edit.
  const [pristineDraft, setPristineDraft] = useState<PlanDraft>(draft);
  // DEC-674 (wave-58 amendment): the loaded plan's own event timezone,
  // needed to delegate isPlanOpenNow to the shared isPlanOpen domain
  // predicate -- kept alongside the draft it loads with, never re-fetched. A
  // brand-new plan (isNew) has no saved timezone and never calls
  // isPlanOpenNow, so this starts null and stays unread on that path.
  const [planTimeZone, setPlanTimeZone] = useState<string | null>(null);
  // DEC-676: recorded-evaluation count per round (GET /plans/:id only) --
  // read-only server truth, never re-derived from draft state.
  const [evaluationCountsByRound, setEvaluationCountsByRound] = useState<Record<string, number>>({});
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reviewers, setReviewers] = useState<PlanReviewer[]>([]);
  // w40-e/DEC-745 amendment: the roster's TRUE row count and page size --
  // `reviewers` above only ever holds however many pages have been loaded
  // so far (page 1 = MAX_PER_PAGE rows on the initial fetch), never a
  // fabricated "that's everyone" assumption once total exceeds the loaded
  // length.
  const [reviewersTotal, setReviewersTotal] = useState(0);
  const [reviewersPerPage, setReviewersPerPage] = useState(MAX_PER_PAGE);
  const [reviewersLoadingMore, setReviewersLoadingMore] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-958 (wave-64 amendment): the reviewer-assignment panel's own
  // ErrorSummary problems, built from the WHOLE err.fields map via
  // reviewerAssignProblems -- null when the assign call hasn't failed, or
  // when it failed with no fields (the generic `error` banner above still
  // carries that case, exactly as before this amendment).
  const [reviewerAssignErrors, setReviewerAssignErrors] = useState<{ anchorId: string; label: string }[] | null>(
    null,
  );
  // DEC-354 (amendment, wave 61): a narrower reviewer scope laid over a
  // broader one is an ADVISORY, never a refusal -- the server still writes
  // the row and answers 201, and this holds the sentence naming the
  // broader row it overlaps, or null when the last successful add didn't
  // overlap anything. Rendered as a quiet advisory beside the reviewer
  // list, never styled as an error (nothing failed).
  const [scopeAdvisory, setScopeAdvisory] = useState<string | null>(null);
  // DEC-124 (wave-56 amendment): commitSave's own ErrorSummary problems,
  // built from the WHOLE err.fields map a rejected POST/PATCH plan save
  // returns (name, instructions, scale, criteria, rounds, roundCriteria,
  // roundMeta, maxEvaluations, openDate, closeDate) via
  // planSaveErrorProblems -- null when the save hasn't failed, or failed
  // with no fields, in which case `error`'s bare sentence below is still
  // the only rendering (never dropped).
  const [saveErrorFields, setSaveErrorFields] = useState<{ anchorId: string; label: string }[] | null>(null);
  // w28-b/DEC-124 (rule 9: a draft never validates): generalised from the
  // old name-only "touched" gate -- NO field error anywhere in this form
  // (name, dates, scale, criteria) renders before the first Save/Create
  // click. An existing plan is not a fresh draft, so it starts "submitted"
  // and shows any inherited problems immediately; a brand-new plan starts
  // silent until its first submit attempt.
  const [submitted, setSubmitted] = useState(!isNew);
  // DEC-124 (wave-30 amendment): the ninth shape is "plan editor, save
  // REJECTED", so the top-of-form ErrorSummary is gated on an actual save
  // attempt -- separate from `submitted` above, which governs the per-field
  // messages and starts true for an existing plan (w18-e/DEC-715 pins that an
  // inherited criterion error renders on load). A plan is never scolded with
  // a summary it did not ask for by pressing Save.
  const [saveAttempted, setSaveAttempted] = useState(false);
  // DEC-745: "Assign a reviewer" is a link on the "Who reviews what" rule,
  // not an always-open form -- it discloses the assignment controls
  // (existing create-account + scope-assign capability, never dropped).
  const [assignFormOpen, setAssignFormOpen] = useState(false);
  // DEC-745/DEC-708: "load" on a reviewer row ("6 talks") reads the same
  // assigned/completed aggregate ProgressPanel already renders, joined by
  // userId -- never a second count derived here.
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  // DEC-745 (wave-72 amendment): the persistent cap row's summary reads off
  // GET /plans/:id/progress's submissionsInScope -- the SAME plan-filtered
  // count the server already loads for assignment resolution, never a
  // client-side re-derivation.
  const [submissionsInScope, setSubmissionsInScope] = useState<number | null>(null);
  // w40-e/DEC-745 amendment: the cap row's "N reviewers" term is a COUNT OF
  // ACCOUNTS, not assignment rows -- the progress envelope already returns
  // one row per user with the true `total` (src/routes/review/
  // plans-progress.ts), captured here instead of re-deriving it from
  // reviewers.length (a plan_reviewer ROW list, one row per scope, and also
  // page-capped past 200 rows).
  const [reviewerAccountCount, setReviewerAccountCount] = useState<number | null>(null);

  // DEC-147: 0 = editing the base criteria; a round number 1..rounds means
  // editing that round's override (or "inherit base" when no override key
  // exists yet for that round in draft.roundCriteria).
  const [activeRound, setActiveRound] = useState(0);

  const roundOverride = activeRound === 0 ? null : (draft.roundCriteria?.[String(activeRound)] ?? null);
  const editingCriteria = activeRound === 0 ? draft.criteria : (roundOverride ?? draft.criteria);

  function setEditingCriteria(next: EvaluationCriterion[] | ((prev: EvaluationCriterion[]) => EvaluationCriterion[])) {
    const resolved = typeof next === 'function' ? next(editingCriteria) : next;
    if (activeRound === 0) {
      setDraft((d) => ({ ...d, criteria: resolved }));
      return;
    }
    setDraft((d) => ({
      ...d,
      roundCriteria: { ...(d.roundCriteria ?? {}), [String(activeRound)]: resolved },
    }));
  }

  function customizeActiveRound() {
    if (activeRound === 0) return;
    setDraft((d) => ({
      ...d,
      roundCriteria: { ...(d.roundCriteria ?? {}), [String(activeRound)]: d.criteria.map((c) => ({ ...c })) },
    }));
  }

  function revertActiveRoundToBase() {
    if (activeRound === 0) return;
    setDraft((d) => {
      const next = { ...(d.roundCriteria ?? {}) };
      delete next[String(activeRound)];
      return { ...d, roundCriteria: Object.keys(next).length > 0 ? next : null };
    });
  }

  const activeRoundIsCustomized = activeRound !== 0 && roundOverride !== null;

  // DEC-147 amendment (wave 8, task w8-c): the active round's own name and
  // open/close window -- mirrors editingCriteria's shape exactly (0 = no
  // round selected -> no fields render at all; a round with no roundMeta
  // entry yet reads as all-blank inputs, not the resolved `Round ${n}`
  // fallback -- that fallback is a DISPLAY concern (roundLabel/roundMetaFor)
  // the editor's own inputs never pre-fill with a value the organizer never
  // typed). Round meta is NOT frozen by the criteria lock (DEC-213/DEC-676)
  // -- a name is not a scoring input, so these fields stay editable even on
  // a locked round.
  const activeRoundMeta = activeRound === 0 ? null : (draft.roundMeta?.[String(activeRound)] ?? null);

  function setActiveRoundMetaField(field: 'name' | 'opensAt' | 'closesAt', value: string | number | null) {
    if (activeRound === 0) return;
    setDraft((d) => ({
      ...d,
      roundMeta: {
        ...(d.roundMeta ?? {}),
        [String(activeRound)]: { ...(d.roundMeta?.[String(activeRound)] ?? {}), [field]: value },
      },
    }));
  }
  const criteriaErrors = validateCriteriaList(editingCriteria);
  // DEC-709: the new-row kind picker is a segmented control (Rating /
  // Dropdown / Text), never a native <select> -- toggled open by the ONE
  // tertiary "Add criterion" link that replaces the old three-button row.
  const [pickingKind, setPickingKind] = useState(false);
  const [startingWave, setStartingWave] = useState(false);

  // DEC-715: drag-drop reorder of the criteria list, same contract as
  // FieldList.tsx's field-row handle -- dragstart stamps the dragged
  // criterion's id on text/plain, dragover marks a valid drop target, drop
  // reads the id back and calls moveCriterion via the ONE reorder path
  // (setEditingCriteria/moveCriterion), the same path the handle's
  // ArrowUp/ArrowDown keys use.
  const [dragOverCriterionId, setDragOverCriterionId] = useState<string | null>(null);

  function handleCriterionDragStart(event: DragEvent, criterionId: string) {
    event.dataTransfer.setData('text/plain', criterionId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleCriterionDragOver(event: DragEvent, criterionId: string) {
    event.preventDefault();
    if (dragOverCriterionId !== criterionId) setDragOverCriterionId(criterionId);
  }

  function handleCriterionDragLeave(criterionId: string) {
    setDragOverCriterionId((current) => (current === criterionId ? null : current));
  }

  function handleCriterionDrop(event: DragEvent, targetId: string, targetIndex: number) {
    event.preventDefault();
    setDragOverCriterionId(null);
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) return;
    const sourceIndex = editingCriteria.findIndex((c) => c.id === draggedId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const delta = targetIndex - sourceIndex;
    setEditingCriteria((c) => moveCriterion(c, draggedId, delta > 0 ? 1 : -1));
  }

  // v12 intake section A: a Choice criterion's option rows reorder the same
  // way the criteria list above does -- drag handle + ArrowUp/ArrowDown
  // through the ONE moveCriterionOption write path -- keyed by
  // `${criterionId}:${optionIndex}` since several criteria's option lists
  // can be on screen at once.
  const [dragOverOptionKey, setDragOverOptionKey] = useState<string | null>(null);

  function handleOptionDragStart(event: DragEvent, criterionId: string, optionIndex: number) {
    event.dataTransfer.setData('text/plain', `${criterionId}:${optionIndex}`);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleOptionDragOver(event: DragEvent, criterionId: string, optionIndex: number) {
    event.preventDefault();
    const key = `${criterionId}:${optionIndex}`;
    if (dragOverOptionKey !== key) setDragOverOptionKey(key);
  }

  function handleOptionDragLeave(criterionId: string, optionIndex: number) {
    const key = `${criterionId}:${optionIndex}`;
    setDragOverOptionKey((current) => (current === key ? null : current));
  }

  function handleOptionDrop(event: DragEvent, criterionId: string, targetIndex: number) {
    event.preventDefault();
    setDragOverOptionKey(null);
    const [draggedCriterionId, draggedIndexRaw] = event.dataTransfer.getData('text/plain').split(':');
    if (draggedCriterionId !== criterionId) return;
    const sourceIndex = Number(draggedIndexRaw);
    if (!Number.isFinite(sourceIndex) || sourceIndex === targetIndex) return;
    const delta = targetIndex - sourceIndex;
    setEditingCriteria((c) => moveCriterionOption(c, criterionId, sourceIndex, delta > 0 ? 1 : -1));
  }

  // DEC-676/DEC-213: the currently-edited round is locked once it already
  // carries submitted evaluations -- read the count from the plan's own
  // evaluationCountsByRound (server truth), never re-derive the freeze rule
  // here. Editing round 0 ("Base") edits any round that has no override of
  // its own (DEC-147 fallback), so Base is locked when ANY such round is
  // locked; a specific round tab is locked purely by its own count, because
  // any edit made while viewing it writes an override scoped to that round
  // alone (see setEditingCriteria above).
  const lockedRounds =
    activeRound === 0
      ? Array.from({ length: draft.rounds }, (_, i) => i + 1).filter(
          (r) => !draft.roundCriteria?.[String(r)] && (evaluationCountsByRound[String(r)] ?? 0) > 0,
        )
      : (evaluationCountsByRound[String(activeRound)] ?? 0) > 0
        ? [activeRound]
        : [];
  const activeRoundLockedCount = lockedRounds.reduce((sum, r) => sum + (evaluationCountsByRound[String(r)] ?? 0), 0);
  const activeRoundIsLocked = lockedRounds.length > 0;

  // w25-g/DEC-745 amendment (A9/A10): the plan-wide freeze -- true once ANY
  // round has a submitted review, read off the same evaluationCountsByRound
  // server truth as the per-round lock above (DEC-213), never a second
  // fetch or a re-derivation scoped to the active round.
  const planHasSubmittedReview = Object.values(evaluationCountsByRound).some((count) => count > 0);

  // DEC-882: the page header's "Open · N of M reviews in" reads the SAME
  // progress aggregate ProgressPanel/PlanList already read (progressRows via
  // progressTotals) -- never a second count derived in this component.
  const planIsOpen = !isNew && planTimeZone !== null && isPlanOpenNow(draft.openAt, draft.closeAt, Date.now(), planTimeZone);
  const { completed: reviewsCompleted, assigned: reviewsAssigned } = progressTotals(progressRows);

  // DateField only ever calls onChange with '' or an already-parsed
  // yyyy-mm-dd wire string (see DateField.tsx's handleBlur) -- an
  // unparseable value never reaches here, so dateInputToMs is never
  // expected to throw. No try/catch: fail loudly if that contract breaks
  // rather than swallow it behind a dead error state (w30-d finding).
  function setOpenAt(value: string) {
    setDraft((d) => ({ ...d, openAt: dateInputToMs(value) }));
  }

  function setCloseAt(value: string) {
    setDraft((d) => ({ ...d, closeAt: dateInputToMs(value) }));
  }

  useEffect(() => {
    if (!eventId) return;
    setError(null);
    apiList<Track>(`/events/${eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
  }, [eventId]);

  // D1/D10 (eval MAJOR): the "Who reviews what" summary reads THREE values
  // off GET /plans/:id/progress -- progressRows (the per-reviewer assigned/
  // completed loads), submissionsInScope, and reviewerAccountCount (one row
  // per reviewer ACCOUNT). Every reviewer mutation on this page changes all
  // three, so this fetch is a named function called after each of them, not
  // an inlined body of the mount-only effect below: while it lived there,
  // adding the plan's first reviewer left the summary reading "0 reviewers"
  // and a stale talk count until a full page reload.
  function loadProgress() {
    if (!planId) return Promise.resolve();
    return apiList<ProgressRow>(`/plans/${planId}/progress`)
      .then((res) => {
        setProgressRows(res.items);
        setSubmissionsInScope(res.submissionsInScope ?? null);
        // w40-e/DEC-745 amendment: `total` here is one row per reviewer
        // ACCOUNT (src/routes/review/plans-progress.ts), the true figure
        // the cap row's summary names.
        setReviewerAccountCount(res.total);
      })
      .catch(() => {
        // Same non-blocking treatment as the reviewer roster -- rows still
        // render with a bare email/no load count if this fails.
      });
  }

  useEffect(() => {
    if (isNew || !planId) return;
    setLoading(true);
    setError(null);
    apiGet<EvaluationPlan>(`/plans/${planId}`)
      .then((plan) => {
        const loaded: PlanDraft = {
          name: plan.name,
          instructions: plan.instructions ?? '',
          openAt: plan.openDate,
          closeAt: plan.closeDate,
          trackIds: plan.filters?.trackIds ?? [],
          anonymized: plan.anonymized,
          scale: plan.scale,
          criteria: plan.criteria,
          rounds: plan.rounds,
          roundCriteria: plan.roundCriteria ?? null,
          roundMeta: plan.roundMeta ?? null,
          maxEvaluationsPerSubmission: plan.maxEvaluations ?? undefined,
        };
        setDraft(loaded);
        setPristineDraft(loaded);
        setEvaluationCountsByRound(plan.evaluationCountsByRound ?? {});
        setPlanTimeZone(plan.timezone);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load plan'))
      .finally(() => setLoading(false));
    // w40-e/DEC-745 amendment: request the site-wide page cap so the
    // roster's page 1 is the full MAX_PER_PAGE rows, not apiList's smaller
    // default -- "Show all N" below only has to page past row 200.
    apiList<PlanReviewer>(`/plans/${planId}/reviewers?perPage=${MAX_PER_PAGE}`)
      .then((res) => {
        setReviewers(res.items);
        setReviewersTotal(res.total);
        setReviewersPerPage(res.perPage);
      })
      .catch(() => {
        // Reviewer roster is a nice-to-have on the editor; the plan itself
        // still loaded, so don't block the page on this failing.
      });
    loadProgress();
  }, [planId, isNew]);

  const errors = validatePlanDraft(draft);

  // wave 49/DEC-745 amendment: every FIELD (name/dates/criteria/anonymize
  // etc.) is draft state committed only by save() -- dirty is that draft
  // compared against the pristine baseline captured at load, never
  // re-derived from the server mid-edit.
  const dirty = JSON.stringify(draft) !== JSON.stringify(pristineDraft);

  const DIRTY_FIELD_LABELS: Record<keyof PlanDraft, string> = {
    name: 'Name',
    instructions: 'Instructions',
    openAt: 'Opens',
    closeAt: 'Closes',
    trackIds: 'Tracks',
    anonymized: 'Anonymize',
    scale: 'Rating scale',
    criteria: 'Scoring criteria',
    rounds: 'Rounds',
    roundCriteria: 'Round criteria',
    roundMeta: 'Round names/dates',
    maxEvaluationsPerSubmission: 'Reviews per talk',
  };

  function dirtyFieldLabels(): string[] {
    return (Object.keys(DIRTY_FIELD_LABELS) as (keyof PlanDraft)[])
      .filter((key) => JSON.stringify(draft[key]) !== JSON.stringify(pristineDraft[key]))
      .map((key) => DIRTY_FIELD_LABELS[key]);
  }

  function joinWithAnd(items: string[]): string {
    if (items.length <= 1) return items.join('');
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }

  // wave 49/DEC-745 amendment: a dirty editor never navigates away
  // silently. Every in-app navigation OUT of the editor (the back-link, the
  // new-plan Cancel button) routes through here first; the confirm body
  // NAMES the unsaved fields rather than a generic warning.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

  function requestLeave(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    pendingLeaveRef.current = action;
    setLeaveConfirmOpen(true);
  }

  function confirmLeave() {
    const action = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setLeaveConfirmOpen(false);
    action?.();
  }

  function cancelLeave() {
    pendingLeaveRef.current = null;
    setLeaveConfirmOpen(false);
  }

  // wave 49/DEC-745 amendment: the browser-level half of the same guard --
  // tab close/reload while dirty, removed on unmount/save.
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  // w5-e/DEC-745 amendment: GLOBAL-NAV exits (the chrome nav's Review link,
  // not just this page's own back-link/Cancel) must confirm too -- register
  // this page's requestLeave as the shared leave-guard while mounted, so
  // App.tsx's NavLinks consults the SAME dirty check instead of navigating
  // silently. Cleared on unmount/route change.
  useEffect(() => {
    setNavLeaveGuard((proceed) => requestLeave(proceed));
    return () => setNavLeaveGuard(null);
  }, [dirty]);

  // DEC-799: anonymize is now a drafted FIELD (wave 49/DEC-745 amendment),
  // so its true->false ratchet confirm fires at Save time, not on the
  // checkbox click -- the server still refuses the flip outright once any
  // evaluation was submitted under anonymity (src/routes/review/plans-crud.ts).
  const [anonymizeRatchetConfirmOpen, setAnonymizeRatchetConfirmOpen] = useState(false);

  async function save() {
    if (!eventId) return;
    // w28-b/DEC-124: a Save/Create click is the ONE moment every field
    // error in the form becomes visible, never a per-field blur.
    setSubmitted(true);
    setSaveAttempted(true);
    if (Object.keys(errors).length > 0) {
      // w28-b/DEC-124: the V9 error standard's ErrorSummary (rendered at
      // the top of the form once `submitted` is true) is now the ONE
      // rejection message -- no second, less specific banner underneath it.
      return;
    }
    if (!isNew && pristineDraft.anonymized && !draft.anonymized) {
      setAnonymizeRatchetConfirmOpen(true);
      return;
    }
    await commitSave();
  }

  async function commitSave() {
    if (!eventId) return;
    setSaving(true);
    setError(null);
    setSaveErrorFields(null);
    // DEC-171: the API speaks PlanRecord's wire names (openDate/closeDate/
    // filters/maxEvaluations), not the draft's internal field names.
    const body = {
      name: draft.name,
      instructions: draft.instructions,
      openDate: draft.openAt,
      closeDate: draft.closeAt,
      filters: draft.trackIds.length > 0 ? { trackIds: draft.trackIds } : null,
      maxEvaluations: draft.maxEvaluationsPerSubmission ?? null,
      anonymized: draft.anonymized,
      scale: draft.scale,
      criteria: draft.criteria,
      rounds: draft.rounds,
      roundCriteria: draft.roundCriteria,
      roundMeta: draft.roundMeta,
    };
    try {
      if (isNew) {
        const created = await apiPost<EvaluationPlan>(`/events/${eventId}/plans`, body);
        setPristineDraft(draft);
        navigate(`/review/plans/${created.id}`);
      } else {
        await apiPatch<EvaluationPlan>(`/plans/${planId}`, body);
        setPristineDraft(draft);
      }
    } catch (err) {
      // DEC-124 (wave-56 amendment): the server named every offending
      // field (plans-crud.ts:88/:151) -- err.message stays the ONE summary
      // sentence rendered below, and the WHOLE err.fields map (when
      // present) additionally walks into an anchored ErrorSummary, never
      // dropped in favor of the bare sentence.
      setError(err instanceof ApiError ? err.message : 'Failed to save plan');
      setSaveErrorFields(err instanceof ApiError && err.fields ? planSaveErrorProblems(err) : null);
    } finally {
      setSaving(false);
    }
  }

  function confirmAnonymizeRatchet() {
    setAnonymizeRatchetConfirmOpen(false);
    void commitSave();
  }

  function cancelAnonymizeRatchet() {
    setAnonymizeRatchetConfirmOpen(false);
  }

  // DEC-745: Duplicate needs no new endpoint -- it's the same
  // POST /events/:eventId/plans the new-plan route already uses, carrying
  // this plan's dates/scale/criteria/reviews-per-talk (the fields DEC-745
  // names), never its rounds/roundCriteria/anonymized/trackIds/instructions,
  // which start fresh on the copy.
  async function duplicatePlan() {
    if (!eventId || isNew) return;
    setDuplicating(true);
    setError(null);
    try {
      const body = {
        name: `${draft.name} (copy)`,
        openDate: draft.openAt,
        closeDate: draft.closeAt,
        scale: draft.scale,
        criteria: draft.criteria,
        maxEvaluations: draft.maxEvaluationsPerSubmission ?? null,
      };
      const created = await apiPost<EvaluationPlan>(`/events/${eventId}/plans`, body);
      navigate(`/review/plans/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to duplicate plan');
    } finally {
      setDuplicating(false);
    }
  }

  // DEC-709: locked criteria are not a dead end -- POST /plans/:id/waves
  // freezes nothing new (the server already froze the round on its first
  // submitted evaluation); it opens the NEXT round with an editable copy of
  // the frozen round's criteria and jumps the tab picker straight to it.
  async function startNewWave() {
    if (isNew || !planId) return;
    setStartingWave(true);
    setError(null);
    try {
      const updated = await apiPost<EvaluationPlan>(`/plans/${planId}/waves`, {});
      setDraft((d) => ({
        ...d,
        rounds: updated.rounds,
        roundCriteria: updated.roundCriteria ?? null,
      }));
      setActiveRound(updated.currentRound);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start a new wave');
    } finally {
      setStartingWave(false);
    }
  }

  const [deletePlanConfirmOpen, setDeletePlanConfirmOpen] = useState(false);
  // DEC-929: plan deletion names what it destroys -- fetched from the
  // read-only preview endpoint before the dialog opens, so the confirm body
  // never guesses at the counts deletePlan is about to act on.
  const [deletePreview, setDeletePreview] = useState<PlanDeleteImpact | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);

  async function removePlan() {
    if (isNew || !planId) return;
    setDeletePreviewLoading(true);
    setError(null);
    try {
      const preview = await apiGet<{ planId: string; name: string; counts: PlanDeleteImpact }>(
        `/plans/${planId}/delete-preview`,
      );
      setDeletePreview(preview.counts);
      setDeletePlanConfirmOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load delete preview');
    } finally {
      setDeletePreviewLoading(false);
    }
  }

  async function confirmRemovePlan() {
    if (isNew || !planId) return;
    setSaving(true);
    try {
      await apiDelete(`/plans/${planId}`);
      navigate('/review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete plan');
      setDeletePlanConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([]);
  // DEC-468: /users?role=reviewer is now capped at a page -- keep the
  // envelope's true total so the picker can disclose truncation instead of
  // silently offering only the first page of reviewers.
  const [reviewerOptionsTotal, setReviewerOptionsTotal] = useState(0);
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [reviewerScope, setReviewerScope] = useState<'all' | 'track' | 'submission'>('all');
  const [reviewerTrackId, setReviewerTrackId] = useState('');
  const [reviewerSubmissionId, setReviewerSubmissionId] = useState('');

  // DEC-572: ABS-S2-D1 -- a track-scoped assignment must show its true
  // fan-out count and require confirmation before any POST happens.
  const [scopePreview, setScopePreview] = useState<ScopePreview | null>(null);
  const [scopePreviewLoading, setScopePreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [chooseMode, setChooseMode] = useState(false);
  const [chosenSubmissionIds, setChosenSubmissionIds] = useState<Set<string>>(new Set());
  const [assigningBatch, setAssigningBatch] = useState(false);

  function resetScopeConfirm() {
    setConfirmOpen(false);
    setChooseMode(false);
    setChosenSubmissionIds(new Set());
  }

  // DEC-786: "Distribute evenly" -- loads a preview (writes nothing), shows
  // per-reviewer counts, and only POSTs on an explicit confirm, mirroring
  // the track-assignment confirm gate above.
  const [distributePreview, setDistributePreview] = useState<DistributePreview | null>(null);
  const [distributeLoading, setDistributeLoading] = useState(false);
  const [distributeConfirmOpen, setDistributeConfirmOpen] = useState(false);
  const [distributing, setDistributing] = useState(false);
  // DEC-824: the cap is a parameter of THIS RUN, not a column on the plan --
  // held in local state and repeated byte-identically on preview and apply.
  const [capPerReviewerInput, setCapPerReviewerInput] = useState('');

  function parsedCapPerReviewer(): number | undefined {
    const trimmed = capPerReviewerInput.trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 1 ? n : undefined;
  }

  async function openDistributePreview() {
    if (!planId) return;
    setError(null);
    setDistributeLoading(true);
    try {
      const cap = parsedCapPerReviewer();
      const qs = cap !== undefined ? `?cap=${cap}` : '';
      const res = await apiGet<DistributePreview>(`/plans/${planId}/assignments/distribute/preview${qs}`);
      setDistributePreview(res);
      setDistributeConfirmOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load distribution preview');
    } finally {
      setDistributeLoading(false);
    }
  }

  function cancelDistribute() {
    setDistributeConfirmOpen(false);
    setDistributePreview(null);
  }

  async function confirmDistribute() {
    if (!planId || !distributePreview) return;
    setError(null);
    setDistributing(true);
    try {
      // DEC-840: the apply call sends byte-identically the cap the preview
      // just echoed back -- never a re-derivation from local state, so a
      // preview the organizer saw is exactly what gets written.
      await apiPost<{ created: number }>(`/plans/${planId}/assignments/distribute`, { cap: distributePreview.cap });
      cancelDistribute();
      // D1/D10: the roster AND the progress snapshot the "Who reviews what"
      // summary reads -- distribution writes per-reviewer assignments, so
      // the per-row load counts above the summary go stale too.
      const [reviewersRes] = await Promise.all([
        apiList<PlanReviewer>(`/plans/${planId}/reviewers?perPage=${MAX_PER_PAGE}`),
        loadProgress(),
      ]);
      setReviewers(reviewersRes.items);
      setReviewersTotal(reviewersRes.total);
      setReviewersPerPage(reviewersRes.perPage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to distribute reviewer assignments');
    } finally {
      setDistributing(false);
    }
  }

  useEffect(() => {
    resetScopeConfirm();
    if (!planId || reviewerScope !== 'track' || !reviewerTrackId) {
      setScopePreview(null);
      return;
    }
    setScopePreviewLoading(true);
    apiGet<ScopePreview>(`/plans/${planId}/scope-preview?trackId=${encodeURIComponent(reviewerTrackId)}`)
      .then((res) => setScopePreview(res))
      .catch((err) => {
        setScopePreview(null);
        setError(err instanceof ApiError ? err.message : 'Failed to load track submission count');
      })
      .finally(() => setScopePreviewLoading(false));
  }, [planId, reviewerScope, reviewerTrackId]);

  // DEC-572: same preview endpoint feeds the single-submission picker
  // (replacing the earlier free-text submission-id input) -- the picker is
  // scoped by the same reviewerTrackId select shown for scope 'track', since
  // the preview endpoint requires a trackId.
  const [submissionPickerOptions, setSubmissionPickerOptions] = useState<ScopePreview['items']>([]);
  useEffect(() => {
    if (!planId || reviewerScope !== 'submission' || !reviewerTrackId) {
      setSubmissionPickerOptions([]);
      return;
    }
    apiGet<ScopePreview>(`/plans/${planId}/scope-preview?trackId=${encodeURIComponent(reviewerTrackId)}`)
      .then((res) => setSubmissionPickerOptions(res.items))
      .catch((err) => {
        // DEC-518 wave-76 amendment: an empty options array renders
        // identically to "this track has no submissions" -- a failed load
        // must say so instead, via the page's existing error banner, rather
        // than leaving the picker looking like a real (empty) result.
        setSubmissionPickerOptions([]);
        setError(err instanceof ApiError ? err.message : 'Failed to load submissions for this track');
      });
  }, [planId, reviewerScope, reviewerTrackId]);

  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [creatingReviewer, setCreatingReviewer] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  function loadReviewerOptions() {
    return apiList<ReviewerOption>('/users?role=reviewer')
      .then((res) => {
        setReviewerOptions(res.items);
        setReviewerOptionsTotal(res.total);
      })
      .catch(() => {
        // Same non-blocking treatment as the reviewer roster above.
      });
  }

  useEffect(() => {
    if (isNew || !planId) return;
    loadReviewerOptions();
  }, [planId, isNew]);

  async function createReviewerAccount() {
    if (!newReviewerEmail.trim()) return;
    setError(null);
    setCreatingReviewer(true);
    try {
      const res = await apiPost<{ id: string; email: string; role: string; password: string }>('/users', {
        email: newReviewerEmail.trim(),
        role: 'reviewer',
      });
      setRevealedPassword(res.password);
      setNewReviewerEmail('');
      await loadReviewerOptions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create reviewer account');
    } finally {
      setCreatingReviewer(false);
    }
  }

  async function copyRevealedPassword() {
    if (!revealedPassword) return;
    const ok = await copyText(revealedPassword);
    setCopyResult({ ok, text: revealedPassword });
    if (ok) {
      window.setTimeout(() => setCopyResult(null), 2000);
    }
  }

  useEffect(() => {
    if (copyResult && !copyResult.ok) {
      failedCopyRef.current?.focus();
      failedCopyRef.current?.select();
    }
  }, [copyResult]);

  async function postReviewerAssignment(body: { userId: string; trackId?: string; submissionId?: string }) {
    const created = await apiPost<PlanReviewer & { scopeAdvisory: string | null }>(`/plans/${planId}/reviewers`, body);
    // The server decorates the create response with the same email/
    // trackName/submissionRef/submissionTitle labels the list mapper
    // computes (DEC-659 amendment), so the row never flashes a raw id or a
    // "(removed)" label before the next reload.
    setReviewers((prev) => [...prev, created]);
    setReviewersTotal((prev) => prev + 1);
    // DEC-354 (amendment, wave 61): scopeAdvisory is null when nothing
    // overlapped -- clear any stale advisory from a previous add.
    setScopeAdvisory(created.scopeAdvisory ?? null);
    // D1/D10: the new row's assigned/completed loads and the reviewer-
    // ACCOUNT count both live on the progress endpoint, not on this create
    // response -- refetch so the summary counts the reviewer just added.
    // Covers both callers (assignReviewer and confirmAssignAllInTrack).
    await loadProgress();
    return created;
  }

  // DEC-572: 'all'/'submission' scopes assign immediately (unchanged
  // behavior, and 'submission' is already a single explicit row). 'track'
  // scope now only OPENS the inline confirm -- nothing is POSTed here.
  async function assignReviewer() {
    if (!planId || !reviewerUserId.trim()) return;
    if (reviewerScope === 'track') {
      if (!reviewerTrackId || !scopePreview) return;
      setConfirmOpen(true);
      return;
    }
    setError(null);
    setReviewerAssignErrors(null);
    setScopeAdvisory(null);
    try {
      const body: { userId: string; trackId?: string; submissionId?: string } = { userId: reviewerUserId.trim() };
      if (reviewerScope === 'submission' && reviewerSubmissionId.trim()) body.submissionId = reviewerSubmissionId.trim();
      await postReviewerAssignment(body);
      setReviewerUserId('');
      setReviewerSubmissionId('');
    } catch (err) {
      // DEC-958 (wave-64 amendment): the WHOLE fields map, each key anchored
      // to the control that owns it -- never just err.fields.submissionId,
      // which silently dropped the userId="required" shape.
      if (err instanceof ApiError && err.fields) {
        setReviewerAssignErrors(reviewerAssignProblems(err));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to assign reviewer');
      }
    }
  }

  // "Assign all N": the single trackId-scoped plan_reviewer row, exactly as
  // before the DEC-572 confirm gate was added.
  async function confirmAssignAllInTrack() {
    if (!planId || !reviewerUserId.trim() || !reviewerTrackId) return;
    setError(null);
    setReviewerAssignErrors(null);
    setScopeAdvisory(null);
    setAssigningBatch(true);
    try {
      await postReviewerAssignment({ userId: reviewerUserId.trim(), trackId: reviewerTrackId });
      setReviewerUserId('');
      resetScopeConfirm();
      setScopePreview(null);
    } catch (err) {
      // DEC-958 (wave-64 amendment): this is the ONLY path that sends
      // trackId, and it used to read nothing but err.message -- a
      // { trackId: "unknown track for this event" } refusal rendered the
      // same four words as every other shape.
      if (err instanceof ApiError && err.fields) {
        setReviewerAssignErrors(reviewerAssignProblems(err));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to assign reviewer');
      }
    } finally {
      setAssigningBatch(false);
    }
  }

  // "Choose submissions": DEC-924 -- one set-based, all-or-nothing request
  // for the whole chosen set (never the old per-submission Promise.all,
  // which could leave half the rows behind on a mid-batch rejection --
  // contradicting the DEC-572 "Nothing is saved until you confirm" caption
  // this same panel prints).
  async function confirmAssignChosen() {
    if (!planId || !reviewerUserId.trim() || chosenSubmissionIds.size === 0) return;
    setError(null);
    setReviewerAssignErrors(null);
    setScopeAdvisory(null);
    setAssigningBatch(true);
    try {
      const { items, scopeAdvisory: advisory } = await apiPost<{
        items: PlanReviewer[];
        total: number;
        scopeAdvisory: string | null;
      }>(`/plans/${planId}/reviewers`, {
        userId: reviewerUserId.trim(),
        submissionIds: [...chosenSubmissionIds],
      });
      // Server-decorated response (mirrors postReviewerAssignment above) --
      // every item already carries email/trackName/submissionRef/
      // submissionTitle, so no client-side patching is needed.
      setReviewers((prev) => [...prev, ...items]);
      setReviewersTotal((prev) => prev + items.length);
      // DEC-354 (amendment, wave 61): null when nothing in the chosen set
      // overlapped an existing broader row.
      setScopeAdvisory(advisory ?? null);
      // D1/D10: same refetch the single-row path does -- a batch add moves
      // the summary's reviewer count and per-reviewer loads too.
      await loadProgress();
      setReviewerUserId('');
      resetScopeConfirm();
      setScopePreview(null);
    } catch (err) {
      // DEC-958 (wave-64 amendment): walk the whole fields map -- the
      // parseBoundedIdArray refusal ("Required"/"must not exceed…") shares
      // the same submissionIds key as the two route-thrown shapes below it.
      if (err instanceof ApiError && err.fields) {
        setReviewerAssignErrors(reviewerAssignProblems(err));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to assign reviewer');
      }
    } finally {
      setAssigningBatch(false);
    }
  }

  function toggleChosenSubmission(id: string) {
    setChosenSubmissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // DEC-941: removing a reviewer drops their queue on this plan, so it's
  // gated behind the shared ConfirmDialog rather than firing on click.
  const [pendingUnassignReviewer, setPendingUnassignReviewer] = useState<{ id: string; displayName: string } | null>(
    null,
  );
  const [unassigningReviewer, setUnassigningReviewer] = useState(false);

  async function confirmUnassignReviewer() {
    if (!planId || !pendingUnassignReviewer) return;
    const { id } = pendingUnassignReviewer;
    setUnassigningReviewer(true);
    try {
      await apiDelete(`/plans/${planId}/reviewers/${id}`);
      setReviewers((prev) => prev.filter((r) => r.id !== id));
      setReviewersTotal((prev) => Math.max(0, prev - 1));
      // D1/D10: removing a reviewer drops their queue, so the summary's
      // reviewer-account count and the remaining rows' loads both move.
      await loadProgress();
      setPendingUnassignReviewer(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove reviewer');
    } finally {
      setUnassigningReviewer(false);
    }
  }

  // w40-e/DEC-745 amendment: "Show all N" for the reviewer roster -- same
  // shape as ReviewerQueue.tsx's loadAllPages, sequential page loads
  // appended onto the already-loaded page 1, bounded by clampPage's own
  // MAX_PAGE ceiling, so every assignment (not just the first MAX_PER_PAGE
  // rows) stays visible and removable.
  async function loadAllReviewerAssignments() {
    if (!planId) return;
    setReviewersLoadingMore(true);
    setError(null);
    try {
      const lastPage = Math.min(Math.ceil(reviewersTotal / reviewersPerPage), MAX_PAGE);
      let appended: PlanReviewer[] = [];
      for (let page = 2; page <= lastPage; page += 1) {
        const res = await apiList<PlanReviewer>(`/plans/${planId}/reviewers?perPage=${reviewersPerPage}&page=${page}`);
        if (res.items.length === 0) break;
        appended = appended.concat(res.items);
      }
      setReviewers((prev) => prev.concat(appended));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the full reviewer roster');
    } finally {
      setReviewersLoadingMore(false);
    }
  }

  if (!eventId) {
    return (
      <div className="chq-page chq-review-page chq-measure-table">
        <h1 className="chq-page-title">Evaluation plan</h1>
        <div className="chq-error" role="alert">
          No event selected.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chq-page chq-review-page chq-measure-table">
        <h1 className="chq-page-title">Evaluation plan</h1>
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  return (
    <div
      className="chq-page chq-review-page chq-measure-table"
      {...(isPhone ? { 'data-chq-phone-dock': true } : {})}
    >
      {/* w1-f (DEC-576, wave-98 amendment): .chq-review-editor-title-actions
          becomes a docked phone footer (position:fixed; bottom:0;
          border-top) inside review.css's max-width:700px block below, but
          it is a single unconditionally-rendered div whose docking is
          purely CSS-driven rather than a page-local dock class gated by
          isPhone -- so this attribute is what tells the shell (styles.css's
          `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` rule) to
          suppress the tab bar underneath it, matching Scorecard.tsx. */}
      {/* DEC-989 amendment (wave 39): the plan editor is table class (1440) --
          its criteria table is scanned/compared, not composed like the two
          named 820 editors. The title row below is a bare flex block with
          no max-width of its own (matches the .chq-toolbar/.chq-section-head
          idiom in styles.css), so its border-bottom rule runs edge to edge
          of this chq-measure-table box while the fields/criteria below stay
          inside that same box -- the "full bleed chrome" the width system
          requires of a header rule. */}
      {/* DEC-745: the v4 title row -- a '‹ Review' back-link over the plan's
          own NAME rendered as an editable title input (renaming survives now
          that the old labelled Name field row is gone), with Duplicate/Save
          (or Cancel/Create the plan when isNew) on the same row. */}
      <div className="chq-review-editor-title-row">
        <div className="chq-review-editor-title-col">
          <Link
            to="/review"
            className="chq-review-editor-back-link"
            onClick={(e) => {
              // wave 49/DEC-745 amendment: a dirty editor never navigates
              // away silently -- block the default Link navigation and
              // route through the same confirm the Cancel button uses.
              if (!dirty) return;
              e.preventDefault();
              requestLeave(() => navigate('/review'));
            }}
          >
            &lsaquo; Review
          </Link>
          <input
            id="plan-name"
            className={
              submitted && errors.name
                ? 'chq-review-editor-title-input chq-field-invalid'
                : 'chq-review-editor-title-input'
            }
            aria-label="Plan name"
            placeholder="New evaluation plan"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            aria-invalid={submitted && errors.name ? 'true' : undefined}
          />
          {submitted && errors.name && (
            <span className="chq-field-error" role="alert">
              {errors.name}
            </span>
          )}
          {isNew && <p className="chq-review-field-caption">Nothing is sent to reviewers until you open it.</p>}
          {/* DEC-882: the open-plan header states both numbers from the
              progress aggregate already loaded into progressRows -- never a
              second count derived here. */}
          {planIsOpen && (
            <p className="chq-review-plan-open-status">
              Open · {reviewsCompleted} of {reviewsAssigned} reviews in
            </p>
          )}
        </div>
        <div className="chq-review-editor-title-actions">
          {isNew ? (
            <>
              {/* G13 lane-D fix (03-review--08): Cancel is drawn as a
                  bordered secondary (B8: #EFEBDF on 1px #CFC7B7), not a bare
                  tertiary link. */}
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                disabled={saving}
                onClick={() => requestLeave(() => navigate('/review'))}
              >
                Cancel
              </button>
              <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Creating…' : 'Create the plan'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                disabled={saving || duplicating}
                onClick={() => void duplicatePlan()}
              >
                {duplicating ? 'Duplicating…' : 'Duplicate'}
              </button>
              <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {/* DEC-124 (wave-56 amendment): a rejected save's WHOLE err.fields map,
          anchored one problem per key -- rendered alongside (never instead
          of) the bare sentence above. */}
      {saveErrorFields && saveErrorFields.length > 0 && (
        <ErrorSummary
          heading={countHeading(saveErrorFields.length, 'before this plan can be saved')}
          problems={saveErrorFields}
        />
      )}

      <div className="chq-review-editor">
        {/* w28-b/DEC-745/DEC-124: the V9 error standard's top-of-form
            summary -- one block, one anchor per problem, rendered only once
            a Save/Create click has actually failed validation (the
            `submitted` gate, so a fresh draft never validates). */}
        {saveAttempted && Object.keys(errors).length > 0 && (
          <ErrorSummary
            heading={countHeading(Object.keys(errors).length, 'before this plan can open')}
            /* G13 lane-D fix (03-review--11): the two-clause sentence is
               drawn only in the two-problem state — as a constant it
               asserted a date problem the organiser does not have whenever
               only the criteria error fired. */
            kept={
              errors.criteria && errors.closeAt
                ? 'A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.'
                : undefined
            }
            problems={planErrorSummaryProblems(errors)}
          />
        )}
        {/* DEC-709: plan fields as a compact summary block -- Opens / Closes
            / Reviews per talk / Scale, the scale field captioned exactly
            'Applies to every criterion in this plan' since it's plan-wide,
            never per-criterion. */}
        <div className="chq-review-summary-grid">
          <label className="chq-review-field" htmlFor="plan-open-at">
            Opens
            <DateField
              id="plan-open-at"
              className="chq-input chq-date-input"
              value={msToDateInput(draft.openAt)}
              onChange={setOpenAt}
            />
          </label>
          <label className="chq-review-field" htmlFor="plan-close-at">
            Closes
            <DateField
              id="plan-close-at"
              className={
                submitted && errors.closeAt ? 'chq-input chq-date-input chq-field-invalid' : 'chq-input chq-date-input'
              }
              value={msToDateInput(draft.closeAt)}
              onChange={setCloseAt}
            />
            {/* w28-b/DEC-745/DEC-124: cross-field error worded as a
                consequence, attached to the close date (the field a reader
                would actually fix), not the open date it conflicts with.
                DateField doesn't forward an external aria-invalid prop, so
                only the shared chq-field-invalid class above marks the
                control visually -- see notes in the task report. */}
            {submitted && errors.closeAt && (
              <span className="chq-field-error" role="alert">
                {errors.closeAt}
              </span>
            )}
          </label>
          <label className="chq-review-field">
            Reviews per talk
            <input
              id="plan-max-evaluations"
              type="number"
              className={
                submitted && errors.maxEvaluationsPerSubmission ? 'chq-input chq-field-invalid' : 'chq-input'
              }
              min={1}
              value={draft.maxEvaluationsPerSubmission ?? ''}
              aria-invalid={submitted && errors.maxEvaluationsPerSubmission ? 'true' : undefined}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  maxEvaluationsPerSubmission: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
            {submitted && errors.maxEvaluationsPerSubmission && (
              <span className="chq-field-error" role="alert">
                {errors.maxEvaluationsPerSubmission}
              </span>
            )}
          </label>
          <div className="chq-review-field">
            Rating scale
            <div className="chq-review-scale-inputs">
              <input
                id="plan-scale-min"
                type="number"
                className={submitted && errors.scale ? 'chq-input chq-field-invalid' : 'chq-input'}
                aria-label="Scale min"
                aria-invalid={submitted && errors.scale ? 'true' : undefined}
                value={draft.scale.min}
                onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, min: Number(e.target.value) } }))}
              />
              <span aria-hidden="true">to</span>
              <input
                id="plan-scale-max"
                type="number"
                className={submitted && errors.scale ? 'chq-input chq-field-invalid' : 'chq-input'}
                aria-label="Scale max"
                aria-invalid={submitted && errors.scale ? 'true' : undefined}
                value={draft.scale.max}
                onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, max: Number(e.target.value) } }))}
              />
            </div>
            <span className="chq-review-field-caption">Applies to every criterion in this plan</span>
            {submitted && errors.scale && (
              <span className="chq-field-error" role="alert">
                {errors.scale}
              </span>
            )}
          </div>
          {/* w25-g/DEC-745 amendment (A10): the anonymise toggle is a
              plan-wide property, exactly like scale -- it joins the plan
              fields block as Rating scale's sibling rather than living
              inside "Who reviews what". It freezes with the criteria at
              the plan's first submitted review (planHasSubmittedReview,
              the SAME DEC-213 predicate the criteria already use) -- when
              frozen it renders DISABLED in the B8 disabled register, not
              hidden, so an organiser can see the option exists. */}
          <div
            className={[
              'chq-review-field',
              planHasSubmittedReview ? 'chq-review-field-disabled' : null,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <label className="chq-review-checkbox-label">
              <input
                type="checkbox"
                className="chq-check"
                checked={draft.anonymized}
                disabled={planHasSubmittedReview}
                onChange={(e) => setDraft((d) => ({ ...d, anonymized: e.target.checked }))}
              />
              Hide speaker names from reviewers
            </label>
            <span className="chq-review-field-caption">Reviewers see the abstract and track only</span>
          </div>
        </div>

        <section className="chq-section" id="plan-criteria">
          <div className="chq-section-head">
            <h2 className="chq-section-label">Scoring criteria</h2>
            {/* w41-f/DEC-882 amendment: a locked round names its constraint
                right in the section rule, not just below the rows -- the
                same evaluationCountsByRound-derived count the lock card
                below already states, never a second fetch. w5-e: the SAME
                right-aligned uppercase eyebrow slot carries "Scores average
                by weight" when unlocked -- never a body sentence. */}
            {activeRoundIsLocked ? (
              <span className="chq-review-criteria-eyebrow">
                Locked — {countOf(activeRoundLockedCount, 'review')} scored against these criteria
              </span>
            ) : (
              <span className="chq-review-criteria-eyebrow">Scores average by weight</span>
            )}
            {/* v12m-w5-b/DEC-808: Chautauqua Review.dc.html:594 "Plan editor
                · 390" draws the Criteria head's right slot as a bare count
                ("3"), not the desktop eyebrow sentence -- a phone-only
                element (hidden at every wider width, see review.css's
                appended phone block) rather than replacing the desktop
                eyebrow's meaning. */}
            <span className="chq-review-criteria-count-phone" aria-hidden="true">
              {editingCriteria.length}
            </span>
          </div>
          {/* DEC-676: weights stay relative and plan-wide -- never forced to
              sum to 100 -- so the section states how they're used. w5-e: the
              "Scores average by weight" sentence moved to the eyebrow above;
              this caption now only appears while locked. */}
          {activeRoundIsLocked && (
            <p className="chq-review-section-caption">
              Wording, type and weights are fixed for the rest of this wave.
            </p>
          )}

          {draft.rounds > 1 && (
            <div className="chq-review-round-tabs">
              <label>
                Editing criteria for{' '}
                <select
                  className="chq-select"
                  value={activeRound}
                  onChange={(e) => setActiveRound(Number(e.target.value))}
                >
                  <option value={0}>Base (used by any round without an override)</option>
                  {Array.from({ length: draft.rounds }, (_, i) => i + 1).map((r) => (
                    <option key={r} value={r}>
                      Round {r}
                    </option>
                  ))}
                </select>
              </label>
              {activeRound !== 0 &&
                (activeRoundIsCustomized ? (
                  <button
                    type="button"
                    className="chq-btn chq-btn-secondary"
                    disabled={activeRoundIsLocked}
                    onClick={revertActiveRoundToBase}
                  >
                    Revert round {activeRound} to base
                  </button>
                ) : (
                  <button
                    type="button"
                    className="chq-btn chq-btn-secondary"
                    disabled={activeRoundIsLocked}
                    onClick={customizeActiveRound}
                  >
                    Customize round {activeRound} (inherits base until then)
                  </button>
                ))}
            </div>
          )}

          {/* DEC-147 amendment (wave 8, task w8-c): a round is a named
              window -- name/opens/closes for the round tab currently being
              edited, in the same field rhythm as the plan-wide Opens/Closes
              summary grid above. Never frozen by activeRoundIsLocked (a
              name/window is not a scoring input, unlike the criteria rows
              below). */}
          {activeRound !== 0 && (
            <div className="chq-review-round-meta-fields chq-review-summary-grid">
              <label className="chq-review-field" htmlFor="round-meta-name">
                {`Round ${activeRound} name`}
                <input
                  id="round-meta-name"
                  type="text"
                  className="chq-input"
                  placeholder={`Round ${activeRound}`}
                  maxLength={MAX_NAME_LENGTH}
                  value={activeRoundMeta?.name ?? ''}
                  onChange={(e) => setActiveRoundMetaField('name', e.target.value)}
                />
              </label>
              <label className="chq-review-field" htmlFor="round-meta-opens-at">
                Opens
                <DateField
                  id="round-meta-opens-at"
                  className="chq-input chq-date-input"
                  value={msToDateInput(activeRoundMeta?.opensAt ?? null)}
                  onChange={(value) => setActiveRoundMetaField('opensAt', dateInputToMs(value))}
                />
              </label>
              <label className="chq-review-field" htmlFor="round-meta-closes-at">
                Closes
                <DateField
                  id="round-meta-closes-at"
                  className="chq-input chq-date-input"
                  value={msToDateInput(activeRoundMeta?.closesAt ?? null)}
                  onChange={(value) => setActiveRoundMetaField('closesAt', dateInputToMs(value))}
                />
              </label>
            </div>
          )}

          {submitted && (activeRound === 0 ? errors.criteria : criteriaErrors.criteria) && (
            // DEC-124 (wave-30 amendment): an empty criteria list is an
            // empty-COLLECTION state, not a bare field-error string -- 'No
            // criteria yet' with a way out (the three defaults, or add one
            // by hand). errors.criteria is assigned in exactly one place
            // (validateCriteriaList, for the empty list only), so this card
            // is the whole of that error's presentation. Gated on
            // `submitted` like every other error on this form (rule 9: a
            // draft never validates).
            // DEC-124 amendment: an empty criteria list is an empty-
            // collection state, not a bare field-error string -- 'No
            // criteria yet' with a way out (the three defaults, or add
            // one by hand), never just 'At least one criterion is
            // required.'
            <div className="chq-review-criteria-empty-notice">
              <p className="chq-review-criteria-locked-headline">No criteria yet</p>
              <p className="chq-review-criteria-locked-reason">
                Reviewers need at least one thing to score. Add your own, or start from the three defaults.
              </p>
              <div className="chq-review-criteria-empty-actions">
                <button
                  type="button"
                  className="chq-btn chq-btn-primary"
                  onClick={() => setEditingCriteria(defaultDraftCriteria())}
                >
                  Add the three defaults
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  onClick={() => setPickingKind(true)}
                >
                  Add one of my own
                </button>
              </div>
              <p className="chq-review-criteria-empty-footer">You can save this as a draft plan and open it later</p>
            </div>
          )}
          {/* DEC-882: the criteria list names all six of the frame's
              columns -- `Chautauqua Review.dc.html:493`:
              `<span></span><span>Criterion</span><span>Guidance for
              reviewers · optional</span><span>Type</span><span>Weight</span>
              <span></span>` -- in the section-label type this page already
              uses, aligned to the existing criterion row's grid columns. */}
          <div className="chq-review-criteria-head-row" aria-hidden="true">
            {/* DEC-715: the drag-handle column has no header label of its own. */}
            <span> </span>
            <span className="chq-review-criteria-head-cell">Criterion </span>
            <span className="chq-review-criteria-head-cell">
              Guidance for reviewers
              <span className="chq-review-criterion-optional">{OPTIONAL_SUFFIX}</span>
            </span>
            <span className="chq-review-criteria-head-cell">Type </span>
            <span className="chq-review-criteria-head-cell">Weight </span>
            <span> </span>
          </div>
          {(() => {
            // DEC-676: shares are computed over the whole editing list --
            // dropdown/text rows have no weight and get no share entry.
            const shares = criterionWeightShares(editingCriteria);
            const atCap = editingCriteria.length >= MAX_PLAN_CRITERIA;
            if (activeRoundIsLocked) {
              // DEC-882: a locked round reads as TEXT, not disabled inputs --
              // zero form controls render for its criteria. w41-f: the
              // weight column reads "Weight N · P%" (weight plus its share
              // of total weight), the same share map the unlocked editor
              // already computes above -- never a second derivation.
              return (
                <>
                  {editingCriteria.map((criterion) => (
                    <div key={criterion.id} className="chq-review-criterion-row chq-review-criterion-row-readonly">
                      {/* DEC-715: criteria cannot reorder once scored -- the
                          handle is ABSENT here, not disabled. */}
                      <span />
                      <span>{criterion.label}</span>
                      <span>{criterion.guidance ?? ''}</span>
                      {/* DEC-613/DEC-882 (wave 7): the KIND column, dropped
                          at w5-e, is restored here as the frame's TYPE cell
                          (Chautauqua Review.dc.html:696-701,
                          `{{ c.typeLabel }}`) -- a locked criterion states
                          its type in the same vocabulary as the
                          Add-criterion picker. */}
                      <span>{CRITERION_KIND_LABELS[criterion.kind]}</span>
                      <span>
                        {criterion.kind === 'rating'
                          ? shares[criterion.id] !== undefined
                            ? `Weight ${criterion.weight} · ${shares[criterion.id]}%`
                            : ''
                          : /* frame :1130 `weight: 'Not scored'` -- dropdown/text criteria
                               carry no weight, so the readout says so rather than blanking. */
                            'Not scored'}
                      </span>
                      <span />
                    </div>
                  ))}
                  {/* DEC-882: the lock card sits BELOW the rows -- a reader
                      sees what the criteria ARE before being told why they
                      cannot change. */}
                  <div className="chq-review-criteria-locked-notice" role="status">
                    <div className="chq-review-criteria-locked-text">
                      {/* w5-e: the section rule's own eyebrow already says
                          "Locked" -- this headline states the count without
                          repeating that word. */}
                      <p className="chq-review-criteria-locked-headline">
                        {countOf(activeRoundLockedCount, 'review')} scored against these criteria
                      </p>
                      <p className="chq-review-criteria-locked-reason">
                        Changing these would rescore work already done. To score differently, open a new wave — the
                        reviews already in stay attached to this one.
                      </p>
                    </div>
                    {!isNew && planId && (
                      <button
                        type="button"
                        className="chq-btn chq-btn-primary"
                        disabled={startingWave}
                        onClick={() => void startNewWave()}
                      >
                        {startingWave ? 'Starting…' : 'Start a new wave'}
                      </button>
                    )}
                  </div>
                </>
              );
            }
            return (
              <>
                {editingCriteria.map((criterion, index) => (
                  <div
                    key={criterion.id}
                    className={[
                      'chq-review-criterion-row',
                      dragOverCriterionId === criterion.id ? 'chq-review-criterion-row-drop-target' : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onDragOver={(event) => handleCriterionDragOver(event, criterion.id)}
                    onDragLeave={() => handleCriterionDragLeave(criterion.id)}
                    onDrop={(event) => handleCriterionDrop(event, criterion.id, index)}
                  >
                    {/* DEC-715: the ONE reorder affordance -- a real <button>
                        whose accessible name states its position, draggable
                        by pointer and operable by ArrowUp/ArrowDown, reusing
                        the form-builder's handle markup/class
                        (chq-forms-field-drag, FieldList.tsx) rather than a
                        second implementation. */}
                    <button
                      type="button"
                      className="chq-forms-field-drag"
                      aria-label={`Reorder ${criterion.label || 'criterion'} (position ${index + 1} of ${editingCriteria.length})`}
                      draggable
                      onDragStart={(event) => handleCriterionDragStart(event, criterion.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setEditingCriteria((c) => moveCriterion(c, criterion.id, -1));
                        } else if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setEditingCriteria((c) => moveCriterion(c, criterion.id, 1));
                        }
                      }}
                    >
                      ⋮⋮
                    </button>
                    <input
                      id={`criterion-${criterion.id}-label`}
                      className={
                        submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`]
                          ? 'chq-input chq-field-invalid'
                          : 'chq-input'
                      }
                      maxLength={MAX_NAME_LENGTH}
                      placeholder="Label"
                      aria-label="Criterion label"
                      aria-invalid={
                        submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`]
                          ? 'true'
                          : undefined
                      }
                      value={criterion.label}
                      disabled={activeRoundIsLocked}
                      onChange={(e) => setEditingCriteria((c) => updateCriterion(c, criterion.id, { label: e.target.value }))}
                    />
                    <input
                      className="chq-input"
                      placeholder="Guidance (optional, one line)"
                      aria-label={`${criterion.label || 'criterion'} guidance`}
                      value={criterion.guidance ?? ''}
                      disabled={activeRoundIsLocked}
                      maxLength={MAX_CRITERION_GUIDANCE_LENGTH}
                      onChange={(e) =>
                        setEditingCriteria((c) => updateCriterion(c, criterion.id, { guidance: e.target.value }))
                      }
                    />
                    {/* DEC-018 Amendment (wave 102): Chautauqua Review.dc.html:500/:747
                        (desktop) and :608 (phone) all draw this per-row TYPE
                        control -- min-height:46px, a caret, "{{ c.typeLabel }}".
                        Changing kind re-derives the kind-specific fields (weight
                        / options / required) the same way a fresh row would get
                        them from addCriterion, rather than stranding e.g. a
                        rating row's weight on a dropdown row. */}
                    <select
                      className="chq-select"
                      aria-label={`${criterion.label || 'criterion'} type`}
                      value={criterion.kind}
                      disabled={activeRoundIsLocked}
                      onChange={(e) => {
                        const kind = e.target.value as CriterionKind;
                        if (kind === criterion.kind) return;
                        const fresh = addCriterion([], kind)[0];
                        if (!fresh) throw new Error('addCriterion([], kind) must return one row');
                        setEditingCriteria((c) =>
                          updateCriterion(c, criterion.id, {
                            kind: fresh.kind,
                            weight: fresh.weight,
                            options: fresh.options,
                            required: fresh.required,
                          }),
                        );
                      }}
                    >
                      <option value="rating">{CRITERION_KIND_LABELS.rating}</option>
                      <option value="dropdown">{CRITERION_KIND_LABELS.dropdown}</option>
                      <option value="text">{CRITERION_KIND_LABELS.text}</option>
                    </select>
                    {criterion.kind === 'rating' ? (
                      <span className="chq-review-criterion-weight">
                        <input
                          id={`criterion-${criterion.id}-weight`}
                          type="number"
                          className={
                            submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`]
                              ? 'chq-input chq-field-invalid'
                              : 'chq-input'
                          }
                          min={0}
                          step="0.1"
                          aria-label={`${criterion.label || 'criterion'} weight`}
                          aria-invalid={
                            submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`]
                              ? 'true'
                              : undefined
                          }
                          value={criterion.weight ?? ''}
                          disabled={activeRoundIsLocked}
                          onChange={(e) =>
                            setEditingCriteria((c) => updateCriterion(c, criterion.id, { weight: Number(e.target.value) }))
                          }
                        />
                        {/* w5-e: prints once -- the input already shows the
                            weight number, so the adjacent text states only
                            its share (frame form "[3] 50%", never a
                            duplicated "5 · 71%"). */}
                        {shares[criterion.id] !== undefined && (
                          <span className="chq-review-criterion-share">{shares[criterion.id]}%</span>
                        )}
                      </span>
                    ) : criterion.kind === 'dropdown' ? (
                      // v12 intake section A / DEC-650: a Choice criterion's
                      // options are EDITABLE ROWS (drag handle, label input,
                      // Remove), the deliberate one-way divergence from the
                      // CFP FieldModal's comma-joined textarea -- row order
                      // IS the order reviewers see and the order results
                      // print, so this never re-sorts.
                      <div
                        className="chq-review-criterion-options"
                        aria-label={`${criterion.label || 'criterion'} options`}
                        id={`criterion-${criterion.id}-options`}
                      >
                        {(criterion.options ?? []).map((option, optionIndex) => {
                          const optionKey = `${criterion.id}:${optionIndex}`;
                          return (
                            <div
                              key={optionIndex}
                              className={[
                                'chq-review-criterion-option-row',
                                dragOverOptionKey === optionKey ? 'chq-review-criterion-row-drop-target' : null,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onDragOver={(event) => handleOptionDragOver(event, criterion.id, optionIndex)}
                              onDragLeave={() => handleOptionDragLeave(criterion.id, optionIndex)}
                              onDrop={(event) => handleOptionDrop(event, criterion.id, optionIndex)}
                            >
                              <button
                                type="button"
                                className="chq-forms-field-drag"
                                aria-label={`Reorder option ${optionIndex + 1} of ${(criterion.options ?? []).length}`}
                                draggable
                                disabled={activeRoundIsLocked}
                                onDragStart={(event) => handleOptionDragStart(event, criterion.id, optionIndex)}
                                onKeyDown={(event) => {
                                  if (event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    setEditingCriteria((c) => moveCriterionOption(c, criterion.id, optionIndex, -1));
                                  } else if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    setEditingCriteria((c) => moveCriterionOption(c, criterion.id, optionIndex, 1));
                                  }
                                }}
                              >
                                ⋮⋮
                              </button>
                              <input
                                className={
                                  submitted &&
                                  (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`]
                                    ? 'chq-input chq-field-invalid'
                                    : 'chq-input'
                                }
                                placeholder={`Option ${optionIndex + 1}`}
                                aria-label={`${criterion.label || 'criterion'} option ${optionIndex + 1}`}
                                // DEC-417: review/shared.ts caps each dropdown option at
                                // MAX_NAME_LENGTH individually -- the control declares the
                                // cap its route enforces.
                                maxLength={MAX_NAME_LENGTH}
                                aria-invalid={
                                  submitted &&
                                  (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`]
                                    ? 'true'
                                    : undefined
                                }
                                value={option}
                                disabled={activeRoundIsLocked}
                                onChange={(e) =>
                                  setEditingCriteria((c) =>
                                    updateCriterionOption(c, criterion.id, optionIndex, e.target.value),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="chq-btn chq-btn-tertiary"
                                aria-label={`Remove option ${optionIndex + 1}`}
                                disabled={activeRoundIsLocked || (criterion.options ?? []).length <= MIN_CRITERION_OPTIONS}
                                onClick={() =>
                                  setEditingCriteria((c) => removeCriterionOption(c, criterion.id, optionIndex))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                        <div className="chq-review-criterion-options-footer">
                          <span className="chq-review-criterion-options-count">
                            {(criterion.options ?? []).length} of {MAX_CRITERION_OPTIONS}
                          </span>
                          {(criterion.options ?? []).length < MAX_CRITERION_OPTIONS && (
                            <a
                              href="#add-option"
                              className="chq-review-add-link"
                              aria-disabled={activeRoundIsLocked}
                              onClick={(e) => {
                                e.preventDefault();
                                if (activeRoundIsLocked) return;
                                setEditingCriteria((c) => addCriterionOption(c, criterion.id));
                              }}
                            >
                              Add an option
                            </a>
                          )}
                        </div>
                        {/* v12m-w5-b/DEC-808: Chautauqua Review.dc.html:594's
                            Weight row reads "Recorded as a spread · no
                            weight" for a Choice criterion (never blank) --
                            phone-only, matching the readonly/locked row's
                            "Not scored" readout above for the same
                            distinction. */}
                        <span className="chq-review-criterion-no-weight-phone" aria-hidden="true">
                          Recorded as a spread · no weight
                        </span>
                      </div>
                    ) : (
                      <label className="chq-review-checkbox-label">
                        <input
                          type="checkbox"
                          className="chq-check"
                          aria-label={`${criterion.label || 'criterion'} required`}
                          checked={criterion.required ?? false}
                          disabled={activeRoundIsLocked}
                          onChange={(e) => setEditingCriteria((c) => updateCriterion(c, criterion.id, { required: e.target.checked }))}
                        />
                        Required
                      </label>
                    )}
                    {submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`] && (
                      <span className="chq-field-error chq-review-criterion-error" role="alert">
                        {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`]}
                      </span>
                    )}
                    {submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`] && (
                      <span className="chq-field-error chq-review-criterion-error" role="alert">
                        {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`]}
                      </span>
                    )}
                    {submitted && (activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`] && (
                      <span className="chq-field-error chq-review-criterion-error" role="alert">
                        {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`]}
                      </span>
                    )}
                    <button
                      type="button"
                      className="chq-btn chq-btn-tertiary"
                      disabled={activeRoundIsLocked}
                      onClick={() => setEditingCriteria((c) => removeCriterion(c, criterion.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {/* DEC-676/DEC-709: ONE tertiary "Add criterion" link (never
                    three secondary buttons); the new row picks its kind with
                    a segmented control (Rating / Dropdown / Text), never a
                    native <select>. Soft cap stated honestly next to it,
                    always visible, not just once the cap is hit. */}
                <div className="chq-review-add-criteria">
                  {!pickingKind ? (
                    <a
                      href="#add-criterion"
                      className="chq-review-add-link"
                      aria-disabled={activeRoundIsLocked || atCap}
                      onClick={(e) => {
                        e.preventDefault();
                        if (activeRoundIsLocked || atCap) return;
                        setPickingKind(true);
                      }}
                    >
                      Add criterion
                    </a>
                  ) : (
                    <div className="chq-segmented" role="group" aria-label="New criterion kind">
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        onClick={() => {
                          setEditingCriteria((c) => addCriterion(c, 'rating' as CriterionKind));
                          setPickingKind(false);
                        }}
                      >
                        {CRITERION_KIND_LABELS.rating}
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        onClick={() => {
                          setEditingCriteria((c) => addCriterion(c, 'dropdown' as CriterionKind));
                          setPickingKind(false);
                        }}
                      >
                        {CRITERION_KIND_LABELS.dropdown}
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        onClick={() => {
                          setEditingCriteria((c) => addCriterion(c, 'text' as CriterionKind));
                          setPickingKind(false);
                        }}
                      >
                        {CRITERION_KIND_LABELS.text}
                      </button>
                      <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setPickingKind(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <span className="chq-review-criteria-cap-notice">
                    {editingCriteria.length} of about {MAX_PLAN_CRITERIA} · more than that and reviewers rush the last ones
                  </span>
                </div>
              </>
            );
          })()}
        </section>

        {!isNew && planId && (
          <section className="chq-section">
            {/* DEC-745: "Reviewer assignment" renamed to "Who reviews what",
                with "Assign a reviewer" as the link on the section's own
                rule (matching the "Add criterion" link pattern above) --
                progressive disclosure, not a capability drop: the existing
                create-account + scope-assign controls below still exist,
                they just open behind this link instead of always showing. */}
            <div className="chq-section-head">
              <h2 className="chq-section-label">Who reviews what</h2>
              {/* w25-g/DEC-745 amendment (A9): Delete plan moves OUT of this
                  section head -- it's a tertiary text link in the editor's
                  own footer row now, far left (see chq-review-editor-footer-
                  row below), leaving this section's action to "Assign a
                  reviewer" alone. */}
              <div className="chq-review-section-head-actions">
                <button
                  type="button"
                  className="chq-link-button chq-section-action"
                  onClick={() => setAssignFormOpen((open) => !open)}
                >
                  {assignFormOpen ? 'Close' : 'Assign a reviewer'}
                </button>
                {/* v12m-w5-b/DEC-808: the 390 frame's "Reviewers" head reads
                    a bare count ("4"), not the toggle's label -- phone-only
                    (the toggle above is styled to the frame's geometry at
                    that width rather than hidden, see review.css's
                    appended phone block, since this file's render test
                    queries the toggle by its "Assign a reviewer" name and
                    a second such control would make that query ambiguous).
                    The frame also draws a second, dashed "Assign a
                    reviewer" control below the roster (:679); duplicating
                    the toggle's accessible name there was rejected for the
                    same reason, and is filed in
                    docs/design/audit/review-admin-v12.md instead. */}
                <span className="chq-review-reviewers-count-phone" aria-hidden="true">
                  {reviewers.length}
                </span>
              </div>
            </div>
            {/* DEC-745 (wave-72 amendment): frame 05's PERSISTENT row --
                cap input, Distribute (a real button; it opens a preview,
                which is an action, never a text link), and the run's shape
                as one summary line -- lives below the section rule so the
                organiser can read it before ever clicking Distribute. */}
            <div className="chq-review-cap-row">
              {/* DEC-824: the cap is a parameter of THIS RUN -- typed here,
                  repeated byte-identically on the preview and the apply. */}
              <label className="chq-review-cap-input">
                Cap per reviewer
                <input
                  type="number"
                  className="chq-input"
                  min={1}
                  step={1}
                  value={capPerReviewerInput}
                  onChange={(e) => setCapPerReviewerInput(e.target.value)}
                  placeholder="No cap"
                />
                <span>talks each</span>
              </label>
              {/* DEC-786: preview-then-confirm, matching the "Assign a
                  reviewer" link pattern -- zero non-GET requests before the
                  explicit confirm below. */}
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                disabled={distributeLoading}
                onClick={openDistributePreview}
              >
                {distributeLoading ? 'Loading…' : 'Distribute the unassigned'}
              </button>
              {/* w40-e/DEC-745 amendment: the reviewer term is the account
                  COUNT off the progress envelope's `total` (one row per
                  user), never reviewers.length (a plan_reviewer ROW list --
                  one reviewer scoped to two tracks is two rows). Neither
                  figure is fabricated: the whole summary waits for both
                  numbers to have actually loaded. */}
              {submissionsInScope !== null && reviewerAccountCount !== null && (
                <span className="chq-review-distribute-summary">
                  {capRowSummaryLine(submissionsInScope, draft.maxEvaluationsPerSubmission ?? 1, reviewerAccountCount)}
                </span>
              )}
            </div>
            {/* w1-g/DEC-745 wave-98 amendment: docs/design/Chautauqua
                Review.dc.html:663 draws a SECOND, dashed "Assign a
                reviewer" control below the roster/cap row -- phone-only,
                distinct from the section-head toggle above (:2087). Both
                drive the SAME assignFormOpen state (one form, two
                triggers, never two open states, never two forms). Rather
                than a CSS max-width block the control is gated by isPhone
                (the same matchMedia(700px) hook Scorecard.tsx/Agenda.tsx
                already use) -- it does not exist in the DOM at all on
                desktop, so it needs no separate CSS visibility rule. Its
                geometry lives in review.css as .chq-review-assign-below
                (the wave-98 task deferred that rule to avoid contending
                with the five sibling branches also editing review.css;
                the rule was added at merge-train integration, once that
                contention was resolved, so the control carries a DEC-406
                vocabulary class rather than inline hex literals). The
                earlier attempt
                duplicated the toggle's accessible name ("Assign a
                reviewer" twice) and broke `findByRole('button', { name:
                'Assign a reviewer' })` in PlanEditor.render.test.tsx; this
                control instead carries aria-label="Assign a reviewer,
                below the roster" so the two triggers are queryable
                independently, and the head toggle's own accessible name
                is untouched. */}
            {isPhone && (
              <button
                type="button"
                className="chq-review-assign-below"
                aria-label="Assign a reviewer, below the roster"
                onClick={() => setAssignFormOpen((open) => !open)}
              >
                {assignFormOpen ? 'Close' : 'Assign a reviewer'}
              </button>
            )}
            {/* wave 49/DEC-745 amendment: the split between drafted FIELDS
                (Save-gated) and immediate ACTIONS is legible right on the
                section rule -- same chq-review-section-caption convention
                the Scoring criteria section already uses above, no new
                band, no floating primary.
                w18-e/DEC-745 amendment: "Distribute" is preview-then-confirm
                (DEC-786) -- its own preview already states "Nothing is
                saved until you confirm" (:1602), so this caption no longer
                claims it applies immediately; only "Assign a reviewer" is a
                real zero-confirm immediate action. */}
            <p className="chq-review-section-caption">Assign a reviewer applies immediately.</p>
            {/* DEC-354 (amendment, wave 61): the write always succeeds --
                this is a quiet advisory beside the list, not an error
                banner and not the reviewerAssignErrors ErrorSummary below,
                since nothing failed. */}
            {scopeAdvisory && (
              <p className="chq-review-scope-advisory" role="status">
                {scopeAdvisory}
              </p>
            )}
            {reviewers.map((r) => {
              const progress = progressRows.find((p) => p.userId === r.userId);
              const displayName = progress ? reviewerDisplayLabel(progress) : (r.email ?? '(account removed)');
              const trackLabel = r.trackId
                ? r.trackName
                  ? `Track · ${r.trackName}`
                  : 'Track (removed)'
                : r.submissionId
                  ? r.submissionRef
                    ? `${r.submissionRef} - ${r.submissionTitle ?? 'Submission (removed)'}`
                    : 'Submission (removed)'
                  : 'All submissions';
              const loadLabel = progress ? countOf(progress.assigned, 'talk') : null;
              return (
                <div key={r.id} className="chq-review-reviewer-row">
                  <div>
                    <div className="chq-review-reviewer-name">{displayName}</div>
                    {r.email && r.email !== displayName && <div className="chq-review-reviewer-email">{r.email}</div>}
                  </div>
                  <span className="chq-review-reviewer-track">{trackLabel}</span>
                  <span className="chq-review-reviewer-load">{loadLabel}</span>
                  <button
                    type="button"
                    className="chq-btn chq-btn-tertiary"
                    onClick={() => setPendingUnassignReviewer({ id: r.id, displayName })}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {reviewers.length === 0 && (
              <EmptyState variant="fresh" what="No reviewers assigned yet." action={null} />
            )}
            {/* w40-e/DEC-745 amendment: the roster is the ONE place an
                assignment can be Removed -- past the page-1 MAX_PER_PAGE
                rows this states the true bound and lets every remaining
                assignment page in, same affordance as ReviewerQueue.tsx's
                "Show all N" footer. */}
            {reviewers.length > 0 && reviewers.length < reviewersTotal && (
              <div className="chq-review-queue-footer">
                <span className="chq-review-queue-footer-count-group">
                  <span className="chq-review-queue-footer-count">{`Showing ${reviewers.length} of ${reviewersTotal}`}</span>
                  <button
                    type="button"
                    className="chq-review-queue-footer-showall"
                    disabled={reviewersLoadingMore}
                    onClick={() => void loadAllReviewerAssignments()}
                  >
                    {reviewersLoadingMore ? 'Loading…' : `Show all ${reviewersTotal}`}
                  </button>
                </span>
              </div>
            )}

            {/* DEC-786: nothing is POSTed until the explicit confirm below --
                the preview already ran (GET only) when the link was clicked. */}
            {distributeConfirmOpen && distributePreview && (
              <div className="chq-review-scope-confirm" role="alertdialog" aria-label="Confirm even distribution">
                {distributePreview.totalAssigned === 0 && distributePreview.shortfall.length === 0 ? (
                  <p>Every submission already has enough reviewers -- nothing to distribute.</p>
                ) : (
                  <>
                    {/* DEC-840 wave-52: totalAssigned === 0 with a non-empty
                        shortfall is a run blocked entirely (cap or track
                        coverage) -- say so plainly instead of reusing the
                        "already has enough" sentence, which would contradict
                        the shortfall list rendered below. */}
                    {distributePreview.totalAssigned === 0 && (
                      <p>This run can't assign any talks.</p>
                    )}
                    {/* DEC-745 (wave-72 amendment): the cap row and the
                        summary now live ONCE, in the persistent row above
                        the section rule -- the confirm panel is not a
                        second opinion about the run's shape, just the
                        per-reviewer detail table. */}
                    <table className="chq-table chq-review-results-table chq-review-distribute-table">
                      <thead>
                        <tr>
                          <th className="chq-review-distribute-col-name">Name</th>
                          <th className="chq-review-distribute-col-track">Track</th>
                          <th className="chq-review-distribute-col-talks">Talks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distributePreview.perReviewer.map((pr) => (
                          <tr key={pr.userId}>
                            <td data-label="Name" className="chq-review-distribute-col-name">{pr.name}</td>
                            <td data-label="Track" className="chq-review-distribute-col-track">{pr.trackName ?? 'All submissions'}</td>
                            <td data-label="Talks" className="chq-review-distribute-col-talks">{distributeReviewerCell(pr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {distributePreview.shortfall.length > 0 && (
                  <div className="chq-review-distribute-shortfall">
                    {shortfallSummaries(distributePreview.shortfall).map((s) => (
                      <p key={s.key}>{s.text}</p>
                    ))}
                  </div>
                )}
                <p>Nothing is saved until you confirm.</p>
                <div className="chq-review-scope-confirm-actions">
                  {distributePreview.totalAssigned > 0 && (
                    <button
                      type="button"
                      className="chq-btn chq-btn-primary"
                      disabled={distributing}
                      onClick={confirmDistribute}
                    >
                      {distributing ? 'Distributing…' : `Assign these ${distributePreview.totalAssigned}`}
                    </button>
                  )}
                  <button type="button" className="chq-btn chq-btn-tertiary" onClick={cancelDistribute}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {assignFormOpen && (
              <>
                <div className="chq-review-reviewer-form">
                  <label className="chq-review-field">
                    New reviewer account (email)
                    <input
                      type="email"
                      className="chq-input"
                      placeholder="reviewer@example.com"
                      value={newReviewerEmail}
                      onChange={(e) => setNewReviewerEmail(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="chq-btn chq-btn-secondary"
                    disabled={creatingReviewer || !newReviewerEmail.trim()}
                    onClick={createReviewerAccount}
                  >
                    {creatingReviewer ? 'Creating…' : 'Create reviewer account'}
                  </button>
                </div>
                {revealedPassword && (
              <div className="chq-review-token-reveal" role="alert">
                <strong>Copy this password now — it will not be shown again:</strong>
                <code>{revealedPassword}</code>
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void copyRevealedPassword()}>
                  {copyResult?.ok ? 'Copied!' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  onClick={() => {
                    setRevealedPassword(null);
                    setCopyResult(null);
                  }}
                >
                  Done
                </button>
                <div role="status" aria-live="polite" className="chq-copy-status">
                  {copyResult
                    ? copyResult.ok
                      ? 'Copied'
                      : 'Copy failed — select the text and copy it manually'
                    : null}
                </div>
                {copyResult && !copyResult.ok ? (
                  <input
                    ref={failedCopyRef}
                    className="chq-input"
                    readOnly
                    value={copyResult.text}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Reviewer password to copy manually"
                  />
                ) : null}
              </div>
            )}

            {/* DEC-958 (wave-64 amendment): summarizes the WHOLE err.fields
                map from any of the three assign call sites, anchored to the
                control each key owns -- the operator's typed selection is
                never cleared on a refusal. */}
            {reviewerAssignErrors && reviewerAssignErrors.length > 0 && (
              <ErrorSummary
                heading={countHeading(reviewerAssignErrors.length, 'before this reviewer can be assigned')}
                problems={reviewerAssignErrors}
              />
            )}
            <div className="chq-review-reviewer-form">
              <select
                id="plan-reviewer-select"
                className="chq-select"
                aria-label="Reviewer"
                value={reviewerUserId}
                onChange={(e) => setReviewerUserId(e.target.value)}
              >
                <option value="">Select a reviewer…</option>
                {reviewerOptions.map((r) => {
                  // w35-e/DEC-757: name leads, email is the quiet secondary --
                  // an <option> can't render two lines, so the fallback rule
                  // (name if non-blank, else email) picks the primary text
                  // and the email is appended in parens only when a name is
                  // actually present.
                  const hasName = Boolean(r.name && r.name.trim());
                  const label = hasName ? r.name!.trim() : r.email;
                  return (
                    <option key={r.id} value={r.id}>
                      {hasName ? `${label} (${r.email})` : label}
                    </option>
                  );
                })}
              </select>
              {reviewerOptions.length < reviewerOptionsTotal && (
                // DEC-468: the picker only ever shows the first page of
                // /users?role=reviewer -- disclose the truncation rather
                // than letting the dropdown quietly imply it's exhaustive.
                <span className="chq-review-reviewer-truncated">
                  Showing first {reviewerOptions.length} of {reviewerOptionsTotal} reviewers
                </span>
              )}
              <select
                className="chq-select"
                aria-label="Assignment scope"
                value={reviewerScope}
                onChange={(e) => setReviewerScope(e.target.value as 'all' | 'track' | 'submission')}
              >
                <option value="all">All plan submissions</option>
                <option value="track">One track</option>
                <option value="submission">One submission</option>
              </select>
              {reviewerScope === 'track' && (
                <select
                  id="plan-reviewer-track-select"
                  className="chq-select"
                  aria-label="Track"
                  value={reviewerTrackId}
                  onChange={(e) => setReviewerTrackId(e.target.value)}
                >
                  <option value="">Select a track…</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {reviewerScope === 'submission' && (
                <>
                  {/* DEC-572: the submission picker is fed by the scope-preview
                      endpoint, which requires a trackId -- reusing the same
                      track select as scope 'track' rather than a free-text id. */}
                  <select
                    id="plan-reviewer-track-select"
                    className="chq-select"
                    aria-label="Track"
                    value={reviewerTrackId}
                    onChange={(e) => setReviewerTrackId(e.target.value)}
                  >
                    <option value="">Select a track…</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    id="plan-reviewer-submission-select"
                    className="chq-select"
                    aria-label="Submission"
                    value={reviewerSubmissionId}
                    onChange={(e) => setReviewerSubmissionId(e.target.value)}
                    disabled={!reviewerTrackId}
                  >
                    <option value="">Select a submission…</option>
                    {submissionPickerOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ref} — {s.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                type="button"
                className="chq-btn chq-btn-primary"
                onClick={assignReviewer}
                disabled={
                  !reviewerUserId.trim() ||
                  (reviewerScope === 'track' && (!reviewerTrackId || scopePreviewLoading || !scopePreview))
                }
              >
                {reviewerScope === 'track'
                  ? scopePreviewLoading
                    ? 'Loading…'
                    : scopePreview
                      ? `Assign ${scopePreview.count} submissions in ${tracks.find((t) => t.id === reviewerTrackId)?.name ?? reviewerTrackId}`
                      : 'Assign'
                  : 'Assign'}
              </button>
            </div>

            {/* DEC-572: nothing is POSTed until one of the two confirm
                choices below is clicked. */}
            {confirmOpen && scopePreview && (
              <div className="chq-review-scope-confirm" role="alertdialog" aria-label="Confirm track assignment">
                <p>
                  Assign {countOf(scopePreview.count, 'submission')} in{' '}
                  {tracks.find((t) => t.id === reviewerTrackId)?.name ?? reviewerTrackId} to this reviewer?
                </p>
                <ul className="chq-review-scope-preview-list">
                  {scopePreview.items.slice(0, 10).map((item) => (
                    <li key={item.id}>
                      {item.ref} — {item.title}
                    </li>
                  ))}
                </ul>
                {!chooseMode ? (
                  <div className="chq-review-scope-confirm-actions">
                    <button
                      type="button"
                      className="chq-btn chq-btn-primary"
                      disabled={assigningBatch}
                      onClick={confirmAssignAllInTrack}
                    >
                      {assigningBatch ? 'Assigning…' : `Assign all ${scopePreview.count}`}
                    </button>
                    <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setChooseMode(true)}>
                      Choose submissions
                    </button>
                    <button type="button" className="chq-btn chq-btn-tertiary" onClick={resetScopeConfirm}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div id="plan-reviewer-choose-submissions" className="chq-review-scope-choose">
                    {scopePreview.items.map((item) => (
                      <label key={item.id} className="chq-review-checkbox-label">
                        <input
                          type="checkbox"
                          className="chq-check"
                          checked={chosenSubmissionIds.has(item.id)}
                          onChange={() => toggleChosenSubmission(item.id)}
                        />
                        {item.ref} — {item.title}
                      </label>
                    ))}
                    <div className="chq-review-scope-confirm-actions">
                      <button
                        type="button"
                        className="chq-btn chq-btn-primary"
                        disabled={assigningBatch || chosenSubmissionIds.size === 0}
                        onClick={confirmAssignChosen}
                      >
                        {assigningBatch ? 'Assigning…' : `Confirm selection (${chosenSubmissionIds.size})`}
                      </button>
                      <button type="button" className="chq-btn chq-btn-tertiary" onClick={resetScopeConfirm}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}

            {/* DEC-745: the fixed footnote this section always ends with. */}
            <p className="chq-review-field-caption">A reviewer never sees a talk they are recused from.</p>
          </section>
        )}
      </div>

      {/* w25-g/DEC-745 amendment (A9): Delete plan lives beside Assign, but
          as a TERTIARY text link in the editor's own footer row, far left --
          not a framed button, and not the "Who reviews what" section head
          it used to share with Assign a reviewer. It disables once any
          review has landed anywhere on the plan (planHasSubmittedReview,
          the DEC-213 predicate); disabled adjacent copy names the
          alternative ("Start a new wave") rather than leaving the organiser
          to guess -- the delete capability itself is never removed, only
          gated. */}
      {!isNew && planId && (
        <div className="chq-review-editor-footer-row">
          <button
            type="button"
            className="chq-link-button chq-review-editor-footer-delete"
            disabled={saving || deletePreviewLoading || planHasSubmittedReview}
            onClick={removePlan}
          >
            {deletePreviewLoading ? 'Loading…' : 'Delete plan'}
          </button>
          {planHasSubmittedReview && (
            <span className="chq-review-field-caption">
              Delete plan is unavailable once a review has landed — start a new wave instead.
            </span>
          )}
        </div>
      )}

      {deletePlanConfirmOpen && deletePreview && (
        <ConfirmDialog
          title="Delete evaluation plan"
          body={`This will permanently delete ${countOf(deletePreview.evaluationsSubmitted, 'submitted evaluation')} and ${countOf(deletePreview.evaluationsDraft, 'draft evaluation')}, ${countOf(deletePreview.reviewers, 'reviewer assignment')}, and ${countOf(deletePreview.recusals, 'recusal')}. This plan's results table and CSV export go with it.`}
          confirmLabel="Delete plan"
          pending={saving}
          onConfirm={confirmRemovePlan}
          onCancel={() => setDeletePlanConfirmOpen(false)}
        />
      )}

      {leaveConfirmOpen && (
        <ConfirmDialog
          title="Leave without saving?"
          body={`${joinWithAnd(dirtyFieldLabels())} ${plural(dirtyFieldLabels().length, 'is', 'are')} not saved yet.`}
          confirmLabel="Leave"
          cancelLabel="Keep editing"
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}

      {anonymizeRatchetConfirmOpen && (
        <ConfirmDialog
          title="Turn off anonymity?"
          body="Anyone who already reviewed under anonymity keeps that promise — it cannot be revoked for evaluations already submitted. Turning this off only changes what happens from here on."
          confirmLabel="Turn off anonymity"
          pending={saving}
          onConfirm={confirmAnonymizeRatchet}
          onCancel={cancelAnonymizeRatchet}
        />
      )}

      {pendingUnassignReviewer && (
        <ConfirmDialog
          title="Remove this reviewer?"
          body={`${pendingUnassignReviewer.displayName} loses their queue on this plan. Scores they have already submitted stay.`}
          confirmLabel="Remove reviewer"
          pending={unassigningReviewer}
          onConfirm={() => void confirmUnassignReviewer()}
          onCancel={() => setPendingUnassignReviewer(null)}
        />
      )}
    </div>
  );
}
