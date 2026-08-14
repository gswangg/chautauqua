import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, ApiError } from '../../lib/api';
import './review.css';
import type { EvaluationPlan, RecusalItem, ReviewerQueueEnvelope, ReviewerQueueItem } from './types';
import { DelayedLoading } from '../../components/DelayedLoading';
import { PageSkeleton } from '../../components/PageSkeleton';
import { countOf } from '../../lib/plural';
// DEC-522/DEC-831: "closes in N days" is computed via the ONE days-until
// reader (dates.ts daysUntil), through the owning event's own timezone --
// never the viewer's ambient machine zone. The plan-scoped route still
// fetches the plan itself (below) purely for its timezone -- DEC-845's
// envelope carries planName/scopeTrackName/closeDate, but a day-label close
// date is meaningless without the owning event's tz to expand it through.
import { daysUntil, daysAgo } from '../../lib/dates';
// w42-h/DEC-366 amendment: a countdown is a formatter, not a per-call
// expression -- daysUntil's own zero-clamp is right for "how many days
// remain", but a CLOSED plan needs the same zone-aware boundary read the
// other direction. dayLabelEndInstant is the shared primitive daysUntil
// itself is built on (src/lib/timezone, pure-core).
import { dayLabelEndInstant } from '../../../../src/lib/timezone';
// DEC-908 (wave-9 amendment): the ONE session-shape display vocabulary --
// format's trailing-parenthetical reshaping and audienceLevel's lowercase
// reshaping both live in this single pure-core module, imported by every
// reader instead of each defining (or re-defining) its own grammar.
import { sessionFormatLabel, audienceLevelLabel } from '../../../../src/lib/session-vocabulary';

// DEC-831/w42-h: 'closes in N days' while the window is still open; a plan
// whose close date has already passed reads in the past tense ('closed N
// days ago') instead of daysUntil's zero-clamped 'closes in 0 days' --
// null when the plan has no close date (a window unbounded on that side has
// nothing to count down to or from).
function closesInDaysLabel(closeDate: number | null, timezone: string): string | null {
  if (closeDate === null) return null;
  const now = Date.now();
  const endInstant = dayLabelEndInstant(closeDate, timezone);
  if (now > endInstant) {
    const closedDaysAgo = daysAgo(endInstant, now);
    return `closed ${countOf(closedDaysAgo, 'day')} ago`;
  }
  const daysLeft = daysUntil(closeDate, timezone, now);
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
  // REVIEW PACK 03-03: the rendered list caps at 5 rows by default; both the
  // "Showing 5 of N" caption and the "Show all N" control read N off the
  // SAME items/recused arrays the list itself renders -- never a second
  // count.
  const [showAll, setShowAll] = useState(false);

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
      {(() => {
        const totalRows = items.length + recused.length;
        const visibleItems = showAll ? items : items.slice(0, 5);
        const remainingAfterItems = showAll ? recused.length : Math.max(0, 5 - items.length);
        const visibleRecused = showAll ? recused : recused.slice(0, remainingAfterItems);
        return (
          <>
            <ol className="chq-review-queue-list">
              {visibleItems.map((item) => (
          <li key={item.submissionId} className="chq-review-queue-row">
            {/* REVIEW PACK frame 03-03 (DEC-874 wave-65 amendment): column 1
                stacks the eyebrow/title/meta; column 2 holds the action
                alone -- the row is a two-column grid, not a stacked column
                with a full-width button underneath. */}
            <div className="chq-review-queue-row-main">
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
                  {[
                    item.format != null ? sessionFormatLabel(item.format) : null,
                    item.audienceLevel != null ? audienceLevelLabel(item.audienceLevel) : null,
                  ]
                    .filter((v): v is string => v != null)
                    .join(' · ')}
                </p>
              )}
            </div>
            {/* DEC-857/DEC-874/REVIEW PACK 03-03: the action names what it
                actually offers -- a scored row already took the action, so
                it takes the secondary face and reads "Change your score"
                rather than repeating the primary "Score this". Never a
                full-width button anymore; column 2 clamps its width. Two
                literal branches (not a dynamic class expression) so
                review-primary-contrast.test.ts's static co-occurrence scan
                sees both faces named alongside this action class. */}
            {item.alreadyRatedByMe ? (
              <Link
                to={`/review/plans/${planId}/submissions/${item.submissionId}`}
                className="chq-review-queue-score-action chq-btn chq-btn-secondary chq-review-queue-row-action"
              >
                Change your score
              </Link>
            ) : (
              <Link
                to={`/review/plans/${planId}/submissions/${item.submissionId}`}
                className="chq-review-queue-score-action chq-btn chq-btn-primary chq-review-queue-row-action"
              >
                Score this
              </Link>
            )}
          </li>
              ))}
              {visibleRecused.map((item) => (
          <li key={item.submissionId} className="chq-review-queue-row chq-review-queue-row-recused">
            <div className="chq-review-queue-row-main">
              <div className="chq-review-queue-row-top">
                <span className="chq-review-queue-ref">{item.ref}</span>
                <span className="chq-review-queue-score chq-review-queue-score-recused">RECUSED</span>
              </div>
              <span className="chq-review-queue-title">{item.title}</span>
              {/* DEC-874 wave-72 amendment/DEC-986: a recused row keeps the
                  same meta line an actionable row shows -- the server
                  carries both format and audienceLevel on recused items
                  too; this is the SAME branch shape as the actionable row
                  above, not a second component. */}
              {(item.format != null || item.audienceLevel != null) && (
                <p className="chq-review-plan-meta">
                  {[
                    item.format != null ? sessionFormatLabel(item.format) : null,
                    item.audienceLevel != null ? audienceLevelLabel(item.audienceLevel) : null,
                  ]
                    .filter((v): v is string => v != null)
                    .join(' · ')}
                </p>
              )}
              {/* REVIEW PACK 03-03: Undo moves beneath the title as a quiet
                  tertiary control -- the reason itself now lives in the
                  action column (see below), naming what the row actually
                  offers: undoing the recusal, not repeating the reason. */}
              <button
                type="button"
                className="chq-review-queue-row-undo"
                disabled={undoingId === item.submissionId}
                onClick={() => void undoRecusal(item.submissionId)}
              >
                Undo
              </button>
            </div>
            {/* REVIEW PACK 03-03: the reason IS the row action -- an
                outlined, disabled-styled control (never a live button,
                never chq-btn-primary/secondary) naming why this row is
                recused instead of offering a scoring action. */}
            <span className="chq-review-queue-row-action chq-review-queue-recusal-reason" aria-disabled="true">
              {item.reason ?? 'You work with this speaker'}
            </span>
          </li>
              ))}
            </ol>
            {/* DEC-874 wave-72 amendment (c): the footer is the QUEUE's own
                row -- the count/Show-all group stays conditional on >5 rows,
                but the reviewer reassurance now renders on this same row
                whenever the queue has rows at all. This is the ONLY home
                for that sentence; the shell chrome no longer mints it
                (DEC-369's amendment). */}
            {totalRows > 0 && (
              <div className="chq-review-queue-footer">
                {!showAll && totalRows > 5 && (
                  <span className="chq-review-queue-footer-count-group">
                    <span className="chq-review-queue-footer-count">{`Showing 5 of ${totalRows}`}</span>
                    <button
                      type="button"
                      className="chq-review-queue-footer-showall"
                      onClick={() => setShowAll(true)}
                    >
                      {`Show all ${totalRows}`}
                    </button>
                  </span>
                )}
                <span className="chq-review-queue-footer-note">Your scores stay hidden from other reviewers</span>
              </div>
            )}
          </>
        );
      })()}
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
            <div className="chq-review-scoped-title-row">
              {scoreLeft === null ? (
                <DelayedLoading />
              ) : scoreLeft === 0 ? (
                <h1 className="chq-page-title">Nothing left in your queue. Nicely done.</h1>
              ) : (
                <h1 className="chq-page-title">{`${scoreLeft} left to score`}</h1>
              )}
              {/* REVIEW PACK 03-03: the title row's own primary action --
                  quiet when it has nothing to offer (every item already
                  scored, or the queue hasn't resolved yet), present and
                  linking straight to the first unscored item otherwise. */}
              {routeQueueItems &&
                (() => {
                  const nextItem = routeQueueItems.find((i) => !i.alreadyRatedByMe);
                  if (!nextItem) return null;
                  return (
                    <Link
                      to={`/review/plans/${routePlanId}/submissions/${nextItem.submissionId}`}
                      className="chq-btn chq-btn-primary chq-review-scoped-title-action"
                    >
                      Score the next one
                    </Link>
                  );
                })()}
            </div>
            {subtitle && <p className="chq-review-plan-meta">{subtitle}</p>}
            {routeQueueItems && totalCount > 0 && (
              // REVIEW PACK 03-review (gate-4 still-present finding): the
              // frame puts the "N of M done" caption RIGHT of the bar, on
              // the same line -- not stacked below it, left-aligned. Both
              // pieces read off the same scoredCount/totalCount the bar
              // itself computes, never a third reader.
              <div className="chq-review-scoped-progress-row">
                <div className="chq-bar chq-review-scoped-progress">
                  <div className="chq-bar-fill" style={{ width: `${Math.round((scoredCount / totalCount) * 100)}%` }} />
                </div>
                {/* DEC-939: the frame's "N of M done" caption, from the same
                    two counts the bar already computes -- never a third
                    reader. */}
                <p className="chq-review-scoped-progress-caption">{`${scoredCount} of ${totalCount} done`}</p>
              </div>
            )}
          </div>
        )}
        {routePlanError && (
          <div className="chq-error" role="alert">
            {routePlanError}
          </div>
        )}
        <PlanSection planId={routePlanId} onData={setRouteEnvelope} />
        {/* DEC-369/DEC-874 (wave-72 amendment): the "Scores stay hidden from
            other reviewers" reassurance now lives ONLY in PlanSection's own
            footer row, beside the count/Show-all group -- it is no longer
            minted by the shell chrome (App.tsx Footer). */}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Review</h1>
        <PageSkeleton variant="list" />
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
