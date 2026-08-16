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
import { EmptyState } from '../../components/EmptyState';
import { PageSkeleton } from '../../components/PageSkeleton';
import './review.css';
import type { EvaluationPlan, ProgressRow, Track } from './types';
import { countOf } from '../../lib/plural';
import { isPlanOpen, planNamesRound } from '../../../../src/domain/evaluation';

/** Presentational-only window state derived from openDate/closeDate — never
 * stored server-side, so it must never be asserted as more than "now vs.
 * these two dates" (DEC-377: no invented figures).
 *
 * DEC-939 amendment: a plan's window state is a pill, not bare caps text --
 * OPEN NOW (the reviewer's actionable state) is an olive-filled pill, OPENS N
 * (a future state, not yet actionable) is an outlined pill, and CLOSED stays
 * bare text since a closed plan is not a state anyone acts on. `kind` drives
 * which review-scoped pill modifier (if any) PlanList applies; `label` is
 * the same three-way text this always rendered.
 *
 * DEC-674 (wave-58 amendment): the window read delegates to the SAME
 * isPlanOpen the server uses (src/domain/evaluation.ts), which expands the
 * day-label openDate/closeDate through the plan's own event timezone --
 * never a bare `< now`/`> now` comparison against a day label here. */
function planState(plan: EvaluationPlan, now: number): { kind: 'open' | 'opens' | 'closed'; label: string } {
  // Past the open boundary (or unbounded on that side) iff isPlanOpen would
  // accept `now` when the close bound is ignored -- the same call as below,
  // just with closeDate dropped, so "not yet open" is never a second
  // hand-written `> now` comparison against the day label.
  if (!isPlanOpen(plan.openDate, null, now, plan.timezone)) {
    return { kind: 'opens', label: `Opens ${formatDateOnly(plan.openDate)}` };
  }
  if (isPlanOpen(plan.openDate, plan.closeDate, now, plan.timezone)) {
    return { kind: 'open', label: 'Open now' };
  }
  return { kind: 'closed', label: 'Closed' };
}

/** DEC-674: a plan's window is "open" iff isPlanOpen (the shared domain
 * predicate, zone-aware) says so -- the same read as planState()'s 'Open
 * now'/'Opens N' branches, factored out so the landing page's default
 * selection uses exactly this rule. */
function isWindowOpen(plan: EvaluationPlan, now: number): boolean {
  return isPlanOpen(plan.openDate, plan.closeDate, now, plan.timezone);
}

function planWindow(plan: EvaluationPlan): string {
  if (plan.openDate === null && plan.closeDate === null) return 'No window set';
  return `${formatDateOnly(plan.openDate)} – ${formatDateOnly(plan.closeDate)}`;
}

/** DEC-760: the plan-row subtitle's track-scope clause -- "All tracks" when
 * the plan carries no track filter, else the filtered tracks' resolved
 * names (never raw ids -- FINDINGS: "raw id leaks -- render LABELS"),
 * joined in the order the filter lists them. */
export function planTrackScope(plan: EvaluationPlan, trackNameById: Map<string, string>): string {
  const trackIds = plan.filters?.trackIds ?? [];
  if (trackIds.length === 0) return 'All tracks';
  return trackIds.map((id) => trackNameById.get(id) ?? id).join(', ');
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
  // DEC-760: track names for each row's scope subtitle -- resolved once per
  // event, keyed by id (never a raw id rendered in the subtitle).
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-674: which plan's progress/results render below the list -- defaults
  // to the first plan whose window is open right now, else the first plan,
  // else none (empty list). A previously-selected plan that's still present
  // after a refetch keeps its selection rather than snapping back to the
  // default.
  const [selected, setSelected] = useState<string | null>(null);
  // DEC-763: the sort ResultsTable is currently showing, mirrored here so
  // the title row's 'Export results CSV' link honours it too -- the same
  // sort the in-table 'Download CSV' link already carries.
  const [resultsSort, setResultsSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (!eventId) return;
    apiList<Track>(`/events/${eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
  }, [eventId]);

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

  // DEC-678: the page's MAIN region (this branch runs before anything else
  // on the page has painted) renders PageSkeleton on the first frame, not a
  // withheld DelayedLoading label -- the section-level `{loading &&
  // <DelayedLoading />}` further down stays DelayedLoading since chrome
  // (the title row above it) is already on screen by then.
  if (eventLoading) {
    return (
      <div className="chq-page chq-review-page chq-measure-table">
        <h1 className="chq-page-title">Review</h1>
        <PageSkeleton variant="list" />
      </div>
    );
  }

  if (eventError || !eventId) {
    return (
      <div className="chq-page chq-review-page chq-measure-table">
        <h1 className="chq-page-title">Review</h1>
        <div className="chq-error">{eventError ?? 'No event selected.'}</div>
      </div>
    );
  }

  const now = Date.now();
  const selectedPlan = plans.find((p) => p.id === selected) ?? null;
  const trackNameById = new Map(tracks.map((t) => [t.id, t.name]));
  // DEC-760: "N with evaluations in" -- a plan counts once its progress
  // aggregate has at least one recorded evaluation. Still-loading plans
  // (missing from progressByPlan) mean the true count isn't known yet, so
  // the whole clause is omitted rather than guessing a number (DEC-377).
  const progressPending = plans.some((p) => progressByPlan[p.id] === undefined);
  const withEvaluationsCount = plans.filter((p) => {
    const rows = progressByPlan[p.id];
    return rows != null && progressTotals(rows).completed > 0;
  }).length;

  return (
    <div className="chq-page chq-review-page chq-measure-table">
      {/* DEC-706: title row -- h1 + summary, page-level actions
         right-aligned beside it. No lone toolbar band above the list. */}
      <div className="chq-review-title-row">
        <h1 className="chq-page-title">Review</h1>
        <span className="chq-summary">
          {countOf(plans.length, 'plan')}
          {!progressPending && ` · ${withEvaluationsCount} with evaluations in`}
        </span>
        <div className="chq-review-title-actions">
          {selectedPlan && (
            <a
              href={buildResultsCsvHref(selectedPlan.id, selectedPlan.currentRound, resultsSort ?? undefined)}
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
        {loaded && !loading && plans.length === 0 && (
          <EmptyState
            variant="fresh"
            what="No review plans yet"
            action={{ label: 'New plan', to: '/review/plans/new' }}
          />
        )}
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
                <div className="chq-review-plan-meta">
                  {planTrackScope(plan, trackNameById)}
                  {plan.maxEvaluations !== null && ` · ${plan.maxEvaluations} reviews each`}
                </div>
              </div>
              {(() => {
                const status = planState(plan, now);
                if (status.kind === 'closed') {
                  return <span className="chq-flag">{status.label}</span>;
                }
                const modifier = status.kind === 'open' ? 'chq-review-plan-status-open' : 'chq-review-plan-status-opens';
                return <span className={`chq-pill ${modifier}`}>{status.label}</span>;
              })()}
              <span className="chq-review-plan-meta">
                {planWindow(plan)}
                {planNamesRound(plan.rounds) && (
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
            <ResultsTable planId={selectedPlan.id} onSortChange={setResultsSort} />
          </section>
        </>
      )}
    </div>
  );
}
