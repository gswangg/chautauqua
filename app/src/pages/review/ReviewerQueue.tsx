import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiDelete, apiList, ApiError } from '../../lib/api';
import './review.css';
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
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page">
      <h1 className="chq-page-title">Your evaluation plans</h1>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {plans.length === 0 && !error && <p className="chq-empty">You have no assigned evaluation plans yet.</p>}
      <section className="chq-section">
        {plans.map((plan) => (
          <div key={plan.id} className="chq-row">
            <Link to={`/review/plans/${plan.id}`} className="chq-row-title">
              {plan.name}
            </Link>
          </div>
        ))}
      </section>
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
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page">
      <p>
        <Link to="/review" className="chq-review-back">
          &larr; Your plans
        </Link>
      </p>
      <h1 className="chq-page-title">Your queue</h1>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {/*
        The API already orders this fewest-ratings-first (buildReviewerQueue,
        DEC-018) so coverage closes across the committee -- this list is
        rendered exactly as delivered and must never be re-sorted here.
      */}
      {!open && !error && <p className="chq-empty">This review plan is not currently open.</p>}
      {open && items.length === 0 && !error && <p className="chq-empty">Nothing left in your queue. Nicely done.</p>}
      <ol className="chq-review-queue-list">
        {items.map((item) => (
          <li key={item.submissionId} className="chq-review-queue-row">
            <span className="chq-review-queue-ref">{item.ref}</span>
            <Link to={`/review/plans/${planId}/submissions/${item.submissionId}`} className="chq-review-queue-title">
              {item.ref} — {item.title}
            </Link>
            <span className="chq-review-plan-meta">
              {item.ratingsCount} rating{item.ratingsCount === 1 ? '' : 's'} so far
            </span>
          </li>
        ))}
      </ol>

      {recused.length > 0 && (
        <section className="chq-section">
          <div className="chq-section-head">
            <h2 className="chq-section-label">Recused (not in your queue)</h2>
          </div>
          <ul className="chq-review-recused-list">
            {recused.map((item) => (
              <li key={item.submissionId} className="chq-review-recused-row">
                <span>
                  {item.ref} — {item.title}
                  {item.reason && <span className="chq-review-plan-meta"> ({item.reason})</span>}
                </span>
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  disabled={undoingId === item.submissionId}
                  onClick={() => void undoRecusal(item.submissionId)}
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ReviewerQueue() {
  const { planId } = useParams<{ planId: string }>();
  if (!planId) return <PlanPicker />;
  return <Queue planId={planId} />;
}
