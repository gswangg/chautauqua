## 2026-08-10 task-w5-e — render-sweep @ 64ec7de

Full detail: docs/verification-log/task-w5-e-render-sweep.md

DEC-144/DEC-139 sixth gate, wave-5 campaign (DEC-165/166); first full
render-sweep run against the wave-5 frozen battery sha. Frozen sha
derivation (first-parent walk on `main`, skipping bookkeeping):
`64ec7de` ("merge task-w5-a") is the current `main` tip — no bookkeeping
commits sit after it to skip. Confirmed it contains the CI render-sweep
job (`git show 64ec7de:.github/workflows/ci.yml` includes a `render-sweep:`
job invoking `npm run gate:render-sweep`) and `git merge-base
--is-ancestor 2dd2f33 64ec7de` succeeds (descends from the DEC-129
homonym-guard commit). Fresh worktree checked out directly at `64ec7de`.

OPEN ITEMS: 2 pre-existing route defects requiring a targeted fix wave
— (1) `/admin/review/plans/:id` plan-detail SPA route crashes with a
`TypeError: Cannot read properties of undefined (reading 'includes')`
in the bundled Review page code (progress/results siblings unaffected);
(2) `/portal/tasks/:id/form` returns HTTP 400 for the seeded task
assignment instead of rendering the task form. Both match the prior
wave-4 sweep's findings verbatim — not new regressions.

RESULT: FAIL — 2 of 31 enumerated routes fail the render-sweep at
`64ec7de`: (1) `/admin/review/plans/seed_evaluation_plan_0001`
(organizer SPA route) renders an empty `#root` with a console/pageerror
`TypeError: Cannot read properties of undefined (reading 'includes')`;
(2) `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR route)
returns HTTP 400 instead of 200. All other 29 routes (organizer,
reviewer, speaker, public) are clean.

