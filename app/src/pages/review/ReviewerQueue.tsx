import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiDelete, apiList, ApiError } from '../../lib/api';
import type { EvaluationPlan, RecusalItem, ReviewerQueueEnvelope, ReviewerQueueItem } from './types';

function PlanPicker() {
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiList<EvaluationPlan>('/review/plans')
      .then((res) => setPlans(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your plans'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-reviewer-plan-picker">
      <h1>Your evaluation plans</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      {plans.length === 0 && !error && <p>You have no assigned evaluation plans yet.</p>}
      <ul>
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link to={`/review/plans/${plan.id}`}>{plan.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Queue({ planId }: { planId: string }) {
  const [items, setItems] = useState<ReviewerQueueItem[]>([]);
  const [recused, setRecused] = useState<RecusalItem[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    (apiList(`/review/plans/${planId}/queue`) as Promise<ReviewerQueueEnvelope>)
      .then((res) => {
        setItems(res.items);
        setOpen(res.open);
        setRecused(res.recused);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your queue'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [planId]);

  // DEC-271: undo a declared conflict of interest -- DELETEs the recusal so
  // the submission returns to this reviewer's queue.
  async function undoRecusal(submissionId: string) {
    setUndoingId(submissionId);
    setError(null);
    try {
      await apiDelete(`/review/plans/${planId}/recusals/${submissionId}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to undo recusal');
    } finally {
      setUndoingId(null);
    }
  }

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Your queue</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-reviewer-queue">
      <p>
        <Link to="/review">&larr; Your plans</Link>
      </p>
      <h1>Your queue</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      {/*
        The API already orders this fewest-ratings-first (buildReviewerQueue,
        DEC-018) so coverage closes across the committee -- this list is
        rendered exactly as delivered and must never be re-sorted here.
      */}
      {!open && !error && <p>This review plan is not currently open.</p>}
      {open && items.length === 0 && !error && <p>Nothing left in your queue. Nicely done.</p>}
      <ol className="chq-queue-list">
        {items.map((item) => (
          <li key={item.submissionId}>
            <Link to={`/review/plans/${planId}/submissions/${item.submissionId}`}>
              {item.ref} — {item.title}
            </Link>{' '}
            <span className="chq-queue-ratings-count">({item.ratingsCount} rating(s) so far)</span>
          </li>
        ))}
      </ol>

      {recused.length > 0 && (
        <div className="chq-recused-section">
          <h2>Recused (not in your queue)</h2>
          <ul className="chq-recused-list">
            {recused.map((item) => (
              <li key={item.submissionId}>
                {item.ref} — {item.title}
                {item.reason && <span className="chq-recusal-reason"> ({item.reason})</span>}{' '}
                <button type="button" disabled={undoingId === item.submissionId} onClick={() => void undoRecusal(item.submissionId)}>
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ReviewerQueue() {
  const { planId } = useParams<{ planId: string }>();
  if (!planId) return <PlanPicker />;
  return <Queue planId={planId} />;
}
