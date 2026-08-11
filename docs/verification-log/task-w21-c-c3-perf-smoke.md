# task-w21-c — wave-21 authoritative perf:smoke gate (DEC-352)

## FROZEN SHA

`c84d8ec` (`main` tip, "merge task-w21-d") — the run described in this
log measures at this sha, which contains every merged wave-19 and
wave-20 lane plus `task-w21-a` and `task-w21-d`. Per DEC-352 this is
the authoritative wave-21 perf gate; it need not wait for `task-w21-e`
(scoped only to `/progress` and `/remind` SELECT column lists under a
byte-identical-response contract, DEC-351) since DEC-352 names
`task-w21-c`'s log as authoritative independent of that lane's merge
order.

Mid-task process note: the worktree at this path was created twice.
The first `git worktree add` (at `main` tip `27c751e`) vanished from
under an in-progress `npm run build`/setup step — `git worktree list`
in the target repo no longer showed `task-w21-c` and the branch was
gone, matching the same class of harness/process loss recorded in
`task-w20-d`'s log. No commit had been made yet at that point, so no
work was lost. Recovered by re-running `git worktree add
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w21-c
-b task-w21-c main` at the same path; `main` had advanced from
`27c751e` to `c84d8ec` in the interim (task-w20-d and task-w21-d
merged), which is the sha this log measures.

## PRE-RUN INSPECTION (DEC-347 contract check, recorded before any run)

Read `scripts/perf-smoke.ts`: both DEC-347 checks are present, appended
after `email log list (page 1)` at the end of `checks[]`:

- `files library (page 1)` (scripts/perf-smoke.ts:486) — `cls: "read"`,
  `run: () => fetch(.../events/${PERF_EVENT_ID}/files?page=1&perPage=50`,
  no `optional` key present.
- `plan results (page 1)` (scripts/perf-smoke.ts:493) — `cls: "read"`,
  `run: () => fetch(.../plans/${PERF_PLAN_ID}/results?page=1&perPage=50`,
  no `optional` key present.

Read `scripts/perf-seed-lib.ts` / `scripts/perf-seed.ts`: the seed
writes deliverable `file` rows with real `previous_file_id` version
chains (`perfFileSpecs`, `PERF_FILE_ROWS_PER_SUBMISSION = 4`,
`PERF_FILE_COUNT = 1,200`, 3-version `presentation` chains + 1-version
`handout` chains per accepted submission — scripts/perf-seed.ts:284-296
inserts `previous_file_id` from each spec's `previousN`), and
`PERF_EVALUATION_COUNT` is raised from the pre-DEC-347 `600` to `6000`
(scripts/perf-seed-lib.ts:188).

**Result of pre-run inspection: no gap.** All four DEC-347 contract
items (two non-optional `read` checks present; file version chains
seeded; evaluation count raised) are satisfied at this sha —
`task-w20-d` is merged into `main` ahead of this run. No OPEN ITEM
against the pre-run inspection.

## Setup

- `npm ci --prefer-offline --no-audit --no-fund --silent` (skipped,
  `node_modules` present after the worktree-recreation).
- `npm run build` — `tsc --noEmit` root + `tsc --noEmit -p
  app/tsconfig.json` + `vite build` — PASS, no errors.
- `rm -rf .wrangler/state`
- `npm run db:migrate` — 19 migrations `0000` through `0018`, all
  applied clean (`✅` for each in the table).
- `npm run seed` — organizer identity + R2 headshot seeding, 8 objects
  put into local `chautauqua-files` bucket.
- `npm run perf:seed` — DEC-088 2,000 submissions / 300 accepted / 800
  contacts scale plus the DEC-347 1,200 file rows and 6,000-evaluation
  seed; D1 execute batch completed, all sub-batches reported
  `"success": true`.
- `.dev.vars` written with `DEV_MODE=1` and
  `PUBLIC_BASE_URL=http://localhost:8822` (port `c` per the wave-21
  port table, DEC-349/DEC-352).
- `./node_modules/.bin/wrangler dev --port 8822` — started clean,
  `[wrangler:info] Ready on http://localhost:8822`, all bindings
  (KV/EMAIL/DB/FILES/ASSETS + env vars) attached.

## Measurement

`PERF_URL=http://localhost:8822 npm run perf:smoke` — full verbatim
result table (overhead floor 6.0ms, raw ceiling 150ms):

```
p95 over 30 measured iterations (overhead floor: 6.0ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=    22.3ms  floor=   6.0ms  adjusted=    16.2ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    23.7ms  floor=   6.0ms  adjusted=    17.6ms  budget(read)=50ms  PASS
  submission detail                         raw=    37.6ms  floor=   6.0ms  adjusted=    31.5ms  budget(read)=50ms  PASS
  event overview                            raw=    40.8ms  floor=   6.0ms  adjusted=    34.8ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    47.3ms  floor=   6.0ms  adjusted=    41.3ms  budget(read)=50ms  PASS
  public sessions page                      raw=     8.4ms  floor=   6.0ms  adjusted=     2.3ms  budget(public)=150ms  PASS
  public agenda                             raw=    15.5ms  floor=   6.0ms  adjusted=     9.5ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    88.4ms  floor=   6.0ms  adjusted=    82.3ms  budget(public)=150ms  PASS
  public speakers page                      raw=     5.1ms  floor=   6.0ms  adjusted=     0.0ms  budget(public)=150ms  PASS
  public gallery page                       raw=     4.6ms  floor=   6.0ms  adjusted=     0.0ms  budget(public)=150ms  PASS
  public schedule page                      raw=     5.5ms  floor=   6.0ms  adjusted=     0.0ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     3.2ms  floor=   6.0ms  adjusted=     0.0ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    78.8ms  floor=   6.0ms  adjusted=    72.8ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    32.1ms  floor=   6.0ms  adjusted=    26.1ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     5.0ms  floor=   6.0ms  adjusted=     0.0ms  budget(read)=50ms  PASS
  rating PUT                                raw=    11.3ms  floor=   6.0ms  adjusted=     5.2ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    13.5ms  floor=   6.0ms  adjusted=     7.5ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    19.7ms  floor=   6.0ms  adjusted=    13.7ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     8.3ms  floor=   6.0ms  adjusted=     2.3ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    25.9ms  floor=   6.0ms  adjusted=    19.9ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    35.9ms  floor=   6.0ms  adjusted=    29.9ms  budget(read)=50ms  PASS

perf:smoke OK
```

`perf:smoke OK`, **exit code 0**. All 21 timed checks PASS.

Pre-loop untimed assertions did not throw (the script would have
thrown and exited nonzero before printing the table otherwise):

- DEC-080 301-id `.ics` cap: `schedule.ics?ids=<301 ids>` returned 400
  as required (`schedule.ics with 301 ids expected 400, got 400` path
  did not raise).
- DEC-105 CSV size probes: `export/submissions?format=csv` returned
  200 with >= 2001 lines; `exports/showflow.csv` returned 200 with >=
  301 lines. Neither `assertMinCsvLines` call threw.

Server (`wrangler dev`) killed after the run via the background task's
process group; `lsof -i :8822` confirmed no listener remains.

## GRADING RULE (DEC-352 / stated per the task's instruction)

Unlike `task-w20-d`'s DEC-347 baseline (a pre-fix tip, `dff7ae8`,
where a newly-scaled over-budget check would have been a logged
finding owned by its fix lane), this run is at `c84d8ec` — every
wave-19 and wave-20 fix lane (`task-w19-b/c/d/e`, `task-w20-a/b/c/d`)
is composed into the tip this log measures, plus `task-w21-a` and
`task-w21-d`. Per the task's GRADING RULE and DEC-352's designation of
this log as wave-21's authoritative perf-gate evidence, any check over
its raw ceiling or class budget at this sha would be an OPEN ITEM, not
a deferred/logged finding. **No check was over budget** — all 21 PASS,
including the two DEC-347 checks and the five checks DEC-347 flagged
as scale-sensitive (`files library (page 1)`, `plan results (page
1)`, `reviewer queue`, `plan progress`, `rating PUT`), each with
comfortable headroom under its class budget (closest margin: `files
library (page 1)` at 19.9ms adjusted / 50ms budget).

## OPEN ITEMS

None. OPEN ITEMS: 0

## RESULT

PASS

## RECHECK SHA

Not applicable — no OPEN ITEM was found, so no fix/recheck cycle was
needed. The measured sha is `c84d8ec` (`main` tip at run time,
"merge task-w21-d").

## POST-S DELTA

None observed. Per DEC-280, any future post-S delta discovered against
this result is a delta to log, never a STOP.
