import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, ApiError } from '../../lib/api';
import './review.css';
import type { EvaluationPlan, RecusalItem, ReviewerQueueEnvelope, ReviewerQueueItem } from './types';
import { DelayedLoading } from '../../components/DelayedLoading';

// DEC-586: a reviewer landing on /review sees their queue directly -- no
// intermediate plan-name-only picker page (that component is deleted, not
// hidden behind a route). With exactly one assigned plan the section below
// renders with no heading at all; with several, each plan gets its own
// section in the order GET /review/plans returned them. Items are never
// merged or re-sorted across (or within) plans -- a recusal is scoped to
// its own plan-and-submission pair, so it stays attached to that plan's
// section.
function PlanSection({ planId, planName, showHeading }: { planId: string; planName?: string; showHeading: boolean }) {
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
      <section className="chq-section">
        {showHeading && (
          <div className="chq-section-head">
            <h2 className="chq-section-label">{planName}</h2>
          </div>
        )}
        <DelayedLoading />
      </section>
    );
  }

  return (
    <section className="chq-section">
      {showHeading && (
        <div className="chq-section-head">
          <h2 className="chq-section-label">{planName}</h2>
        </div>
      )}
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {/*
        The API already orders this fewest-ratings-first, completed-last
        (buildReviewerQueue, DEC-018/DEC-561) so coverage closes across the
        committee and finished work sinks to the bottom instead of
        vanishing -- this list is rendered exactly as delivered and must
        never be re-sorted here.
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
            {item.alreadyRatedByMe && <span className="chq-pill chq-review-queue-complete-pill">Complete</span>}
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
    </section>
  );
}

export function ReviewerQueue() {
  const { planId: routePlanId } = useParams<{ planId: string }>();
  const [plans, setPlans] = useState<EvaluationPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // DEC-819: the deep-linked single-plan route heads itself with that
  // plan's own name (never the landing page's generic "Your queue") -- a
  // small dedicated fetch, since PlanSection itself only loads the queue.
  const [routePlan, setRoutePlan] = useState<EvaluationPlan | null>(null);
  const [routePlanLoading, setRoutePlanLoading] = useState(true);
  const [routePlanError, setRoutePlanError] = useState<string | null>(null);

  useEffect(() => {
    // A deep link to a single plan (/review/plans/:planId) shows that plan
    // alone -- it never needs the reviewer's full plan list.
    if (routePlanId) {
      setLoading(false);
      setRoutePlanLoading(true);
      apiGet<EvaluationPlan>(`/review/plans/${routePlanId}`)
        .then((plan) => setRoutePlan(plan))
        .catch((err) => setRoutePlanError(err instanceof ApiError ? err.message : 'Failed to load this plan'))
        .finally(() => setRoutePlanLoading(false));
      return;
    }
    setLoading(true);
    apiList<EvaluationPlan>('/review/plans')
      .then((res) => setPlans(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your plans'))
      .finally(() => setLoading(false));
  }, [routePlanId]);

  if (routePlanId) {
    return (
      <div className="chq-page chq-review-page">
        <p>
          <Link to="/review" className="chq-review-back">
            &larr; Your plans
          </Link>
        </p>
        {routePlanLoading ? (
          <DelayedLoading />
        ) : (
          <h1 className="chq-page-title">{routePlan ? routePlan.name : 'Your queue'}</h1>
        )}
        {routePlanError && (
          <div className="chq-error" role="alert">
            {routePlanError}
          </div>
        )}
        <PlanSection planId={routePlanId} showHeading={false} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <DelayedLoading />
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page">
      <h1 className="chq-page-title">Your queue</h1>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {plans && plans.length === 0 && !error && <p className="chq-empty">You have no assigned evaluation plans yet.</p>}
      {plans &&
        plans.map((plan) => (
          <PlanSection key={plan.id} planId={plan.id} planName={plan.name} showHeading={plans.length > 1} />
        ))}
    </div>
  );
}
