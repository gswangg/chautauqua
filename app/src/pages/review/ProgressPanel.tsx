import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { reviewersWithIncompleteQueues } from './progress';
import './review.css';
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
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-review-page">
      <p>
        <Link to="/review" className="chq-review-back">
          &larr; Back to plans
        </Link>
      </p>
      <div className="chq-review-summary-row">
        <h1 className="chq-page-title">Reviewer progress</h1>
        {plan && (
          <span className="chq-summary">
            Round {plan.currentRound} of {plan.rounds}
          </span>
        )}
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {reminded !== null && (
        <div className="chq-error" role="status">
          Reminder sent to {reminded} reviewer(s).
        </div>
      )}

      <div className="chq-toolbar">
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={reminding || laggards.length === 0}
          onClick={remindLaggards}
        >
          Remind laggards ({laggards.length})
        </button>
        {plan && plan.currentRound < plan.rounds && (
          <button type="button" className="chq-btn chq-btn-secondary" disabled={advancing} onClick={advanceRound}>
            Advance to round {plan.currentRound + 1}
          </button>
        )}
      </div>

      <section className="chq-section">
        <div className="chq-section-head">
          <h2 className="chq-section-label">Who has scored</h2>
        </div>
        <div className="chq-review-progress-grid">
          {rows.map((row) => {
            const done = row.completed >= row.assigned;
            const fraction = row.assigned === 0 ? 0 : Math.min(1, row.completed / row.assigned);
            return (
              <div key={row.userId} className="chq-review-progress-row">
                <div>
                  <span className="chq-review-progress-name">{row.email}</span>
                  {row.recused > 0 && <span className="chq-review-plan-meta"> · {row.recused} recused</span>}
                </div>
                <div className="chq-bar">
                  <div className="chq-bar-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
                </div>
                <span className="chq-flag">
                  {row.completed} of {row.assigned}
                  {!done && ' · not done'}
                </span>
              </div>
            );
          })}
          {rows.length === 0 && <p className="chq-empty">No reviewers assigned yet.</p>}
        </div>
      </section>
    </div>
  );
}
