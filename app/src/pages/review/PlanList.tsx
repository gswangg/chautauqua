import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import type { EvaluationPlan } from './types';

export function PlanList() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    apiList<EvaluationPlan>(`/events/${eventId}/plans`)
      .then((res) => setPlans(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load evaluation plans'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (eventLoading) {
    return (
      <div className="chq-page">
        <h1>Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page">
        <h1>Review</h1>
        <div className="chq-attention-frame">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page">
      <h1>Evaluation plans</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      <Link to="/review/plans/new" className="chq-button">
        New plan
      </Link>
      {loading && <p>Loading…</p>}
      {!loading && plans.length === 0 && <p>No evaluation plans yet.</p>}
      <ul className="chq-plan-list">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link to={`/review/plans/${plan.id}`}>{plan.name}</Link>{' '}
            <Link to={`/review/plans/${plan.id}/progress`}>Progress</Link>{' '}
            <Link to={`/review/plans/${plan.id}/results`}>Results</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
