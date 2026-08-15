## 2026-08-10 task-w4-e — render-sweep @ d8d1cbd

Full detail: docs/verification-log/task-w4-e-render-sweep.md

DEC-144/DEC-139 sixth required battery section, wave 4 (DEC-162/163).
Frozen battery sha per DEC-163 (newest code-bearing first-parent `main`
sha after task-w4-a's wave-3 consolidation merges landed, independently
re-derived): `d8d1cbd` ("merge task-w3-c", the last code-bearing commit
before the docs-only `f357477` "scribe wave 4" — `git diff d8d1cbd
f357477 --stat` touches only `decisions/DEC-163.md`, `decisions/DEC-164.md`,
`field-guide/index.md`, `src/decisions.ts`, confirming code-identity).
Confirmed `d8d1cbd` descends from `2dd2f33` (DEC-129 homonym guard) and
remains an ancestor of the current `main` tip.

RESULT: FAIL — 2 of 31 enumerated routes fail the render-sweep at
`d8d1cbd`: (1) `/admin/review/plans/seed_evaluation_plan_0001`
(organizer SPA route) renders an empty `#root` with a console/pageerror
`TypeError: Cannot read properties of undefined (reading 'includes')`;
(2) `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR route)
returns HTTP 400 instead of 200. All other 29 routes (organizer,
reviewer, speaker, public) are clean.

