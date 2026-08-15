# task-w40-c: perf-smoke gate, default profile, at own tip @ 2e99b272

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644, DEC-453, DEC-069). FROZEN WAVE:
no change under `src/`, `app/src/`, `migrations/`, or `package.json`. Fixed
nothing under those paths. This is the closing measurement for wave 39's two
SPEC §7 read-budget fixes.

## Three-sha boundary block (DEC-644, `npm run ref-state`, verbatim)

`DEC-644 three-sha boundary: HEAD `2e99b272ef26a3a0bd57150441a97670b15a3ed8`;
newest first-parent product-code-bearing sha
`ed5c679e59828c5600cb84b51208056f7e38a445`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w40-b`, `task-w40-c`, `task-w40-d`,
`task-w40-e`, `task-w40-f`, `task-w40-g`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
--is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`,
`task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`,
`task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`,
`task-w72-h`, `task-w72-i`, `task-w72-j`.`

No `task-w39-*` ref remains live (all merged and deleted since wave 40's
`main` snapshot named in this lane's task briefing, `57f683ce`) — this
lane's own `git branch -a | grep task-w39` returned only `task-w39-e` at
STEP 0 (before the mid-lane sync below), already confirmed ANCESTOR.

Sequence of syncs performed by this lane (STEP 0 / re-sync before naming the
final sha, per DEC-069 wave-40 "sync before you name a sha"):
1. Worktree created at `main` tip `14db7b30fb424954f9a3604563ff6a95ae5d1127`
   (`git merge --no-edit main`: already up to date).
2. Precondition check (STEP 0b): `grep -c PERF_SPEAKER scripts/perf-seed.ts`
   = 13 (> 0) — task-w39-a's perf-speaker insert loop is present at this
   HEAD. RECIPE-BLOCKED mode NOT entered; the documented recipe alone
   reaches every check including the three portal rows.
3. Perf-smoke measurement taken at `14db7b30` (three runs, see below).
4. Re-synced with `git merge --no-edit main` immediately before naming the
   receipt's sha: fast-forwarded `14db7b30..2e99b272` (`merge task-w40-f`,
   bringing in three sibling gate-lane receipts — task-w40-a build+test+
   bundle, task-w40-b walkthrough, task-w40-d SPEC audit — plus
   `test/exit-predicate-corpus.test.ts`, all docs/test-only). Confirmed the
   newest product-code-bearing sha is unchanged before and after this
   fast-forward (`ed5c679e...` both times, via `git log --first-parent -1
   --format=%H -- src/ app/src/ migrations/ package.json`), so the
   measurement taken at `14db7b30` is unaffected by the sync and this
   receipt is filed at the post-sync HEAD `2e99b272`.

## Methodology note (why three runs are re-seeded, per task-w36-c precedent)

The measured pass itself writes state — `bulk status change` (alternates a
batch of 1000 pending-submission ids between `accept_queue`/`pending` across
35 total warmup+measured calls; 35 is odd, so the batch ends in
`accept_queue`, not restored to `pending`), `submission PATCH`, `schedule
slot PUT`, `task assignment check-off` — so a bare `perf:smoke` re-run
against the same D1 state without reseeding is not a comparable reading (a
first attempt without reseeding, run outside this lane's committed history,
reproduced task-w36-c's exact documented failure mode: run 2's
`fetchPendingSubmissionIds` throwing `expected at least 1000 pending
submissions, got 200` — 1200 seeded pending minus the 1000-id batch stuck in
`accept_queue` after run 1's odd call count). Per task-w35-a/task-w36-c
precedent, this lane reseeds (`npm run seed` -> `npm run perf:seed`) and
restarts `wrangler dev` before each of the three runs, all still inside one
acquisition of the default `with-test-lock.sh` lock (DEC-644) so no sibling
gate compiles while timing.

## Sequence run in order (inside one `with-test-lock.sh` acquisition)

`npm run db:migrate` (clean) -> `npm run predev` (`ensure-dev-vars` + `vite
build`, clean) -> for each of 3 runs: `npm run seed` -> `npm run perf:seed`
(perf-2k: 2000 submissions, 800 contacts) -> `npx wrangler dev --port 8812
--var PUBLIC_BASE_URL:http://localhost:8812` (health-polled to 200) ->
`PERF_URL=http://localhost:8812 npm run perf:smoke` -> kill server.

## Run 1 verbatim (overhead floor 2.5ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    12.4ms  floor=   2.5ms  adjusted=     9.9ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    17.5ms  floor=   2.5ms  adjusted=    15.0ms  budget(read)=50ms  PASS
  submission detail                            raw=    22.4ms  floor=   2.5ms  adjusted=    19.9ms  budget(read)=50ms  PASS
  event overview                               raw=    24.6ms  floor=   2.5ms  adjusted=    22.1ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    19.4ms  floor=   2.5ms  adjusted=    16.9ms  budget(read)=50ms  PASS
  public sessions page                         raw=     6.6ms  floor=   2.5ms  adjusted=     4.1ms  budget(public)=150ms  PASS
  public agenda                                raw=     8.0ms  floor=   2.5ms  adjusted=     5.5ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    47.5ms  floor=   2.5ms  adjusted=    45.0ms  budget(public)=150ms  PASS
  public speakers page                         raw=     5.8ms  floor=   2.5ms  adjusted=     3.3ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    10.4ms  floor=   2.5ms  adjusted=     7.9ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    10.0ms  floor=   2.5ms  adjusted=     7.5ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=     9.4ms  floor=   2.5ms  adjusted=     6.9ms  budget(public)=150ms  PASS
  public gallery page                          raw=     7.8ms  floor=   2.5ms  adjusted=     5.3ms  budget(public)=150ms  PASS
  public schedule page                         raw=     9.4ms  floor=   2.5ms  adjusted=     6.9ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     7.5ms  floor=   2.5ms  adjusted=     5.0ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    10.0ms  floor=   2.5ms  adjusted=     7.5ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     4.6ms  floor=   2.5ms  adjusted=     2.1ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.1ms  floor=   2.5ms  adjusted=     1.6ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     8.2ms  floor=   2.5ms  adjusted=     5.7ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    11.9ms  floor=   2.5ms  adjusted=     9.4ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     7.5ms  floor=   2.5ms  adjusted=     5.0ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    22.5ms  floor=   2.5ms  adjusted=    20.0ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    25.4ms  floor=   2.5ms  adjusted=    22.9ms  budget(read)=50ms  PASS
  portal home                                  raw=    20.6ms  floor=   2.5ms  adjusted=    18.1ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    13.1ms  floor=   2.5ms  adjusted=    10.6ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    17.0ms  floor=   2.5ms  adjusted=    14.5ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    25.7ms  floor=   2.5ms  adjusted=    23.2ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.8ms  floor=   2.5ms  adjusted=     4.3ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     5.2ms  floor=   2.5ms  adjusted=     2.7ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    14.3ms  floor=   2.5ms  adjusted=    11.7ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    22.8ms  floor=   2.5ms  adjusted=    20.3ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     7.3ms  floor=   2.5ms  adjusted=     4.8ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     8.3ms  floor=   2.5ms  adjusted=     5.8ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     6.9ms  floor=   2.5ms  adjusted=     4.4ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    23.5ms  floor=   2.5ms  adjusted=    21.0ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    18.0ms  floor=   2.5ms  adjusted=    15.5ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    10.7ms  floor=   2.5ms  adjusted=     8.2ms  budget(write)=100ms  PASS
  bulk status change                           raw=    42.9ms  floor=   2.5ms  adjusted=    40.4ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    21.4ms  floor=   2.5ms  adjusted=    18.9ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     6.0ms  floor=   2.5ms  adjusted=     3.5ms  budget(write)=100ms  PASS

perf:smoke OK
```

## Run 2 verbatim (overhead floor 2.4ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    11.7ms  floor=   2.4ms  adjusted=     9.3ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    15.0ms  floor=   2.4ms  adjusted=    12.6ms  budget(read)=50ms  PASS
  submission detail                            raw=    19.4ms  floor=   2.4ms  adjusted=    17.0ms  budget(read)=50ms  PASS
  event overview                               raw=    31.4ms  floor=   2.4ms  adjusted=    29.0ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    19.2ms  floor=   2.4ms  adjusted=    16.8ms  budget(read)=50ms  PASS
  public sessions page                         raw=     6.7ms  floor=   2.4ms  adjusted=     4.3ms  budget(public)=150ms  PASS
  public agenda                                raw=     8.6ms  floor=   2.4ms  adjusted=     6.2ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    46.9ms  floor=   2.4ms  adjusted=    44.5ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.2ms  floor=   2.4ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    10.0ms  floor=   2.4ms  adjusted=     7.6ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=     9.5ms  floor=   2.4ms  adjusted=     7.1ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=     9.4ms  floor=   2.4ms  adjusted=     7.0ms  budget(public)=150ms  PASS
  public gallery page                          raw=     7.4ms  floor=   2.4ms  adjusted=     5.0ms  budget(public)=150ms  PASS
  public schedule page                         raw=    10.2ms  floor=   2.4ms  adjusted=     7.8ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     7.0ms  floor=   2.4ms  adjusted=     4.6ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    10.7ms  floor=   2.4ms  adjusted=     8.3ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     3.4ms  floor=   2.4ms  adjusted=     1.1ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.4ms  floor=   2.4ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     6.1ms  floor=   2.4ms  adjusted=     3.7ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    12.7ms  floor=   2.4ms  adjusted=    10.3ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     9.0ms  floor=   2.4ms  adjusted=     6.6ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    22.4ms  floor=   2.4ms  adjusted=    20.0ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    25.4ms  floor=   2.4ms  adjusted=    23.0ms  budget(read)=50ms  PASS
  portal home                                  raw=    19.3ms  floor=   2.4ms  adjusted=    16.9ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    26.0ms  floor=   2.4ms  adjusted=    23.6ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    21.0ms  floor=   2.4ms  adjusted=    18.6ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    30.0ms  floor=   2.4ms  adjusted=    27.6ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.8ms  floor=   2.4ms  adjusted=     4.4ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     5.2ms  floor=   2.4ms  adjusted=     2.8ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    14.2ms  floor=   2.4ms  adjusted=    11.8ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    22.3ms  floor=   2.4ms  adjusted=    19.9ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     5.8ms  floor=   2.4ms  adjusted=     3.4ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     6.6ms  floor=   2.4ms  adjusted=     4.2ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     5.5ms  floor=   2.4ms  adjusted=     3.1ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    20.3ms  floor=   2.4ms  adjusted=    17.9ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    13.2ms  floor=   2.4ms  adjusted=    10.8ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=     9.1ms  floor=   2.4ms  adjusted=     6.7ms  budget(write)=100ms  PASS
  bulk status change                           raw=    32.8ms  floor=   2.4ms  adjusted=    30.4ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    19.2ms  floor=   2.4ms  adjusted=    16.8ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.3ms  floor=   2.4ms  adjusted=     1.9ms  budget(write)=100ms  PASS

perf:smoke OK
```

## Run 3 verbatim (overhead floor 2.4ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    11.8ms  floor=   2.4ms  adjusted=     9.4ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    14.4ms  floor=   2.4ms  adjusted=    12.0ms  budget(read)=50ms  PASS
  submission detail                            raw=    19.9ms  floor=   2.4ms  adjusted=    17.6ms  budget(read)=50ms  PASS
  event overview                               raw=    31.1ms  floor=   2.4ms  adjusted=    28.7ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    19.1ms  floor=   2.4ms  adjusted=    16.7ms  budget(read)=50ms  PASS
  public sessions page                         raw=     6.8ms  floor=   2.4ms  adjusted=     4.4ms  budget(public)=150ms  PASS
  public agenda                                raw=     8.2ms  floor=   2.4ms  adjusted=     5.8ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    46.9ms  floor=   2.4ms  adjusted=    44.5ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.1ms  floor=   2.4ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    10.1ms  floor=   2.4ms  adjusted=     7.7ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    10.0ms  floor=   2.4ms  adjusted=     7.6ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=     9.8ms  floor=   2.4ms  adjusted=     7.4ms  budget(public)=150ms  PASS
  public gallery page                          raw=     6.4ms  floor=   2.4ms  adjusted=     4.0ms  budget(public)=150ms  PASS
  public schedule page                         raw=    10.8ms  floor=   2.4ms  adjusted=     8.4ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     7.4ms  floor=   2.4ms  adjusted=     5.0ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    11.9ms  floor=   2.4ms  adjusted=     9.6ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     3.5ms  floor=   2.4ms  adjusted=     1.1ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     3.9ms  floor=   2.4ms  adjusted=     1.5ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     6.0ms  floor=   2.4ms  adjusted=     3.6ms  budget(read)=50ms  PASS
  rating PUT                                   raw=     8.5ms  floor=   2.4ms  adjusted=     6.1ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     8.1ms  floor=   2.4ms  adjusted=     5.7ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    23.5ms  floor=   2.4ms  adjusted=    21.2ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    27.1ms  floor=   2.4ms  adjusted=    24.8ms  budget(read)=50ms  PASS
  portal home                                  raw=    19.0ms  floor=   2.4ms  adjusted=    16.6ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    12.0ms  floor=   2.4ms  adjusted=     9.6ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    17.4ms  floor=   2.4ms  adjusted=    15.0ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    24.6ms  floor=   2.4ms  adjusted=    22.2ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     7.1ms  floor=   2.4ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     5.0ms  floor=   2.4ms  adjusted=     2.6ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    13.0ms  floor=   2.4ms  adjusted=    10.7ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    32.5ms  floor=   2.4ms  adjusted=    30.1ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     5.5ms  floor=   2.4ms  adjusted=     3.1ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     5.6ms  floor=   2.4ms  adjusted=     3.2ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     7.1ms  floor=   2.4ms  adjusted=     4.7ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    20.9ms  floor=   2.4ms  adjusted=    18.6ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    15.1ms  floor=   2.4ms  adjusted=    12.8ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=     8.7ms  floor=   2.4ms  adjusted=     6.3ms  budget(write)=100ms  PASS
  bulk status change                           raw=    31.9ms  floor=   2.4ms  adjusted=    29.5ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    20.4ms  floor=   2.4ms  adjusted=    18.0ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.9ms  floor=   2.4ms  adjusted=     2.6ms  budget(write)=100ms  PASS

perf:smoke OK
```

## Grading, by name, at this boundary — every row 3 of 3 PASS, zero FAIL rows across all three runs (48 checks x 3 runs = 144 rows, `grep -c FAIL` = 0 in every run log)

- `reviewer queue` (`src/routes/review/reviewer.ts`, `GET
  /api/v1/review/plans/:id/queue`) — the wave-37 exit ledger's OPEN row at
  1-of-3 PASS: run1 adj 22.9ms PASS, run2 adj 23.0ms PASS, run3 adj 24.8ms
  PASS. **3 of 3 PASS, CLOSED at this boundary.** Markedly more stable than
  every prior reading (task-w36-c: 51.5/34.1/55.3ms adjusted, 1-of-3;
  task-w35-a: 46.4/44.0/45.1ms, 3-of-3 but close to budget) — comfortably
  under the 50ms read budget with margin (~2x) not previously observed.
- `plan progress (page 1)` (`src/routes/review/plans-progress.ts`) — the
  wave-37 exit ledger's other OPEN row at 1-of-3 PASS (task-w36-c:
  58.1/40.7/53.2ms adjusted, 1-of-3): run1 adj 23.2ms PASS, run2 adj 27.6ms
  PASS, run3 adj 22.2ms PASS. **3 of 3 PASS, CLOSED at this boundary,**
  also with roughly 2x margin under the 50ms budget vs the prior
  straddling-the-line readings.
- `plan results (page 1)`: run1 adj 20.3ms, run2 adj 19.9ms, run3 adj 30.1ms
  — 3 of 3 PASS, remains closed (consistent with every prior reading since
  task-w32-a's fix landed).
- `files library (page 1)`: run1 adj 11.7ms, run2 adj 11.8ms, run3 adj
  10.7ms — 3 of 3 PASS, remains closed.
- `onboarding grid (800 speakers x 5 tasks)`: run1 adj 20.0ms, run2 adj
  20.0ms, run3 adj 21.2ms — 3 of 3 PASS, remains closed.
- `portal home` / `portal tasks` / `portal submission detail` (DEC-338): all
  three PASS in all 3 runs (portal home 18.1/16.9/16.6ms adj; portal tasks
  10.6/23.6/9.6ms adj; portal submission detail 14.5/18.6/15.0ms adj), each
  comfortably under the 50ms read budget — reached via the documented
  recipe alone (no local D1 fixup needed; `scripts/perf-seed.ts`'s
  perf-speaker insert loop, task-w39-a, is present at this HEAD, `grep -c
  PERF_SPEAKER scripts/perf-seed.ts` = 13).

Every other check (submissions list, submission detail, event overview,
organizer agenda, all public-surface checks, contacts checks, rating PUT,
plan reviewers, email log list, pipeline list, org users list, all write
checks) also PASS 3 of 3, all three runs, no exceptions.

## RESULT

RESULT: PASS — all checks under budget in all three runs (144/144 rows
PASS, zero FAIL), including both wave-37-exit-ledger OPEN rows (`reviewer
queue`, `plan progress (page 1)`) now closing at 3-of-3 PASS with roughly
2x margin under their 50ms read budgets, confirming wave 39's two SPEC §7
read-budget fixes at `2e99b272ef26a3a0bd57150441a97670b15a3ed8`.

OPEN ITEMS: 0
