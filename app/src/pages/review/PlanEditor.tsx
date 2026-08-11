import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { addCriterion, removeCriterion, updateCriterion, validateCriteriaList, validatePlanDraft } from './planForm';
import {
  DEFAULT_PLAN_DRAFT,
  type CriterionKind,
  type EvaluationCriterion,
  type EvaluationPlan,
  type PlanDraft,
  type PlanReviewer,
  type ReviewerOption,
  type Track,
} from './types';

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

  async function removePlan() {
    if (isNew || !planId) return;
    if (!window.confirm('Delete this evaluation plan?')) return;
    setSaving(true);
    try {
      await apiDelete(`/plans/${planId}`);
      navigate('/review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete plan');
    } finally {
      setSaving(false);
    }
  }

  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([]);
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [reviewerScope, setReviewerScope] = useState<'all' | 'track' | 'submission'>('all');
  const [reviewerTrackId, setReviewerTrackId] = useState('');
  const [reviewerSubmissionId, setReviewerSubmissionId] = useState('');

  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [creatingReviewer, setCreatingReviewer] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  // DEC-215: tracks the userId whose "Reset password" request is in flight,
  // so only that row's button disables (pattern: creatingReviewer above).
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  function loadReviewerOptions() {
    return apiList<ReviewerOption>('/users?role=reviewer')
      .then((res) => setReviewerOptions(res.items))
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

  function copyRevealedPassword() {
    if (revealedPassword && navigator.clipboard) {
      navigator.clipboard.writeText(revealedPassword).catch(() => {
        // Clipboard access can be denied by the browser; the password is
        // still visible on-screen for manual copy.
      });
    }
  }

  async function assignReviewer() {
    if (!planId || !reviewerUserId.trim()) return;
    setError(null);
    try {
      const body: { userId: string; trackId?: string; submissionId?: string } = { userId: reviewerUserId.trim() };
      if (reviewerScope === 'track' && reviewerTrackId) body.trackId = reviewerTrackId;
      if (reviewerScope === 'submission' && reviewerSubmissionId.trim()) body.submissionId = reviewerSubmissionId.trim();
      const created = await apiPost<PlanReviewer>(`/plans/${planId}/reviewers`, body);
      setReviewers((prev) => [...prev, created]);
      setReviewerUserId('');
      setReviewerSubmissionId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign reviewer');
    }
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
  async function resetReviewerPassword(userId: string, email: string | undefined) {
    if (!window.confirm(`Reset the password for ${email ?? userId}? Their existing sessions will be signed out.`)) {
      return;
    }
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
    }
  }

  if (!eventId) {
    return (
      <div className="chq-page">
        <h1>Evaluation plan</h1>
        <div className="chq-attention-frame">No event selected.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Evaluation plan</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-plan-editor">
      <p>
        <Link to="/review">&larr; Back to plans</Link>
      </p>
      <h1>{isNew ? 'New evaluation plan' : draft.name || 'Evaluation plan'}</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      {dateFieldError && <div className="chq-error-banner">{dateFieldError}</div>}

      <label>
        Name
        <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        {errors.name && <span className="chq-field-error">{errors.name}</span>}
      </label>

      <label>
        Instructions
        <textarea
          value={draft.instructions ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
        />
      </label>

      <div className="chq-plan-dates">
        <label>
          Opens
          <input
            type="date"
            value={msToDateInput(draft.openAt)}
            onChange={(e) => setOpenAt(e.target.value)}
          />
        </label>
        <label>
          Closes
          <input
            type="date"
            value={msToDateInput(draft.closeAt)}
            onChange={(e) => setCloseAt(e.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend>Track filter</legend>
        {tracks.map((track) => (
          <label key={track.id} className="chq-checkbox-label">
            <input
              type="checkbox"
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
        {tracks.length === 0 && <p>No tracks defined; plan covers all submissions.</p>}
      </fieldset>

      <label className="chq-checkbox-label">
        <input
          type="checkbox"
          checked={draft.anonymized}
          onChange={(e) => setDraft((d) => ({ ...d, anonymized: e.target.checked }))}
        />
        Anonymize speaker identity for reviewers
      </label>

      <div className="chq-plan-scale">
        <label>
          Scale min
          <input
            type="number"
            value={draft.scale.min}
            onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, min: Number(e.target.value) } }))}
          />
        </label>
        <label>
          Scale max
          <input
            type="number"
            value={draft.scale.max}
            onChange={(e) => setDraft((d) => ({ ...d, scale: { ...d.scale, max: Number(e.target.value) } }))}
          />
        </label>
        {errors.scale && <span className="chq-field-error">{errors.scale}</span>}
      </div>

      <label>
        Rounds
        <input
          type="number"
          min={1}
          value={draft.rounds}
          onChange={(e) => setDraft((d) => ({ ...d, rounds: Number(e.target.value) }))}
        />
        {errors.rounds && <span className="chq-field-error">{errors.rounds}</span>}
      </label>

      <label>
        Max evaluations per submission (optional cap)
        <input
          type="number"
          min={1}
          value={draft.maxEvaluationsPerSubmission ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              maxEvaluationsPerSubmission: e.target.value === '' ? undefined : Number(e.target.value),
            }))
          }
        />
        {errors.maxEvaluationsPerSubmission && <span className="chq-field-error">{errors.maxEvaluationsPerSubmission}</span>}
      </label>

      <fieldset className="chq-criteria-editor">
        <legend>Weighted criteria</legend>

        {draft.rounds > 1 && (
          <div className="chq-criteria-round-tabs">
            <label>
              Editing criteria for
              <select value={activeRound} onChange={(e) => setActiveRound(Number(e.target.value))}>
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
                <button type="button" onClick={revertActiveRoundToBase}>
                  Revert round {activeRound} to base
                </button>
              ) : (
                <button type="button" onClick={customizeActiveRound}>
                  Customize round {activeRound} (inherits base until then)
                </button>
              ))}
          </div>
        )}

        {(activeRound === 0 ? errors.criteria : criteriaErrors.criteria) && (
          <span className="chq-field-error">{activeRound === 0 ? errors.criteria : criteriaErrors.criteria}</span>
        )}
        {editingCriteria.map((criterion) => (
          <div key={criterion.id} className="chq-criterion-row">
            <input
              placeholder="Label"
              aria-label="Criterion label"
              value={criterion.label}
              onChange={(e) => setEditingCriteria((c) => updateCriterion(c, criterion.id, { label: e.target.value }))}
            />
            <span className="chq-criterion-kind">{criterion.kind}</span>
            {criterion.kind === 'rating' ? (
              <input
                type="number"
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
              <label className="chq-checkbox-label">
                <input
                  type="checkbox"
                  aria-label={`${criterion.label || 'criterion'} required`}
                  checked={criterion.required ?? false}
                  onChange={(e) => setEditingCriteria((c) => updateCriterion(c, criterion.id, { required: e.target.checked }))}
                />
                Required
              </label>
            )}
            {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`] && (
              <span className="chq-field-error">{(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.label`]}</span>
            )}
            {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`] && (
              <span className="chq-field-error">{(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.weight`]}</span>
            )}
            {(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`] && (
              <span className="chq-field-error">{(activeRound === 0 ? errors : criteriaErrors)[`criterion.${criterion.id}.options`]}</span>
            )}
            <button type="button" onClick={() => setEditingCriteria((c) => removeCriterion(c, criterion.id))}>
              Remove
            </button>
          </div>
        ))}
        <div className="chq-criteria-add">
          <button type="button" onClick={() => setEditingCriteria((c) => addCriterion(c, 'rating' as CriterionKind))}>
            Add rating criterion
          </button>
          <button type="button" onClick={() => setEditingCriteria((c) => addCriterion(c, 'dropdown' as CriterionKind))}>
            Add dropdown criterion
          </button>
          <button type="button" onClick={() => setEditingCriteria((c) => addCriterion(c, 'text' as CriterionKind))}>
            Add free text criterion
          </button>
        </div>
      </fieldset>

      <div className="chq-plan-actions">
        <button type="button" disabled={saving} onClick={save}>
          {isNew ? 'Create plan' : 'Save plan'}
        </button>
        {!isNew && (
          <button type="button" disabled={saving} onClick={removePlan}>
            Delete plan
          </button>
        )}
      </div>

      {!isNew && planId && (
        <fieldset className="chq-reviewer-assignment">
          <legend>Reviewer assignment</legend>
          <ul>
            {reviewers.map((r) => (
              <li key={r.id}>
                {r.email ?? r.userId}
                {r.trackId ? ` — track ${r.trackId}` : r.submissionId ? ` — submission ${r.submissionId}` : ' — all submissions'}
                <button
                  type="button"
                  disabled={resettingUserId === r.userId}
                  onClick={() => resetReviewerPassword(r.userId, r.email)}
                >
                  {resettingUserId === r.userId ? 'Resetting…' : 'Reset password'}
                </button>
                <button type="button" onClick={() => unassignReviewer(r.id)}>
                  Remove
                </button>
              </li>
            ))}
            {reviewers.length === 0 && <li>No reviewers assigned yet.</li>}
          </ul>

          <div className="chq-reviewer-new-account">
            <label>
              New reviewer account (email)
              <input
                type="email"
                placeholder="reviewer@example.com"
                value={newReviewerEmail}
                onChange={(e) => setNewReviewerEmail(e.target.value)}
              />
            </label>
            <button type="button" disabled={creatingReviewer || !newReviewerEmail.trim()} onClick={createReviewerAccount}>
              {creatingReviewer ? 'Creating…' : 'Create reviewer account'}
            </button>
            {revealedPassword && (
              <div className="chq-token-reveal" role="alert">
                <strong>Copy this password now — it will not be shown again:</strong>
                <code>{revealedPassword}</code>
                <button type="button" onClick={copyRevealedPassword}>
                  Copy
                </button>
                <button type="button" onClick={() => setRevealedPassword(null)}>
                  Done
                </button>
              </div>
            )}
          </div>

          <div className="chq-reviewer-assign-form">
            <select aria-label="Reviewer" value={reviewerUserId} onChange={(e) => setReviewerUserId(e.target.value)}>
              <option value="">Select a reviewer…</option>
              {reviewerOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.email}
                </option>
              ))}
            </select>
            <select
              aria-label="Assignment scope"
              value={reviewerScope}
              onChange={(e) => setReviewerScope(e.target.value as 'all' | 'track' | 'submission')}
            >
              <option value="all">All plan submissions</option>
              <option value="track">One track</option>
              <option value="submission">One submission</option>
            </select>
            {reviewerScope === 'track' && (
              <select aria-label="Track" value={reviewerTrackId} onChange={(e) => setReviewerTrackId(e.target.value)}>
                <option value="">Select a track…</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {reviewerScope === 'submission' && (
              <input
                placeholder="Submission id"
                aria-label="Submission id"
                value={reviewerSubmissionId}
                onChange={(e) => setReviewerSubmissionId(e.target.value)}
              />
            )}
            <button type="button" onClick={assignReviewer}>
              Assign
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
