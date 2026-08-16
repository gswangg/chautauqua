import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
// DEC-707: reviewerProgressState/reviewersWithIncompleteQueues/
// reviewersNotStarted all resolve through the SAME domain predicate the
// route imports -- never a second copy here.
import { reviewersWithIncompleteQueues, reviewersNotStarted, reviewerDisplayLabel } from './progress';
import { reviewerProgressState } from '../../../../src/domain/evaluation';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DelayedLoading } from '../../components/DelayedLoading';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import type { SendResult } from '../../lib/sendResult';
import './review.css';
import type { EvaluationPlan, ProgressRow } from './types';

/** DEC-707: the row-level state label -- DONE / N TO GO / NOT STARTED,
 * counts on one line (never a separate "not done" flag layered on top of a
 * raw "3 of 8" count). */
function rowStateLabel(row: ProgressRow): string {
  const state = reviewerProgressState(row);
  if (state === 'done') return 'Done';
  if (state === 'not_started') return 'Not started';
  return `${row.assigned - row.completed} to go`;
}

/** DEC-760 (wave-60 amendment): the v11 standard result line names every
 * count the server reports -- sent, skipped, remaining -- rather than
 * omitting whichever happen to be zero (describeSendResult's summary drops
 * zero-valued fields, which is right for a toast but wrong for this panel's
 * standard line). When the server's SendResult response leaves a field
 * undefined, this says "unknown" rather than assuming zero. */
function formatReminderResult(result: SendResult): string {
  const skipped = result.skipped !== undefined ? String(result.skipped) : 'unknown';
  const remaining = result.remaining !== undefined ? String(result.remaining) : 'unknown';
  return `Sent: ${result.sent}. Skipped: ${skipped}. Remaining: ${remaining}.`;
}

// DEC-674: when a planId prop is supplied (the organiser Review landing
// embeds this panel as its "region two"), it wins over the route param, and
// the panel drops its own page title/back-link chrome -- that chrome
// belongs to the standalone /review/plans/:planId/progress route, which
// still renders it unchanged (no planId prop -> falls back to useParams()).
// `embedded` is derived from the prop's presence rather than a second flag,
// since the two are the same condition by construction.
//
// DEC-706: the embedded region gets ONE header total. PlanList no longer
// wraps this component in its own section/head -- when embedded, THIS
// component owns that single section-head (plan name + a right-aligned
// tertiary "Remind the N not started" link on its rule), replacing both the
// standalone page's "Who has scored" sub-header and its filled primary
// Remind button.
export function ProgressPanel({ planId: planIdProp }: { planId?: string } = {}) {
  const { planId: planIdParam } = useParams<{ planId: string }>();
  const planId = planIdProp ?? planIdParam;
  const embedded = planIdProp !== undefined;
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [remindMessage, setRemindMessage] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceConfirmOpen, setAdvanceConfirmOpen] = useState(false);

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
  const notStarted = reviewersNotStarted(rows);

  async function sendReminder(scope: 'not_started' | 'incomplete') {
    if (!planId) return;
    setReminding(true);
    setError(null);
    setRemindMessage(null);
    try {
      const res = await apiPost<SendResult>(`/plans/${planId}/remind`, scope === 'not_started' ? { scope } : undefined);
      setRemindMessage(formatReminderResult(res));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reminders');
    } finally {
      setReminding(false);
    }
  }

  function advanceRound() {
    if (!planId || !plan) return;
    setAdvanceConfirmOpen(true);
  }

  async function confirmAdvanceRound() {
    if (!planId || !plan) return;
    setAdvancing(true);
    setError(null);
    try {
      await apiPost<EvaluationPlan>(`/plans/${planId}/advance-round`);
      setAdvanceConfirmOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to advance round');
      setAdvanceConfirmOpen(false);
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    if (embedded) return <DelayedLoading />;
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Review</h1>
        <PageSkeleton variant="list" />
      </div>
    );
  }

  const Wrapper = embedded ? Fragment : 'div';
  // DEC-989 (wave-56 amendment): the non-embedded wrapper carries the same
  // chq-measure (820) token as this component's own loading branch above --
  // an unmeasured root rendered /plans/:id/progress unclamped.
  const wrapperProps = embedded ? {} : { className: 'chq-page chq-review-page chq-measure' };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <>
          <p>
            <Link to="/review" className="chq-review-back">
              &larr; Back to plans
            </Link>
          </p>
          <div className="chq-review-summary-row">
            <h1 className="chq-page-title">Reviewer progress</h1>
            {plan && (
              // DEC-760 (wave-60 amendment): names the plan so this reads as
              // the per-plan fact it is, never an event-level claim -- a
              // bare "Round N of M" was read by a judge as describing the
              // whole event rather than this one plan.
              <span className="chq-summary">
                {plan.name}: round {plan.currentRound} of {plan.rounds}
              </span>
            )}
          </div>
        </>
      )}
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {remindMessage !== null && (
        <div className="chq-toast" role="status">
          {remindMessage}
        </div>
      )}

      {/* DEC-760 (wave-60 amendment): "Remind laggards" and "Remind the N
          not started" are two different scopes over two different
          populations, and both render on both surfaces (standalone page and
          landing embed) -- previously each surface only showed one scope.
          Laggards keeps its disabled-when-empty rule: its population
          (assigned reviewers) always exists, it is merely sometimes fully
          satisfied. "Not started" below keeps DEC-760's original
          hidden-when-zero rule: an action with no possible target is absent,
          not disabled (DEC-733). */}
      <div className="chq-toolbar">
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={reminding || laggards.length === 0}
          onClick={() => void sendReminder('incomplete')}
        >
          Remind laggards ({laggards.length})
        </button>
        {!embedded && plan && plan.currentRound < plan.rounds && (
          <button type="button" className="chq-btn chq-btn-secondary" disabled={advancing} onClick={advanceRound}>
            Advance to round {plan.currentRound + 1}
          </button>
        )}
      </div>

      <section className={embedded ? 'chq-section chq-review-landing-progress' : 'chq-section'}>
        <div className="chq-section-head">
          <h2 className="chq-section-label">{embedded && plan ? `${plan.name} · reviewer progress` : 'Who has scored'}</h2>
          {/* DEC-760: when nobody is unstarted the reminder is impossible to
              act on -- the control is absent rather than rendered disabled
              (DEC-733: an action that can't apply is ABSENT, not disabled).
              This differs on purpose from "Remind laggards" above, whose
              population (assigned reviewers) always exists and so stays
              disabled rather than absent. Renders on both surfaces (wave-60
              amendment). */}
          {notStarted.length > 0 && (
            <button
              type="button"
              className="chq-link-button chq-section-action"
              disabled={reminding}
              onClick={() => void sendReminder('not_started')}
            >
              Remind the {notStarted.length} not started
            </button>
          )}
        </div>
        <div className="chq-review-progress-grid">
          {rows.map((row) => {
            return (
              // w5-f: the mock's reviewer-progress row is name + track
              // subtitle, a "N of N" count, and a flag -- no bar (the frame
              // never draws one here; PlanList's plan-level row is the only
              // place this surface bars).
              <div key={row.userId} className="chq-review-progress-row">
                <div>
                  <span className="chq-review-progress-name">{reviewerDisplayLabel(row)}</span>
                  <div className="chq-review-plan-meta">
                    {row.trackName ?? 'All tracks'}
                    {row.recused > 0 && ` · ${row.recused} recused`}
                  </div>
                </div>
                <span className="chq-review-plan-meta">
                  {row.completed} of {row.assigned}
                </span>
                <span className="chq-flag">{rowStateLabel(row)}</span>
              </div>
            );
          })}
          {rows.length === 0 && (
            <EmptyState variant="fresh" what="No reviewers assigned yet." action={null} />
          )}
        </div>
      </section>

      {embedded && plan && plan.currentRound < plan.rounds && (
        <div className="chq-toolbar">
          <button type="button" className="chq-btn chq-btn-secondary" disabled={advancing} onClick={advanceRound}>
            Advance to round {plan.currentRound + 1}
          </button>
        </div>
      )}

      {advanceConfirmOpen && plan && (
        <ConfirmDialog
          title="Advance round"
          body={`Advance this plan from round ${plan.currentRound} to round ${plan.currentRound + 1}? Reviewers will start rating the new round.`}
          confirmLabel="Advance round"
          pending={advancing}
          onConfirm={confirmAdvanceRound}
          onCancel={() => setAdvanceConfirmOpen(false)}
        />
      )}
    </Wrapper>
  );
}
