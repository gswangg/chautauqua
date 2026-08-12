# task-w27-e: render-sweep evidence lane (DEC-507)

Frozen sha (wave-27 sha, this worktree's HEAD, unmodified by this task):
`2950e40fed71ab2dd9924414487bf49341ad6d7f`

Command: `npm run gate:render-sweep` (scripts/render-sweep.ts boots its own
migrated + seeded `wrangler dev` on a free local port; server process was
launched and killed only by that script's own `spawn`/`server.kill()` —
no other worktree's PIDs were touched, per DEC-498).

Overall result: **`gate:render-sweep OK`** (process exit 0). Zero FAIL rows
across all five passes; zero console-error/pageerror events collected on
any of the 44 desktop routes.

## Pre-run coverage check (SURFACES enumeration, DEC-503)

Authority: `src/routes/public/shell.tsx:13`

```
export const SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;
```

Both manifests were read at this sha and checked entry-by-entry against
the five `/embed/:slug/<surface>` twins:

**Desktop — `app/src/routeManifest.ts` (lines 164–175, `ROUTE_MANIFEST`):**

| surface  | entry | line |
|----------|-------|------|
| sessions | `/embed/${EVENT_SLUG}/sessions` | 164 |
| agenda   | `/embed/${EVENT_SLUG}/agenda`   | 165 |
| speakers | `/embed/${EVENT_SLUG}/speakers` | 166 |
| schedule | `/embed/${EVENT_SLUG}/schedule` | 174 |
| gallery  | `/embed/${EVENT_SLUG}/gallery`  | 175 |

All five present. Result: **covered**.

**Phone — `scripts/render-sweep.ts` (lines 98–102, `MOBILE_ROUTE_MANIFEST`,
hand-listed, not enumeration-derived):**

| surface  | entry | line |
|----------|-------|------|
| sessions | `/embed/${MOBILE_EVENT_SLUG}/sessions` | 98 |
| agenda   | `/embed/${MOBILE_EVENT_SLUG}/agenda`   | 99 |
| speakers | `/embed/${MOBILE_EVENT_SLUG}/speakers` | 100 |
| schedule | `/embed/${MOBILE_EVENT_SLUG}/schedule` | 101 |
| gallery  | `/embed/${MOBILE_EVENT_SLUG}/gallery`  | 102 |

All five present. Result: **covered**.

Conclusion: at this sha, both the desktop `ROUTE_MANIFEST` and the phone
`MOBILE_ROUTE_MANIFEST` already contain all five `/embed/:slug/<surface>`
twins — no missing entries. The phone manifest is still **hand-listed**
(no DEC-503 re-runnable enumeration test scanning `SURFACES` was found in
this worktree), so this coverage is a manual per-entry check against the
`SURFACES` const at this sha, not a compile/test-enforced invariant — a
future edit to `SURFACES` would not force `MOBILE_ROUTE_MANIFEST` to keep
up. Recorded as a **coverage gap risk (advisory)**, not a FAIL: the
present sha's coverage is complete.

No product-file edit was made — no entry was missing from
`app/src/routeManifest.ts`, so the single permitted edit (adding a
genuinely missing entry there) was not exercised. `scripts/render-sweep.ts`
was not edited, per instructions.

## Desktop pass — 44/44 routes passed

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
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   PASS
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
/embed/devflow-conf-2027/schedule                                               public     PASS
/embed/devflow-conf-2027/gallery                                                public     PASS
/login                                                                          public     PASS
/docs/api                                                                       public     PASS
/dev/mailbox                                                                    public     PASS

44/44 routes passed
```

No console-error or pageerror events were collected on any route (zero
FAIL rows; the gate's evaluateRoute fails a row on any collected console
error / pageerror, and none appear in the raw log).

## Phone pass (390x844, blocking) — 23/23 routes passed

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             44  PASS
/e/devflow-conf-2027/sessions                                0             44  PASS
/e/devflow-conf-2027/speakers                                0             44  PASS
/e/devflow-conf-2027/agenda                                  0             44  PASS
/e/devflow-conf-2027/schedule                                0             44  PASS
/e/devflow-conf-2027/gallery                                 0             44  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             44  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001               0             44  PASS
/embed/devflow-conf-2027/sessions                            0             44  PASS
/embed/devflow-conf-2027/agenda                              0             44  PASS
/embed/devflow-conf-2027/speakers                            0             44  PASS
/embed/devflow-conf-2027/schedule                            0             44  PASS
/embed/devflow-conf-2027/gallery                             0             44  PASS
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

23/23 mobile routes passed
```

All five `/embed/:slug/<surface>` twins pass the phone overflow/tap-target
checks (0px overflow, >=44px controls), confirming the coverage-check
conclusion above end-to-end at 390x844.

## Admin mobile pass (390x844, advisory) — 20/20 routes passed

```
path                                                                             overflowPx  minControlPx  status
/admin/overview                                                                          0             44  PASS
/admin/submissions                                                                       0             44  PASS
/admin/submissions/forms                                                                 0             44  PASS
/admin/submissions/seed_submission_0001                                                  0             44  PASS
/admin/speakers                                                                          0             44  PASS
/admin/content                                                                           0             44  PASS
/admin/agenda                                                                            0             44  PASS
/admin/comms                                                                             0             44  PASS
/admin/contacts                                                                          0             44  PASS
/admin/settings                                                                          0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/new                                                                  0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                                   0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                                    0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           0             44  PASS
/account/password                                                                        0             44  PASS
/account/password                                                                        0             44  PASS

20/20 mobile routes passed
```

## Type-floor pass (10px minimum, advisory) — 87/87 checks passed

All desktop + mobile + admin-mobile readings sit at or above 10px (range
observed: 10px–13px). No offenders under the 10px floor. Full per-route
table (desktop then mobile) captured verbatim in
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-e/render-sweep-output.txt`
lines 4818-4909 (not reproduced in full here for length; every row reads
PASS).

## Contrast pass (WCAG AA, advisory) — 44/44 checks passed

All desktop routes measured minRatio >= 5.95 (well above the 4.5:1 / 3:1
AA thresholds). Full table at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-e/render-sweep-output.txt`
lines 4911-4959; every row reads PASS.

## Console / page errors

None collected on any route in any pass (grep of the raw run log for
`FAIL`, `consoleError`, `pageError` returns zero matches).

## Raw log

Full raw stdout/stderr of the `npm run gate:render-sweep` run (including
the vite build, migration/seed steps, and all five result tables) was
captured at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-e/render-sweep-output.txt`
(gitignored working file in this worktree, not committed — this document
is the durable artifact).
