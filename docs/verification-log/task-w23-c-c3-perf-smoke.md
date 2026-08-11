# task-w23-c — STAGE-1 EXIT GATE 3/6: authoritative perf:smoke at the wave-22 tip (DEC-360/DEC-361)

## FROZEN SHA

`e3d558ea5628cbe1a7260489c2c5ddc1d487c7db` (`main` tip at worktree
creation, "scribe wave 23"). This is a log-only lane (DEC-360): the
only file created or modified in this worktree is this log.

## DEC-361 PRESENCE CHECK (before spending the seed cycle)

`git log --oneline` from the frozen sha confirms task-w21-a..e and
task-w22-a..e are all ancestors of `e3d558e`:

```
e3d558e scribe wave 23
3703b51 merge-train fix: DEC-357 test expects DEC-355's single chunked UPDATE
8574ee6 merge task-w22-e
34d276d DEC-357: batch CSV-import roster-add (set-based push-to-event)
530dd08 merge task-w22-d
32926e6 merge task-w22-c
1789274 DEC-356: CSV import looks up only the file's emails, not the whole org
d7122b0 DEC-355: make bulk acceptance planning set-based
33eeac7 merge task-w22-a
e34db85 DEC-353: bound bulk ZIP archive to a 40MB total-byte budget
cb32e0f merge task-w22-b
fc77740 DEC-354: close reviewer-assignment FK hole at write path and repo predicate
24155d9 scribe wave 22
7570072 merge task-w21-c
dfca1f7 docs: wave-21 authoritative perf:smoke gate log (DEC-352)
87b802c merge task-w21-e
0d8c941 merge task-w21-a
010d2c5 DEC-351: /progress and /remind stop loading full evaluation rows
58c13b9 task-w21-a: wave-21 gate build/test/tripwire/fresh-schema evidence @ c84d8ec (DEC-352)
005e367 merge task-w21-b
c84d8ec merge task-w21-d
c7d40f5 task-w21-b: full six-module walkthrough gate PASS at 27c751e (port 8821)
```

Five wave-22 code facts confirmed present by commit content at this sha:

- DEC-354 (`fc77740`): close reviewer-assignment FK hole at the write
  path and the repo predicate (`isSubmissionInReviewerScope` gets an
  event guard too — per the field guide's summary of DEC-354).
- DEC-353 (`e34db85`): bound bulk ZIP archive export to a 40MB
  total-byte budget, `buildZip` computed once.
- DEC-355 (`d7122b0`): make bulk acceptance planning set-based
  (set-based SELECTs replacing per-row loads).
- DEC-356 (`1789274`): CSV import looks up only the file's own emails,
  not the whole org (email-scoped, chunked, 2000-row cap).
- DEC-357 (`34d276d`, plus merge-train fix `3703b51`): batch
  CSV-import roster-add — one chunked load + one
  `updateSubmissionStatuses` call, `createSubmission` remains per-row.

All ten wave-21/wave-22 merges are present as ancestors. No gap found;
proceeded to the seed cycle.

## Setup

- `npm ci --prefer-offline --no-audit --no-fund --silent` (skipped,
  `node_modules` already present from worktree checkout).
- `npm run build` — `tsc --noEmit` (root) + `tsc --noEmit -p
  app/tsconfig.json` + `vite build --config app/vite.config.ts` — PASS,
  no type errors, SPA bundle built clean.
- `rm -rf .wrangler/state`
- `npm run db:migrate` — `wrangler d1 migrations apply chautauqua
  --local` — all migrations `0000` through `0018` applied, each ✅.
- `npm run seed` — organizer/contact/file seed + R2 headshot upload (8
  objects put into local `chautauqua-files` bucket) — completed clean.
- `npm run perf:seed` — DEC-088 scale (2,000 submissions / 300 accepted
  / 800 contacts) plus DEC-347's 1,200 file rows with real
  `previous_file_id` version chains and 6,000 evaluations — D1 execute
  batch completed, every sub-batch `"success": true`.
- `.dev.vars` written with `DEV_MODE=1` and
  `PUBLIC_BASE_URL=http://localhost:8852` (port `c` per DEC-361's wave
  port table: b=8851 c=8852 d=8853 f=8855).
- `./node_modules/.bin/wrangler dev --port 8852` — started clean,
  `[wrangler:info] Ready on http://localhost:8852`, all bindings
  (KV/EMAIL/DB/FILES/ASSETS + env vars) attached, no port conflict.

## Measurement

`PERF_URL=http://localhost:8852 npm run perf:smoke` — full verbatim
result table (overhead floor 2.8ms, raw ceiling 150ms):

```
p95 over 30 measured iterations (overhead floor: 2.8ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=     8.6ms  floor=   2.8ms  adjusted=     5.8ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    15.9ms  floor=   2.8ms  adjusted=    13.1ms  budget(read)=50ms  PASS
  submission detail                         raw=    19.2ms  floor=   2.8ms  adjusted=    16.4ms  budget(read)=50ms  PASS
  event overview                            raw=    19.0ms  floor=   2.8ms  adjusted=    16.2ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    16.1ms  floor=   2.8ms  adjusted=    13.2ms  budget(read)=50ms  PASS
  public sessions page                      raw=     4.9ms  floor=   2.8ms  adjusted=     2.1ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.4ms  floor=   2.8ms  adjusted=     2.6ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    49.5ms  floor=   2.8ms  adjusted=    46.7ms  budget(public)=150ms  PASS
  public speakers page                      raw=     4.4ms  floor=   2.8ms  adjusted=     1.5ms  budget(public)=150ms  PASS
  public gallery page                       raw=     5.7ms  floor=   2.8ms  adjusted=     2.9ms  budget(public)=150ms  PASS
  public schedule page                      raw=     7.9ms  floor=   2.8ms  adjusted=     5.1ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     3.4ms  floor=   2.8ms  adjusted=     0.6ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    81.7ms  floor=   2.8ms  adjusted=    78.9ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    24.3ms  floor=   2.8ms  adjusted=    21.4ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     6.7ms  floor=   2.8ms  adjusted=     3.9ms  budget(read)=50ms  PASS
  rating PUT                                raw=    12.8ms  floor=   2.8ms  adjusted=    10.0ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    12.9ms  floor=   2.8ms  adjusted=    10.1ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    22.0ms  floor=   2.8ms  adjusted=    19.2ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     5.5ms  floor=   2.8ms  adjusted=     2.7ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    12.7ms  floor=   2.8ms  adjusted=     9.9ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    32.7ms  floor=   2.8ms  adjusted=    29.9ms  budget(read)=50ms  PASS

perf:smoke OK
```

`perf:smoke OK`, **exit code 0**. All 21 timed checks PASS.

Pre-loop untimed assertions did not throw (the script would have
thrown and exited nonzero before printing the table otherwise;
`scripts/perf-smoke.ts:261` / `scripts/perf-smoke.ts:276` /
`scripts/perf-smoke.ts:284`):

- DEC-080 301-id `.ics` cap (`scripts/perf-smoke.ts:261`):
  `schedule.ics?ids=<301 ids>` returned 400 as required — the
  `DEC-080 cap assertion failed` throw path did not raise.
- DEC-105 CSV size probes: `export/submissions?format=csv` returned
  200 with >= 2001 lines (`scripts/perf-smoke.ts:276`,
  `assertMinCsvLines`); `exports/showflow.csv` returned 200 with >= 301
  lines (`scripts/perf-smoke.ts:284`, `assertMinCsvLines`). Neither
  call threw.

Server (`wrangler dev`, background PID 51617) killed after the run;
`lsof -iTCP:8852 -sTCP:LISTEN` confirmed no listener remains.

## GRADING RULE (DEC-352's distinction, per the task's instruction)

Unlike DEC-347's pre-fix baseline (`task-w20-d`, a pre-fix tip where a
newly-scaled over-budget check would have been a deferred/logged
finding), this run is at `e3d558e` — every wave-19/20/21/22 lane is
composed into the tip this log measures. Per the task's GRADING RULE,
any check over its raw ceiling or class budget at this sha is an OPEN
ITEM with file:line, not a deferred finding.

**No check was over budget or over the raw ceiling.** All 21 timed
checks PASS, each with headroom under its class budget. Closest
margins: `schedule.ics (bare, whole agenda)` at 78.9ms adjusted / 150ms
public budget, and `plan results (page 1)` at 29.9ms adjusted / 50ms
read budget.

### Diff against wave-21 baseline (`docs/verification-log/task-w21-c-c3-perf-smoke.md`)

Comparing this run's adjusted p95 to the wave-21 (`c84d8ec`) adjusted
p95 for each of the 21 checks:

| check | w21 adjusted | w23 adjusted | delta |
|---|---|---|---|
| submissions list (page 1) | 16.2ms | 5.8ms | -64.2% (improved) |
| submissions list (q=Kubernetes) | 17.6ms | 13.1ms | -25.6% (improved) |
| submission detail | 31.5ms | 16.4ms | -47.9% (improved) |
| event overview | 34.8ms | 16.2ms | -53.4% (improved) |
| organizer agenda (300 accepted) | 41.3ms | 13.2ms | -68.0% (improved) |
| public sessions page | 2.3ms | 2.1ms | -8.7% |
| public agenda | 9.5ms | 2.6ms | -72.6% (improved) |
| schedule.ics 150 ids | 82.3ms | 46.7ms | -43.3% (improved) |
| public speakers page | 0.0ms | 1.5ms | n/a (baseline floor-clamped to 0; absolute value trivial) |
| public gallery page | 0.0ms | 2.9ms | n/a (same) |
| public schedule page | 0.0ms | 5.1ms | n/a (same) |
| agenda.ics | 0.0ms | 0.6ms | n/a (same) |
| schedule.ics (bare, whole agenda) | 72.8ms | 78.9ms | +8.4% |
| plan progress (12 reviewers) | 26.1ms | 21.4ms | -18.0% (improved) |
| contacts list (q=perf) | 0.0ms | 3.9ms | n/a (baseline floor-clamped to 0) |
| rating PUT | 5.2ms | 10.0ms | **+92.3%** (WATCH ITEM) |
| onboarding grid (800 speakers x 5 tasks) | 7.5ms | 10.1ms | **+34.7%** (WATCH ITEM) |
| reviewer queue | 13.7ms | 19.2ms | **+40.1%** (WATCH ITEM) |
| email log list (page 1) | 2.3ms | 2.7ms | +17.4% |
| files library (page 1) | 19.9ms | 9.9ms | -50.3% (improved) |
| plan results (page 1) | 29.9ms | 29.9ms | 0.0% |

Three checks regressed by more than 25% relative to the wave-21
baseline while still remaining comfortably under budget — these are
**watch items**, recorded per the task's instruction, not open items:

- **rating PUT**: 5.2ms -> 10.0ms adjusted (+92.3%), still well under
  the 100ms write budget (10.0ms is 10% of budget).
- **onboarding grid (800 speakers x 5 tasks)**: 7.5ms -> 10.1ms
  adjusted (+34.7%), still well under the 50ms read budget (20.2% of
  budget).
- **reviewer queue**: 13.7ms -> 19.2ms adjusted (+40.1%), still under
  the 50ms read budget (38.4% of budget).

These three checks all sit in the single-digit-to-low-double-digit
millisecond range on an inherently noisy local `wrangler dev` D1
harness; the deltas are watch items for a future wave to trend, not
signals of a budget violation. No file:line is attached because no
regression exceeded budget or the raw ceiling — DEC-352 only requires
file:line evidence for OPEN ITEMS, and none of these are open items.

Checks whose w21 baseline adjusted p95 floor-clamped to 0.0ms (public
speakers page, public gallery page, public schedule page, agenda.ics,
contacts list) cannot produce a meaningful percentage delta (division
by zero); their w23 absolute values (0.6ms-5.1ms) remain trivial
against 50-150ms budgets and are not flagged.

## OPEN ITEMS

None. OPEN ITEMS: 0

## RESULT

PASS

## RECHECK SHA

Not applicable — no OPEN ITEM was found, so no fix/recheck cycle was
needed. The measured sha is `e3d558ea5628cbe1a7260489c2c5ddc1d487c7db`
(`main` tip at worktree creation, "scribe wave 23").

## POST-S DELTA

None observed beyond the watch items logged above (rating PUT,
onboarding grid, reviewer queue — all >25% regressed vs. wave-21 yet
still well under budget). Per DEC-280/DEC-361, any future post-S delta
discovered against this result is a delta to log, never a STOP.
