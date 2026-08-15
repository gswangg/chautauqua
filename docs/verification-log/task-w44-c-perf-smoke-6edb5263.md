# task-w44-c: perf-smoke gate, frozen wave, at own tip @ 6edb5263

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644, DEC-453, DEC-069). FROZEN GATE
LANE: no change under `src/`, `app/src/`, `migrations/`, or `package.json`
(HARD SCOPE for this lane: `docs/verification-log/**` only).

## Three-sha boundary block (DEC-644, `npx tsx scripts/ref-state.ts`, verbatim)

`DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-a`, `task-w44-c`,
`task-w44-d`, `task-w44-f`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
--is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w44-b`,
`task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`,
`task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`,
`task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.`

## Sequence of syncs performed by this lane

1. Worktree created at `main` tip `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`
   (`git merge --no-edit main`: already up to date).
2. `npx tsx scripts/ref-state.ts` ancestry check: only one `task-w43-*` ref
   remains live (`task-w43-c`), confirmed ANCESTOR on the first check — zero
   sleep/retry cycles needed (STEP 0's "up to 8 retries" budget was not
   exercised).
3. Precondition check (STEP 0b): `grep -c PERF_SPEAKER scripts/perf-seed.ts`
   = 13, with inserts at lines 608, 627, 643, 659. RECIPE-BLOCKED mode NOT
   entered; the documented recipe alone reaches every check including the
   three portal rows.
4. Perf-smoke measurement taken at `6edb5263` (three runs, see below).
5. Re-synced with `git merge --no-edit main` immediately before naming the
   receipt's sha: reported "Already up to date" (no drift since the worktree
   was cut). First-parent product-code-bearing sha unchanged before and
   after (`14da2921a5be66408057712be877bc44c19de6c4` both times, via `git log
   --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json`),
   so the measurement taken at `6edb5263` is filed at that same sha (no
   fast-forward occurred).

## Methodology note (why three runs are re-seeded, per task-w35-a/w36-c/w40-c precedent)

The measured pass itself writes state (`bulk status change` cycles a batch of
pending-submission ids through `accept_queue`; `submission PATCH`, `schedule
slot PUT`, `task assignment check-off` all mutate rows), so a bare
`perf:smoke` re-run against the same D1 state without reseeding is not a
comparable reading. Per precedent, this lane reseeded (`npm run seed` ->
`npm run perf:seed`) and restarted `wrangler dev` before each of the three
runs, all inside one acquisition of the default `with-test-lock.sh` lock
(DEC-644) so no sibling gate compiled while timing. Port 8788 was used
throughout, per this lane's task briefing, to avoid colliding with the
walkthrough lane's port.

## Sequence run in order (inside one `with-test-lock.sh` acquisition)

`npm run db:migrate` (clean) -> `npm run predev` (`ensure-dev-vars` + `vite
build`, clean) -> for each of 3 runs: `npm run seed` -> `npm run perf:seed`
(perf-2k: 2000 submissions, 800 contacts) -> `npx wrangler dev --port 8788
--var PUBLIC_BASE_URL:http://localhost:8788` (health-polled to 200, 1 poll
each run) -> `PERF_URL=http://localhost:8788 npm run perf:smoke` -> kill
server.

## Run 1 verbatim (overhead floor 2.3ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    11.5ms  floor=   2.3ms  adjusted=     9.2ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    14.4ms  floor=   2.3ms  adjusted=    12.1ms  budget(read)=50ms  PASS
  submission detail                            raw=    16.8ms  floor=   2.3ms  adjusted=    14.5ms  budget(read)=50ms  PASS
  event overview                               raw=    24.0ms  floor=   2.3ms  adjusted=    21.7ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    20.4ms  floor=   2.3ms  adjusted=    18.1ms  budget(read)=50ms  PASS
  public sessions page                         raw=     6.7ms  floor=   2.3ms  adjusted=     4.4ms  budget(public)=150ms  PASS
  public agenda                                raw=     8.2ms  floor=   2.3ms  adjusted=     5.8ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    47.6ms  floor=   2.3ms  adjusted=    45.3ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.2ms  floor=   2.3ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    10.8ms  floor=   2.3ms  adjusted=     8.5ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=     9.9ms  floor=   2.3ms  adjusted=     7.6ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=     9.5ms  floor=   2.3ms  adjusted=     7.2ms  budget(public)=150ms  PASS
  public gallery page                          raw=     6.1ms  floor=   2.3ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public schedule page                         raw=     9.1ms  floor=   2.3ms  adjusted=     6.8ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     6.2ms  floor=   2.3ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=     9.7ms  floor=   2.3ms  adjusted=     7.4ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     3.6ms  floor=   2.3ms  adjusted=     1.3ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.5ms  floor=   2.3ms  adjusted=     2.2ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     6.7ms  floor=   2.3ms  adjusted=     4.3ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    10.7ms  floor=   2.3ms  adjusted=     8.4ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     7.3ms  floor=   2.3ms  adjusted=     5.0ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    23.1ms  floor=   2.3ms  adjusted=    20.8ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    26.4ms  floor=   2.3ms  adjusted=    24.1ms  budget(read)=50ms  PASS
  portal home                                  raw=    17.3ms  floor=   2.3ms  adjusted=    14.9ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    11.3ms  floor=   2.3ms  adjusted=     9.0ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    32.3ms  floor=   2.3ms  adjusted=    30.0ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    31.8ms  floor=   2.3ms  adjusted=    29.5ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=    13.8ms  floor=   2.3ms  adjusted=    11.5ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=    19.6ms  floor=   2.3ms  adjusted=    17.3ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    36.6ms  floor=   2.3ms  adjusted=    34.3ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    23.2ms  floor=   2.3ms  adjusted=    20.9ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     5.3ms  floor=   2.3ms  adjusted=     3.0ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     7.9ms  floor=   2.3ms  adjusted=     5.6ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     6.3ms  floor=   2.3ms  adjusted=     4.0ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    24.0ms  floor=   2.3ms  adjusted=    21.7ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    10.7ms  floor=   2.3ms  adjusted=     8.4ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    10.2ms  floor=   2.3ms  adjusted=     7.9ms  budget(write)=100ms  PASS
  bulk status change                           raw=    34.6ms  floor=   2.3ms  adjusted=    32.3ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    19.4ms  floor=   2.3ms  adjusted=    17.1ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     5.9ms  floor=   2.3ms  adjusted=     3.5ms  budget(write)=100ms  PASS

perf:smoke OK
```

39/39 PASS, 0 FAIL.

## Run 2 verbatim (overhead floor 2.8ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    13.4ms  floor=   2.8ms  adjusted=    10.5ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    17.7ms  floor=   2.8ms  adjusted=    14.9ms  budget(read)=50ms  PASS
  submission detail                            raw=    22.9ms  floor=   2.8ms  adjusted=    20.1ms  budget(read)=50ms  PASS
  event overview                               raw=    33.2ms  floor=   2.8ms  adjusted=    30.4ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    22.2ms  floor=   2.8ms  adjusted=    19.4ms  budget(read)=50ms  PASS
  public sessions page                         raw=     7.6ms  floor=   2.8ms  adjusted=     4.8ms  budget(public)=150ms  PASS
  public agenda                                raw=    10.2ms  floor=   2.8ms  adjusted=     7.4ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    49.6ms  floor=   2.8ms  adjusted=    46.7ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.7ms  floor=   2.8ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    11.8ms  floor=   2.8ms  adjusted=     9.0ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    11.6ms  floor=   2.8ms  adjusted=     8.8ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    15.1ms  floor=   2.8ms  adjusted=    12.3ms  budget(public)=150ms  PASS
  public gallery page                          raw=     9.6ms  floor=   2.8ms  adjusted=     6.7ms  budget(public)=150ms  PASS
  public schedule page                         raw=    11.2ms  floor=   2.8ms  adjusted=     8.4ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     8.4ms  floor=   2.8ms  adjusted=     5.6ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    11.5ms  floor=   2.8ms  adjusted=     8.7ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     5.8ms  floor=   2.8ms  adjusted=     2.9ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     6.4ms  floor=   2.8ms  adjusted=     3.6ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     7.3ms  floor=   2.8ms  adjusted=     4.5ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    16.2ms  floor=   2.8ms  adjusted=    13.4ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     8.0ms  floor=   2.8ms  adjusted=     5.2ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    22.4ms  floor=   2.8ms  adjusted=    19.6ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    23.0ms  floor=   2.8ms  adjusted=    20.2ms  budget(read)=50ms  PASS
  portal home                                  raw=    17.6ms  floor=   2.8ms  adjusted=    14.8ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    14.0ms  floor=   2.8ms  adjusted=    11.2ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    15.4ms  floor=   2.8ms  adjusted=    12.6ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    32.6ms  floor=   2.8ms  adjusted=    29.8ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.3ms  floor=   2.8ms  adjusted=     3.5ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     4.8ms  floor=   2.8ms  adjusted=     1.9ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    15.0ms  floor=   2.8ms  adjusted=    12.2ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    22.4ms  floor=   2.8ms  adjusted=    19.6ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     7.6ms  floor=   2.8ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     9.6ms  floor=   2.8ms  adjusted=     6.8ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     8.7ms  floor=   2.8ms  adjusted=     5.9ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    22.7ms  floor=   2.8ms  adjusted=    19.9ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    15.4ms  floor=   2.8ms  adjusted=    12.6ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=     8.2ms  floor=   2.8ms  adjusted=     5.3ms  budget(write)=100ms  PASS
  bulk status change                           raw=    38.1ms  floor=   2.8ms  adjusted=    35.3ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    24.9ms  floor=   2.8ms  adjusted=    22.0ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     6.1ms  floor=   2.8ms  adjusted=     3.3ms  budget(write)=100ms  PASS

perf:smoke OK
```

39/39 PASS, 0 FAIL.

## Run 3 verbatim (overhead floor 2.6ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    12.6ms  floor=   2.6ms  adjusted=    10.0ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    17.4ms  floor=   2.6ms  adjusted=    14.8ms  budget(read)=50ms  PASS
  submission detail                            raw=    23.1ms  floor=   2.6ms  adjusted=    20.5ms  budget(read)=50ms  PASS
  event overview                               raw=    31.3ms  floor=   2.6ms  adjusted=    28.7ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    22.6ms  floor=   2.6ms  adjusted=    20.0ms  budget(read)=50ms  PASS
  public sessions page                         raw=     8.0ms  floor=   2.6ms  adjusted=     5.4ms  budget(public)=150ms  PASS
  public agenda                                raw=    12.4ms  floor=   2.6ms  adjusted=     9.8ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    52.3ms  floor=   2.6ms  adjusted=    49.7ms  budget(public)=150ms  PASS
  public speakers page                         raw=     7.4ms  floor=   2.6ms  adjusted=     4.8ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    12.4ms  floor=   2.6ms  adjusted=     9.8ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    14.9ms  floor=   2.6ms  adjusted=    12.2ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    11.7ms  floor=   2.6ms  adjusted=     9.1ms  budget(public)=150ms  PASS
  public gallery page                          raw=    10.5ms  floor=   2.6ms  adjusted=     7.9ms  budget(public)=150ms  PASS
  public schedule page                         raw=    10.1ms  floor=   2.6ms  adjusted=     7.4ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     8.3ms  floor=   2.6ms  adjusted=     5.7ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    11.5ms  floor=   2.6ms  adjusted=     8.9ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     4.7ms  floor=   2.6ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     7.3ms  floor=   2.6ms  adjusted=     4.7ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     7.4ms  floor=   2.6ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    12.4ms  floor=   2.6ms  adjusted=     9.8ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     9.1ms  floor=   2.6ms  adjusted=     6.4ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    27.1ms  floor=   2.6ms  adjusted=    24.5ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    27.7ms  floor=   2.6ms  adjusted=    25.1ms  budget(read)=50ms  PASS
  portal home                                  raw=    19.5ms  floor=   2.6ms  adjusted=    16.9ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    11.2ms  floor=   2.6ms  adjusted=     8.6ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    17.3ms  floor=   2.6ms  adjusted=    14.7ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    29.6ms  floor=   2.6ms  adjusted=    27.0ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.7ms  floor=   2.6ms  adjusted=     4.1ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     6.3ms  floor=   2.6ms  adjusted=     3.7ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    15.3ms  floor=   2.6ms  adjusted=    12.7ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    22.9ms  floor=   2.6ms  adjusted=    20.3ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     7.5ms  floor=   2.6ms  adjusted=     4.9ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     6.8ms  floor=   2.6ms  adjusted=     4.1ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     9.0ms  floor=   2.6ms  adjusted=     6.3ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    26.5ms  floor=   2.6ms  adjusted=    23.9ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    16.0ms  floor=   2.6ms  adjusted=    13.4ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    13.9ms  floor=   2.6ms  adjusted=    11.3ms  budget(write)=100ms  PASS
  bulk status change                           raw=    31.4ms  floor=   2.6ms  adjusted=    28.8ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    22.1ms  floor=   2.6ms  adjusted=    19.5ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.8ms  floor=   2.6ms  adjusted=     2.1ms  budget(write)=100ms  PASS

perf:smoke OK
```

39/39 PASS, 0 FAIL.

## Summary

Total: 117 check-rows across 3 runs (39 rows x 3), 0 FAIL.

Named rows from the task briefing (adjusted p95, run1/run2/run3):
- `reviewer queue` (`src/routes/review/reviewer.ts`): 24.1ms / 20.2ms / 25.1ms
  — budget(read)=50ms — 3/3 PASS.
- `plan progress (page 1)` (`src/routes/review/plans-progress.ts`, flagged
  ADVISORY/marginal by 0213): 29.5ms / 29.8ms / 27.0ms — budget(read)=50ms —
  3/3 PASS. Fresh measurement finds no regression; the row sits comfortably
  under budget in all three runs (worst margin ~40% headroom).
- `plan results (page 1)`: 20.9ms / 19.6ms / 20.3ms — budget(read)=50ms —
  3/3 PASS.
- `files library (page 1)`: 34.3ms / 12.2ms / 12.7ms — budget(read)=50ms —
  3/3 PASS (run 1 shows more variance but still well under budget).
- `onboarding grid`: 20.8ms / 19.6ms / 24.5ms — budget(read)=50ms — 3/3 PASS.
- `portal home`: 14.9ms / 14.8ms / 16.9ms — budget(read)=50ms — 3/3 PASS.
- `portal tasks`: 9.0ms / 11.2ms / 8.6ms — budget(read)=50ms — 3/3 PASS.
- `portal submission detail`: 30.0ms / 12.6ms / 14.7ms — budget(read)=50ms —
  3/3 PASS.

RESULT: PASS — every one of 117 check-rows under its SPEC §7 budget across
all three reseeded runs at `6edb5263`. No regression, no FAIL, no local-D1
fixup required.
OPEN ITEMS: 0
