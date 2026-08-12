import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { copyText } from '../../lib/clipboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DelayedLoading } from '../../components/DelayedLoading';
import { addCriterion, removeCriterion, updateCriterion, validateCriteriaList, validatePlanDraft } from './planForm';
import './review.css';
import {
  DEFAULT_PLAN_DRAFT,
  type CriterionKind,
  type EvaluationCriterion,
  type EvaluationPlan,
  type PlanDraft,
  type PlanReviewer,
  type ReviewerOption,
  type ScopePreview,
  type Track,
} from './types';

// DEC-572: batches per-submission plan_reviewer POSTs to at most this many
// concurrent requests per wave, mirroring the server's own bound.
const SCOPE_ASSIGN_BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function PlanEditor() {
  const { planId } = useParams<{ planId: string }>();
  const isNew = !planId || planId === 'new';
  const navigate = useNavigate();
  const { eventId } = useCurrentEvent();

  const [draft, setDraft] = useState<PlanDraft>(DEFAULT_PLAN_DRAFT);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reviewers, setReviewers] = useState<PlanReviewer[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFieldError, setDateFieldError] = useState<string | null>(null);

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
        setDraft({
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
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load plan'))
      .finally(() => setLoading(false));
    apiList<PlanReviewer>(`/plans/${planId}/reviewers`)
      .then((res) => setReviewers(res.items))
      .catch(() => {
        // Reviewer roster is a nice-to-have on the editor; the plan itself
        // still loaded, so don't block the page on this failing.
      });
  }, [planId, isNew]);

  const errors = validatePlanDraft(draft);

  async function save() {
    if (!eventId) return;
    if (Object.keys(errors).length > 0) {
      setError('Fix the highlighted fields before saving.');
      return;
    }
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
        navigate(`/review/plans/${created.id}`);
      } else {
        await apiPatch<EvaluationPlan>(`/plans/${planId}`, body);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  const [deletePlanConfirmOpen, setDeletePlanConfirmOpen] = useState(false);

  function removePlan() {
    if (isNew || !planId) return;
    setDeletePlanConfirmOpen(true);
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
    // The create response doesn't carry an email (PlanReviewerRecord has no
    // such column); resolve it from the already-loaded reviewer options so
    // the row doesn't flash the raw userId until the next reload.
    const resolvedEmail = reviewerOptions.find((r) => r.id === created.userId)?.email;
    setReviewers((prev) => [...prev, { ...created, email: created.email ?? resolvedEmail }]);
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

  // "Choose submissions": one per-submission plan_reviewer row per checked
  // item, issued in batches of at most SCOPE_ASSIGN_BATCH_SIZE.
  async function confirmAssignChosen() {
    if (!planId || !reviewerUserId.trim() || chosenSubmissionIds.size === 0) return;
    setError(null);
    setAssigningBatch(true);
    try {
      const ids = [...chosenSubmissionIds];
      for (const batch of chunk(ids, SCOPE_ASSIGN_BATCH_SIZE)) {
        await Promise.all(
          batch.map((submissionId) => postReviewerAssignment({ userId: reviewerUserId.trim(), submissionId })),
        );
      }
      setReviewerUserId('');
      resetScopeConfirm();
      setScopePreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign reviewer');
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

  async function unassignReviewer(id: string) {
    if (!planId) return;
    try {
      await apiDelete(`/plans/${planId}/reviewers/${id}`);
      setReviewers((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove reviewer');
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
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Evaluation plan</h1>
        <div className="chq-error" role="alert">
          No event selected.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Evaluation plan</h1>
        <DelayedLoading />
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page">
      <p>
        <Link to="/review" className="chq-review-back">
          &larr; Back to plans
        </Link>
      </p>
      <h1 className="chq-page-title" style={{ fontSize: '27px' }}>
        {isNew ? 'New evaluation plan' : draft.name || 'Evaluation plan'}
      </h1>
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
        <label className="chq-review-field">
          Name
          <input
            className="chq-input"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {errors.name && <span className="chq-review-field-error">{errors.name}</span>}
        </label>

        <label className="chq-review-field">
          Instructions
          <textarea
            className="chq-textarea"
            value={draft.instructions ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
          />
        </label>

        <div className="chq-review-editor-dates">
          <label className="chq-review-field">
            Opens
            <input
              type="date"
              className="chq-input"
              value={msToDateInput(draft.openAt)}
              onChange={(e) => setOpenAt(e.target.value)}
            />
          </label>
          <label className="chq-review-field">
            Closes
            <input
              type="date"
              className="chq-input"
              value={msToDateInput(draft.closeAt)}
              onChange={(e) => setCloseAt(e.target.value)}
            />
          </label>
          <label className="chq-review-field">
            Rounds
            <input
              type="number"
              className="chq-input"
              min={1}
              value={draft.rounds}
              onChange={(e) => setDraft((d) => ({ ...d, rounds: Number(e.target.value) }))}
            />
            {errors.rounds && <span className="chq-review-field-error">{errors.rounds}</span>}
          </label>
        </div>

        <fieldset>
          <legend className="chq-review-field" style={{ marginBottom: '6px' }}>
            Track filter
          </legend>
          {tracks.map((track) => (
            <label key={track.id} className="chq-review-checkbox-label">
              <input
                type="checkbox"
                className="chq-check"
                checked={draft.trackIds.includes(track.id)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    trackIds: e.target.checked ? [...d.trackIds, track.id] : d.trackIds.filter((id) => id !== track.id),
                  }))
                }
              />
              {track.name}
            </label>
          ))}
          {tracks.length === 0 && <p className="chq-review-plan-meta">No tracks defined; plan covers all submissions.</p>}
        </fieldset>

        <label className="chq-review-checkbox-label">
          <input
            type="checkbox"
            className="chq-check"
            checked={draft.anonymized}
            onChange={(e) => setDraft((d) => ({ ...d, anonymized: e.target.checked }))}
          />
          Anonymize speaker identity for reviewers
        </label>

        <div className="chq-review-editor-dates">
          <label className="chq-review-field">
            Scale min
            <input
              type="number"
              className="chq-input"
              value={draft.scale.min}
              onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, min: Number(e.target.value) } }))}
            />
          </label>
          <label className="chq-review-field">
            Scale max
            <input
              type="number"
              className="chq-input"
              value={draft.scale.max}
              onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, max: Number(e.target.value) } }))}
            />
            {errors.scale && <span className="chq-review-field-error">{errors.scale}</span>}
          </label>
          <label className="chq-review-field">
            Max evaluations per submission (optional cap)
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
        </div>

        <section className="chq-section">
          <div className="chq-section-head">
            <h2 className="chq-section-label">Scoring criteria</h2>
          </div>

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
                  <button type="button" className="chq-btn chq-btn-secondary" onClick={revertActiveRoundToBase}>
                    Revert round {activeRound} to base
                  </button>
                ) : (
                  <button type="button" className="chq-btn chq-btn-secondary" onClick={customizeActiveRound}>
                    Customize round {activeRound} (inherits base until then)
                  </button>
                ))}
            </div>
          )}

          {(activeRound === 0 ? errors.criteria : criteriaErrors.criteria) && (
            <span className="chq-review-field-error">{activeRound === 0 ? errors.criteria : criteriaErrors.criteria}</span>
          )}
          {editingCriteria.map((criterion) => (
            <div key={criterion.id} className="chq-review-criterion-row">
              <input
                className="chq-input"
                placeholder="Label"
                aria-label="Criterion label"
                value={criterion.label}
                onChange={(e) => setEditingCriteria((c) => updateCriterion(c, criterion.id, { label: e.target.value }))}
              />
              <span className="chq-review-criterion-kind">{criterion.kind}</span>
              {criterion.kind === 'rating' ? (
                <input
                  type="number"
                  className="chq-input"
                  min={0}
                  step="0.1"
                  aria-label={`${criterion.label || 'criterion'} weight`}
                  value={criterion.weight ?? ''}
                  onChange={(e) =>
                    setEditingCriteria((c) => updateCriterion(c, criterion.id, { weight: Number(e.target.value) }))
                  }
                />
              ) : criterion.kind === 'dropdown' ? (
                <input
                  className="chq-input"
                  placeholder="Options (comma-separated)"
                  aria-label={`${criterion.label || 'criterion'} options`}
                  value={(criterion.options ?? []).join(', ')}
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
              <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setEditingCriteria((c) => removeCriterion(c, criterion.id))}>
                Remove
              </button>
            </div>
          ))}
          <div className="chq-review-add-criteria">
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setEditingCriteria((c) => addCriterion(c, 'rating' as CriterionKind))}>
              Add rating criterion
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setEditingCriteria((c) => addCriterion(c, 'dropdown' as CriterionKind))}>
              Add dropdown criterion
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setEditingCriteria((c) => addCriterion(c, 'text' as CriterionKind))}>
              Add free text criterion
            </button>
          </div>
        </section>

        <div className="chq-review-editor-actions">
          <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
            {isNew ? 'Create plan' : 'Save plan'}
          </button>
          {!isNew && (
            <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={removePlan}>
              Delete plan
            </button>
          )}
        </div>

        {!isNew && planId && (
          <section className="chq-section">
            <div className="chq-section-head">
              <h2 className="chq-section-label">Reviewer assignment</h2>
            </div>
            {reviewers.map((r) => (
              <div key={r.id} className="chq-review-reviewer-row">
                <div>
                  <div>{r.email ?? '(account removed)'}</div>
                  <div className="chq-review-reviewer-email">
                    {r.trackId
                      ? r.trackName
                        ? `Track - ${r.trackName}`
                        : 'Track (removed)'
                      : r.submissionId
                        ? r.submissionRef
                          ? `${r.submissionRef} - ${r.submissionTitle ?? 'Submission (removed)'}`
                          : 'Submission (removed)'
                        : 'All submissions'}
                  </div>
                </div>
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  disabled={resettingUserId === r.userId}
                  onClick={() => resetReviewerPassword(r.userId, r.email)}
                >
                  {resettingUserId === r.userId ? 'Resetting…' : 'Reset password'}
                </button>
                <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => unassignReviewer(r.id)}>
                  Remove
                </button>
              </div>
            ))}
            {reviewers.length === 0 && <p className="chq-empty">No reviewers assigned yet.</p>}

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
                {reviewerOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.email}
                  </option>
                ))}
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
                  Assign {scopePreview.count} submission{scopePreview.count === 1 ? '' : 's'} in{' '}
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
          </section>
        )}
      </div>

      {deletePlanConfirmOpen && (
        <ConfirmDialog
          title="Delete evaluation plan"
          confirmLabel="Delete plan"
          destructive
          pending={saving}
          onConfirm={confirmRemovePlan}
          onCancel={() => setDeletePlanConfirmOpen(false)}
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
    </div>
  );
}
