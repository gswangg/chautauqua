## 2026-08-15 task-w32-a — plan results (page 1): rank the population, hydrate the page @ 904dd3d8

INVALIDATED BY: src/routes/review/shared.ts, src/routes/review/plans-progress.ts

Owned `src/routes/review/shared.ts` and `src/routes/review/plans-progress.ts`.
Closed the `plan results (page 1)` perf FAIL logged at
docs/verification-log/task-w29-e-review-perf-b7060152.md:92-95 (adj p95
60.6/74.8/61.6ms across three runs vs the 50ms read budget). Split the old
`buildResults` (DEC-829 w32 amendment) into `rankPlanResults` (issues
`listPlanFilteredSubmissions`/`listEvaluationScoresForPlan` as one
`Promise.all`, DEC-338; keeps DEC-440's JS aggregation verbatim; returns a
narrower `RankedResultsRow[]` — ref/title/count/average/perCriterion/
perDropdown/status/submissionId, everything `sortValueForColumn` can read)
and `hydrateResultsRows` (takes an already-sliced array, issues
`listSpeakerNamesForSubmissions`/`listTrackNamesForSubmissions`/
`listRecusalsForPlan` as one `Promise.all` over ONLY those rows' ids).
Rewired `GET /api/v1/plans/:id/results`: rank -> sort -> CSV branch
hydrates the FULL sorted array (byte-identical CSV semantics), JSON branch
slices the page first and hydrates only that slice. Also collapsed `GET
/api/v1/plans/:id/progress`'s four plan-scoped reads into one `Promise.all`
wave, then `getUsersByIds`/`getTrackNamesByIds` into a second wave, keeping
`batchUserDisplayNames` (depends on `users`) as a third — no envelope
change to either route.

TESTS: `npx vitest related src/routes/review/shared.ts
src/routes/review/plans-progress.ts` (56 files/450 tests) all PASS after
updating test/review-results-payload.test.ts's `buildResults` call sites to
`rankPlanResults`/`hydrateResultsRows`. Added
test/review-results-hydration-scope.test.ts: an instrumented repo mock
recording the id-array length each hydration reader receives — asserts the
JSON page path never hands hydration more than `perPage` ids and the CSV
path hands it every ranked row. `npm run build` green.

MEASURED (one session: `npm run seed` -> `npm run perf:seed` -> `npx
wrangler dev --port 8901 --local` -> `PERF_URL=... npm run perf:smoke`,
BEFORE run against this branch's diff stashed out (pre-change code), AFTER
run with the diff popped back in, same seeded D1 state, server killed after
each run): `plan results (page 1)` raw=69.8ms adjusted=67.1ms FAIL (BEFORE)
-> raw=44.8ms adjusted=39.0ms PASS (AFTER), under the 50ms read-class
budget. `reviewer queue` FAILs in both runs (out of this task's scope,
owned by a different lane; this task never touches
src/routes/review/reviewer.ts). Full detail:
docs/verification-log/task-w32-a-plan-results-perf-69e419ad.md.
RESULT: PASS (plan results, this task's scope) — reviewer queue's own FAIL
is unrelated and unowned by this lane.
