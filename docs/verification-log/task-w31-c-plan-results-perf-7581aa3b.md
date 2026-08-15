# task-w31-c: plan results (page 1) TIER-0 perf, DEC-338/DEC-347 wave-31 amendments

Tip: `7581aa3b`. Branch point: main `87c545f6` (worktree cut point, "scribe wave 31").
Prior receipt cited in the task: docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:74-75
(measured adjusted p95 71.8ms vs budget(read) 50ms). Wave-29 lane assigned to this item
produced zero commits (UNOWNED at main `dbac66d1`, per FINDINGS w31).

## DIAGNOSIS (instrumented, not guessed)

`buildResults` (src/routes/review/shared.ts:425-490) awaited five repo calls
sequentially. `listPlanFilteredSubmissions`, `listEvaluationScoresForPlan` and
`listRecusalsForPlan` are mutually independent (all keyed only by
plan/round); `listSpeakerNamesForSubmissions`/`listTrackNamesForSubmissions`
depend only on `submissionIds` and are independent of each other.

`EXPLAIN QUERY PLAN` on the evaluation read at perf-seed scale (plan
`seed_perf_plan_0001`, 6001 evaluation rows for that plan) showed, BEFORE
the fix, a `SEARCH evaluation USING INDEX evaluation_plan_id_idx (plan_id=?)`
-- round-filtering and the whole `ORDER BY submission_id, id` fell outside
the index (temp b-tree sort candidate). AFTER adding the composite index,
the same query plans as `SEARCH evaluation USING INDEX
evaluation_plan_id_round_submission_id_id_idx (plan_id=? AND round=?)`,
confirmed live against `.wrangler/state/v3/d1` with `wrangler d1 execute
... --local --command "EXPLAIN QUERY PLAN ..."`; `duration: 0-1ms` on that
statement both before and after (SQLite-side cost was never the dominant
term at this row count -- see MEASUREMENT below for why the endpoint's
wall-clock number did not confirm this cleanly).

## FIX

1. `src/routes/review/shared.ts`: two dependency-ordered `Promise.all`
   waves. Wave 1 -- `listPlanFilteredSubmissions`, `listEvaluationScoresForPlan`,
   `listRecusalsForPlan`. Wave 2 (needs `submissionIds` from wave 1) --
   `listSpeakerNamesForSubmissions`, `listTrackNamesForSubmissions`.
   `Promise.all` (never `allSettled`) so the first rejection still
   propagates its own `ApiError` unchanged. No row/order/number/envelope
   change -- verified byte-identical by
   `test/plan-results-aggregate-pin.test.ts`'s pin case and the pre-existing
   `test/review-results-*.test.ts` suite (all still green).
2. `migrations/0042_review_results_indexes.sql` (migration number
   pre-assigned to this lane by DEC-347's wave-31 amendment) +
   `src/db/schema/review.ts`: composite index
   `evaluation(plan_id, round, submission_id, id)` covering
   `listEvaluationScoresForPlan`'s WHERE and ORDER BY off the index.
3. Confined `evaluations.ts` edit to none -- the schema/migration change is
   the only touch to that table; `listEvaluationScoresForPlan`'s own
   function body (src/server/repo/review/evaluations.ts:66-99) is
   unmodified. No overlap with lane w31-b's declared functions.

Frozen per the task's hard boundary, confirmed unchanged by the pin test:
`aggregateSubmission`, `aggregateDropdownCriterion`, `computeWeightedScore`,
`buildResultsRows`' average-desc/count-desc ranking, `sortResultsRows`,
recusal counts, CSV column order/precision. No per-criterion averaging
pushed into SQL.

## TESTS

`npx vitest related src/routes/review/shared.ts --run` (which pulls in the
existing `test/review-results-*.test.ts`, `test/plan-*.test.ts` and every
other review-route test): **55 files / 448 tests, all green**, including
the two new tests in `test/plan-results-aggregate-pin.test.ts`:
(a) aggregate-pinning test (rating+dropdown criteria, a draft evaluation
excluded per DEC-873, a recused submission, a tie broken by count-desc) --
exact row-for-row match; (b) concurrency test with an instrumented fake
`Db` (lazily-memoized per-statement promise, delayed + in-flight-counted)
asserting `max in-flight > 1`.

## MEASUREMENT (DEC-347 wave-31 amendment, port 8896, one session)

`ensure-dev-vars` -> `.dev.vars` `PUBLIC_BASE_URL=http://localhost:8896` ->
`npm run build` -> `npm run db:migrate` -> `npm run seed` -> `npm run
perf:seed` -> `wrangler dev --port 8896` -> `PERF_URL=http://localhost:8896
npm run perf:smoke`.

BEFORE (main `87c545f6`, code stashed to branch point, migration NOT yet
applied): `plan results (page 1)` raw=74.1ms adjusted=68.7ms, budget
50ms, FAIL.

AFTER (this lane's tip `7581aa3b`, migration 0042 applied, `perf:seed`
re-run to restore the pending-submission population the BEFORE run's own
write checks consumed): two AFTER runs, both FAIL -- raw=92.9ms
adjusted=89.5ms, and a second run raw=75.4ms adjusted=72.7ms. Neither shows
an improvement over the BEFORE number; the second AFTER run (72.7ms) is
close to BEFORE (68.7ms) but still slightly worse.

RATIO: AFTER/BEFORE ~ 1.06x-1.30x across the two AFTER runs -- **inconclusive,
not a demonstrated improvement**, and reported as such rather than
massaged into a PASS.

CONFOUND, stated per DEC-347's wave-31 amendment: this machine had three
OTHER lanes' `wrangler dev` instances live and doing real work throughout
this measurement session (observed via `ps aux`: task-w29-b on :8892, the
main chautauqua checkout on :8799, and an unrelated agent sandbox job on
:8878/:9388) -- exactly the "N lanes each seeding + running wrangler dev +
30 iterations inflate every absolute by an unrecordable amount" scenario
DEC-347's wave-31 amendment names, in both directions: "a real fix can
read FAIL, and a machine that happens to be quiet can read PASS on
nothing." `EXPLAIN QUERY PLAN` (above) independently confirms the fix's
SQL-side mechanism is real and selected by the planner; the JS-side
`Promise.all` collapse is independently proven by the concurrency unit
test (max in-flight > 1). The DELTA this lane can honestly report is
noisy/flat rather than a clean win; per DEC-347 clause (5) the
AUTHORITATIVE absolute grade belongs to the serial verification wave's
single perf-smoke run at a tip containing every merged wave-31 lane.

`wrangler dev` killed after the final run (`pkill -f "wrangler dev --port
8896"`).

## OPEN ITEM

The wall-clock delta for this endpoint did not conclusively demonstrate
improvement on this run, under acknowledged sibling-load noise. The two
sanctioned mechanisms (waterfall collapse, covering index) are both
verified independently (EXPLAIN QUERY PLAN, concurrency unit test,
aggregate pin), but if the serial verification wave's clean-machine
absolute still shows `plan results (page 1)` over the 50ms read budget,
the next lever per the task's own ordering is (ii) narrowing what
`listEvaluationScoresForPlan` parses -- not available to spend further
effort on within this lane's scope.
