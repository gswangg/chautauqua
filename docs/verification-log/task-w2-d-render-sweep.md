# task-w2-d - render-sweep @ e002bc9

FROZEN SHA: e002bc9982c31f2e681435036c7f41e33dd6a51e

## Freeze derivation (DEC-256)

- All `task-w1-*` refs confirmed ancestors of `main` after a short wait
  (task-w1-e and task-w1-g merged mid-poll; task-w1-f already merged).
- `S` = newest first-parent commit of `main` that touches anything outside
  `{decisions/, field-guide/, docs/verification-log/, docs/eval-findings.md,
  src/decisions.ts appends}`.
- Walked `git log --first-parent main`: `e002bc9` ("merge task-w1-e") is the
  newest first-parent commit; `git diff e002bc9^1 e002bc9 --name-only` shows
  it touches `app/src/pages/content/VersionList.render.test.tsx`,
  `app/src/pages/content/VersionList.tsx`,
  `app/src/pages/content/version-chain.test.ts`,
  `app/src/pages/content/version-chain.ts` (product code, outside the
  excluded set) plus its own verification-log entry — so `S = e002bc9`.
- End-of-lane re-derivation (below) confirms no drift.

Worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w2-d`
created from `main` at `e002bc9982c31f2e681435036c7f41e33dd6a51e` — byte-identical to S
(`git rev-parse HEAD` == S, `git status --short` clean).

## DEC-253 mobile-pass presence check (read code, not prose)

Grepped `scripts/render-sweep.ts` at S directly (not the field guide's
description of it):

- `MOBILE_VIEWPORT = { width: 390, height: 844 }` (line 226) — present.
- `document.scrollingElement ? document.scrollingElement.scrollWidth : ...`
  measured against `window.innerWidth` inside `page.evaluate` (lines
  244-253) and compared in `evaluateMobileRoute`
  (`scripts/render-sweep-lib.ts` — `overflowPx = observed.scrollWidth -
  observed.viewportWidth`, PASS iff `overflowPx <= 1`, i.e. the
  `scrollWidth <= innerWidth + 1px` slack rule) — present.
- `MOBILE_CONTROL_SELECTOR` also asserts every primary
  nav/filter/submit control measures >= 40px tall (tap-target size) —
  present, in addition to the pure-overflow check the task named.
- The literal strings `overflow-x` and `minmax(140px, 1fr)` named in the
  task are NOT in `scripts/render-sweep.ts` itself — they're in the
  product code the gate exercises: `src/routes/public/shell.tsx:95`
  (`.chq-agenda-day-scroll { overflow-x: auto; ... }`, the agenda-grid's
  own horizontally-scrolling container) and `src/routes/public/agenda.tsx:42`
  / `app/src/pages/agenda/DayGrid.tsx:58`
  (`grid-template-columns: ... minmax(140px, 1fr)`, the per-room grid
  columns). The render-sweep gate proves these render without page-level
  overflow at 390px by measuring `document.scrollingElement.scrollWidth`
  on `/e/:slug/agenda` and `/embed/:slug/agenda` — it does not grep those
  CSS literals itself, it exercises them in a real browser.
- `MOBILE_ROUTE_MANIFEST` (lines 66-80) covers exactly the surfaces named
  in the task: `/submit/:slug`, all five `/e/:slug` surfaces (sessions,
  speakers, agenda, schedule, gallery), the session detail
  (`/e/:slug/sessions/:id`) and speaker detail (`/e/:slug/speakers/:id`)
  pages, `/embed/:slug/sessions`, `/embed/:slug/agenda`,
  `/embed/:slug/speakers`, `/login`, and `/portal`.

Conclusion: the DEC-253 mobile pass IS present in the gate at S, and the
run below confirms both passes execute.

## Section D result

Ran, in the byte-identical worktree at S:

1. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent)`
   — node_modules already present, skipped.
2. `npx playwright install chromium` — chromium already installed
   (`chromium-1187` etc. present under `~/Library/Caches/ms-playwright`), no-op.
3. `npm run build` — passed clean (`tsc --noEmit` x2 + `vite build`, 0 errors).
4. `npm run gate:render-sweep` — booted its own migrated + seeded
   `wrangler dev` on a free port (53242), ran both passes. Full output:

### Pass 1 — desktop/full route sweep

```
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
/admin/review/plans/new                                                        organizer  PASS
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

### Pass 2 — DEC-253 mobile pass (390x844)

```
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

13/13 mobile routes passed
gate:render-sweep OK
```

Every mobile route measured `overflowPx = 0` (scrollWidth == innerWidth,
i.e. `scrollWidth <= innerWidth + 1`) and `minControlPx = 40` (the minimum
tap-target height across primary nav/filter/submit controls) — no
horizontal overflow anywhere, including the two agenda surfaces
(`/e/devflow-conf-2027/agenda`, `/embed/devflow-conf-2027/agenda`) whose
grid uses `minmax(140px, 1fr)` columns inside the `overflow-x: auto`
`.chq-agenda-day-scroll` container.

No console error, pageerror, non-200, empty render, or horizontal overflow
was observed on any route in either pass.

## End-of-lane freeze re-derivation

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua fetch --all -q && git rev-parse main`
== `e002bc9982c31f2e681435036c7f41e33dd6a51e` — unchanged from the S derived
at the start of this lane. No drift.

## OPEN ITEMS: 0

## RESULT: PASS — 34/34 desktop routes + 13/13 DEC-253 mobile routes green at S = e002bc9982c31f2e681435036c7f41e33dd6a51e. Build clean. No drift.
