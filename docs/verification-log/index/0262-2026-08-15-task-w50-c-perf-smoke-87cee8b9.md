## 2026-08-15 task-w50-c — perf-smoke @ 87cee8b9

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644, DEC-453, DEC-069), sequence 0262
(pre-allocated, DEC-068 wave-50). FROZEN GATE LANE. STEP 0: worktree cut
directly at `main` tip `87cee8b9` ("scribe wave 50"). `npx tsx
scripts/ref-state.ts` found the seven live `task-w49-*` refs
(`-a`,`-b`,`-c`,`-d`,`-e`,`-f`,`-h`; `-g` already an ancestor) NON-ancestor;
ran the bounded 10-attempt poll and every check reported the same
NON-ancestor state — per DEC-069 w48/w50's finding this lane delegated the
branch condition to the measuring lane and proceeded at its own tip rather
than blocking. STEP 0b precondition: `grep -c PERF_SPEAKER
scripts/perf-seed.ts` = 13 (inserts at lines 608, 627, 643, 659, identical
to every prior lane's receipt) — the documented recipe alone reaches every
check including the three portal rows; no local-D1 fixup applied.

### Ref-state receipt (verbatim)

DEC-644 three-sha boundary: HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`;
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
`task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

### Three-run result

**Run 1: 40/40 check-rows PASS, zero FAIL (fresh seed).** Runs 2 and 3:
both ERRORED before producing any row (`Error: fetchPendingSubmissionIds:
expected at least 1000 pending submissions, got 200`,
`scripts/perf-smoke.ts:270`), byte-identical both times. Named rows (run 1
only, adjusted p95, budget(read)=50ms unless noted): `reviewer queue`
25.7ms PASS. `plan progress (page 1)` 22.6ms PASS. `plan results (page 1)`
18.6ms PASS. `files library (page 1)` 12.2ms PASS. `onboarding grid`
20.6ms PASS. Three portal rows: `portal home` 15.2ms, `portal tasks`
8.8ms, `portal submission detail` 14.8ms — all PASS. `bulk status change`
(budget(write)=100ms) 33.3ms PASS in run 1, and is also the row whose
own non-idempotent write is the confirmed root cause blocking runs 2/3
from measuring anything.

Root cause (CONFIRMED-DEFECT, filed per DEC-453, not fixed — HARD SCOPE
forbids touching `scripts/`): `scripts/perf-smoke.ts:962-972` ("bulk
status change") alternates a 1000-id batch `accept_queue`<->`pending` via
`alternateByIteration` (`scripts/perf-smoke-lib.ts:226-231`) once per call,
but `WARMUP_ITERATIONS + MEASURED_ITERATIONS` = `5 + 30` = 35
(`scripts/perf-smoke.ts:70-71`) is odd, so the batch ends each run parked
at `accept_queue` instead of restored to `pending` — breaking the
comment's own stated intent ("repeatable forever") and starving the next
invocation's `fetchPendingSubmissionIds` (`scripts/perf-smoke.ts:270`,
itself a correct fail-loudly guard) of pending rows. Reproduced
deterministically across two consecutive invocations against the same
booted server/seeded D1. Owner: wave-51 lane.

This lane does not file all 40 rows individually as 40 separate
CONFIRMED-DEFECT rows — 39 of them never got a chance to run in runs 2/3
for a reason unrelated to their own handlers, and doing so would
misrepresent 39 healthy checks as individually broken. Full detail:
docs/verification-log/task-w50-c-perf-smoke-87cee8b9.md.

RESULT: FAIL — PARTIAL: run 1 (fresh seed) fully clean, 40/40 check-rows PASS
with wide margin, including all six historically marginal rows and all
three portal rows; no product regression found in any measured row. Runs 2
and 3 ERRORED before measuring due to a confirmed, reproducible
perf-smoke harness repeatability defect (not a product regression).
OPEN ITEMS: 1 (perf-smoke harness repeatability defect,
`scripts/perf-smoke.ts:70-71,962-972`, owner wave-51 lane)
