# task-w12-a — render-sweep, DEC-424 mobile-overflow instrument correction

Scope (DEC-424): correct `visitMobileRoute`'s in-page overflow measurement
(exclude elements deliberately held inside a horizontal scroller, DEC-414's
remedy) and add content-spill attribution (name the spilling element when
`scrollWidth` overflows but no single element's `rect.right` did), then close
whatever genuinely remains against the corrected instrument. Baseline to
beat: wave 10 measured 6 admin-mobile FAILs.

`npm run build` and `npm test --silent` both green (2209 tests, 0 failures)
before either sweep run below.

## Reading 1 — before the review/results fix

`npm run gate:render-sweep` run against the corrected instrument, code
otherwise unchanged from wave 10's admin SPA. 5 of the 6 previously-FAILing
admin-mobile routes now PASS under the corrected exclusion; one route
(`/admin/review/plans/seed_evaluation_plan_0001/results`) still failed, but
now with a named content-spill offender instead of an empty offender list
(the DEC-424 (3) behavior working as intended — it names the bug instead of
suppressing it).

### Desktop pass — 42/42 routes passed

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

### Public/portal mobile pass (390x844, blocking) — 21/21 routes passed

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

### Admin mobile pass (390x844, advisory, DEC-387) — 19/20 routes passed

```
path                                                                            overflowPx  minControlPx  status
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
/admin/review/plans/seed_evaluation_plan_0001/results                                   25             44  FAIL  (horizontal overflow 25px (scrollWidth 415 > viewport 390) — widest: div.chq-page.chq-review-page spill=59px (scrollWidth 381 > clientWidth 322) | section.chq-section spill=59px (scrollWidth 381 > clientWidth 322) | div.chq-section-head spill=59px (scrollWidth 381 > clientWidth 322))
/admin/review                                                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           0             44  PASS
/account/password                                                                        0             44  PASS
/account/password                                                                        0             44  PASS

19/20 mobile routes passed
```

### Type-floor pass (10px minimum, advisory, DEC-421) — 83/83 checks passed

```
path                                                                            role       viewport  minFontPx  status
/admin/overview                                                                 organizer  desktop         10  PASS
/admin/submissions                                                              organizer  desktop         10  PASS
/admin/submissions/forms                                                        organizer  desktop         10  PASS
/admin/submissions/seed_submission_0001                                         organizer  desktop         10  PASS
/admin/speakers                                                                 organizer  desktop         10  PASS
/admin/content                                                                  organizer  desktop         10  PASS
/admin/agenda                                                                   organizer  desktop         10  PASS
/admin/comms                                                                    organizer  desktop         10  PASS
/admin/contacts                                                                 organizer  desktop         10  PASS
/admin/settings                                                                 organizer  desktop         10  PASS
/admin/review                                                                   organizer  desktop         10  PASS
/admin/review/plans/new                                                         organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  desktop         10  PASS
/admin/review                                                                   reviewer   desktop         12  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   desktop         11  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   desktop         11  PASS
/portal                                                                         speaker    desktop         10  PASS
/portal/submissions/seed_submission_0001                                        speaker    desktop         10  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    desktop         11  PASS
/portal/profile                                                                 speaker    desktop         11  PASS
/portal/tasks                                                                   speaker    desktop         10  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    desktop         12  PASS
/e/devflow-conf-2027/sessions                                                   public     desktop         11  PASS
/e/devflow-conf-2027/speakers                                                   public     desktop         11  PASS
/e/devflow-conf-2027/gallery                                                    public     desktop         11  PASS
/e/devflow-conf-2027/agenda                                                     public     desktop         11  PASS
/e/devflow-conf-2027/schedule                                                   public     desktop         11  PASS
/submit/devflow-conf-2027                                                       public     desktop         11  PASS
/account/password                                                               organizer  desktop         11  PASS
/account/password                                                               reviewer   desktop         11  PASS
/account/password                                                               speaker    desktop         11  PASS
/admin/*                                                                        organizer  desktop         10  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     desktop         11  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     desktop         11  PASS
/embed/devflow-conf-2027/sessions                                               public     desktop         12  PASS
/embed/devflow-conf-2027/agenda                                                 public     desktop       12.8  PASS
/embed/devflow-conf-2027/speakers                                               public     desktop         13  PASS
/login                                                                          public     desktop         11  PASS
/docs/api                                                                       public     desktop         11  PASS
/dev/mailbox                                                                    public     desktop         11  PASS
/submit/devflow-conf-2027                                                       public     mobile          11  PASS
/e/devflow-conf-2027/sessions                                                   public     mobile          11  PASS
/e/devflow-conf-2027/speakers                                                   public     mobile          11  PASS
/e/devflow-conf-2027/agenda                                                     public     mobile          11  PASS
/e/devflow-conf-2027/schedule                                                   public     mobile          11  PASS
/e/devflow-conf-2027/gallery                                                    public     mobile          11  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     mobile          11  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     mobile          11  PASS
/embed/devflow-conf-2027/sessions                                               public     mobile          12  PASS
/embed/devflow-conf-2027/agenda                                                 public     mobile        12.8  PASS
/embed/devflow-conf-2027/speakers                                               public     mobile          13  PASS
/login                                                                          public     mobile          11  PASS
/portal                                                                         speaker    mobile          10  PASS
/portal/submissions/seed_submission_0001                                        speaker    mobile          10  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    mobile          11  PASS
/portal/profile                                                                 speaker    mobile          11  PASS
/portal/tasks                                                                   speaker    mobile          10  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    mobile          12  PASS
/account/password                                                               speaker    mobile          11  PASS
/docs/api                                                                       public     mobile          11  PASS
/dev/mailbox                                                                    public     mobile          11  PASS
/admin/overview                                                                 organizer  mobile          10  PASS
/admin/submissions                                                              organizer  mobile          10  PASS
/admin/submissions/forms                                                        organizer  mobile          10  PASS
/admin/submissions/seed_submission_0001                                         organizer  mobile          11  PASS
/admin/speakers                                                                 organizer  mobile          11  PASS
/admin/content                                                                  organizer  mobile          11  PASS
/admin/agenda                                                                   organizer  mobile          10  PASS
/admin/comms                                                                    organizer  mobile          11  PASS
/admin/contacts                                                                 organizer  mobile          11  PASS
/admin/settings                                                                 organizer  mobile          11  PASS
/admin/review                                                                   organizer  mobile          10  PASS
/admin/review/plans/new                                                         organizer  mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  mobile          10  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  mobile          11  PASS
/admin/review                                                                   reviewer   mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   mobile          11  PASS
/account/password                                                               organizer  mobile          11  PASS
/account/password                                                               reviewer   mobile          11  PASS

83/83 font-floor checks passed
```

`gate:render-sweep OK` (non-blocking; admin-mobile and font-floor are
advisory per DEC-387/DEC-421 — `ADMIN_MOBILE_PASS_BLOCKING` and
`FONT_FLOOR_BLOCKING` are both left `false`, unchanged, per this task's
scope).

## Fix applied between readings

The named offender (`div.chq-page.chq-review-page` / `section.chq-section` /
`div.chq-section-head`, all reporting the same 59px spill) pointed at the
`.chq-section-head` flex row on `ResultsTable.tsx`, not the results table
itself. The shared `.chq-section-action` class (`app/src/styles.css`) is
`white-space: nowrap` — appropriate for its usual short link-label use, but
this page's one instance carries a full sentence ("Mean of submitted
reviews · recusals excluded"), and the nowrap text was the actual overflow
source at 390px.

Per DEC-414's remedy set (a scroller or a wrap, never `overflow:hidden`,
never edited in the shell `app/src/styles.css` from a page lane, DEC-368):
added a page-owned class `chq-review-results-note` in
`app/src/pages/review/review.css`, layered alongside the existing
`chq-section-action` class on the span in `app/src/pages/review/ResultsTable.tsx`,
setting `white-space: normal`. The shared class itself is untouched.

## Reading 2 — after the review/results fix

`npm run build` and full `npm run gate:render-sweep` re-run (local D1/R2
state reset first — a stale local D1 from the first run rejected re-seeding
on a unique-constraint conflict; this is normal for two full sweep runs
against the same `.wrangler/state` and is not itself an instrument failure).

### Desktop pass — 42/42 routes passed (identical to Reading 1's table, omitted for brevity — same routes, all PASS)

### Public/portal mobile pass (390x844, blocking) — 21/21 routes passed (identical to Reading 1's table, omitted for brevity)

### Admin mobile pass (390x844, advisory, DEC-387) — 20/20 routes passed

```
path                                                                            overflowPx  minControlPx  status
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

### Type-floor pass (10px minimum, advisory, DEC-421) — 83/83 checks passed (identical to Reading 1's table, omitted for brevity)

`gate:render-sweep OK`.

## Result

All four DEC-424 (1)-(4) instrument changes implemented and unit-tested
(`test/render-sweep-lib.test.ts`); the previously-blind
`/admin/review/plans/seed_evaluation_plan_0001/results` FAIL now names its
offender under the corrected instrument (Reading 1) and is fixed
(Reading 2): 20/20 admin-mobile routes now PASS (up from wave 10's 14/20 —
6 admin FAILs), matching the "5 should now PASS, 1 named-and-fixed" target
in this task's description. `ADMIN_MOBILE_PASS_BLOCKING` and
`FONT_FLOOR_BLOCKING` left unflipped, per (7).
