# task-w32-c — perf smoke coverage: plan progress + plan reviewers @ e5774e56

sha under test (literal, recorded first): `e5774e56...` (`main` tip at
worktree creation for this lane).

## Scope

Adds two `read`-class checks to `scripts/perf-smoke.ts`, next to the
existing `reviewer queue` / `plan results (page 1)` rows, covering the two
organizer-facing plan tabs that had never been measured by this harness:

- `plan progress (page 1)` -> `GET /api/v1/plans/${PERF_PLAN_ID}/progress?page=1`
  (src/routes/review/plans-progress.ts:51)
- `plan reviewers (page 1)` -> `GET /api/v1/plans/${PERF_PLAN_ID}/reviewers?page=1`
  (src/routes/review/plans-reviewers.ts:188)

Both use the profile-resolved `PERF_PLAN_ID` fixture (same as the
neighbouring `reviewer queue` / `plan results` rows) and assert HTTP 200 AND
a non-empty `items` array via a new `assertNonEmptyItems` helper added to
`scripts/perf-smoke-lib.ts`, so a silently-empty response cannot pass as
fast.

## Procedure

1. `npm run db:migrate` — all 41 migrations (`0001`..`0041`) applied.
2. `npm run seed` — demo seed (organizer credentials + baseline data).
3. `npm run perf:seed` — `default` profile perf-scale rows on top of the
   demo seed (2,000 submissions / 800 contacts / 12 reviewers / DEC-088
   plan+round fixtures).
4. `npx wrangler dev --port 8903 --local` (port 8903 reserved to this lane
   per DEC-347) in the background; waited for `Ready on
   http://localhost:8903`.
5. `PERF_URL=http://localhost:8903 npm run perf:smoke` — full 35-row table
   below.
6. Killed the wrangler dev process (port 8903 confirmed free afterward).

## Full verbatim p95 table

```
perf:smoke profile=default event=perf-2k submissions=2000 contacts=800

p95 over 30 measured iterations (overhead floor: 3.3ms, raw ceiling: 150ms):

  submissions list (page 1)                    raw=    14.9ms  floor=   3.3ms  adjusted=    11.6ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    19.0ms  floor=   3.3ms  adjusted=    15.7ms  budget(read)=50ms  PASS
  submission detail                            raw=    23.5ms  floor=   3.3ms  adjusted=    20.2ms  budget(read)=50ms  PASS
  event overview                               raw=    30.5ms  floor=   3.3ms  adjusted=    27.1ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    25.5ms  floor=   3.3ms  adjusted=    22.2ms  budget(read)=50ms  PASS
  public sessions page                         raw=    10.6ms  floor=   3.3ms  adjusted=     7.3ms  budget(public)=150ms  PASS
  public agenda                                raw=    12.8ms  floor=   3.3ms  adjusted=     9.4ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    57.1ms  floor=   3.3ms  adjusted=    53.7ms  budget(public)=150ms  PASS
  public speakers page                         raw=     8.7ms  floor=   3.3ms  adjusted=     5.4ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    16.3ms  floor=   3.3ms  adjusted=    13.0ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    17.5ms  floor=   3.3ms  adjusted=    14.2ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    13.5ms  floor=   3.3ms  adjusted=    10.2ms  budget(public)=150ms  PASS
  public gallery page                          raw=    10.3ms  floor=   3.3ms  adjusted=     7.0ms  budget(public)=150ms  PASS
  public schedule page                         raw=    13.1ms  floor=   3.3ms  adjusted=     9.8ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=    10.6ms  floor=   3.3ms  adjusted=     7.2ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    15.3ms  floor=   3.3ms  adjusted=    11.9ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     6.7ms  floor=   3.3ms  adjusted=     3.4ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     9.3ms  floor=   3.3ms  adjusted=     6.0ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     8.6ms  floor=   3.3ms  adjusted=     5.2ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    17.0ms  floor=   3.3ms  adjusted=    13.6ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=    12.6ms  floor=   3.3ms  adjusted=     9.2ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    29.9ms  floor=   3.3ms  adjusted=    26.6ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    71.3ms  floor=   3.3ms  adjusted=    67.9ms  budget(read)=50ms  FAIL
      adjusted p95 67.9ms exceeds read class budget 50ms
  plan progress (page 1)                       raw=    51.3ms  floor=   3.3ms  adjusted=    48.0ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     8.0ms  floor=   3.3ms  adjusted=     4.6ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=    10.0ms  floor=   3.3ms  adjusted=     6.7ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    18.4ms  floor=   3.3ms  adjusted=    15.1ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    65.9ms  floor=   3.3ms  adjusted=    62.6ms  budget(read)=50ms  FAIL
      adjusted p95 62.6ms exceeds read class budget 50ms
  pipeline list (page 1)                       raw=     8.9ms  floor=   3.3ms  adjusted=     5.5ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     8.1ms  floor=   3.3ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     8.4ms  floor=   3.3ms  adjusted=     5.1ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    24.6ms  floor=   3.3ms  adjusted=    21.3ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    15.3ms  floor=   3.3ms  adjusted=    11.9ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    11.2ms  floor=   3.3ms  adjusted=     7.9ms  budget(write)=100ms  PASS
  bulk status change                           raw=    41.0ms  floor=   3.3ms  adjusted=    37.6ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    21.5ms  floor=   3.3ms  adjusted=    18.2ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     7.5ms  floor=   3.3ms  adjusted=     4.2ms  budget(write)=100ms  PASS

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

## Verdict for the two new rows

Both new rows land under their `read` class budget (50ms adjusted):

- `plan progress (page 1)`: raw 51.3ms / adjusted **48.0ms** — PASS (close
  to budget; `src/routes/review/plans-progress.ts`'s progress handler does a
  full plan-scoped submission load + reviewer/evaluation/recusal
  fan-in before slicing to a page — worth watching if plan population
  grows further, but not over budget today).
- `plan reviewers (page 1)`: raw 8.0ms / adjusted **4.6ms** — PASS,
  comfortably under budget (already server-paged via
  `repo.listReviewerRowsForPlan`'s `limit`/`offset`).

Per the task instructions, since neither new row is over budget, no new
FINDING is recorded and no `src/routes/review/**` edit was made.

The two pre-existing `FAIL` rows (`reviewer queue`, `plan results (page 1)`)
are out of this lane's scope (owned by another wave/lane per the task
brief) and are reproduced verbatim above for completeness only — not fixed
or further diagnosed here.
