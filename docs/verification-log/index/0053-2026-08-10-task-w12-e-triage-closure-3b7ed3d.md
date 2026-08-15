## 2026-08-10 task-w12-e — triage-closure @ 3b7ed3d

Full detail: docs/verification-log/task-w12-e-triage-closure.md

DEC-069 fifth-section triage-closure gate (log-only lane, DEC-068
append-only), chained behind task-w12-c per DEC-117 so the new green
perf-smoke evidence for the overview.ts fix is citable. Worktree
branched from `main` after task-w12-c and task-w12-d merged (tip
`9a441aa`, "merge task-w12-d"). Mirrors task-w8-d's structure
(this file, previously lines 1207-1302).

OPEN ITEMS: 1 — `scripts/perf-seed.ts`'s `criteria_json` literal
(~line 269) omits `kind: "rating"`, required by
`src/domain/evaluation.ts`'s `EvaluationCriterionDef` union, so every
`rating PUT` perf-smoke check 400s ("criterion \"overall\" has no
options defined") and blocks the harness from reaching or timing the
remaining checks (`public sessions page`, `public agenda`,
`schedule.ics 150 ids`, `plan progress`). No code-bearing fix exists on
`main` yet (this lane is log-only, DEC-068). A future code-bearing wave
must add `kind: "rating"` to the seeded criterion and re-run
perf-smoke to close the DEC-069 predicate. The overview.ts OPEN ITEM
carried since task-w7-c/task-w8-b is CLOSED and not carried forward.

RESULT: FAIL — perf-smoke gate scope is not a clean PASS at the newest
code-bearing sha `3b7ed3d` (`scripts/perf-seed.ts` rating-criterion
seed defect, confirmed independently by task-w11-d and task-w12-c);
build+test/walkthrough/spec-audit are all PASS, the prior standing
overview.ts OPEN ITEM is closed with runtime evidence, and no
post-`3b7ed3d` commit is code-bearing, so this is a single new
log-only-scope-out-of-bounds open product-code item for a future wave,
not a predicate reset.

RESULT: PASS

