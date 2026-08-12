# task-w8-i — perf-smoke gate (post-redesign, first reading since DEC-370's overview worklist landed)

LOG-ONLY task (DEC-384): this document is the entire deliverable. No
budget, script, or query was changed.

Measured commit: `git rev-parse main` = `e833c59da5c1fc160cede9066d7795d3c8d9f9dc`
(worktree `task-w8-i` was cut from `main` at this sha; `main` continued
advancing under concurrent swarm activity while this run was in
progress, which is expected and does not affect the reading below —
the worktree stayed pinned to `e833c59`).

## Command sequence and exit codes

| step | command | exit code |
|---|---|---|
| 1 | `npm ci --prefer-offline --no-audit --no-fund --silent` | 0 |
| 2 | `npm run build` | 0 |
| 3 | `npm test` | 0 (2136/2136 passed) |
| 4 | `npm run db:migrate` | 0 (18 migrations applied) |
| 5 | `npm run seed` | 0 |
| 6 | `npm run perf:seed` (2k-submission synthetic event) | 0 |
| 7 | `npm run dev` (long-running, `wrangler dev`, port 8787) | started, healthy (`GET /health` 200) |
| 8 | `npm run perf:smoke` | 0 |

Note on step 5: the task's literal command list (npm ci; npm run
build; npm test; npm run db:migrate; npm run perf:seed; npm run dev;
npm run perf:smoke) omits `npm run seed`. `scripts/perf-seed.ts`
reuses the demo seed's fixed org id (`ORG_ID = seedId("org", 1)`,
scripts/perf-seed.ts:56) and the fixture organizer identity
(`docs/fixtures/sample-data.json`'s `identities.organizer`, read by
`scripts/perf-smoke.ts:242-243`) without creating either itself — it
is not idempotent-standalone against a freshly migrated, unseeded DB.
Run without step 5, `perf:seed` succeeds (writes 2000 submissions
against `seed_perf_event`) but every authenticated `perf:smoke` check
then 404s (`GET /api/v1/events/seed_perf_event/submissions` →
`{"error":{"code":"not_found","message":"Event not found"}}`) because
the organizer session has no org/event membership. `.github/workflows/
ci.yml:35-37` runs `db:migrate` → `seed` → `perf:seed` in that order;
this is the sequence actually used above. See OPEN ITEMS #1.

An earlier attempt against a since-superseded `main` tip (`045379a`)
saw 4 pre-existing test failures (`test/compose-full-set.test.ts`,
`test/review-results-ratingless.test.ts` x1,
`test/task-form-binding.test.ts` x2) unrelated to this task's scope;
those did not reproduce on the measured commit `e833c59` (clean
2136/2136). Not re-investigated further — outside this task's
LOG-ONLY scope, and not reproducible against the sha this report
grades.

## DEC-080 cap assertion (one-shot, untimed)

`schedule.ics?ids=<301 ids>` (300 real accepted ids + 1 nonexistent
probe id) against the public, unauthenticated route: expected 400,
got 400. PASS.

## DEC-105 export-size probes (one-shot, untimed)

- `export/submissions?format=csv`: 200, >= 2001 CSV lines. PASS.
- `exports/showflow.csv`: 200, >= 301 CSV lines. PASS.

## p95 table (30 measured iterations, 5 warmup; overhead floor 2.5ms
via 30x `GET /health` p50; raw ceiling 150ms per
`PERF_P95_BUDGET_MS` in scripts/perf-smoke-lib.ts:9; per-class budget
via `PERF_CLASS_BUDGET_MS` in scripts/perf-smoke-lib.ts:18-22 —
read=50ms, write=100ms, public=150ms)

```
  submissions list (page 1)                 raw=     8.8ms  floor=   2.5ms  adjusted=     6.3ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    13.5ms  floor=   2.5ms  adjusted=    11.0ms  budget(read)=50ms  PASS
  submission detail                         raw=    14.8ms  floor=   2.5ms  adjusted=    12.4ms  budget(read)=50ms  PASS
  event overview                            raw=    20.8ms  floor=   2.5ms  adjusted=    18.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    18.1ms  floor=   2.5ms  adjusted=    15.7ms  budget(read)=50ms  PASS
  public sessions page                      raw=     3.8ms  floor=   2.5ms  adjusted=     1.3ms  budget(public)=150ms  PASS
  public agenda                             raw=     6.0ms  floor=   2.5ms  adjusted=     3.5ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    46.2ms  floor=   2.5ms  adjusted=    43.8ms  budget(public)=150ms  PASS
  public speakers page                      raw=     5.8ms  floor=   2.5ms  adjusted=     3.4ms  budget(public)=150ms  PASS
  public gallery page                       raw=     5.0ms  floor=   2.5ms  adjusted=     2.5ms  budget(public)=150ms  PASS
  public schedule page                      raw=     6.7ms  floor=   2.5ms  adjusted=     4.3ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     4.4ms  floor=   2.5ms  adjusted=     1.9ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    81.8ms  floor=   2.5ms  adjusted=    79.3ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    21.5ms  floor=   2.5ms  adjusted=    19.0ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     6.0ms  floor=   2.5ms  adjusted=     3.6ms  budget(read)=50ms  PASS
  rating PUT                                raw=    13.2ms  floor=   2.5ms  adjusted=    10.8ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    12.8ms  floor=   2.5ms  adjusted=    10.3ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    20.1ms  floor=   2.5ms  adjusted=    17.7ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     5.4ms  floor=   2.5ms  adjusted=     2.9ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=     8.7ms  floor=   2.5ms  adjusted=     6.3ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    37.0ms  floor=   2.5ms  adjusted=    34.6ms  budget(read)=50ms  PASS
```

Harness stdout footer: `perf:smoke OK`. Harness exit code: 0.

## "event overview" check (scripts/perf-smoke.ts:327), called out explicitly

`event overview` (GET `/api/v1/events/:eventId/overview`, backed by
`getOverviewPayload` in `src/server/repo/overview.ts:230`): raw p95
20.8ms, adjusted p95 18.3ms, against a 50ms read-class budget — PASS,
with headroom (adjusted p95 is 37% of budget). This is the first
timed reading of this endpoint since DEC-370's worklist rows
(overdue-task rows, triage rows, content-approval rows, agenda
placement + speaker-name fan-out, lead-speaker names) were added on
top of the v1 aggregates — the endpoint's consumer (`app/src/pages/
overview/`) went unrendered by the walkthrough until DEC-400 wired the
`triage`/`triage-counts` key split, so nobody had watched this route
under the 2k-submission / 300-accepted / 800-speaker perf-seed scale
until this run.

Reading the repo function (`src/server/repo/overview.ts:230-460+`):
every DEC-370 addition is a set-based query (grouped counts,
row-capped `ORDER BY ... LIMIT ROW_CAP` detail selects, `IN (...)`
batched lookups via `chunkIds()` for the participant fan-out at
overview.ts:466-475, one correlated-EXISTS conditional aggregate for
the reuploaded-file count at overview.ts:379-384). No per-row query
loop was found — the 20.8ms raw p95 is consistent with a handful of
sequential set-based queries against 2000 submissions / 300 accepted
/ 4000 task_assignment rows, not a waterfall or N+1. No over-budget
check exists in this run to name an offending endpoint for.

## RESULT: PASS

All 21 timed checks PASS against both the raw ceiling and their class
budget. Both untimed one-shot probes (DEC-080 cap, DEC-105 CSV size)
PASS. Harness exit code 0.

## OPEN ITEMS

1. `scripts/perf-seed.ts:56` (`ORG_ID = seedId("org", 1)`) and
   `scripts/perf-smoke.ts:242-243` (fixture organizer login) make
   `npm run perf:seed` / `npm run perf:smoke` silently dependent on
   `npm run seed` having been run first — undocumented outside
   `.github/workflows/ci.yml:35-37`'s step ordering. A worker or CI
   variant that runs `db:migrate` → `perf:seed` → `perf:smoke` without
   the intervening `npm run seed` gets a 404 wall on every
   authenticated check, not a budget failure — worth a one-line note
   in a README/runbook for perf-smoke callers (not fixed here — LOG-
   ONLY, no script changes).
2. This run's `main` sha (`e833c59`) predates whatever code-bearing
   commits landed on `main` after this worktree was cut (observed
   `main` advancing to at least `31d8ec0` mid-run under concurrent
   swarm activity). No specific gap identified — flagging only that a
   future reading against `main`'s current tip may see different
   numbers than this report if DEC-370/DEC-400-adjacent code changed
   again since `e833c59`.
3. Environmental: this worktree (`chautauqua-wt/task-w8-i`) and its
   branch were deleted out from under this task twice while work was
   in progress (once mid-`npm test`, once mid-`perf:seed`), requiring
   two `git worktree add` recreations from `main`'s then-current tip.
   Root cause not diagnosed (plausibly a concurrent integrator/scribe
   process pruning worktrees it didn't recognize as active) — noted
   for the swarm's own operational awareness, not a repo code defect.
