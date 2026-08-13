import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPost, apiPut, ApiError } from '../../lib/api';
import './review.css';
import './scorecard.css';
import { formatAnswerValue } from './answerText';
import { isEvaluationComplete, plainAverage, ratingScaleValues, scorecardKeyAction } from './scorecardLogic';
import { DelayedLoading } from '../../components/DelayedLoading';
import { planTrackScope } from './PlanList';
// DEC-939: the scorecard header's 'N of N done' counter reads the SAME
// reader the reviewer queue's own progress caption is built from -- never a
// second count derived in this component.
import { queueDoneCounts } from './progress';
// DEC-873: the per-criterion weight caption and the "Overall" blend reuse
// the exact functions the plan editor and server already use, so the
// reviewer's number and the organizer's number can never disagree.
import { computeWeightedScore, criterionWeightShares } from '../../../../src/domain/evaluation';
import { OPTIONAL_SUFFIX } from '../../../../src/domain/form-copy';
import type {
  EvaluationCriterion,
  EvaluationPlan,
  EvaluationScores,
  RecusalRecord,
  ReviewerQueueItem,
  ReviewerSubmissionDetail,
  Track,
} from './types';

// DEC-889: the abstract clamps to its first ~60 words so the scorecard
// doesn't reprint the whole submission detail above the ratings; the
// remainder (and the answer lists) live behind a single disclosure.
const ABSTRACT_WORD_LIMIT = 60;

function clampAbstract(text: string, wordLimit: number = ABSTRACT_WORD_LIMIT): { clamped: string; remainder: string; isClamped: boolean } {
  const words = text.trim().length === 0 ? [] : text.trim().split(/\s+/);
  if (words.length <= wordLimit) {
    return { clamped: text, remainder: '', isClamped: false };
  }
  return { clamped: `${words.slice(0, wordLimit).join(' ')}…`, remainder: words.slice(wordLimit).join(' '), isClamped: true };
}

export function Scorecard() {
  const { planId, submissionId } = useParams<{ planId: string; submissionId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [submission, setSubmission] = useState<ReviewerSubmissionDetail | null>(null);
  const [scores, setScores] = useState<EvaluationScores>({});
  const [comment, setComment] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DEC-271: this reviewer's declared conflict of interest on this
  // submission, if any. Scoring is disabled once recused.
  const [recusal, setRecusal] = useState<RecusalRecord | null>(null);
  // DEC-939 (bare recusal amendment): the conflict declaration is a single
  // checkbox on its own line -- checking it IS the declaration (no separate
  // reason field or Declare button survives this amendment).
  const [recusalConfirmed, setRecusalConfirmed] = useState(false);
  const [recusing, setRecusing] = useState(false);
  const [undoingRecusal, setUndoingRecusal] = useState(false);

  // DEC-939: the header's 'N of N done' counter -- fed by queueDoneCounts
  // (progress.ts) over this reviewer's own queue envelope, fetched
  // independently of the submission detail so a route that can't reach the
  // queue endpoint (or an older/partial mock) simply renders no counter
  // rather than a fabricated figure.
  const [queueProgress, setQueueProgress] = useState<{ completed: number; total: number } | null>(null);

  // DEC-889: collapsed by default -- reveals the abstract's remainder and
  // both answer lists together, in place, when the reviewer opts in.
  const [abstractExpanded, setAbstractExpanded] = useState(false);

  // DEC-831: the scorecard's eyebrow names plan · track · round -- the
  // track clause reuses the plan's own filter-scope resolution
  // (planTrackScope, PlanList.tsx) rather than a second definition.
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!planId || !submissionId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiList<EvaluationPlan>('/review/plans').then((res) => res.items.find((p) => p.id === planId) ?? null),
      apiGet<ReviewerSubmissionDetail>(`/review/submissions/${submissionId}?planId=${planId}`),
    ])
      .then(([planRes, subRes]) => {
        setPlan(planRes);
        setSubmission(subRes);
        // DEC-147: the server already resolved criteria for the plan's
        // active round on the submission detail; fall back to plan.criteria
        // only if that's somehow missing (e.g. an older cached response).
        const criteria = subRes?.criteria ?? planRes?.criteria ?? [];
        // DEC-148: optional text criteria default to '' so the validator's
        // "every criterion has an entry" rule is satisfied without the
        // reviewer having to click into every free-text field.
        const initialScores = { ...(subRes?.myEvaluation?.scores ?? {}) };
        for (const c of criteria) {
          if (c.kind === 'text' && initialScores[c.id] === undefined) initialScores[c.id] = '';
        }
        setScores(initialScores);
        setComment(subRes?.myEvaluation?.comment ?? '');
        // DEC-984: a recusal must survive a reload -- initialise straight off
        // the fetched detail, not only after a client-side POST. `userId` is
        // never rendered from this record (only `!!recusal`/`.reason`), so a
        // placeholder is safe; the wire's myRecusal deliberately omits it
        // (it's implicitly "me").
        setRecusal(
          subRes?.myRecusal
            ? { planId: planId, submissionId: submissionId, userId: '', reason: subRes.myRecusal.reason, createdAt: subRes.myRecusal.createdAt }
            : null,
        );
        const firstRating = criteria.find((c) => c.kind === 'rating');
        setFocusedId(firstRating?.id ?? criteria[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submission'))
      .finally(() => setLoading(false));
  }, [planId, submissionId]);

  useEffect(() => {
    // DEC-831: only worth a fetch when the plan actually restricts to a
    // track subset -- an unfiltered plan reads "All tracks" with no request.
    const trackIds = plan?.filters?.trackIds ?? [];
    if (!plan || trackIds.length === 0) {
      setTracks([]);
      return;
    }
    apiList<Track>(`/events/${plan.eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch(() => setTracks([]));
  }, [plan]);

  useEffect(() => {
    // DEC-939: independent of the submission-detail load above -- a failure
    // here (or a route that can't reach the queue endpoint) leaves
    // queueProgress null, which renders no counter rather than a stale or
    // fabricated one.
    if (!planId) return;
    apiList<ReviewerQueueItem>(`/review/plans/${planId}/queue`)
      .then((res) => setQueueProgress(queueDoneCounts(res.items)))
      .catch(() => setQueueProgress(null));
  }, [planId]);

  // DEC-147: the submission detail's resolved criteria (this round) take
  // priority over the base plan.criteria.
  const criteria = submission?.criteria ?? plan?.criteria ?? [];

  // DEC-873: the one incomplete-card message, shared by both actions --
  // there is no partial/draft write (validateEvaluationScores refuses
  // partial scores by design), so both Submit and Save require every
  // criterion filled before they'll talk to the server.
  const INCOMPLETE_MESSAGE = 'Rate every criterion before submitting.';

  async function submitAndAdvance() {
    if (!planId || !submissionId || !plan) return;
    if (!isEvaluationComplete(criteria, scores)) {
      setError(INCOMPLETE_MESSAGE);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await apiPut(`/review/plans/${planId}/evaluations/${submissionId}`, { scores, comment });
      const queue = await apiList<ReviewerQueueItem>(`/review/plans/${planId}/queue`);
      const next = queue.items[0];
      if (next) {
        navigate(`/review/plans/${planId}/submissions/${next.submissionId}`);
      } else {
        navigate(`/review/plans/${planId}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  // DEC-873: "Save" PUTs the identical body as Submit but stays on the
  // page -- the frame calls this "Save draft", but there is no draft state
  // to save (a genuinely half-saved evaluation is a cross-cutting schema
  // change, not a button); this writes the same complete evaluation Submit
  // would, and simply doesn't advance the reviewer to the next submission.
  async function saveOnly() {
    if (!planId || !submissionId || !plan) return;
    if (!isEvaluationComplete(criteria, scores)) {
      setError(INCOMPLETE_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiPut(`/review/plans/${planId}/evaluations/${submissionId}`, { scores, comment });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  }

  // DEC-271/DEC-939 (bare recusal amendment): POST
  // /api/v1/review/plans/:planId/recusals/:submissionId -- checking the
  // bare checkbox IS the declaration now (no separate reason field or
  // Declare button), so reason is always sent null.
  async function handleRecuse() {
    if (!planId || !submissionId) return;
    setRecusing(true);
    setError(null);
    try {
      const res = await apiPost<{ recusal: RecusalRecord }>(`/review/plans/${planId}/recusals/${submissionId}`, {
        reason: null,
      });
      setRecusal(res.recusal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record recusal');
      setRecusalConfirmed(false);
    } finally {
      setRecusing(false);
    }
  }

  async function handleUndoRecusal() {
    if (!planId || !submissionId) return;
    setUndoingRecusal(true);
    setError(null);
    try {
      await apiDelete(`/review/plans/${planId}/recusals/${submissionId}`);
      setRecusal(null);
      setRecusalConfirmed(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to undo recusal');
    } finally {
      setUndoingRecusal(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!plan) return;
    const focused = criteria.find((c) => c.id === focusedId) ?? null;
    const action = scorecardKeyAction(e.key, focused, plan.scale);
    if (action.type === 'setRating') {
      e.preventDefault();
      setScores((s) => ({ ...s, [action.criterionId]: action.value }));
    } else if (action.type === 'submitAndAdvance') {
      e.preventDefault();
      void submitAndAdvance();
    }
  }

  if (loading) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Scorecard</h1>
        <DelayedLoading />
      </div>
    );
  }

  if (!plan || !submission) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Scorecard</h1>
        <div className="chq-error" role="alert">
          {error ?? 'This submission is not part of your assignment.'}
        </div>
      </div>
    );
  }

  // DEC-873: the same reader the plan editor uses (PlanEditor.tsx) for the
  // "Weight N · NN%" caption -- never re-derived here.
  const weightShares = criterionWeightShares(criteria);

  // DEC-889: one clamp, one disclosure -- the disclosure owns both the
  // abstract's remainder and the two answer lists, so the default view
  // never shows either. Server-side anonymization (anonymizeForReviewer)
  // remains the only thing deciding whether speakerAnswers is present at
  // all; this component never re-derives visibility from role.
  const { clamped: abstractClamped, remainder: abstractRemainder, isClamped: abstractIsClamped } = clampAbstract(
    submission.description ?? '',
  );
  const hasAnswers =
    submission.sessionAnswers.length > 0 || (!!submission.speakerAnswers && submission.speakerAnswers.length > 0);
  const showAbstractDisclosure = abstractIsClamped || hasAnswers;

  // DEC-873: computeWeightedScore throws on a missing score, so only call
  // it once every rating criterion (weight > 0) has a numeric entry;
  // otherwise the Overall block renders an em dash.
  const ratingCriteria = criteria.filter((c) => c.kind === 'rating' && (c.weight ?? 0) > 0);
  const overallReady = ratingCriteria.every((c) => typeof scores[c.id] === 'number' && !Number.isNaN(scores[c.id] as number));
  const overallScore = overallReady
    ? computeWeightedScore(
        Object.fromEntries(ratingCriteria.map((c) => [c.id, scores[c.id] as number])),
        ratingCriteria.map((c) => ({ id: c.id, label: c.label, weight: c.weight as number })),
        plan.scale,
      )
    : null;

  // DEC-831: eyebrow names plan · track · round (round only when the plan
  // runs more than one) -- the track clause reuses planTrackScope so it can
  // never drift from the queue header's own scope wording.
  const trackNameById = new Map(tracks.map((t) => [t.id, t.name]));
  const scorecardEyebrow = [
    plan.name,
    planTrackScope(plan, trackNameById),
    plan.rounds > 1 ? `Round ${plan.currentRound} of ${plan.rounds}` : null,
  ]
    .filter((v): v is string => v !== null)
    .join(' · ');

  // DEC-939: the rating group's segment count drives a CSS custom property
  // so the grid stays equal-width for whatever scale the plan defines,
  // rather than review.css hard-coding a step count.
  const ratingScaleStepCount = ratingScaleValues(plan.scale).length;

  return (
    <div
      className="chq-page chq-review-page chq-measure"
      style={{ '--chq-review-scale-steps': ratingScaleStepCount } as React.CSSProperties}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <p>
        <Link to={`/review/plans/${planId}`} className="chq-review-back">
          &lsaquo; {plan.name} queue
        </Link>
      </p>

      <div className="chq-review-scorecard-head">
        <span className="chq-section-label">{scorecardEyebrow}</span>
        {/* DEC-939: the same 'N of N done' progress the reviewer queue
            shows, computed through queueDoneCounts (progress.ts) -- renders
            nothing until that fetch resolves, and nothing at all for an
            empty queue (nothing to count). */}
        {queueProgress && queueProgress.total > 0 && (
          <p className="chq-review-scoped-progress-caption">{`${queueProgress.completed} of ${queueProgress.total} done`}</p>
        )}
        <h1 className="chq-page-title" style={{ fontSize: '27px' }}>
          {submission.ref} — {submission.title}
        </h1>
        {submission.speakers && (
          <span className="chq-summary">Speakers: {submission.speakers.map((s) => s.name).join(', ')}</span>
        )}
        {submission.description && <p className="chq-review-scorecard-abstract">{abstractClamped}</p>}
        {showAbstractDisclosure && (
          <button
            type="button"
            className="chq-review-abstract-disclosure"
            aria-expanded={abstractExpanded}
            onClick={() => setAbstractExpanded((v) => !v)}
          >
            {abstractExpanded ? 'Hide the full submission ‹' : 'Read the full submission ›'}
          </button>
        )}
      </div>

      {abstractExpanded && (
        <>
          {abstractIsClamped && <p className="chq-review-scorecard-abstract-remainder">{abstractRemainder}</p>}

          {submission.sessionAnswers.length > 0 && (
            <section className="chq-review-answers">
              <h2 className="chq-section-label">Submission answers</h2>
              <dl className="chq-review-answer-list">
                {submission.sessionAnswers.map((a) => (
                  <div key={a.fieldId} className="chq-review-answer-row">
                    <dt>{a.label}</dt>
                    <dd>{formatAnswerValue(a.value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {submission.speakerAnswers && submission.speakerAnswers.length > 0 && (
            <section className="chq-review-answers">
              <h2 className="chq-section-label">Speaker answers</h2>
              <dl className="chq-review-answer-list">
                {submission.speakerAnswers.map((a) => (
                  <div key={a.fieldId} className="chq-review-answer-row">
                    <dt>{a.label}</dt>
                    <dd>{formatAnswerValue(a.value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </>
      )}

      {submission.myEvaluation && (
        <p className="chq-review-already-rated">You already rated this submission. Submitting again updates your rating.</p>
      )}

      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      <p className="chq-review-hint">Tip: number keys 1-9 set the focused rating; Enter submits and advances.</p>

      {criteria.map((criterion: EvaluationCriterion) => (
        <div
          key={criterion.id}
          className={`chq-review-criterion${focusedId === criterion.id ? ' chq-focused' : ''}`}
          onFocus={() => setFocusedId(criterion.id)}
        >
          <label className="chq-review-criterion-label">
            {criterion.label}
            {criterion.kind === 'text' && !criterion.required && (
              <span className="chq-review-criterion-optional">{OPTIONAL_SUFFIX}</span>
            )}
          </label>
          {/* DEC-676: guidance renders under the label; nothing when absent. */}
          {criterion.guidance && <p className="chq-review-criterion-guidance">{criterion.guidance}</p>}
          {/* DEC-873: weight caption reads the plan editor's own share
              reader -- criteria with no weight (dropdown/text, or an
              unweighted rating row) print nothing. */}
          {criterion.kind === 'rating' && weightShares[criterion.id] !== undefined && (
            <p className="chq-review-criterion-weight-caption">
              Weight {criterion.weight} · {weightShares[criterion.id]}%
            </p>
          )}
          {criterion.kind === 'rating' ? (
            <div
              role="radiogroup"
              aria-label={criterion.label}
              className="chq-review-rating-group"
            >
              {ratingScaleValues(plan.scale).map((value) => {
                const selected = scores[criterion.id] === value;
                return (
                  // DEC-939: a single-select scale is a radio group, not a
                  // set of toggle buttons -- keeps role="radio" +
                  // aria-checked and refuses aria-pressed (closed, not to
                  // be re-filed).
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`chq-review-rating-btn${selected ? ' chq-review-rating-btn-selected' : ''}`}
                    disabled={!!recusal}
                    onFocus={() => setFocusedId(criterion.id)}
                    onClick={() => setScores((s) => ({ ...s, [criterion.id]: value }))}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          ) : criterion.kind === 'dropdown' ? (
            <select
              className="chq-select"
              value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
              disabled={!!recusal}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: e.target.value }))}
            >
              <option value="">Select…</option>
              {(criterion.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              className="chq-textarea"
              aria-label={criterion.label || 'criterion'}
              value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
              disabled={!!recusal}
              onFocus={() => setFocusedId(criterion.id)}
              onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: e.target.value }))}
            />
          )}
        </div>
      ))}

      {/* DEC-873: the Overall block is never an input -- it's the same
          computeWeightedScore the server and plan editor use, printed to
          one decimal, or an em dash until every rating criterion is
          scored. */}
      <section className="chq-review-overall">
        <h2 className="chq-section-label">Overall</h2>
        <p className="chq-review-overall-caption">Averaged by weight · not editable</p>
        {/* DEC-939 reconciliation line: the SAME per-criterion rating
            values the weighted blend above just read, in criterion order,
            as a plain (unweighted) mean -- never touches computeWeightedScore's
            own math, only shows the un-weighted comparison figure. Renders
            only once overallScore itself is non-null. */}
        {overallScore !== null && ratingCriteria.length > 0 && (
          <p className="chq-review-overall-reconciliation">
            {`A plain average of ${ratingCriteria
              .map((c) => scores[c.id] as number)
              .join(', ')} would be ${plainAverage(ratingCriteria.map((c) => scores[c.id] as number)).toFixed(2)}`}
          </p>
        )}
        <p className="chq-review-overall-value">{overallScore === null ? '—' : overallScore.toFixed(1)}</p>
      </section>

      <label className="chq-review-field">
        Comment to the committee
        <textarea className="chq-textarea" value={comment} disabled={!!recusal} onChange={(e) => setComment(e.target.value)} />
      </label>

      {/* DEC-939 (bare recusal amendment): the recusal declaration sits
          below the work, not above it -- a reviewer shouldn't be asked to
          declare a conflict before seeing what they'd be conflicted about.
          It is now a bare checkbox on its own line: no bordered card, no
          reason field, no separate Declare button -- checking the box IS
          the declaration and POSTs immediately (existing recusal POST
          behaviour, reason: null). */}
      {/* DEC-939 (bare recusal amendment) note: `chq-review-recusal` (the
          review.css card rule -- padding/border/background) is kept as a
          class here purely so that shared selector stays a live token
          (DEC-970 dead-CSS contract); `chq-review-recusal-bare`
          (scorecard.css, this file's own stylesheet) strips every one of
          those card properties back to nothing, so the rendered control is
          visually bare -- no card, no border -- without editing review.css
          this wave. */}
      <div className="chq-review-recusal chq-review-recusal-bare">
        {recusal ? (
          <>
            <p>You recused yourself from this submission.</p>
            <button type="button" className="chq-btn chq-btn-secondary" disabled={undoingRecusal} onClick={() => void handleUndoRecusal()}>
              Undo
            </button>
          </>
        ) : (
          <label className="chq-review-checkbox-label">
            <input
              type="checkbox"
              className="chq-check"
              checked={recusalConfirmed}
              disabled={recusing}
              onChange={(e) => {
                const checked = e.target.checked;
                setRecusalConfirmed(checked);
                if (checked) void handleRecuse();
              }}
            />
            Recuse me — conflict of interest
          </label>
        )}
      </div>

      <div className="chq-review-editor-actions">
        <button type="button" className="chq-btn chq-btn-primary" disabled={submitting || !!recusal} onClick={() => void submitAndAdvance()}>
          Submit and next
        </button>
        <button type="button" className="chq-btn chq-btn-secondary" disabled={saving || !!recusal} onClick={() => void saveOnly()}>
          Save
        </button>
        {saved && (
          <span className="chq-review-saved-confirmation" role="status">
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
