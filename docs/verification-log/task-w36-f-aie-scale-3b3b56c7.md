# task-w36-f — AIE SCALE BATTERY @ 3b3b56c7

QUALIFYING (scale-mandate battery; advisory to the DEC-069 predicate)

## DEC-644 wave-36 three-sha boundary block

- HEAD (this worktree's tip): `3b3b56c7` ("merge task-w36-b" — docs-only,
  confirmed via `git diff --name-only f5783479 3b3b56c7` = only
  `docs/verification-log.md` + two verification-log files).
- Newest first-parent product-code-bearing sha: `3a041507` ("merge
  task-w35-c") — confirmed via `git log --first-parent --oneline --
  src app migrations package.json`, whose newest entry at this tip is
  `3a041507`.
- Live `task-w3*` sibling refs, `merge-base --is-ancestor <ref> HEAD`:
  - `task-w36-b`: ancestor (merged into this tip)
  - `task-w36-c`: ancestor (merged into this tip)
  - `task-w36-e`: ancestor (merged into this tip)
  - `task-w36-a`: NOT an ancestor (still in flight at read time)
  - `task-w36-d`: NOT an ancestor (still in flight at read time)
  This lane credits no src/app/migrations/package.json fixes to any
  sibling — it is LOG-ONLY (frozen-product) and touches only docs/, so the
  two in-flight refs above do not affect this row's validity.

## Recipe run (worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w36-f`, port 8973)

`npx tsx scripts/ensure-dev-vars.ts` (created `.dev.vars`; corrected
`PUBLIC_BASE_URL` to `http://localhost:8973`, the same gitignored-env-drift
fix precedented at task-w26-f/task-w36-b) -> `rm -rf .wrangler` -> `npm run
db:migrate` (42/42 migrations) -> `npm run seed` (demo seed — required
first, both harnesses log in as the demo seed's organizer identity) ->
`npm run perf:seed:aie` (2,500 submissions / 6,000 contacts / 280 accepted
/ 3 plans / 15 reviewers each) -> `npx wrangler dev --port 8973`
(backgrounded, `/health` polled, up in <2s).

## BLOCKING HARNESS GAP found and worked around (LOGGED FINDING, not fixed)

`PERF_URL=http://localhost:8973 npm run perf:smoke:aie` (and, independently
confirmed, `npm run perf:smoke` under the `default` profile too) fails
**unconditionally, for every profile**, at the very first non-organizer
login: `Error: POST /login failed: expected 302, got 401` for
`perf.speaker@example-perf.test`. Root-caused: commit `e963d388` ("perf:
add speaker portal fixture spec + /portal read checks (DEC-338 wave-35)")
added the singleton perf-speaker login unconditionally to
`scripts/perf-smoke.ts`'s `main()` (`speakerHeaders = login(PERF_SPEAKER_EMAIL,
PERF_SPEAKER_PASSWORD)`, scripts/perf-smoke.ts:388) and added the row specs
(`PERF_SPEAKER_USER_ID`/`PERF_SPEAKER_CONTACT_ID`/`PERF_SPEAKER_EMAIL`/
`PERF_SPEAKER_PASSWORD`/`perfSpeakerParticipantId`/`perfSpeakerAcceptedIndexes`/
`perfSpeakerTaskAssignmentId`/`isPerfSpeakerTaskAssignmentComplete`) to
`scripts/perf-seed-lib.ts`, but that commit's own message explicitly flagged:
"scripts/perf-seed.ts is unmodified, so the perf speaker's user/contact/
participant/task_assignment rows are not yet actually inserted into the
seeded DB... Did not run the harness end-to-end for this reason." That
follow-up wiring was never landed by a later wave (confirmed: `grep -n
"PERF_SPEAKER" scripts/perf-seed.ts` returns nothing at this tip). Every
perf-smoke run since `e963d388` merged (an ancestor of `3a041507`) has
therefore been broken by construction — `task-w35-a`'s own PASS reading was
taken at `a0b8501b`, confirmed via `git merge-base --is-ancestor a0b8501b
e963d388` to PREDATE this commit, so it never hit the bug.

**FINDING — owner: a later wave, files `scripts/perf-seed.ts` (missing
insert wiring) / `scripts/perf-smoke.ts:388` (the unconditional caller) /
`scripts/perf-seed-lib.ts` (the already-correct, already-tested source of
the row specs) — perf-smoke (both `default` and `aie` profiles) cannot run
end-to-end at this tip without this fix.**

To still produce the two result tables this task's brief requires, this
lane minted the missing singleton rows via a **local, uncommitted-only**
patch to `scripts/perf-seed.ts` (added the missing contact/user/
participant/task_assignment inserts, reusing perf-seed-lib.ts's existing
exported helpers verbatim — no new logic invented) plus a
**second, independently-found bug** the first patch surfaced: the
`perfSpeakerAcceptedIndexes` doc comment assumes index 0 of
`acceptedSubmissionIds` (ascending seed-insertion order) is the same
submission `perf-smoke.ts`'s `icsIds[0]` resolves — but `icsIds` comes from
`GET .../submissions?status=accepted` which this codebase returns in
DESCENDING `createdAt` order, so index 0 there is the LAST accepted
submission in seed order, not the first. Confirmed via direct API probe
(`seed_perf_submission_2125` first vs. participant rows attached to
`seed_perf_submission_1876..1880`). Patched locally to reverse the index
mapping so the fixture actually lines up. **Both patches were reverted via
`git checkout -- scripts/perf-seed.ts` before this lane's commit** — this
task's brief is explicit: "FROZEN-PRODUCT lane: write ONLY under docs/".
Neither bug is fixed at `3b3b56c7`; both are LOGGED FINDINGS for a later
wave (owner not assigned by this lane).

## PART 1 — `PERF_URL=http://localhost:8973 npm run perf:smoke:aie` (aie profile, event=perf-aie, 2500 submissions, 6000 contacts), quoted verbatim from the locally-unblocked run

```
perf:smoke profile=aie event=perf-aie submissions=2500 contacts=6000

p95 over 30 measured iterations (overhead floor: 2.6ms, raw ceiling: 150ms):

  submissions list (page 1)                    raw=    16.5ms  floor=   2.6ms  adjusted=    13.9ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    21.4ms  floor=   2.6ms  adjusted=    18.9ms  budget(read)=50ms  PASS
  submission detail                            raw=    22.3ms  floor=   2.6ms  adjusted=    19.7ms  budget(read)=50ms  PASS
  event overview                               raw=    27.5ms  floor=   2.6ms  adjusted=    24.9ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    18.4ms  floor=   2.6ms  adjusted=    15.8ms  budget(read)=50ms  PASS
  public sessions page                         raw=     8.0ms  floor=   2.6ms  adjusted=     5.4ms  budget(public)=150ms  PASS
  public agenda                                raw=    10.8ms  floor=   2.6ms  adjusted=     8.3ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    35.6ms  floor=   2.6ms  adjusted=    33.0ms  budget(public)=150ms  PASS
  public speakers page                         raw=     7.8ms  floor=   2.6ms  adjusted=     5.2ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    12.8ms  floor=   2.6ms  adjusted=    10.2ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    12.4ms  floor=   2.6ms  adjusted=     9.8ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    10.5ms  floor=   2.6ms  adjusted=     8.0ms  budget(public)=150ms  PASS
  public gallery page                          raw=     8.5ms  floor=   2.6ms  adjusted=     5.9ms  budget(public)=150ms  PASS
  public schedule page                         raw=    10.4ms  floor=   2.6ms  adjusted=     7.8ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     7.7ms  floor=   2.6ms  adjusted=     5.1ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    13.2ms  floor=   2.6ms  adjusted=    10.7ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     6.5ms  floor=   2.6ms  adjusted=     4.0ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     4.9ms  floor=   2.6ms  adjusted=     2.3ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     9.0ms  floor=   2.6ms  adjusted=     6.4ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    25.6ms  floor=   2.6ms  adjusted=    23.0ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=    27.4ms  floor=   2.6ms  adjusted=    24.9ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=    21.0ms  floor=   2.6ms  adjusted=    18.4ms  budget(read)=50ms  PASS
  reviewer queue                               raw=    48.2ms  floor=   2.6ms  adjusted=    45.6ms  budget(read)=50ms  PASS
  portal home                                  raw=    15.6ms  floor=   2.6ms  adjusted=    13.0ms  budget(read)=50ms  PASS
  portal tasks                                 raw=    14.1ms  floor=   2.6ms  adjusted=    11.5ms  budget(read)=50ms  PASS
  portal submission detail                     raw=    17.6ms  floor=   2.6ms  adjusted=    15.1ms  budget(read)=50ms  PASS
  plan progress (page 1)                       raw=    53.2ms  floor=   2.6ms  adjusted=    50.6ms  budget(read)=50ms  FAIL
      adjusted p95 50.6ms exceeds read class budget 50ms
  plan reviewers (page 1)                      raw=     8.3ms  floor=   2.6ms  adjusted=     5.7ms  budget(read)=50ms  PASS
  email log list (page 1)                      raw=     6.4ms  floor=   2.6ms  adjusted=     3.8ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=    16.7ms  floor=   2.6ms  adjusted=    14.1ms  budget(read)=50ms  PASS
  plan results (page 1)                        raw=    28.1ms  floor=   2.6ms  adjusted=    25.5ms  budget(read)=50ms  PASS
  pipeline list (page 1)                       raw=     7.6ms  floor=   2.6ms  adjusted=     5.1ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     6.9ms  floor=   2.6ms  adjusted=     4.3ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     8.4ms  floor=   2.6ms  adjusted=     5.8ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    21.9ms  floor=   2.6ms  adjusted=    19.3ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    13.1ms  floor=   2.6ms  adjusted=    10.5ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    12.5ms  floor=   2.6ms  adjusted=     9.9ms  budget(write)=100ms  PASS
  bulk status change                           raw=    49.3ms  floor=   2.6ms  adjusted=    46.7ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    15.0ms  floor=   2.6ms  adjusted=    12.4ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     4.3ms  floor=   2.6ms  adjusted=     1.8ms  budget(write)=100ms  PASS

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

### Grading against the two prior aie readings this task names

- **task-w27-d @ ceda66f2**: `onboarding grid (800 speakers x 5 tasks)`
  raw=999.8ms adj=995.7ms **FAIL** (also breached the 150ms raw ceiling);
  `files library (page 1)` raw=418.8ms adj=414.7ms **FAIL** (also breached
  the 150ms raw ceiling). **At 3b3b56c7: BOTH NOW HOLD.** `onboarding grid`
  is now raw=21.0ms/adj=18.4ms PASS (vs 50ms budget) — a ~48x improvement
  from 999.8ms raw. `files library (page 1)` is now raw=16.7ms/adj=14.1ms
  PASS (vs 50ms budget) — a ~25x improvement from 418.8ms raw. Both fixes
  (credited across w29/w31/w32 by this task's brief) hold at aie scale,
  not just at the smaller default 2k profile.
- **task-w31-d's note**: `reviewer queue` and `plan results (page 1)`
  newly FAILed at aie scale at that reading (`reviewer queue` raw=110.5ms
  adj=106.6ms FAIL; `plan results (page 1)` raw=88.9ms adj=85.0ms FAIL).
  **At 3b3b56c7: BOTH NOW HOLD.** `reviewer queue` is now
  raw=48.2ms/adj=45.6ms PASS (vs 50ms budget) — close to the budget line
  but under it. `plan results (page 1)` is now raw=28.1ms/adj=25.5ms PASS
  (vs 50ms budget), comfortably under.

All four rows this task was asked to re-grade now PASS at aie scale.

### Non-mandate observation (logged only, not this task's scope)

`plan progress (page 1)` — raw=53.2ms/adj=50.6ms **FAIL** vs the 50ms read
budget, by 0.6ms adjusted. This is the same row `task-w35-a` flagged as
unstable at `a0b8501b` under the smaller `default` profile (one of 3 runs
FAILed there too, at 60.0ms). Not one of the four rows this task's brief
named for re-grading; owner not assigned by this lane. Route:
`src/routes/review/plans-progress.ts` (`GET /api/v1/plans/:id/progress`).

## PART 2 — `npx tsx scripts/walkthrough/stress.ts --url http://localhost:8973` (= `gate:scale`), quoted verbatim (re-seeded via `npm run perf:seed:aie` first, since PART 1's own writes had consumed part of the pending-submission pool `gate:scale`'s own bulkStatus500 bar needs — same "the measured pass itself writes state" precedent `task-w35-a` already documented)

Ran with a **local-only, uncommitted** patch to
`scripts/walkthrough/stress.ts` that continues past a failing bar instead
of exiting after the first one (reverted before commit, same "write ONLY
under docs/" discipline as PART 1) so every mandate-named bar gets a
verdict from one run rather than the script's own default early-exit
hiding the remaining four behind the first failure:

```
PASS setup (aie event perf-aie resolved)
Gathering bulkStatus500 observation...
PASS bulkStatus500: selected=600 updated=600 requestCount=2 (expected 2 at chunk size 500) rolledBack=false
Gathering autoSchedule320 observation...
FAILED: autoSchedule320
  unplacedTotal=298 reasons.length=237 emptyReasons=0
Gathering remindersHonesty observation...
PASS remindersHonesty: due=681 sent=100 skipped=0 remaining=581 accounted=681 MAX_REMINDER_BATCH=100
Gathering overviewRowCap observation...
PASS overviewRowCap: sections=5 overCapSections=triage(total=900,rows=5),contentApproval(total=600,rows=5),agendaWork.conflicts(total=18,rows=5),agendaWork.unplaced(total=237,rows=5) violations=none
Gathering duplicatesLatency observation...
PASS duplicatesLatency: ms=29 ceilingMs=1000

stress gate: at least one functional bar FAILed (see above)
```

### Functional bars named by the mandate, graded PASS/FAIL/NOT-EXERCISED

- **Bulk status over 500 selected submissions, chunked at 100** (mandate
  prose) — the binding decision DEC-193 (`app/src/pages/submissions/bulk.ts`
  `BULK_STATUS_CHUNK_SIZE`) chunks at 500, not 100; `stress-bars.ts`'s
  evaluator uses the imported constant per "decisions in decisions/ are
  binding" rather than the mandate's literal (a pre-existing GAP, flagged
  by the evaluator's own comment, not this lane's to resolve). **PASS** —
  600 selected, 600 updated, 2 chunked requests (500 + 100), no committed
  batch rolled back.
- **Auto-schedule over ~320 candidate sessions completes and reports
  per-item reasons without timeout** — **FAIL**. The call completed (no
  timeout) but `unplacedTotal=298` while only `reasons.length=237`
  per-item reasons were returned — 61 unplaced accepted sessions have NO
  reported reason, violating "reports per-item reasons" for every unplaced
  item. **FINDING — owner: a later wave, `src/server/repo/agenda/
  auto-schedule.ts` (`runAutoSchedule`, the `unplacedReasons` assembly at
  its `describeUnplaced` map, scripts/perf-smoke.ts-adjacent route
  `POST /api/v1/events/:eventId/agenda/auto-schedule` in
  `src/routes/agenda.ts`) — some unplaced-accepted-session code path
  produces a session that's absent from both `unplacedFromRun` and
  `cappedUnplaced` yet is still counted in `summary.unplaced` (which comes
  from a separately-computed `getAgendaPayload` total, not from the same
  run's own placement/unplaced partition) — not diagnosed further, LOG-ONLY
  per this task's frozen-product scope.**
- **Reminders endpoint at 400 tasks respects the 100-contact cap and
  reports {sent, skipped, remaining} honestly** — **PASS**. `due=681`
  (more than the mandate's 400-task profile figure since this counts
  distinct outstanding CONTACTS across all 400 perf tasks, not tasks
  themselves), `sent=100` (exactly `MAX_REMINDER_BATCH`), `skipped=0`,
  `remaining=581`, and `sent+skipped+remaining=681=due` — the accounting
  is honest and the cap is respected.
- **Overview repo queries stay capped (ROW_CAP)** — **PASS**. Every
  Overview section whose `total` exceeds the 5-row cap (`triage` 900,
  `contentApproval` 600, `agendaWork.conflicts` 18, `agendaWork.unplaced`
  237) reports exactly 5 rows, never more.
- **`contacts/duplicates` grouping stays sub-second at 6,000 contacts** —
  **PASS**. 29ms wall-clock for one round trip, three orders of magnitude
  under the 1000ms mandate ceiling.

Every bar the mandate names was exercised by this run (none
NOT-EXERCISED).

## Server teardown

`pkill -f "wrangler dev --port 8973"` after PART 2. Both temporary local
patches (`scripts/perf-seed.ts`, `scripts/walkthrough/stress.ts`) reverted
via `git checkout -- scripts/perf-seed.ts scripts/walkthrough/stress.ts`
before this lane's commit; `git status --short` confirmed clean before
committing (this receipt + its index entry + the regenerated
`docs/verification-log.md` are the only files this commit touches).

## RESULT

PART 1 (perf:smoke:aie, SPEC budget rows): all four rows this task was
asked to re-grade (`onboarding grid`, `files library (page 1)`,
`reviewer queue`, `plan results (page 1)`) now PASS at aie scale — the
w29/w31/w32 fixes hold, not just moved the knee. One non-mandate row
(`plan progress (page 1)`) FAILs by 0.6ms, unchanged in character from
`task-w35-a`'s prior instability reading — logged, not owned by this lane.

PART 2 (gate:scale, mandate functional bars): 4 of 5 PASS (bulkStatus500,
remindersHonesty, overviewRowCap, duplicatesLatency); 1 FAIL
(autoSchedule320 — 61 unplaced accepted sessions missing a per-item
reason) — logged finding, owner not assigned by this lane.

A pre-existing, previously-self-flagged-but-never-closed harness gap
(`e963d388`'s perf-speaker fixture wiring, missing from
`scripts/perf-seed.ts`) blocks `perf:smoke`/`perf:smoke:aie` from running
at ALL, for every profile, at this tip — worked around locally
(uncommitted) to produce PART 1's numbers; logged as its own finding since
it is a real defect blocking every future perf-smoke lane, not something
this frozen-product lane may fix.

OPEN ITEMS: 3 (perf-seed.ts perf-speaker fixture wiring gap +
icsIds-ordering mismatch it exposed, both blocking perf-smoke end-to-end;
`plan progress (page 1)` aie-scale instability; `autoSchedule320`'s 61
reasonless unplaced sessions)
