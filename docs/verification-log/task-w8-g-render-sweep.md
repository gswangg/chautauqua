# task-w8-g — render-sweep gate (DEC-384/401/403/404/405), LOG-ONLY

Gate lane. Owns exactly this one file (DEC-384) — no product code, tests,
scripts, or config touched by this task.

## SHA measured

Worktree cut via `git -C .../chautauqua worktree add .../task-w8-g -b
task-w8-g main` at **`ee6ef3457e023941b2b4064435874a03d59a9595`** (`merge
task-w8-d`) — recorded via `git -C .../chautauqua rev-parse main` before the
worktree add.

### Note on a worktree/branch reclamation mid-task

After all commands above had already run to completion against `ee6ef34`
(including the full `gate:render-sweep` transcript below), a routine
`git status` check to prepare this commit found the `task-w8-g`
worktree/branch had been removed from the shared repo by something outside
this task's own actions (matching the precedent noted in `task-w6-f` and
`task-w7-e`'s own logs) — only this report file itself (already written to
disk) survived the directory's removal. The worktree/branch were pruned and
recreated from the exact same `ee6ef34` SHA (not a newer `main` tip), and
this file was restored into the fresh checkout, so this report continues to
describe the one gate run actually executed and transcribed below, not a
second, un-run SHA. No command in this task wrote to, merged into, or
rebased `main`.

### Drift check (per task instructions)

`git -C .../chautauqua rev-parse main` re-run after the sweep finished
returned **`8fff9f3f48ffc3ec2d9eb86d0337a0f58c18fe2f`** — nine merges ahead
of the SHA this worktree was cut from:

```
8fff9f3 merge task-w8-e
0539a57 merge task-w8-b
a0232a6 merge task-w8-f
ab2e235 Re-skin Comms compose steps 1-2 (DEC-406/DEC-402)
045379a merge task-w8-c
5d07b32 merge task-w8-a
d728096 Add designed focus ring to SSR surfaces (DEC-409)
19b461d Public CFP dates render in event timezone, not UTC (DEC-408)
c58e228 forms: re-skin FieldModal + Add-question button (DEC-406)
9f2c100 w8-a: give submission detail page DEC-406 control tiers
```

This worktree stayed pinned to `ee6ef34` throughout (isolated checkout, per
the workflow's own instruction to work only inside the worktree) — the drift
happened on the shared `main` concurrently with other wave-8 lanes landing,
not inside this task's own checkout. Everything below describes `ee6ef34`,
not `8fff9f3`. Notably `ab2e235` (Comms step re-skin, DEC-406/402) and the
DEC-406 FieldModal/submission-detail commits landed on `main` *after* this
sweep's checkout was cut, so the `/admin/comms` overflow number recorded
below (unmeasurable this run, see below) cannot be attributed to or against
that later commit either way.

## Commands run, in order, with exit codes

1. `git -C .../chautauqua worktree add .../task-w8-g -b task-w8-g main` —
   exit 0.
2. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund)` —
   "added 366 packages", exit 0.
3. `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
   vite build --config app/vite.config.ts`) — **PASS**, exit 0 (154 modules
   transformed, built in 11.2s; only the two expected font-asset
   "didn't resolve at build time" notices, no errors).
4. `npm test` (vitest run, via `--reporter=dot` after the default reporter
   exceeded a 2-minute harness timeout mid-run — same suite, different
   reporter only) — **254 test files / 2108 tests, all PASS**, exit 0.
5. `npx playwright install chromium` — chromium already present in the
   local Playwright cache, no download, exit 0.
6. `npm run gate:render-sweep` (`tsx scripts/render-sweep.ts`) — self-boots
   its own migrated+seeded `wrangler dev` on a free port (port `62700` this
   run), logs in as organizer/reviewer/speaker via the real `/login` form,
   then runs the three passes transcribed below. **Exit 1**.

## Desktop sweep — PASS/FAIL table (`gate:render-sweep`, `ee6ef34`, port 62700)

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

42/42 routes passed
```

**All eight DEC-403 no-login surfaces are present and PASS**: the two
public detail routes (`/e/devflow-conf-2027/sessions/seed_submission_0001`,
`/e/devflow-conf-2027/speakers/seed_contact_0001`), all three `/embed/*`
surfaces (`sessions`, `agenda`, `speakers`), `/login`, `/docs/api`, and
`/dev/mailbox` — every one of them appears in the table above and reads
`PASS`.

**`/admin/overview` now PASSES** — the DEC-400 wire-key fix has landed and
is in effect at `ee6ef34`. This is a change from the last two full readings
(`task-w6-f` at `cee627c` and `task-w7-e` at `d21d11e`), both of which
showed `/admin/overview` FAIL with `TypeError: Cannot read properties of
undefined (reading 'length')` (the DEC-370 v1/v2 `triage` wire-key mismatch
DEC-400 itself documents). This run is **42/42, no FAILs at all** on the
desktop sweep — the first clean full desktop reading in this log's history.

## 390px mobile pass — PASS/FAIL table (DEC-253/DEC-401, public/portal, `gate:render-sweep`)

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/sessions                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/speakers                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/agenda                                  0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/schedule                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/gallery                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/sessions/seed_submission_0001           0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/e/devflow-conf-2027/speakers/seed_contact_0001              0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/embed/devflow-conf-2027/sessions                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/embed/devflow-conf-2027/agenda                              0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/embed/devflow-conf-2027/speakers                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/login                                                       0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/portal                                                      0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/docs/api                                                    0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/dev/mailbox                                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)

0/15 mobile routes passed
```

Full error text (identical for all 15 rows, elided above to `(page.evaluate:
ReferenceError: __name is not defined)` for table width):

```
page.evaluate: ReferenceError: __name is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:27)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

**Is the previously-perfect 15/15 held or moved?** Neither, honestly: this
is **not a geometry regression** — no route produced a real `overflowPx`
measurement (0/15 above is not 15 zero-overflow passes; every row is `0`
only because the observation object's `overflowPx` field was never
populated before the `page.evaluate` call threw, and `evaluateMobileRoute`
still had to synthesize a result). Zero of the 15 routes had their DEC-404
wrap rule or DEC-405 clip-removal actually exercised by a real
`document.scrollingElement.scrollWidth` / `maxElementRight` read this run —
the pre-existing DEC-401 instrumentation bug (see below) crashes before any
such measurement executes, for every single mobile route, both this run and
in the immediately-prior `task-w7-e` reading at `d21d11e` (also 0/15,
identical error). This log cannot report whether DEC-404/DEC-405 actually
changed the public mobile numbers, because the instrument itself has never
produced a real number since DEC-401 landed.

## 390px admin mobile pass — advisory (DEC-387), organizer + reviewer

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/submissions                                                                       0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/submissions/forms                                                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/submissions/seed_submission_0001                                                  0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/speakers                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/content                                                                           0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/agenda                                                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/comms                                                                             0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/contacts                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/settings                                                                          0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review (organizer)                                                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review/plans/new (organizer)                                                      0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review/plans/seed_evaluation_plan_0001 (organizer)                                0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review/plans/seed_evaluation_plan_0001/progress (organizer)                       0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review/plans/seed_evaluation_plan_0001/results (organizer)                        0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review (reviewer)                                                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review/plans/seed_evaluation_plan_0001 (reviewer)                                 0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 (reviewer) 0             -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/account/password (organizer)                                                            0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)
/account/password (reviewer)                                                             0              -  FAIL  (page.evaluate: ReferenceError: __name is not defined)

0/20 mobile routes passed  (advisory only — ADMIN_MOBILE_PASS_BLOCKING=false
at scripts/render-sweep-lib.ts:215, does not gate exit code)
```

Same identical `ReferenceError: __name is not defined` on all 20 rows, same
stack trace as the public pass. Not a single admin-mobile route produced a
real overflow or control-height measurement this run.

## RESULT: FAIL

The sweep ran to completion end-to-end (server booted, migrations+seed
applied, chromium launched, all three personas logged in, every desktop
route resolved to a real measured PASS/FAIL) — the desktop pass itself is a
genuine, clean **42/42 PASS**. But both mobile passes (35 rows total) never
produced a single real geometry measurement; every row is an instrumentation
crash, not a measured PASS or FAIL. Overall gate exit code: **1** (driven
entirely by the mobile-pass instrumentation failure, not by any desktop
route or any real overflow/control-height reading).

## The two readings the next planner specifically needs

**1. Did `/admin/overview` pass the desktop sweep after DEC-400's wire-key
fix?** **Yes.** `/admin/overview` reads `PASS` in the desktop table above —
a change from both `task-w6-f` (`cee627c`, FAIL) and `task-w7-e` (`d21d11e`,
FAIL, same `TypeError: Cannot read properties of undefined (reading
'length')` crash both times). DEC-400's fix is in effect and confirmed
working at `ee6ef34`.

**2. Did the two long-standing admin overflows (`/admin/comms` 131px,
`/admin/submissions` 40px in the `task-w6-f` log) move, and what does
DEC-401 now name as the widest element on each?** **Cannot be determined
this run — no measurement was possible.** Both routes appear in this run's
admin-mobile table only as `page.evaluate: ReferenceError: __name is not
defined` rows; DEC-401's offender/`minControlSelector` diagnostics never ran
for either route (or for any of the other 33 mobile-pass rows), because the
instrumentation itself crashes before computing `overflowOffenders` or
`minControlSelector` (see `scripts/render-sweep.ts:273-311`,
`evaluateMobileRoute`'s `page.evaluate` callback). This exact same
non-measurement was already reported once before, in `task-w7-e` at
`d21d11e` (also 0/15 and 0/20, identical error) — this is the **second**
consecutive render-sweep run in which the mobile-pass instrument itself is
broken, not the layout. The last time real numbers existed for these two
routes was `task-w6-f` (`cee627c`): `/admin/comms` 131px
(`.chq-step`, `app/src/pages/comms/ComposeWizard.tsx:248`) and
`/admin/submissions` 40px (`.chq-submissions-filterbar`,
`app/src/pages/submissions/FilterBar.tsx:17`) — those numbers are stale
(two full waves old) and cannot be confirmed or refuted by this run.

## OPEN ITEMS: 2

1. **`scripts/render-sweep.ts:273-311` (`evaluateMobileRoute`'s
   `page.evaluate` call, specifically the named `const describe = (el:
   Element): string => {...}` closure at lines 274-278) — every mobile-pass
   row, both public/portal (15/15) and admin-advisory (20/20), 35 rows
   total, fails identically with `ReferenceError: __name is not defined`
   inside the serialized page-context function, before any overflow or
   control-height measurement executes.** Not new to this run — first
   reported in `task-w7-e` at `d21d11e` (also 0/15 + 0/20, byte-identical
   error text and stack), and unchanged since: still present, still total
   (100% of mobile rows, both runs), still unfixed at `ee6ef34`. This is a
   `tsx`/esbuild instrumentation defect in the gate script itself (the
   suspected mechanism, per `task-w7-e`'s own diagnosis: esbuild's
   `__name(fn, "fn")` name-preservation wrapper gets baked into the
   transpiled source of the named nested `describe` closure, and
   `Function.prototype.toString()` on that already-transformed closure
   carries the `__name(...)` call literally into the string Playwright
   serializes and sends into the isolated browser page context, where no
   `__name` helper is defined — hence the crash on first invocation), not a
   product-code or layout defect. It is now blocking **two consecutive**
   render-sweep waves (`task-w7-e`, `task-w8-g`) from producing any real
   DEC-401/DEC-404/DEC-405 mobile-geometry numbers at all — this LOG-ONLY
   lane's job is to report it, not fix it (DEC-384), but the next planner
   should treat restoring the mobile-pass instrument itself (e.g. dropping
   the named nested closure, or evaluating a de-sugared/inline version) as
   higher priority than any individual layout fix, since no layout fix can
   currently be verified by this gate at all.

2. **`/admin/comms` (131px) and `/admin/submissions` (40px) overflow
   numbers are stale (last measured at `task-w6-f`'s `cee627c`, two full
   waves ago) and unconfirmed this run** — see "the two readings the next
   planner specifically needs," item 2, above. Neither number can be
   trusted as current until OPEN ITEM 1 is fixed and the mobile pass can
   run to completion again.
