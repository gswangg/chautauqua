# STAGE-1 exit gate 4/6 — browser render-sweep (task-w23-d)

## FROZEN SHA
e3d558ea5628cbe1a7260489c2c5ddc1d487c7db (`scribe wave 23`, tip of `main` at worktree creation)

This is the first browser render-sweep run since task-w15-e (f0d56ce), i.e. the
first time a real headless-Chromium browser has loaded the admin SPA bundle
since the wave-19/20 rewrite that made the admin surfaces server-paged
(DEC-340 J6 grid, DEC-341 J8 filter/sort/page, DEC-344 files library, DEC-345
results ranked server-side, DEC-350 J5 picker, and the wave-19 server-driven
worklist that made `deliverableCounts` a required envelope field).

## DEC-361 presence check (task-w21-a..e, task-w22-a..e ancestors of FROZEN SHA)

All ten commits confirmed ancestors of e3d558e via `git merge-base --is-ancestor <c> HEAD` (all returned success / exit 0):

wave-21:
- 58c13b9 task-w21-a: wave-21 gate build/test/tripwire/fresh-schema evidence @ c84d8ec (DEC-352) — ancestor OK
- 005e367 merge task-w21-b — ancestor OK
- 7570072 merge task-w21-c — ancestor OK
- 0d8c941 merge task-w21-a — ancestor OK
- 87b802c merge task-w21-e — ancestor OK

wave-22 (5 code facts, one per merged commit, file:line as of FROZEN SHA):
- cb32e0f merge task-w22-b — ancestor OK. Fact: `src/routes/files.ts:228` defines `export const ARCHIVE_MAX_TOTAL_BYTES = 40 * 1024 * 1024;` (DEC-353, 40MB total-byte archive budget).
- 530dd08 merge task-w22-d — ancestor OK. Fact: `src/server/repo/review/submissions.ts:124` defines `isSubmissionInReviewerScope(...)`, referenced from `src/server/repo/files-authz.ts`, `src/routes/review/recusals.ts`, `src/routes/review/reviewer.ts` (DEC-354 FK-hole close at write path + repo predicate).
- 32926e6 merge task-w22-c — ancestor OK. Fact: `src/server/repo/submissions/status.ts` contains the DEC-355 set-based bulk-acceptance planning logic (single-statement SELECT-based bulk update, no per-row loop).
- 1789274 DEC-356: CSV import looks up only the file's emails, not the whole org — ancestor OK. Fact: DEC-356 email-scoped chunked CSV import (2000-row cap) implemented in the contacts import path (`src/routes/api/contacts.ts` / `src/server/repo/contacts/push.ts`).
- 34d276d DEC-357: batch CSV-import roster-add (set-based push-to-event) — ancestor OK. Fact: `src/server/repo/contacts/push.ts` and `src/server/repo/tasks.ts` implement the DEC-357 chunked roster-add: one chunked contact load + one `updateSubmissionStatuses` call, `createSubmission` remains per-row (per DEC-357's own text).

All ten wave-21/wave-22 merges are ancestors of FROZEN SHA. No drift.

## Setup

- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w23-d` (branch `task-w23-d` from `main` @ e3d558e).
- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean install, no errors.
- `npx playwright install chromium` — chromium (Chrome Headless Shell 151.0.7922.34) already present at `/Users/wednesdayniemeyer/Library/Caches/ms-playwright/`; no download needed.
- `npm run build` — passed (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`), admin SPA bundle built to `public/admin/`.
- `rm -rf .wrangler/state` — cleared before every gate run so `scripts/render-sweep.ts` performs its own fresh migrate+seed (per task-w13-d/task-w15-e mechanics note: the script boots its own `wrangler dev` on a `findFreePort()`-chosen port and reads no `--port`/`--url`/env override; did not pre-seed or point it at a manually-booted server).
- `npm run gate:render-sweep` — run twice (first for full output capture, second after another `rm -rf .wrangler/state` purely to confirm a clean exit code independent of `tee` piping). Both runs identical results, exit code 0 both times.

## Pass 1 — full route sweep (persona login via real /login form, docs/fixtures/sample-data.json credentials)

```
render-sweep: logging in as organizer (sbek-organizer@example.com)...
render-sweep: logging in as reviewer (sbek-reviewer@example.com)...
render-sweep: logging in as speaker (sbek-speaker@example.com)...

path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                         organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   PASS
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                        speaker    PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    PASS
/e/devflow-conf-2027/sessions                                                   public     PASS
/e/devflow-conf-2027/speakers                                                   public     PASS
/e/devflow-conf-2027/gallery                                                    public     PASS
/e/devflow-conf-2027/agenda                                                     public     PASS
/e/devflow-conf-2027/schedule                                                   public     PASS
/submit/devflow-conf-2027                                                       public     PASS
/account/password                                                               organizer  PASS
/account/password                                                               reviewer   PASS
/account/password                                                               speaker    PASS
/admin/*                                                                        organizer  PASS

34/34 routes passed
```

All 34/34 `app/src/routeManifest.ts` entries: navigation status 200, non-empty rendered `#root` (admin SPA) / body (SSR routes), zero collected console `error` + `pageerror` events, no allowlist applied.

## Pass 2 — DEC-253 mobile sweep (390x844, MOBILE_ROUTE_MANIFEST)

```
render-sweep: mobile pass (390x844)...

path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             40  PASS
/e/devflow-conf-2027/sessions                                0             40  PASS
/e/devflow-conf-2027/speakers                                0             40  PASS
/e/devflow-conf-2027/agenda                                  0             40  PASS
/e/devflow-conf-2027/schedule                                0             40  PASS
/e/devflow-conf-2027/gallery                                 0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             40  PASS
/embed/devflow-conf-2027/sessions                            0             40  PASS
/embed/devflow-conf-2027/agenda                              0             40  PASS
/embed/devflow-conf-2027/speakers                            0             40  PASS
/login                                                       0             40  PASS
/portal                                                      0             40  PASS
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

15/15 mobile routes passed
```

Zero page-level horizontal overflow (`overflowPx` = 0 on every route), every primary nav/filter/submit control >= 40px tall on every route with controls. MOBILE_ROUTE_MANIFEST does not include admin SPA organizer/reviewer routes (public-surface + auth + portal + docs/mailbox only), so pass 2 does not directly mobile-check the rewritten admin pages — this is the manifest's existing scope, not a new gap introduced by this run.

## Exit code

`gate:render-sweep OK`, process exit code **0** (confirmed on both runs, second run isolated from `tee` to directly capture `$?`).

## Mapping of rewritten wave-19/20 pages to routeManifest.ts entries and whether the sweep exercised them

| Rewritten surface (wave-19/20 DEC) | routeManifest.ts entry actually visited | Exercised? |
|---|---|---|
| Submissions — DEC-340 J6 server-paged grid | `/admin/submissions` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. Sweep does NOT drive the grid's own pagination/filter/sort UI interactions (server-paging is only exercised at initial page-load's default query), so paging edge cases beyond first page are not covered by this gate. |
| Submissions — DEC-341 J8 SQL filter/sort/page (Speakers onboarding grid) | `/admin/speakers` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. Same caveat as above: only the default initial-load query is exercised; the sweep does not click filter/sort controls or page forward. |
| Content / FilesLibrary — DEC-344 server-paged files lib, `deliverableCounts` required envelope field | `/admin/content` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. `deliverableCounts` is consumed by `app/src/pages/content/ContentApp.tsx` / `SessionList.tsx`; since the route rendered with no console errors and no empty-root failure, the envelope's required field was present and consumed without throwing. |
| Review results — DEC-345 server-side ranked results, `resultsSort.ts` deleted | `/admin/review/plans/seed_evaluation_plan_0001/results` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. |
| Review progress — DEC-351 `listCompletedPairsForPlan` | `/admin/review/plans/seed_evaluation_plan_0001/progress` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. |
| Speakers onboarding grid (see above, DEC-341) | `/admin/speakers` | Yes (see row above). |
| Contacts — DEC-336 AND-tokens x OR-cols search | `/admin/contacts` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. Search-token UI interaction itself is not driven by the sweep (only the default no-query initial load is checked). |
| Comms compose — DEC-350 J5 picker (server-paged 50 + q, selection spans pages) | `/admin/comms` (organizer) | Yes — page navigated, `#root` non-empty, zero console errors. The J5 picker component (`app/src/pages/comms/ComposeWizard.tsx`) is mounted as part of this page's initial render; the sweep does not open the picker modal, type a query, or page through picker results, so cross-page-selection behavior specifically is not exercised by this gate — it is exercised by ComposeWizard's own render/unit tests, not this browser sweep. |

Bottom line: every rewritten admin route in scope loads cleanly in a real browser with a real login and zero console errors — this discharges the narrow claim "the SPA bundle boots and renders these pages after the server-paging rewrite," which is what DEC-359 flagged as unverified since w15. The render-sweep by design only checks navigation + initial render + console cleanliness; it does not click through pagination, filter, sort, or picker-modal interactions on any route (admin or otherwise) — that level of behavioral coverage lives in the app/src/pages/**/*.render.test.tsx and API-level tests, not in this gate.

## OPEN ITEMS: 0

No console `error` or `pageerror` events were collected on any of the 34 desktop routes or 15 mobile routes across two independent gate runs (both fresh `.wrangler/state`, both `npm run gate:render-sweep`). No horizontal overflow, no undersized controls. Nothing to record as an open item under DEC-360 (this lane owns only this file and does not fix code).

## RESULT: PASS

34/34 desktop routes PASS, 15/15 mobile routes PASS, 0 console errors, exit code 0, confirmed twice.

## RECHECK SHA
e3d558ea5628cbe1a7260489c2c5ddc1d487c7db (unchanged — no product-code commits were made in this worktree; branch tip after this log's own commit will add exactly one docs-only commit on top of this SHA).

## POST-S DELTA
None. This is a LOG-ONLY lane (DEC-360): no product code, no schema, no `src/decisions.ts`, no other docs/verification-log files were created or modified — only this file. `git status` in the worktree shows a single new file at `docs/verification-log/task-w23-d-c3-render-sweep.md`; the built `public/admin/*` bundle artifacts produced by `npm run build` / the gate's own build step are untracked build output, not committed.
