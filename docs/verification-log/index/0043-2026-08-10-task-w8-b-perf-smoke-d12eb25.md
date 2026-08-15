## 2026-08-10 task-w8-b — perf-smoke @ d12eb25

Full detail: docs/verification-log/task-w8-b-perf-smoke.md

Verify-or-run (DEC-103) re-run of the perf-smoke gate. Step 1: newest
code-bearing sha per DEC-091/DEC-090 unchanged since wave 7 —
`8c19466`/`4a1997b`/`075fc16`/`8eff481`/`7af78d9`/`52b9eaa`/`b17595e`/
`9e7ac53`/`4e2d53e`/`0828e32` all touch only `docs/`,
`docs/verification-log/`, `decisions/`, `field-guide/`, and
`src/decisions.ts` string appends — all DEC-090 bookkeeping-exempt.
Confirmed: **d12eb25** ("merge task-w6-d").

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

