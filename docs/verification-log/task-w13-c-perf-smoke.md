# task-w13-c — perf-smoke @ 3b7ed3d — detail

DEC-069 perf-smoke gate, verify-or-run (DEC-103), code-frozen (DEC-077)
log-only lane. Fresh worktree of `main` at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w13-c`.

## Step 1 — sha re-derivation (DEC-091/DEC-114)

Worktree HEAD at branch time: `a6eb789` ("scribe wave 13"). Walking the
first-parent chain back from `a6eb789`:

- `a6eb789` ("scribe wave 13"): `decisions/DEC-118.md`, `decisions/DEC-119.md`,
  `field-guide/index.md`, `src/decisions.ts` only — bookkeeping.
- `15a422a` ("scribe wave 12"): `decisions/DEC-116.md`, `decisions/DEC-117.md`,
  `field-guide/index.md`, `src/decisions.ts` only — bookkeeping.
- `9a441aa`, `2aad317`, `f723430`, `3d5d34f`, `3cfa744`, `2b4a5b9`,
  `e309b59`, `546cbcc` (merges task-w12-d/c/b/w11-d/task-w12-a/w11-c/
  w11-b/w11-e): each `git diff --name-only <parent1> <merge>` touches
  only `docs/verification-log.md` — bookkeeping.
- `3b7ed3d` ("merge task-w11-a"): first-parent diff touches
  `scripts/walkthrough/speaker.ts` (walkthrough probe additions) —
  outside the DEC-114 bookkeeping exclusion set, so code-bearing.

Newest code-bearing sha: **`3b7ed3d`** ("merge task-w11-a"), matching
this task's expected sha (DEC-118) exactly.

## Step 2 — verify-or-run (DEC-103)

`grep -n "perf-smoke @" docs/verification-log.md` found two prior
perf-smoke sections at this sha's code state:

- `## 2026-08-10 task-w11-d — perf-smoke @ 3b7ed3d` — ends
  `RESULT: FAIL` (event-overview D1-error OPEN ITEM closed via the
  DEC-104 chunk fix, but the run itself aborted on a distinct
  `scripts/perf-seed.ts` seed-data bug during the `rating PUT` check,
  before the harness's own p95 table printed).
- `## 2026-08-10 task-w12-c — perf-smoke @ 3543f09` — cites `3543f09`,
  a VOID sha per this task's brief, but its own re-derivation (walking
  from `2b4a5b9`) independently confirms `3543f09` and current tip are
  code-equivalent (zero diff on `src/server/repo/overview.ts` or any
  other production file), and it also ends `RESULT: FAIL` on the same
  `rating PUT` seed-data bug.

Neither section ends `RESULT: PASS`, so per DEC-103 this lane must run
the full gate rather than confirm-only.

## Step 3 — full gate run

Fresh local D1 state was not required (worktree just branched, no
`.wrangler/state` pre-existed), but `rm -rf .wrangler/state` was run
defensively before migrating.

- `npm ci --prefer-offline --no-audit --no-fund --silent`: clean, used
  cache.
- `npm run build`: PASS — `tsc --noEmit` (root) + `tsc --noEmit -p
  app/tsconfig.json` + `vite build` all clean, 125 modules / 17 chunks.
- `npm run db:migrate`: all 10 migrations applied (`0000`..`0009`),
  none skipped.
- `npm run seed`: fixtures + 6 R2 objects loaded (organizer login used
  below comes from this fixture, per DEC-119/task-w16-c precedent:
  `npm run seed` must run before `npm run perf:seed` because
  `scripts/perf-smoke.ts` logs in as the fixture organizer).
- `npm run perf:seed`: DEC-088 scale verified directly against D1
  (`npx wrangler d1 execute chautauqua --local --command`):
  `submission` rows for `seed_perf_event` = 2000 total / 300 accepted;
  `user` rows with id LIKE `seed_perf_reviewer%` = 12 (the 16-row
  `role='reviewer'` count includes 4 non-perf fixture reviewers from
  `npm run seed`).
- `npx wrangler dev --port 8843` (never 8787, per DEC-119): came up
  healthy, `GET /health` -> `{"ok":true}`.
- `PERF_URL=http://localhost:8843 npm run perf:smoke`:
  - DEC-089/DEC-080 cap probe (300 real accepted ids +
    `sub_cap_probe_nonexistent_0001`, public unauthenticated
    `schedule.ics`): **PASS** (400, as required — the assertion in
    `scripts/perf-smoke.ts:214-218` did not throw).
  - DEC-105 untimed export min-line probes: `export/submissions?
    format=csv` 200 with >=2001 lines, `exports/showflow.csv` 200 with
    >=301 lines: both **PASS** (no throw past `perf-smoke.ts:239`).
  - Timed-check loop (`perf-smoke.ts:248-323`, in array order):
    "submissions list (page 1)", "submissions list (q=...)",
    "submission detail", **"event overview"**, "organizer agenda (300
    accepted)", "public sessions page", "public agenda", "schedule.ics
    150 ids", "plan progress (12 reviewers)" all completed their full
    5-warmup + 30-measured cycles with 200 on every request — the
    harness's fail-fast `timeCheck` (throws immediately naming the
    check on any non-ok response) never named any of these, only the
    tenth and final check.
  - The run **failed during warmup on "rating PUT"**
    (`PUT /api/v1/review/plans/seed_perf_plan_0001/evaluations/:id`)
    with the exact error the prior FAIL sections recorded:
    `Error: rating PUT failed during warmup: 400`
    (`scripts/perf-smoke.ts:142`). Root cause, confirmed unchanged in
    this worktree: `scripts/perf-seed.ts:269`'s seeded
    `criteria_json` is `[{"id":"overall","label":"Overall","weight":1}]`
    — it omits the `kind: "rating"` discriminant that
    `src/domain/evaluation.ts`'s `EvaluationCriterionDef` union
    requires; `validateEvaluationScores` falls through to the
    `dropdown` branch and rejects with `"criterion \"overall\" has no
    options defined"`. `git log --oneline -- scripts/perf-seed.ts`
    shows no commit has touched this file since `2a1c2c8` ("Extend
    perf seed with DEC-088 schedule/plan/reviewer contract"), well
    before `3b7ed3d` — the bug is unchanged from the prior task-w11-d/
    task-w12-c runs.
  - Because the harness throws before printing its p95 table, exact
    "event overview" latency was captured with a standalone,
    repo-unmodifying probe (run from outside the worktree, in scratch
    space — no repo file written or changed) that replays the
    harness's identical login + 5-warmup/30-measured methodology
    against the same running `wrangler dev --port 8843` instance and
    seeded data, immediately after the perf:smoke run:
    **"event overview": 200 OK on all 35 requests (5 warmup + 30
    measured); p95 = 16.09ms** (samples ranged ~12.3-17.7ms), well
    under the `PERF_P95_BUDGET_MS = 150` budget in
    `scripts/perf-smoke-lib.ts`.

## Disposition of the w7-c/w8-b OPEN ITEM

`GET /api/v1/events/:id/overview` at DEC-088 scale (300 accepted +
placed submissions, 2000 total) no longer 500s. The landed DEC-104 fix
is confirmed in-tree at this sha:

- `src/server/repo/overview.ts:11` — `import { chunkIds } from
  "../../lib/chunk";`
- `src/server/repo/overview.ts:170-177` — the `placedIds` participant
  fan-out is batched: `for (const batch of chunkIds(placedIds)) { ...
  inArray(schema.participant.submissionId, batch) ... }`, replacing
  the prior single unbounded `inArray(schema.participant.submissionId,
  placedIds)` call that produced `D1_ERROR: too many SQL variables` at
  `d12eb25` (`task-w7-c`/`task-w8-b`).

This run's "event overview" check reached full 35-request warmup +
measurement with 200 on every request (p95 16.09ms, see above,
captured via the standalone probe since the harness's own table never
printed). **The w7-c/w8-b failure mode (`D1_ERROR: too many SQL
variables` / 500) does not reproduce at DEC-088 scale.** This confirms
(rather than newly discovers) the disposition already recorded by
task-w11-d and task-w12-c: the OPEN ITEM is CLOSED.

## Remaining OPEN ITEM (unchanged, out of scope per DEC-077)

`scripts/perf-seed.ts:269`'s `criteria_json` literal is missing the
`kind: "rating"` field required by `src/domain/evaluation.ts`'s
`EvaluationCriterionDef` union (`RatingCriterionDef |
DropdownCriterionDef`), causing every `rating PUT` perf-smoke check to
fail 400 with `"criterion \"overall\" has no options defined"`. This
is a pre-existing, unfixed seed-script bug (not a product/domain bug
— `src/domain/evaluation.ts` behaves per its DEC-018 contract), first
recorded by task-w11-d, independently reconfirmed by task-w12-c, and
reconfirmed again unchanged in this run. Per this lane's code-frozen
scope (DEC-077), `scripts/perf-seed.ts` was left unmodified. A future
code-bearing wave must add `kind: "rating"` to the seeded criterion
and re-run perf-smoke to obtain a clean full-gate PASS (all 10 timed
checks + p95 table in a single harness run).

## npm test

`npm test --silent`: **104 test files, 1030 tests, all PASS**, 0
failures.

## Cleanup

`wrangler dev --port 8843` process killed after the run;
`lsof -i :8843` confirmed no listener remained (port released).

RESULT: FAIL — perf-smoke gate scope is not green at the newest
code-bearing sha `3b7ed3d`: the w7-c/w8-b `event overview` D1-error
OPEN ITEM is independently reconfirmed CLOSED (200 on all requests,
p95 16.09ms, DEC-104 chunking fix verified in-tree at
`overview.ts:11,170-177`), and DEC-089/DEC-094/DEC-105 cap/export
probes plus 9 of 10 timed checks all PASS, but the harness itself does
not complete a clean run — it errors on the pre-existing, unfixed
`scripts/perf-seed.ts:269` `criteria_json` `kind: "rating"` omission
during the `rating PUT` check, an out-of-scope defect for this
code-frozen (DEC-077) lane, unchanged from task-w11-d/task-w12-c.
