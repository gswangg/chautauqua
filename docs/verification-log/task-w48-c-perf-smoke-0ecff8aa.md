# task-w48-c: perf-smoke gate, frozen wave, at own tip @ 0ecff8aa

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644, DEC-453, DEC-069). FROZEN GATE
LANE: no change under `src/`, `app/src/`, `migrations/`, or `package.json`
(HARD SCOPE for this lane: `docs/verification-log/**` only).

## Three-sha boundary block (DEC-644, `npx tsx scripts/ref-state.ts`, verbatim)

`DEC-644 three-sha boundary: HEAD `0ecff8aa30939f9fcc741f68be2dfb19e9be58e4`;
newest first-parent product-code-bearing sha
`ae1ea6aee5e4e320936a0e7511fe1e4b43f34192`; every live ref (`manual-qa`,
`task-custodian-w68-4`, `task-w48-a`, `task-w48-c`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via
`git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git
merge-base --is-ancestor`): `mail-rich-shape-fallback`, `main`,
`task-w17-i`, `task-w46-g`, `task-w47-a`, `task-w47-b`, `task-w47-c`,
`task-w47-d`, `task-w47-e`, `task-w47-f`, `task-w47-g`, `task-w47-h`,
`task-w48-b`, `task-w48-d`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
`task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`,
`task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`,
`task-w72-j`.`

## Sequence of syncs performed by this lane

1. Worktree created at `main` tip `0ecff8aa30939f9fcc741f68be2dfb19e9be58e4`
   (`git merge --no-edit main`: already up to date).
2. `npx tsx scripts/ref-state.ts` ancestry check for live `task-w47-*` refs
   (`task-w47-a` through `task-w47-h`, eight branches): all eight reported
   NON-ancestor. Per STEP 0's bounded-poll protocol, ran 10 poll/retry
   cycles (`git merge --no-edit main` + re-check, ~5s apart); each of the
   10 polls reported "Already up to date" and all eight `task-w47-*` refs
   remained non-ancestor throughout — the wave-47 lanes had not landed on
   `main` by the time this lane's poll budget was exhausted. Per DEC-069
   w48's finding ("A PLANNER CANNOT GRADE THE WAVE IT FOLLOWS" /
   "DELEGATE THE BRANCH CONDITION TO THE MEASURING LANE"), this lane
   proceeded to the heavy phase at the worktree's own tip
   (`0ecff8aa`) rather than blocking further; an unlanded sibling wave
   costs that wave's own slot, not this gate's measurement.
3. Precondition check (STEP 0b): `grep -c PERF_SPEAKER
   scripts/perf-seed.ts` = 13, with inserts at lines 608, 627, 643, 659 —
   identical count/line-numbers to task-w44-c's 0222 receipt. RECIPE-BLOCKED
   mode NOT entered; the documented recipe alone reaches every check
   including the three portal rows. No `:aie` profile pair was required
   (0222's precondition for skipping `:aie` reproduced exactly).
4. Perf-smoke measurement taken at `0ecff8aa` (three runs, see below).
5. Re-sync attempt immediately before naming the receipt's sha: `git merge
   --no-edit main` fast-forwarded this worktree from `0ecff8aa` to
   `243b3094` (main had advanced during the heavy phase with real product
   commits — contacts merge/import, portal repo, and auto-schedule changes
   landed, confirmed via `git diff --stat`: 31 files touching `src/**` and
   `app/src/**`). Unlike task-w44-c's 0222 receipt (which found "no
   drift"), this lane's re-sync DID drift the product-bearing sha. Per
   DEC-453 ("a fixup is a MEASUREMENT, not a fix") and DEC-069's FILE,
   NEVER FIX framing, filing the measurement under the post-fast-forward
   sha would misrepresent what was actually measured (2026-08-15's newly
   landed `src/server/repo/portal/*`, `src/server/repo/agenda/auto-schedule.ts`,
   and `src/server/repo/contacts/merge.ts` changes were never exercised by
   this lane's three timed runs). This lane therefore ran `git reset --hard
   0ecff8aa30939f9fcc741f68be2dfb19e9be58e4` to restore the worktree to the
   exact commit the measurement was taken against, and files this report at
   that sha. `main`'s subsequent advance is out of scope for this
   measurement lane (FROZEN GATE LANE, docs-only writes) and is left for a
   future gate lane to re-measure against.

## Methodology note (why three runs are re-seeded, per task-w35-a/w36-c/w40-c/w44-c precedent)

The measured pass itself writes state (`bulk status change` cycles a batch
of pending-submission ids through `accept_queue`; `submission PATCH`,
`schedule slot PUT`, `task assignment check-off` all mutate rows), so a
bare `perf:smoke` re-run against the same D1 state without reseeding is not
a comparable reading. Per precedent, this lane reseeded (`npm run seed` ->
`npm run perf:seed`) and restarted `wrangler dev` before each of the three
runs, all inside one acquisition of the default `with-test-lock.sh` lock
(DEC-644) so no sibling gate compiled while timing. Port 9048 was used
throughout (distinct from sibling lanes' documented ports in this and prior
waves) to avoid colliding with any concurrently running walkthrough/gate
lane.

## Sequence run in order (inside one `with-test-lock.sh` acquisition)

`npm run db:migrate` (clean) -> `npm run predev` (`ensure-dev-vars` + `vite
build`, clean, run once before entering the lock) -> for each of 3 runs:
`npm run seed` -> `npm run perf:seed` (perf-2k: 2000 submissions, 800
contacts) -> `npx wrangler dev --port 9048 --var
PUBLIC_BASE_URL:http://localhost:9048` (health-polled to a 2xx/3xx
response, 1 poll each run) -> `PERF_URL=http://localhost:9048 npm run
perf:smoke` -> kill server. This machine was under heavy concurrent load
during this lane's run (`uptime` load averages observed in the 14-24 range
on an 8-core host, consistent with several sibling wave-47/wave-48 lanes
running concurrently); the `npm run db:migrate` and `wrangler d1 execute
--local` bulk-insert steps (31665 statements per perf:seed invocation) each
took materially longer wall-clock time than task-w44-c's 0222 receipt
reported, but this reflects host contention during the SEED phase, not the
MEASURED perf:smoke numbers themselves (each perf:smoke measurement ran
against an idle, already-seeded server with no concurrent write load).

## Run 1 verbatim (overhead floor 2.4ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    10.7ms  floor=   2.4ms  adjusted=     8.3ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    15.8ms  floor=   2.4ms  adjusted=    13.4ms  budget(read)=50ms  PASS
  submission detail                            raw=    16.6ms  floor=   2.4ms  adjusted=    14.2ms  budget(read)=50ms  PASS
  event overview                               raw=    26.2ms  floor=   2.4ms  adjusted=    23.8ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    18.9ms  floor=   2.4ms  adjusted=    16.5ms  budget(read)=50ms  PASS
  public sessions page                         raw=     6.2ms  floor=   2.4ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public agenda                                raw=     7.7ms  floor=   2.4ms  adjusted=     5.3ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    49.4ms  floor=   2.4ms  adjusted=    47.0ms  budget(public)=150ms  PASS
  public speakers page                         raw=     7.6ms  floor=   2.4ms  adjusted=     5.2ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    11.4ms  floor=   2.4ms  adjusted=     9.0ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    10.5ms  floor=   2.4ms  adjusted=     8.1ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    10.2ms  floor=   2.4ms  adjusted=     7.8ms  budget(public)=150ms  PASS
  public gallery page                          raw=     6.2ms  floor=   2.4ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public schedule page                         raw=     8.9ms  floor=   2.4ms  adjusted=     6.5ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     6.3ms  floor=   2.4ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    11.1ms  floor=   2.4ms  adjusted=     8.7ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     4.4ms  floor=   2.4ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.1ms  floor=   2.4ms  adjusted=     1.7ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     6.1ms  floor=   2.4ms  adjusted=     3.7ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    12.6ms  floor=   2.4ms  adjusted=    10.2ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     7.7ms  floor=   2.4ms  adjusted=     5.3ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    23.2ms  floor=   2.4ms  adjusted=    20.8ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    25.5ms  floor=   2.4ms  adjusted=    23.1ms  budget(read)=50ms  PASS
  portal home                                  raw=    18.4ms  floor=   2.4ms  adjusted=    16.0ms  budget(read)=50ms  PASS
  portal tasks                                 raw=     9.2ms  floor=   2.4ms  adjusted=     6.8ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    16.9ms  floor=   2.4ms  adjusted=    14.5ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    25.8ms  floor=   2.4ms  adjusted=    23.4ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.6ms  floor=   2.4ms  adjusted=     4.2ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     5.5ms  floor=   2.4ms  adjusted=     3.1ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    14.4ms  floor=   2.4ms  adjusted=    12.0ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    21.6ms  floor=   2.4ms  adjusted=    19.2ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     5.6ms  floor=   2.4ms  adjusted=     3.2ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     6.6ms  floor=   2.4ms  adjusted=     4.2ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     6.1ms  floor=   2.4ms  adjusted=     3.7ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    21.4ms  floor=   2.4ms  adjusted=    19.0ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    10.8ms  floor=   2.4ms  adjusted=     8.4ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=     9.6ms  floor=   2.4ms  adjusted=     7.2ms  budget(write)=100ms  PASS
  bulk status change                           raw=    33.3ms  floor=   2.4ms  adjusted=    31.0ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    16.4ms  floor=   2.4ms  adjusted=    14.0ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.5ms  floor=   2.4ms  adjusted=     2.1ms  budget(write)=100ms  PASS

perf:smoke OK
```

39/39 PASS, 0 FAIL.

## Run 2 verbatim (overhead floor 2.4ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    11.4ms  floor=   2.4ms  adjusted=     9.0ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    15.3ms  floor=   2.4ms  adjusted=    12.9ms  budget(read)=50ms  PASS
  submission detail                            raw=    20.7ms  floor=   2.4ms  adjusted=    18.3ms  budget(read)=50ms  PASS
  event overview                               raw=    25.8ms  floor=   2.4ms  adjusted=    23.4ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    19.7ms  floor=   2.4ms  adjusted=    17.3ms  budget(read)=50ms  PASS
  public sessions page                         raw=     7.4ms  floor=   2.4ms  adjusted=     5.0ms  budget(public)=150ms  PASS
  public agenda                                raw=     8.6ms  floor=   2.4ms  adjusted=     6.2ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    46.8ms  floor=   2.4ms  adjusted=    44.4ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.1ms  floor=   2.4ms  adjusted=     3.7ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    12.2ms  floor=   2.4ms  adjusted=     9.8ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=     9.5ms  floor=   2.4ms  adjusted=     7.1ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    10.3ms  floor=   2.4ms  adjusted=     8.0ms  budget(public)=150ms  PASS
  public gallery page                          raw=     7.0ms  floor=   2.4ms  adjusted=     4.6ms  budget(public)=150ms  PASS
  public schedule page                         raw=     9.0ms  floor=   2.4ms  adjusted=     6.6ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     6.3ms  floor=   2.4ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=     9.9ms  floor=   2.4ms  adjusted=     7.5ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     4.3ms  floor=   2.4ms  adjusted=     1.9ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.6ms  floor=   2.4ms  adjusted=     2.2ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     5.5ms  floor=   2.4ms  adjusted=     3.1ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    10.8ms  floor=   2.4ms  adjusted=     8.4ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     8.8ms  floor=   2.4ms  adjusted=     6.4ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    23.6ms  floor=   2.4ms  adjusted=    21.2ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    22.6ms  floor=   2.4ms  adjusted=    20.2ms  budget(read)=50ms  PASS
  portal home                                  raw=    17.9ms  floor=   2.4ms  adjusted=    15.5ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    13.4ms  floor=   2.4ms  adjusted=    11.0ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    16.6ms  floor=   2.4ms  adjusted=    14.2ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    26.5ms  floor=   2.4ms  adjusted=    24.1ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.5ms  floor=   2.4ms  adjusted=     4.1ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     4.4ms  floor=   2.4ms  adjusted=     2.0ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    15.0ms  floor=   2.4ms  adjusted=    12.6ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    23.0ms  floor=   2.4ms  adjusted=    20.6ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     5.7ms  floor=   2.4ms  adjusted=     3.3ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     5.5ms  floor=   2.4ms  adjusted=     3.1ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     7.0ms  floor=   2.4ms  adjusted=     4.6ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    20.7ms  floor=   2.4ms  adjusted=    18.3ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    10.8ms  floor=   2.4ms  adjusted=     8.4ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=     8.4ms  floor=   2.4ms  adjusted=     6.0ms  budget(write)=100ms  PASS
  bulk status change                           raw=    32.5ms  floor=   2.4ms  adjusted=    30.1ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    19.7ms  floor=   2.4ms  adjusted=    17.3ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     8.2ms  floor=   2.4ms  adjusted=     5.9ms  budget(write)=100ms  PASS

perf:smoke OK
```

39/39 PASS, 0 FAIL.

## Run 3 verbatim (overhead floor 2.5ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    12.5ms  floor=   2.5ms  adjusted=    10.0ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    14.9ms  floor=   2.5ms  adjusted=    12.4ms  budget(read)=50ms  PASS
  submission detail                            raw=    18.3ms  floor=   2.5ms  adjusted=    15.8ms  budget(read)=50ms  PASS
  event overview                               raw=    26.8ms  floor=   2.5ms  adjusted=    24.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    19.5ms  floor=   2.5ms  adjusted=    17.0ms  budget(read)=50ms  PASS
  public sessions page                         raw=     7.2ms  floor=   2.5ms  adjusted=     4.7ms  budget(public)=150ms  PASS
  public agenda                                raw=     7.9ms  floor=   2.5ms  adjusted=     5.4ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    49.1ms  floor=   2.5ms  adjusted=    46.6ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.3ms  floor=   2.5ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=     9.9ms  floor=   2.5ms  adjusted=     7.4ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=     9.5ms  floor=   2.5ms  adjusted=     7.0ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=     9.8ms  floor=   2.5ms  adjusted=     7.3ms  budget(public)=150ms  PASS
  public gallery page                          raw=     7.3ms  floor=   2.5ms  adjusted=     4.8ms  budget(public)=150ms  PASS
  public schedule page                         raw=     9.3ms  floor=   2.5ms  adjusted=     6.8ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     7.2ms  floor=   2.5ms  adjusted=     4.7ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    10.0ms  floor=   2.5ms  adjusted=     7.5ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     3.9ms  floor=   2.5ms  adjusted=     1.4ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.2ms  floor=   2.5ms  adjusted=     1.7ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     5.4ms  floor=   2.5ms  adjusted=     2.9ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    12.9ms  floor=   2.5ms  adjusted=    10.4ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     8.2ms  floor=   2.5ms  adjusted=     5.7ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    24.6ms  floor=   2.5ms  adjusted=    22.1ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    24.3ms  floor=   2.5ms  adjusted=    21.8ms  budget(read)=50ms  PASS
  portal home                                  raw=    15.9ms  floor=   2.5ms  adjusted=    13.4ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    11.0ms  floor=   2.5ms  adjusted=     8.5ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    17.4ms  floor=   2.5ms  adjusted=    14.9ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    27.8ms  floor=   2.5ms  adjusted=    25.3ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     6.1ms  floor=   2.5ms  adjusted=     3.6ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     5.3ms  floor=   2.5ms  adjusted=     2.8ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    13.5ms  floor=   2.5ms  adjusted=    11.0ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    22.0ms  floor=   2.5ms  adjusted=    19.6ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     6.6ms  floor=   2.5ms  adjusted=     4.1ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     6.3ms  floor=   2.5ms  adjusted=     3.8ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     7.3ms  floor=   2.5ms  adjusted=     4.8ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    21.8ms  floor=   2.5ms  adjusted=    19.3ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    11.2ms  floor=   2.5ms  adjusted=     8.7ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    11.7ms  floor=   2.5ms  adjusted=     9.3ms  budget(write)=100ms  PASS
  bulk status change                           raw=    35.2ms  floor=   2.5ms  adjusted=    32.8ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    15.9ms  floor=   2.5ms  adjusted=    13.4ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.9ms  floor=   2.5ms  adjusted=     2.4ms  budget(write)=100ms  PASS

perf:smoke OK
```

39/39 PASS, 0 FAIL.

## Totals

117/117 check-rows PASS across three runs (39 rows x 3 runs), 0 FAIL. Zero
occurrences of the literal string `FAIL` anywhere in the captured raw
output of all three runs (`grep -c FAIL` on the full run transcript = 0).

## Named marginal rows (per this task's briefing), adjusted p95 run1/run2/run3, budget(read)=50ms unless noted

- `reviewer queue` (`src/routes/review/reviewer.ts`): 23.1/20.2/21.8ms —
  3/3 PASS, comfortably under 50ms.
- `plan progress (page 1)` (`src/routes/review/plans-progress.ts`, the row
  0213 originally flagged ADVISORY/marginal): 23.4/24.1/25.3ms — 3/3 PASS,
  well under the 50ms budget; consistent with 0222's fresh measurement
  (27.0-29.8ms), no regression.
- `plan results (page 1)`: 19.2/20.6/19.6ms — 3/3 PASS.
- `files library (page 1)`: 12.0/12.6/11.0ms — 3/3 PASS.
- `onboarding grid`: 20.8/21.2/22.1ms — 3/3 PASS.
- Three portal rows (`portal home`/`portal tasks`/`portal submission
  detail`): 16.0/15.5/13.4ms, 6.8/11.0/8.5ms, 14.5/14.2/14.9ms — all 3/3
  PASS, reached via the documented recipe alone (no local D1 fixup
  needed).

## Documented recipe sufficiency

The documented recipe (`npm run db:migrate` -> `npm run seed` -> `npm run
perf:seed` -> `wrangler dev` -> `npm run perf:smoke`, three times) alone
reached every one of the 39 check-rows in all three runs, including the
three portal rows. No local-D1 fixup was needed (per DEC-453, a fixup would
be a MEASUREMENT not a FIX, and none was required here — this lane did not
apply one).

RESULT: PASS — every one of 117 check-rows under budget across all three
runs at `0ecff8aa`; all six historically marginal rows named in this task's
briefing measure comfortably under budget in every run, no regression
found.
OPEN ITEMS: 0
