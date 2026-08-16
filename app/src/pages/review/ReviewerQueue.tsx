import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, ApiError } from '../../lib/api';
import './review.css';
import type { EvaluationPlan, RecusalItem, ReviewerQueueEnvelope, ReviewerQueueItem } from './types';
import { formatScore } from '../../../../src/domain/score-copy';
import { DelayedLoading } from '../../components/DelayedLoading';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
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
// DEC-147 amendment (wave 8, task w8-c): the ONE place a round becomes
// display copy -- never compose "Round N" inline.
import { planNamesRound, roundLabel } from '../../../../src/domain/evaluation';
// DEC-845 amendment (wave 38): the queue fetch must always ask for the
// site-wide page cap, not the 50-row apiList default -- a track scope above
// MAX_PER_PAGE=200 rows needs "Show all N" to keep paging past row 200, and
// hand-typing 200 here would drift from the server's own clamp.
import { MAX_PER_PAGE, MAX_PAGE } from '../../../../src/lib/pagination';
// DEC-874 (findings wave 5 amendment): the hub's H1/subline spell their
// counts through this ONE word list -- declaring a second spelled-number
// array anywhere else fails test/count-grammar.scan.test.ts.
import { spellCount, plural } from '../../../../src/domain/count-copy';

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
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(MAX_PER_PAGE);
  const [open, setOpen] = useState(true);
  // DEC-018 (wave-58 amendment): server-set, never inferred from row
  // presence -- a closed plan with zero submissions would fool a
  // rows-based guess. Threaded straight off the envelope (see load() below).
  const [viewerIsOrganizer, setViewerIsOrganizer] = useState(false);
  // DEC-346 (wave-74 amendment): how many of this reviewer's own scoped
  // submissions the server's cap filter dropped from `items` -- names the
  // reason for an empty/short queue instead of leaving it silent.
  const [cappedOut, setCappedOut] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  // REVIEW PACK 03-03: the rendered list caps at 5 rows by default. DEC-845
  // amendment (wave 38): the "Showing 5 of N" caption and "Show all N"
  // control read N off `total + recused.length` -- the envelope's TRUE
  // count -- never items.length, which only reflects whatever pages have
  // been loaded so far.
  const [showAll, setShowAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function load() {
    setLoading(true);
    setShowAll(false);
    setError(null);
    // DEC-845 amendment (wave 38): always request the site-wide page cap --
    // a reviewer scope above 200 rows must still get page 1's worth of
    // rows, not apiList's 50-row default.
    (apiList(`/review/plans/${planId}/queue?perPage=${MAX_PER_PAGE}`) as Promise<ReviewerQueueEnvelope>)
      .then((res) => {
        setItems(res.items);
        setOpen(res.open);
        setViewerIsOrganizer(res.viewerIsOrganizer);
        setRecused(res.recused);
        setTotal(res.total);
        setPerPage(res.perPage);
        setCappedOut(res.cappedOut);
        onData?.(res);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your queue'))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [planId]);

  // DEC-845 amendment (wave 38): "Show all N" loads pages 2..ceil(total/
  // perPage) sequentially and appends each page's items before flipping
  // showAll -- stops early on a zero-row page (belt-and-suspenders against
  // a total that raced stale) and never walks past clampPage's own MAX_PAGE
  // ceiling.
  async function loadAllPages() {
    setLoadingMore(true);
    setError(null);
    try {
      const lastPage = Math.min(Math.ceil(total / perPage), MAX_PAGE);
      let appended: ReviewerQueueItem[] = [];
      for (let page = 2; page <= lastPage; page += 1) {
        const res = (await (apiList(
          `/review/plans/${planId}/queue?perPage=${perPage}&page=${page}`,
        ) as Promise<ReviewerQueueEnvelope>)) as ReviewerQueueEnvelope;
        if (res.items.length === 0) break;
        appended = appended.concat(res.items);
      }
      setItems((prev) => prev.concat(appended));
      setShowAll(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your full queue');
    } finally {
      setLoadingMore(false);
    }
  }

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
      {/* DEC-018 (wave-58 amendment): a closed plan's dead end is a reviewer
          concern only -- an organizer viewing the same closed plan gets a
          muted note above the (still-rendered) list instead, naming what
          they're seeing, since the queue route now admits them same as the
          plan detail route always did. */}
      {/* ONE notice element, two voices: DEC-678's bare-`chq-empty` ratchet
          (app/src/b7-empty-collection.scan.test.ts) allows this file exactly
          one such element because a plan-state notice is not a zero-row
          collection. The two voices are mutually exclusive, so they are one
          element with conditional text rather than two siblings -- same DOM
          either way, and the ratchet stays where it is. */}
      {!open && !error && (
        <p className="chq-empty">
          {viewerIsOrganizer
            ? 'This plan is closed. You are seeing it as an organiser — reviewers cannot score it now.'
            : 'This review plan is not currently open.'}
        </p>
      )}
      {/* DEC-346 (wave-74 amendment): a queue that's empty because the cap
          filter emptied it (not because there's genuinely nothing left) says
          so -- otherwise it's indistinguishable from a broken assignment.
          countOf carries the pluralisation; never hand-composed here. */}
      {(open || viewerIsOrganizer) && items.length === 0 && recused.length === 0 && !error && (
        <EmptyState
          variant="fresh"
          what={
            cappedOut > 0
              ? `${countOf(cappedOut, 'talk')} still in your scope already ${plural(
                  cappedOut,
                  'has',
                  'have',
                )} a full set of reviews.`
              : 'Nothing left in your queue. Nicely done.'
          }
          action={null}
        />
      )}
      {/* DEC-874: recused submissions render INLINE in this same ordered
          list -- marked and carrying the reason plus the existing Undo --
          rather than in a separate trailing section that hides why the
          actionable queue above looks short. Items keep the API's own
          order (see the comment above); recused rows are appended after
          them since the queue endpoint reports them as a distinct set with
          no interleaved position of its own. */}
      {(() => {
        // DEC-845 amendment (wave 38): the TRUE combined row count comes off
        // the envelope's own `total` (actionable) plus `recused.length` --
        // never items.length, which is only whatever pages are loaded.
        const totalRows = total + recused.length;
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
                    ? `SCORED ${formatScore(item.myScore)}`
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
                      disabled={loadingMore}
                      onClick={() => {
                        // DEC-845 amendment (wave 38): page 1 is already
                        // loaded (up to MAX_PER_PAGE rows) -- only fetch more
                        // when there's a page 2+ still outstanding.
                        if (items.length < total) void loadAllPages();
                        else setShowAll(true);
                      }}
                    >
                      {`Show all ${totalRows}`}
                    </button>
                  </span>
                )}
                <span className="chq-review-queue-footer-note">Your scores stay hidden from other reviewers</span>
                {/* DEC-346 (wave-74 amendment): a quiet line beside the count
                    -- the queue isn't short because of a broken assignment,
                    it's short because the cap already covered these. */}
                {cappedOut > 0 && (
                  <span className="chq-review-queue-footer-note">
                    {`${countOf(cappedOut, 'talk')} in your scope already ${plural(
                      cappedOut,
                      'has',
                      'have',
                    )} a full set of reviews`}
                  </span>
                )}
              </div>
            )}
          </>
        );
      })()}
    </section>
  );
}

// DEC-874 (findings wave 5 amendment): a row in the 2+ plan landing list.
// The hub now hoists the ?perPage=1 fetch out of this row so ONE reader
// (ReviewerQueue below) owns every envelope -- this component is a pure
// renderer of whatever it's handed. `envelope` is `undefined` while the
// hub's fetch for this plan is still in flight, `null` when that fetch
// rejected (the row still renders and still links; the decoration is
// optional, the destination is not) and the resolved envelope once loaded.
function ReviewerPlanRow({
  plan,
  envelope,
}: {
  plan: EvaluationPlan;
  envelope: ReviewerQueueEnvelope | null | undefined;
}) {
  // DEC-874 (wave-29 amendment)/(findings wave 5): closed-ness comes off
  // the envelope's own `open` flag directly now -- the frame's state pill
  // reads Open/Closed off this same boolean, so the row's every other
  // closed/open branch shares the one source instead of re-deriving it
  // from the days-label string.
  const isOpen = envelope ? envelope.open : null;
  const total = envelope ? envelope.total : 0;
  const unscoredTotal = envelope ? envelope.unscoredTotal : 0;
  // DEC-522/DEC-831: the days-label still reads through the ONE zone-aware
  // helper the scoped header uses, via the plan's own timezone.
  const closesLabel = envelope ? closesInDaysLabel(envelope.closeDate, plan.timezone) : null;

  // frame :695-733/:736-760: '<total> assigned · <unscoredTotal> left ·
  // <closes label>' -- the 'left' clause drops on a closed plan (nothing
  // left to act on); every clause is optional decoration when the
  // envelope itself never arrived (fetch still pending, or rejected).
  const metaParts = [
    envelope ? `${total} assigned` : null,
    envelope && isOpen ? `${unscoredTotal} left` : null,
    closesLabel,
  ].filter((v): v is string => v != null);
  const metaLine = metaParts.join(' · ');

  // frame :925-939: three closed-vocabulary action labels -- a closed plan
  // reads the quiet secondary "Read your scores"; an open plan with
  // nothing scored yet reads "Start scoring"; an open plan with some
  // progress reads "Score the next one". An envelope that never arrived
  // (still loading, or its fetch rejected) falls back to the same "Start
  // scoring" primary the never-started case uses -- the row must still
  // offer exactly one action even when its decoration is missing.
  const isClosed = envelope !== null && envelope !== undefined && !isOpen;
  const actionLabel = isClosed ? 'Read your scores' : unscoredTotal < total && total > 0 ? 'Score the next one' : 'Start scoring';

  // frame progress bar: width is the scored fraction of `total`, 0% when
  // there's nothing to score yet (or the envelope never arrived).
  const barWidth = envelope && total > 0 ? Math.round(((total - unscoredTotal) / total) * 100) : 0;

  // DEC-874 wave-19 amendment (frame :756-774, the 1600 desktop hub): a
  // four-column row -- name+meta / state pill / progress bar / action --
  // not the earlier stacked-card shape. The pill and bar cells always
  // render (even with an empty pill label when the envelope never
  // arrived) so every row keeps the same four grid tracks as the header.
  return (
    <li className="chq-reviewer-plan-row">
      <div className="chq-reviewer-plan-row-name-line">
        <span className="chq-reviewer-plan-row-name">{plan.name}</span>
        {metaLine.length > 0 && <span className="chq-review-plan-meta">{metaLine}</span>}
      </div>
      <span className={`chq-reviewer-plan-row-pill ${envelope != null ? (isOpen ? 'is-open' : 'is-closed') : ''}`}>
        {envelope != null ? (isOpen ? 'Open' : 'Closed') : ''}
      </span>
      {/* DEC-368: reuse the shell's own .chq-bar/.chq-bar-fill (styles.css)
          rather than a page sheet redefining a second progress-bar rule. */}
      <div className="chq-bar chq-reviewer-plan-row-bar">
        <div className="chq-bar-fill" style={{ width: `${barWidth}%` }} />
      </div>
      <Link to={`/review/plans/${plan.id}`} className="chq-reviewer-plan-row-action">
        {actionLabel}
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
  // DEC-874 (findings wave 5 amendment): the hub's per-plan ?perPage=1
  // fetches are hoisted HERE -- one reader owns every envelope, so the H1's
  // summed "N left to score" and each row's five elements both read off
  // this single map. Keyed by plan id; a key absent from the map means that
  // plan's fetch is still in flight, `null` means it rejected.
  const [envelopes, setEnvelopes] = useState<Record<string, ReviewerQueueEnvelope | null>>({});

  useEffect(() => {
    setError(null);
    setRoutePlanError(null);
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

  useEffect(() => {
    // Only the 2+ plan hub needs a per-plan envelope; the zero/one-plan
    // branches below never render ReviewerPlanRow.
    if (!plans || plans.length <= 1) return;
    let cancelled = false;
    setEnvelopes({});
    plans.forEach((plan) => {
      // DEC-845 amendment (wave 38): ?perPage=1 avoids downloading up to
      // MAX_PER_PAGE=200 rows per plan just to read total/unscoredTotal.
      (apiList(`/review/plans/${plan.id}/queue?perPage=1`) as Promise<ReviewerQueueEnvelope>)
        .then((res) => {
          if (!cancelled) setEnvelopes((prev) => ({ ...prev, [plan.id]: res }));
        })
        .catch(() => {
          // A row whose fetch rejects still renders and still links -- the
          // decoration is optional, the destination is not.
          if (!cancelled) setEnvelopes((prev) => ({ ...prev, [plan.id]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [plans]);

  if (routePlanId) {
    const routeQueueItems = routeEnvelope?.items ?? null;
    // DEC-845 amendment (wave 38): the scoped header's counts come off the
    // envelope's own total/unscoredTotal -- true past row 200 -- never off
    // routeQueueItems.length/filter, which only sees whatever pages of
    // rows PlanSection has loaded so far.
    const scoreLeft = routeEnvelope ? routeEnvelope.unscoredTotal : null;
    const totalCount = routeEnvelope ? routeEnvelope.total : 0;
    const scoredCount = routeEnvelope ? routeEnvelope.total - routeEnvelope.unscoredTotal : 0;
    const scope = routeEnvelope ? routeEnvelope.scopeTrackName ?? 'All tracks' : null;
    const closesLabel =
      routeEnvelope && routeTimezone ? closesInDaysLabel(routeEnvelope.closeDate, routeTimezone) : null;
    // DEC-147 amendment (wave 8, task w8-c): only worth naming when the
    // plan actually runs more than one round -- mirrors Scorecard's own
    // `plan.rounds > 1` gate exactly, so a single-round plan's head reads
    // no differently than before this task.
    const roundName =
      routeEnvelope && planNamesRound(routeEnvelope.rounds)
        ? roundLabel(routeEnvelope.planName, routeEnvelope.currentRound, routeEnvelope.roundMeta)
        : null;
    const subtitle = scope
      ? [scope, roundName, closesLabel].filter((v): v is string => v !== null).join(' · ')
      : null;

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
              {/* DEC-845 amendment (wave 38): this deliberately keeps reading
                  routeQueueItems (whatever pages PlanSection has loaded),
                  not the envelope's unscoredTotal count. buildReviewerQueue
                  (src/domain/evaluation.ts) orders the queue fewest-ratings-
                  first with completed items sunk last, so page 1 already
                  holds an unscored item whenever unscoredTotal > 0 -- no
                  need to page ahead just to find "the next one". */}
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
    // DEC-874 (findings wave 5 amendment): the H1 sums unscoredTotal across
    // OPEN plans only (a closed plan has nothing left to count); the count
    // stays wrong (and unrendered) until every plan's envelope has resolved
    // -- an in-flight fetch that never arrives (rejected) still counts as
    // "resolved" here (key present, value null), it just contributes zero.
    const allEnvelopesResolved = plans.every((plan) => envelopes[plan.id] !== undefined);
    const openEnvelopes = plans
      .map((plan) => envelopes[plan.id])
      .filter((e): e is ReviewerQueueEnvelope => e != null && e.open);
    const leftTotal = openEnvelopes.reduce((sum, e) => sum + e.unscoredTotal, 0);
    const openCount = openEnvelopes.length;

    return (
      <div className="chq-page chq-review-page chq-measure">
        {!allEnvelopesResolved ? (
          <>
            <h1 className="chq-page-title">Your plans</h1>
            <PageSkeleton variant="list" />
          </>
        ) : (
          <>
            <h1 className="chq-page-title">{`${leftTotal} left to score`}</h1>
            <p className="chq-reviewer-plans-subline">{`Across ${spellCount(openCount)} open ${plural(
              openCount,
              'plan',
            )}`}</p>
          </>
        )}
        {error && (
          <div className="chq-error" role="alert">
            {error}
          </div>
        )}
        {allEnvelopesResolved && (
          <>
            {/* DEC-874 wave-19 amendment: the 1600 desktop hub (frame
                :756-759) is a four-column LIST with its own head row --
                Plan/State/Your progress/(blank action column) -- sharing
                .chq-reviewer-plan-row's own grid so the columns line up,
                same discipline as .chq-review-criteria-head-row. */}
            <div className="chq-reviewer-plan-head-row">
              <span>Plan</span>
              <span>State</span>
              <span>Your progress</span>
              <span></span>
            </div>
            <ul className="chq-reviewer-plan-list">
              {plans.map((plan) => (
                <ReviewerPlanRow key={plan.id} plan={plan} envelope={envelopes[plan.id]} />
              ))}
            </ul>
            {/* frame :775 (the 1600 desktop hub's own closing line) carries
                both sentences -- with exactly one OPEN plan this whole hub
                is skipped (the single-plan-list branch above handles the
                truly-one-plan-total case), and scores stay hidden from
                other reviewers even while more than one plan is open. */}
            <p className="chq-reviewer-plans-footnote">
              With one open plan this page is skipped — you land straight in its queue. Scores stay hidden from other
              reviewers.
            </p>
          </>
        )}
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
      {plans && plans.length === 0 && !error && (
        <EmptyState variant="fresh" what="You have no assigned evaluation plans yet." action={null} />
      )}
    </div>
  );
}
