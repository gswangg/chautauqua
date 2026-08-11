# task-w20-d — perf-smoke files-library + review scale extension (DEC-347)

## FROZEN SHA

`dff7ae8` (`main` tip at worktree creation, "merge task-custodian-w20-4").
This is a within-lane implementation + measurement task (extends
`checks[]` in `scripts/perf-smoke.ts`, appended at the end per the task
spec to minimize merge overlap with in-flight `task-w19-c`, which also
runs `perf:smoke` and may commit its own harness fixes), not a battery
gate walking S from an anchor commit — DEC-349 confirms w20's gates are
build/test only, with the authoritative perf gate deferred to wave 21 at
one shared sha. FROZEN SHA is simply this lane's branch point.

## Scope

DEC-347: extend the perf harness so the files library (DEC-344's
server-paged files route) and the review/results subsystem are
observable at SPEC scale, then run a baseline `perf:smoke`.

### `scripts/perf-seed-lib.ts` additions

- `PERF_FILE_PRESENTATION_VERSIONS = 3`, `PERF_FILE_ROWS_PER_SUBMISSION =
  4` (3 presentation versions + 1 handout), `PERF_FILE_COUNT =
  PERF_STATUS_COUNTS.accepted * PERF_FILE_ROWS_PER_SUBMISSION = 1,200`.
- `perfFileSpecs(acceptedCount)` — pure, index-only helper returning the
  full deterministic spec for every perf `file` row: for the j-th
  (0-based) accepted submission, a 3-version `presentation` chain
  (`previousN` chaining newer -> older, root `null`, same direction as
  `scripts/seed.ts`'s own demo chain) plus a 1-version `handout` chain.
  `n` (the `seedId('perf_file', n)` index) is unique across the whole
  1,200-row set. Index-guard throws on negative/non-integer input.
- `PERF_EVALUATION_COUNT` raised `600 -> 6,000` = `lcm(PERF_SUBMISSION_
  COUNT=2000, PERF_REVIEWER_COUNT=12)`, chosen specifically so the
  existing `(n % submissionCount, n % reviewerCount)` round-robin
  assignment shape in `scripts/perf-seed.ts` produces **zero**
  `(plan_id, submission_id, reviewer_id, round)` collisions against the
  `evaluation` table's unique index across the full `n` range (a
  collision would require `n2 = n1 + 6000`, outside `[0, 6000)`) —
  verified in the test suite by directly re-deriving the pairing.

### `scripts/perf-seed.ts`

Extended the idempotent delete block with `DELETE FROM file WHERE id
LIKE 'seed_perf_%'` (before the submission-parent deletes — never a
blanket `DELETE FROM`); the existing `DELETE FROM evaluation WHERE
plan_id = ...` already covers the raised evaluation count with no
change needed. Added an insertion block driven by `perfFileSpecs`,
tracking a new `acceptedContactIds` array parallel to
`acceptedSubmissionIds` (populated in the same submission loop) so each
file row's `uploaded_by_contact_id` is the accepted submission's
speaker contact. `npm run perf:seed` now writes 29,366 statements to
`.perf-seed.sql` (up from the pre-DEC-347 count), applied as one
`wrangler d1 execute --local --file=.perf-seed.sql` batch — all
sub-batches reported `"success": true` (29,366 of them, 0
`"success": false`).

### `test/perf-seed.test.ts`

Added `describe("DEC-347 perfFileSpecs ...")`: exact 1,200-row count,
unique `n` across the set, exactly 300 chains with 3 presentation
versions and 300 with exactly 1 handout version, every non-root row's
`previousN` resolves to a row in the same chain (same `acceptedIndex` +
`kind`, one version back), no cycle (bounded walk from any row
terminates within `PERF_FILE_PRESENTATION_VERSIONS` steps without
revisiting a node), root rows always/only have `previousN === null`,
determinism + index-guard rejection tests, and the `acceptedCount = 0`
edge case. Also added, in the existing `DEC-088 pinned literals`
describe block: the raised `PERF_EVALUATION_COUNT === 6000` pin, an
explicit `>= 5000` assertion, and a collision-freedom test that
re-derives the `(submissionIdx, reviewerIdx)` pairing for every `n` in
`[0, PERF_EVALUATION_COUNT)` and asserts no pair repeats.

### `scripts/perf-smoke.ts`

Appended two `cls: "read"` checks at the **end** of `checks[]` (after
the existing `email log list (page 1)` check, per the task's
merge-overlap-minimization instruction against in-flight
`task-w19-c`):

- `files library (page 1)` -> `GET
  /api/v1/events/${PERF_EVENT_ID}/files?page=1&perPage=50`
- `plan results (page 1)` -> `GET
  /api/v1/plans/${PERF_PLAN_ID}/results?page=1&perPage=50`

Neither is `optional` (DEC-338). No existing check's name, class,
budget, or `run()` body was touched.

**Unplanned mid-task loss / recovery (harness/process note, not a
scope change):** partway through this task, the `task-w20-d` worktree
directory (and its branch) vanished out from under an in-progress `npm
run perf:seed` run — `git worktree list` in the target repo no longer
showed it and the branch was gone, while an orphaned `wrangler d1
execute` process from that run kept executing against now-unlinked file
handles. Recovered by re-running `git worktree add ... -b task-w20-d
main` at the same path (main tip had advanced from `7c0eb66` to
`dff7ae8` — no conflicting concurrent change to any of this task's five
owned files, confirmed by diffing against the pre-loss state before
reapplying), killing the orphaned processes, and reapplying every edit
identically before committing. No product code (`src/`) was touched
either before or after the recovery.

## Build / test

`npm ci --prefer-offline --no-audit --no-fund --silent` (skipped,
`node_modules` present). `npm run build` — `tsc --noEmit` root + `tsc
--noEmit -p app/tsconfig.json` + `vite build` — PASS. `npm test
--silent` — **228 test files / 1,915 tests**, all green (includes the
new `test/perf-seed.test.ts` `describe` blocks).

## Real-scale measurement

`rm -rf .wrangler/state`; `npm run db:migrate` (19 migrations `0000`
through `0018`, all applied clean); `npm run seed` (organizer identity +
R2 headshot seeding, 8 objects into local `chautauqua-files`); `npm run
perf:seed` (DEC-088 2,000 submissions / 300 accepted / 800 contacts
scale, plus this task's 1,200 file rows and the raised 6,000-evaluation
seed — 29,366 statements, all D1 SQL batches `"success": true`, 0
`"success": false`); `cp .dev.vars.example .dev.vars` with
`PUBLIC_BASE_URL=http://localhost:8811` (port `d` per the wave's port
table, DEC-349); `npx wrangler dev --port 8811` — `GET /health` ready.

`PERF_URL=http://localhost:8811 npm run perf:smoke` — full verbatim
result table (overhead floor 2.3ms, raw ceiling 150ms):

```
p95 over 30 measured iterations (overhead floor: 2.3ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=     9.3ms  floor=   2.3ms  adjusted=     7.0ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    11.9ms  floor=   2.3ms  adjusted=     9.5ms  budget(read)=50ms  PASS
  submission detail                         raw=    13.3ms  floor=   2.3ms  adjusted=    11.0ms  budget(read)=50ms  PASS
  event overview                            raw=    15.9ms  floor=   2.3ms  adjusted=    13.6ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    17.7ms  floor=   2.3ms  adjusted=    15.4ms  budget(read)=50ms  PASS
  public sessions page                      raw=     4.9ms  floor=   2.3ms  adjusted=     2.6ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.5ms  floor=   2.3ms  adjusted=     3.2ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    50.6ms  floor=   2.3ms  adjusted=    48.3ms  budget(public)=150ms  PASS
  public speakers page                      raw=     7.1ms  floor=   2.3ms  adjusted=     4.7ms  budget(public)=150ms  PASS
  public gallery page                       raw=     6.2ms  floor=   2.3ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  public schedule page                      raw=     8.5ms  floor=   2.3ms  adjusted=     6.2ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     5.8ms  floor=   2.3ms  adjusted=     3.5ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    86.2ms  floor=   2.3ms  adjusted=    83.9ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    35.4ms  floor=   2.3ms  adjusted=    33.0ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     6.6ms  floor=   2.3ms  adjusted=     4.3ms  budget(read)=50ms  PASS
  rating PUT                                raw=    12.8ms  floor=   2.3ms  adjusted=    10.5ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    16.4ms  floor=   2.3ms  adjusted=    14.1ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    25.7ms  floor=   2.3ms  adjusted=    23.4ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     6.8ms  floor=   2.3ms  adjusted=     4.5ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    49.7ms  floor=   2.3ms  adjusted=    47.4ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    31.5ms  floor=   2.3ms  adjusted=    29.2ms  budget(read)=50ms  PASS

perf:smoke OK
```

`perf:smoke OK`, exit code 0. The pre-loop DEC-080 cap assertion and the
DEC-105 CSV export size probes passed silently before the timed loop, as
in every prior perf-smoke run (unaffected by this task's changes).

Server (`wrangler dev`) and its `workerd` child process killed after the
run (required two rounds — the first `pkill -f "wrangler dev --port
8811"` pattern didn't match the actual `node .../cli.js dev --port
8811` command line, so a fresh `workerd` child briefly relaunched under
the still-live wrangler parent; killed by explicit pid instead).
`lsof -i :8811` confirmed no listener remains after the second round.

## DEC-347 grading

Per DEC-347: a check that is over budget **only because this lane newly
seeded the rows it reads** — the two new checks (`files library (page
1)`, `plan results (page 1)`), plus `reviewer queue`, `plan progress`,
and `rating PUT` under the larger evaluation scale — would be a
**logged finding** naming `task-w20-a` / `task-w20-b` / `task-w20-c` as
owner, not a lane FAIL. **No such finding applies to this run**: all 21
checks, including all five of the above, passed both their raw 150ms
ceiling and their class budget (`read` 50ms / `write` 100ms adjusted) at
this task's newly-seeded scale (1,200 file rows across 300 chains;
6,000 round-1 evaluations against the DEC-088 12-reviewer seed). The
closest margin is `files library (page 1)` at 47.4ms adjusted against
its 50ms `read` budget (2.6ms of headroom) — worth flagging as a watch
item for wave 21's authoritative gate (a small additional scale bump or
an unrelated regression elsewhere could tip it), but it is not itself
an open item at this measurement.

These numbers are a **baseline at a pre-fix tip** (this lane's own
branch point, `dff7ae8`, not a composed multi-lane sha) — per DEC-349,
wave 21's perf gate, run at one shared sha with all w19+w20 lanes
composed, is authoritative.

## OPEN ITEMS

None found at this measurement. Watch item (not an open item): `files
library (page 1)` at 47.4ms adjusted / 50ms budget — re-check at wave
21's composed-sha authoritative run.

OPEN ITEMS: 0

## RESULT

PASS

## RECHECK SHA

`task-w20-d` branch HEAD after this commit — no `main`-side product
code (`src/`) changes were made; this lane's changes are
`scripts/perf-seed-lib.ts`, `scripts/perf-seed.ts` (files chains + raised
evaluation count), `scripts/perf-smoke.ts` (two new checks appended at
the end), `test/perf-seed.test.ts`, and this log.

## POST-S DELTA

None observed. Per DEC-280, any future post-S delta discovered against
this result is a delta to log, never a STOP.
