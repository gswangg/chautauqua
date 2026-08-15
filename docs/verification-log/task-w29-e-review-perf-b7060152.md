# task-w29-e — review-side TIER-0 perf (reviewer queue + plan results) @ b7060152

INVALIDATED BY: src/server/repo/review/**, src/routes/review/**

## Scope

Owned: `src/server/repo/review/**`, `src/routes/review/reviewer.ts`,
`src/routes/review/plans-progress.ts`. Constrained by DEC-829/DEC-773
(wave-29 amendments), bound as SHAPE per the delegated task.

## Tree read (confirming DEC-338 against the current tree, per instruction)

DEC-338's original text ("the J4 reviewer queue... loads every evaluation
in the plan to compute counts") is STALE against the current tree:
`countEvaluationsBySubmission` was already a SQL `GROUP BY` aggregate
(DEC-346 amendment, wave 22-e/46/66), not a whole-row materialization. The
live violation was narrower and different in kind: that aggregate's
driving relation was the plan's WHOLE round population (`WHERE planId=...
AND round=...`, no submission-id narrowing), not the reviewer's own
already-resolved scope (`resolveReviewerSubmissions`'s `scoped` set) — a
DEC-829-shaped violation ("driving relation is the already-scoped set,
never a wider table"), not the whole-row-materialization violation DEC-338
originally described.

For plan results, `buildResults` (src/routes/review/shared.ts) already
carries DEC-439/DEC-440's narrow-column read (`listEvaluationScoresForPlan`
selects only `submissionId, scoresJson`, no whole-event track scan).
DEC-440 explicitly and by name FORECLOSES pushing that aggregation into SQL
("the obvious 'fix'... I am ruling that out... a SQL rewrite would convert
a loud invariant into a quiet wrong number"). That decision is unamended
and binding, so no SQL-aggregate rewrite of `aggregateSubmission`/
`aggregateDropdownCriterion` was attempted here. The two chunked batch
reads results calls for every submission in the plan
(`listSpeakerNamesForSubmissions`, `listTrackNamesForSubmissions`) were,
however, issuing one sequential `await` per ~90-id `chunkIds` batch (~23
batches at the default profile's 2,000 submissions) — pure serialized
round-trip latency with no scan-shape justification.

## Changes

1. `src/server/repo/review/evaluations.ts` — `countEvaluationsBySubmission`
   gains an OPTIONAL 4th param `submissionIds?: string[]`. Omitted (every
   existing whole-plan caller, and the locked 2-arg contract in
   `test/review-repo-aggregates.test.ts`): behavior is byte-identical to
   before. Provided (the reviewer queue's only production caller): the
   `GROUP BY` narrows via chunked `inArray(...)`, batches run concurrently
   (`Promise.all`) — the driving relation becomes the reviewer's own scope.
2. `src/routes/review/reviewer.ts` — the queue route's `resolveReviewerSubmissions`
   result feeds the new scoped call, and the seven independent post-scope
   reads (counts / ratedByMe / myScores / format / audienceLevel /
   identities / recusals) run as one `Promise.all` instead of seven
   sequential awaits (none of them depend on each other's result).
3. `src/server/repo/review/submissions.ts` — `listSpeakerNamesForSubmissions`,
   `listTrackNamesForSubmissions`, `listFormatLabelsBySubmission`,
   `listAudienceLevelLabelsBySubmission`: each function's own `chunkIds`
   batches now run concurrently via `Promise.all` (disjoint id sets per
   batch, so cross-batch merge order is immaterial — no query changed, no
   row scanned that wasn't already scanned before).

JSON envelopes unchanged on both endpoints (hard contract). DEC-018 plan-
window enforcement, `MAX_REVIEWER_SCOPE_ROWS`/`MAX_PLAN_SUBMISSION_SCAN`
refusal caps, and DEC-345's `buildResults` ranking are all untouched.

## Tests (targeted only, never the full suite)

- `npx vitest related src/routes/review/reviewer.ts src/routes/review/plans-progress.ts src/server/repo/review/evaluations.ts src/server/repo/review/submissions.ts --run` — 246 files / 1873 tests, all PASS (run twice, once per edit round).
- `npx vitest run test/*review*.test.ts test/*plan*.test.ts test/*evaluation*.test.ts` — 74 files / 605 tests, all PASS.
- `npm run build` — green (tsc x2 + vite build).

## Measurement

`npm run db:migrate && npm run seed` (first-time DB had no tables — the
recipe's implicit migration-before-seed step, distinct from the w27-d gap
which was about `perf:seed` needing `seed` first) → `npm run perf:seed` →
`wrangler dev --port 8894` → `PERF_URL=http://localhost:8894 npm run
perf:smoke` (default profile only, per DEC-644/DEC-645 — aie profile
SKIPS these two checks by design). Server killed after use
(`pkill -f "wrangler dev --port 8894"`).

Baseline (docs/verification-log.md:3750-3754, tip `ceda66f2`, wave-27,
single sample):

| check | adjusted p95 | budget |
|---|---|---|
| reviewer queue | 85.4ms | 50ms |
| plan results (page 1) | 69.1ms | 50ms |

After this task's changes, at `b7060152` (three consecutive re-seeded
runs on the same local machine — run-to-run variance was noticeably high,
noted honestly rather than cherry-picked):

| check | run 1 | run 2 | run 3 | budget |
|---|---|---|---|---|
| reviewer queue | 69.7ms | 66.6ms | 76.1ms | 50ms |
| plan results (page 1) | 60.6ms | 74.8ms | 61.6ms | 50ms |

Both checks improved versus the wave-27 baseline (reviewer queue -9ms to
-19ms; plan results -8ms to +6ms across the noise band) but remain over
the 50ms `read` budget at this tip. FAIL persists on both — this is a
LOGGED PRODUCT FINDING, not a clean PASS, reported honestly per DEC-331's
"the lane does not optimise src/ [further] beyond what it measures and
fixes" posture: the two remaining safe, in-scope, DEC-440-compliant
optimizations available at this file boundary (reviewer-scoped counting,
concurrent chunked batches, concurrent independent reads) have been
applied; further reduction on `plan results` would require either
revisiting DEC-440's foreclosure of SQL aggregation for the evaluation-
scoring math (a decision, not this task's call to make) or reducing this
sandbox's background load, which this task cannot control.

Also observed as pre-existing, out-of-scope FAILs at this tip (unowned by
this task, unchanged by this task's commit): onboarding grid (~108-125ms
adj) and files library page 1 (~475-479ms adj) — both already tracked by
other wave-29 lanes' own DEC-773/DEC-829 amendments.
