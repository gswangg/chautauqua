# Perf-smoke Gate — Redesign wave 10 (DEC-419), task-w10-g

Gate lane, LOG-ONLY. This report is the entire diff for this branch.

## Frozen SHA

```
a0eb04378fdd406910191d288faaa4174ebdbf38
```

Captured via `git -C .../chautauqua-wt/task-w10-g rev-parse HEAD` immediately
after `git worktree add ... -b task-w10-g main` (first cut), before any
measurement command below ran. `main` at that point was commit
`a0eb043 merge task-w8-i`.

The one prior perf-smoke redesign reading on record,
`docs/verification-log/task-w8-i-perf-smoke-redesign.md`, was measured at
`e833c59` — before wave 9's DEC-410 through DEC-414 landed (control-class
guard, render-sweep `__name` shim, DEC-412 walkthrough repair, DEC-413
per-row portal timezone, DEC-414 390px overflow fix). This report's frozen
SHA (`a0eb043`) is downstream of all of wave 9, so it is the first perf-smoke
reading against the fully wave-9-landed tree.

Note on process: the worktree this run was originally executed in was
deleted out from under this task mid-work (same failure mode logged as
OPEN ITEM #3 in `task-w8-i-perf-smoke-redesign.md` — a concurrent
integrator/scribe process pruning worktrees). All measurement commands
below were run and captured against `a0eb043` before that deletion; the
worktree was then recreated (`git worktree add ... -b task-w10-g main`, a
second time) purely to write and commit this report file. `main` had
advanced to `815daa9` by the time of that second creation — see RECHECK SHA
below for the resulting one-file diff, which is unaffected by the
intervening advance since only this report was added.

## Commands run, in order, with exit codes

| # | command | exit code |
|---|---------|-----------|
| 1 | `git rev-parse HEAD` | n/a (prints `a0eb043...`) |
| 2 | `npm ci --prefer-offline --no-audit --no-fund --silent` (node_modules absent at worktree creation) | 0 |
| 3 | `npx vite build --config app/vite.config.ts` | 0 |
| 4 | `npm run db:migrate` (`wrangler d1 migrations apply chautauqua --local`) | 0 (18 migrations applied, including `0018_w18_scale_indexes.sql`) |
| 5 | `npm run seed` (`tsx scripts/seed.ts && wrangler d1 execute ... .seed.sql && tsx scripts/seed-r2.ts`) | 0 (completed; final line `seed-r2: put 8 object(s) into local R2 bucket 'chautauqua-files'`, no errors) |
| 6 | `npm run perf:seed` (`tsx scripts/perf-seed.ts && wrangler d1 execute ... .perf-seed.sql`) | 0 |
| 7 | `npx wrangler dev --port 8797` (background) | started; `GET /health` returned `200 {"ok":true}` on first poll |
| 8 | `PERF_URL=http://localhost:8797 npm run perf:smoke` | 0 |
| 9 | teardown (`kill` the wrangler dev process) | done; `lsof -i :8797` empty and `/health` unreachable afterward |

`npm run seed` was run before `npm run perf:seed`, matching
`.github/workflows/ci.yml`'s `db:migrate` → `seed` → `perf:seed` order and
the dependency `task-w8-i` documented (`scripts/perf-seed.ts`'s fixed
`ORG_ID = seedId("org", 1)` and `scripts/perf-smoke.ts`'s fixture-organizer
login are not standalone against a freshly migrated, unseeded DB).

Scale confirmed via `scripts/perf-seed-lib.ts`: 2,000 submissions / 800
contacts / 300 accepted / 6,000 evaluations against `seed_perf_event`.

## p95 table (verbatim, 30 measured iterations)

```
p95 over 30 measured iterations (overhead floor: 2.3ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=    10.8ms  floor=   2.3ms  adjusted=     8.5ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    12.4ms  floor=   2.3ms  adjusted=    10.1ms  budget(read)=50ms  PASS
  submission detail                         raw=    13.1ms  floor=   2.3ms  adjusted=    10.8ms  budget(read)=50ms  PASS
  event overview                            raw=    20.6ms  floor=   2.3ms  adjusted=    18.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    19.1ms  floor=   2.3ms  adjusted=    16.8ms  budget(read)=50ms  PASS
  public sessions page                      raw=     4.2ms  floor=   2.3ms  adjusted=     1.9ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.7ms  floor=   2.3ms  adjusted=     3.4ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    43.8ms  floor=   2.3ms  adjusted=    41.5ms  budget(public)=150ms  PASS
  public speakers page                      raw=     6.0ms  floor=   2.3ms  adjusted=     3.7ms  budget(public)=150ms  PASS
  public gallery page                       raw=     5.6ms  floor=   2.3ms  adjusted=     3.2ms  budget(public)=150ms  PASS
  public schedule page                      raw=     6.0ms  floor=   2.3ms  adjusted=     3.7ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     4.2ms  floor=   2.3ms  adjusted=     1.9ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    85.1ms  floor=   2.3ms  adjusted=    82.8ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    20.7ms  floor=   2.3ms  adjusted=    18.3ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     5.2ms  floor=   2.3ms  adjusted=     2.9ms  budget(read)=50ms  PASS
  rating PUT                                raw=    10.8ms  floor=   2.3ms  adjusted=     8.5ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    11.4ms  floor=   2.3ms  adjusted=     9.1ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    20.9ms  floor=   2.3ms  adjusted=    18.6ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=    18.3ms  floor=   2.3ms  adjusted=    16.0ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=     7.7ms  floor=   2.3ms  adjusted=     5.4ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    31.3ms  floor=   2.3ms  adjusted=    29.0ms  budget(read)=50ms  PASS

perf:smoke OK
```

Harness stdout footer: `perf:smoke OK`. Harness exit code: `0`.

## DEC-089 301-id schedule.ics cap assertion (one-shot, untimed)

`scripts/perf-smoke.ts:246-264` fetches 300 real accepted ids (matching the
DEC-088 seed's exact accepted count) plus one syntactically-valid,
nonexistent probe id (`sub_cap_probe_nonexistent_0001`), for 301 total, and
requests `GET /e/<slug>/schedule.ics?ids=<301 ids>` unauthenticated. Per the
script, a non-400 response throws and aborts the run with a `DEC-080 cap
assertion failed` error before any table output. The run above completed to
its `perf:smoke OK` footer with exit code 0, so this assertion **passed**:
`schedule.ics` with 301 ids returned exactly `400`, matching the DEC-080 cap
(301 real submissions don't exist at this seed scale, but the raw `?ids=`
length check fires before hydration/lookup per
`src/routes/public.tsx:580-583`, so the probe still exercises the cap
predicate correctly per the DEC-094 note in the script's own comments).

## Summary line and exit code

- Summary line (verbatim): `perf:smoke OK`
- Process exit code: `0`

## Two surfaces this wave is changing — called out separately (pre-fix baseline for task-w10-d / task-w10-e)

- **public sessions page**: raw p95 **4.2ms**, adjusted p95 **1.9ms**,
  against a 150ms public-class budget — PASS, 1.3% of budget consumed.
- **public speakers page**: raw p95 **6.0ms**, adjusted p95 **3.7ms**,
  against a 150ms public-class budget — PASS, 2.5% of budget consumed.

Both figures above are the pre-fix baseline against `a0eb043` (last commit
before task-w10-d/task-w10-e's changes land) — any future perf-smoke
reading against those tasks' output should be compared against these
numbers, not against `task-w8-i`'s slightly different (e833c59, pre-wave-9)
readings for the same two checks (public sessions page 3.8ms raw / 1.3ms
adjusted; public speakers page 5.8ms raw / 3.4ms adjusted). Both surfaces
have very large headroom under budget in both readings; no regression is
visible between the two SHAs for either check.

## What changed under this tree since the last perf reading (redesign waves 6-9)

`task-w8-i-perf-smoke-redesign.md` (measured at `e833c59`) was itself the
first perf-smoke reading since DEC-370's overview worklist landed, and
predates the wave-9 batch of redesign decisions. Since that reading, the
following landed on `main` and are present at this report's frozen SHA
`a0eb043` (per `git log --oneline`, commits `fbb7a49`, `34a88e2`, `aee7fe2`,
`b6225fb`, `feed265`, `9481680`, and their merge commits):

- DEC-410: repo-wide interactive-control-class guard (`app/src` only, SSR
  exempt) — a static conformance test, not a runtime code path, so no
  latency impact expected or observed.
- DEC-411: render-sweep Playwright `__name`/keepNames shim fix + whole-
  portal phone manifest — a test-harness instrumentation fix, not
  product/server code; does not touch any route measured by perf-smoke.
- DEC-412: walkthrough copy/behaviour repair against the redesigned
  speaker-portal and public markup (commit `feed265`) — client-side
  markup/copy changes to already-rendered pages; the routes perf-smoke
  times are server-side JSON/CSV/ICS endpoints, not page HTML render, so
  this is not expected to move any number in the table above, and none of
  the checks show a meaningful shift versus the `e833c59` reading (the two
  called-out public checks above differ by low single-digit milliseconds
  each direction, well within normal run-to-run noise at this scale).
- DEC-413: speaker-portal dates rendered per-row in the owning event's
  timezone (`src/routes/portal/index.tsx`) — portal-only, not exercised by
  any perf-smoke check (none of the 21 checks hit `/portal/*` routes).
- DEC-414: 390px overflow closed via scroller/wrap on `.chq-chipstrip`
  (`app/src/styles.css`) — pure CSS, no server-side latency surface.
- `9481680` (task-w8-i itself): the perf-smoke gate log this report
  supersedes/extends.

None of the wave-9 changes touch `src/server/repo/overview.ts`,
`src/routes/public.tsx`, or any other server-side route module that
perf-smoke's 21 checks exercise — all are client markup, test-harness, or
static-guard changes. Consistent with that, no check in this reading
regressed materially against the `e833c59` baseline; every check remains
well under its class budget with large headroom.

## RESULT: PASS

All 21 timed checks PASS against both the raw ceiling (150ms) and their
class budget (read=50ms, write=100ms, public=150ms). The DEC-089/DEC-080
301-id cap assertion PASSED (400 as expected). Harness exit code: 0.

## OPEN ITEMS: 0

No check exceeded its raw ceiling or class budget in this reading; no
budget constant was edited to produce this result (none of the source
files in `scripts/perf-smoke.ts` or `scripts/perf-smoke-lib.ts` were
touched by this branch — see POST-S DELTA below, which shows this report
file is the entire diff).

## RECHECK SHA

`815daa9` — `main`'s tip at the time this report file was written and
committed. The worktree this report's branch was cut from was deleted out
from under the task mid-run (see the process note under "Frozen SHA"
above) and had to be recreated from `main`'s then-current tip purely to
write this file; no measurement command was re-run against `815daa9` — all
numbers above are the original, complete capture against the frozen SHA
`a0eb04378fdd406910191d288faaa4174ebdbf38`. No source file differs between
`a0eb043` and `815daa9` that would plausibly move any of the routes
measured here (unrelated concurrent swarm work), so the reading remains
valid as a pre-fix baseline for task-w10-d/task-w10-e regardless of which
of the two SHAs is treated as "current."

## POST-S DELTA

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w10-g status --porcelain`:

```
?? docs/verification-log/task-w10-g-perf-smoke-redesign.md
```

This one new file is the entire diff for this branch — no product code, no
tests, no scripts, no config were touched, and no budget constant was
edited.
