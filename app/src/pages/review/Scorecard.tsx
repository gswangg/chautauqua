import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPost, apiPut, ApiError } from '../../lib/api';
import './review.css';
import { formatAnswerValue } from './answerText';
import { isEvaluationComplete, scorecardKeyAction } from './scorecardLogic';
import { DelayedLoading } from '../../components/DelayedLoading';
import type {
  EvaluationCriterion,
  EvaluationPlan,
  EvaluationScores,
  RecusalRecord,
  ReviewerQueueItem,
  ReviewerSubmissionDetail,
} from './types';

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

  // DEC-271: this reviewer's declared conflict of interest on this
  // submission, if any. Scoring is disabled once recused.
  const [recusal, setRecusal] = useState<RecusalRecord | null>(null);
  const [recusalReason, setRecusalReason] = useState('');
  const [recusing, setRecusing] = useState(false);
  const [undoingRecusal, setUndoingRecusal] = useState(false);

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

  // DEC-271: POST/DELETE /api/v1/review/plans/:planId/recusals/:submissionId
  // -- reason is optional free text, sent as null when blank.
  async function handleRecuse() {
    if (!planId || !submissionId) return;
    setRecusing(true);
    setError(null);
    try {
      const res = await apiPost<{ recusal: RecusalRecord }>(`/review/plans/${planId}/recusals/${submissionId}`, {
        reason: recusalReason.trim() === '' ? null : recusalReason.trim(),
      });
      setRecusal(res.recusal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record recusal');
    } finally {
      setRecusing(false);
    }
  }

  async function handleUndoRecusal() {
    if (!planId || !submissionId) return;
    setUndoingRecusal(true);
    setError(null);
    try {
      await apiDelete(`/review/plans/${planId}/recusals/${submissionId}`);
      setRecusal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to undo recusal');
    } finally {
      setUndoingRecusal(false);
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
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Scorecard</h1>
        <DelayedLoading />
      </div>
    );
  }

  if (!plan || !submission) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Scorecard</h1>
        <div className="chq-error" role="alert">
          {error ?? 'This submission is not part of your assignment.'}
        </div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page" onKeyDown={handleKeyDown} tabIndex={-1}>
      <p>
        <Link to={`/review/plans/${planId}`} className="chq-review-back">
          &larr; Back to your queue
        </Link>
      </p>

      <div className="chq-review-scorecard-head">
        <h1 className="chq-page-title" style={{ fontSize: '27px' }}>
          {submission.ref} — {submission.title}
        </h1>
        {submission.speakers && (
          <span className="chq-summary">Speakers: {submission.speakers.map((s) => s.name).join(', ')}</span>
        )}
        {submission.description && <p className="chq-review-scorecard-abstract">{submission.description}</p>}
      </div>

      {submission.sessionAnswers.length > 0 && (
        <section className="chq-review-answers">
          <h2 className="chq-section-label">Submission answers</h2>
          <dl className="chq-review-answer-list">
            {submission.sessionAnswers.map((a) => (
              <div key={a.fieldId} className="chq-review-answer-row">
                <dt>{a.label}</dt>
                <dd>{formatAnswerValue(a.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {submission.speakerAnswers && submission.speakerAnswers.length > 0 && (
        <section className="chq-review-answers">
          <h2 className="chq-section-label">Speaker answers</h2>
          <dl className="chq-review-answer-list">
            {submission.speakerAnswers.map((a) => (
              <div key={a.fieldId} className="chq-review-answer-row">
                <dt>{a.label}</dt>
                <dd>{formatAnswerValue(a.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {submission.myEvaluation && (
        <p className="chq-review-already-rated">You already rated this submission. Submitting again updates your rating.</p>
      )}

      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      <div className="chq-review-recusal">
        {recusal ? (
          <>
            <p>You recused yourself from this submission.</p>
            <button type="button" className="chq-btn chq-btn-secondary" disabled={undoingRecusal} onClick={() => void handleUndoRecusal()}>
              Undo
            </button>
          </>
        ) : (
          <>
            <label className="chq-review-checkbox-label">
              I have a conflict of interest with this submission
              <input
                type="text"
                className="chq-input"
                placeholder="Reason (optional)"
                value={recusalReason}
                onChange={(e) => setRecusalReason(e.target.value)}
              />
            </label>
            <button type="button" className="chq-btn chq-btn-secondary" disabled={recusing} onClick={() => void handleRecuse()}>
              Declare conflict of interest
            </button>
          </>
        )}
      </div>

      <p className="chq-review-hint">Tip: number keys 1-9 set the focused rating; Enter submits and advances.</p>

      {criteria.map((criterion: EvaluationCriterion) => (
        <div
          key={criterion.id}
          className={`chq-review-criterion${focusedId === criterion.id ? ' chq-focused' : ''}`}
          onFocus={() => setFocusedId(criterion.id)}
        >
          <label className="chq-review-criterion-label">
            {criterion.label}
            {criterion.kind === 'text' && criterion.required && ' *'}
          </label>
          {/* DEC-676: guidance renders under the label; nothing when absent. */}
          {criterion.guidance && <p className="chq-review-criterion-guidance">{criterion.guidance}</p>}
          {criterion.kind === 'rating' ? (
            <input
              type="number"
              className="chq-input"
              min={plan.scale.min}
              max={plan.scale.max}
              disabled={!!recusal}
              value={typeof scores[criterion.id] === 'number' ? (scores[criterion.id] as number) : ''}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: Number(e.target.value) }))}
            />
          ) : criterion.kind === 'dropdown' ? (
            <select
              className="chq-select"
              value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
              disabled={!!recusal}
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
              className="chq-textarea"
              aria-label={criterion.label || 'criterion'}
              value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
              disabled={!!recusal}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: e.target.value }))}
            />
          )}
        </div>
      ))}

      <label className="chq-review-field">
        Comment
        <textarea className="chq-textarea" value={comment} disabled={!!recusal} onChange={(e) => setComment(e.target.value)} />
      </label>

      <div className="chq-review-editor-actions">
        <button type="button" className="chq-btn chq-btn-primary" disabled={submitting || !!recusal} onClick={() => void submitAndAdvance()}>
          {submission.myEvaluation ? 'Update rating' : 'Submit and advance'}
        </button>
      </div>
    </div>
  );
}
