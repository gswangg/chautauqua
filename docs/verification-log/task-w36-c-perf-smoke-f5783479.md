# task-w36-c: perf-smoke gate, default profile, at own tip @ f5783479

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644 wave-36 amendment, DEC-453,
DEC-069 wave-36 amendment). FROZEN-PRODUCT lane: no change under src/,
app/src/, migrations/, or package.json. Fixed nothing under those paths.

## Three-sha boundary block (DEC-644 wave-36 amendment)

- HEAD (this worktree): `f5783479c7a1b8c96ef1506c3cfff1661fd6e338`
- INVALIDATED BY (`git log --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json`):
  `3a041507287b2dca3abeda3e0648a41ddeba9707`
- Live `task-w3*` ref ancestry (`git merge-base --is-ancestor <ref> HEAD`), refs enumerated from `git for-each-ref refs/heads/task-w3*` at read time:
  - `task-w35-a`: ANCESTOR
  - `task-w35-e`: ANCESTOR
  - `task-w35-f`: ANCESTOR
  - `task-w36-a`: ANCESTOR
  - `task-w36-b`: ANCESTOR
  - (`task-w32-a`, `task-w32-b`, `task-w35-b`, `task-w35-c`, `task-w35-d` no
    longer have live branch refs — merged and deleted — but their work is
    present in the tree, confirmed below by direct grep/measurement rather
    than by ref ancestry.)

Every live `task-w3*` ref is a proven ancestor of this reading's HEAD.

## Fixes credited with closing the two mandate rows, confirmed present

- `reviewer queue` (task-w32-b): `src/routes/review/reviewer.ts`'s
  post-slice hydration wave over `pagedIds UNION recusedIds` — grep-
  confirmed present at this sha (same file/shape task-w35-a's own receipt
  names).
- `plan results (page 1)` (task-w32-a): `src/routes/review/shared.ts`
  `rankPlanResults`/`hydrateResultsRows`, `src/routes/review/plans-progress.ts`
  — grep-confirmed present at this sha.
- Both fixes were already simultaneously present at task-w35-a's own
  boundary (`a0b8501b`), which is a proven ancestor of this HEAD (see
  above), so this reading carries the same review-side fix set task-w35-a
  measured, plus everything wave 36 has since landed under docs/.

## DEC-338 wave-35 portal rows (task-w35-d) — ancestor status

`task-w35-d` (the /portal perf-row lane) no longer has a live branch ref
(merged and deleted), so ancestry is confirmed by content rather than
`merge-base`: `scripts/perf-smoke.ts` at this sha contains the three
`"portal home"` / `"portal tasks"` / `"portal submission detail"` checks
(lines ~775-796) and `scripts/perf-seed-lib.ts` exports
`PERF_SPEAKER_EMAIL`/`PERF_SPEAKER_PASSWORD`/`PERF_SPEAKER_USER_ID`/
`PERF_SPEAKER_CONTACT_ID`/`perfSpeakerParticipantId`/
`perfSpeakerTaskAssignmentId` (lines ~730-810) with a passing
`test/perf-seed-lib.test.ts` suite for all of them. **task-w35-d IS an
ancestor of this HEAD** (its work is present in the tree main already
merged before this lane branched).

## BLOCKING DEFECT found and worked around for measurement purposes only (not fixed, per DEC-331/DEC-453 — this lane does not touch scripts/)

`scripts/perf-seed.ts` never calls any of the `PERF_SPEAKER_*` helpers
`scripts/perf-seed-lib.ts` exports — `grep -n "PERF_SPEAKER\|perfSpeaker"
scripts/perf-seed.ts` returns zero matches. The documented recipe (`npm run
seed` -> `npm run perf:seed` -> `wrangler dev` -> `npm run perf:smoke`)
therefore never mints the `seed_perf_speaker_user`/`seed_perf_speaker_contact`
row scripts/perf-smoke.ts's second `login()` call (`PERF_SPEAKER_EMAIL`/
`PERF_SPEAKER_PASSWORD`) depends on, so **every run of `npm run perf:smoke`
against a freshly-seeded default-profile DB throws inside `login()` with
`POST /login failed: expected 302, got 401` before a single check runs** —
the entire harness is blocked, not just the three portal rows.

FINDING (logged, not fixed — outside this lane's mandate, DEC-331/DEC-453):
owning module `scripts/perf-seed.ts` — it has no function that inserts the
`user`/`contact`/`participant`/`task_assignment` rows
`scripts/perf-seed-lib.ts`'s `PERF_SPEAKER_USER_ID` /
`PERF_SPEAKER_CONTACT_ID` / `perfSpeakerParticipantId` /
`perfSpeakerTaskAssignmentId` / `isPerfSpeakerTaskAssignmentComplete` were
written for. A future lane must add that insert loop to
`scripts/perf-seed.ts` (mirroring the existing reviewer-minting loop at
`scripts/perf-seed.ts:440-470`).

SECOND FINDING (same owning module, once the loop above is added): the
`perfSpeakerAcceptedIndexes` doc comment in `scripts/perf-seed-lib.ts`
(and `scripts/perf-smoke.ts`'s own comment at its `portalSubmissionId`
line) assumes the perf speaker's participant rows should be attached to
the first N ids of the profile's `acceptedSubmissionIds` array **in seed
order** (ascending seq, so `seed_perf_submission_1501..1505` for the
`default` profile) and that this equals `icsIds[0]`
(`fetchAcceptedSubmissionIds`, which reads
`GET /api/v1/events/:id/submissions?status=accepted` page 1). Measured:
that endpoint's default order is **descending**, so page 1 of the default
profile's 300 accepted submissions (seq 1501-1800) actually returns
`seed_perf_submission_1800, _1799, _1798, ...` — `icsIds[0]` is
`_1800`, not `_1501`. Anyone implementing the first finding's insert loop
using seed order (as the doc comment currently instructs) will reproduce
the same `portal submission detail failed during warmup: 404` this lane
hit on its first attempt (see below) — the loop must instead draw from the
admin list's actual page-1 (descending) order, or query it directly.

Because a total harness block would leave BOTH mandate rows (`reviewer
queue`, `plan results (page 1)`) unmeasured as well, this lane inserted the
missing rows directly into the local D1 database via `wrangler d1 execute
--file=<scratch sql>` (full statements + rationale in the lane's session
scratchpad, not committed to this repo) using the exact ids/values
`scripts/perf-seed-lib.ts` already exports, re-pointed at the ids
`icsIds[0..4]` actually resolve (`_1800`..`_1796`) per the second finding
above. This is a measurement-only local D1 fixup, re-applied after every
`npm run perf:seed` (which deletes and re-mints every `seed_perf_%` row,
including this fixup's) — **no file under scripts/, src/, app/src/,
migrations/, or package.json was touched**, and the fixup is not part of
this commit.

First attempt (before discovering the descending-order finding) inserted
the perf speaker's participants against `_1501..1505` (seed order) and
reproduced the exact 404 named above; second attempt corrected to
`_1800..1796` and all three portal checks passed thereafter.

## Sequence run in order

`npm run build` (green, tsc + vite) -> `npx tsx scripts/ensure-dev-vars.ts`
(created `.dev.vars`) -> `npm run db:migrate` (43 migrations, all clean) ->
`npm run seed` -> `npm run perf:seed` (perf-2k: 2000 submissions, 800
contacts) -> local D1 speaker fixup applied -> `npx wrangler dev --port
8972 --local` (confirmed up, `200` on `GET /health`) -> `PERF_URL=
http://localhost:8972 npm run perf:smoke`, three times, re-seeding
(`npm run seed` -> `npm run perf:seed` -> re-apply the D1 speaker fixup ->
restart the server) between each run, matching task-w35-a's own precedent
(the measured pass itself writes state — bulk status change, submission
PATCH, schedule slot PUT, task assignment check-off — so a bare re-run
against the same D1 state is not comparable). Server killed after each run
and after the final run.

## Run 1 verbatim (overhead floor 2.7ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    16.4ms  floor=   2.7ms  adjusted=    13.7ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    23.0ms  floor=   2.7ms  adjusted=    20.3ms  budget(read)=50ms  PASS
  submission detail                            raw=    26.0ms  floor=   2.7ms  adjusted=    23.4ms  budget(read)=50ms  PASS
  event overview                               raw=    37.4ms  floor=   2.7ms  adjusted=    34.8ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    23.1ms  floor=   2.7ms  adjusted=    20.5ms  budget(read)=50ms  PASS
  public sessions page                         raw=     8.3ms  floor=   2.7ms  adjusted=     5.6ms  budget(public)=150ms  PASS
  public agenda                                raw=    13.7ms  floor=   2.7ms  adjusted=    11.1ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    56.0ms  floor=   2.7ms  adjusted=    53.4ms  budget(public)=150ms  PASS
  public speakers page                         raw=     7.5ms  floor=   2.7ms  adjusted=     4.9ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    16.1ms  floor=   2.7ms  adjusted=    13.4ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    12.8ms  floor=   2.7ms  adjusted=    10.2ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    15.5ms  floor=   2.7ms  adjusted=    12.9ms  budget(public)=150ms  PASS
  public gallery page                          raw=     9.9ms  floor=   2.7ms  adjusted=     7.2ms  budget(public)=150ms  PASS
  public schedule page                         raw=    12.4ms  floor=   2.7ms  adjusted=     9.8ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=    10.8ms  floor=   2.7ms  adjusted=     8.1ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    13.3ms  floor=   2.7ms  adjusted=    10.7ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     8.9ms  floor=   2.7ms  adjusted=     6.2ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     6.6ms  floor=   2.7ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     9.6ms  floor=   2.7ms  adjusted=     6.9ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    15.3ms  floor=   2.7ms  adjusted=    12.6ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=    10.7ms  floor=   2.7ms  adjusted=     8.0ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    40.6ms  floor=   2.7ms  adjusted=    38.0ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    54.2ms  floor=   2.7ms  adjusted=    51.5ms  budget(read)=50ms  FAIL
      adjusted p95 51.5ms exceeds read class budget 50ms
  portal home                                  raw=    22.5ms  floor=   2.7ms  adjusted=    19.9ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    12.2ms  floor=   2.7ms  adjusted=     9.6ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    40.8ms  floor=   2.7ms  adjusted=    38.1ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    60.7ms  floor=   2.7ms  adjusted=    58.1ms  budget(read)=50ms  FAIL
      adjusted p95 58.1ms exceeds read class budget 50ms
  plan reviewers (page 1)                      raw=     8.4ms  floor=   2.7ms  adjusted=     5.7ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     8.8ms  floor=   2.7ms  adjusted=     6.1ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    19.5ms  floor=   2.7ms  adjusted=    16.8ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    33.2ms  floor=   2.7ms  adjusted=    30.6ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     7.4ms  floor=   2.7ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     9.0ms  floor=   2.7ms  adjusted=     6.3ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     7.9ms  floor=   2.7ms  adjusted=     5.3ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    26.5ms  floor=   2.7ms  adjusted=    23.9ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    14.1ms  floor=   2.7ms  adjusted=    11.5ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    14.5ms  floor=   2.7ms  adjusted=    11.8ms  budget(write)=100ms  PASS
  bulk status change                           raw=    49.6ms  floor=   2.7ms  adjusted=    46.9ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    21.3ms  floor=   2.7ms  adjusted=    18.7ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     9.2ms  floor=   2.7ms  adjusted=     6.5ms  budget(write)=100ms  PASS

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

## Run 2 verbatim (overhead floor 2.3ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    11.0ms  floor=   2.3ms  adjusted=     8.6ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    14.9ms  floor=   2.3ms  adjusted=    12.5ms  budget(read)=50ms  PASS
  submission detail                            raw=    22.2ms  floor=   2.3ms  adjusted=    19.8ms  budget(read)=50ms  PASS
  event overview                               raw=    30.5ms  floor=   2.3ms  adjusted=    28.2ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    20.7ms  floor=   2.3ms  adjusted=    18.4ms  budget(read)=50ms  PASS
  public sessions page                         raw=     6.9ms  floor=   2.3ms  adjusted=     4.5ms  budget(public)=150ms  PASS
  public agenda                                raw=     8.4ms  floor=   2.3ms  adjusted=     6.1ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    49.0ms  floor=   2.3ms  adjusted=    46.6ms  budget(public)=150ms  PASS
  public speakers page                         raw=     6.4ms  floor=   2.3ms  adjusted=     4.0ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    10.7ms  floor=   2.3ms  adjusted=     8.4ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    10.6ms  floor=   2.3ms  adjusted=     8.2ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=     9.8ms  floor=   2.3ms  adjusted=     7.4ms  budget(public)=150ms  PASS
  public gallery page                          raw=     6.4ms  floor=   2.3ms  adjusted=     4.1ms  budget(public)=150ms  PASS
  public schedule page                         raw=     9.9ms  floor=   2.3ms  adjusted=     7.5ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     6.4ms  floor=   2.3ms  adjusted=     4.1ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    12.9ms  floor=   2.3ms  adjusted=    10.6ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     3.5ms  floor=   2.3ms  adjusted=     1.2ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.3ms  floor=   2.3ms  adjusted=     2.0ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     5.9ms  floor=   2.3ms  adjusted=     3.6ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    11.6ms  floor=   2.3ms  adjusted=     9.3ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     8.2ms  floor=   2.3ms  adjusted=     5.9ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    26.4ms  floor=   2.3ms  adjusted=    24.0ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    36.5ms  floor=   2.3ms  adjusted=    34.1ms  budget(read)=50ms  PASS
  portal home                                  raw=    18.9ms  floor=   2.3ms  adjusted=    16.6ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    11.7ms  floor=   2.3ms  adjusted=     9.4ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    16.1ms  floor=   2.3ms  adjusted=    13.7ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    43.0ms  floor=   2.3ms  adjusted=    40.7ms  budget(read)=50ms  PASS
  plan reviewers (page 1)                      raw=     8.2ms  floor=   2.3ms  adjusted=     5.8ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     4.5ms  floor=   2.3ms  adjusted=     2.1ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    14.4ms  floor=   2.3ms  adjusted=    12.0ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    21.9ms  floor=   2.3ms  adjusted=    19.5ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     5.2ms  floor=   2.3ms  adjusted=     2.9ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     5.5ms  floor=   2.3ms  adjusted=     3.1ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     6.8ms  floor=   2.3ms  adjusted=     4.4ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    22.9ms  floor=   2.3ms  adjusted=    20.6ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    10.7ms  floor=   2.3ms  adjusted=     8.3ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=     6.2ms  floor=   2.3ms  adjusted=     3.8ms  budget(write)=100ms  PASS
  bulk status change                           raw=    33.9ms  floor=   2.3ms  adjusted=    31.5ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    20.3ms  floor=   2.3ms  adjusted=    17.9ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.6ms  floor=   2.3ms  adjusted=     2.3ms  budget(write)=100ms  PASS

perf:smoke OK
```

## Run 3 verbatim (overhead floor 3.2ms, raw ceiling 150ms)

```
  submissions list (page 1)                    raw=    17.3ms  floor=   3.2ms  adjusted=    14.1ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    20.2ms  floor=   3.2ms  adjusted=    16.9ms  budget(read)=50ms  PASS
  submission detail                            raw=    27.5ms  floor=   3.2ms  adjusted=    24.2ms  budget(read)=50ms  PASS
  event overview                               raw=    31.5ms  floor=   3.2ms  adjusted=    28.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    27.3ms  floor=   3.2ms  adjusted=    24.0ms  budget(read)=50ms  PASS
  public sessions page                         raw=     8.6ms  floor=   3.2ms  adjusted=     5.3ms  budget(public)=150ms  PASS
  public agenda                                raw=    11.4ms  floor=   3.2ms  adjusted=     8.2ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    56.7ms  floor=   3.2ms  adjusted=    53.5ms  budget(public)=150ms  PASS
  public speakers page                         raw=     9.8ms  floor=   3.2ms  adjusted=     6.6ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    13.2ms  floor=   3.2ms  adjusted=     9.9ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    12.7ms  floor=   3.2ms  adjusted=     9.5ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    13.4ms  floor=   3.2ms  adjusted=    10.1ms  budget(public)=150ms  PASS
  public gallery page                          raw=     9.0ms  floor=   3.2ms  adjusted=     5.8ms  budget(public)=150ms  PASS
  public schedule page                         raw=    13.0ms  floor=   3.2ms  adjusted=     9.7ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     7.8ms  floor=   3.2ms  adjusted=     4.6ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    13.7ms  floor=   3.2ms  adjusted=    10.5ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     5.8ms  floor=   3.2ms  adjusted=     2.6ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     6.6ms  floor=   3.2ms  adjusted=     3.4ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     6.7ms  floor=   3.2ms  adjusted=     3.5ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    15.8ms  floor=   3.2ms  adjusted=    12.5ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=     9.4ms  floor=   3.2ms  adjusted=     6.2ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    40.9ms  floor=   3.2ms  adjusted=    37.7ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    58.5ms  floor=   3.2ms  adjusted=    55.3ms  budget(read)=50ms  FAIL
      adjusted p95 55.3ms exceeds read class budget 50ms
  portal home                                  raw=    28.6ms  floor=   3.2ms  adjusted=    25.3ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    15.7ms  floor=   3.2ms  adjusted=    12.5ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    17.1ms  floor=   3.2ms  adjusted=    13.9ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    56.5ms  floor=   3.2ms  adjusted=    53.2ms  budget(read)=50ms  FAIL
      adjusted p95 53.2ms exceeds read class budget 50ms
  plan reviewers (page 1)                      raw=    10.1ms  floor=   3.2ms  adjusted=     6.8ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     7.5ms  floor=   3.2ms  adjusted=     4.3ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    19.0ms  floor=   3.2ms  adjusted=    15.7ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    28.9ms  floor=   3.2ms  adjusted=    25.7ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=    14.6ms  floor=   3.2ms  adjusted=    11.3ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     7.1ms  floor=   3.2ms  adjusted=     3.9ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=    11.4ms  floor=   3.2ms  adjusted=     8.2ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    28.4ms  floor=   3.2ms  adjusted=    25.2ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    19.4ms  floor=   3.2ms  adjusted=    16.2ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    11.9ms  floor=   3.2ms  adjusted=     8.7ms  budget(write)=100ms  PASS
  bulk status change                           raw=    50.2ms  floor=   3.2ms  adjusted=    47.0ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    25.6ms  floor=   3.2ms  adjusted=    22.4ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=    10.4ms  floor=   3.2ms  adjusted=     7.1ms  budget(write)=100ms  PASS

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

## Grading, by name, at this boundary

- `reviewer queue`: run1 raw 54.2ms/adj 51.5ms **FAIL**, run2 raw 36.5ms/adj
  34.1ms PASS, run3 raw 58.5ms/adj 55.3ms **FAIL** — 1 of 3 PASS vs the
  50ms read budget, with `plan results (page 1)`'s fix simultaneously
  present (not stashed out) in every run. **NOT closed at this boundary**:
  task-w32-b's fix (`src/routes/review/reviewer.ts`) is a proven ancestor
  of this HEAD (identical to task-w35-a's a0b8501b, itself an ancestor),
  yet this reading is markedly less stable than task-w35-a's own 3-of-3
  PASS at the same fix set (46.4/44.0/45.1ms adjusted there vs
  51.5/34.1/55.3ms here) — the fix is present but the row is not
  consistently under budget on this machine at this moment. FINDING
  (logged, not fixed): `src/routes/review/reviewer.ts`, the `GET
  /api/v1/review/plans/:id/queue` handler — adjusted p95 now straddles the
  50ms budget line (34-55ms across 3 runs) rather than sitting clearly
  under it as task-w35-a measured; worth a closer look at whether the
  Promise.all wave still dominates or whether test-machine variance alone
  explains the swing.
- `plan results (page 1)`: run1 raw 33.2ms/adj 30.6ms PASS, run2 raw
  21.9ms/adj 19.5ms PASS, run3 raw 28.9ms/adj 25.7ms PASS — 3 of 3 PASS vs
  the 50ms read budget, with `reviewer queue`'s fix simultaneously present
  in every run. **Closed at this boundary**: task-w32-a's fix
  (`src/routes/review/shared.ts`, `src/routes/review/plans-progress.ts`) is
  a proven ancestor, and every reading at this HEAD stays comfortably under
  budget (consistent with task-w35-a's own 3-of-3 PASS at the same fix
  set).
- `files library (page 1)`: run1 adj 16.8ms PASS, run2 adj 12.0ms PASS,
  run3 adj 15.7ms PASS — 3 of 3 PASS vs the 50ms read budget. Closed
  (task-w29-b/task-w31-a fixes, both ancestors).
- `onboarding grid (800 speakers x 5 tasks)`: run1 adj 38.0ms PASS, run2
  adj 24.0ms PASS, run3 adj 37.7ms PASS — 3 of 3 PASS vs the 50ms read
  budget. Closed (task-w29-a fix, ancestor).
- `portal home` / `portal tasks` / `portal submission detail` (DEC-338
  wave-35, task-w35-d — **an ancestor of this HEAD**, see above): all three
  PASS in all 3 runs (portal home 19.9/16.6/25.3ms adj; portal tasks
  9.6/9.4/12.5ms adj; portal submission detail 38.1/13.7/13.9ms adj), each
  comfortably under the 50ms read budget — but this pass depends on the
  measurement-only local D1 fixup described above; against the documented
  recipe alone (no fixup), the harness cannot reach these checks at all
  (blocking `login()` failure). These three rows are unmeasurable by the
  shipped recipe until the FINDING above (`scripts/perf-seed.ts` missing
  the perf-speaker insert loop) is fixed.

## Non-mandate finding (logged only, outside this lane's two-row mandate)

`plan progress (page 1)` (a distinct row served by `GET
/api/v1/plans/:id/progress`) is unstable at this boundary: run1 FAIL 60.7/
58.1ms, run2 PASS 43.0/40.7ms, run3 FAIL 56.5/53.2ms, all vs the 50ms read
budget — the same instability pattern task-w35-a already logged as a
non-mandate finding at a0b8501b (55.3/47.1/60.0ms there). Still open, still
outside this lane's mandate; owning module
`src/routes/review/plans-progress.ts`.

## RESULT

RESULT: FAIL (`reviewer queue`, 1 of 3 runs PASS, row remains OPEN at this
boundary despite carrying every ancestor fix task-w35-a credited) / PASS
(`plan results (page 1)`, 3 of 3 runs PASS, row CLOSED at this boundary) at
`f5783479c7a1b8c96ef1506c3cfff1661fd6e338`. `files library (page 1)` and
`onboarding grid (800 speakers x 5 tasks)` both closed, 3 of 3 PASS each.
`portal home`/`portal tasks`/`portal submission detail` (task-w35-d, an
ancestor) all PASS 3 of 3, but only reachable via this lane's
measurement-only local D1 fixup — unreachable via the documented recipe
alone until `scripts/perf-seed.ts`'s missing perf-speaker insert loop
(FINDING above) is landed.

OPEN ITEMS: 4 — (1) `reviewer queue` unstable/FAIL 2 of 3 runs at a
boundary carrying its credited fix, `src/routes/review/reviewer.ts`'s `GET
/api/v1/review/plans/:id/queue` handler; (2) `plan progress (page 1)`
unstable/FAIL 2 of 3 runs (non-mandate, pre-existing, owner
`src/routes/review/plans-progress.ts`); (3) `scripts/perf-seed.ts` has no
function that mints the DEC-338 wave-35 perf speaker
(`PERF_SPEAKER_USER_ID`/`PERF_SPEAKER_CONTACT_ID`/etc. from
`scripts/perf-seed-lib.ts` are exported but never called), blocking the
documented recipe outright; (4) once (3) is fixed, the insert loop must
draw the perf speaker's participant rows from the admin submissions list's
actual descending page-1 order (`_1800..1796`), not the seed-order
assumption `perfSpeakerAcceptedIndexes`'s doc comment currently states, or
`portal submission detail` 404s again.
