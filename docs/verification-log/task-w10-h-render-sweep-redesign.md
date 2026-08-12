# task-w10-h: render-sweep gate re-run (DEC-419, LOG-ONLY)

Gate lane checking wave 9's claim that DEC-411's raw-string `addInitScript`
`__name` shim fixed the 35-row `ReferenceError: __name is not defined`
instrument failure recorded in
`docs/verification-log/task-w7-e-render-sweep-redesign.md`, and that
`MOBILE_ROUTE_MANIFEST` now covers all six `/portal` speaker-portal routes.

**Frozen SHA:** `a0eb04378fdd406910191d288faaa4174ebdbf38` (branch
`task-w10-h`, cut from `main`, `git rev-parse HEAD` at worktree creation).

## STEP ZERO: instrument findings (read before running anything)

Read `scripts/render-sweep.ts` and `scripts/render-sweep-lib.ts` at the
frozen SHA above.

**(a) `addInitScript` shim installed before every `page.evaluate`?** Yes.

- `scripts/render-sweep-lib.ts:262-263` defines
  `PAGE_EVALUATE_KEEPNAMES_SHIM = "globalThis.__name = globalThis.__name ||
  function (fn) { return fn; };"` as a raw string (never passed through
  esbuild, so it can't be rewritten into a broken `__name(fn, "shim")` call
  itself — see the DEC-411 comment at lines 249-261).
- `scripts/render-sweep.ts:232` — inside `visitRoute`, `await
  page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });` runs
  immediately after `page.newPage()` (line 230) and before the `page.goto`
  at line 244 / any `page.evaluate` call for that page.
- `scripts/render-sweep.ts:279` — inside `visitMobileRoute`, the same
  `addInitScript` call runs immediately after `page.newPage()` (line 277)
  and before `page.goto` (line 282) and the `page.evaluate` measurement
  block (line 288-328).
- Both call sites are the only two places in `render-sweep.ts` that open a
  new `Page` before evaluating in-page JS, so the shim precedes every
  `page.evaluate` in this script.

**(b) `MOBILE_ROUTE_MANIFEST` size and `/portal` route coverage:**

`scripts/render-sweep.ts:71-96` — `MOBILE_ROUTE_MANIFEST` contains **21
entries**. All six `/portal` speaker-portal routes are present (lines
84, 88-92):

1. `/portal` (line 84)
2. `/portal/submissions/${MOBILE_SESSION_ID}` (line 88)
3. `/portal/submissions/${MOBILE_SESSION_ID}/edit` (line 89)
4. `/portal/profile` (line 90)
5. `/portal/tasks` (line 91)
6. `/portal/tasks/${MOBILE_TASK_ASSIGNMENT_ID}/form` (line 92)

The comment at lines 85-87 confirms this is DEC-411's intentional widening
from the single `/portal` route to the whole phone product.

Conclusion: the shim is present and correctly sequenced at both call
sites, and the manifest does cover all six `/portal` routes. Mobile rows
below are transcribed as real measurements, not labeled
INSTRUMENT-BLOCKED.

## Commands run (detached worktree, cut from `main`)

```
git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua worktree add \
  /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w10-h -b task-w10-h main
# HEAD is now at a0eb043 merge task-w8-i
git -C .../chautauqua-wt/task-w10-h rev-parse HEAD
# a0eb04378fdd406910191d288faaa4174ebdbf38  -- exit 0

cd .../chautauqua-wt/task-w10-h && npm ci --prefer-offline --no-audit --no-fund --silent
# exit 0

npx playwright install chromium
# exit 0

npm run gate:render-sweep
# exit 0 (process printed "gate:render-sweep OK" and exited 0)
```

All three commands exited 0. `npm run gate:render-sweep` self-booted a
migrated + seeded `wrangler dev` on a free local port as designed (built
the admin SPA bundle, applied D1 migrations, ran `scripts/seed.ts` +
`.seed.sql` + `scripts/seed-r2.ts`, then started `wrangler dev`).

## Table 1: desktop sweep (per-route role and PASS/FAIL)

```
path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                        organizer  PASS
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
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
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
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     PASS
/embed/devflow-conf-2027/sessions                                               public     PASS
/embed/devflow-conf-2027/agenda                                                 public     PASS
/embed/devflow-conf-2027/speakers                                               public     PASS
/login                                                                          public     PASS
/docs/api                                                                       public     PASS
/dev/mailbox                                                                    public     PASS

42/42 routes passed
```

## Table 2: 390px public/portal mobile pass

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             44  PASS
/e/devflow-conf-2027/sessions                                0             44  PASS
/e/devflow-conf-2027/speakers                                0             44  PASS
/e/devflow-conf-2027/agenda                                  0             44  PASS
/e/devflow-conf-2027/schedule                                0             44  PASS
/e/devflow-conf-2027/gallery                                 0             44  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             44  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             44  PASS
/embed/devflow-conf-2027/sessions                            0             44  PASS
/embed/devflow-conf-2027/agenda                              0             44  PASS
/embed/devflow-conf-2027/speakers                            0             44  PASS
/login                                                       0             48  PASS
/portal                                                      0             44  PASS
/portal/submissions/seed_submission_0001                     0             44  PASS
/portal/submissions/seed_submission_0001/edit                0             44  PASS
/portal/profile                                              0             44  PASS
/portal/tasks                                                0             44  PASS
/portal/tasks/seed_task_assignment_0001/form                 0             44  PASS
/account/password                                            0             48  PASS
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

21/21 mobile routes passed
```

No named overflow offenders in this table: every row is `overflowPx=0`
(within the 1px slack), so `scripts/render-sweep-lib.ts`'s
`evaluateMobileRoute` never populated a `failureReason` with offender text
for this pass; `minControlSelector` is likewise irrelevant here since
`minControlPx` never drops below 44 (`docs/api` and `dev/mailbox` have no
matched primary controls at all, hence `-`).

## Table 3: 390px admin advisory pass

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                         46             44  FAIL  (horizontal overflow 46px (scrollWidth 390 > viewport 390) — widest: a.chq-overview-deadline-cell w=111px right=436px | span.chq-overview-deadline-label w=82px right=422px | span.chq-overview-deadline-value w=82px right=422px)
/admin/submissions                                                                     117             44  FAIL  (horizontal overflow 117px (scrollWidth 390 > viewport 390) — widest: button.chq-pill w=76px right=507px | button.chq-pill w=80px right=423px)
/admin/submissions/forms                                                                38             44  FAIL  (horizontal overflow 38px (scrollWidth 390 > viewport 390) — widest: button.chq-pill w=151px right=428px)
/admin/submissions/seed_submission_0001                                                  0             44  PASS
/admin/speakers                                                                          0             44  PASS
/admin/content                                                                           2             44  FAIL  (horizontal overflow 2px (scrollWidth 390 > viewport 390) — widest: button.chq-pill w=82px right=392px)
/admin/agenda                                                                          152             44  FAIL  (horizontal overflow 152px (scrollWidth 390 > viewport 390) — widest: span.chq-agenda-clash-note w=221px right=542px | button.chq-pill.chq-phone-room-chip w=55px right=540px | button.chq-pill.chq-phone-room-chip w=113px right=478px)
/admin/comms                                                                             0             44  PASS
/admin/contacts                                                                          0             44  PASS
/admin/settings                                                                          0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/new                                                                  0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                                   0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                                   25             44  FAIL  (horizontal overflow 25px (scrollWidth 415 > viewport 390))
/admin/review                                                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           0             44  PASS
/account/password                                                                        0             44  PASS
/account/password                                                                        0             44  PASS

14/20 mobile routes passed
```

Process finished with `console.log("gate:render-sweep OK")` printed and
**exit code 0** (the admin advisory pass's 6 FAILs did not flip the
process exit code, per `ADMIN_MOBILE_PASS_BLOCKING`).

## Three questions

**(1) Does the admin advisory pass read all-PASS — is DEC-387's flip
condition met?**

No. `14/20 mobile routes passed` — six FAILs (`/admin/overview`,
`/admin/submissions`, `/admin/submissions/forms`, `/admin/content`,
`/admin/agenda`, `/admin/review/plans/seed_evaluation_plan_0001/results`).
DEC-387's flip rule ("it becomes true in the wave after the pass first
reads all-PASS") is not satisfied by this run.
`ADMIN_MOBILE_PASS_BLOCKING` at `scripts/render-sweep-lib.ts:247` was
**not** modified — report only, per instructions.

**(2) Are the two long-standing DEC-414 offenders still present, and at
what numbers now?**

Reference numbers (per `docs/verification-log/task-w8-g-render-sweep.md`,
citing `task-w6-f` / `cee627c`): `/admin/comms` `.chq-step` ~131px
(`app/src/pages/comms/ComposeWizard.tsx:248`), `/admin/submissions`
`.chq-submissions-filterbar` ~40px
(`app/src/pages/submissions/FilterBar.tsx:17`).

This run:

- `/admin/comms` is now `overflowPx=0`, **PASS**. The `.chq-step` offender
  is gone from this measurement — DEC-414's first offender no longer
  reproduces.
- `/admin/submissions` is now `overflowPx=117` (up from ~40px), still
  **FAIL**, but the top-3 named offenders in this run are
  `button.chq-pill w=76px right=507px` and `button.chq-pill w=80px
  right=423px` — `.chq-submissions-filterbar` is not among the top-3
  widest offenders reported (the evaluator only records the three widest
  elements by `rect.right`, `scripts/render-sweep.ts:311-313`). Whether
  the filterbar itself still overflows at a smaller magnitude cannot be
  confirmed or denied from this run's output; what is confirmed is the
  route still overflows at 390px, now more severely (117px vs. the
  previously recorded ~40px), and the currently-widest offenders are a
  pair of `.chq-pill` filter/status buttons, not the filterbar element
  named in DEC-414.

**(3) Does any control measure under the DEC-393 44px tap floor, and
where?**

No. Every row across all three PASS/FAIL tables that reports a
`minControlPx` value reports either `44`, `48`, or `-` (no matched
control on that route). No row's failure reason mentions "control
height" — every FAIL in Table 3 is a horizontal-overflow failure only.
Grep of the full run log for `"control height"` returns zero matches.
No control anywhere in this run falls under the 44px tap floor.

## RESULT: PASS

The gate lane itself (instrument check + full sweep run) completed
successfully: the DEC-411 shim is confirmed present and correctly
sequenced, the manifest confirmed to cover all six `/portal` routes, the
blocking desktop (42/42) and public/portal mobile (21/21) passes are
all-PASS, and the process exited 0. The admin advisory pass (14/20) does
not block per DEC-387 and is reported, not remediated, per this lane's
LOG-ONLY scope.

## OPEN ITEMS: 6

All six are admin-advisory FAILs at 390px (DEC-387 advisory, not
blocking; DEC-414 already documents two of these routes as known
offenders — the rest are newly measured under DEC-411's now-working
manifest and are not yet settled by any decision).

1. Route `/admin/overview` — offender `a.chq-overview-deadline-cell` (also
   `span.chq-overview-deadline-label`, `span.chq-overview-deadline-value`)
   — measured overflow 46px — not settled by an existing decision.
2. Route `/admin/submissions` — offender `button.chq-pill` (two instances,
   w=76px/w=80px) — measured overflow 117px — DEC-414 names this route's
   overflow (previously ~40px, attributed to
   `.chq-submissions-filterbar`) as a known open item, but the offender
   and magnitude reported here differ from DEC-414's description; not
   fully settled.
3. Route `/admin/submissions/forms` — offender `button.chq-pill` (w=151px)
   — measured overflow 38px — not settled by an existing decision.
4. Route `/admin/content` — offender `button.chq-pill` (w=82px) —
   measured overflow 2px — not settled by an existing decision.
5. Route `/admin/agenda` — offender `span.chq-agenda-clash-note` (also
   `button.chq-pill.chq-phone-room-chip` x2) — measured overflow 152px —
   not settled by an existing decision.
6. Route `/admin/review/plans/seed_evaluation_plan_0001/results` — no
   named offender (top-3 list empty; overflow computed from
   `scrollWidth 415 > viewport 390`) — measured overflow 25px — not
   settled by an existing decision.

`/admin/comms` (DEC-414's other named offender) is no longer an open
item: it measured `overflowPx=0`, PASS, in this run.

## RECHECK SHA

`a0eb04378fdd406910191d288faaa4174ebdbf38` (unchanged — no product code,
tests, or scripts were touched by this lane; the worktree's HEAD before
this report commit).

## POST-S DELTA

`git -C .../chautauqua-wt/task-w10-h status --porcelain` before the
commit for this report:

```
?? docs/verification-log/task-w10-h-render-sweep-redesign.md
```

This one new file is the entire diff for this branch.
