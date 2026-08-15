# task-w32-b — reviewer queue: hydrate emitted rows, not the scope @ 74c6377a

INVALIDATED BY: src/routes/review/reviewer.ts

Owned `src/routes/review/reviewer.ts`. Constrained by DEC-829 (wave-32
amendment). Closes the `reviewer queue` perf FAIL logged in
docs/verification-log/index/0180-2026-08-15-task-w29-e-review-perf-b7060152.md
(adjusted p95 69.7/66.6/76.1ms across three runs vs the 50ms `read` budget).

## Tree read

Confirmed main already carries the DEC-829 wave-29 `Promise.all` group at
`reviewer.ts` (task-w29-e, merged) and the reviewer-scoped
`countEvaluationsBySubmission` 4th param -- neither was re-added.

## The remaining defect

Three of the reads in that group were DISPLAY-ONLY yet ran over the whole
scoped id set: `listFormatLabelsBySubmission`, `listAudienceLevelLabelsBySubmission`,
and `listSpeakerIdentitiesForSubmissions`. Verified in code comments that
none of `needsMoreRatings`, `buildReviewerQueue`'s fewest-ratings-first
ordering, or `unscoredTotal` reads `format`/`audienceLevel`/`identities` --
only the emitted `items` rows and the `recusedOut` rows do.

## Change

Kept the population-wide reads that ordering and counting genuinely need
(`countEvaluationsBySubmission`, `listSubmissionIdsRatedBy`,
`listEvaluationScoresForReviewer`, `listRecusalsForReviewer`) in the
existing first `Promise.all`. Moved the three display readers into a
SECOND `Promise.all` issued AFTER `buildReviewerQueue` ordering and the
page slice, over exactly `pagedIds UNION recusedIds` (recused rows carry
format/audienceLevel per DEC-874 and redacted titles per DEC-018, so they
stay in the hydration set). `queueItems` is now built without
format/audienceLevel; the final `items` map hydrates from the second wave.
No read was hoisted above the `isPlanOpen` early return -- a closed plan
still issues exactly the queries it issued before. Envelope shape
(`shapeQueueEnvelope`'s keys, `total`/`unscoredTotal`, fewest-ratings-first
order, `maybeRedactTitle` for both actionable and recused rows, DEC-018
plan-window enforcement, `MAX_REVIEWER_SCOPE_ROWS`/`MAX_PLAN_SUBMISSION_SCAN`
refusal caps) is byte-identical -- proven by the full existing test suite
staying green plus a new targeted test.

## Tests (targeted only)

- `npx vitest related src/routes/review/reviewer.ts --run` -- 51 files /
  389 tests, PASS.
- `npx vitest run test/*review*.test.ts` (via `npx vitest run --root . review`,
  since the shell glob form finds no files under this project's vitest
  config) -- 80 files / 702 tests, PASS.
- Added `test/reviewer-queue-hydration-scope.test.ts`: an instrumented fake
  `Db` plus spies on the three display readers recording the id-array
  length they're called with -- proves the hydration wave is bounded by
  `perPage + recused.length` (3, for a 5-submission scope at `perPage=2`
  with 1 recusal) and NOT by the scope size (5); a second case proves an
  anonymized plan still redacts titles on both the actionable and recused
  halves.
- `npm run build` -- green (tsc x2 + vite build).
- `npx vitest run --root .` (full suite) -- 1070 files / 11822 tests, 1
  pre-existing unrelated FAIL (`test/verification-log-assemble.test.ts`,
  the assembled-file-is-stale check, expected before this entry file is
  added and the assembler re-run) -- resolved by this same commit's
  `docs/verification-log.md` regeneration.

## Measurement

`npm run db:migrate` (first-time DB had no tables) -> `npm run seed` ->
`npm run perf:seed` -> `npx wrangler dev --port 8902 --local` ->
`PERF_URL=http://localhost:8902 npm run perf:smoke`, three consecutive
runs (re-seeded with `npm run perf:seed` between each run, since run 1's
write checks mutate state that a later run's read-only `reviewer queue`
check doesn't depend on but the harness's own pending-submission
precondition does):

| check | run 1 | run 2 | run 3 | budget |
|---|---|---|---|---|
| reviewer queue | 48.7ms | 32.2ms | 38.9ms | 50ms |

All three runs PASS (was FAIL at 69.7/66.6/76.1ms adjusted p95 before this
task, per task-w29-e's log). Server killed after use
(`pkill -f "wrangler dev --port 8902"`).

Also observed, unowned by this task and unchanged by this task's commit:
`plan results (page 1)` remains a FAIL (72.9ms / 50.3ms / 57.3ms adjusted
across the same three runs) -- pre-existing per task-w29-e's log, DEC-440-
foreclosed from a SQL-aggregate rewrite, not this lane's scope.

RESULT: reviewer queue perf FAIL closed (byte-identical envelope, targeted
tests + full suite green). plan results FAIL remains open, out of scope.
