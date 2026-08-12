# 2026-08-10 task-w12-c — perf-smoke @ 3543f09

Full detail for the `## 2026-08-10 task-w12-c — perf-smoke @ 3543f09` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069 perf-smoke gate at DEC-088 scale, port 8833. Re-derived the
newest code-bearing sha per DEC-114: worktree branched from `main` at
`2b4a5b9`. `git diff --stat 3543f09 <main tip>` (checked against both
`546cbcc` and `2b4a5b9`, main advanced mid-run) confirms the only files
that changed since `3543f09` ("merge task-w10-e", the sha this task's
brief expected as authoritative per DEC-114/DEC-116) are
`decisions/DEC-113..117.md`, `docs/verification-log.md`,
`field-guide/index.md`, `src/decisions.ts` (constant additions only),
and `scripts/walkthrough/speaker.ts` (walkthrough probe landing per
DEC-112/DEC-113/DEC-116) — zero diff to `src/server/repo/overview.ts`
or any other production route/repo file since `3543f09`, so `3543f09`
and the current main tip are equivalent for this gate's purposes and
running at tip is representative.

**Fix confirmed in-tree.** `src/server/repo/overview.ts:11` imports
`chunkIds` from `../../lib/chunk`; lines 170-177 batch
`participant` lookups over `placedIds` via
`for (const batch of chunkIds(placedIds)) { ... inArray(...,
batch) ... }` instead of a single unbounded `inArray(...,
placedIds)` call. `git log --oneline -- src/server/repo/overview.ts`
shows this landed at `07ebe76` ("w9-a: chunk overview.ts participant
fan-out (DEC-104/DEC-078)"), well before `3543f09`.

**Gate run.** `npm ci` (already present), `npm run build` (green:
`tsc --noEmit` x2 + `vite build`, no errors), `npm run db:migrate`
(all 10 migrations applied clean), `npm run seed`, `npm run perf:seed`
(DEC-088 scale: 2,000 submissions / 300 accepted+placed / 12
reviewers), `npx wrangler dev --port 8833` (bindings up, `/health`
200), then `PERF_URL=http://localhost:8833 npm run perf:smoke`.

The DEC-089/DEC-094 cap probe (301-id `schedule.ics` -> 400) and the
DEC-105 CSV export size probes ran without throwing (execution
proceeded past both into the timed-check loop), then all of
"submissions list (page 1)", "submissions list (q=...)", "submission
detail", **"event overview"**, "organizer agenda (300 accepted)",
"public sessions page", "public agenda", "schedule.ics 150 ids", and
"plan progress (12 reviewers)" completed their full 5-warmup +
30-measured cycles with 200 status on every request (confirmed by the
harness's fail-fast `timeCheck`: if any earlier check had failed, the
thrown error would have named that check, not the one below). The
harness only failed on the *last* check, "rating PUT" — 400 on its
first warmup call — which is unrelated to `overview.ts` / DEC-104: it
is a pre-existing `scripts/perf-seed.ts:269` seed-data bug
(`criteria_json: [{ id: "overall", label: "Overall", weight: 1 }]`
omits the required `kind: "rating"` discriminant, so
`validateEvaluationScores` (`src/domain/evaluation.ts:167`) falls
through to the dropdown branch and rejects with "no options defined").
Out of scope for a code-frozen (DEC-077) run — flagging as a new OPEN
ITEM for a future perf-seed fix task; `scripts/perf-seed.ts` was not
touched here.

Because the harness throws before printing its p95 table, exact
"event overview" latency was captured with a standalone,
repo-unmodifying probe (run from outside the worktree, in scratch
space — no repo file written or changed) that replays the harness's
identical login + 5-warmup/30-measured methodology against the same
running `wrangler dev --port 8833` instance and seeded data,
immediately after the perf:smoke run: **"event overview": 200 OK on
all 35 requests (5 warmup + 30 measured); p95 = 22.02ms** (samples
ranged ~11.6-57.2ms, well under the `PERF_P95_BUDGET_MS = 150` budget
in `scripts/perf-smoke-lib.ts:8`).

**Standing OPEN ITEM resolved.** The task-w7-c/task-w8-b perf-smoke
FAIL — `event overview` 500'ing during warmup with `D1_ERROR: too many
SQL variables` from `overview.ts`'s unbounded `inArray(...,
placedIds)` fan-out at ~300 placed submissions — is resolved by the
landed DEC-104 `chunkIds` batching fix at
`src/server/repo/overview.ts:170`. At DEC-088 scale (300
accepted+placed), `event overview` now returns 200 with p95 22.02ms
instead of 500ing.

A new, separate, non-overview issue (the `rating PUT` seed-data `kind`
omission) prevented the harness's own p95 table from being printed in
this run; it does not implicate `overview.ts` or DEC-104 and is
reported as a new OPEN ITEM rather than fixed here (code-frozen
scope). Dev server killed after the run.

RESULT: FAIL — perf:smoke harness errored on the unrelated "rating
PUT" seed-data bug (scripts/perf-seed.ts:269 criteria_json missing
`kind: "rating"`) after the DEC-104 overview fix was independently
confirmed resolved (event overview: 200, p95 22.02ms; DEC-089/094/105
probes all passed); the standing overview-500 OPEN ITEM from
task-w7-c/task-w8-b is closed, but this run itself does not close as a
clean full-gate PASS.
