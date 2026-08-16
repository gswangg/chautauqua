import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import './review.css';
import { buildResultsCsvHref } from './resultsCsv';
import { formatScore } from '../../../../src/domain/score-copy';
import { DelayedLoading } from '../../components/DelayedLoading';
import { paginationSummary } from '../../lib/pagination-summary';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import type { EvaluationCriterion, EvaluationPlan, ResultsRow, SubmissionEvaluationItem } from './types';
import { STATUS_LABELS, type SubmissionStatus } from '../submissions/types';
import { countOf } from '../../lib/plural';

// DEC-587: the submissions table's own status endpoint -- reused verbatim
// rather than inventing a second "decide" endpoint.
type SubmissionDecision = 'accepted' | 'declined';

// DEC-632/DEC-633: a row whose server status is already 'accepted' or
// 'declined' has been decided -- it shows its state, never a blank pair of
// decision buttons.
function isDecidedStatus(status: string): status is 'accepted' | 'declined' {
  return status === 'accepted' || status === 'declined';
}

// DEC-345/DEC-737: mirrors src/domain/evaluation.ts's ResultsSortKey/
// SortDirection (the pure-core sort now lives server-side, so the SPA only
// needs the wire shape of a sort spec, not the sorting logic itself).
// DEC-737: the per-criterion rating/dropdown columns are gone (folded into
// the one blended SCORE column), so their sort variants go with them --
// nothing in the UI can ever produce a sort key the results table doesn't
// render a header for.
// DEC-906: Ref and # evaluations are no longer their own columns (ref moved
// into the Title cell as a muted prefix; # evaluations is the progress
// panel's job), so their sort keys go with them -- only Title and Score
// remain sortable from the header row. The leading Rank column is never
// sortable: it is always the row's position in whatever order (default:
// score descending) the table is currently showing.
export type SortDirection = 'asc' | 'desc';

export type ResultsSortKey = { column: 'title' } | { column: 'average' };

// DEC-737: a ranked (numeric) column defaults to descending on first click
// -- "best first" is what a ranked column is for. Text columns (title)
// keep ascending.
const NUMERIC_COLUMNS: ResultsSortKey['column'][] = ['average'];

const PER_PAGE = 50;

function sortKeysEqual(a: ResultsSortKey, b: ResultsSortKey): boolean {
  return a.column === b.column;
}

function SortButton({
  label,
  columnKey,
  sort,
  onSort,
}: {
  label: string;
  columnKey: ResultsSortKey;
  sort: { key: ResultsSortKey; direction: SortDirection } | null;
  onSort: (key: ResultsSortKey) => void;
}) {
  const active = sort !== null && sortKeysEqual(sort.key, columnKey);
  const indicator = active ? (sort!.direction === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <button type="button" className="chq-review-sort-button" onClick={() => onSort(columnKey)}>
      {label}
      {indicator}
    </button>
  );
}

// DEC-241/DEC-737/DEC-851 (w3-c): a dropdown (Choice) criterion's distribution
// across every evaluation on this submission -- in the criterion's OWN
// DECLARED option order (never Object.keys(counts): integer-like option
// labels hoist and silently re-sort the committee's list). Options with zero
// picks are omitted from the line; an all-zero distribution (or a criterion
// this scan can't resolve at all) falls back to the codebase's own named
// empty-cell convention, '—', never a blank string.
function formatDropdownDistribution(counts: Record<string, number> | undefined, options: string[]): string {
  const parts = options
    .map((option) => ({ option, count: counts?.[option] ?? 0 }))
    .filter(({ count }) => count > 0)
    .map(({ option, count }) => `${option} ${count}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function ariaSort(
  columnKey: ResultsSortKey,
  sort: { key: ResultsSortKey; direction: SortDirection } | null,
): 'ascending' | 'descending' | 'none' {
  if (!sort || !sortKeysEqual(sort.key, columnKey)) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

// DEC-674: when a planId prop is supplied (the organiser Review landing
// embeds this table as its "region three"), it wins over the route param,
// and the table drops its own page title/back-link chrome -- that chrome
// belongs to the standalone /review/plans/:planId/results route, which
// still renders it unchanged (no planId prop -> falls back to useParams()).
// `embedded` is derived from the prop's presence rather than a second flag,
// since the two are the same condition by construction.
export function ResultsTable({
  planId: planIdProp,
  onSortChange,
}: {
  planId?: string;
  onSortChange?: (sort: { column: string; direction: 'asc' | 'desc' } | null) => void;
} = {}) {
  const { planId: planIdParam } = useParams<{ planId: string }>();
  const planId = planIdProp ?? planIdParam;
  const embedded = planIdProp !== undefined;
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [rows, setRows] = useState<ResultsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [round, setRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // DEC-345: sort/dir/page are now server round trips -- the table shows
  // exactly the rows the server ranked, sorted, and paged, never a
  // client-side re-sort of a single page (that class of bug is DEC-341's).
  const [sort, setSort] = useState<{ key: ResultsSortKey; direction: SortDirection } | null>(null);
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  // DEC-587/DEC-193: optimistic per-submission decision, keyed by
  // submissionId. A failed write rolls this back and refetches server
  // truth instead of restoring the stale pre-update snapshot.
  const [decisions, setDecisions] = useState<Record<string, SubmissionDecision>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);
  // DEC-632/DEC-633: per-row "Reviews (n)" expansion -- expandedId is the
  // one row currently open; evaluations are fetched lazily on expand and
  // cached by submissionId so re-collapsing/re-expanding doesn't re-fetch.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evaluationsById, setEvaluationsById] = useState<Record<string, SubmissionEvaluationItem[]>>({});
  const [evaluationsLoadingId, setEvaluationsLoadingId] = useState<string | null>(null);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  // DEC-737: a monotonically increasing request token -- a results response
  // is only applied if it's still the newest in-flight request when it
  // resolves. Without this, two rapid header clicks can have the first
  // (stale) request's response land after the second's, silently showing
  // rows in an order that contradicts the header arrow actually clicked.
  const resultsRequestIdRef = useRef(0);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    // DEC-856: clear at the start of a read that can replace the error --
    // matches decide()'s setDecideError(null) at its own head.
    setError(null);
    apiGet<EvaluationPlan>(`/plans/${planId}`)
      .then((planRes) => {
        setPlan(planRes);
        setRound(planRes.currentRound);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load results'))
      .finally(() => setLoading(false));
  }, [planId]);

  // Any sort/round change resets to page 1 -- a stale page number from a
  // previous sort/round would silently show the wrong slice.
  useEffect(() => {
    setPage(1);
  }, [round, sort]);

  // DEC-763: the landing page's title-row export link must carry the same
  // sort the in-table 'Download CSV' link does -- notify the parent of
  // every sort-state change, including the initial null, rather than
  // leaving it to re-derive sort from elsewhere.
  useEffect(() => {
    onSortChange?.(sort ? { column: sort.key.column, direction: sort.direction } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    if (!planId || round === null) return;
    const requestId = ++resultsRequestIdRef.current;
    // DEC-856: clear at the start of the read this request represents -- a
    // fresh page/sort/round request may replace a prior refusal. This runs
    // synchronously for every new request (not just the one whose response
    // eventually wins), so it never races the DEC-737 stale-response guard
    // below, which only gates the SET of a new error/rows.
    setError(null);
    const params = new URLSearchParams();
    params.set('round', String(round));
    if (sort) {
      params.set('sort', sort.key.column);
      params.set('dir', sort.direction);
    }
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    apiList<ResultsRow>(`/plans/${planId}/results?${params.toString()}`)
      .then((resultsRes) => {
        // DEC-737: a superseded response is discarded outright -- it is
        // never applied, not even partially.
        if (requestId !== resultsRequestIdRef.current) return;
        setRows(resultsRes.items);
        setTotal(resultsRes.total);
        // DEC-632/DEC-633: rows just came from the server, so any transient
        // optimistic overlay is stale -- clear it, whether this is a fresh
        // load, a page/sort change, or the DEC-193 error-path refetch.
        setDecisions({});
      })
      .catch((err) => {
        if (requestId !== resultsRequestIdRef.current) return;
        // DEC-737: a failed fetch clears rows rather than leaving a stale
        // order under a new header/arrow.
        setRows([]);
        setError(err instanceof ApiError ? err.message : 'Failed to load results');
      });
  }, [planId, round, sort, page, refreshToken]);

  // DEC-587: Accept/Decline reuse the submissions table's own status
  // endpoint (POST /events/:eventId/submissions/status) -- deciding never
  // sends email (product principle 4); notification is a separate, explicit
  // action elsewhere.
  async function decide(submissionId: string, status: SubmissionDecision) {
    if (!plan) return;
    setDecidingId(submissionId);
    setDecideError(null);
    const previous = decisions[submissionId];
    setDecisions((prev) => ({ ...prev, [submissionId]: status }));
    try {
      await apiPost(`/events/${plan.eventId}/submissions/status`, { ids: [submissionId], status });
    } catch (err) {
      // DEC-193: batches already committed on the server must not be
      // visually rolled back; a failed write refetches server truth
      // instead of restoring the stale pre-update snapshot.
      setDecisions((prev) => {
        const next = { ...prev };
        if (previous) next[submissionId] = previous;
        else delete next[submissionId];
        return next;
      });
      setDecideError(err instanceof ApiError ? err.message : 'Failed to update status');
      setRefreshToken((n) => n + 1);
    } finally {
      setDecidingId(null);
    }
  }

  // DEC-632/DEC-633/DEC-596: expand a row's "Reviews (n)" toggle, fetching
  // the organiser-facing evaluations-for-submission endpoint on first
  // expand only (cached in evaluationsById thereafter).
  async function toggleExpand(submissionId: string) {
    if (expandedId === submissionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(submissionId);
    if (evaluationsById[submissionId]) return;
    setEvaluationsLoadingId(submissionId);
    setEvaluationsError(null);
    try {
      const res = await apiList<SubmissionEvaluationItem>(
        `/submissions/${submissionId}/evaluations?planId=${planId}`,
      );
      setEvaluationsById((prev) => ({ ...prev, [submissionId]: res.items }));
    } catch (err) {
      setEvaluationsError(err instanceof ApiError ? err.message : 'Failed to load reviews');
    } finally {
      setEvaluationsLoadingId(null);
    }
  }

  const handleSort = (key: ResultsSortKey) => {
    setSort((prev) => {
      if (prev && sortKeysEqual(prev.key, key)) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      // DEC-737: first click on a numeric (ranked) column sorts descending
      // -- best first, since that's what a ranked column is for. Text
      // columns (ref/title) keep ascending.
      return { key, direction: NUMERIC_COLUMNS.includes(key.column) ? 'desc' : 'asc' };
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (loading) {
    if (embedded) return <DelayedLoading />;
    return (
      <div className="chq-page chq-review-page chq-measure-table">
        <h1 className="chq-page-title">Results</h1>
        <PageSkeleton variant="table" />
      </div>
    );
  }

  // DEC-906: Rank, Title, Speaker, Track, Score, Reviews, Decision -- a
  // fixed 7 columns. Ref is a muted prefix inside the Title cell, not its
  // own column; # Evaluations is dropped (coverage is the progress panel's
  // job, not this table's).
  const columnCount = 7;
  // DEC-147/DEC-241 (w3-c): the round actually being viewed may carry its
  // own criteria override -- the dropdown-criteria distribution must read
  // from THIS round's resolved criteria (mirrors the server's
  // criteriaForRound fallback: an override entry for this round wins, else
  // the plan's base criteria), never the plan's base list unconditionally.
  const activeCriteria: EvaluationCriterion[] =
    round !== null ? (plan?.roundCriteria?.[String(round)] ?? plan?.criteria ?? []) : [];
  const dropdownCriteria = activeCriteria.filter((c) => c.kind === 'dropdown');
  const Wrapper = embedded ? Fragment : 'div';
  const wrapperProps = embedded ? {} : { className: 'chq-page chq-review-page chq-measure-table' };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <p>
          <Link to="/review" className="chq-review-back">
            &lsaquo; Back to plans
          </Link>
        </p>
      )}
      {!embedded && <h1 className="chq-page-title">Results{plan ? `: ${plan.name}` : ''}</h1>}
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {decideError && (
        <div className="chq-error" role="alert">
          {decideError}
        </div>
      )}

      <div className="chq-toolbar">
        {plan && plan.rounds > 1 && round !== null && (
          <label>
            Round:{' '}
            <select className="chq-select" value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {Array.from({ length: plan.rounds }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="chq-section">
        {/* w42-h/DEC-366 amendment: section actions are links on the section
           rule, never an orphan bordered button floating in its own band --
           the export link moves here, carrying the same sort/dir params it
           always has. The eyebrow takes the frame's uppercase letterspaced
           treatment, but its claim stays true: a weighted-by-criterion
           average, recusals excluded -- never "mean of submitted reviews". */}
        <div className="chq-section-head">
          {/* w2-d/DEC-737 amendment: embedded, this table is a PREVIEW of the
             standalone results page -- it carries the plan-scoped heading
             (mirroring ProgressPanel's `${plan.name} · reviewer progress`)
             rather than the bare "Ranked results" label. Standalone, the h1
             "Results: <plan>" already names the page -- a second "Ranked
             results" section label under it would be a duplicate heading, so
             it is dropped: one heading per page. */}
          {embedded && plan && <h2 className="chq-section-label">{`${plan.name} · ranked results`}</h2>}
          <div className="chq-review-results-head-actions">
            <span className="chq-review-results-note chq-review-results-eyebrow">
              Scores average by weight · recusals excluded
            </span>
            {/* w2-d/DEC-763: export ownership stays with the landing's
               title-row link when embedded -- the in-table Download CSV
               link only renders standalone. */}
            {!embedded && planId && (
              <a
                href={buildResultsCsvHref(
                  planId,
                  round ?? undefined,
                  sort ? { column: sort.key.column, direction: sort.direction } : undefined,
                )}
                download
                className="chq-section-action chq-link-button"
              >
                Download CSV
              </a>
            )}
            {/* w2-d/DEC-737: embedded shows only a preview slice -- the
               section-rule action becomes a "See all N results" link to the
               standalone results route, taking the export link's place. */}
            {embedded && planId && (
              <Link to={`/review/plans/${planId}/results`} className="chq-section-action chq-link-button">
                See all {total} results &rsaquo;
              </Link>
            )}
          </div>
        </div>
        {/* DEC-587/product principle 4: said once here, not per row -- a
           decision never triggers email; notifying speakers is a separate,
           explicit action elsewhere. */}
        <p className="chq-review-hint">Deciding here never sends email — notify speakers separately.</p>
        {rows.length === 0 ? (
          // DEC-678 (B7 rule 6, wave 47): a settled-but-empty row set never
          // renders the <table> -- a full sortable header row and pager over
          // a one-cell apology is exactly the pattern B7 forbids. There is
          // no facet narrowing this set (round selection isn't a filter that
          // excludes rows the collection otherwise has), so it's 'fresh'.
          <EmptyState
            variant="fresh"
            what="Nothing has been scored yet."
            reason="Results appear as reviewers submit their scorecards."
            action={null}
          />
        ) : (
        <table className="chq-table chq-review-results-table">
          <thead>
            <tr>
              {/* DEC-906: Rank leads -- it is never sortable itself; it is
                 always the row's position in whatever order (default: score
                 descending) the table is currently showing. */}
              <th className="chq-review-results-col-rank">Rank</th>
              <th className="chq-review-results-col-title" aria-sort={ariaSort({ column: 'title' }, sort)}>
                <SortButton label="Title" columnKey={{ column: 'title' }} sort={sort} onSort={handleSort} />
              </th>
              {/* DEC-703: SPEAKER and TRACK, unsorted (server has no sort key
                 for them) -- who this is and where it goes, without leaving
                 the page. */}
              <th className="chq-review-results-col-speaker">Speaker</th>
              <th className="chq-review-results-col-track">Track</th>
              {/* DEC-737: ONE blended score column -- per-criterion detail
                 moved behind the row's ▸ Reviews disclosure. */}
              <th className="chq-review-results-col-score" aria-sort={ariaSort({ column: 'average' }, sort)}>
                <SortButton label="Score" columnKey={{ column: 'average' }} sort={sort} onSort={handleSort} />
              </th>
              <th className="chq-review-results-col-reviews">Reviews</th>
              <th className="chq-review-results-col-decision">Decision</th>
            </tr>
          </thead>
          <tbody>
            {/* w2-d/DEC-737: embedded renders only the first 4 rows of the
               current page -- a preview, not the page. */}
            {(embedded ? rows.slice(0, 4) : rows).map((row, index) => {
              const overlay = decisions[row.submissionId];
              const effectiveStatus: string | undefined = overlay ?? row.status;
              const decided = effectiveStatus !== undefined && isDecidedStatus(effectiveStatus);
              const evaluations = evaluationsById[row.submissionId];
              const expanded = expandedId === row.submissionId;
              // DEC-906: rank is the row's position in the ordering
              // currently shown (default: score descending) -- (page - 1) *
              // perPage + index + 1, never a value the server returns.
              const rank = (page - 1) * PER_PAGE + index + 1;
              return (
              <Fragment key={row.submissionId}>
              <tr>
                <td data-label="Rank">{rank}</td>
                <td className="chq-review-results-title" data-label="Title">
                  {/* DEC-906: the ref isn't lost with its own column -- it
                     prints as a muted prefix so a producer can still name the
                     row they are deciding. */}
                  <span className="chq-review-results-ref">{row.ref}</span>
                  {' · '}
                  {row.title}
                </td>
                <td data-label="Speaker">{row.speakers.length > 0 ? row.speakers.join(', ') : '—'}</td>
                <td data-label="Track">{row.trackNames.length > 0 ? row.trackNames.join(', ') : '—'}</td>
                <td className="chq-review-results-score" data-label="Score">
                  {formatScore(row.average)}
                </td>
                <td data-label="Reviews">
                  {/* w5-f: the landing's embedded preview is a glance, not a
                     workspace (w2-d already dropped its pager/in-table
                     Download CSV on the same reasoning) -- it prints the
                     plain count, no expand affordance. The standalone
                     /results page keeps the w42-h disclosure button. */}
                  {embedded ? (
                    <span>
                      {countOf(row.count, 'review')}
                      {row.recusals > 0 ? ` · ${countOf(row.recusals, 'recusal')}` : ''}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="chq-btn chq-btn-secondary chq-review-reviews-toggle"
                      onClick={() => void toggleExpand(row.submissionId)}
                    >
                      {expanded ? '▾' : '▸'} {countOf(row.count, 'review')}
                      {row.recusals > 0 ? ` · ${countOf(row.recusals, 'recusal')}` : ''}
                    </button>
                  )}
                </td>
                <td data-label="Decision">
                  {decided ? (
                    // DEC-632/DEC-633: a decided row shows its state, not a
                    // blank pair of decision buttons -- server truth after a
                    // fresh load, an optimistic overlay right after a
                    // successful decide().
                    <span className="chq-review-decided-status">
                      {STATUS_LABELS[effectiveStatus as SubmissionStatus] ?? effectiveStatus}
                    </span>
                  ) : (
                    <div className="chq-review-decision-actions">
                      <button
                        type="button"
                        className="chq-btn chq-btn-primary"
                        disabled={decidingId === row.submissionId}
                        onClick={() => void decide(row.submissionId, 'accepted')}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        disabled={decidingId === row.submissionId}
                        onClick={() => void decide(row.submissionId, 'declined')}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {expanded && (evaluationsLoadingId === row.submissionId ||
                (evaluationsError && !evaluations) ||
                (evaluations && evaluations.length === 0)) && (
                <tr className="chq-review-reviews-row chq-review-band-first chq-review-band-last">
                  <td colSpan={columnCount} className="chq-review-reviews-detail">
                    {evaluationsLoadingId === row.submissionId && <DelayedLoading label="Loading reviews…" />}
                    {evaluationsError && !evaluations && evaluationsLoadingId !== row.submissionId && (
                      <div className="chq-error" role="alert">
                        {evaluationsError}
                      </div>
                    )}
                    {evaluations && evaluations.length === 0 && <p>No evaluations yet.</p>}
                  </td>
                </tr>
              )}
              {/* DEC-633 amendment (wave 25/A27+B8): each evaluation is its
                 own real <tr> in the results table so the browser aligns it
                 to the header columns -- no hand-copied grid template. */}
              {expanded &&
                evaluations &&
                evaluations.length > 0 &&
                evaluations.map((ev, i) => (
                  <tr
                    key={`${ev.planId}-${ev.round}-${i}`}
                    className={
                      'chq-review-reviews-row' +
                      (i === 0 ? ' chq-review-band-first' : '') +
                      (i === evaluations.length - 1 &&
                      row.recusals === 0 &&
                      dropdownCriteria.length === 0
                        ? ' chq-review-band-last'
                        : '')
                    }
                  >
                    <td data-label="Rank" className="chq-review-reviews-cell" />
                    <td data-label="Title" className="chq-review-reviews-cell">
                      {/* DEC-736: the server always resolves a reviewer name
                         on this organiser-facing endpoint -- no
                         '(anonymized)' branch. */}
                      <span className="chq-review-reviews-reviewer">{ev.reviewerName}</span>
                    </td>
                    <td data-label="Speaker" className="chq-review-reviews-cell">
                      <div className="chq-review-reviews-scores">
                        {/* DEC-723: one chip per criterion, labelled from the
                           item's own resolved criteria -- the raw
                           criterionId never appears in the DOM. */}
                        {ev.criteria.map((c) => (
                          <span key={c.id} className="chq-review-reviews-score-chip">
                            {c.label}: {String(ev.scores[c.id] ?? '—')}
                          </span>
                        ))}
                      </div>
                      {ev.comment && <p className="chq-review-reviews-comment">{ev.comment}</p>}
                    </td>
                    <td data-label="Track" className="chq-review-reviews-cell" />
                    <td data-label="Score" className="chq-review-reviews-cell chq-review-reviews-score-total">
                      {formatScore(ev.score)}
                    </td>
                    <td data-label="Reviews" className="chq-review-reviews-cell chq-review-reviews-plan-round">
                      {ev.planName} · Round {ev.round}
                    </td>
                    <td data-label="Decision" className="chq-review-reviews-cell" />
                  </tr>
                ))}
              {/* DEC-241 amendment (wave 7, sha ddc9a7d9): DESIGN-RULINGS.md
                 -- "the distribution [sits] in the footer where the mean
                 sits for scored criteria" -- one footer row after the
                 reviewer rows, not a separate row ahead of them. Carries
                 the recusal sentence (when any reviewer recused) and the
                 Choice distribution (when the round has a dropdown
                 criterion), reading only row.perDropdown, the server's own
                 aggregate -- aggregateSubmission/aggregateEvaluations are
                 untouched. */}
              {expanded &&
                evaluations &&
                evaluations.length > 0 &&
                (dropdownCriteria.length > 0 || row.recusals > 0) && (
                  <tr className="chq-review-reviews-row chq-review-band-last chq-review-reviews-recusal-footer">
                    <td colSpan={columnCount} className="chq-review-reviews-detail">
                      {row.recusals > 0 && (
                        <p className="chq-review-reviews-recusal-sentence">
                          {countOf(row.recusals, 'reviewer')} recused · their scores are excluded from the mean
                        </p>
                      )}
                      {dropdownCriteria.length > 0 && (
                        <div className="chq-review-dropdown-distribution-list">
                          {dropdownCriteria.map((c) => (
                            <span key={c.id} className="chq-review-dropdown-distribution-item">
                              <span className="chq-review-dropdown-distribution-value">
                                <strong>{c.label}:</strong>{' '}
                                {formatDropdownDistribution(row.perDropdown[c.id]?.counts, c.options ?? [])}
                              </span>
                              <span className="chq-review-dropdown-distribution-caption">
                                No average — read the spread
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
        )}

        {/* DEC-366 (wave 42): a frame drawn at ten rows never authorizes
           deleting a volume affordance -- the pager stays; server pagination
           at 2,000 rows is exactly what it's for. */}
        {!embedded && rows.length > 0 && total > 0 && (
          <div className="chq-pager">
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span>{paginationSummary(page, PER_PAGE, total)}</span>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </Wrapper>
  );
}
