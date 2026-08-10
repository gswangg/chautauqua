import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiList, ApiError, type ListEnvelope } from '../../lib/api';
import type { EvaluationPlan, ReviewerQueueItem } from './types';

// The queue endpoint extends the list envelope with `open` (DEC-141):
// false when the plan's openDate/closeDate window excludes now — see
// src/routes/review.ts's queue handler.
type ReviewerQueueEnvelope = ListEnvelope<ReviewerQueueItem> & { open: boolean };

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
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    (apiList(`/review/plans/${planId}/queue`) as Promise<ReviewerQueueEnvelope>)
      .then((res) => {
        setItems(res.items);
        setOpen(res.open);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your queue'))
      .finally(() => setLoading(false));
  }, [planId]);

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
    </div>
  );
}

export function ReviewerQueue() {
  const { planId } = useParams<{ planId: string }>();
  if (!planId) return <PlanPicker />;
  return <Queue planId={planId} />;
}
