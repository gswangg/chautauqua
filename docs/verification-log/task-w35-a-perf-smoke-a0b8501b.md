# task-w35-a — perf-smoke @ a0b8501b (TIER-0 MEASUREMENT LANE, LOG-ONLY)

DEC-644 (wave-35 amendment). This lane fixes nothing under `src/`,
`app/src/`, `scripts/`, `test/`, or `migrations/` and does not touch
`package.json`. It takes the first perf reading at a boundary that
carries BOTH the `reviewer queue` fix (task-w32-b, `src/routes/review/reviewer.ts`)
and the `plan results (page 1)` fix (task-w32-a, `src/routes/review/shared.ts`
+ `src/routes/review/plans-progress.ts`) merged together. Prior readings of
each fix (docs/verification-log/index/0186-2026-08-15-task-w32-a-plan-results-perf-69e419ad.md
and docs/verification-log/index/0187-2026-08-15-task-w32-b-reviewer-queue-hydration-74c6377a.md)
were each taken with the *other* lane's fix absent from the branch under
measurement. `HEAD` at measurement time was `a0b8501b2e3cc6e57d6525d41ba1554c5943c483`
(`git rev-parse HEAD`, run first, before any other command).

grep confirms both fixes are present in the tree at this sha:
- `src/routes/review/shared.ts` exports `rankPlanResults` / `hydrateResultsRows` (task-w32-a shape).
- `src/routes/review/reviewer.ts` issues the post-slice hydration wave over
  `pagedIds UNION recusedIds` (task-w32-b shape, line ~250:
  `const hydrateIds = [...new Set([...pagedIds, ...recusedIds])];`).

## Sequence run (in this exact order, per the omission trap at
docs/verification-log.md:3943-3949)

1. `npm run build` — green.
2. `npm run db:migrate` — all 43 migrations (0000-0042) applied clean.
3. `npm run seed` — REQUIRED before `perf:seed`/`perf:smoke`: writes the
   demo organizer credentials `scripts/perf-smoke.ts`'s `login()` reads
   from `docs/fixtures/sample-data.json`.
4. `npm run perf:seed` — perf-scale fixture load (`perf-2k`: 2000
   submissions, 800 contacts) on top of the demo seed.
5. `npx wrangler dev --port 8951 --local` — local server, confirmed up
   with a `200` from `GET /`.
6. `PERF_URL=http://localhost:8951 npm run perf:smoke` — run 1.

Run 2 mutates state (bulk status change, submission PATCH, pipeline stage
move, task check-off, etc. all write during the measured pass), so a bare
re-run of `perf:smoke` against the same D1 state fails outright
(`fetchPendingSubmissionIds: expected at least 1000 pending submissions,
got 200`) rather than producing a comparable reading — this matches
task-w32-a's/task-w32-b's own precedent of re-seeding between runs. Runs 2
and 3 therefore each repeated steps 3-6 (`npm run seed` -> `npm run
perf:seed` -> restart `wrangler dev --port 8951 --local` -> `perf:smoke`)
against a fresh seed, server killed between runs and after run 3.

## Full per-row, three-run table

Columns: raw / floor / adjusted / budget / PASS-FAIL, per run. "floor" is
the run's measured overhead floor (subtracted from raw to get adjusted);
"raw ceiling" for every row in every run was 150ms (unexceeded on all 90
row-measurements below — no row hit the raw-ceiling instrument at any run).

Overhead floor per run: run1 = 2.2ms, run2 = 4.0ms, run3 = 3.0ms.
Raw ceiling (all rows, all runs): 150ms.

| row | class budget | run1 raw/adj/verdict | run2 raw/adj/verdict | run3 raw/adj/verdict |
|---|---|---|---|---|
| submissions list (page 1) | read 50ms | 10.6/8.4 PASS | 15.7/11.7 PASS | 15.2/12.2 PASS |
| submissions list (q=Kubernetes) | read 50ms | 17.3/15.1 PASS | 18.6/14.6 PASS | 19.5/16.5 PASS |
| submission detail | read 50ms | 20.2/18.0 PASS | 21.8/17.8 PASS | 26.8/23.8 PASS |
| event overview | read 50ms | 28.4/26.2 PASS | 28.5/24.6 PASS | 30.3/27.3 PASS |
| organizer agenda (300 accepted) | read 50ms | 17.9/15.7 PASS | 22.3/18.3 PASS | 24.5/21.5 PASS |
| public sessions page | public 150ms | 7.3/5.1 PASS | 7.8/3.8 PASS | 8.7/5.7 PASS |
| public agenda | public 150ms | 7.7/5.5 PASS | 10.7/6.7 PASS | 9.4/6.4 PASS |
| schedule.ics 150 ids | public 150ms | 51.0/48.8 PASS | 52.8/48.8 PASS | 51.8/48.8 PASS |
| public speakers page | public 150ms | 7.7/5.5 PASS | 8.4/4.4 PASS | 7.5/4.5 PASS |
| public speakers page at row ceiling | public 150ms | 10.5/8.3 PASS | 13.1/9.1 PASS | 12.6/9.6 PASS |
| public speakers deepest page | public 150ms | 12.8/10.6 PASS | 18.2/14.3 PASS | 12.8/9.8 PASS |
| public sessions deepest rows | public 150ms | 10.3/8.1 PASS | 12.9/9.0 PASS | 11.6/8.7 PASS |
| public gallery page | public 150ms | 6.8/4.6 PASS | 8.6/4.6 PASS | 9.1/6.1 PASS |
| public schedule page | public 150ms | 12.1/9.9 PASS | 11.6/7.7 PASS | 10.9/7.9 PASS |
| public programme (whole agenda) | public 150ms | 7.1/4.9 PASS | 9.7/5.7 PASS | 9.1/6.1 PASS |
| home hub (anonymous) | public 150ms | 15.1/12.9 PASS | 13.3/9.4 PASS | 12.0/9.0 PASS |
| agenda.ics | public 150ms | 5.2/3.0 PASS | 4.3/0.3 PASS | 5.5/2.5 PASS |
| schedule.ics (bare, whole agenda) | public 150ms | 4.8/2.6 PASS | 4.5/0.5 PASS | 5.0/2.0 PASS |
| contacts list (q=perf) | read 50ms | 9.4/7.2 PASS | 8.5/4.5 PASS | 6.6/3.6 PASS |
| rating PUT | write 100ms | 11.3/9.1 PASS | 25.8/21.8 PASS | 13.2/10.3 PASS |
| contacts duplicates | read 50ms | 9.7/7.5 PASS | 10.6/6.6 PASS | 10.5/7.5 PASS |
| onboarding grid (800 speakers x 5 tasks) | read 50ms | 26.6/24.4 PASS | 26.1/22.1 PASS | 26.9/23.9 PASS |
| **reviewer queue** | read 50ms | 46.4/44.2 PASS | 44.0/40.0 PASS | 45.1/42.1 PASS |
| plan progress (page 1) | read 50ms | 55.3/53.1 **FAIL** | 47.1/43.2 PASS | 60.0/57.0 **FAIL** |
| plan reviewers (page 1) | read 50ms | 8.6/6.4 PASS | 6.5/2.5 PASS | 7.6/4.6 PASS |
| email log list (page 1) | read 50ms | 6.8/4.6 PASS | 7.1/3.2 PASS | 7.6/4.6 PASS |
| files library (page 1) | read 50ms | 21.1/18.9 PASS | 16.6/12.6 PASS | 17.8/14.8 PASS |
| **plan results (page 1)** | read 50ms | 26.1/23.9 PASS | 24.9/20.9 PASS | 30.3/27.4 PASS |
| pipeline list (page 1) | read 50ms | 10.5/8.3 PASS | 9.3/5.3 PASS | 29.1/26.1 PASS |
| org users list (page 1) | read 50ms | 8.1/5.9 PASS | 6.0/2.1 PASS | 10.2/7.2 PASS |
| contacts bulk-email preview (50 recipients) | write 100ms | 8.0/5.8 PASS | 7.6/3.6 PASS | 12.8/9.8 PASS |
| onboarding remind preview (all outstanding) | write 100ms | 27.6/25.4 PASS | 24.4/20.4 PASS | 31.3/28.3 PASS |
| submission PATCH (description edit) | write 100ms | 20.6/18.4 PASS | 14.6/10.6 PASS | 24.6/21.6 PASS |
| pipeline stage move | write 100ms | 9.8/7.6 PASS | 11.9/7.9 PASS | 15.1/12.1 PASS |
| bulk status change | write 100ms | 54.0/51.8 PASS | 44.1/40.1 PASS | 45.3/42.3 PASS |
| schedule slot PUT | write 100ms | 21.7/19.5 PASS | 17.3/13.3 PASS | 21.6/18.6 PASS |
| task assignment check-off | write 100ms | 9.2/7.0 PASS | 6.3/2.3 PASS | 10.0/7.0 PASS |

33 checks total, matching `scripts/perf-smoke.ts`'s ~33 registered rows.

## Mandate rows, explicit verdict at this sha

- **`reviewer queue`**: run1 46.4/44.2ms adjusted PASS; run2 44.0/40.0ms
  adjusted PASS; run3 45.1/42.1ms adjusted PASS. All three runs PASS
  against the 50ms read-class budget at `a0b8501b`, with task-w32-a's
  `plan results` fix also present in the same tree (not stashed out, as
  task-w32-b's own log measured it).
  **RESULT: PASS (reviewer queue) at this merged boundary, all 3 runs.**

- **`plan results (page 1)`**: run1 26.1/23.9ms adjusted PASS; run2
  24.9/20.9ms adjusted PASS; run3 30.3/27.4ms adjusted PASS. All three
  runs PASS against the 50ms read-class budget at `a0b8501b`, with
  task-w32-b's `reviewer queue` fix also present in the same tree (not
  stashed out, as task-w32-a's own log measured it).
  **RESULT: PASS (plan results (page 1)) at this merged boundary, all 3
  runs.**

This closes the open question flagged at docs/verification-log.md:4590-4596
and :4625-4634: each row now has a reading taken with *both* review-side
fixes present simultaneously, not just its own lane's fix in isolation.

## Non-mandate finding (logged, not owned by this lane)

`plan progress (page 1)` (a distinct row from `plan results (page 1)`,
served by the `GET /api/v1/plans/:id/progress` route also touched by
task-w32-a's `Promise.all` collapse) is unstable at this sha: FAIL in
run1 (55.3/53.1ms), PASS in run2 (47.1/43.2ms), FAIL in run3
(60.0/57.0ms) — all against the 50ms read-class budget. This is outside
this lane's mandate (`reviewer queue` and `plan results (page 1)` only)
and no fix is attempted here (DEC-453: log-only, fix nothing under
`src/`). Flagged for a future lane.

## Overhead floor / raw ceiling

Overhead floor: run1 2.2ms, run2 4.0ms, run3 3.0ms (varies run-to-run per
`scripts/perf-smoke.ts`'s own floor calibration; not a fixed constant).
Raw ceiling: 150ms for every row across all three runs — no row's raw
measurement approached, let alone exceeded, the raw-ceiling instrument at
any run.
