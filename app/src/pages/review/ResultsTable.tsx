import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { buildResultsCsvHref } from './resultsCsv';
import type { EvaluationPlan, ResultsRow } from './types';

export function ResultsTable() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [rows, setRows] = useState<ResultsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    Promise.all([apiGet<EvaluationPlan>(`/plans/${planId}`), apiList<ResultsRow>(`/plans/${planId}/results`)])
      .then(([planRes, resultsRes]) => {
        setPlan(planRes);
        setRows(resultsRes.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load results'))
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Results</h1>
        <p>Loading…</p>
      </div>
    );
  }

  const criteria = plan?.criteria ?? [];

  return (
    <div className="chq-page chq-results-table">
      <p>
        <Link to="/review">&larr; Back to plans</Link>
      </p>
      <h1>Results{plan ? `: ${plan.name}` : ''}</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      {planId && (
        <a href={buildResultsCsvHref(planId)} download className="chq-button">
          Download CSV
        </a>
      )}

      <table className="chq-results-data-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Title</th>
            <th>Average</th>
            <th># Evaluations</th>
            {criteria.map((c) => (
              <th key={c.id}>{c.label}</th>
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
              {criteria.map((c) => (
                <td key={c.id}>{row.perCriterion[c.id] !== undefined ? row.perCriterion[c.id]!.toFixed(2) : '—'}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4 + criteria.length}>No results yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
