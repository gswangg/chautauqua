# task-w31-b: reviewer queue TIER-0 perf (DEC-338/DEC-347 wave-31 amendments)

QUALIFYING
INVALIDATED BY: src/routes/review/reviewer.ts, src/server/repo/review/**, migrations/**

Boundary: `66123630` (branch `task-w31-b`, off `main` `87c545f6`).

## Defect (before)

`GET /api/v1/review/plans/:id/queue` awaited eleven repo calls strictly
in sequence (`src/routes/review/reviewer.ts:99-215` at the branch
point): `getReviewerScopeTrackIds` -> `getTrackNamesByIds`,
`resolveReviewerSubmissions` (itself 3 statements),
`countEvaluationsBySubmission`, `listSubmissionIdsRatedBy`,
`listEvaluationScoresForReviewer`, `listFormatLabelsBySubmission`,
`listAudienceLevelLabelsBySubmission`, `listSpeakerIdentitiesForSubmissions`,
`listRecusalsForReviewer`. Measured adjusted p95 66.8ms
(docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:69-70), re-confirmed
78.0ms in this lane's own BEFORE run below and 56.8ms in the wave-29
onboarding lane's incidental re-run
(docs/verification-log/task-w29-a-onboarding-perf-1d274c8b.md:64-72) — over
a 50ms `read` budget every time it has been measured, at a D1 round-trip
cost of a few ms each per DEC-338's own diagnosis.

## Fix

Collapsed the handler into two dependency-ordered `Promise.all` waves per
DEC-338's wave-31 amendment:

- **Wave 1** (depends only on `plan`/`auth`): the scope-track chain's first
  link (`getReviewerScopeTrackIds`, skipped via a resolved `[]` for an
  organizer), `resolveReviewerSubmissions`, `countEvaluationsBySubmission`,
  `listSubmissionIdsRatedBy`, `listEvaluationScoresForReviewer`,
  `listRecusalsForReviewer`. `getTrackNamesByIds` stays a second, genuinely
  sequential call — it is a real dependency on wave 1's resolved
  `scopeTrackIds`.
- **Wave 2** (depends on wave 1's resolved `scoped` id set):
  `listFormatLabelsBySubmission`, `listAudienceLevelLabelsBySubmission`,
  `listSpeakerIdentitiesForSubmissions` (resolved to an empty map inline,
  never queried, for a non-anonymized plan).

`Promise.all` throughout (never `allSettled`) — the first rejection still
propagates the identical `ApiError`, no per-call catch. The response
envelope (`shapeQueueEnvelope`), `buildReviewerQueue`'s fewest-ratings-first
order, `total`, `unscoredTotal` (computed before the page slice), and the
`recused` list are unchanged — no aggregate's arithmetic was touched, and
the closed-plan early return still returns before any wave-2 batch would
run (wave 1 now runs unconditionally before the `isPlanOpen` check, per
DEC-338's explicit "Wave 1: the plan-only reads plus
resolveReviewerSubmissions plus the scope-track chain" instruction — this
adds one now-unconditional `resolveReviewerSubmissions`/evaluation-batch
round trip on the closed-plan path that the pre-fix code skipped, but the
envelope on that path is unaffected since none of wave 1's results are read
before the early return).

Also adds `migrations/0041_evaluation_plan_round_submission_idx.sql`
(migration number 0041 pre-assigned to this lane by DEC-347's wave-31
amendment) plus the matching `index(...)` entry in
`src/db/schema/review.ts`: a composite index on
`evaluation(plan_id, round, submission_id, id)`. The four plan+round reads
in `src/server/repo/review/evaluations.ts`
(`countEvaluationsBySubmission`, `listSubmissionIdsRatedBy`,
`listEvaluationScoresForReviewer`, plus the ordered
`listEvaluationScoresForPlan`/`listEvaluatedPairsForPlan` scans) filter
`WHERE (plan_id, round)` and order by `(submission_id, id)`; the
pre-existing `evaluation_plan_id_idx` covers `plan_id` alone. No aggregate's
arithmetic changed.

DECLARED OVERLAP: this lane's only edit to
`src/server/repo/review/evaluations.ts`-adjacent surface is the schema
index entry in `src/db/schema/review.ts` (additive, does not touch any
column lane w31-c's `listEvaluationScoresForPlan` reads). No edits were made
to `src/server/repo/review/evaluations.ts` itself.

Unchanged (verified by the pre-existing `test/review-queue-*.test.ts` suite
plus `test/review-queue-roundtrips.test.ts`'s constant-round-trip-count
regression coverage, all green): the queue's wire shape, ordering,
anonymization redaction, totals-past-200 behavior, and closed-plan
`recused: []` envelope.

`test/reviewer-queue-round-trip-depth.test.ts` (new) proves concurrency
BEHAVIOURALLY: an instrumented fake `Db` whose every query resolves only
after an artificial delay, recording the maximum number of simultaneously
in-flight statements, asserts `max > 1` against the REAL (unmocked) repo
functions running through the actual route handler — not a source grep for
`Promise.all`. A second assertion in the same file pins the queue JSON
envelope byte-for-byte.

## Measurement (before/after, one uninterrupted session, DEC-347 wave-31 amendment)

Runbook: `ensure-dev-vars` (`.dev.vars` `PUBLIC_BASE_URL=http://localhost:8895`,
port reserved to this lane) -> `vite build --config app/vite.config.ts` ->
`db:migrate` -> `npm run seed` (required before `perf:seed`) -> `npm run
perf:seed` -> `wrangler dev --port 8895` -> `PERF_URL=http://localhost:8895
npm run perf:smoke`, server killed after each run.

- **BEFORE** (`git stash -u` back to branch point `87c545f6`, migrations
  0001-0039 applied, no 0041): `reviewer queue` raw 81.0ms -> adjusted p95
  **78.0ms** — FAIL (exceeds 50ms `read` budget).
- **AFTER** (`git stash pop`, this lane's tip `66123630`, migration 0041
  applied, full reseed + perf-seed re-run before measuring): `reviewer
  queue` raw 58.8ms -> adjusted p95 **56.3ms** — still FAIL, but a **28%
  reduction** (ratio 56.3/78.0 = 0.72).

Per DEC-347's wave-31 amendment, this lane's grade is the DELTA (a real,
repeatable ~22ms / 28% reduction in one uninterrupted before/after session
on one machine state), not the absolute — sibling wave-31 lanes' own
`wrangler dev` + seed + measurement sessions on the same machine are an
unrecordable source of inflation on any bare absolute taken during a
parallel wave. The authoritative ABSOLUTE grade for `reviewer queue` is the
serial verification wave's single perf-smoke run at a tip containing every
merged wave-31 lane, not this receipt.

The 50ms budget was not closed by this fix alone at this session's absolute
scale — this is recorded as a logged finding, not silently claimed as a
PASS: `reviewer queue` remains over budget (adjusted p95 56.3ms vs 50ms)
after collapsing to 2 concurrent waves plus the composite index, at this
lane's own noisy-machine measurement. Nothing in DEC-338's ruling requires
the check to reach PASS — the ruling requires the scheduling change and the
byte-identical envelope, both delivered. A further reduction (e.g. batching
`resolveReviewerSubmissions`'s 3 internal statements, or the scope-track
chain's `getTrackNamesByIds` sequential dependency) is out of this lane's
declared scope (DEC-338's ruling: "a fix that changes an aggregate's
arithmetic is out of scope for this rule" — batching those would require
touching resolveReviewerSubmissions's own internal sequencing, not named in
this task's REQUIRED FIX).

Full default-profile AFTER run: 33 checks, 2 pre-existing FAILs outside this
lane's scope (`files library (page 1)` adjusted 470.1ms — owned by a
different lane per the field guide's DEC-773 entry; `plan results (page
1)` adjusted 80.2ms — owned by lane w31-c). Overall script exit code
non-zero, driven by those 2 unrelated FAILs plus this lane's own
still-over-budget `reviewer queue` row.
