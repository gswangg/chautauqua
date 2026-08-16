import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPost, apiPut, ApiError } from '../../lib/api';
import './review.css';
import { formatScore } from '../../../../src/domain/score-copy';
import './scorecard.css';
import { answerDisplayText } from '../../../../src/domain/answer-text';
import { incompleteCriteria, isEvaluationComplete, plainAverage, ratingScaleValues, scorecardKeyAction } from './scorecardLogic';
import { PageSkeleton } from '../../components/PageSkeleton';
import { planTrackScope } from './PlanList';
// DEC-908 (wave-9 amendment): the scorecard head's meta line reuses the ONE
// session-shape display vocabulary (Talk (30 min) -> 'Talk, 30 min',
// Advanced -> 'advanced') -- never a second label grammar defined in this
// component.
import { sessionFormatLabel, audienceLevelLabel } from '../../../../src/lib/session-vocabulary';
// DEC-939/DEC-845 (wave 40 amendment): the scorecard header's 'N of N done'
// counter reads the SAME reader the reviewer queue's own progress caption is
// built from -- never a second count derived in this component.
import { queueDoneCounts } from './progress';
// DEC-845 (wave 40 amendment): the queue fetch below requests the full
// MAX_PER_PAGE page (as ReviewerQueue.tsx does) so the envelope's own
// total/unscoredTotal -- and submitAndAdvance's own scan for the next
// unscored item -- see the reviewer's full scope, not a shrunken default
// page.
import { MAX_PER_PAGE } from '../../../../src/lib/pagination';
// DEC-873: the per-criterion weight caption and the "Overall" blend reuse
// the exact functions the plan editor and server already use, so the
// reviewer's number and the organizer's number can never disagree.
import { computeWeightedScore, criterionWeightShares, roundLabel, roundMetaFor } from '../../../../src/domain/evaluation';
import { OPTIONAL_SUFFIX } from '../../../../src/domain/form-copy';
import { MAX_LONG_TEXT_LENGTH } from '../../lib/text-caps';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import type {
  EvaluationCriterion,
  EvaluationPlan,
  EvaluationScores,
  RecusalRecord,
  ReviewerQueueEnvelope,
  ReviewerSubmissionDetail,
  Track,
} from './types';

// DEC-958 (wave-66 amendment): PUT .../evaluations/:id emits a fields map
// keyed by CRITERION ID (the per-criterion messages from
// validateEvaluationScores, src/domain/evaluation.ts) plus two named
// top-level keys (`scores`, `comment`) that are not criterion ids -- every
// key renders AT its control, never collapsed into the top-level message.
// A key that matches neither a criterion id nor the known `comment` key
// (an 'unknown criterion' refusal, or any future top-level key) still
// renders in the summary, labelled by its own raw key, rather than being
// dropped -- the same unmatched-key rule PlanEditor's reviewerAssignProblems
// and BulkEmailModal already follow.
const COMMENT_FIELD_ANCHOR_ID = 'chq-review-comment-field';

function criterionAnchorId(criterionId: string): string {
  return `chq-review-criterion-${criterionId}`;
}

// DEC-939 (wave-61 amendment, scorecard a11y): the accessible name for a
// criterion's group (and every control inside it) is derived from BOTH the
// criterion's own id and its label -- never the label alone, which is
// user-editable and can collide (or read alike) across criteria. This is
// what makes two same-labelled rating rows two distinct groups in the
// accessibility tree instead of one.
function criterionGroupName(criterion: EvaluationCriterion): string {
  return `${criterion.label} (${criterion.id})`;
}

function radioAccessibleName(criterion: EvaluationCriterion, value: number, max: number): string {
  return `${criterionGroupName(criterion)}: ${value} of ${max}`;
}

function evaluationRefusalProblems(
  fields: Record<string, string>,
  criteria: EvaluationCriterion[],
): { anchorId: string; label: string }[] {
  const criterionById = new Map(criteria.map((c) => [c.id, c]));
  return Object.entries(fields).map(([key, message]) => {
    const criterion = criterionById.get(key);
    if (criterion) {
      return { anchorId: criterionAnchorId(criterion.id), label: `${criterion.label}: ${message}` };
    }
    if (key === 'comment') {
      return { anchorId: COMMENT_FIELD_ANCHOR_ID, label: `Comment to the committee: ${message}` };
    }
    return { anchorId: key, label: `${key}: ${message}` };
  });
}

// DEC-889 (wave-72 amendment): the reading column IS the frame's body --
// the abstract prints in full under an ABSTRACT eyebrow, and the session
// and speaker answers print as label|value rows below it, at rest. The
// 60-word clamp and the "Read the full submission ›" disclosure are
// retired entirely (no clamp helper, no expand/collapse state survives).

function isFormFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function Scorecard() {
  const { planId, submissionId } = useParams<{ planId: string; submissionId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [submission, setSubmission] = useState<ReviewerSubmissionDetail | null>(null);
  const [scores, setScores] = useState<EvaluationScores>({});
  const [comment, setComment] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // DEC-939 (wave-65 amendment): the focus ring paints only once the
  // reviewer has actually used the keyboard -- `focusedId` itself stays
  // pre-armed (so a number key still routes to the first rating criterion
  // with no prior click), but the ring's ink is gated separately so it
  // never appears on first paint.
  const [ringArmed, setRingArmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-958 (wave-66 amendment): the server's per-criterion/per-field
  // refusal map, kept WHOLE and keyed by the server's own wire keys --
  // cleared at the start of every submit/save attempt, fed only from a
  // fields-bearing ApiError. A field-less conflict (plan not open, recused,
  // cap reached, already submitted) never touches this map -- it renders
  // through the pre-existing `error` message instead.
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

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

  // DEC-939 (wave-3 amendment): the incomplete notice is a LIVE derivation
  // (incompleteCriteria), never a latched string -- `attempted` only gates
  // WHETHER it renders (a reviewer shouldn't see it before trying once),
  // and it recomputes on every render so filling the last gap makes it
  // vanish immediately, with no second submit required to clear it.
  const [attempted, setAttempted] = useState(false);

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
    (apiList(`/review/plans/${planId}/queue?perPage=${MAX_PER_PAGE}`) as Promise<ReviewerQueueEnvelope>)
      // DEC-845 (wave 40 amendment): queueDoneCounts now reads the envelope's
      // own total/unscoredTotal directly -- both are computed server-side
      // over the reviewer's FULL scope before any page slice (see
      // reviewer.ts), so this figure stays true even past MAX_PER_PAGE
      // assignments.
      .then((res) => setQueueProgress(queueDoneCounts(res)))
      .catch(() => setQueueProgress(null));
  }, [planId]);

  // DEC-147: the submission detail's resolved criteria (this round) take
  // priority over the base plan.criteria.
  const criteria = submission?.criteria ?? plan?.criteria ?? [];

  async function submitAndAdvance() {
    if (!planId || !submissionId || !plan) return;
    setAttempted(true);
    if (!isEvaluationComplete(criteria, scores)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setServerFieldErrors({});
    setSaved(false);
    try {
      await apiPut(`/review/plans/${planId}/evaluations/${submissionId}`, { scores, comment });
      // DEC-845 (wave 40 amendment): the queue deliberately keeps already-
      // rated rows (sorted rated-last, see buildReviewerQueue in
      // src/domain/evaluation.ts) so items[0] can be a submission the
      // reviewer already scored -- including the one they just submitted.
      // "Submit and next" must scan for the first row that is NOT already
      // rated by this reviewer and is not the submission just submitted,
      // and fall back to the plan route once unscoredTotal is 0 or no such
      // row exists, rather than re-opening a scored card forever.
      const queue = (await apiList(`/review/plans/${planId}/queue?perPage=${MAX_PER_PAGE}`)) as ReviewerQueueEnvelope;
      const next =
        queue.unscoredTotal > 0
          ? queue.items.find((item) => !item.alreadyRatedByMe && item.submissionId !== submissionId)
          : undefined;
      if (next) {
        navigate(`/review/plans/${planId}/submissions/${next.submissionId}`);
      } else {
        navigate(`/review/plans/${planId}`);
      }
    } catch (err) {
      // DEC-958 (wave-66 amendment): a fields-bearing refusal is rendered
      // AT its control (per-criterion messages, the comment cap) never as
      // the shared top-level message ('Invalid scores') -- a field-less
      // conflict (plan not open, recused, cap reached) still falls through
      // to the verbatim `error` sentence exactly as before.
      if (err instanceof ApiError && err.fields) {
        setServerFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to submit evaluation');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // DEC-873 (wave 27 amendment): "Save draft" PUTs a draft evaluation --
  // scores may be partial (no completeness check, no `attempted` gate) and
  // the server never stamps submittedAt for it. Submit and next keeps its
  // full validation unchanged.
  async function saveOnly() {
    if (!planId || !submissionId || !plan) return;
    setSaving(true);
    setError(null);
    setServerFieldErrors({});
    setSaved(false);
    try {
      await apiPut(`/review/plans/${planId}/evaluations/${submissionId}`, { scores, comment, draft: true });
      setSaved(true);
    } catch (err) {
      // DEC-958/DEC-873 (wave-66 amendment): a draft skips only the
      // COMPLETENESS check server-side -- every PRESENT value is still
      // validated, so a draft save must render the same per-criterion
      // messages as a full submit, never gate this reader on the non-draft
      // path.
      if (err instanceof ApiError && err.fields) {
        setServerFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save evaluation');
      }
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
    // DEC-939 (wave-3 amendment): a page-level key handler must ask who has
    // focus -- digits and Enter belong to whatever form field the event
    // actually originated in (the comment textarea, a dropdown), never to
    // the page, so scorecardKeyAction always yields 'none' for those.
    const action = scorecardKeyAction(e.key, focused, plan.scale, { fromFormField: isFormFieldTarget(e.target) });
    if (action.type === 'setRating') {
      e.preventDefault();
      setRingArmed(true);
      setScores((s) => ({ ...s, [action.criterionId]: action.value }));
    } else if (action.type === 'submitAndAdvance') {
      e.preventDefault();
      setRingArmed(true);
      void submitAndAdvance();
    }
  }

  // DEC-678: the scorecard's MAIN region renders PageSkeleton on the first
  // frame, not a withheld DelayedLoading label -- this branch runs before
  // any of the page's chrome has painted.
  if (loading) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Scorecard</h1>
        <PageSkeleton variant="detail" />
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

  // DEC-889 (wave-72 amendment): the FORM ANSWERS block is the session
  // answers followed by the speaker answers, as label|value rows, at rest.
  // anonymizeForReviewer (server-side) remains the ONLY thing deciding
  // whether speakerAnswers exist at all -- this component never re-derives
  // visibility from role, it just renders whatever the wire sent.
  const formAnswers = [...submission.sessionAnswers, ...(submission.speakerAnswers ?? [])];
  // DEC-939 (wave-3 amendment): the incomplete-criteria notice is a live
  // derivation of the SAME predicate the rail's per-criterion markers and
  // the submit/save validators use -- never a second definition.
  const incomplete = incompleteCriteria(criteria, scores);
  const showIncompleteNotice = attempted && incomplete.length > 0;

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
  // DEC-147 amendment (wave 8, task w8-c): the round segment now reads the
  // round's own resolved name (roundMetaFor + roundLabel, the ONE place a
  // round becomes copy) instead of composing "Round N" inline.
  const roundMeta = roundMetaFor(plan, plan.roundMeta ?? null, plan.currentRound);
  const scorecardEyebrow = [
    plan.name,
    planTrackScope(plan, trackNameById),
    plan.rounds > 1 ? roundLabel(plan.name, plan.currentRound, roundMeta) : null,
  ]
    .filter((v): v is string => v !== null)
    .join(' · ');

  // DEC-939: the rating group's segment count drives a CSS custom property
  // so the grid stays equal-width for whatever scale the plan defines,
  // rather than review.css hard-coding a step count.
  const ratingScaleStepCount = ratingScaleValues(plan.scale).length;

  return (
    <div
      className="chq-page chq-review-page chq-measure-wide"
      style={{ '--chq-review-scale-steps': ratingScaleStepCount } as React.CSSProperties}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* DEC-939 (wave-65 amendment, frame 03--01): two work surfaces --
          the reading column (submission context) on the left, the scoring
          rail (everything the reviewer writes into) on the right. Below
          ~1200px the rail drops under the reading column (see
          scorecard.css's one additive media query). */}
      <div className="chq-review-scorecard-grid">
        <div className="chq-review-scorecard-reading">
          <p>
            <Link to={`/review/plans/${planId}`} className="chq-review-back">
              &lsaquo; {plan.name} queue
            </Link>
          </p>

          <div className="chq-review-scorecard-head">
            <span className="chq-section-label">{scorecardEyebrow}</span>
            {/* frame 03--01: the 'N of N done' caption leaves the reading
                column entirely -- it portals into App's own
                #chq-header-slot node (rendered in the header identity
                group) rather than printing here. Renders nothing when
                that node isn't mounted (a Scorecard mounted alone in a
                render test), same as it always rendered nothing before
                queueProgress resolved. */}
            {queueProgress &&
              queueProgress.total > 0 &&
              typeof document !== 'undefined' &&
              document.getElementById('chq-header-slot') &&
              createPortal(
                <p className="chq-review-scoped-progress-caption">{`${queueProgress.completed} of ${queueProgress.total} done`}</p>,
                document.getElementById('chq-header-slot') as HTMLElement,
              )}
            <h1 className="chq-page-title" style={{ fontSize: '27px' }}>
              {submission.title}
            </h1>
            {/* frame 03--01: the meta line reads ref · format(, duration) ·
                audience level, in the frame's lowercase grammar -- reusing
                the ONE session-shape display vocabulary (session-vocabulary.ts)
                rather than a second label grammar. The ref always renders
                (it no longer appears in the h1); format/audienceLevel
                render only when the wire carries them. */}
            <p className="chq-review-scorecard-meta">
              {[
                submission.ref,
                submission.format != null ? sessionFormatLabel(submission.format) : null,
                submission.audienceLevel != null ? audienceLevelLabel(submission.audienceLevel) : null,
              ]
                .filter((v): v is string => v != null)
                .join(' · ')}
            </p>
            {submission.speakers && (
              <span className="chq-summary">Speakers: {submission.speakers.map((s) => s.name).join(', ')}</span>
            )}
            {/* DEC-889 (wave-72 amendment); DEC-018 (wave-54 amendment):
                anonymizeForReviewer already stripped speakers/speakerAnswers
                and redacted every identity string out of title/description/
                sessionAnswers server-side -- this is a disclosure of that
                fact (gated on the wire's own `anonymized` flag, never
                re-derived from plan), never a re-derivation of visibility
                from role. */}
            {submission.anonymized === true && (
              <p className="chq-review-anonymized-notice">
                {"The speaker's name and company are hidden while this plan is anonymised."}
              </p>
            )}
          </div>

          {/* DEC-889 (wave-72 amendment): the reading column IS the frame's
              body -- ABSTRACT eyebrow + rule + the full abstract, at rest
              (no clamp, no disclosure). */}
          {submission.description && (
            <section className="chq-review-scorecard-abstract-section">
              <h2 className="chq-section-label">Abstract</h2>
              <hr className="chq-review-scorecard-abstract-rule" />
              <p className="chq-review-scorecard-abstract">{submission.description}</p>
            </section>
          )}

          {formAnswers.length > 0 && (
            <section className="chq-review-answers">
              <h2 className="chq-section-label">Form answers</h2>
              <dl className="chq-review-answer-list">
                {formAnswers.map((a) => (
                  <div key={a.fieldId} className="chq-review-answer-row">
                    <dt>{a.label}</dt>
                    <dd>{answerDisplayText(a.value, { empty: '—' })}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {submission.myEvaluation && (
            <p className="chq-review-already-rated">You already rated this submission. Submitting again updates your rating.</p>
          )}

          {error && (
            <div className="chq-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <aside className="chq-review-scorecard-rail">
          {/* DEC-958 (wave-66 amendment): the server's fields map, kept
              WHOLE -- one anchor per key, pointing at that criterion's own
              row (or the comment textarea, or the raw key for a shape this
              surface doesn't recognise -- an 'unknown criterion' refusal is
              never dropped). */}
          {Object.keys(serverFieldErrors).length > 0 && (
            <ErrorSummary
              heading={countHeading(Object.keys(serverFieldErrors).length, 'before this evaluation can be saved')}
              problems={evaluationRefusalProblems(serverFieldErrors, criteria)}
            />
          )}
          {criteria.map((criterion: EvaluationCriterion) => (
            <fieldset
              key={criterion.id}
              id={criterionAnchorId(criterion.id)}
              className={`chq-review-criterion${ringArmed && focusedId === criterion.id ? ' chq-focused' : ''}${
                // DEC-939 (wave-3 amendment): a quiet marker on each blocking
                // criterion's row, added only once a submit has been
                // attempted -- the SAME incompleteCriteria list the notice
                // above names its blockers from.
                attempted && incomplete.some((c) => c.id === criterion.id) ? ' chq-review-criterion-missing' : ''
              }`}
              onFocus={() => setFocusedId(criterion.id)}
            >
              {/* DEC-939 (wave-61 amendment): one criterion is one real
                  <fieldset>, and the <legend> below is its visible name --
                  same anatomy every browser and screen reader already
                  understands for a labelled group, instead of a bare
                  aria-label on a div that a two-collision label makes
                  indistinguishable. The legend stays the fieldset's direct
                  first child (required for both the border-corner rendering
                  and the accessible-name computation) and doubles as the
                  frame's name row -- label on the left, weight caption on
                  the right -- so the visible layout is unchanged. */}
              <legend className="chq-review-criterion-name-row">
                <span className="chq-review-criterion-label">
                  {criterion.label}
                  {criterion.kind === 'text' && !criterion.required && (
                    <span className="chq-review-criterion-optional">{OPTIONAL_SUFFIX}</span>
                  )}
                </span>
                {/* DEC-873: weight caption reads the plan editor's own share
                    reader -- criteria with no weight (dropdown/text, or an
                    unweighted rating row) print nothing. */}
                {criterion.kind === 'rating' && weightShares[criterion.id] !== undefined && (
                  <span className="chq-review-criterion-weight-caption">
                    Weight {criterion.weight} · {weightShares[criterion.id]}%
                  </span>
                )}
              </legend>
              {/* DEC-676: guidance renders under the label; nothing when absent. */}
              {criterion.guidance && <p className="chq-review-criterion-guidance">{criterion.guidance}</p>}
              {criterion.kind === 'rating' ? (
                (() => {
                  const scaleValues = ratingScaleValues(plan.scale);
                  const currentValue = scores[criterion.id];
                  const currentIndex = scaleValues.findIndex((v) => v === currentValue);
                  // DEC-939 (amendment): roving tabindex -- the selected
                  // pill is the group's one tab stop; with nothing selected
                  // yet, the first pill is (same contract every native
                  // radiogroup follows).
                  const rovingIndex = currentIndex >= 0 ? currentIndex : 0;
                  function moveTo(nextIndex: number, groupEl: HTMLDivElement) {
                    // nextIndex is always produced by moduloing into
                    // [0, scaleValues.length) or clamping to an end, so the
                    // lookup is always in range.
                    const nextValue = scaleValues[nextIndex] as number;
                    setScores((s) => ({ ...s, [criterion.id]: nextValue }));
                    setFocusedId(criterion.id);
                    const btn = groupEl.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex];
                    btn?.focus();
                  }
                  function handleGroupKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
                    if (recusal) return;
                    const groupEl = e.currentTarget;
                    let nextIndex: number | null = null;
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      nextIndex = (rovingIndex + 1) % scaleValues.length;
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      nextIndex = (rovingIndex - 1 + scaleValues.length) % scaleValues.length;
                    } else if (e.key === 'Home') {
                      nextIndex = 0;
                    } else if (e.key === 'End') {
                      nextIndex = scaleValues.length - 1;
                    }
                    if (nextIndex === null) return;
                    // DEC-939: this handler owns arrow/Home/End for the
                    // group -- preventDefault + stopPropagation so it never
                    // reaches the page-level number-key handler (ruling
                    // A11, Scorecard.tsx handleKeyDown).
                    e.preventDefault();
                    e.stopPropagation();
                    moveTo(nextIndex, groupEl);
                  }
                  return (
                    <div
                      role="radiogroup"
                      aria-label={criterionGroupName(criterion)}
                      className="chq-review-rating-group"
                      onKeyDown={handleGroupKeyDown}
                    >
                      {scaleValues.map((value, i) => {
                        const selected = scores[criterion.id] === value;
                        return (
                          // DEC-939: a single-select scale is a radio group, not
                          // a set of toggle buttons -- keeps role="radio" +
                          // aria-checked and refuses aria-pressed (closed, not
                          // to be re-filed).
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={radioAccessibleName(criterion, value, scaleValues.length)}
                            tabIndex={i === rovingIndex ? 0 : -1}
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
                  );
                })()
              ) : criterion.kind === 'dropdown' ? (
                <select
                  className="chq-select"
                  aria-label={criterionGroupName(criterion)}
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
                  aria-label={criterionGroupName(criterion)}
                  maxLength={MAX_LONG_TEXT_LENGTH}
                  value={typeof scores[criterion.id] === 'string' ? (scores[criterion.id] as string) : ''}
                  disabled={!!recusal}
                  onFocus={() => setFocusedId(criterion.id)}
                  onChange={(e) => setScores((s) => ({ ...s, [criterion.id]: e.target.value }))}
                />
              )}
              {/* DEC-958 (wave-66 amendment): the server's own message for
                  THIS criterion, beside the existing client-side
                  chq-review-criterion-missing treatment above -- the
                  completeness gate and the server's answer are different
                  facts, so neither replaces the other. */}
              {serverFieldErrors[criterion.id] && (
                <p className="chq-field-error" role="alert">
                  {serverFieldErrors[criterion.id]}
                </p>
              )}
            </fieldset>
          ))}

          {/* frame 03--01: Overall prints its label and value on ONE line --
              the same computeWeightedScore the server and plan editor use,
              printed to one decimal, or an em dash until every rating
              criterion is scored -- with the caption and the plain-average
              reconciliation merged into a single sentence beneath it
              (same numbers, same computeWeightedScore/plainAverage calls,
              fewer elements). */}
          <section className="chq-review-overall">
            <p className="chq-review-overall-line">
              <span className="chq-section-label">Overall</span>
              <span className="chq-review-overall-value">{formatScore(overallScore)}</span>
            </p>
            <p className="chq-review-overall-caption">
              {overallScore !== null && ratingCriteria.length > 0
                ? `Averaged by weight, not editable — a plain average of ${ratingCriteria
                    .map((c) => scores[c.id] as number)
                    .join(', ')} would be ${formatScore(plainAverage(ratingCriteria.map((c) => scores[c.id] as number)))}`
                : 'Averaged by weight, not editable'}
            </p>
          </section>

          <label className="chq-review-field">
            Comment to the committee
            <textarea
              id={COMMENT_FIELD_ANCHOR_ID}
              className="chq-textarea"
              maxLength={MAX_LONG_TEXT_LENGTH}
              value={comment}
              disabled={!!recusal}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          {/* DEC-958 (wave-66 amendment): the {comment: 'Max N'} refusal
              anchors here, not in the shared top-level error region. */}
          {serverFieldErrors.comment && (
            <span className="chq-field-error" role="alert">
              {serverFieldErrors.comment}
            </span>
          )}

          {/* DEC-939 (bare recusal amendment): the recusal declaration sits
              below the work, not above it -- a reviewer shouldn't be asked
              to declare a conflict before seeing what they'd be conflicted
              about. It is now a bare checkbox on its own line: no bordered
              card, no reason field, no separate Declare button -- checking
              the box IS the declaration and POSTs immediately (existing
              recusal POST behaviour, reason: null). */}
          {/* DEC-939 (bare recusal amendment) note: `chq-review-recusal`
              (the review.css card rule -- padding/border/background) is
              kept as a class here purely so that shared selector stays a
              live token (DEC-970 dead-CSS contract); `chq-review-recusal-
              bare` (scorecard.css, this file's own stylesheet) strips every
              one of those card properties back to nothing, so the rendered
              control is visually bare -- no card, no border -- without
              editing review.css this wave. */}
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
                Recuse me from this one
              </label>
            )}
          </div>

          {/* DEC-939 (wave-3 amendment): a LIVE derivation, not a latched
              error string -- renders only once a submit has been attempted
              AND blockers remain, and names them, so filling the last gap
              makes it vanish on the very next render (no second submit
              needed to clear a message that no longer applies). */}
          {showIncompleteNotice && (
            <div className="chq-error chq-review-incomplete-notice" role="alert">
              {`Rate every criterion before submitting — still needed: ${incomplete.map((c) => c.label).join(', ')}`}
            </div>
          )}

          <div className="chq-review-editor-actions">
            <button type="button" className="chq-btn chq-btn-primary" disabled={submitting || !!recusal} onClick={() => void submitAndAdvance()}>
              Submit and next
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" disabled={saving || !!recusal} onClick={() => void saveOnly()}>
              Save draft
            </button>
            {/* DEC-873 (wave 27 amendment): a draft accepts partial scores --
                the caption sits beside the control that skips the checks, not
                a tooltip or a disabled-state guess. */}
            <span className="chq-review-draft-caption">Saving a draft skips these checks</span>
            {saved && (
              <span className="chq-review-saved-confirmation" role="status">
                Saved as a draft
              </span>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
