import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { reviewersWithIncompleteQueues } from './progress';
import type { ProgressRow } from './types';

export function ProgressPanel() {
  const { planId } = useParams<{ planId: string }>();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState<number | null>(null);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    apiList<ProgressRow>(`/plans/${planId}/progress`)
      .then((res) => setRows(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load progress'))
      .finally(() => setLoading(false));
  }, [planId]);

  const laggards = reviewersWithIncompleteQueues(rows);

  async function remindLaggards() {
    if (!planId) return;
    setReminding(true);
    setError(null);
    setReminded(null);
    try {
      const res = await apiPost<{ sent: number }>(`/plans/${planId}/remind`);
      setReminded(res.sent);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reminders');
    } finally {
      setReminding(false);
    }
  }

  if (loading) {
    return (
      <div className="chq-page">
        <h1>Progress</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-progress-panel">
      <p>
        <Link to="/review">&larr; Back to plans</Link>
      </p>
      <h1>Reviewer progress</h1>
      {error && <div className="chq-error-banner">{error}</div>}
      {reminded !== null && <div className="chq-success-banner">Reminder sent to {reminded} reviewer(s).</div>}

      <button type="button" disabled={reminding || laggards.length === 0} onClick={remindLaggards}>
        Remind laggards ({laggards.length})
      </button>

      <table className="chq-progress-table">
        <thead>
          <tr>
            <th>Reviewer</th>
            <th>Assigned</th>
            <th>Completed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId}>
              <td>{row.email}</td>
              <td>{row.assigned}</td>
              <td>{row.completed}</td>
              <td>{row.completed >= row.assigned ? 'Done' : 'In progress'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4}>No reviewers assigned yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
