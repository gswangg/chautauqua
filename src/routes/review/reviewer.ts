// Review API (J4) reviewer-facing endpoints (/api/v1/review/*): reviewer OR
// organizer, inline check (DEC-018 — requireReviewer itself stays narrow).
// Extracted from the former monolithic src/routes/review.ts (see shared.ts
// for the parsing/authz helpers this sub-app depends on). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson } from "../../server/middleware";
import { ApiError, readJsonBody } from "../../server/http";
import { MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-425
import { overCapFieldMessage } from "../../domain/cap-copy";
import {
  buildReviewerQueue,
  needsMoreRatings,
  isPlanOpen,
  anonymizeForReviewer,
  redactIdentity,
  validateEvaluationScores,
  criteriaForRound,
  partitionRecused,
  computeWeightedScore,
  formatReviewerScopeLabel,
  roundMetaFor,
} from "../../domain/evaluation";
import { clampPage, listPerPage } from "../../lib/pagination";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import type { PlanRecord } from "../../server/repo/review";
import * as eventsRepo from "../../server/repo/events";
import { DEC_211, DEC_239, DEC_338, DEC_370, DEC_460, DEC_461, DEC_466, DEC_831, DEC_857, DEC_873 } from "../../decisions";
import { currentAuth, requireReviewerOrOrganizer, requireAssignedPlan } from "./shared";
import { lockedFieldName } from "../../forms/types";
import { settleInDeclarationOrder } from "../../lib/settle";

export const reviewReviewerRoutes = new Hono<AppEnv>();
void DEC_239; // /review/plans/:id/queue: shaped {submissionId,ref,title,ratingsCount,alreadyRatedByMe} below
void DEC_460; // enforced bound on every /api/v1 list envelope, no exemptions
void DEC_461; // optional repo page param + sibling count fn + deterministic ORDER BY below
void DEC_466; // /review/plans/:id/queue bounded below via the blessed JS-slice (DEC-461(e))
void DEC_831; // queue items carry myScore (this reviewer's own blended score) below
void DEC_857; // queue items carry format (session-shape fact, never stripped for anonymized plans) below
void DEC_873; // PUT evaluations: draft flag skips the completeness check and never stamps submittedAt, below
void DEC_338; // wave-61 amendment: round-trip-depth proven behaviourally on the instrumented harness, below
void DEC_370; // wave-61 amendment: independent validation reads join ONE wave, refusal order stays source order, below
void DEC_211; // wave-61 amendment: out-of-scope refusal names the reviewer's own queue inside an assigned plan, below

reviewReviewerRoutes.get("/api/v1/review/plans", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  let plans: PlanRecord[];
  let total: number;
  if (auth.role === "organizer") {
    const eventId = c.req.query("eventId");
    if (!eventId) throw new ApiError("invalid", "eventId query param is required");
    const event = await eventsRepo.getEventForOrg(c.var.db, eventId, auth.orgId);
    if (!event) throw new ApiError("not_found", "Event not found");
    [plans, total] = await Promise.all([
      repo.listPlansForEvent(c.var.db, event.id, { limit: perPage, offset: (page - 1) * perPage }),
      repo.countPlansForEvent(c.var.db, event.id),
    ]);
  } else {
    // DEC-461(e): the reviewer's plan set starts from an already-bounded
    // assigned-plan-id list (one row per plan the reviewer is on) -- the
    // blessed JS-slice exception applies. Sort deterministically by id,
    // clamp with a slice, but report the true count as `total`.
    const planIds = [...(await repo.listPlanIdsForReviewer(c.var.db, auth.userId))].sort();
    total = planIds.length;
    const pagedIds = planIds.slice((page - 1) * perPage, (page - 1) * perPage + perPage);
    // DEC-829 (wave-33 amendment, task w33-b): one chunked `inArray` batch
    // read replaces the former per-id Promise.all(getPlanById) fan-out.
    plans = await repo.listPlansByIds(c.var.db, pagedIds);
  }
  return c.json({ items: plans, total, page, perPage });
});

// DEC-819: the plan-scoped queue route (/review/plans/:id) needs the plan's
// own name to head the page -- mirrors /review/plans/:id/queue's
// requireAssignedPlan scoping (organizer via org, reviewer via assignment).
reviewReviewerRoutes.get("/api/v1/review/plans/:id", async (c) => {
  requireReviewerOrOrganizer(c);
  const plan = await requireAssignedPlan(c, c.req.param("id"));
  return c.json(plan);
});

reviewReviewerRoutes.get("/api/v1/review/plans/:id/queue", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("id"));
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));

  // Both branches below build through this single shaper so the closed-plan
  // early return and the open-plan result cannot diverge in shape -- the
  // Review landing reads `recused.length` unconditionally across all plans
  // (5th-cycle lockout regression, docs/eval-findings.md).
  // DEC-845: the envelope carries the plan's own facts (name/scope
  // track/close date) so the queue header renders from ONE fetch instead of
  // a second GET /review/plans/:id round trip -- resolved here so both the
  // closed-plan early return and the open-plan result share the same values.
  // DEC-338 (wave-31 amendment): a read route's independent repo calls issue
  // as ONE Promise.all wave -- the server-side twin of SPEC §7's "one round
  // trip per view". Wave 1 below holds every call that depends only on
  // `plan`/`auth` (never on `scoped`'s resolved id set): the scope-track
  // chain's first link, resolveReviewerSubmissions, and the three
  // plan+round-only evaluation/recusal reads that used to run strictly
  // after it for no reason. getTrackNamesByIds is a REAL dependency on
  // scopeTrackIds's result, so it stays a second, sequential call -- never
  // folded into this wave. countEvaluationsBySubmission is likewise a REAL
  // dependency on `scoped` since the DEC-829 amendment below, so it rides
  // wave 2, not this one. Promise.all (never allSettled): the first
  // rejection must still propagate the identical ApiError.
  const [scopeTrackIds, scoped, ratedByMe, myScoresBySubmission, recusals] = await Promise.all([
    auth.role === "organizer" ? Promise.resolve<string[]>([]) : repo.getReviewerScopeTrackIds(c.var.db, plan.id, auth.userId),
    repo.resolveReviewerSubmissions(c.var.db, plan, auth.userId),
    repo.listSubmissionIdsRatedBy(c.var.db, plan.id, plan.currentRound, auth.userId),
    // DEC-831: this reviewer's own scores for the queue's `myScore` column,
    // read alongside listSubmissionIdsRatedBy rather than a second pass.
    repo.listEvaluationScoresForReviewer(c.var.db, plan.id, plan.currentRound, auth.userId),
    repo.listRecusalsForReviewer(c.var.db, plan.id, auth.userId),
  ]);
  const scopeTrackNames = [...(await repo.getTrackNamesByIds(c.var.db, scopeTrackIds)).values()];
  const scopeTrackName = auth.role === "organizer" ? null : formatReviewerScopeLabel(scopeTrackNames);

  const shapeQueueEnvelope = (fields: {
    items: unknown[];
    total: number;
    unscoredTotal: number;
    open: boolean;
    recused: unknown[];
    viewerIsOrganizer: boolean;
    cappedOut: number;
  }) =>
    c.json({
      items: fields.items,
      total: fields.total,
      // DEC-845 amendment (wave 38): the FULL unscored count, computed from
      // the whole items array BEFORE the page slice below -- a track scope
      // above MAX_PER_PAGE=200 rows must still report a true "N left to
      // score" even though only one page of rows is on the wire.
      unscoredTotal: fields.unscoredTotal,
      page,
      perPage,
      open: fields.open,
      // DEC-018 (wave-58 amendment): server-set from auth.role, threaded
      // through this single shaper so the closed-plan early return below and
      // the full-queue result at the bottom of the route cannot disagree on
      // who is viewing -- the SPA must never infer this from row presence
      // (a closed plan with zero submissions would fool that).
      viewerIsOrganizer: fields.viewerIsOrganizer,
      // DEC-346 (wave-74 amendment): the count of this reviewer's own scoped
      // submissions the cap filter below (:242, needsMoreRatings) removed
      // from `items` -- so an empty/short queue can say WHY instead of
      // reading like a broken assignment. A subtraction of two arrays
      // already in memory (scopedActionable.length - queueItems.length),
      // never a new query.
      cappedOut: fields.cappedOut,
      recused: fields.recused,
      planName: plan.name,
      scopeTrackName,
      closeDate: plan.closeDate,
      // DEC-147 amendment (wave 8, task w8-c): the ACTIVE round's own
      // resolved name/window, so the queue head can print it via roundLabel
      // instead of a bare "round N" -- resolved server-side, never
      // re-derived client-side from a raw overrides map.
      rounds: plan.rounds,
      currentRound: plan.currentRound,
      roundMeta: roundMetaFor(plan, plan.roundMeta, plan.currentRound),
    });

  // DEC-018 (wave-58 amendment): mirrors the plan-detail route's exemption at
  // :333 below ("Organizers are exempt (same as the queue)") -- the two must
  // admit the same viewers, or a producer opening a closed plan gets zero
  // queue rows while the per-submission detail behind them still loads.
  const planOpen = isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone);
  if (auth.role !== "organizer" && !planOpen) {
    return shapeQueueEnvelope({
      items: [],
      total: 0,
      unscoredTotal: 0,
      open: false,
      recused: [],
      viewerIsOrganizer: false,
      cappedOut: 0,
    });
  }

  const scopedIds = scoped.map((s) => s.id);
  // DEC-338 (wave-31 amendment): wave 2 -- the id-scoped batches this wave
  // still holds are exactly the ones ordering/counting genuinely need over
  // the WHOLE scope: countEvaluationsBySubmission drives needsMoreRatings'
  // cap check and ratingsCount for every scoped row, so it can't be deferred
  // to the post-slice hydration wave below.
  // DEC-829 (wave-32 amendment, task w32-b): format/audienceLevel/identities
  // are display-only -- verified below that none of needsMoreRatings,
  // buildReviewerQueue, or unscoredTotal reads any of the three. They used
  // to ride this wave over the full scoped id set (every submission in the
  // reviewer's scope, which can run into the thousands); now they're fetched
  // in a SECOND Promise.all, issued after ordering + the page slice, over
  // only `pagedIds UNION recusedIds` -- the rows actually emitted on the
  // wire. This is the fix for the reviewer-queue perf FAIL (adj p95 ~70ms vs
  // a 50ms read budget): the display batches no longer scale with scope
  // size, only with perPage + recused.length.
  // DEC-082/DEC-346/DEC-439/DEC-829 (wave-29 amendment, task w29-e): queue
  // counts/marks only the plan's current round -- earlier rounds'
  // evaluations don't count toward this round's cap or "already rated"
  // state. SQL aggregates replace the whole-round evaluation load + JS
  // reduce, and the GROUP BY is itself scoped to THIS reviewer's own
  // already-resolved submission ids (`scopedIds`, from wave 1's
  // resolveReviewerSubmissions) rather than the plan's whole population --
  // the driving relation is the reviewer's own scope, never a wider table
  // (DEC-829's ruling, applied here). A reviewer scoped to one track of a
  // large plan no longer pays for every OTHER reviewer's/track's
  // evaluations to compute their own counts. That id dependency is exactly
  // why this call rides wave 2 and not wave 1. It's the only read left in
  // this wave now that format/audienceLevel/identities have moved to the
  // post-slice hydration wave below, so it no longer needs a Promise.all
  // wrapper of its own.
  const countsBySubmission = await repo.countEvaluationsBySubmission(c.var.db, plan.id, plan.currentRound, scopedIds);
  // DEC-147: blend through the round's resolved criteria, restricted to
  // 'rating' criteria -- computeWeightedScore (src/domain/evaluation.ts) is
  // the single blended-score formula; a plan with no rating criteria has
  // nothing to blend (mirrors aggregateSubmission's DEC-212 short-circuit).
  const ratingCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound).filter(
    (crit): crit is typeof crit & { kind: "rating"; weight: number } => crit.kind === "rating",
  );
  const myScoreFor = (submissionId: string): number | null => {
    const scores = myScoresBySubmission.get(submissionId);
    if (!scores || ratingCriteria.length === 0) return null;
    return computeWeightedScore(scores as Record<string, number>, ratingCriteria, plan.scale);
  };

  // DEC-271: recused submissions are dropped from the actionable queue and
  // surfaced separately in the `recused` envelope key instead. partitionRecused
  // (pure core, src/domain/evaluation.ts) does the set split; this route just
  // shapes the two output lists. `recusals` was already loaded in wave 1's
  // Promise.all above.
  const recusalBySubmission = new Map(recusals.map((r) => [r.submissionId, r]));
  const { kept: scopedActionable, recused: recusedScoped } = partitionRecused(
    scoped.map((s) => ({ ...s, submissionId: s.id })),
    new Set(recusals.map((r) => r.submissionId)),
  );

  // DEC-829 (wave-32 amendment): queueItems is built WITHOUT format/
  // audienceLevel -- neither needsMoreRatings nor buildReviewerQueue's
  // fewest-ratings-first ordering reads either field, so they're deferred to
  // the hydration wave below, after ordering and the page slice have fixed
  // exactly which rows are on the wire.
  const queueItems = scopedActionable
    .map((s) => ({
      submissionId: s.id,
      ratingsCount: countsBySubmission.get(s.id) ?? 0,
      alreadyRatedByMe: ratedByMe.has(s.id),
      myScore: myScoreFor(s.id),
    }))
    .filter((item) => item.alreadyRatedByMe || needsMoreRatings(item, plan.maxEvaluations ?? undefined));

  const ordered = buildReviewerQueue(queueItems);
  const byId = new Map(scopedActionable.map((s) => [s.id, s]));

  // DEC-466/DEC-461(e): blessed JS-slice -- ordered is already assembled from
  // a materialized array (buildReviewerQueue's fewest-ratings-first order),
  // so clamp with a slice and report the FULL array length as `total`, not
  // the slice's.
  const total = ordered.length;
  // DEC-845 amendment (wave 38): unscoredTotal is computed from the FULL
  // ordered array, before the slice below -- it must stay true past row 200.
  const unscoredTotal = ordered.filter((item) => !ratedByMe.has(item.submissionId)).length;
  const start = (page - 1) * perPage;
  const pagedOrdered = ordered.slice(start, start + perPage);

  // DEC-829 (wave-32 amendment, task w32-b): hydration wave -- issued AFTER
  // ordering + the page slice, over exactly the ids that will actually be
  // emitted: the page's own rows plus the recused rows (recused rows carry
  // format/audienceLevel per DEC-874 and redacted titles per DEC-018, so they
  // must be in the hydration set too). No longer scales with the reviewer's
  // whole scope -- bounded by perPage + recused.length.
  const pagedIds = pagedOrdered.map((item) => item.submissionId);
  const recusedIds = recusedScoped.map((s) => s.id);
  const hydrateIds = [...new Set([...pagedIds, ...recusedIds])];
  const [formatBySubmission, audienceLevelBySubmission, identitiesBySubmission] = await Promise.all([
    // DEC-857: the queue row's own format meta -- batched over the emitted
    // ids only, chunked exactly like loadDurationMinBySubmission
    // (src/server/repo/agenda.ts:316-330). Not stripped for an anonymized
    // plan: format is a session-shape fact, not identity.
    repo.listFormatLabelsBySubmission(c.var.db, hydrateIds),
    // DEC-857/DEC-986: the queue row's audience-level meta -- same batching as
    // formatBySubmission above, over the same emitted id set. A session-shape
    // fact (the field lives on the CFP's session section), so it is never
    // stripped for an anonymized plan, exactly like format.
    repo.listAudienceLevelLabelsBySubmission(c.var.db, hydrateIds),
    // DEC-018 (wave-57 amendment): the queue's own title field leaks speaker
    // identity the same way the submission detail's title/description do
    // (line ~318 below) -- loaded once for the emitted id set, alongside the
    // batches above, and used to mask both the actionable items' titles and
    // the recusedOut rows' titles when the plan is anonymized.
    // listSpeakerIdentitiesForSubmissions carries NO inviteStatus filter, so
    // it is a superset of the display-scoped speaker lists used elsewhere on
    // this route.
    plan.anonymized
      ? repo.listSpeakerIdentitiesForSubmissions(c.var.db, hydrateIds)
      : Promise.resolve(new Map<string, repo.SpeakerIdentity[]>()),
  ]);
  const identitiesFor = (submissionId: string): string[] =>
    (identitiesBySubmission.get(submissionId) ?? []).flatMap((s) =>
      [s.name, s.email, s.company].filter((v): v is string => !!v && v.trim().length > 0),
    );
  const maybeRedactTitle = (submissionId: string, title: string): string =>
    plan.anonymized ? (redactIdentity(title, identitiesFor(submissionId)) as string) : title;

  // DEC-874 (wave 72 amendment): a recused row keeps the same meta line an
  // actionable row shows -- formatBySubmission is now hydrated over
  // `hydrateIds`, which includes every recused id, so carrying it onto the
  // recused half still costs no extra query. A projection must carry its
  // source's vocabulary.
  const recusedOut = recusedScoped.map((s) => ({
    submissionId: s.id,
    ref: s.ref,
    title: maybeRedactTitle(s.id, s.title),
    reason: recusalBySubmission.get(s.id)?.reason ?? null,
    format: formatBySubmission.get(s.id) ?? null,
    audienceLevel: audienceLevelBySubmission.get(s.id) ?? null,
  }));

  // DEC-239/DEC-831/DEC-845/DEC-857: the SPA reads submissionId/ref/title/
  // ratingsCount/alreadyRatedByMe/myScore/format by exact key -- emit the
  // shaped item, not the raw SubmissionSummary row (which has `id`, not
  // `submissionId`); myScore comes straight off buildReviewerQueue's own
  // ordered item, not a second lookup.
  const pagedItems = pagedOrdered
    .map(({ submissionId: id, myScore }) => {
      const summary = byId.get(id);
      if (!summary) return undefined;
      return {
        submissionId: summary.id,
        ref: summary.ref,
        title: maybeRedactTitle(id, summary.title),
        ratingsCount: countsBySubmission.get(id) ?? 0,
        alreadyRatedByMe: ratedByMe.has(id),
        myScore,
        format: formatBySubmission.get(id) ?? null,
        audienceLevel: audienceLevelBySubmission.get(id) ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  return shapeQueueEnvelope({
    items: pagedItems,
    total,
    unscoredTotal,
    open: planOpen,
    recused: recusedOut,
    viewerIsOrganizer: auth.role === "organizer",
    // DEC-346 (wave-74 amendment): scopedActionable is this reviewer's whole
    // scope minus their own recusals (partitionRecused above); queueItems is
    // the same set after the cap filter. The difference is exactly the rows
    // the cap removed -- both arrays already resolved above, no new query.
    cappedOut: scopedActionable.length - queueItems.length,
  });
});

reviewReviewerRoutes.get("/api/v1/review/submissions/:id", async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const submissionId = c.req.param("id");
  const planId = c.req.query("planId");
  if (!planId) throw new ApiError("invalid", "planId query param is required");
  const plan = await requireAssignedPlan(c, planId);

  // DEC-018 (wave-10 amendment, matched by wave-58 amendment at :154 above):
  // the review-plan window that already gates the queue and the score PUT
  // must also gate a lone submission read -- a closed (or not-yet-open) plan
  // means a reviewer can't see scope-checked detail either. Organizers are
  // exempt (same predicate as the queue's early-return above). Checked
  // before the scope lookup so a closed plan never does scope work.
  if (auth.role !== "organizer" && !isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone)) {
    throw new ApiError("conflict", "This review plan is not currently open");
  }

  // DEC-370 (wave-61 amendment): the eight reads below are independent of
  // each other (none consumes another's result -- inScope/summary/answers/
  // speakers/format/audienceLevel/myEvaluation/myRecusal are each keyed only
  // off plan/auth/submissionId, already known before any of them run), so
  // they issue as ONE settleInDeclarationOrder wave instead of eight
  // sequential awaits. The organizer branch skips isSubmissionInReviewerScope
  // (organizers have no scope to be out of) by resolving a `true` promise in
  // its place, so the wave's shape never changes with role. Refusals are then
  // evaluated in the SAME source order as before the wave: scope-miss first,
  // summary-null second.
  const [inScope, summary, rawAnswers, speakers, formatBySubmission, audienceLevelBySubmission, myEvaluationRecord, myRecusalRecord] =
    await settleInDeclarationOrder<
      [
        boolean,
        repo.SubmissionSummary | null,
        repo.SubmissionAnswerRow[],
        repo.SpeakerSummary[],
        Map<string, string | null>,
        Map<string, string | null>,
        Awaited<ReturnType<typeof repo.getEvaluation>>,
        Awaited<ReturnType<typeof repo.hasRecusal>>,
      ]
    >([
      auth.role === "organizer" ? Promise.resolve(true) : repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId),
      repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId),
      repo.listAnswersForSubmission(c.var.db, submissionId),
      repo.listSpeakersForSubmission(c.var.db, submissionId),
      // frame 03--01: the scorecard head's meta line needs the same role-keyed
      // (session_format) reading the queue row already carries (DEC-857)
      // -- reuse listFormatLabelsBySubmission (single-id call) rather than a
      // second lookup. audienceLevel is wired the same way (single-id call to
      // listAudienceLevelLabelsBySubmission) and, like format, is NOT stripped
      // for an anonymized plan: a session-shape fact is not identity.
      repo.listFormatLabelsBySubmission(c.var.db, [submissionId]),
      repo.listAudienceLevelLabelsBySubmission(c.var.db, [submissionId]),
      // DEC-561: this reviewer's own stored evaluation for the plan's ACTIVE
      // round, omitted entirely (property absent, not null) when there's no
      // row yet -- lets a reviewer reopen/revise a submitted review.
      repo.getEvaluation(c.var.db, plan.id, submissionId, auth.userId, plan.currentRound),
      // DEC-984: this reviewer's own recusal (if any) for THIS submission --
      // must survive a reload, not just live in client state after a POST.
      // Property absent (not null) when there's no recusal, matching
      // myEvaluation's convention (DEC-561). Never another reviewer's
      // recusal, never a list.
      repo.hasRecusal(c.var.db, plan.id, submissionId, auth.userId),
    ]);

  // DEC-211 (wave-61 amendment): an out-of-scope submission is refused with a
  // sentence naming what actually happened -- an assigned reviewer who is
  // already inside this plan (requireAssignedPlan passed) can already infer
  // the event and its queue size, so hiding existence here buys nothing; the
  // status code stays 'not_found'/404, only the sentence changes.
  if (auth.role !== "organizer" && !inScope) throw new ApiError("not_found", "That submission is not in your review queue.");
  if (!summary) throw new ApiError("not_found", "Submission not found");

  // DEC-908/DEC-016: locked built-ins (title, description, first_name,
  // email, ...) already surface through their own SubmissionDetail columns
  // (summary fields above / speakers) -- they must never also ride along in
  // the generic answers list, or the scorecard double-renders them (and, on
  // a non-anonymized plan, leaks raw speaker PII through a reading column
  // that isn't supposed to carry it). Filter BEFORE the speaker/session
  // split so neither branch can reintroduce a locked key.
  const answers = rawAnswers.filter((a) => lockedFieldName(a.fieldId) === null);
  const format = formatBySubmission.get(submissionId) ?? null;
  const audienceLevel = audienceLevelBySubmission.get(submissionId) ?? null;

  // DEC-147: the criteria embedded on the submission detail are resolved for
  // the plan's ACTIVE round -- the reviewer's scorecard renders these, not
  // plan.criteria, so a round override actually takes effect client-side.
  const criteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound);

  const detail = {
    ...summary,
    // DEC-561/DEC-562: strip `email` before this leaves the server -- it is
    // fetched on SpeakerSummary purely so the anonymization identity list
    // below can be built without a second query.
    speakers: speakers.map(({ email: _email, ...s }) => s) as Omit<repo.SpeakerSummary, "email">[] | undefined,
    speakerAnswers: answers.filter((a) => a.section === "speaker") as repo.SubmissionAnswerRow[] | undefined,
    sessionAnswers: answers.filter((a) => a.section === "session"),
    criteria,
    format,
    audienceLevel,
    ...(myEvaluationRecord ? { myEvaluation: { scores: myEvaluationRecord.scores, comment: myEvaluationRecord.comment } } : {}),
    ...(myRecusalRecord ? { myRecusal: { reason: myRecusalRecord.reason ?? null, createdAt: myRecusalRecord.createdAt } } : {}),
  };

  // DEC-018 (wave-54 amendment): server-side anonymization only, never
  // client-side, and never a bare identity STRING left behind in free text
  // (title/description/sessionAnswers) -- built from the FULL name, email,
  // and company of every speaker already loaded above, never a bare first
  // or last name (that would mask ordinary words too aggressively).
  const identities = speakers.flatMap((s) => [s.name, s.email, s.company].filter((v): v is string => !!v && v.trim().length > 0));
  const out = plan.anonymized ? anonymizeForReviewer(detail, identities) : detail;
  return c.json(out);
});

reviewReviewerRoutes.put("/api/v1/review/plans/:planId/evaluations/:submissionId", csrfJson, async (c) => {
  requireReviewerOrOrganizer(c);
  const auth = currentAuth(c);
  const plan = await requireAssignedPlan(c, c.req.param("planId"));
  const submissionId = c.req.param("submissionId");

  // DEC-370 (wave-61 amendment): these four validation reads are all
  // available up front (none depends on another's result) so they issue as
  // ONE settleInDeclarationOrder wave. The organizer branch skips
  // isSubmissionInReviewerScope with a resolved `true`, same shape trick as
  // the GET route above. Refusals below are still evaluated in TODAY's exact
  // source order (inEvent 404 -> plan-open 409 -> scope 404 -> recusal 409 ->
  // body validation -> draft-vs-submitted 400): plan-open is a synchronous
  // check (isPlanOpen/Date.now(), no repo read) so it slots in unchanged
  // between the wave's first and third refusal checks.
  const round = plan.currentRound;
  const [inEvent, inScope, recusal, existing] = await settleInDeclarationOrder<
    [
      repo.SubmissionSummary | null,
      boolean,
      Awaited<ReturnType<typeof repo.hasRecusal>>,
      Awaited<ReturnType<typeof repo.getEvaluation>>,
    ]
  >([
    // DEC-211: existence-hiding 404 for a submission outside the plan's
    // event, enforced for EVERY role (organizer included) before any other
    // checks.
    repo.getSubmissionSummaryInEvent(c.var.db, submissionId, plan.eventId),
    auth.role === "organizer" ? Promise.resolve(true) : repo.isSubmissionInReviewerScope(c.var.db, plan, auth.userId, submissionId),
    // DEC-271: a reviewer who has recused themselves cannot score the
    // submission through this endpoint.
    repo.hasRecusal(c.var.db, plan.id, submissionId, auth.userId),
    repo.getEvaluation(c.var.db, plan.id, submissionId, auth.userId, round),
  ]);

  if (!inEvent) throw new ApiError("not_found", "Submission not found");

  if (!isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone)) {
    throw new ApiError("conflict", "This review plan is not currently open");
  }

  // DEC-211 (wave-61 amendment): named refusal for an assigned reviewer who
  // is out of scope inside their own plan -- see the GET route above.
  if (auth.role !== "organizer" && !inScope) throw new ApiError("not_found", "That submission is not in your review queue.");

  if (recusal) {
    throw new ApiError("conflict", "You have recused yourself from this submission");
  }

  const body = await readJsonBody(c);
  const scores = body.scores;
  if (typeof scores !== "object" || scores === null) {
    throw new ApiError("invalid", "scores is required", { scores: "required" });
  }
  // DEC-873 (wave 27 amendment): draft defaults false -- absent means
  // today's full-submit behaviour, unchanged.
  const draft = body.draft === true;

  // DEC-873 (wave 27 amendment): a draft PUT against a row that is already
  // submitted is a loud 400 -- never a silent un-submit.
  if (draft && existing && existing.submittedAt !== null) {
    throw new ApiError("invalid", "This evaluation has been submitted");
  }

  if (!existing) {
    const ratingsCount = await repo.countEvaluationsForSubmission(c.var.db, plan.id, submissionId, round);
    if (!needsMoreRatings({ ratingsCount }, plan.maxEvaluations ?? undefined)) {
      // DEC-346 (wave-74 amendment): same words the queue's own empty/short
      // state uses for this reason ("full set of reviews") -- a reviewer who
      // deep-links a capped-out submission and one who reads their queue
      // hear the identical sentence.
      throw new ApiError("conflict", "This submission already has its full set of reviews");
    }
  }

  // DEC-147: validate against THIS round's resolved criteria, not the base
  // plan.criteria -- a round override changes what's a valid submission.
  // DEC-873 (wave 27 amendment): a draft skips the completeness check
  // (missing criteria are allowed) but every PRESENT value is still
  // validated exactly as a full submit would.
  const roundCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), round);
  const result = validateEvaluationScores(scores as Record<string, unknown>, roundCriteria, plan.scale, {
    partial: draft,
  });
  if (!result.ok) {
    throw new ApiError("invalid", "Invalid scores", result.errors);
  }

  // DEC-425: cap the comment free-text field.
  if (typeof body.comment === "string" && body.comment.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", "Invalid comment", { comment: overCapFieldMessage(body.comment.length, MAX_LONG_TEXT_LENGTH) });
  }

  const saved = await repo.upsertEvaluation(c.var.db, {
    planId: plan.id,
    submissionId,
    reviewerId: auth.userId,
    round,
    scores: scores as Record<string, number | string>,
    comment: typeof body.comment === "string" ? body.comment : null,
    draft,
  });
  return c.json(saved);
});
