# task-w9-b — render-sweep gate instrumentation fix + mobile manifest widen (DEC-411)

Owns exactly `scripts/render-sweep.ts`, `scripts/render-sweep-lib.ts`,
`test/render-sweep-lib.test.ts`, and this log file (DEC-384: gate lanes
report, they do not fix product code — this task fixes the *instrument*
itself, per its own scope, not the redesign's CSS).

## SHA measured

`git rev-parse HEAD` = **`aee7fe216cc01e88862d4d4bb59f8730f70810f9`**
("DEC-411: fix render-sweep keepNames instrumentation, widen mobile
manifest" — the commit on this branch containing the shim + manifest fix,
committed before running the gate below so the gate's own build/boot
reflects exactly this code).

## What was fixed

`docs/verification-log/task-w7-e-render-sweep-redesign.md` (read first, per
task instructions) reported all 35 mobile-pass rows (public/portal 15/15,
admin-advisory 20/20) failing identically with `page.evaluate:
ReferenceError: __name is not defined`, before any overflow/control
measurement could run. Root cause: `scripts/render-sweep.ts`'s
`visitMobileRoute` declared a named closure (`const describe = (el:
Element): string => {...}`) inside the function body passed to
`page.evaluate()`. `tsx` runs esbuild with `keepNames`, which rewrites that
named closure to `__name(fn, "describe")` at the source level; when
Playwright serializes the (already-rewritten) function's source text into
the browser page context, that context has no `__name` global, so the
first invocation of `describe(...)` throws.

Fix (`scripts/render-sweep-lib.ts`): added

```
export const PAGE_EVALUATE_KEEPNAMES_SHIM =
  "globalThis.__name = globalThis.__name || function (fn) { return fn; };";
```

as a raw string literal — never passed through esbuild, so it cannot
itself be rewritten into a broken `__name(fn, "shim")` call (which would be
circular). `scripts/render-sweep.ts` calls
`await page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });`
immediately after `context.newPage()` in both `visitRoute` and
`visitMobileRoute`, before any navigation or evaluation on that page.

Also widened `MOBILE_ROUTE_MANIFEST` from a single `/portal` entry to the
whole speaker portal: `/portal/submissions/seed_submission_0001`,
`/portal/submissions/seed_submission_0001/edit`, `/portal/profile`,
`/portal/tasks`, `/portal/tasks/seed_task_assignment_0001/form`, and
`/account/password` (speaker role) — the same deterministic seed ids
`app/src/routeManifest.ts` already uses for its desktop entries. All six
were already present in `ROUTE_MANIFEST` (DEC-403's superset invariant), so
no `routeManifest.ts` edit was needed; `test/render-sweep-lib.test.ts`
asserts that superset relation directly (for non-public-role entries)
rather than only stating it in a comment.

## Commands run, in order

1. `git -C .../chautauqua worktree add .../task-w9-b -b task-w9-b main` —
   exit 0.
2. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund
   --silent)` — exit 0.
3. `npm run build` — **PASS**, exit 0 (154 modules transformed, only the
   two expected font-asset "didn't resolve at build time" notices).
4. `npm test --silent` (full suite) — **PASS**, 256 test files / 2126 tests,
   exit 0.
5. `npx vitest run test/render-sweep-lib.test.ts` — **PASS**, 43/43 tests
   (the new shim + source-scan + superset tests included).
6. `git add -A && git commit ...` — committed the code+test changes as
   `aee7fe2` before running the gate.
7. `npx playwright install chromium` — no-op (already installed).
8. `npm run gate:render-sweep` — self-boots a migrated+seeded `wrangler
   dev` on a free local port (`64746` this run), logs in as
   organizer/reviewer/speaker via the real `/login` form, runs the three
   passes transcribed below. **Exit 0** (`gate:render-sweep OK`).

## Desktop sweep — PASS/FAIL table (verbatim, port 64746)

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

Note: `/admin/overview` (organizer) — which task-w7-e's reading logged as a
`TypeError`/empty-body FAIL (the DEC-400 `OverviewPayload` wire-key
mismatch) — is now **PASS**. That regression was fixed by product work on
an intervening branch/wave (DEC-400's `overview` wire-key fix is noted as
settled in the field guide); not a change made by this task, which touched
no product code.

## 390px mobile pass — PASS/FAIL table (DEC-253/DEC-401/DEC-411, public+portal, verbatim)

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

This is the first honest reading of this pass since the DEC-401 diagnostic
was added: the instrumentation crash from task-w7-e is gone (no `__name is
not defined` anywhere), and every row — including the six newly-added
speaker-portal surfaces (`/portal/submissions/...`,
`/portal/submissions/.../edit`, `/portal/profile`, `/portal/tasks`,
`/portal/tasks/.../form`) and `/account/password` — passes at zero overflow
and >= 44px controls.

## 390px admin mobile pass — advisory (DEC-387), organizer + reviewer (verbatim)

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

14/20 mobile routes passed  (advisory only — ADMIN_MOBILE_PASS_BLOCKING=false at scripts/render-sweep-lib.ts:247, does not gate exit code)
```

## Summary lines (verbatim, as printed by the sweep)

- `42/42 routes passed` (desktop)
- `21/21 mobile routes passed` (public/portal)
- `14/20 mobile routes passed` (admin, advisory)
- `gate:render-sweep OK` (exit 0 — the desktop and public/portal mobile
  passes are the ones that gate the exit code; the admin-advisory pass does
  not)

## 390px offenders named by the DEC-401 diagnostic (admin-advisory pass only — the only table with any FAIL rows this run)

| Route | overflowPx | Offenders (tag.classes w=Npx right=Npx) |
|---|---|---|
| `/admin/overview` | 46 | `a.chq-overview-deadline-cell` w=111px right=436px; `span.chq-overview-deadline-label` w=82px right=422px; `span.chq-overview-deadline-value` w=82px right=422px |
| `/admin/submissions` | 117 | `button.chq-pill` w=76px right=507px; `button.chq-pill` w=80px right=423px |
| `/admin/submissions/forms` | 38 | `button.chq-pill` w=151px right=428px |
| `/admin/content` | 2 | `button.chq-pill` w=82px right=392px |
| `/admin/agenda` | 152 | `span.chq-agenda-clash-note` w=221px right=542px; `button.chq-pill.chq-phone-room-chip` w=55px right=540px; `button.chq-pill.chq-phone-room-chip` w=113px right=478px |
| `/admin/review/plans/seed_evaluation_plan_0001/results` | 25 | (no per-element offender captured — `scrollWidth` (415) alone exceeded the viewport; `maxElementRight` did not surface a single widest element above the offender threshold) |

Every named offender is a `.chq-pill` (submission/content status/track
pill), a `.chq-overview-deadline-*` chip, or a `.chq-agenda-clash-note` /
`.chq-phone-room-chip` — all admin-SPA phone-card row furniture, not any
portal/public surface (which is 21/21 clean). This table is the
diagnostic's raw output only; per this task's scope (DEC-384), no CSS or
product code was touched to address these — that is task-w9-g's job.

## Does the admin mobile advisory pass read all-PASS (DEC-387's flip condition)?

**No.** 14/20, six real FAIL rows (all named above). `ADMIN_MOBILE_PASS_BLOCKING`
remains `false` at `scripts/render-sweep-lib.ts:247`, unmodified by this
task, per DEC-387's rule ("it becomes true in the wave after the pass first
reads all-PASS" — not yet).

## RESULT: PASS

The instrumentation failure reported by task-w7-e is fixed: zero `__name is
not defined` errors anywhere in this run's output. The desktop pass is
42/42, the public/portal mobile pass (now covering the whole speaker
portal, not just `/portal`) is 21/21, and the gate's own exit code is 0
(`gate:render-sweep OK`). The admin-advisory pass — which does not gate the
exit code — is 14/20 with six real, now-measurable phone-width overflow
regressions in the admin SPA, named above for task-w9-g.

## Scope note

Per the task's explicit instruction (DEC-384: gate lanes report, they do
not fix), no product code (`app/src/**`) was touched by this task — only
`scripts/render-sweep.ts`, `scripts/render-sweep-lib.ts`,
`test/render-sweep-lib.test.ts`, and this log file. The six admin-advisory
overflow FAILs above are a report, not a fix.
