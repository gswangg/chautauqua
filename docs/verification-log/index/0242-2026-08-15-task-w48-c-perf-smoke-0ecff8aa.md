## 2026-08-15 task-w48-c — perf-smoke @ 0ecff8aa

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

TIER-0 MEASUREMENT LANE, LOG-ONLY (DEC-644, DEC-453, DEC-069), sequence 0242
(pre-allocated, DEC-068 wave-48). FROZEN GATE LANE. STEP 0: `git merge
--no-edit main` at worktree creation reported "Already up to date"
(worktree cut at `main` tip `0ecff8aa`). `npx tsx scripts/ref-state.ts`
found all eight live `task-w47-*` refs NON-ancestor; ran the full 10-poll
bounded budget (`git merge --no-edit main` + re-check, ~5s apart) and every
poll reported "Already up to date" with no `task-w47-*` ref landing on
`main` — per DEC-069 w48's finding, this lane delegated the branch
condition to the measuring lane and proceeded to the heavy phase at its own
tip rather than blocking further. STEP 0b precondition: `grep -c
PERF_SPEAKER scripts/perf-seed.ts` = 13 (inserts at lines 608, 627, 643,
659, identical to task-w44-c's 0222 receipt) — the documented recipe alone
reaches every check including the three portal rows; no local-D1 fixup
needed. A final re-sync attempt immediately before naming this receipt's
sha found `main` had fast-forwarded past `0ecff8aa` with real product
commits during the heavy phase (contacts merge/import, portal repo,
auto-schedule changes); since those commits were never exercised by this
lane's measurement, this lane ran `git reset --hard 0ecff8aa` to restore
and file at the exact sha measured, per DEC-453 (a fixup/re-sync here would
misrepresent the measurement, not correct it). Full receipt below.

### Ref-state receipt (verbatim, taken at 0ecff8aa after the reset)

DEC-644 three-sha boundary: HEAD `0ecff8aa30939f9fcc741f68be2dfb19e9be58e4`;
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
`task-w72-j`.

### Three-run result

**117/117 check-rows PASS in all three runs (39 rows x 3 runs), zero FAIL.**
Named rows (adjusted p95, budget(read)=50ms unless noted), run1/run2/run3:
`reviewer queue` (`src/routes/review/reviewer.ts`) 23.1/20.2/21.8ms — 3/3
PASS. `plan progress (page 1)` (`src/routes/review/plans-progress.ts`, the
row 0213 originally flagged ADVISORY/marginal) 23.4/24.1/25.3ms — 3/3 PASS,
well under the 50ms budget, consistent with 0222's fresh measurement, no
regression. `plan results (page 1)` 19.2/20.6/19.6ms, 3/3 PASS. `files
library (page 1)` 12.0/12.6/11.0ms, 3/3 PASS. `onboarding grid`
20.8/21.2/22.1ms, 3/3 PASS. Three portal rows (`portal home`/`portal
tasks`/`portal submission detail`) 16.0/15.5/13.4ms, 6.8/11.0/8.5ms,
14.5/14.2/14.9ms — all 3/3 PASS, reached via the documented recipe alone
(no local D1 fixup needed).

This lane's host was under heavy concurrent load throughout (observed
`uptime` load averages 14-24 on an 8-core machine, consistent with several
sibling wave-47/wave-48 lanes running concurrently), which materially
slowed the SEED phase (`npm run seed`, `wrangler d1 execute --local` bulk
insert of 31665 statements per `perf:seed` run) relative to task-w44-c's
0222 receipt, but did not affect the MEASURED perf:smoke numbers
themselves — each measured pass ran against an idle, already-seeded server
with no concurrent write contention.

Full detail: docs/verification-log/task-w48-c-perf-smoke-0ecff8aa.md.

RESULT: PASS — every one of 117 check-rows under budget across all three
runs at `0ecff8aa`; all six historically marginal rows named in this task's
briefing (`reviewer queue`, `plan progress (page 1)`, `plan results (page
1)`, `files library (page 1)`, `onboarding grid`, three portal rows)
measure comfortably under budget in every run — no regression found on
fresh measurement.
OPEN ITEMS: 0
