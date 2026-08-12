# 2026-08-10 task-w4-e — render-sweep @ d8d1cbd

Full detail for the `## 2026-08-10 task-w4-e — render-sweep @ d8d1cbd` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-144/DEC-139 sixth required battery section, wave 4 (DEC-162/163).
Frozen battery sha per DEC-163 (newest code-bearing first-parent `main`
sha after task-w4-a's wave-3 consolidation merges landed, independently
re-derived): `d8d1cbd` ("merge task-w3-c", the last code-bearing commit
before the docs-only `f357477` "scribe wave 4" — `git diff d8d1cbd
f357477 --stat` touches only `decisions/DEC-163.md`, `decisions/DEC-164.md`,
`field-guide/index.md`, `src/decisions.ts`, confirming code-identity).
Confirmed `d8d1cbd` descends from `2dd2f33` (DEC-129 homonym guard) and
remains an ancestor of the current `main` tip.

Note on process: this worktree's directory was unexpectedly removed
mid-run by an external process (concurrent swarm activity) after the
sweep below had already completed and its results recorded here from
the run's own output; the worktree/branch were recreated fresh from
`main` to write this section, and `d8d1cbd`'s ancestor/code-identity
checks were re-verified against the new tip before writing.

Procedure: fresh worktree, `npm ci`, `npm run build` (PASS, dual
`tsc --noEmit` + `vite build`, 131 modules), `rm -rf .wrangler/state`,
then `npm run gate:render-sweep` (DEC-144 serial Playwright sweep;
the script self-drives its own `wrangler d1 migrations apply` +
`scripts/seed.ts` + `scripts/seed-r2.ts` + `wrangler dev` boot on a
free port, so no separate manual `db:migrate`/`seed`/`dev` invocation
was layered on top — doing so first caused a `pipeline_entry` UNIQUE
constraint failure on the script's own re-seed, resolved by re-running
`rm -rf .wrangler/state` immediately before the gate script).

Route surface: **31 routes enumerated** (`app/src/routeManifest.ts`,
covering admin SPA + portal + public + the `/admin/*` SPA catch-all),
per-role breakdown: organizer 16, reviewer 3, speaker 6, public 6.
**29/31 PASS**, 2 FAIL:

1. `/admin/review/plans/seed_evaluation_plan_0001` (organizer, SPA) —
   empty rendered `#root` text; 1 console error + 1 pageerror, both
   `TypeError: Cannot read properties of undefined (reading 'includes')`
   at `index-CD2-kLqP.js:41:36098` (minified bundle; not resolved to
   source in this docs-only lane per the task's "record FAIL with
   specifics rather than fixing code" instruction). Note: the plan's
   `/progress` and `/results` sibling routes both render clean for the
   same plan id — only the top-level plan-detail page crashes.
2. `/portal/tasks/seed_task_assignment_0001/form` (speaker, SSR) —
   navigation itself returns HTTP 400 Bad Request (not a render/console
   issue past that point); console shows the browser's own "Failed to
   load resource: 400" for the page navigation. Wrangler dev log
   confirms: `GET /portal/tasks/seed_task_assignment_0001/form 400 Bad
   Request`.

Wave-3 UI placement per the task's request: the Pipeline tab
(`/admin/contacts`), Files tab (`/admin/content`), and submission
revision history (`/admin/submissions/seed_submission_0001`) all sit on
routes that ARE enumerated above and all PASS — these three features are
tab-/detail-internal state on already-swept routes, not separate URL
entries, so their own coverage is the existing component render smokes
(`FilesLibrary.render.test.tsx` etc.) rather than a dedicated sweep
route, consistent with the task brief's expectation.

`npm run build` and the sweep both ran clean of infrastructure errors;
the two failures above are both real HTTP/render defects, not sweep
tooling issues. Per this gate's instructions, no code fix was attempted.

RESULT: FAIL — 2 of 31 enumerated routes fail the render-sweep at
`d8d1cbd`: (1) `/admin/review/plans/seed_evaluation_plan_0001`
(organizer SPA route) renders an empty `#root` with a console/pageerror
`TypeError: Cannot read properties of undefined (reading 'includes')`;
(2) `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR route)
returns HTTP 400 instead of 200. All other 29 routes (organizer,
reviewer, speaker, public) are clean.
