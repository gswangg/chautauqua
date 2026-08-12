# 2026-08-10 task-w8-b — perf-smoke @ d12eb25

Full detail for the `## 2026-08-10 task-w8-b — perf-smoke @ d12eb25` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Verify-or-run (DEC-103) re-run of the perf-smoke gate. Step 1: newest
code-bearing sha per DEC-091/DEC-090 unchanged since wave 7 —
`8c19466`/`4a1997b`/`075fc16`/`8eff481`/`7af78d9`/`52b9eaa`/`b17595e`/
`9e7ac53`/`4e2d53e`/`0828e32` all touch only `docs/`,
`docs/verification-log/`, `decisions/`, `field-guide/`, and
`src/decisions.ts` string appends — all DEC-090 bookkeeping-exempt.
Confirmed: **d12eb25** ("merge task-w6-d").

Step 2: grepped `docs/verification-log.md` for a perf-smoke section at
`d12eb25` — found task-w7-c's section immediately above, but it ends
`RESULT: FAIL` (event-overview 500 scale defect), not `RESULT: PASS`,
so per DEC-103 this counts as absent and the full gate was re-run
rather than confirmed.

Ran from this worktree at `main`'s `d12eb25` code (no code-bearing
commits since): `npm ci` (already present), `npm run build` PASS
(matches task-w7-a/task-w7-c bundle output), `npm run db:migrate` (10
migrations, all ✅), `npm run seed`, `npm run perf:seed` (300 accepted
/ 12 reviewers per DEC-088). Started `wrangler dev --port 8813`
(DEC-103 alternate port, distinct from 8803/8811, never 8787); `/health`
returned `{"ok":true}` on the first try.

`PERF_URL=http://localhost:8813 npm run perf:smoke`:

- DEC-089/DEC-080/DEC-094 cap probe (300 real + 1 nonexistent id ->
  `.ics` 400): ran and passed (no `DEC-080 cap assertion failed` throw
  before the timed-checks loop was entered).
- Timed checks `submissions list (page 1)`, `submissions list
  (q=...)`, and `submission detail` completed without error.
- `event overview` failed during warmup with HTTP 500. Server log:
  `D1_ERROR: too many SQL variables at offset 396: SQLITE_ERROR`,
  raised from `getOverviewPayload` at
  `src/server/repo/overview.ts:170`'s unbounded `inArray(...,
  placedIds)` participant fan-out at DEC-088's ~300-accepted-and-placed
  perf scale — byte-for-byte the same defect and call site task-w7-c
  reported. `scripts/perf-smoke.ts` aborts (`Error: event overview
  failed during warmup: 500`) before reaching the remaining checks
  (`public sessions page`, `public agenda`, `schedule.ics 150 ids`,
  `plan progress`, `rating PUT`), so no p95 numbers exist for any
  check.

This is a verification-only, code-frozen (DEC-077) task — no fix is in
scope here; the defect at `src/server/repo/overview.ts:170` remains
open for a future code-bearing lane.

OPEN ITEMS: 1 — `src/server/repo/overview.ts:170`'s unbounded
`inArray(..., placedIds)` fan-out throws `D1_ERROR: too many SQL
variables` at DEC-088 perf scale (~300 placed participants), blocking
all perf-smoke checks after `submission detail`.

RESULT: FAIL — perf-smoke re-run @ d12eb25 confirms task-w7-c's
finding: `event overview` 500s under DEC-088 perf scale
(`src/server/repo/overview.ts:170`, too many SQL variables); no gate
PASS section exists at the newest code-bearing sha, and none can be
produced without a code-bearing fix, which is out of scope for this
code-frozen verification task.
