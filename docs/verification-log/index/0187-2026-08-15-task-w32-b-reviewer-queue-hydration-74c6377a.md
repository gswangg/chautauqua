## 2026-08-15 task-w32-b — reviewer queue: hydrate emitted rows, not the scope @ 74c6377a [QUALIFYING]

Owned `src/routes/review/reviewer.ts`. Constrained by DEC-829 (wave-32
amendment). Closed the `reviewer queue` perf FAIL logged in
docs/verification-log/index/0180-2026-08-15-task-w29-e-review-perf-b7060152.md
(adjusted p95 69.7/66.6/76.1ms across three runs vs the 50ms `read`
budget) — `listFormatLabelsBySubmission`, `listAudienceLevelLabelsBySubmission`,
and `listSpeakerIdentitiesForSubmissions` are display-only (neither
`needsMoreRatings`, `buildReviewerQueue`'s ordering, nor `unscoredTotal`
reads them) yet ran over the reviewer's whole scoped id set. Moved them
into a second `Promise.all` issued after ordering + the page slice, over
exactly `pagedIds UNION recusedIds` — bounded by `perPage + recused.length`
instead of scope size. Population-wide reads ordering/counting genuinely
need stayed in the first wave, unchanged. Envelope shape, ordering,
redaction, and refusal caps byte-identical (full suite + new targeted test
green). Full detail + before/after table:
docs/verification-log/task-w32-b-reviewer-queue-hydration-74c6377a.md.

TESTS: `npx vitest related src/routes/review/reviewer.ts --run` (51
files/389 tests) + `npx vitest run --root . review` (80 files/702 tests) —
all PASS. `npm run build` green. Added
`test/reviewer-queue-hydration-scope.test.ts` (instrumented fake `Db` +
spies proving the hydration wave's id-array length is bounded by
`perPage + recused.length`, not scope size; anonymized-plan redaction on
both halves).

MEASURED (default profile, `npm run db:migrate && npm run seed` ->
`npm run perf:seed` -> `npx wrangler dev --port 8902 --local` ->
`PERF_URL=... npm run perf:smoke`, re-seeded between runs, server killed
after use): three runs at 74c6377a measured `reviewer queue` at
48.7/32.2/38.9ms adj — all PASS against the 50ms budget (was FAIL at
69.7/66.6/76.1ms adj before this task, per task-w29-e's log).
RESULT: PASS (reviewer queue). `plan results (page 1)` remains a
pre-existing, out-of-scope FAIL (72.9/50.3/57.3ms adj across the same
three runs), unowned and unchanged by this task — DEC-440-foreclosed from
a SQL-aggregate rewrite.
