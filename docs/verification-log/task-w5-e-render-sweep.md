# 2026-08-10 task-w5-e — render-sweep @ 64ec7de

Full detail for the `## 2026-08-10 task-w5-e — render-sweep @ 64ec7de` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-144/DEC-139 sixth gate, wave-5 campaign (DEC-165/166); first full
render-sweep run against the wave-5 frozen battery sha. Frozen sha
derivation (first-parent walk on `main`, skipping bookkeeping):
`64ec7de` ("merge task-w5-a") is the current `main` tip — no bookkeeping
commits sit after it to skip. Confirmed it contains the CI render-sweep
job (`git show 64ec7de:.github/workflows/ci.yml` includes a `render-sweep:`
job invoking `npm run gate:render-sweep`) and `git merge-base
--is-ancestor 2dd2f33 64ec7de` succeeds (descends from the DEC-129
homonym-guard commit). Fresh worktree checked out directly at `64ec7de`.

Procedure: `npm ci` (cached, silent), `npm run build` (PASS — dual
`tsc --noEmit` + `vite build --config app/vite.config.ts`, 131 modules
transformed, admin SPA bundle emitted to `public/admin/`), `npx
playwright install chromium` (already cached, exit 0), then `npm run
gate:render-sweep`. The script self-drove its full documented sequence:
`wrangler d1 migrations apply --local` (13 migrations incl.
`0012_pipeline.sql`/`0013_submission_revision.sql`), `scripts/seed.ts`
+ `.seed.sql` D1 load, `scripts/seed-r2.ts`, then booted `wrangler dev`
on a self-selected free port, logged in via the real `/login` form as
each of organizer/reviewer/speaker from
`docs/fixtures/sample-data.json`, then visited every
`app/src/routeManifest.ts` entry.

Route surface: **31 routes enumerated**, per-role breakdown: organizer
16, reviewer 3, speaker 6, public 6 (incl. the `/admin/*` SPA
catch-all). **29/31 PASS**, 2 FAIL — identical failure set and error
signatures to the prior wave-4 render-sweep at `d8d1cbd` (see the
`task-w4-e — render-sweep @ d8d1cbd` section above), confirming these
are persistent, unfixed defects rather than sha-specific regressions:

1. `/admin/review/plans/seed_evaluation_plan_0001` (organizer, SPA) —
   empty rendered `#root` text; 1 console error + 1 pageerror, both
   `TypeError: Cannot read properties of undefined (reading 'includes')`
   inside the bundled `Review-*.js`/`index-*.js` chunks (minified; not
   resolved to source in this log-only lane per the task's freeze
   instruction). The plan's own `/progress` and `/results` sibling
   routes both render clean — only the top-level plan-detail page
   crashes.
2. `/portal/tasks/seed_task_assignment_0001/form` (speaker, SSR) —
   navigation itself returns HTTP 400 Bad Request (confirmed in the
   wrangler dev server log: `GET /portal/tasks/seed_task_assignment_0001/form
   400 Bad Request`), not a render/console issue past that point.

`npm run build` and the sweep both ran clean of infrastructure/tooling
errors; the script did not print `gate:render-sweep OK` (exit
non-zero) because of the 2 route failures above. Per DEC-077-style
freeze for this gate, no code fix was attempted — recording FAIL for a
targeted fix wave.

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
