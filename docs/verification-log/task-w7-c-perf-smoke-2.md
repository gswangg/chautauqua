# 2026-08-10 task-w7-c — perf-smoke @ d12eb25

Full detail for the `## 2026-08-10 task-w7-c — perf-smoke @ d12eb25` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-7 code-frozen perf-smoke gate (DEC-077/DEC-089/DEC-094/DEC-102).
Newest code-bearing sha re-derived per DEC-091/DEC-090 (walking `main`
from tip `52b9eaa`: `52b9eaa`/`b17595e`/`9e7ac53`/`4e2d53e`/`0828e32` are
all bookkeeping-only): **d12eb25** ("merge task-w6-d") — matches
task-w7-a's own citation in this wave.

`npm ci`, `npm run build` (PASS, matches task-w7-a's bundle figures
exactly), `npm run db:migrate` (10 migrations), `npm run seed`, `npm run
perf:seed` (verified 300 accepted / 12 reviewers per DEC-088) all
succeeded. `wrangler dev --port 8803` came up healthy. `PERF_URL=
http://localhost:8803 npm run perf:smoke`:

- DEC-089/DEC-080/DEC-094 cap probe (300 real + 1 nonexistent id ->
  `.ics` 400): **PASS** — confirms the DEC-094 pagination fix closes
  the mismatch task-w4-c's perf-smoke gate previously recorded as FAIL.
- Three timed checks completed (`submissions list page 1`, `submissions
  list search`, `submission detail`), but their p95 data was never
  printed (the results table only prints after the full loop).
- The `event overview` timed check then failed with HTTP 500:
  `D1_ERROR: too many SQL variables` inside
  `src/server/repo/overview.ts:170`'s unbounded `inArray(...,
  placedIds)` participant fan-out at DEC-088's ~300-accepted-and-placed
  perf scale. This is a newly-found scale defect, unrelated to
  DEC-094/095, never previously exercised by `npm test` or the
  walkthrough gates. No p95 data exists for any of the remaining
  checks (`public sessions page`, `public agenda`, `schedule.ics 150
  ids`, `plan progress`, `rating PUT`).

`npm test --silent`: 96 files / 984 tests, all PASS (matches task-w7-a
exactly).

Mid-task note: the `chautauqua-wt/task-w7-c` worktree/branch and its
background `wrangler dev` process were externally wiped after the
perf-smoke run above had already completed and its output was
captured; recreated the worktree at `main`'s then-tip `52b9eaa` (still
`d12eb25` for the code-bearing sha, `git log` unchanged) to write up
and commit these docs. No code-bearing merge landed on `main` during
this task's execution window.

Full detail: `docs/verification-log/task-w7-c-perf-smoke.md`.

OPEN ITEMS: 1

RESULT: FAIL
