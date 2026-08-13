import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, ApiError } from '../../lib/api';
import './review.css';
import type { EvaluationPlan, RecusalItem, ReviewerQueueEnvelope, ReviewerQueueItem } from './types';
import { DelayedLoading } from '../../components/DelayedLoading';
import { countOf } from '../../lib/plural';
// DEC-522/DEC-831: "closes in N days" is computed the same way the CFP
// summary's Closes row is (CallForPapersPanel.tsx) -- the owning event's own
// timezone via dayLabelEndInstant, never the viewer's ambient machine zone.
// The plan-scoped route still fetches the plan itself (below) purely for its
// timezone -- DEC-845's envelope carries planName/scopeTrackName/closeDate,
// but a day-label close date is meaningless without the owning event's tz to
// expand it through.
import { dayLabelEndInstant } from '../../../../src/lib/timezone';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// DEC-831: 'closes in N days' -- null when the plan has no close date (a
// window unbounded on that side has nothing to count down to).
function closesInDaysLabel(closeDate: number | null, timezone: string): string | null {
  if (closeDate === null) return null;
  const daysLeft = Math.max(Math.ceil((dayLabelEndInstant(closeDate, timezone) - Date.now()) / MS_PER_DAY), 0);
  return `closes in ${countOf(daysLeft, 'day')}`;
}

// DEC-586/DEC-874: a reviewer landing on /review sees their queue directly
// -- no intermediate plan-name-only picker page. With exactly one assigned
// plan, ReviewerQueue navigates straight into this scoped section (no
// heading needed -- the route's own header already names the plan); with
// several, /review renders a plan LIST instead (see PlanListRow below) and
// this section only ever mounts once the reviewer has picked a plan.
function PlanSection({
  planId,
  onData,
}: {
  planId: string;
  // DEC-831/DEC-845: lets a single-plan-route parent read the loaded queue
  // envelope for its own header (N left to score, progress bar, plan name,
  // scope track, close date) without a second fetch.
  onData?: (envelope: ReviewerQueueEnvelope) => void;
}) {
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
        onData?.(res);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your queue'))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <DelayedLoading />
      </section>
    );
  }

  return (
    <section className="chq-section">
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
      {open && items.length === 0 && recused.length === 0 && !error && (
        <p className="chq-empty">Nothing left in your queue. Nicely done.</p>
      )}
      {/* DEC-874: recused submissions render INLINE in this same ordered
          list -- marked and carrying the reason plus the existing Undo --
          rather than in a separate trailing section that hides why the
          actionable queue above looks short. Items keep the API's own
          order (see the comment above); recused rows are appended after
          them since the queue endpoint reports them as a distinct set with
          no interleaved position of its own. */}
      <ol className="chq-review-queue-list">
        {items.map((item) => (
          <li key={item.submissionId} className="chq-review-queue-row">
            <div className="chq-review-queue-row-top">
              <span className="chq-review-queue-ref">{item.ref}</span>
              {/* DEC-831/DEC-845: the queue's own score column -- SCORED
                  <blended score> once this reviewer has rated it, NOT
                  SCORED otherwise. DEC-730 micro-label family: weight/
                  wording carry the state, never colour. */}
              <span
                className={`chq-review-queue-score ${
                  item.alreadyRatedByMe ? 'chq-review-queue-score-scored' : 'chq-review-queue-score-unscored'
                }`}
              >
                {item.alreadyRatedByMe
                  ? `SCORED ${typeof item.myScore === 'number' ? item.myScore.toFixed(1) : '—'}`
                  : 'NOT SCORED'}
              </span>
            </div>
            <Link to={`/review/plans/${planId}/submissions/${item.submissionId}`} className="chq-review-queue-title">
              {item.title}
            </Link>
            {/* DEC-857/DEC-874: the meta line is a session-shape fact, never
                stripped for an anonymized plan -- format and (when the item
                carries one) audience level, joined on one line; nothing
                renders when the submission has neither. */}
            {(item.format != null || item.audienceLevel != null) && (
              <p className="chq-review-plan-meta">
                {[item.format, item.audienceLevel].filter((v): v is string => v != null).join(' · ')}
              </p>
            )}
            {/* DEC-857/DEC-874: the action names what it actually offers --
                a scored row already took the action, so it reads "Change
                your score" rather than repeating "Score this" -- rendered
                as a full-width button, not an inline link. */}
            <Link
              to={`/review/plans/${planId}/submissions/${item.submissionId}`}
              className="chq-review-queue-score-action chq-btn chq-btn-primary chq-review-queue-row-action"
            >
              {item.alreadyRatedByMe ? 'Change your score' : 'Score this'}
            </Link>
          </li>
        ))}
        {recused.map((item) => (
          <li key={item.submissionId} className="chq-review-queue-row chq-review-queue-row-recused">
            <div className="chq-review-queue-row-top">
              <span className="chq-review-queue-ref">{item.ref}</span>
              <span className="chq-review-queue-score chq-review-queue-score-recused">Recused</span>
            </div>
            <span className="chq-review-queue-title">{item.title}</span>
            {item.reason && <p className="chq-review-plan-meta">{item.reason}</p>}
            <button
              type="button"
              className="chq-btn chq-btn-secondary chq-review-queue-row-action"
              disabled={undoingId === item.submissionId}
              onClick={() => void undoRecusal(item.submissionId)}
            >
              Undo
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

// DEC-874: a row in the 2+ plan landing list. Name and scope come off the
// same queue envelope the scoped route itself reads (scopeTrackName), so
// this row can never disagree with the page it links into; "N left to
// score" is rendered only once that fetch resolves ("when known" -- the
// row never blocks on it, and a failed background fetch just leaves the
// count/scope absent rather than failing the whole list).
function ReviewerPlanRow({ plan }: { plan: EvaluationPlan }) {
  const [envelope, setEnvelope] = useState<ReviewerQueueEnvelope | null>(null);

  useEffect(() => {
    let cancelled = false;
    (apiList(`/review/plans/${plan.id}/queue`) as Promise<ReviewerQueueEnvelope>)
      .then((res) => {
        if (!cancelled) setEnvelope(res);
      })
      .catch(() => {
        // Scope/count are decoration on this row -- the row itself still
        // links into the scoped queue, which does its own error handling.
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  const scope = envelope ? envelope.scopeTrackName ?? 'All tracks' : null;
  const left = envelope ? envelope.items.filter((i) => !i.alreadyRatedByMe).length : null;

  const meta = [scope, left !== null ? `${left} left to score` : null].filter((v): v is string => v !== null);

  return (
    <li className="chq-reviewer-plan-row">
      <Link to={`/review/plans/${plan.id}`} className="chq-reviewer-plan-row-link">
        <span className="chq-reviewer-plan-row-name">{plan.name}</span>
        {meta.length > 0 && <span className="chq-review-plan-meta">{meta.join(' · ')}</span>}
      </Link>
    </li>
  );
}

export function ReviewerQueue() {
  const { planId: routePlanId } = useParams<{ planId: string }>();
  const [plans, setPlans] = useState<EvaluationPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // DEC-522: a day-label closeDate needs the owning event's own timezone to
  // expand through (dayLabelEndInstant) -- the queue envelope (DEC-845)
  // doesn't carry timezone, so this small dedicated fetch supplies just
  // that; every other header fact (name/scope track/close date/counts)
  // comes off the single queue fetch below.
  const [routeTimezone, setRouteTimezone] = useState<string | null>(null);
  // DEC-831/DEC-845: the plan-scoped route's own header (eyebrow/h1/
  // subtitle/progress bar) reads this reviewer's own queue envelope, fed up
  // from the single PlanSection instance below rather than a second fetch.
  const [routeEnvelope, setRouteEnvelope] = useState<ReviewerQueueEnvelope | null>(null);
  const [routePlanError, setRoutePlanError] = useState<string | null>(null);

  useEffect(() => {
    // A deep link to a single plan (/review/plans/:planId) shows that plan
    // alone -- it never needs the reviewer's full plan list.
    if (routePlanId) {
      setLoading(false);
      setRouteEnvelope(null);
      apiGet<EvaluationPlan>(`/review/plans/${routePlanId}`)
        .then((plan) => setRouteTimezone(plan.timezone))
        .catch((err) => setRoutePlanError(err instanceof ApiError ? err.message : 'Failed to load this plan'));
      return;
    }
    setLoading(true);
    apiList<EvaluationPlan>('/review/plans')
      .then((res) => setPlans(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your plans'))
      .finally(() => setLoading(false));
  }, [routePlanId]);

  if (routePlanId) {
    const routeQueueItems = routeEnvelope?.items ?? null;
    const scoreLeft = routeQueueItems ? routeQueueItems.filter((i) => !i.alreadyRatedByMe).length : null;
    const scoredCount = routeQueueItems ? routeQueueItems.filter((i) => i.alreadyRatedByMe).length : 0;
    const totalCount = routeQueueItems ? routeQueueItems.length : 0;
    const scope = routeEnvelope ? routeEnvelope.scopeTrackName ?? 'All tracks' : null;
    const closesLabel =
      routeEnvelope && routeTimezone ? closesInDaysLabel(routeEnvelope.closeDate, routeTimezone) : null;
    const subtitle = scope ? [scope, closesLabel].filter((v): v is string => v !== null).join(' · ') : null;

    return (
      <div className="chq-page chq-review-page chq-measure">
        <p>
          <Link to="/review" className="chq-review-back">
            &larr; Your plans
          </Link>
        </p>
        {!routeEnvelope ? (
          <DelayedLoading />
        ) : (
          <div className="chq-review-scoped-head">
            <span className="chq-section-label">{`REVIEW · ${routeEnvelope.planName}`}</span>
            {/* DEC-678: while the queue is still in flight the count is not
                known, and a bare literal in the title is exactly the
                hand-rolled indicator the app-wide policy bans -- render the
                sanctioned delayed block instead. DEC-831/DEC-845's "counts
                what is LEFT" title appears the moment the count exists; the
                zero case reads as done rather than "0 left to score". */}
            {scoreLeft === null ? (
              <DelayedLoading />
            ) : scoreLeft === 0 ? (
              <h1 className="chq-page-title">Nothing left in your queue. Nicely done.</h1>
            ) : (
              <h1 className="chq-page-title">{`${scoreLeft} left to score`}</h1>
            )}
            {subtitle && <p className="chq-review-plan-meta">{subtitle}</p>}
            {routeQueueItems && totalCount > 0 && (
              <>
                <div className="chq-bar chq-review-scoped-progress">
                  <div className="chq-bar-fill" style={{ width: `${Math.round((scoredCount / totalCount) * 100)}%` }} />
                </div>
                {/* DEC-939: the frame's "N of M done" caption, from the same
                    two counts the bar already computes -- never a third
                    reader. */}
                <p className="chq-review-scoped-progress-caption">{`${scoredCount} of ${totalCount} done`}</p>
              </>
            )}
          </div>
        )}
        {routePlanError && (
          <div className="chq-error" role="alert">
            {routePlanError}
          </div>
        )}
        <PlanSection planId={routePlanId} onData={setRouteEnvelope} />
        {/* DEC-874: the footer belongs beside the shell's existing sign-out
            control (App.tsx Header) -- it renders once, globally, in the
            shell chrome, so nothing here mints a second one. */}
        <p className="chq-review-queue-footer">Scores stay hidden from other reviewers</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Review</h1>
        <DelayedLoading />
      </div>
    );
  }

  // DEC-874: exactly one assigned plan lands the reviewer straight in its
  // scoped queue -- `replace` so Back doesn't bounce to an unscoped hub
  // that no longer exists.
  if (plans && plans.length === 1) {
    // Relative (no leading slash): resolves against wherever this Routes
    // subtree is itself mounted (App.tsx mounts it at /review/*), so it
    // works both nested in the real app and when this page is exercised
    // standalone in tests.
    return <Navigate to={`plans/${plans[0]!.id}`} replace />;
  }

  // DEC-874: two or more plans render a PLAN LIST -- never several stacked
  // queues on one page, because a page that is several pages at once has
  // no header that is true.
  if (plans && plans.length > 1) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Your plans</h1>
        {error && (
          <div className="chq-error" role="alert">
            {error}
          </div>
        )}
        <ul className="chq-reviewer-plan-list">
          {plans.map((plan) => (
            <ReviewerPlanRow key={plan.id} plan={plan} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page chq-measure">
      <h1 className="chq-page-title">Your queue</h1>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {plans && plans.length === 0 && !error && <p className="chq-empty">You have no assigned evaluation plans yet.</p>}
    </div>
  );
}
