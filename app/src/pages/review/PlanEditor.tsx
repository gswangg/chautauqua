import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { addCriterion, removeCriterion, updateCriterion, validatePlanDraft } from './planForm';
import { DEFAULT_PLAN_DRAFT, type CriterionKind, type EvaluationPlan, type PlanDraft, type PlanReviewer, type Track } from './types';

function dateInputValue(ms: number | null): string {
  if (ms === null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDateInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(`${value}T00:00:00.000Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
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
          openAt: plan.openAt,
          closeAt: plan.closeAt,
          trackIds: plan.trackIds,
          anonymized: plan.anonymized,
          scale: plan.scale,
          criteria: plan.criteria,
          rounds: plan.rounds,
          maxEvaluationsPerSubmission: plan.maxEvaluationsPerSubmission,
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
    try {
      if (isNew) {
        const created = await apiPost<EvaluationPlan>(`/events/${eventId}/plans`, draft);
        navigate(`/review/plans/${created.id}`);
      } else {
        await apiPatch<EvaluationPlan>(`/plans/${planId}`, draft);
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

  const [reviewerUserId, setReviewerUserId] = useState('');
  const [reviewerScope, setReviewerScope] = useState<'all' | 'track' | 'submission'>('all');
  const [reviewerTrackId, setReviewerTrackId] = useState('');
  const [reviewerSubmissionId, setReviewerSubmissionId] = useState('');

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
            value={dateInputValue(draft.openAt)}
            onChange={(e) => setDraft((d) => ({ ...d, openAt: parseDateInput(e.target.value) }))}
          />
        </label>
        <label>
          Closes
          <input
            type="date"
            value={dateInputValue(draft.closeAt)}
            onChange={(e) => setDraft((d) => ({ ...d, closeAt: parseDateInput(e.target.value) }))}
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
        {errors.criteria && <span className="chq-field-error">{errors.criteria}</span>}
        {draft.criteria.map((criterion) => (
          <div key={criterion.id} className="chq-criterion-row">
            <input
              placeholder="Label"
              value={criterion.label}
              onChange={(e) => setDraft((d) => ({ ...d, criteria: updateCriterion(d.criteria, criterion.id, { label: e.target.value }) }))}
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
                  setDraft((d) => ({
                    ...d,
                    criteria: updateCriterion(d.criteria, criterion.id, { weight: Number(e.target.value) }),
                  }))
                }
              />
            ) : (
              <input
                placeholder="Options (comma-separated)"
                aria-label={`${criterion.label || 'criterion'} options`}
                value={(criterion.options ?? []).join(', ')}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    criteria: updateCriterion(d.criteria, criterion.id, {
                      options: e.target.value
                        .split(',')
                        .map((o) => o.trim())
                        .filter((o) => o.length > 0),
                    }),
                  }))
                }
              />
            )}
            {errors[`criterion.${criterion.id}.label`] && <span className="chq-field-error">{errors[`criterion.${criterion.id}.label`]}</span>}
            {errors[`criterion.${criterion.id}.weight`] && <span className="chq-field-error">{errors[`criterion.${criterion.id}.weight`]}</span>}
            {errors[`criterion.${criterion.id}.options`] && <span className="chq-field-error">{errors[`criterion.${criterion.id}.options`]}</span>}
            <button type="button" onClick={() => setDraft((d) => ({ ...d, criteria: removeCriterion(d.criteria, criterion.id) }))}>
              Remove
            </button>
          </div>
        ))}
        <div className="chq-criteria-add">
          <button type="button" onClick={() => setDraft((d) => ({ ...d, criteria: addCriterion(d.criteria, 'rating' as CriterionKind) }))}>
            Add rating criterion
          </button>
          <button type="button" onClick={() => setDraft((d) => ({ ...d, criteria: addCriterion(d.criteria, 'dropdown' as CriterionKind) }))}>
            Add dropdown criterion
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
                <button type="button" onClick={() => unassignReviewer(r.id)}>
                  Remove
                </button>
              </li>
            ))}
            {reviewers.length === 0 && <li>No reviewers assigned yet.</li>}
          </ul>

          <div className="chq-reviewer-assign-form">
            <input placeholder="Reviewer user id" value={reviewerUserId} onChange={(e) => setReviewerUserId(e.target.value)} />
            <select value={reviewerScope} onChange={(e) => setReviewerScope(e.target.value as 'all' | 'track' | 'submission')}>
              <option value="all">All plan submissions</option>
              <option value="track">One track</option>
              <option value="submission">One submission</option>
            </select>
            {reviewerScope === 'track' && (
              <select value={reviewerTrackId} onChange={(e) => setReviewerTrackId(e.target.value)}>
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
