import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { formatDateOnly } from '../../lib/dates';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { overallCompletion, progressTotals } from './progress';
import { ProgressPanel } from './ProgressPanel';
import { buildResultsCsvHref } from './resultsCsv';
import { ResultsTable } from './ResultsTable';
import { DelayedLoading, useDelayedFlag } from '../../components/DelayedLoading';
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

/** DEC-674: a plan's window is "open" iff now falls inside [openDate,
 * closeDate], treating a null bound as unbounded on that side -- the same
 * three-state read as planState()'s 'Open now' branch, factored out so the
 * landing page's default selection uses exactly this rule. */
function isWindowOpen(plan: EvaluationPlan, now: number): boolean {
  if (plan.closeDate !== null && plan.closeDate < now) return false;
  if (plan.openDate !== null && plan.openDate > now) return false;
  return true;
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
  const show = useDelayedFlag(rows === undefined);
  if (rows === undefined) {
    return show ? <span className="chq-review-plan-meta">Loading progress…</span> : null;
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-674: which plan's progress/results render below the list -- defaults
  // to the first plan whose window is open right now, else the first plan,
  // else none (empty list). A previously-selected plan that's still present
  // after a refetch keeps its selection rather than snapping back to the
  // default.
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    apiList<EvaluationPlan>(`/events/${eventId}/plans`)
      .then((res) => {
        setPlans(res.items);
        setSelected((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          const now = Date.now();
          const openPlan = res.items.find((p) => isWindowOpen(p, now));
          return (openPlan ?? res.items[0])?.id ?? null;
        });
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
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [eventId]);

  if (eventLoading) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <DelayedLoading />
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
  const selectedPlan = plans.find((p) => p.id === selected) ?? null;

  return (
    <div className="chq-page chq-review-page">
      {/* DEC-706: title row -- h1 + summary, page-level actions
         right-aligned beside it. No lone toolbar band above the list. */}
      <div className="chq-review-title-row">
        <h1 className="chq-page-title">Review</h1>
        <span className="chq-summary">
          {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
        </span>
        <div className="chq-review-title-actions">
          {selectedPlan && (
            <a
              href={buildResultsCsvHref(selectedPlan.id, selectedPlan.currentRound)}
              download
              className="chq-btn chq-btn-secondary"
            >
              Export results CSV
            </a>
          )}
          <Link to="/review/plans/new" className="chq-btn chq-btn-primary">
            New plan
          </Link>
        </div>
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      <section className="chq-section">
        <div className="chq-section-head">
          <h2 className="chq-section-label">Evaluation plans</h2>
        </div>
        {loading && <DelayedLoading />}
        {loaded && !loading && plans.length === 0 && <p className="chq-empty">No evaluation plans yet.</p>}
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            // DEC-706: a plan row is chosen by clicking the row -- no radio
            // input. A quiet active state + aria-current express selection;
            // the row's own Progress/Results/Edit links stay real anchors
            // (clicking one navigates, doesn't just re-select the row).
            <div
              key={plan.id}
              className={`chq-review-plan-row${isSelected ? ' is-active' : ''}`}
              role="button"
              tabIndex={0}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => setSelected(plan.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(plan.id);
                }
              }}
            >
              <div>
                <span className="chq-review-plan-name">{plan.name}</span>
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
                <Link to={`/review/plans/${plan.id}/progress`} onClick={(e) => e.stopPropagation()}>
                  Progress
                </Link>
                <Link to={`/review/plans/${plan.id}/results`} onClick={(e) => e.stopPropagation()}>
                  Results
                </Link>
                <Link to={`/review/plans/${plan.id}`} onClick={(e) => e.stopPropagation()}>
                  Edit
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      {selectedPlan && (
        <>
          <ProgressPanel planId={selectedPlan.id} />

          <section className="chq-section chq-review-landing-results">
            <div className="chq-section-head">
              <h2 className="chq-section-label">{selectedPlan.name} results · ranked</h2>
            </div>
            <ResultsTable planId={selectedPlan.id} />
          </section>
        </>
      )}
    </div>
  );
}
