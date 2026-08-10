import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPut, ApiError } from '../../lib/api';
import { isEvaluationComplete, scorecardKeyAction } from './scorecardLogic';
import type { EvaluationCriterion, EvaluationPlan, EvaluationScores, ReviewerQueueItem, ReviewerSubmissionDetail } from './types';

export function Scorecard() {
  const { planId, submissionId } = useParams<{ planId: string; submissionId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [submission, setSubmission] = useState<ReviewerSubmissionDetail | null>(null);
  const [scores, setScores] = useState<EvaluationScores>({});
  const [comment, setComment] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId || !submissionId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiList<EvaluationPlan>('/review/plans').then((res) => res.items.find((p) => p.id === planId) ?? null),
      apiGet<ReviewerSubmissionDetail>(`/review/submissions/${submissionId}?planId=${planId}`),
    ])
      .then(([planRes, subRes]) => {
        setPlan(planRes);
        setSubmission(subRes);
        // DEC-147: the server already resolved criteria for the plan's
        // active round on the submission detail; fall back to plan.criteria
        // only if that's somehow missing (e.g. an older cached response).
        const criteria = subRes?.criteria ?? planRes?.criteria ?? [];
        // DEC-148: optional text criteria default to '' so the validator's
        // "every criterion has an entry" rule is satisfied without the
        // reviewer having to click into every free-text field.
        const initialScores = { ...(subRes?.myEvaluation?.scores ?? {}) };
        for (const c of criteria) {
          if (c.kind === 'text' && initialScores[c.id] === undefined) initialScores[c.id] = '';
        }
        setScores(initialScores);
        setComment(subRes?.myEvaluation?.comment ?? '');
        const firstRating = criteria.find((c) => c.kind === 'rating');
        setFocusedId(firstRating?.id ?? criteria[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submission'))
      .finally(() => setLoading(false));
  }, [planId, submissionId]);

  // DEC-147: the submission detail's resolved criteria (this round) take
  // priority over the base plan.criteria.
  const criteria = submission?.criteria ?? plan?.criteria ?? [];

  async function submitAndAdvance() {
    if (!planId || !submissionId || !plan) return;
    if (!isEvaluationComplete(criteria, scores)) {
      setError('Rate every criterion before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPut(`/review/plans/${planId}/evaluations/${submissionId}`, { scores, comment });
      const queue = await apiList<ReviewerQueueItem>(`/review/plans/${planId}/queue`);
      const next = queue.items[0];
      if (next) {
        navigate(`/review/plans/${planId}/submissions/${next.submissionId}`);
      } else {
        navigate(`/review/plans/${planId}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!plan) return;
    const focused = criteria.find((c) => c.id === focusedId) ?? null;
    const action = scorecardKeyAction(e.key, focused, plan.scale);
    if (action.type === 'setRating') {
      e.preventDefault();
      setScores((s) => ({ ...s, [action.criterionId]: action.value }));
    } else if (action.type === 'submitAndAdvance') {
      e.preventDefault();
      void submitAndAdvance();
    }
  }

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Scorecard</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (!plan || !submission) {
    return (
      <div className="chq-page">
        <h1>Scorecard</h1>
        <div className="chq-attention-frame">{error ?? 'This submission is not part of your assignment.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-scorecard" onKeyDown={handleKeyDown} tabIndex={-1}>
      <p>
        <Link to={`/review/plans/${planId}`}>&larr; Back to your queue</Link>
      </p>
      <h1>
        {submission.ref} — {submission.title}
      </h1>
      {submission.speakers && (
        <p className="chq-scorecard-speakers">Speakers: {submission.speakers.map((s) => s.name).join(', ')}</p>
      )}
      {submission.description && <p className="chq-scorecard-description">{submission.description}</p>}
      {error && <div className="chq-error-banner">{error}</div>}

      <p className="chq-scorecard-hint">Tip: number keys 1-9 set the focused rating; Enter submits and advances.</p>

      {criteria.map((criterion: EvaluationCriterion) => (
        <div
          key={criterion.id}
          className={`chq-scorecard-criterion${focusedId === criterion.id ? ' chq-focused' : ''}`}
          onFocus={() => setFocusedId(criterion.id)}
        >
          <label>
            {criterion.label}
            {criterion.kind === 'text' && criterion.required && ' *'}
          </label>
          {criterion.kind === 'rating' ? (
            <input
              type="number"
              min={plan.scale.min}
              max={plan.scale.max}
              value={typeof scores[criterion.id] === 'number' ? (scores[criterion.id] as number) : ''}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: Number(e.target.value) }))}
            />
          ) : criterion.kind === 'dropdown' ? (
            <select
              value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: e.target.value }))}
            >
              <option value="">Select…</option>
              {(criterion.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              aria-label={criterion.label || 'criterion'}
              value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: e.target.value }))}
            />
          )}
        </div>
      ))}

      <label className="chq-scorecard-comment">
        Comment
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>

      <button type="button" disabled={submitting} onClick={() => void submitAndAdvance()}>
        Submit and advance
      </button>
    </div>
  );
}
