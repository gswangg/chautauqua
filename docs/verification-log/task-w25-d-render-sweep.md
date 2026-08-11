# task-w25-d — render-sweep @ b2dc2c1

Verification-only lane, DEC-225 wave-25 completion battery (frozen sha
per DEC-223/224: `b2dc2c103309433732bc689b933610fc7cfb3b06`, "merge
task-w23-b").

## STEP 1 — sha check (DEC-114 derivation + DEC-225 allow-list)

Re-derived `main`'s first-parent chain from `main`'s tip
(`b2991ecf6fce87332e2383e361903e063e0b9886`, "scribe wave 25") back to
the frozen sha:

```
b2991ec scribe wave 25
c36a77c merge task-w24-f
e591034 merge task-w24-c
fa2ae17 task-w24-f: triage-closure gate FAILS — sha drift past FROZEN 0a263d2
7dcbe65 task-w24-c: perf-smoke gate PASS @ 0a263d2 (DEC-222)
e92f8b4 merge task-w24-e
bfc8099 merge task-w24-d
04350dd merge task-w24-b
80dc009 merge task-w24-a
121f398 task-w24-e: spec-audit gate FAIL-STOP ...
40b1d14 task-w24-d: FAIL-STOP ...
0a8eb56 task-w24-b: walkthrough gate FAIL-STOP ...
3adb523 task-w24-a: FAIL-stop build+test gate log ...
cde03cd scribe wave 24
b2dc2c1 merge task-w23-b                              <- FROZEN sha (DEC-223/225)
```

`git diff --stat b2dc2c1..main` (13 files, 582 insertions / 28
deletions) confirms every touched path falls inside the DEC-225
allow-list: `decisions/DEC-221.md` .. `DEC-225.md`,
`docs/verification-log/task-w24-a-build-test.md` ..
`task-w24-f-triage-closure.md` (the "late task-w24-* log merges are
NOT drift" carve-out), `field-guide/index.md`, and
`src/decisions.ts` (pure `export const DEC_2xx = "...";` string-
constant appends). No code-bearing file outside the allow-list
changed. **No drift — proceeding to STEP 2.**

## STEP 2 — detached worktree render sweep

1. `git worktree add --detach
   /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w25-d-sweep
   b2dc2c103309433732bc689b933610fc7cfb3b06` (HEAD confirmed at
   `b2dc2c1 merge task-w23-b`).
2. `npm ci --prefer-offline --no-audit --no-fund` + `npx playwright
   install chromium`.
3. `npm run build` (tsc + tsc -p app/tsconfig.json + `vite build`,
   producing `public/admin/**`) — required so `wrangler dev`'s
   `run_worker_first: ["/admin","/admin/*"]` static-asset fallback has
   an SPA bundle to serve; without it every `/admin/*` route 404s (a
   worker-side gap in `scripts/render-sweep.ts`/CI's `render-sweep`
   job, which doesn't run `npm run build` first — noted for the
   scribe, not fixed here, out of this lane's single-file scope).
4. Read `app/src/routeManifest.ts`'s `ROUTE_MANIFEST` via
   `npx tsx -e "import {ROUTE_MANIFEST} ...; console.log(ROUTE_MANIFEST.length)"`
   → **34** entries (authoritative, not hardcoded).
5. Ran `npm run gate:render-sweep` (`scripts/render-sweep.ts`), which
   self-allocates a free TCP port (`findFreePort()`, port `61011` on
   this run — not 8961-8964), migrates + seeds D1/R2, boots
   `wrangler dev` on that port, logs in once per persona
   (organizer/reviewer/speaker) via the real `/login` HTML form using
   `docs/fixtures/sample-data.json` credentials, then visits every
   `ROUTE_MANIFEST` entry asserting: nav response status 200, non-
   empty rendered text (`#root` for `/admin/*` SPA routes per the
   w21-c methodology, `body` for SSR portal/public routes), and zero
   collected console-error/pageerror events.

   First attempt hit a stale local D1 state (leftover `.wrangler/`
   from a prior partial run) causing a `UNIQUE constraint failed:
   pipeline_entry` re-seed error; cleared `.wrangler/ .seed.sql
   .seed-assets/` and re-ran clean — not a route/render defect.

## Result — 34/34 PASS

| # | path | role | status |
|---|------|------|--------|
| 1 | /admin/overview | organizer | PASS |
| 2 | /admin/submissions | organizer | PASS |
| 3 | /admin/submissions/forms | organizer | PASS |
| 4 | /admin/submissions/seed_submission_0001 | organizer | PASS |
| 5 | /admin/speakers | organizer | PASS |
| 6 | /admin/content | organizer | PASS |
| 7 | /admin/agenda | organizer | PASS |
| 8 | /admin/comms | organizer | PASS |
| 9 | /admin/contacts | organizer | PASS |
| 10 | /admin/settings | organizer | PASS |
| 11 | /admin/review | organizer | PASS |
| 12 | /admin/review/plans/new | organizer | PASS |
| 13 | /admin/review/plans/seed_evaluation_plan_0001 | organizer | PASS |
| 14 | /admin/review/plans/seed_evaluation_plan_0001/progress | organizer | PASS |
| 15 | /admin/review/plans/seed_evaluation_plan_0001/results | organizer | PASS |
| 16 | /admin/review | reviewer | PASS |
| 17 | /admin/review/plans/seed_evaluation_plan_0001 | reviewer | PASS |
| 18 | /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 | reviewer | PASS |
| 19 | /portal | speaker | PASS |
| 20 | /portal/submissions/seed_submission_0001 | speaker | PASS |
| 21 | /portal/submissions/seed_submission_0001/edit | speaker | PASS |
| 22 | /portal/profile | speaker | PASS |
| 23 | /portal/tasks | speaker | PASS |
| 24 | /portal/tasks/seed_task_assignment_0001/form | speaker | PASS |
| 25 | /e/devflow-conf-2027/sessions | public | PASS |
| 26 | /e/devflow-conf-2027/speakers | public | PASS |
| 27 | /e/devflow-conf-2027/gallery | public | PASS |
| 28 | /e/devflow-conf-2027/agenda | public | PASS |
| 29 | /e/devflow-conf-2027/schedule | public | PASS |
| 30 | /submit/devflow-conf-2027 | public | PASS |
| 31 | /account/password | organizer | PASS |
| 32 | /account/password | reviewer | PASS |
| 33 | /account/password | speaker | PASS |
| 34 | /admin/* | organizer | PASS |

All three `/account/password` role entries (routeManifest.ts:129-131,
DEC-217) rendered non-blank with no error frame. The `/admin/*`
wildcard entry (routeManifest.ts:137, DEC-154) rendered via the
`#root` SPA-mount convention, matching w21-c's methodology. Total
entries swept: **34**, matching `ROUTE_MANIFEST.length` read live
from the file (not hardcoded). Zero blank renders, zero error frames,
zero raw exception text.

## Verdict

**RESULT: PASS.** 34/34 routes rendered with non-blank content, no
error frame, no raw exception text, zero console-error/pageerror
events. Worktree `task-w25-d-sweep` and its `wrangler dev` process
removed after the run.
