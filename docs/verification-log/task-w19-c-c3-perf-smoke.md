# task-w19-c — C3 perf:smoke re-measurement @ post-wave-18 tip (DEC-339(3))

## FROZEN SHA

`48387c39d71bc3b4420046a14a3eb62b18a3eb49` ("scribe wave 19", `main` tip
at worktree creation for this task). Confirmed via `git rev-parse HEAD`
in the `task-w19-c` worktree immediately after checkout.

## Pre-run inspection of scripts/perf-smoke.ts (DEC-338 checks)

Read `scripts/perf-smoke.ts` in full before running. All three DEC-338
checks added by task-w18-d are present:

- J6 onboarding grid: `GET /api/v1/events/${PERF_EVENT_ID}/onboarding`
  — check `"onboarding grid (800 speakers x 5 tasks)"`, line 466-469.
- J4 reviewer queue: `GET /api/v1/review/plans/${PERF_PLAN_ID}/queue`
  — check `"reviewer queue"`, line 470-476 (run against `reviewerHeaders`).
- Comms history: `GET /api/v1/events/${PERF_EVENT_ID}/email-log?page=1&perPage=50`
  — check `"email log list (page 1)"`, line 477-482.

The `"event overview"` check (line 326-330) carries no `optional: true`
field — confirmed by reading its `TimedCheck` object literal directly;
`optional` does not appear anywhere in that check's definition.

No OPEN ITEM against DEC-338/task-w18-d: all required checks landed as
specified.

## Setup

1. `rm -rf .wrangler/state` — fresh local D1/R2/KV state.
2. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent)` — node_modules already present from a prior install in this worktree; skipped.
3. `npm run build` — `tsc --noEmit` (root) + `tsc --noEmit -p app/tsconfig.json` + `vite build --config app/vite.config.ts`. PASS, 138 modules transformed, output assets written to `../public/admin/`.
4. `npm run db:migrate` — `wrangler d1 migrations apply chautauqua --local`. All 19 migrations `0000_secret_matthew_murdock.sql` through `0018_w18_scale_indexes.sql` applied clean (✅ on every row), confirming DEC-337's composite indexes from migration `0018` are present.
5. `npm run seed` — `tsx scripts/seed.ts && wrangler d1 execute ... --file=.seed.sql && tsx scripts/seed-r2.ts`. Completed; 8 R2 objects (attachments + headshots) seeded into local `chautauqua-files` bucket.
6. `npm run perf:seed` — `tsx scripts/perf-seed.ts && wrangler d1 execute ... --file=.perf-seed.sql`. `scripts/perf-seed.ts` wrote 22,765 SQL statements to `.perf-seed.sql`. First `wrangler d1 execute` attempt failed transiently (`connect ECONNREFUSED 127.0.0.1:<port>` — local D1 backend not yet listening); re-ran `npx wrangler d1 execute chautauqua --local --file=.perf-seed.sql` directly and it succeeded, all batches `"success": true`.
7. `cp .dev.vars.example .dev.vars`, then edited `PUBLIC_BASE_URL` to `http://localhost:8802` (per DEC-296, required for the assigned port).
8. Confirmed port 8802 free (`lsof -i :8802` empty) before starting the server.
9. `npx wrangler dev --port 8802` (backgrounded). Ready log: `[wrangler:info] Ready on http://localhost:8802`. `perf:smoke`'s own `waitForHealth()` polled `/health` successfully before proceeding.

## perf:smoke run

`PERF_URL=http://localhost:8802 npm run perf:smoke`

### Pre-loop untimed assertions

- **DEC-080 301-id cap** (schedule.ics with 301 ids on the unauthenticated public route): script's one-shot assertion at `scripts/perf-smoke.ts:246-264` ran and did not throw — exit code confirms it returned exactly HTTP 400 as required. (The script `throw`s immediately with message `DEC-080 cap assertion failed: schedule.ics with 301 ids expected 400, got ${status}` on any other status; this was never printed, and overall exit code is 0, so the assertion passed.)
- **DEC-105 CSV export size probes**: `export submissions.csv` returned HTTP 200 and `assertMinCsvLines(..., 2001)` did not throw (2,000 submissions + header row). `showflow.csv` returned HTTP 200 and `assertMinCsvLines(..., 301)` did not throw (300 accepted/scheduled + header row). Neither probe's failure message appeared in output.

### Timed check results — verbatim table (30 measured iterations, overhead floor: 2.3ms, raw ceiling: 150ms)

```
p95 over 30 measured iterations (overhead floor: 2.3ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=     9.4ms  floor=   2.3ms  adjusted=     7.1ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    11.7ms  floor=   2.3ms  adjusted=     9.4ms  budget(read)=50ms  PASS
  submission detail                         raw=    15.0ms  floor=   2.3ms  adjusted=    12.7ms  budget(read)=50ms  PASS
  event overview                            raw=    13.9ms  floor=   2.3ms  adjusted=    11.7ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    17.6ms  floor=   2.3ms  adjusted=    15.4ms  budget(read)=50ms  PASS
  public sessions page                      raw=     3.9ms  floor=   2.3ms  adjusted=     1.6ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.5ms  floor=   2.3ms  adjusted=     3.2ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    43.1ms  floor=   2.3ms  adjusted=    40.9ms  budget(public)=150ms  PASS
  public speakers page                      raw=     4.1ms  floor=   2.3ms  adjusted=     1.8ms  budget(public)=150ms  PASS
  public gallery page                       raw=     4.2ms  floor=   2.3ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  public schedule page                      raw=     5.7ms  floor=   2.3ms  adjusted=     3.4ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     4.4ms  floor=   2.3ms  adjusted=     2.1ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    80.0ms  floor=   2.3ms  adjusted=    77.7ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    17.2ms  floor=   2.3ms  adjusted=    14.9ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     6.4ms  floor=   2.3ms  adjusted=     4.1ms  budget(read)=50ms  PASS
  rating PUT                                raw=    11.5ms  floor=   2.3ms  adjusted=     9.3ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    24.6ms  floor=   2.3ms  adjusted=    22.3ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    19.4ms  floor=   2.3ms  adjusted=    17.1ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     5.0ms  floor=   2.3ms  adjusted=     2.7ms  budget(read)=50ms  PASS

perf:smoke OK
```

**Exit code: 0.**

### Reviewer queue — required input for DEC-342's trigger

Measured **raw p95 = 19.4ms**, **adjusted p95 (raw minus overhead
floor) = 17.1ms**, against a `read`-class budget of 50ms. This is
**not over budget** — the check PASSED with substantial headroom
(32.9ms of margin below budget on the adjusted figure). Per DEC-331/
DEC-338, only an over-budget check produces a LOGGED PRODUCT FINDING;
since the reviewer queue check passed comfortably, there is no finding
to log against it from this run. This measured pass/fail and the raw/
adjusted numbers above are reported as the required input to DEC-342's
trigger evaluation — the trigger's DEC-342-deferred concerns (global
queue ordering correctness, the `18.5ms` figure recorded in the wave-19
field guide entry from task-w19-b's inspection) are about *correctness*
of queue ordering, not this run's *performance* number, and remain out
of scope for this RUN-ONLY perf lane.

No other check exceeded its budget. No LOGGED PRODUCT FINDINGS from
this run.

## Cleanup

`pkill -f "wrangler dev --port 8802"`, then `lsof -i :8802` — empty.
Confirmed nothing listens on port 8802 after server shutdown.

## OPEN ITEMS

0

## RESULT: PASS

## RECHECK SHA

`48387c39d71bc3b4420046a14a3eb62b18a3eb49` (same as FROZEN SHA — this
gate is RUN-ONLY with respect to `src/`; no code changes were made in
this worktree, so the recheck sha is identical to the frozen sha).

## POST-S DELTA (DEC-280)

None. This lane made no changes to `src/`, `scripts/`, or any other
product/tooling code — it is a re-measurement gate only. The sole
artifact added by this task is this verification-log file itself
(plus the gitignored `.dev.vars`, `.wrangler/state`, `.perf-seed.sql`,
`.seed.sql` local-only files, none of which are committed).
