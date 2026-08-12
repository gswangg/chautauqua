# task-w6-f — render-sweep gate (DEC-384/387/389/393), LOG-ONLY

Gate lane. Owns exactly this one file (DEC-384) — no product code, tests,
scripts, or config touched by this task; the only diff on this branch is
this file.

## SHA measured

`git rev-parse main` = **`cee627c5b33649206747206abd794e41a9e27665`**
(`merge task-w6-e`).

### Note on how this SHA was reached (a re-run, matching the w4-j precedent)

The worktree was first cut from `main` at `22f9a5c54d16975241ec259a10d3ffd41499b014`
(`scribe wave 6`). `npm ci`, `npm run build` (154 modules, exit 0), and
`npm test` (246 files / 2068 tests, exit 0) were run once successfully
against that SHA. Before `npm run gate:render-sweep` started, a
`git -C .../chautauqua rev-parse main` check (done as routine hygiene before
launching the browser sweep) showed `main` had already moved to
`2553346d4a86a51207d784742e8469f72545d808` — one merge ahead
(`merge task-w6-a`) — and a `git log` on that commit showed it touched
`App.tsx`, `app/src/lib/useNavExceptions.ts`, `app/src/styles.css`, and
`app/src/components/event-switcher.css`. Those are exactly the files this
task's own instructions asked about (the universal 11px admin overflow and
the 21px `header nav a` control height), so re-cutting the worktree against
the newer SHA — rather than reporting stale pre-`task-w6-a` numbers — was
the right call, not just hygiene (same judgment call the w4-j log made).

The `task-w6-f` worktree/branch were deleted and recreated from `main`'s new
tip. By the time of recreation `main` had advanced further, to
`cee627c5b33649206747206abd794e41a9e27665` (`merge task-w6-e`, three more
merges past `task-w6-a`: `task-w6-c`, `task-w6-d`, `task-w6-e`). `npm ci`,
`npm run build` (exit 0), and `npm test` (**251 files / 2092 tests, exit
0**) were re-run in full against this SHA, then `npm run gate:render-sweep`
was run once, producing the numbers recorded below.

`main` was checked once more immediately after `gate:render-sweep` finished
and had moved again, to `61ef8c9c9c2a043a3fe3aa71a39e07747f046e42` — but
this drift happened *during* (not before) the gate run, against the
already-frozen, isolated `task-w6-f` worktree checkout, so it did not affect
anything measured below (unlike the `task-w6-a` case, no code relevant to
this task's own file tree changed on that worktree — the worktree itself was
never reclaimed, unlike w4-j's custodian-pruning incident). No further
re-run was done; `cee627c` is the SHA this entire report describes.

## Commands run, in order, with exit codes

1. `git -C .../chautauqua worktree add .../task-w6-f -b task-w6-f main` (run
   twice, see above) — exit 0 both times.
2. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund)` —
   "added 366 packages" both times, exit 0.
3. `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
   vite build --config app/vite.config.ts`) — **PASS**, exit 0 (only the two
   expected "didn't resolve at build time" font-asset notices, no errors).
4. `npm test` (vitest run) — **251 test files / 2092 tests, all PASS**, exit
   0.
5. `npx playwright install chromium` — chromium already present in the local
   Playwright cache, no download, exit 0.
6. `npm run gate:render-sweep` (`tsx scripts/render-sweep.ts`) — self-boots
   its own migrated+seeded `wrangler dev` on a free port (port `60340` this
   run), logs in as organizer/reviewer/speaker via the real `/login` form,
   then runs the three passes below. **Exit 1** (the desktop sweep's one
   failure drives the overall gate exit non-zero; the admin mobile pass is
   advisory per DEC-387 and does not itself gate the exit code —
   `ADMIN_MOBILE_PASS_BLOCKING` confirmed still `false` at
   `scripts/render-sweep-lib.ts:215`).

## Desktop sweep — PASS/FAIL table (`gate:render-sweep`, `cee627c`)

```
path                                                                            role       status
/admin/overview                                                                 organizer  FAIL  (empty rendered text; 1 console error(s): TypeError: Cannot read properties of undefined (reading 'length'); 1 pageerror(s))
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                       organizer  PASS
/admin/submissions/seed_submission_0001                                        organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                        organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                  organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                  reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   PASS
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                       speaker    PASS
/portal/submissions/seed_submission_0001/edit                                  speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                   speaker    PASS
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

33/34 routes passed
```

Every route printed a row — no "never measured" gaps in this table, and no
persona login failed (organizer, reviewer, and speaker all logged in
successfully via `/login`, confirmed by the "logging in as ..." lines in the
sweep's own log preceding the table and by every non-`/admin/overview` row
resolving to a real PASS/FAIL rather than a login-error placeholder).

Reviewer's three `/admin/review*` rows all flipped FAIL→PASS since the
w4-j/w5-i readings (previously 403-console-error FAILs from
`useNavExceptions` polling an organizer-only endpoint unconditionally) —
consistent with `task-w6-a`'s diff gating that hook to
`role === 'organizer'` (`app/src/lib/useNavExceptions.ts`, per the field
guide's own w6 entry, DEC-395).

## 390px mobile pass — PASS/FAIL table (DEC-253, public/portal, `gate:render-sweep`)

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
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

15/15 mobile routes passed
```

Every listed route measured and PASSed; none "never measured." (Note this
pass's `minControlPx` floor reads 44px across the board this run, up from
40px in the w4-j/w5-i readings — consistent with `task-w6-a`'s
`.chq-nav a`/portal control-height changes, though this task's scope is
LOG-ONLY and does not attribute cause beyond what the diff stat already
shows.)

## 390px admin mobile pass — advisory (DEC-387), organizer + reviewer

Control selector per DEC-387: `.chq-tabbar a`, `.chq-tabbar button`,
`.chq-btn`, `.chq-input`, `.chq-select`, `header nav a` (visible only).

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                          0              -  PASS
/admin/submissions                                                                      40             44  FAIL  (horizontal overflow 40px; scrollWidth 430 > viewport 390)
/admin/submissions/forms                                                                 0             44  PASS
/admin/submissions/seed_submission_0001                                                  0             44  PASS
/admin/speakers                                                                          0             44  PASS
/admin/content                                                                           0             44  PASS
/admin/agenda                                                                            0             44  PASS
/admin/comms                                                                           131             44  FAIL  (horizontal overflow 131px; scrollWidth 521 > viewport 390)
/admin/contacts                                                                          0             44  PASS
/admin/settings                                                                          0             44  PASS
/admin/review (organizer)                                                                0             44  PASS
/admin/review/plans/new (organizer)                                                      0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001 (organizer)                                0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress (organizer)                       0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/results (organizer)                        0             44  PASS
/admin/review (reviewer)                                                                 0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001 (reviewer)                                 0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 (reviewer) 0            44  PASS
/account/password (organizer)                                                            0             44  PASS
/account/password (reviewer)                                                             0             44  PASS

18/20 mobile routes passed  (advisory only — ADMIN_MOBILE_PASS_BLOCKING=false at scripts/render-sweep-lib.ts:215, does not gate exit code)
```

Every route was measured and appears above (no "never measured" rows). No
persona login failed for this pass either.

## The two readings the next planner specifically needs

**1. Are the universal 11px admin overflow and the 21px `header nav a`
control height gone (task w6-a)?**

**Mostly yes, both are gone as a *universal* problem.** Comparing this run
against the last full reading (`task-w4-j`/`task-w5-i`, both showing a
uniform 11px overflow + 21px control height on 13-17 of 20 admin-mobile
routes): every admin-mobile route this run measures `minControlPx = 44`
(up from the uniform 21px), and 18 of 20 routes now measure `overflowPx =
0` (up from a uniform 11px baseline plus a handful of larger outliers). The
`21px control height` symptom is fully gone across all 20 rows measured.
The `11px overflow` symptom is gone as a *universal* baseline (16 of the 18
routes that used to show it now show `0`), but overflow is **not** gone
entirely — two routes still fail on horizontal overflow, at different
(larger, pre-existing) magnitudes than the old uniform 11px: `/admin/comms`
at 131px and `/admin/submissions` at 40px (see next section — both of these
were already the two worst outliers in the w4-j/w5-i readings, unchanged in
magnitude, so `task-w6-a`'s fix did not touch these two routes' own
overflow sources).

**2. Does the DEC-387 admin mobile pass now read all-PASS (the flip trigger
for `ADMIN_MOBILE_PASS_BLOCKING`)?**

**No — 18/20, two FAILs remain** (`/admin/submissions`, `/admin/comms`,
both horizontal-overflow-only, both control-height clean). This is very
close to the DEC-387 flip condition but does not meet it. Per DEC-387 this
LOG-ONLY lane does not flip `ADMIN_MOBILE_PASS_BLOCKING` regardless; it
remains `false` at `scripts/render-sweep-lib.ts:215`, unmodified by this
task.

## Re-measurement of the two admin overflows no lane owns yet

Both numbers match the last full reading (`task-w4-j`, at `be847cc`)
exactly, confirming no drift on these two specific routes between `be847cc`
and `cee627c`:

- **`/admin/comms` — 131px overflow** (`scrollWidth` 521 vs viewport 390,
  organizer). Using a throwaway, uncommitted Playwright script (session
  scratchpad, not part of this branch's diff — same one-off-inspection
  pattern the w4-j log used) run against a `wrangler dev` instance booted
  from this same worktree/SHA with the seeded D1/R2 state already in place
  from the gate run, the single widest element pushing the document past
  390px is the `.chq-step` stepper node from the Comms compose wizard:
  `app/src/pages/comms/ComposeWizard.tsx:248`
  (`<div className="chq-step...">`, rendered inside the `.chq-steps` row at
  `ComposeWizard.tsx:243`), styled by `app/src/pages/comms/comms.css`. Its
  right edge lands at document x=521 against a 390px viewport — exactly
  reproducing the sweep's 131px figure — after excluding elements inside
  any ancestor with `overflow-x: auto|scroll` (per the field guide's
  allowance for chip-strip/tab-bar internal scrolling, so as not to
  misattribute a legitimately-scrollable region as the overflow cause).

- **`/admin/submissions` — 40px overflow** (`scrollWidth` 430 vs viewport
  390, organizer). Same method, same widest-non-scroll-container-element
  approach: the widest element is the `.chq-submissions-filterbar` node,
  `app/src/pages/submissions/FilterBar.tsx:17`
  (`<div className="chq-submissions-filterbar">`), styled by
  `app/src/pages/submissions/submissions.css:84`. Its right edge lands at
  document x=430 against 390px — exactly reproducing the sweep's 40px
  figure.

Neither finding is this LOG-ONLY lane's to fix (DEC-384) — recorded as OPEN
ITEMS below for planner triage.

## RESULT: FAIL

The sweep ran to completion (server booted, migrations+seed applied,
chromium launched, every persona logged in, every route resolved and
appears in a table) — not a "sweep couldn't run" case. It is a narrow
substantive FAIL: 33/34 desktop routes pass (one real defect, below); public
mobile is clean 15/15; the admin mobile advisory pass (does not gate exit)
is 18/20.

## OPEN ITEMS: 3

1. **`src/server/repo/overview.ts:31,104,515-527` vs.
   `app/src/pages/Overview.tsx:51,238-239`** — unchanged since the
   `task-w5-i` reading: the server's `OverviewPayload` still sends the
   DEC-370 v1 aggregate `{pending, accept_queue, decline_queue}` under wire
   key `triage` (`overview.ts:31`, the object built at `overview.ts:615`
   still has `triage,` first and `triageQueue,` separately — never renamed
   to `'triage-counts'`/`triage` per the client type file's own comment),
   while the client (`app/src/pages/Overview.tsx:238`,
   `payload.triage.rows.length === 0`) expects `payload.triage` to be the
   v2 rows object. `payload.triage.rows` is `undefined` on the v1 shape, so
   `.length` throws, crashing every `/admin/*` organizer page load (the
   error is visible on every admin route because
   `app/src/lib/useNavExceptions.ts` polls this same overview endpoint from
   the shared top-nav shell — though as of `task-w6-a` that hook is now
   gated to `role === 'organizer'`, so it no longer 403s for reviewers, but
   the crash itself is a separate client/server field-name contract bug,
   unaffected by that fix). Confirmed present, unfixed, at `cee627c` by
   direct source read (not modified). Still not known to be owned by any
   already-assigned wave-6 lane as of this writing.

2. **`/admin/comms` (organizer) — 131px horizontal overflow at 390px**,
   caused by the Comms compose-wizard step indicator:
   `app/src/pages/comms/ComposeWizard.tsx:248` (`.chq-step`, inside
   `.chq-steps` at line 243), styled in `app/src/pages/comms/comms.css`.
   Advisory-only per DEC-387 (does not gate exit), but is one of the two
   remaining blockers to the DEC-387 all-PASS flip trigger. Unchanged in
   magnitude since `task-w4-j`'s first reading at `be847cc`.

3. **`/admin/submissions` (organizer) — 40px horizontal overflow at
   390px**, caused by the submissions filter bar:
   `app/src/pages/submissions/FilterBar.tsx:17`
   (`.chq-submissions-filterbar`), styled in
   `app/src/pages/submissions/submissions.css:84`. Advisory-only per
   DEC-387, the other of the two remaining blockers to the DEC-387
   all-PASS flip trigger. Unchanged in magnitude since `task-w4-j`'s first
   reading at `be847cc`.
