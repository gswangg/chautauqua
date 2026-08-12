# task-w7-e — render-sweep gate (DEC-401/DEC-387), LOG-ONLY

Gate lane. Owns exactly this one file (DEC-384) — no product code, tests,
scripts, or config touched by this task; the only diff on this branch is
this file.

## SHA measured

`git rev-parse HEAD` = **`d21d11eeb654e6089207ab620c8718d13f98d4df`**
(`merge task-w7-c`, the tip of `main` when this worktree/branch was first
cut, per the task's own ordering requirement that this task branch AFTER
`task-w7-b` has merged).

### Note on a worktree/branch recreation mid-task

`git worktree add .../task-w7-e -b task-w7-e main` was run first against
`main` at `d21d11e` and `npm ci` + `npm run build` + `npx playwright install
chromium` + `npm run gate:render-sweep` were run to completion against that
checkout, producing every table transcribed below. Partway through writing
up this report, a routine check of the worktree directory found it (and the
`task-w7-e` branch ref itself) had been removed from the shared repo by
something outside this task's own actions (`main` had also advanced, to
`97dbac0`, three merges past `d21d11e`, in the interim — `merge task-w7-a`
then `DEC-400` then `merge task-w7-c`... i.e. `main`'s tip moved but did not
rewrite `d21d11e`, which remains a real ancestor commit). The worktree/branch
were recreated from the exact same `d21d11e` SHA (not from the new `main`
tip) so this report continues to describe the one gate run that was actually
executed and transcribed below, rather than a second, un-run SHA. No command
in this task wrote to, merged into, or rebased `main`; only this task's own
worktree/branch were recreated, from the same frozen commit.

### Decisions present in this frozen SHA (per task instructions)

- **DEC-392 (phone chrome: tab bar alone, More sheet unconditional)** —
  present (wave 6, well before `d21d11e`).
- **DEC-393 (44px tap floor everywhere)** — present (wave 6).
- **DEC-401 (mobile pass reports clipped-element overflow + offenders +
  control selector)** — present: `git log --oneline` shows
  `6de9af6 DEC-401: mobile pass reports clipped-element overflow +
  offenders + control selector` as an ancestor of `d21d11e`, and
  `scripts/render-sweep.ts:273-313` (`visitMobileRoute`) contains the
  offender-descriptor/`minControlSelector` logic described by that commit.
- **DEC-403 (eight new desktop entries / no-login surfaces)** — present:
  `git log --oneline` shows `779ac4e routeManifest: add DEC-403 no-login
  surfaces the mobile pass visits` as an ancestor of `d21d11e`.
- **DEC-405 (removal of the SSR body clip)** — present: `git log --oneline`
  shows `093d9ee Stop clipping overflow, wrap long strings at phone width
  (DEC-404/DEC-405)` as an ancestor of `d21d11e`.

All five are present in the frozen SHA — this is the first render-sweep run
to combine all of them (wave 6 phone-chrome/44px-floor, DEC-401's honest
overflow measurement, DEC-403's expanded no-login desktop coverage, and
DEC-405's SSR-clip removal).

## Commands run, in order, with exit codes

1. `git -C .../chautauqua worktree add .../task-w7-e -b task-w7-e main` — exit
   0 (`main` resolved to `d21d11e` at the time).
2. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund
   --silent)` — "added 366 packages", exit 0.
3. `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
   vite build --config app/vite.config.ts`) — **PASS**, exit 0 (only the two
   expected "didn't resolve at build time" font-asset notices, no errors;
   154 modules transformed, built in 693ms).
4. `npx playwright install chromium` — completed with no output (chromium
   already present in the local Playwright cache), exit 0.
5. `npm run gate:render-sweep` (`tsx scripts/render-sweep.ts`) — self-boots
   its own migrated+seeded `wrangler dev` on a free port (port `61442` this
   run), logs in as organizer/reviewer/speaker via the real `/login` form,
   then runs the three passes transcribed below. **Exit 1**, echoed in the
   same shell statement as `EXIT_CODE=1`.

## Desktop sweep — PASS/FAIL table (`gate:render-sweep`, `d21d11e`, port 61442)

```
path                                                                            role       status
/admin/overview                                                                 organizer  FAIL  (empty rendered text; 1 console error(s): TypeError: Cannot read properties of undefined (reading 'length')
    at F (http://localhost:61442/admin/assets/Overview-BB4a4e-Z.js:1:6447)
    at ao (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:39:17072)
    at wo (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:3158)
    at rc (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:45095)
    at bs (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:39988)
    at Td (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:39916)
    at Ml (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:39769)
    at Io (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:36098)
    at Gs (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:41:35046)
    at Ee (http://localhost:61442/admin/assets/index-Cgb5O6rK.js:26:1602); 1 pageerror(s): Cannot read properties of undefined (reading 'length'))
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
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     PASS
/embed/devflow-conf-2027/sessions                                               public     PASS
/embed/devflow-conf-2027/agenda                                                 public     PASS
/embed/devflow-conf-2027/speakers                                               public     PASS
/login                                                                          public     PASS
/docs/api                                                                       public     PASS
/dev/mailbox                                                                    public     PASS

41/42 routes passed
```

DEC-403's eight new no-login desktop entries are visible in this table
(`/e/.../sessions/seed_submission_0001`, `/e/.../speakers/seed_contact_0001`,
the three `/embed/...` routes, `/login`, `/docs/api`, `/dev/mailbox`) — the
desktop manifest is now 42 routes (up from 34 in the last full reading,
`task-w6-f` at `cee627c`), all PASS except the pre-existing `/admin/overview`
organizer crash.

## 390px mobile pass — PASS/FAIL table (DEC-253/DEC-401, public/portal, `gate:render-sweep`)

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/sessions                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/speakers                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/agenda                                  0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/schedule                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/gallery                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/sessions/seed_submission_0001           0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/e/devflow-conf-2027/speakers/seed_contact_0001              0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/embed/devflow-conf-2027/sessions                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/embed/devflow-conf-2027/agenda                              0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/embed/devflow-conf-2027/speakers                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/login                                                       0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/portal                                                      0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/docs/api                                                    0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/dev/mailbox                                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))

0/15 mobile routes passed
```

## 390px admin mobile pass — advisory (DEC-387), organizer + reviewer

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/submissions                                                                       0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/submissions/forms                                                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/submissions/seed_submission_0001                                                  0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/speakers                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/content                                                                           0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/agenda                                                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/comms                                                                             0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/contacts                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/settings                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review                                                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review/plans/new                                                                  0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review/plans/seed_evaluation_plan_0001                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review/plans/seed_evaluation_plan_0001/progress                                   0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review/plans/seed_evaluation_plan_0001/results                                    0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review                                                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review/plans/seed_evaluation_plan_0001                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/account/password                                                                        0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))
/account/password                                                                        0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))

0/20 mobile routes passed  (advisory only — ADMIN_MOBILE_PASS_BLOCKING=false at scripts/render-sweep-lib.ts:247, does not gate exit code)
```

## Summary lines (verbatim, as printed by the sweep)

- `41/42 routes passed` (desktop)
- `0/15 mobile routes passed` (public/portal)
- `0/20 mobile routes passed` (admin, advisory)

## Reading these numbers honestly (per the task's own framing)

The task instructions anticipated that DEC-401's honest overflow
measurement might, for the first time, surface real non-zero
`overflowPx`/offender numbers on the public mobile pass rather than a clean
run — and said that would be information, not a regression. That is **not**
what happened here: every single mobile-pass row (both public/portal, 15/15,
and admin-advisory, 20/20) failed identically with `page.evaluate:
ReferenceError: __name is not defined`, before any overflow/control
measurement could run at all. This is a total instrumentation failure of the
DEC-401 diagnostic itself, not a report of real overflow numbers — see OPEN
ITEM 1 below.

## RESULT: FAIL

The sweep ran to completion (server booted, migrations+seed applied,
chromium launched, every persona logged in, every desktop route resolved
into a real PASS/FAIL row) — not a "sweep couldn't run" case for the desktop
pass. But both mobile passes (public and admin-advisory) produced zero
usable measurements; every one of their 35 rows is an instrumentation
`ReferenceError`, not a measured PASS or FAIL. Exit code: **1**.

## Does the admin mobile advisory pass read all-PASS (DEC-387's flip condition)?

**No.** 0/20 — and none of the 20 rows are even a real overflow/control-height
FAIL; every row is the `__name is not defined` instrumentation error above.
This is nowhere near the DEC-387 flip condition (`ADMIN_MOBILE_PASS_BLOCKING`
remains `false` at `scripts/render-sweep-lib.ts:247`, unmodified by this
LOG-ONLY task; report only, per the task's own instruction, never flip).

## OPEN ITEMS: 2

1. **`scripts/render-sweep.ts:273-313` (`visitMobileRoute`'s `page.evaluate`
   call, specifically the named `const describe = (el: Element): string =>
   {...}` closure at `scripts/render-sweep.ts:276-280`) — every mobile-pass
   row (35/35 across both mobile tables) fails with `ReferenceError: __name
   is not defined` inside the serialized page-context function, before any
   overflow or control measurement executes.** Not settled by any existing
   decision (this is not DEC-399's pubcache bump, DEC-391's dropped mock
   affordances, or stage-1-frozen function — it is a new instrumentation
   defect in the DEC-401 gate script itself, introduced or exposed on this
   branch). The signature matches a known `tsx`/esbuild behavior: when a
   file compiled by `tsx` (esbuild under the hood) contains named
   function-expression closures passed into `page.evaluate()`, esbuild can
   inject an `__name(fn, "fn")` helper-call wrapper around the named closure
   as part of its output; `Function.prototype.toString()` on the
   already-transformed closure then includes that `__name(...)` call
   literally in the source text Playwright serializes and sends into the
   isolated browser page context, where no `__name` helper exists — hence
   the crash on first invocation (`describe` is called inside the
   evaluate-context function at line 279 and line 308, and is exactly the
   only named nested closure inside the evaluated function body at lines
   273-313; the un-named top-level `desktop` sweep evaluate call elsewhere
   in this file has no equivalent nested named closure and is not affected,
   consistent with only the mobile pass — not the desktop pass — failing
   this run). This is a pre-existing risk of DEC-401's specific
   implementation choice (introducing the first named nested closure inside
   a `page.evaluate` body in this script) rather than of the sweep's
   architecture generally; it is this LOG-ONLY lane's job to report it, not
   fix it (DEC-384).

2. **`/admin/overview` (organizer) — desktop `FAIL`, empty rendered text +
   `TypeError: Cannot read properties of undefined (reading 'length')`.**
   Unchanged since the `task-w6-f` (`cee627c`) and earlier readings — same
   crash signature, same route, same role. Per the field guide (DEC-400),
   this is the known `OverviewPayload` wire-key mismatch between
   `src/server/repo/overview.ts` (v1 aggregate under key `triage`) and
   `app/src/pages/Overview.tsx` (expects DEC-370 v2 rows under `triage`) —
   already tracked by prior render-sweep logs (e.g. `task-w6-f` OPEN ITEM 1)
   and by DEC-400 itself; not re-diagnosed further here, only reconfirmed
   present and unfixed at `d21d11e` by this run's desktop table.

## RECHECK SHA

`d21d11eeb654e6089207ab620c8718d13f98d4df`

## POST-S DELTA

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w7-e status --porcelain
?? docs/verification-log/task-w7-e-render-sweep-redesign.md
```

Only this one log file appears in the diff, as required (DEC-384).
