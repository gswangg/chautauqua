import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { copyText } from '../../lib/clipboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateField } from '../../components/DateField';
import { DelayedLoading } from '../../components/DelayedLoading';
import { addCriterion, removeCriterion, updateCriterion, validateCriteriaList, validatePlanDraft } from './planForm';
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
import { criterionWeightShares, DEFAULT_PLAN_CRITERIA } from '../../../../src/domain/evaluation';
import { DEC_745, DEC_786, DEC_824, DEC_882, DEC_715 } from '../../../../src/decisions';
import { countOf } from '../../lib/plural';

void DEC_745; // v4 shell: title-row NAME/Duplicate/Save, 2x2 field grid, "Who reviews what" below
void DEC_786; // "Distribute evenly" link below: preview-then-confirm, zero non-GET requests before confirm
void DEC_824; // cap-per-reviewer input + shortfall/note rendering in the confirm dialog below
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

// DEC-676: soft cap on the criteria list -- Add disables with an honest
// caption once reached, never a silent no-op.
const MAX_CRITERIA = 7;

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

// DEC-674 (mirrored from PlanList's isWindowOpen): a plan's window is "open"
// iff now falls inside [openAt, closeAt], treating a null bound as
// unbounded on that side.
function isPlanOpenNow(openAt: number | null, closeAt: number | null, now: number): boolean {
  if (closeAt !== null && closeAt < now) return false;
  if (openAt !== null && openAt > now) return false;
  return true;
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
function distributeSummaryLine(preview: DistributePreview, reviewsPerTalk: number): string {
  const talkIds = new Set<string>();
  for (const item of preview.items) talkIds.add(item.submissionId);
  for (const s of preview.shortfall) talkIds.add(s.submissionId);
  const talks = talkIds.size;
  const reviewsNeeded = talks * reviewsPerTalk;
  const reviewers = preview.perReviewer.length;
  return `${countOf(talks, 'talk')} · ${countOf(reviewsNeeded, 'review')} needed at ${reviewsPerTalk} each · ${countOf(reviewers, 'reviewer')}`;
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
    const noun = g.needed === 1 ? 'review stays' : 'reviews stay';
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
  // DEC-676: recorded-evaluation count per round (GET /plans/:id only) --
  // read-only server truth, never re-derived from draft state.
  const [evaluationCountsByRound, setEvaluationCountsByRound] = useState<Record<string, number>>({});
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reviewers, setReviewers] = useState<PlanReviewer[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFieldError, setDateFieldError] = useState<string | null>(null);
  // DEC-745: the plan NAME is the page title now, an <input> rather than a
  // labelled field row. A brand-new plan starts blank, so its "required"
  // error must stay silent until the field has actually been touched --
  // an existing plan always loads with a name, so it's touched from the start.
  const [nameTouched, setNameTouched] = useState(!isNew);
  // DEC-745: "Assign a reviewer" is a link on the "Who reviews what" rule,
  // not an always-open form -- it discloses the assignment controls
  // (existing create-account + scope-assign capability, never dropped).
  const [assignFormOpen, setAssignFormOpen] = useState(false);
  // DEC-745/DEC-708: "load" on a reviewer row ("6 talks") reads the same
  // assigned/completed aggregate ProgressPanel already renders, joined by
  // userId -- never a second count derived here.
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);

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

  // DEC-882: the page header's "Open · N of M reviews in" reads the SAME
  // progress aggregate ProgressPanel/PlanList already read (progressRows via
  // progressTotals) -- never a second count derived in this component.
  const planIsOpen = !isNew && isPlanOpenNow(draft.openAt, draft.closeAt, Date.now());
  const { completed: reviewsCompleted, assigned: reviewsAssigned } = progressTotals(progressRows);

  function setOpenAt(value: string) {
    try {
      const ms = dateInputToMs(value);
      setDateFieldError(null);
      setDraft((d) => ({ ...d, openAt: ms }));
    } catch {
      setDateFieldError('Enter a valid open date.');
    }
  }

  function setCloseAt(value: string) {
    try {
      const ms = dateInputToMs(value);
      setDateFieldError(null);
      setDraft((d) => ({ ...d, closeAt: ms }));
    } catch {
      setDateFieldError('Enter a valid close date.');
    }
  }

  useEffect(() => {
    if (!eventId) return;
    apiList<Track>(`/events/${eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
  }, [eventId]);

  useEffect(() => {
    if (isNew || !planId) return;
    setLoading(true);
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
          maxEvaluationsPerSubmission: plan.maxEvaluations ?? undefined,
        };
        setDraft(loaded);
        setPristineDraft(loaded);
        setEvaluationCountsByRound(plan.evaluationCountsByRound ?? {});
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load plan'))
      .finally(() => setLoading(false));
    apiList<PlanReviewer>(`/plans/${planId}/reviewers`)
      .then((res) => setReviewers(res.items))
      .catch(() => {
        // Reviewer roster is a nice-to-have on the editor; the plan itself
        // still loaded, so don't block the page on this failing.
      });
    apiList<ProgressRow>(`/plans/${planId}/progress`)
      .then((res) => setProgressRows(res.items))
      .catch(() => {
        // Same non-blocking treatment -- rows still render with a bare
        // email/no load count if this fails.
      });
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

  // DEC-799: anonymize is now a drafted FIELD (wave 49/DEC-745 amendment),
  // so its true->false ratchet confirm fires at Save time, not on the
  // checkbox click -- the server still refuses the flip outright once any
  // evaluation was submitted under anonymity (src/routes/review/plans-crud.ts).
  const [anonymizeRatchetConfirmOpen, setAnonymizeRatchetConfirmOpen] = useState(false);

  async function save() {
    if (!eventId) return;
    // DEC-745: a Save/Create click always surfaces the name error even if
    // the title input itself was never blurred.
    setNameTouched(true);
    if (Object.keys(errors).length > 0) {
      setError('Fix the highlighted fields before saving.');
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
      setError(err instanceof ApiError ? err.message : 'Failed to save plan');
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
      const [reviewersRes] = await Promise.all([apiList<PlanReviewer>(`/plans/${planId}/reviewers`)]);
      setReviewers(reviewersRes.items);
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
      .catch(() => setSubmissionPickerOptions([]));
  }, [planId, reviewerScope, reviewerTrackId]);

  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [creatingReviewer, setCreatingReviewer] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);
  // DEC-215: tracks the userId whose "Reset password" request is in flight,
  // so only that row's button disables (pattern: creatingReviewer above).
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

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
    const created = await apiPost<PlanReviewer>(`/plans/${planId}/reviewers`, body);
    // The server decorates the create response with the same email/
    // trackName/submissionRef/submissionTitle labels the list mapper
    // computes (DEC-659 amendment), so the row never flashes a raw id or a
    // "(removed)" label before the next reload.
    setReviewers((prev) => [...prev, created]);
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
    try {
      const body: { userId: string; trackId?: string; submissionId?: string } = { userId: reviewerUserId.trim() };
      if (reviewerScope === 'submission' && reviewerSubmissionId.trim()) body.submissionId = reviewerSubmissionId.trim();
      await postReviewerAssignment(body);
      setReviewerUserId('');
      setReviewerSubmissionId('');
    } catch (err) {
      // Surface the server's field-specific message verbatim (e.g. the
      // DEC-623 unknown-ref hint) over the generic top-level message.
      setError(err instanceof ApiError ? (err.fields?.submissionId ?? err.message) : 'Failed to assign reviewer');
    }
  }

  // "Assign all N": the single trackId-scoped plan_reviewer row, exactly as
  // before the DEC-572 confirm gate was added.
  async function confirmAssignAllInTrack() {
    if (!planId || !reviewerUserId.trim() || !reviewerTrackId) return;
    setError(null);
    setAssigningBatch(true);
    try {
      await postReviewerAssignment({ userId: reviewerUserId.trim(), trackId: reviewerTrackId });
      setReviewerUserId('');
      resetScopeConfirm();
      setScopePreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign reviewer');
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
    setAssigningBatch(true);
    try {
      const { items } = await apiPost<{ items: PlanReviewer[]; total: number }>(`/plans/${planId}/reviewers`, {
        userId: reviewerUserId.trim(),
        submissionIds: [...chosenSubmissionIds],
      });
      // Server-decorated response (mirrors postReviewerAssignment above) --
      // every item already carries email/trackName/submissionRef/
      // submissionTitle, so no client-side patching is needed.
      setReviewers((prev) => [...prev, ...items]);
      setReviewerUserId('');
      resetScopeConfirm();
      setScopePreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields?.submissionIds ?? err.message) : 'Failed to assign reviewer');
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
      setPendingUnassignReviewer(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove reviewer');
    } finally {
      setUnassigningReviewer(false);
    }
  }

  // DEC-215: organizer-triggered password re-issue for a reviewer roster
  // entry. Reuses the same one-time-reveal banner as account creation.
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<{ userId: string; email: string | undefined } | null>(
    null,
  );

  function resetReviewerPassword(userId: string, email: string | undefined) {
    setResetPasswordConfirm({ userId, email });
  }

  async function confirmResetReviewerPassword() {
    if (!resetPasswordConfirm) return;
    const { userId } = resetPasswordConfirm;
    setError(null);
    setResettingUserId(userId);
    try {
      const res = await apiPost<{ id: string; email: string; role: string; password: string }>(
        `/users/${userId}/reset-password`,
        {},
      );
      setRevealedPassword(res.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResettingUserId(null);
      setResetPasswordConfirm(null);
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
        <DelayedLoading />
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page chq-measure-table">
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
            className="chq-review-editor-title-input"
            aria-label="Plan name"
            placeholder="New evaluation plan"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={() => setNameTouched(true)}
          />
          {nameTouched && errors.name && <span className="chq-review-field-error">{errors.name}</span>}
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
              <button
                type="button"
                className="chq-btn chq-btn-tertiary"
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
      {dateFieldError && (
        <div className="chq-error" role="alert">
          {dateFieldError}
        </div>
      )}

      <div className="chq-review-editor">
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
              className="chq-input chq-date-input"
              value={msToDateInput(draft.closeAt)}
              onChange={setCloseAt}
            />
          </label>
          <label className="chq-review-field">
            Reviews per talk
            <input
              type="number"
              className="chq-input"
              min={1}
              value={draft.maxEvaluationsPerSubmission ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  maxEvaluationsPerSubmission: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
            {errors.maxEvaluationsPerSubmission && (
              <span className="chq-review-field-error">{errors.maxEvaluationsPerSubmission}</span>
            )}
          </label>
          <div className="chq-review-field">
            Rating scale
            <div className="chq-review-scale-inputs">
              <input
                type="number"
                className="chq-input"
                aria-label="Scale min"
                value={draft.scale.min}
                onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, min: Number(e.target.value) } }))}
              />
              <span aria-hidden="true">to</span>
              <input
                type="number"
                className="chq-input"
                aria-label="Scale max"
                value={draft.scale.max}
                onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, max: Number(e.target.value) } }))}
              />
            </div>
            <span className="chq-review-field-caption">Applies to every criterion in this plan</span>
            {errors.scale && <span className="chq-review-field-error">{errors.scale}</span>}
          </div>
        </div>

        <section className="chq-section">
          <div className="chq-section-head">
            <h2 className="chq-section-label">Scoring criteria</h2>
            {/* w41-f/DEC-882 amendment: a locked round names its constraint
                right in the section rule, not just below the rows -- the
                same evaluationCountsByRound-derived count the lock card
                below already states, never a second fetch. */}
            {activeRoundIsLocked && (
              <span className="chq-review-criteria-locked-eyebrow">
                Locked — {countOf(activeRoundLockedCount, 'review')} scored against these criteria
              </span>
            )}
          </div>
          {/* DEC-676: weights stay relative and plan-wide -- never forced to
              sum to 100 -- so the section states how they're used. */}
          <p className="chq-review-section-caption">
            Scores average by weight.
            {activeRoundIsLocked && ' Wording, weights and the scale are fixed for the rest of this wave.'}
          </p>

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

          {(activeRound === 0 ? errors.criteria : criteriaErrors.criteria) && (
            <span className="chq-review-field-error">{activeRound === 0 ? errors.criteria : criteriaErrors.criteria}</span>
          )}
          {/* DEC-882: the criteria list names its columns, in the
              section-label type this page already uses, aligned to the
              existing criterion row's grid columns. */}
          <div className="chq-review-criteria-head-row" aria-hidden="true">
            {/* DEC-715: the drag-handle column has no header label of its own. */}
            <span> </span>
            <span className="chq-review-criteria-head-cell">Criterion </span>
            <span className="chq-review-criteria-head-cell">Guidance for reviewers · Optional </span>
            <span> </span>
            <span className="chq-review-criteria-head-cell">Weight </span>
            <span> </span>
          </div>
          {(() => {
            // DEC-676: shares are computed over the whole editing list --
            // dropdown/text rows have no weight and get no share entry.
            const shares = criterionWeightShares(editingCriteria);
            const atCap = editingCriteria.length >= MAX_CRITERIA;
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
                      <span />
                      <span>
                        {criterion.kind === 'rating' && shares[criterion.id] !== undefined
                          ? `Weight ${criterion.weight} · ${shares[criterion.id]}%`
                          : ''}
                      </span>
                      <span />
                    </div>
                  ))}
                  {/* DEC-882: the lock card sits BELOW the rows -- a reader
                      sees what the criteria ARE before being told why they
                      cannot change. */}
                  <div className="chq-review-criteria-locked-notice" role="status">
                    <div className="chq-review-criteria-locked-text">
                      <p className="chq-review-criteria-locked-headline">
                        Locked · {countOf(activeRoundLockedCount, 'review')} scored
                        against these criteria
                      </p>
                      <p className="chq-review-criteria-locked-reason">Changing these would rescore work already done</p>
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
                      className="chq-input"
                      placeholder="Label"
                      aria-label="Criterion label"
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
                      onChange={(e) =>
                        setEditingCriteria((c) => updateCriterion(c, criterion.id, { guidance: e.target.value }))
                      }
                    />
                    <span className="chq-review-criterion-kind">{criterion.kind}</span>
                    {criterion.kind === 'rating' ? (
                      <span className="chq-review-criterion-weight">
                        <input
                          type="number"
                          className="chq-input"
                          min={0}
                          step="0.1"
                          aria-label={`${criterion.label || 'criterion'} weight`}
                          value={criterion.weight ?? ''}
                          disabled={activeRoundIsLocked}
                          onChange={(e) =>
                            setEditingCriteria((c) => updateCriterion(c, criterion.id, { weight: Number(e.target.value) }))
                          }
                        />
                        {shares[criterion.id] !== undefined && (
                          <span className="chq-review-criterion-share">
                            {criterion.weight} · {shares[criterion.id]}%
                          </span>
                        )}
                      </span>
                    ) : criterion.kind === 'dropdown' ? (
                      <input
                        className="chq-input"
                        placeholder="Options (comma-separated)"
                        aria-label={`${criterion.label || 'criterion'} options`}
                        value={(criterion.options ?? []).join(', ')}
                        disabled={activeRoundIsLocked}
                        onChange={(e) =>
                          setEditingCriteria((c) =>
                            updateCriterion(c, criterion.id, {
                              options: e.target.value
                                .split(',')
                                .map((o) => o.trim())
                                .filter((o) => o.length > 0),
                            }),
                          )
                        }
                      />
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
                    {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`] && (
                      <span className="chq-review-field-error">{(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`]}</span>
                    )}
                    {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`] && (
                      <span className="chq-review-field-error">{(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`]}</span>
                    )}
                    {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`] && (
                      <span className="chq-review-field-error">{(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`]}</span>
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
                        Rating
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        onClick={() => {
                          setEditingCriteria((c) => addCriterion(c, 'dropdown' as CriterionKind));
                          setPickingKind(false);
                        }}
                      >
                        Dropdown
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        onClick={() => {
                          setEditingCriteria((c) => addCriterion(c, 'text' as CriterionKind));
                          setPickingKind(false);
                        }}
                      >
                        Text
                      </button>
                      <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setPickingKind(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <span className="chq-review-criteria-cap-notice">
                    {editingCriteria.length} of about {MAX_CRITERIA} · more than that and reviewers rush the last ones
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
              <button
                type="button"
                className="chq-link-button chq-section-action"
                onClick={() => setAssignFormOpen((open) => !open)}
              >
                {assignFormOpen ? 'Close' : 'Assign a reviewer'}
              </button>
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
              </label>
              {/* DEC-786: preview-then-confirm, matching the "Assign a
                  reviewer" link pattern -- zero non-GET requests before the
                  explicit confirm below. */}
              <button
                type="button"
                className="chq-link-button chq-section-action"
                disabled={distributeLoading}
                onClick={openDistributePreview}
              >
                {distributeLoading ? 'Loading…' : 'Distribute the unassigned'}
              </button>
            </div>
            {/* wave 49/DEC-745 amendment: the split between drafted FIELDS
                (Save-gated) and immediate ACTIONS is legible right on the
                section rule -- same chq-review-section-caption convention
                the Scoring criteria section already uses above, no new
                band, no floating primary. */}
            <p className="chq-review-section-caption">
              Assign a reviewer applies immediately. Distribute the unassigned applies immediately.
            </p>
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
                    className="chq-btn chq-btn-secondary"
                    disabled={resettingUserId === r.userId}
                    onClick={() => resetReviewerPassword(r.userId, r.email)}
                  >
                    {resettingUserId === r.userId ? 'Resetting…' : 'Reset password'}
                  </button>
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
            {reviewers.length === 0 && <p className="chq-empty">No reviewers assigned yet.</p>}

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
                    {/* frame 03: the cap row -- CAP PER REVIEWER [n] talks each,
                        echoing distributePreview.cap (DEC-840 byte-identical
                        value), never a re-derivation from the live input. */}
                    <div className="chq-review-distribute-cap-row">
                      <span className="chq-review-results-eyebrow">Cap per reviewer</span>
                      <span className="chq-review-distribute-cap-value">
                        {distributePreview.cap !== null ? distributePreview.cap : 'No cap'}
                      </span>
                      {distributePreview.cap !== null && <span>talks each</span>}
                    </div>
                    <p className="chq-review-distribute-summary">
                      {distributeSummaryLine(distributePreview, draft.maxEvaluationsPerSubmission ?? 1)}
                    </p>
                    <table className="chq-review-results-table chq-review-distribute-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Track</th>
                          <th>Talks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distributePreview.perReviewer.map((pr) => (
                          <tr key={pr.userId}>
                            <td data-label="Name">{pr.name}</td>
                            <td data-label="Track">{pr.trackName ?? 'All submissions'}</td>
                            <td data-label="Talks">{distributeReviewerCell(pr)}</td>
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

            {/* DEC-745: the anonymise switch is a reviewing rule, so it
                lives here as one checkbox row rather than at page top level
                (SPEC §5.7/J4 blind review stays reachable even though the
                mock omits the control entirely). */}
            <label className="chq-review-checkbox-label">
              <input
                type="checkbox"
                className="chq-check"
                checked={draft.anonymized}
                onChange={(e) => setDraft((d) => ({ ...d, anonymized: e.target.checked }))}
              />
              Anonymize speaker identity for reviewers
            </label>

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

            <div className="chq-review-reviewer-form">
              <select className="chq-select" aria-label="Reviewer" value={reviewerUserId} onChange={(e) => setReviewerUserId(e.target.value)}>
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
                <select className="chq-select" aria-label="Track" value={reviewerTrackId} onChange={(e) => setReviewerTrackId(e.target.value)}>
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
                  <select className="chq-select" aria-label="Track" value={reviewerTrackId} onChange={(e) => setReviewerTrackId(e.target.value)}>
                    <option value="">Select a track…</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
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
                  <div className="chq-review-scope-choose">
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

        {/* DEC-745: Save/Create moved to the title row -- Delete stays as
            ONE quiet tertiary at the very end of the document, never beside
            Save. */}
        {!isNew && (
          <footer className="chq-review-editor-footer">
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={saving || deletePreviewLoading}
              onClick={removePlan}
            >
              Delete plan
            </button>
          </footer>
        )}
      </div>

      {deletePlanConfirmOpen && deletePreview && (
        <ConfirmDialog
          title="Delete evaluation plan"
          body={`This will permanently delete ${countOf(deletePreview.evaluationsSubmitted, 'submitted evaluation')} and ${countOf(deletePreview.evaluationsDraft, 'draft evaluation')}, ${countOf(deletePreview.reviewers, 'reviewer assignment')}, and ${countOf(deletePreview.recusals, 'recusal')}. This plan's results table and CSV export go with it.`}
          confirmLabel="Delete plan"
          destructive
          pending={saving}
          onConfirm={confirmRemovePlan}
          onCancel={() => setDeletePlanConfirmOpen(false)}
        />
      )}

      {leaveConfirmOpen && (
        <ConfirmDialog
          title="Leave without saving?"
          body={`${joinWithAnd(dirtyFieldLabels())} ${dirtyFieldLabels().length === 1 ? 'is' : 'are'} not saved yet.`}
          confirmLabel="Leave"
          cancelLabel="Keep editing"
          destructive
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}

      {anonymizeRatchetConfirmOpen && (
        <ConfirmDialog
          title="Turn off anonymity?"
          body="Anyone who already reviewed under anonymity keeps that promise -- it cannot be revoked for evaluations already submitted. Turning this off only changes what happens from here on."
          confirmLabel="Turn off anonymity"
          destructive
          pending={saving}
          onConfirm={confirmAnonymizeRatchet}
          onCancel={cancelAnonymizeRatchet}
        />
      )}

      {resetPasswordConfirm && (
        <ConfirmDialog
          title="Reset password"
          body={`Reset the password for ${resetPasswordConfirm.email ?? resetPasswordConfirm.userId}? Their existing sessions will be signed out.`}
          confirmLabel="Reset password"
          destructive
          pending={resettingUserId === resetPasswordConfirm.userId}
          onConfirm={confirmResetReviewerPassword}
          onCancel={() => setResetPasswordConfirm(null)}
        />
      )}

      {pendingUnassignReviewer && (
        <ConfirmDialog
          title="Remove this reviewer?"
          body={`${pendingUnassignReviewer.displayName} loses their queue on this plan. Scores they have already submitted stay.`}
          confirmLabel="Remove"
          destructive
          pending={unassigningReviewer}
          onConfirm={() => void confirmUnassignReviewer()}
          onCancel={() => setPendingUnassignReviewer(null)}
        />
      )}
    </div>
  );
}
