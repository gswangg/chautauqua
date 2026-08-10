# task-w4-c — perf-smoke @ 3878d4f

Gate re-run (wave 4, DEC-077 log-only lane; DEC-093 places the code-bearing
sha at `3878d4f` — "merge task-w2-d" — for this reopened wave). Fresh
worktree `chautauqua-wt/task-w4-c` branched off `main` at `79c4bb3`
("merge task-w3-e", the current tip; all commits after `3878d4f` are
log-only per DEC-090/093, so the code under test is unchanged from
`3878d4f`).

## Steps run

1. `npm ci --prefer-offline --no-audit --no-fund --silent` — clean install, no errors.
2. `npm run build` — `tsc --noEmit` (root), `tsc --noEmit -p app/tsconfig.json`,
   `vite build` all succeeded (largest chunk `index-DOwNDQO_.js` 179.18 kB /
   58.63 kB gz — matches prior gates, within DEC-058 budget).
3. `npm run db:migrate` — 10 migrations (`0000`..`0009`, including
   `0009_review_rounds.sql`) applied cleanly to local D1 (`chautauqua`).
4. `npm run seed` — run first, per the w16-c precedent recorded in this
   file: `perf:seed` seeds only the synthetic `seed_perf_`-prefixed rows,
   not a login-capable organizer. `perf:smoke` logs in as the fixture
   organizer from `docs/fixtures/sample-data.json`, which only exists
   after the regular demo seed runs. Completed with no errors (D1 rows +
   6 R2 objects).
5. `npm run perf:seed` — emitted `.perf-seed.sql` (13,757 statements) and
   applied it via `wrangler d1 execute chautauqua --local --file=.perf-seed.sql`.
   Verified the DEC-088 extended scale directly against local D1 (the
   script itself prints no summary line, so this was confirmed by query):
   - `plan_reviewer` rows for `plan_id='seed_perf_plan_0001'`: **12** (matches
     `PERF_REVIEWER_COUNT` in `scripts/perf-seed-lib.ts:179`).
   - `submission` rows for `event_id='seed_perf_event'`: **2000** total
     (`PERF_SUBMISSION_COUNT`), status breakdown pending 1200 /
     accept_queue 300 / **accepted 300** / decline_queue 100 / declined 100
     (`PERF_STATUS_COUNTS`, `scripts/perf-seed-lib.ts:16-23`) — i.e. exactly
     300 "sessions" (accepted submissions), not 301+.
6. Started `npx wrangler dev --port 8803` (8803 reserved for this lane,
   never 8787/8801) in the background; confirmed `Ready on
   http://localhost:8803` with D1/KV/R2/ASSETS bindings attached, and a
   `GET /health` 200.
7. `PERF_URL=http://localhost:8803 npm run perf:smoke` — **fails before any
   timed check runs.**

## Failure

```
Error: fetchAcceptedSubmissionIds: expected at least 301 accepted submissions, got 200
    at fetchAcceptedSubmissionIds (scripts/perf-smoke.ts:166:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async main (scripts/perf-smoke.ts:181:18)
```

Reproduced twice (two independent `wrangler dev` sessions on port 8803,
same seed) with identical output both times.

### Root cause (read-only analysis, no code/script changes made — DEC-077 log-only lane)

`scripts/perf-smoke.ts`'s DEC-089/DEC-080 one-shot cap probe calls
`fetchAcceptedSubmissionIds(headers, 301)` (line 181) to gather 301
accepted-submission ids for the "over the 300-id `.ics` cap" assertion.
`fetchAcceptedSubmissionIds` (lines 155-169) issues a single
`GET /api/v1/events/:eventId/submissions?status=accepted&perPage=301` and
throws if fewer than 301 ids come back.

Two independent constraints both cap this well below 301, and either one
alone would already fail the call:

- **Seed data ceiling**: `PERF_STATUS_COUNTS.accepted` in
  `scripts/perf-seed-lib.ts:20` is fixed at exactly **300** — never enough
  to satisfy a "301 accepted" request regardless of pagination.
- **Server-side page clamp**: `src/lib/pagination.ts` (`MAX_PER_PAGE = 200`)
  and the submissions list repo (`src/server/repo/submissions/query.ts:21,46`,
  `Math.min(perPageNum, MAX_PER_PAGE)`) clamp any `perPage` request to 200
  regardless of how many matching rows exist, and
  `fetchAcceptedSubmissionIds` does not paginate across multiple pages — it
  makes one request and takes what comes back. This is why the observed
  count is exactly 200, not 300.

So the 301-id cap probe (added under DEC-089/DEC-080) and the perf-seed
status mix (DEC-088, `accepted: 300`) are mutually inconsistent: even if
`fetchAcceptedSubmissionIds` paginated correctly, the seed only ever
produces 300 accepted submissions for `seed_perf_event`, one short of the
301 the probe needs. This is a deterministic, reproducible mismatch
between two DEC-088/DEC-089-authored artifacts (`scripts/perf-seed-lib.ts`'s
status mix vs. `scripts/perf-smoke.ts`'s cap-probe threshold), not an
environmental flake — the same failure would occur on any fresh worktree
running this exact sequence.

Because the script throws before entering the warmup/measurement loop for
any check, **no p95 data was collected for any of the 6 checks** named in
the task (submissions list page 1, submissions list search, submission
detail, event overview, public sessions page, public agenda,
`schedule.ics` 150-id, plan progress w/ 12 reviewers, rating PUT as
`perf.reviewer.1@example-perf.test`, or the 301-id cap assertion itself).
`test/perf-smoke.test.ts`'s 11 unit tests only cover the pure helpers in
`scripts/perf-smoke-lib.ts` (`computeP95`, `joinIcsIds`,
`assertContainsVevent`) — there is no existing test coverage that
exercises `fetchAcceptedSubmissionIds` against real seeded data, so this
gap was not previously caught by `npm test`.

Per DEC-077 (log-only lane) and this task's explicit "no fixes" scope,
`scripts/perf-seed-lib.ts` and `scripts/perf-smoke.ts` were left
unmodified. This is flagged as an open item for a future code-bearing wave
to reconcile (either bump `PERF_STATUS_COUNTS.accepted` to >=301, or have
the cap probe draw from a status/id pool that already has >=301 rows, or
have `fetchAcceptedSubmissionIds` paginate and union across pages capped
at 300 accepted — none of which is a decision this log-only lane is
authorized to make).

## `npm test`

`94 test files / 971 tests`, all passed. `Duration ~5.6s`.

## Scope note (DEC-077 log-only lane)

This lane touched only `docs/verification-log.md` and
`docs/verification-log/task-w4-c-perf-smoke.md` — no `src/`, `app/`,
`scripts/`, or `migrations/` changes, per DEC-077/090/093.

## OPEN ITEMS: 1

1. `scripts/perf-smoke.ts`'s DEC-089/DEC-080 301-id cap probe cannot
   succeed against the DEC-088 perf-seed fixture as currently authored:
   the seed produces exactly 300 accepted submissions for
   `seed_perf_event` (`PERF_STATUS_COUNTS.accepted` in
   `scripts/perf-seed-lib.ts:20`), one short of the 301
   `fetchAcceptedSubmissionIds(headers, 301)` requires
   (`scripts/perf-smoke.ts:181`); independently, the submissions list API
   clamps `perPage` to 200 (`src/lib/pagination.ts` `MAX_PER_PAGE = 200`)
   and the fetch helper does not paginate. The perf-smoke script currently
   throws before any timed check runs, so no p95 data exists for this sha.

RESULT: FAIL
