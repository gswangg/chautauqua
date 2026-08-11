import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { reviewersWithIncompleteQueues } from './progress';
import type { EvaluationPlan, ProgressRow } from './types';

export function ProgressPanel() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);

  function load() {
    if (!planId) return;
    setLoading(true);
    Promise.all([apiGet<EvaluationPlan>(`/plans/${planId}`), apiList<ProgressRow>(`/plans/${planId}/progress`)])
      .then(([planRes, progressRes]) => {
        setPlan(planRes);
        setRows(progressRes.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load progress'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [planId]);

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

  async function advanceRound() {
    if (!planId || !plan) return;
    const ok = window.confirm(`Advance this plan from round ${plan.currentRound} to round ${plan.currentRound + 1}? Reviewers will start rating the new round.`);
    if (!ok) return;
    setAdvancing(true);
    setError(null);
    try {
      await apiPost<EvaluationPlan>(`/plans/${planId}/advance-round`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to advance round');
    } finally {
      setAdvancing(false);
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
      {plan && (
        <p className="chq-round-status">
          Round {plan.currentRound} of {plan.rounds}
        </p>
      )}
      {error && <div className="chq-error-banner">{error}</div>}
      {reminded !== null && <div className="chq-success-banner">Reminder sent to {reminded} reviewer(s).</div>}

      <button type="button" disabled={reminding || laggards.length === 0} onClick={remindLaggards}>
        Remind laggards ({laggards.length})
      </button>
      {plan && plan.currentRound < plan.rounds && (
        <button type="button" disabled={advancing} onClick={advanceRound}>
          Advance to round {plan.currentRound + 1}
        </button>
      )}

      <table className="chq-progress-table">
        <thead>
          <tr>
            <th>Reviewer</th>
            <th>Assigned</th>
            <th>Completed</th>
            <th>Recused</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId}>
              <td>{row.email}</td>
              <td>{row.assigned}</td>
              <td>{row.completed}</td>
              <td>{row.recused}</td>
              <td>{row.completed >= row.assigned ? 'Done' : 'In progress'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>No reviewers assigned yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
