# task-w17-d — perf:smoke @ 2,000-submission seed, DEC-449 acceptance (DEC-453)

Evidence lane, log-only: no source file was changed by this task.

Sha measured: `93eabca` (`merge task-w17-a`, which is HEAD of `main` at cut
time and includes `88aa7e1 Fix reviewer-queue read-budget miss by deleting
dead chunked round trips (DEC-449)`). Worktree `task-w17-d` branched fresh
from this commit; no rebase/merge performed.

Method, following `docs/verification-log/task-w16-c-perf-smoke-stage1.md`:
this worktree had no `.wrangler/state/v3/{d1,r2}` directory at all (fresh
worktree, never run before), so the "clear" step was a no-op confirmed by
`ls` failing with "No such file or directory". Then `npm run db:migrate`
(19 migrations applied clean) + `npm run seed` + `npm run perf:seed`
(`PERF_EVENT_SLUG=perf-2k`, `PERF_PLAN_ID=seed_perf_plan_0001`, 2,000
submissions / 800 contacts / 12 reviewers) against this fresh local D1,
then `npm run dev -- --port 8798 --var PUBLIC_BASE_URL:http://localhost:8798`
per DEC-448 (never `cp .dev.vars.example` + bare `npx wrangler dev`), then
`PERF_URL=http://localhost:8798 npm run perf:smoke` run four times in a row
against the same seed and the same server process.

Port note: ports 8787/18787/28787 were already bound or recently used by
other in-flight worktrees at cut time (see contention note below); 8798 was
confirmed free with `lsof -i :8798` before boot and used explicitly.

## Environment / contention note

`ps aux` at measurement time showed other node/wrangler processes alive on
the host beyond this lane's own `wrangler dev --port 8798`:
- the main checkout (`/Users/wednesdayniemeyer/.../chautauqua`, not a
  worktree) running its own `wrangler dev --port 18787` plus
  `--var PUBLIC_BASE_URL:http://localhost:18787`.
- a `task-w17-f` worktree mid-flight running `tsx scripts/perf-seed.ts &&
  wrangler d1 execute chautauqua --local --file=.perf-seed.sql` (its own,
  separate local D1 file inside its own worktree — no shared state with
  this lane).
- a **stale** `task-w8-i` worktree `wrangler d1 execute ... --file=
  .perf-seed.sql` process, alive since 2:37AM (hours before this run), 0%
  CPU — looks hung/zombied, present the whole time, same as w16-c reported
  for a different stale worktree.
- an unrelated `killmysaas-evals` tsx driver process (different repo
  entirely).

Flagged as an aggravating factor per w16-c/w13-d precedent, not grounds to
discard readings — all four runs PASSED cleanly regardless (see below), so
this note is informational only.

## Full p95 table (run 1, representative)

```
p95 over 30 measured iterations (overhead floor: 2.3ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=     9.0ms  adjusted=     6.7ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    12.3ms  adjusted=    10.0ms  budget(read)=50ms  PASS
  submission detail                         raw=    14.3ms  adjusted=    12.0ms  budget(read)=50ms  PASS
  event overview                            raw=    19.6ms  adjusted=    17.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    18.2ms  adjusted=    15.9ms  budget(read)=50ms  PASS
  public sessions page                      raw=     4.3ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.7ms  adjusted=     3.4ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    43.9ms  adjusted=    41.6ms  budget(public)=150ms  PASS
  public speakers page                      raw=     3.9ms  adjusted=     1.6ms  budget(public)=150ms  PASS
  public gallery page                       raw=     4.3ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  public schedule page                      raw=     6.8ms  adjusted=     4.5ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     3.3ms  adjusted=     1.0ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=     4.1ms  adjusted=     1.8ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    19.9ms  adjusted=    17.6ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     5.3ms  adjusted=     3.0ms  budget(read)=50ms  PASS
  rating PUT                                raw=    11.8ms  adjusted=     9.5ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    11.1ms  adjusted=     8.8ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    15.6ms  adjusted=    13.3ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     7.0ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    10.3ms  adjusted=     8.0ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    17.0ms  adjusted=    14.7ms  budget(read)=50ms  PASS

perf:smoke OK
```

## Variance across 4 back-to-back runs (same seed, same server process)

| check | run1 adjusted p95 | run2 | run3 | run4 | verdict |
|---|---|---|---|---|---|
| reviewer queue | 13.3ms PASS | 15.5ms PASS | 14.6ms PASS | 19.9ms PASS | **4/4 PASS, wide margin (13.3-19.9ms vs 50ms budget)** |
| plan results (page 1) | 14.7ms PASS | 17.9ms PASS | 14.0ms PASS | 17.1ms PASS | stable, wide margin |
| schedule.ics (bare, whole agenda) | 1.8ms PASS | 1.7ms PASS | 1.6ms PASS | 2.2ms PASS | stable, wide margin |
| event overview | 17.3ms PASS | 20.2ms PASS | 18.9ms PASS | 21.8ms PASS | **4/4 PASS — the 1/4 FAIL w16-c saw at 55.8ms did NOT reproduce** |
| schedule.ics 150 ids | 41.6ms PASS | 65.7ms PASS | 60.1ms PASS | 68.6ms PASS | noisy but PASS every run, same pattern as w16-c |
| everything else (16 checks) | PASS | PASS | PASS | PASS | stable |

All 21 checks PASSED on all 4 runs (84/84 individual check-results PASS).

Exit codes across the 4 runs: `0, 0, 0, 0`.

## Grading against the three named items

### (i) reviewer queue — DEC-449 acceptance: PASS, no surviving mechanism

Measured 13.3-19.9ms adjusted p95 across all 4 runs, well under the 50ms
read budget — a large margin, not borderline. This is the measured number,
not the expectation: down from w16-c's pre-fix 54-88ms (4/4 FAIL). Since
every run passes with margin, there is no over-budget mechanism to name at
file:line for this item; DEC-449's fix (`88aa7e1`, deleting the chunked
per-90-id track lookup in `resolveReviewerSubmissions`,
`src/server/repo/review/submissions.ts`, and the chunked
`countEvaluationsBySubmission` param in
`src/server/repo/review/evaluations.ts`) is confirmed effective at this
seed's own unrestricted-reviewer, 2,000-submission scale, which is exactly
the shape w16-c identified as the bottleneck. **CLOSED.**

### (ii) plan results (page 1) and bare schedule.ics — still PASS

Both re-confirmed PASS on all 4 runs here, consistent with w16-c closing
them: plan results 14.0-17.9ms adjusted (vs 50ms budget); bare
schedule.ics 1.6-2.2ms adjusted (vs 150ms budget). No regression.
**Still CLOSED.**

### (iii) event overview flake (w16-c saw 1/4 FAIL at 55.8ms)

Does **not** reproduce here: 17.3ms, 20.2ms, 18.9ms, 21.8ms adjusted p95
across all 4 runs — 4/4 PASS, no run anywhere near the 50ms budget, let
alone over it. No query-shape open item to name at file:line for this
check on this measurement: the route's cost at this seed's scale is stable
and comfortably in-budget across this lane's four runs. Read as: w16-c's
single elevated reading (55.8ms out of an otherwise 19.5-26.1ms spread) was
consistent with transient host contention at that measurement time (w16-c's
own log documents five other concurrent node/wrangler processes, more than
this lane's three), not a reproducible query-shape defect. **No open item
raised by this lane for this check.**

## Summary

| # | item | w16-c (before this lane) | this run (task-w17-d, DEC-449 sha) | status |
|---|---|---|---|---|
| i | reviewer queue | 54-88ms adjusted, 4/4 FAIL | 13.3-19.9ms adjusted, 4/4 PASS | **CLOSED** — DEC-449 fix confirmed effective, no surviving over-budget mechanism |
| ii | plan results (page 1) | 16-35ms, 4/4 PASS | 14.0-17.9ms, 4/4 PASS | still CLOSED, re-confirmed |
| iii | bare schedule.ics | 0.8-8.8ms, 4/4 PASS | 1.6-2.2ms, 4/4 PASS | still CLOSED, re-confirmed |
| iv | event overview (w16-c's 1/4 flake) | 19.5-55.8ms, 1/4 FAIL | 17.3-21.8ms, 4/4 PASS | did not reproduce; no open item raised |

## Open items

None raised by this lane. All 21 checks PASSED on all 4 runs at the sha
measured above.

OPEN ITEMS: 0
RESULT: PASS
