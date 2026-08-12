import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { formatDateOnly } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { overallCompletion, progressTotals } from './progress';
import './review.css';
import type { EvaluationPlan, ProgressRow } from './types';

/** Presentational-only window state derived from openDate/closeDate — never
 * stored server-side, so it must never be asserted as more than "now vs.
 * these two dates" (DEC-377: no invented figures). */
function planState(plan: EvaluationPlan, now: number): string {
  if (plan.closeDate !== null && plan.closeDate < now) return 'Closed';
  if (plan.openDate !== null && plan.openDate > now) return `Opens ${formatDateOnly(plan.openDate)}`;
  return 'Open now';
}

function planWindow(plan: EvaluationPlan): string {
  if (plan.openDate === null && plan.closeDate === null) return 'No window set';
  return `${formatDateOnly(plan.openDate)} – ${formatDateOnly(plan.closeDate)}`;
}

/** DEC-587: inline plan-row progress -- evaluations in against evaluations
 * expected, read from the SAME GET /plans/:id/progress aggregate the
 * Progress page uses (never a second definition, and never a plan count in
 * the denominator). Absent data (fetch still in flight, or nobody assigned
 * yet) reads as "No evaluations assigned yet" rather than a fabricated 0%. */
function PlanProgress({ rows }: { rows: ProgressRow[] | undefined | null }) {
  if (rows === undefined) {
    return <span className="chq-review-plan-meta">Loading progress…</span>;
  }
  if (rows === null) {
    return <span className="chq-review-plan-meta">Progress unavailable</span>;
  }
  const { completed, assigned } = progressTotals(rows);
  if (assigned === 0) {
    return <span className="chq-review-plan-meta">No evaluations assigned yet</span>;
  }
  const fraction = overallCompletion(rows);
  return (
    <div className="chq-review-plan-progress">
      <span className="chq-review-plan-meta">
        {completed} of {assigned} evaluations in
      </span>
      <div className="chq-bar">
        <div className="chq-bar-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
    </div>
  );
}

export function PlanList() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [progressByPlan, setProgressByPlan] = useState<Record<string, ProgressRow[] | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    apiList<EvaluationPlan>(`/events/${eventId}/plans`)
      .then((res) => {
        setPlans(res.items);
        // DEC-587: fetch every plan's progress aggregate in parallel so the
        // inline bar/count is populated without a request per row-click. A
        // plan whose progress fetch fails reads "Progress unavailable"
        // rather than silently lying with a fabricated 0-assigned state.
        void Promise.allSettled(
          res.items.map((plan) => apiList<ProgressRow>(`/plans/${plan.id}/progress`).then((progressRes) => progressRes.items)),
        ).then((results) => {
          const entries = res.items.map(
            (plan, i) => [plan.id, results[i]!.status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<ProgressRow[]>).value : null] as const,
          );
          setProgressByPlan(Object.fromEntries(entries));
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load evaluation plans'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (eventLoading) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <div className="chq-error">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="chq-page chq-review-page">
      <div className="chq-review-summary-row">
        <h1 className="chq-page-title">Review</h1>
        <span className="chq-summary">
          {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
        </span>
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      <div className="chq-toolbar">
        <Link to="/review/plans/new" className="chq-btn chq-btn-primary">
          New plan
        </Link>
      </div>

      <section className="chq-section">
        <div className="chq-section-head">
          <h2 className="chq-section-label">Evaluation plans</h2>
        </div>
        {loading && <p>Loading…</p>}
        {!loading && plans.length === 0 && <p className="chq-empty">No evaluation plans yet.</p>}
        {plans.map((plan) => (
          <div key={plan.id} className="chq-review-plan-row">
            <div>
              <Link to={`/review/plans/${plan.id}`} className="chq-review-plan-name">
                {plan.name}
              </Link>
            </div>
            <span className="chq-flag">{planState(plan, now)}</span>
            <span className="chq-review-plan-meta">
              {planWindow(plan)}
              {plan.rounds > 1 && (
                <>
                  {' '}
                  · Round {plan.currentRound} of {plan.rounds}
                </>
              )}
            </span>
            <PlanProgress rows={progressByPlan[plan.id]} />
            <div className="chq-review-plan-actions">
              <Link to={`/review/plans/${plan.id}/progress`}>Progress</Link>
              <Link to={`/review/plans/${plan.id}/results`}>Results</Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
