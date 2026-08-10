# Eval findings — round 1 (post-convergence final review, 2026-08-10)

Round 1 (source: `2103c69`, the campaign's fresh-eyes final review) is
**fully dispositioned. Zero open findings remain in this file.**

All five numbered issues plus all four narrowing-decision items are
closed in-tree, with file:line evidence, in
`docs/verification-log/task-w4-e-triage-closure.md` section "(1)
Disposition of docs/eval-findings.md round-1 entries" (and the
corresponding `docs/verification-log.md` "2026-08-10 task-w4-e —
triage-closure" append).

Two unrelated script-only bugs (walkthrough scale step 6, perf-smoke
301-id cap probe) were found during this task's mandatory FAIL/PLANNER:
sweep of the wave-4 gate detail files — they are **not** round-1
eval-findings items; they were tracked in
`docs/verification-log/task-w4-e-triage-closure.md` section "(3)" and
are now **CLOSED**: both were fixed by `b638f75` (DEC-094/095/096) and
runtime-confirmed closed by `task-w5-f`'s triage-closure and
`task-w5-c`'s walkthrough PASS, per `task-w8-d`'s triage-closure sweep
(section "(3)", which flagged this paragraph's prior "open items for a
future code-bearing wave" phrasing as stale). No live findings remain.
