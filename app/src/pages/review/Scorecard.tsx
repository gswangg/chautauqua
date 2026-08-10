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
        setScores(subRes?.myEvaluation?.scores ?? {});
        setComment(subRes?.myEvaluation?.comment ?? '');
        const firstRating = planRes?.criteria.find((c) => c.kind === 'rating');
        setFocusedId(firstRating?.id ?? planRes?.criteria[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submission'))
      .finally(() => setLoading(false));
  }, [planId, submissionId]);

  async function submitAndAdvance() {
    if (!planId || !submissionId || !plan) return;
    if (!isEvaluationComplete(plan.criteria, scores)) {
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
    const focused = plan.criteria.find((c) => c.id === focusedId) ?? null;
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

      {plan.criteria.map((criterion: EvaluationCriterion) => (
        <div
          key={criterion.id}
          className={`chq-scorecard-criterion${focusedId === criterion.id ? ' chq-focused' : ''}`}
          onFocus={() => setFocusedId(criterion.id)}
        >
          <label>{criterion.label}</label>
          {criterion.kind === 'rating' ? (
            <input
              type="number"
              min={plan.scale.min}
              max={plan.scale.max}
              value={typeof scores[criterion.id] === 'number' ? (scores[criterion.id] as number) : ''}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: Number(e.target.value) }))}
            />
          ) : (
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
