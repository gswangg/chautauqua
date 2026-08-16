# task-w50-c: perf-smoke gate, frozen wave, at own tip @ 87cee8b9

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644, DEC-453, DEC-069). FROZEN GATE
LANE (DEC-069 w50): no change under `src/`, `app/src/`, `migrations/`, or
`package.json` (HARD SCOPE for this lane: `docs/verification-log/**` only).

## Three-sha boundary block (DEC-644, `npx tsx scripts/ref-state.ts`, verbatim)

`DEC-644 three-sha boundary: HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`;
newest first-parent product-code-bearing sha
`c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w47-a`, `task-w47-g`,
`task-w47-h`, `task-w48-a`, `task-w48-c`, `task-w48-f`, `task-w49-g`,
`task-w50-a`, `task-w50-b`, `task-w50-c`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git
merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
`task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`, `task-w49-a`,
`task-w49-b`, `task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-f`,
`task-w49-h`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
`task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`,
`task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.`

## Sequence of syncs performed by this lane

1. Worktree created at `main` tip `87cee8b9fec30d190f93156c99ddf7011b68bc92`
   (`git worktree add ... main`: HEAD is now at `87cee8b9`, "scribe wave
   50"). No separate `git merge main` was needed — the worktree was cut
   directly from the current `main` tip.
2. `npx tsx scripts/ref-state.ts` ancestry check for live `task-w49-*` refs
   (`task-w49-a`, `-b`, `-c`, `-d`, `-e`, `-f`, `-h`; `task-w49-g` is
   already an ancestor of HEAD): all seven reported NON-ancestor. Per
   STEP 0's bounded-poll protocol this lane checked the ancestry state
   (10-attempt budget); all seven remained NON-ancestor at every check —
   no wave-49 lane landed on `main` during this lane's window. Per DEC-069
   w48/w50's finding ("A PLANNER CANNOT GRADE THE WAVE IT FOLLOWS" /
   "A LANE CANNOT GRADE THE WAVE IT RUNS INSIDE"), this lane proceeded to
   the heavy phase at the worktree's own tip (`87cee8b9`) rather than
   blocking further; the field guide's own w49 entry already records
   `task-w49-e` (seq 0250) and `task-w49-h` (seq 0251) as committed but,
   per this poll, still unmerged — consistent with the wave-50 census note
   that this is a product-frozen battery and no wave-49/wave-50 lane
   touches `src/**`.
3. Precondition check (STEP 0b): `grep -c PERF_SPEAKER
   scripts/perf-seed.ts` = 13, with inserts at lines 608, 627, 643, 659 —
   identical to every prior lane's receipt. The documented recipe alone
   reaches every check including the three portal rows; no local-D1 fixup
   applied or needed.
4. `MEASURED_SHA` = `git rev-parse --short HEAD` = `87cee8b9`, taken
   immediately after worktree creation (no further main movement observed
   or needed — this lane's HARD SCOPE never touches product code, so no
   re-sync-and-reset cycle was required as in task-w48-c's 0242 receipt).

## Heavy phase

Run inside one `sh scripts/with-test-lock.sh sh -c '...'` acquisition,
covering the full boot (this lane shares `/tmp/chq-test.lock` and port
8787 with sibling lane task-w50-b, per DEC-644 w50): `npm run build`,
`npm run db:migrate`, `npm run seed`, `npm run perf:seed`, boot
`npx wrangler dev` in the background, poll for the port, then
`npm run perf:smoke` three times in sequence against the same booted
server and seeded D1 instance.

`npm run build`, `npm run db:migrate`, `npm run seed`, and `npm run
perf:seed` all completed successfully with no errors. `wrangler dev`
reported the server up within 2s of boot.

### Run 1: full pass, 40/40 check-rows PASS

**Run 1 completed cleanly: 40/40 check-rows PASS, zero FAIL.** (Note: the
current `main` tip carries more perf-smoke checks than the 39 recorded in
task-w48-c's 0242 receipt — a `w51-c` amendment already landed on this
tree adding further SPEC §7 high-frequency-action checks; see "root-cause
finding" below.) Adjusted p95 vs budget, run 1 only (ms):

```
submissions list (page 1)                    9.5   budget(read)=50    PASS
submissions list (q=Kubernetes)              12.2  budget(read)=50    PASS
submission detail                            14.7  budget(read)=50    PASS
event overview                               27.7  budget(read)=50    PASS
organizer agenda (300 accepted)              17.3  budget(read)=50    PASS
public sessions page                         3.9   budget(public)=150 PASS
public agenda                                5.5   budget(public)=150 PASS
schedule.ics 150 ids                         45.1  budget(public)=150 PASS
public speakers page                         3.9   budget(public)=150 PASS
public speakers page at row ceiling          9.8   budget(public)=150 PASS
public speakers deepest page                 7.4   budget(public)=150 PASS
public sessions deepest rows                 7.5   budget(public)=150 PASS
public gallery page                          4.5   budget(public)=150 PASS
public schedule page                         7.0   budget(public)=150 PASS
public programme (whole agenda)              4.6   budget(public)=150 PASS
home hub (anonymous)                         7.9   budget(public)=150 PASS
agenda.ics                                   1.4   budget(public)=150 PASS
schedule.ics (bare, whole agenda)            2.5   budget(public)=150 PASS
contacts list (q=perf)                       3.1   budget(read)=50    PASS
rating PUT                                   6.7   budget(write)=100  PASS
contacts duplicates                          6.7   budget(read)=50    PASS
onboarding grid (800 speakers x 5 tasks)     20.6  budget(read)=50    PASS
reviewer queue                               25.7  budget(read)=50    PASS
portal home                                  15.2  budget(read)=50    PASS
portal tasks                                 8.8   budget(read)=50    PASS
portal submission detail                     14.8  budget(read)=50    PASS
plan progress (page 1)                       22.6  budget(read)=50    PASS
plan reviewers (page 1)                      4.2   budget(read)=50    PASS
email log list (page 1)                      2.6   budget(read)=50    PASS
files library (page 1)                       12.2  budget(read)=50    PASS
plan results (page 1)                        18.6  budget(read)=50    PASS
pipeline list (page 1)                       3.1   budget(read)=50    PASS
org users list (page 1)                      3.8   budget(read)=50    PASS
contacts bulk-email preview (50 recipients)  4.1   budget(write)=100  PASS
onboarding remind preview (all outstanding)  18.4  budget(write)=100  PASS
submission PATCH (description edit)          10.1  budget(write)=100  PASS
pipeline stage move                          5.7   budget(write)=100  PASS
bulk status change                           33.3  budget(write)=100  PASS
schedule slot PUT                            14.8  budget(write)=100  PASS
task assignment check-off                    2.0   budget(write)=100  PASS
```

Six historically marginal rows named in this task's briefing, run 1 only:
`reviewer queue` 25.7ms (budget 50ms) PASS. `plan progress (page 1)`
22.6ms (budget 50ms) PASS. `plan results (page 1)` 18.6ms (budget 50ms)
PASS. `files library (page 1)` 12.2ms (budget 50ms) PASS. `onboarding
grid` 20.6ms (budget 50ms) PASS. Three portal rows: `portal home` 15.2ms,
`portal tasks` 8.8ms, `portal submission detail` 14.8ms (all budget 50ms)
— all PASS, reached via the documented recipe alone, no local-D1 fixup.

### Runs 2 and 3: both ERRORED before producing any check-row, identically

```
Error: fetchPendingSubmissionIds: expected at least 1000 pending submissions, got 200
    at fetchPendingSubmissionIds (scripts/perf-smoke.ts:270:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async main (scripts/perf-smoke.ts:435:31)
```

Both run 2 and run 3 threw this exact error at setup time, before
measuring a single check. Neither produced any row output.

## Root-cause finding (CONFIRMED-DEFECT, filed not fixed, per DEC-453)

`npm run perf:smoke` is not repeatable across consecutive invocations
against the same booted server / seeded D1 instance. The "bulk status
change" check (`scripts/perf-smoke.ts:962-972`) fetches a batch of
`DEFAULT_BOUNDED_ID_ARRAY_MAX` (1000, `src/server/http.ts:71`) pending
submission ids once at setup (`scripts/perf-smoke.ts:435`,
`fetchPendingSubmissionIds`) and alternates the whole batch's status
`accept_queue`<->`pending` on every call via
`alternateByIteration(bulkStatusChangeIteration, "accept_queue",
"pending")` (`scripts/perf-smoke.ts:965`, `alternateByIteration` defined
`scripts/perf-smoke-lib.ts:226-231`: even iteration returns the first
argument, odd returns the second). The comment at
`scripts/perf-smoke.ts:956-961` states the intent explicitly: "the batch
is repeatable forever without growing new rows."

That intent is broken by a parity bug: this check runs once per warmup
iteration and once per measured iteration, i.e.
`WARMUP_ITERATIONS + MEASURED_ITERATIONS` = `5 + 30` = 35 total calls
(`scripts/perf-smoke.ts:70-71`). 35 is odd. `alternateByIteration` starts
at iteration 0 (`accept_queue`) and the 35th call is iteration 34 (even,
also `accept_queue`) — the batch starts at `pending` (that is how
`fetchPendingSubmissionIds` selected it) and ends the run parked at
`accept_queue`, never restored. A second `perf:smoke` invocation against
the same D1 instance therefore finds 1000 fewer `pending` submissions than
the first, and `fetchPendingSubmissionIds`'s own `>= 1000` assertion
(`scripts/perf-smoke.ts:270`, itself a correct fail-loudly guard) throws
immediately — before any of the 40 checks in that invocation gets a
chance to run, masking all 40 rows' results, not just the one at fault.

This was reproduced deterministically: run 2 and run 3 (both against the
run-1-mutated D1 instance, same booted server, no reseed between runs)
produced the byte-identical error above. This is a genuine tooling defect
in the perf-smoke harness's repeatability contract, not a product
regression and not a load/environment fluke — filed, not fixed, per
DEC-453 (a local-D1 fixup — e.g. reseeding or resetting pending status
between runs — would measure a tree nobody would ship, since nothing in
the documented `perf:smoke` recipe reseeds between consecutive runs).

CONFIRMED-DEFECT: `scripts/perf-smoke.ts:962-972` (the "bulk status
change" check body) combined with `scripts/perf-smoke.ts:70-71`
(`WARMUP_ITERATIONS`/`MEASURED_ITERATIONS` summing to an odd 35) — owner
wave-51 lane. Candidate fix directions (not applied by this lane, HARD
SCOPE forbids touching `scripts/`): either make the total call count even
(e.g. `WARMUP_ITERATIONS` even, or drop/add one iteration for this check
specifically), or key the alternation on a value that restores state
regardless of parity (e.g. explicitly setting the batch back to `pending`
once at the end of the run, or alternating on `iteration % 2` seeded from
whether the run count is even).

## Consequence for the three-run gate

Per this task's own criterion ("any row that is not 3-of-3 PASS becomes a
CONFIRMED-DEFECT row"), every one of the 40 check-rows is technically not
3-of-3 PASS this cycle, because runs 2 and 3 produced zero rows each (not
zero PASS rows — zero rows at all, the script threw before reaching the
measurement loop). This lane does not file all 40 rows individually as
40 separate CONFIRMED-DEFECT rows, since 39 of the 40 rows never had a
chance to run in runs 2/3 for a reason unrelated to their own handlers —
doing so would misrepresent 39 healthy checks as individually broken. The
single root-cause defect above is filed as the CONFIRMED-DEFECT; the
40 individual rows' run-1 numbers are reported as data (all PASS, well
under budget) but are 1-of-1, not 3-of-3, this cycle, and cannot be
brought to 3-of-3 without either a fix to the harness (out of this lane's
scope) or a local-D1 fixup between runs (forbidden by DEC-453).

## Environment note

The host had other concurrent chautauqua-repo activity throughout (other
`wrangler dev`/esbuild processes observed via `ps aux` predating and
outlasting this lane's own boot, consistent with sibling wave-50 lanes
running concurrently), and this lane's own heavy-phase lock acquisition
succeeded promptly with no contention observed at start. A later,
unrelated `sh scripts/with-test-lock.sh true` sanity probe run after this
lane's own heavy phase had already completed and released the lock found
the lock held by a sibling (consistent with `task-w50-b` sharing port
8787 and the lock per this task's own briefing) — that probe was not part
of this lane's measurement and was terminated without waiting, since this
lane's own three runs had already completed.

RESULT: PARTIAL — run 1 (fresh seed) is a full clean pass, 40/40 check-rows
PASS with wide margin under budget including all six named historically-
marginal rows and all three portal rows. Runs 2 and 3 ERRORED at setup
before producing any row, due to a confirmed, reproducible, filed-not-fixed
perf-smoke harness repeatability defect (odd warmup+measured call count
leaves "bulk status change"'s batch permanently flipped out of `pending`).
No product regression found in any row that was measured.
OPEN ITEMS: 1 (perf-smoke harness repeatability defect,
`scripts/perf-smoke.ts:70-71,962-972`, owner wave-51 lane)
