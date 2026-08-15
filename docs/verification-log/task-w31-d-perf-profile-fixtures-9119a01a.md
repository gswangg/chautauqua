# task-w31-d: perf-smoke profile-resolved plan/reviewer fixtures (DEC-644 wave-31 amendment, DEC-645)

Tip: `9119a01a` (branch `task-w31-d`, base `main` @ `87c545f6`).

## Diagnosis confirmed

`scripts/perf-smoke.ts:72-74` hardcoded `PERF_PLAN_ID = "seed_perf_plan_0001"`,
`PERF_REVIEWER_EMAIL = "perf.reviewer.1@example-perf.test"` and
`PERF_REVIEWER_PASSWORD = "PerfReviewer!2027"` — `default`-profile-only
literals. `isDefaultProfile` (was :310) gated the reviewer login and
`DEFAULT_ONLY_CHECK_NAMES` (was :945-950) dropped `rating PUT`,
`reviewer queue` and `plan results (page 1)` from every non-`default`
profile run (`plan progress (12 reviewers)` was already-named in that set
with no corresponding check left in the file — dead reference, removed
with the rest). The seeder side (`scripts/perf-seed-lib.ts`'s
`PERF_PROFILES[*].planId/reviewerEmailPrefix/reviewerPassword`,
`perfReviewerEmail(i, prefix)`, `perfPlanId(basePlanId, planIndex)`) was
already threaded per DEC-645; only the consuming end in `perf-smoke.ts`
needed work.

## Fix

`scripts/perf-smoke.ts`:
- `PERF_PLAN_ID = perfPlanId(PERF_PROFILE.planId, 1)`
- `PERF_REVIEWER_EMAIL = perfReviewerEmail(1, PERF_PROFILE.reviewerEmailPrefix)`
- `PERF_REVIEWER_PASSWORD = PERF_PROFILE.reviewerPassword`
- Deleted `isDefaultProfile`, `DEFAULT_ONLY_CHECK_NAMES`, `skippedChecks`
  and the `SKIPPED` console rows entirely. `reviewerHeaders` is now built
  and used unconditionally (no `| null` / `!` assertions).

Byte-identical for `default`: `perfPlanId("seed_perf_plan_0001", 1)` returns
the base id unchanged (planIndex 1 short-circuits); `perfReviewerEmail(1,
"perf.reviewer")` returns `"perf.reviewer.1@example-perf.test"`;
`PERF_PROFILES.default.reviewerPassword` is `"PerfReviewer!2027"`.

## Tests

`test/perf-smoke.test.ts` (SOLE OWNER, extended, not replaced):
- New `describe` block asserts (a) the harness source contains no
  profile-conditional check filter (`isDefaultProfile` /
  `DEFAULT_ONLY_CHECK_NAMES` / `skippedChecks` / `SKIPPED` all absent, and
  `PERF_PLAN_ID`/`PERF_REVIEWER_EMAIL`/`PERF_REVIEWER_PASSWORD` are
  resolved via the perf-seed-lib helpers, not literals); (b) the default
  profile resolves the exact prior literals via those same helpers.
  Existing DEC-644 wave-46 write-class assertions rewritten to drop their
  `DEFAULT_ONLY_CHECK_NAMES` regex-scan (the set no longer exists) in
  favor of asserting those check names are simply present (they now run
  unconditionally).
- `npx vitest run test/perf-smoke.test.ts` — 80 tests passed.

`npm run build` — green (tsc + vite build).

## Live proof (port 8897, this lane's reserved port)

```
tsx scripts/ensure-dev-vars.ts        # .dev.vars created, PUBLIC_BASE_URL edited to :8897
vite build --config app/vite.config.ts
wrangler d1 migrations apply chautauqua --local
npm run seed
npm run perf:seed:aie
wrangler dev --port 8897 &
PERF_URL=http://localhost:8897 npm run perf:smoke:aie
```

Output: `perf:smoke profile=aie event=perf-aie submissions=2500 contacts=6000`.
All three formerly-SKIPPED checks now produce real p95 rows against the
`aie` profile's own plan/reviewer identity (no longer silently omitted or
explicitly SKIPPED):

- `rating PUT` — raw=17.9ms adjusted=14.0ms budget(write)=100ms **PASS**
- `reviewer queue` — raw=110.5ms adjusted=106.6ms budget(read)=50ms **FAIL**
- `plan results (page 1)` — raw=88.9ms adjusted=85.0ms budget(read)=50ms **FAIL**

Per DEC-347 clause (3) and DEC-644's wave-31 amendment: the two newly-
observable `aie`-scale overruns are LOGGED FINDINGS, not open items owned
by this lane:

- **`reviewer queue`** (106.6ms adjusted vs 50ms read budget) — owning
  route `src/routes/review/reviewer.ts` (owner this wave: w31-b).
- **`plan results (page 1)`** (85.0ms adjusted vs 50ms read budget) —
  owning route `src/routes/review/shared.ts` (owner this wave: w31-c).

A third pre-existing failure, `files library (page 1)` (raw=378.0ms), was
already unlocked under `--profile=aie` prior to this lane (it was never
in `DEFAULT_ONLY_CHECK_NAMES`) — unrelated to this task's scope, not
newly introduced or newly observed by this change.

`wrangler dev` killed after the run (`pkill -f "wrangler dev --port
8897"`).

## Scope note

`plan progress (12 reviewers)` named in the old `DEFAULT_ONLY_CHECK_NAMES`
set had no corresponding `TimedCheck` left in `checks[]` — a stale
reference from an earlier wave's removed check. Deleted along with the
rest of the set; no check named `plan progress (12 reviewers)` exists to
restore.
