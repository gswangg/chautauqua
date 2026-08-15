## 2026-08-10 task-w13-c — perf-smoke @ 3b7ed3d

Full detail: docs/verification-log/task-w13-c-perf-smoke-2.md

DEC-069 perf-smoke gate, verify-or-run (DEC-103), code-frozen (DEC-077)
log-only lane. Re-derived the newest code-bearing sha per DEC-091/
DEC-114 from a fresh worktree of `main`: `3b7ed3d` ("merge
task-w11-a"), matching DEC-118's expectation. `grep -n "perf-smoke @"
docs/verification-log.md` found `task-w11-d — perf-smoke @ 3b7ed3d`
(ends `RESULT: FAIL`) and `task-w12-c — perf-smoke @ 3543f09` (VOID
sha per this task's brief, but independently confirmed code-equivalent
to `3b7ed3d`, and also ends `RESULT: FAIL`) — no `RESULT: PASS`
section exists at this sha, so the full gate was run rather than
confirmed.

RESULT: FAIL — the w7-c/w8-b `event overview` D1-error OPEN ITEM is
independently reconfirmed CLOSED (200 on all requests, p95 16.09ms,
DEC-104 fix verified in-tree), and 9 of 10 timed checks plus all
DEC-089/DEC-094/DEC-105 probes PASS, but the harness does not complete
a clean run — it errors on the pre-existing, unfixed
`scripts/perf-seed.ts:269` `kind: "rating"` omission during the
"rating PUT" check, an out-of-scope defect for this code-frozen lane.

