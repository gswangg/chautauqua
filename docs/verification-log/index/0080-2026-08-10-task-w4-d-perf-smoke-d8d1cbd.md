## 2026-08-10 task-w4-d — perf-smoke @ d8d1cbd

Full detail: docs/verification-log/task-w4-d-perf-smoke.md

**Frozen sha.** Adopts the same `d8d1cbd` ("merge task-w3-c") frozen
battery sha already derived and recorded by the sibling gate lane
`task-w4-f — spec-audit` (this file, above): first-parent walk from
`main` tip found no literal `merge task-w4-a` commit for this wave
(DEC-163's designated "sole code-bearing lane" never landed a
commit by that exact label in this campaign round); the newest
first-parent commit that is not bookkeeping-only per DEC-114 is
`d8d1cbd`, which is code-bearing (files library + ZIP archive,
DEC-159/160). `git merge-base --is-ancestor 2dd2f33 d8d1cbd` exits 0
— descends from `2dd2f33` (DEC-129). Using the same sha the other
five gate lanes of this wave cite keeps the battery consistent
(DEC-163).

OPEN ITEMS: 0

RESULT: PASS

