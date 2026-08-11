import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { buildResultsCsvHref } from './resultsCsv';
import type { EvaluationPlan, ResultsRow } from './types';

// DEC-345: mirrors src/domain/evaluation.ts's ResultsSortKey/SortDirection
// (the pure-core sort now lives server-side, so the SPA only needs the wire
// shape of a sort spec, not the sorting logic itself).
export type SortDirection = 'asc' | 'desc';

export type ResultsSortKey =
  | { column: 'ref' }
  | { column: 'title' }
  | { column: 'average' }
  | { column: 'count' }
  | { column: 'rating'; criterionId: string }
  | { column: 'dropdown'; criterionId: string };

const PER_PAGE = 50;

function sortKeysEqual(a: ResultsSortKey, b: ResultsSortKey): boolean {
  if (a.column !== b.column) return false;
  if (a.column === 'rating' || a.column === 'dropdown') {
    return (b as { criterionId: string }).criterionId === (a as { criterionId: string }).criterionId;
  }
  return true;
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
    <button type="button" className="chq-sort-button" onClick={() => onSort(columnKey)}>
      {label}
      {indicator}
    </button>
  );
}

export function ResultsTable() {
  const { planId } = useParams<{ planId: string }>();
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

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
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

  useEffect(() => {
    if (!planId || round === null) return;
    const params = new URLSearchParams();
    params.set('round', String(round));
    if (sort) {
      params.set('sort', sort.key.column);
      if (sort.key.column === 'rating' || sort.key.column === 'dropdown') {
        params.set('criterionId', sort.key.criterionId);
      }
      params.set('dir', sort.direction);
    }
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    apiList<ResultsRow>(`/plans/${planId}/results?${params.toString()}`)
      .then((resultsRes) => {
        setRows(resultsRes.items);
        setTotal(resultsRes.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load results'));
  }, [planId, round, sort, page]);

  const handleSort = (key: ResultsSortKey) => {
    setSort((prev) => {
      if (prev && sortKeysEqual(prev.key, key)) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // DEC-241: rating and dropdown criteria each get a results column; 'text'
  // criteria are scorecard-only (they were the permanent '—' before this
  // task) and are dropped entirely here.
  const ratingCriteria = useMemo(() => (plan?.criteria ?? []).filter((c) => c.kind === 'rating'), [plan]);
  const dropdownCriteria = useMemo(() => (plan?.criteria ?? []).filter((c) => c.kind === 'dropdown'), [plan]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Results</h1>
        <p>Loading…</p>
      </div>
    );
  }

  const columnCount = 4 + ratingCriteria.length + dropdownCriteria.length;

  return (
    <div className="chq-page chq-results-table">
      <p>
        <Link to="/review">&larr; Back to plans</Link>
      </p>
      <h1>Results{plan ? `: ${plan.name}` : ''}</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      {plan && plan.rounds > 1 && round !== null && (
        <label className="chq-round-select">
          Round:{' '}
          <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
            {Array.from({ length: plan.rounds }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
      {planId && (
        <a
          href={buildResultsCsvHref(
            planId,
            round ?? undefined,
            sort ? { column: sort.key.column, criterionId: (sort.key as { criterionId?: string }).criterionId, direction: sort.direction } : undefined,
          )}
          download
          className="chq-button"
        >
          Download CSV
        </a>
      )}

      <table className="chq-results-data-table">
        <thead>
          <tr>
            <th>
              <SortButton label="Ref" columnKey={{ column: 'ref' }} sort={sort} onSort={handleSort} />
            </th>
            <th>
              <SortButton label="Title" columnKey={{ column: 'title' }} sort={sort} onSort={handleSort} />
            </th>
            <th>
              <SortButton label="Average" columnKey={{ column: 'average' }} sort={sort} onSort={handleSort} />
            </th>
            <th>
              <SortButton label="# Evaluations" columnKey={{ column: 'count' }} sort={sort} onSort={handleSort} />
            </th>
            {ratingCriteria.map((c) => (
              <th key={c.id}>
                <SortButton
                  label={c.label}
                  columnKey={{ column: 'rating', criterionId: c.id }}
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
            ))}
            {dropdownCriteria.map((c) => (
              <th key={c.id}>
                <SortButton
                  label={c.label}
                  columnKey={{ column: 'dropdown', criterionId: c.id }}
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.submissionId}>
              <td>{row.ref}</td>
              <td>{row.title}</td>
              <td>{row.average.toFixed(2)}</td>
              <td>{row.count}</td>
              {ratingCriteria.map((c) => (
                <td key={c.id}>{row.perCriterion[c.id] !== undefined ? row.perCriterion[c.id]!.toFixed(2) : '—'}</td>
              ))}
              {dropdownCriteria.map((c) => {
                const agg = row.perDropdown[c.id];
                if (!agg || agg.modal === null) {
                  return <td key={c.id}>—</td>;
                }
                // DEC-241: 'modal xN / next xM' -- modal option first, then
                // the next-highest-count option (ties broken by the
                // criterion's own option order, matching the domain's
                // aggregateDropdownCriterion tie-break).
                const ranked = (c.options ?? [])
                  .map((option) => ({ option, count: agg.counts[option] ?? 0 }))
                  .sort((a, b) => b.count - a.count);
                const [top, next] = ranked;
                if (!top) {
                  return <td key={c.id}>—</td>;
                }
                return (
                  <td key={c.id}>
                    {top.option} x{top.count}
                    {next ? ` / ${next.option} x${next.count}` : ''}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columnCount}>No results yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div className="chq-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
