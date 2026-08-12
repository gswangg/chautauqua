# task-w14-d: contrast flip lane (DEC-436)

Own `npm run gate:render-sweep` run on this tree (branch `task-w14-d`,
worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w14-d`,
commit base `2a08944` "scribe wave 14"). Boot: migrated + seeded local
`wrangler dev` on a free port, real Playwright chromium login per persona
(organizer/reviewer/speaker), DEC-411's `PAGE_EVALUATE_KEEPNAMES_SHIM`
addInitScript-first shim used unmodified from `scripts/render-sweep.ts`
(no changes made to it — verified present and applied before every
`page.evaluate` call in this run).

## Desktop routes (42/42 PASS — status/console/non-empty gate)

All 42 `ROUTE_MANIFEST` entries returned 200, non-empty root/body, and zero
console error/pageerror events. Full per-route table reproduced below.

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
```

42/42 routes passed.

## WCAG AA contrast pass (advisory, DEC-426) — 41/42, NOT all-PASS

```
path                                                                            role       minRatio  status
/admin/overview                                                                 organizer      6.28  PASS
/admin/submissions                                                              organizer      6.28  PASS
/admin/submissions/forms                                                        organizer      3.06  FAIL
/admin/submissions/seed_submission_0001                                         organizer      6.28  PASS
/admin/speakers                                                                 organizer      6.28  PASS
/admin/content                                                                  organizer      6.28  PASS
/admin/agenda                                                                   organizer      6.28  PASS
/admin/comms                                                                    organizer      5.95  PASS
/admin/contacts                                                                 organizer      6.28  PASS
/admin/settings                                                                 organizer      5.95  PASS
/admin/review                                                                   organizer      6.28  PASS
/admin/review/plans/new                                                         organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer      6.28  PASS
/admin/review                                                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer       6.28  PASS
/portal                                                                         speaker        6.28  PASS
/portal/submissions/seed_submission_0001                                        speaker        6.28  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker        6.28  PASS
/portal/profile                                                                 speaker        6.28  PASS
/portal/tasks                                                                   speaker        6.28  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker        6.28  PASS
/e/devflow-conf-2027/sessions                                                   public         6.28  PASS
/e/devflow-conf-2027/speakers                                                   public         6.28  PASS
/e/devflow-conf-2027/gallery                                                    public         6.28  PASS
/e/devflow-conf-2027/agenda                                                     public         6.28  PASS
/e/devflow-conf-2027/schedule                                                   public         6.28  PASS
/submit/devflow-conf-2027                                                       public         6.68  PASS
/account/password                                                               organizer      6.28  PASS
/account/password                                                               reviewer       6.28  PASS
/account/password                                                               speaker        6.28  PASS
/admin/*                                                                        organizer      6.28  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public         6.28  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public         6.28  PASS
/embed/devflow-conf-2027/sessions                                               public         6.28  PASS
/embed/devflow-conf-2027/agenda                                                 public         6.82  PASS
/embed/devflow-conf-2027/speakers                                               public         6.28  PASS
/login                                                                          public         6.28  PASS
/docs/api                                                                       public         6.28  PASS
/dev/mailbox                                                                    public         6.28  PASS
```

41/42 contrast checks passed.

### FAIL detail (only offender below 4.5:1 normal-text threshold)

- Route: `/admin/submissions/forms` (organizer)
- Worst offender: `td ratio=3.06 fg=rgb(142,138,122) bg=rgb(244,241,232)`
  - `rgb(142,138,122)` = `#8e8a7a` = `--chq-disabled` custom property
    (`app/src/styles.css:30`)
  - `rgb(244,241,232)` = `#F4F1E8` = paper background token
  - Declaration site: `app/src/styles.css:1147-1149`
    ```css
    .chq-forms-field-locked {
      color: var(--chq-disabled);
    }
    ```
    Reused verbatim by `app/src/pages/forms/forms.css:130-132`
    (`.chq-forms-settings-title { color: var(--chq-disabled); }`) — same
    token, same route, contributes to the same `td` measurement set
    reported by the sweep on this page (FormsPage's field-list table
    renders locked/system fields with `.chq-forms-field-locked`, which is
    a `<td>` in the fields table on `/admin/submissions/forms`).
  - Ratio 3.06 fails the 4.5:1 normal-text WCAG AA minimum (this text is
    not >=18.66px/bold, so the 3:1 large-text threshold does not apply).
- This is the same, previously-known third offender documented in
  `docs/verification-log/task-w13-a-render-sweep-stage1.md` and named in
  the flip-rule comment at `scripts/render-sweep-contrast.ts:12-21`: fixing
  the DEC-430-named drag-glyph/track-chip offenders unmasked this
  `--chq-disabled` usage on the same route, and no lane has re-pixeled it
  since. This run's own reading (41/42, not all-PASS) matches that prior
  transcript's outcome exactly — no regression, but also no fix landed in
  this tree, so per DEC-436 ("flip only if your own run reads all-PASS")
  **CONTRAST_BLOCKING is NOT flipped**.

## Admin-mobile pass (390x844, advisory, DEC-393/DEC-431) — 20/20 PASS

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
```

20/20 mobile routes passed.

`ADMIN_MOBILE_PASS_BLOCKING` (`scripts/render-sweep-lib.ts:257`) is
already `true`. `test/render-sweep-lib.test.ts:433-436` already asserts
`expect(ADMIN_MOBILE_PASS_BLOCKING).toBe(true)` and checks the DEC-387
flip-rule comment text is present — no change needed, DEC-431's flip is
already landed and consistent between the constant and its test.

## Type-floor pass (10px minimum, advisory, DEC-421/DEC-431) — 83/83 PASS

83/83 font-floor checks passed (desktop + mobile, all roles/routes; lowest
observed was 10px, at the floor, still a PASS per the >=10px rule).

`FONT_FLOOR_BLOCKING` (`scripts/render-sweep-lib.ts:295`) is already
`true`. `test/render-sweep-lib.test.ts:654-664` already asserts
`expect(FONT_FLOOR_BLOCKING).toBe(true)` plus the flip-rule comment text
and the `allFontFloorPassed(fontFloorResults) && FONT_FLOOR_BLOCKING` gate
expression in `scripts/render-sweep.ts` — no change needed.

## Disposition

- `CONTRAST_BLOCKING` (`scripts/render-sweep-contrast.ts:20`): left
  **false**. This run's own reading is 41/42 (not all-PASS); the single
  offender is `app/src/styles.css:1147-1149` (`.chq-forms-field-locked`,
  `--chq-disabled` on paper background, ratio 3.06 < 4.5) on
  `/admin/submissions/forms`, reused by
  `app/src/pages/forms/forms.css:130-132`. No pixel change made per
  DEC-430 (remedies belong to the lane that owns those pixels, not this
  flip-only lane) and no exemption/skip added to
  `scripts/render-sweep-contrast.ts` per DEC-430.
  `test/render-sweep-contrast.test.ts:96-99` already asserts
  `CONTRAST_BLOCKING` is `false` — consistent, unchanged.
- `ADMIN_MOBILE_PASS_BLOCKING` and `FONT_FLOOR_BLOCKING`: confirmed both
  already `true` at their cited line numbers, both with tests already
  asserting `true` — DEC-431's flip already landed correctly in this
  tree; no constant or test edits required.

## Verification

- `npm run build` — green.
- `npm test --silent` — 271 test files, 2245 tests, all passed (includes
  `test/render-sweep-contrast.test.ts` and `test/render-sweep-lib.test.ts`
  unchanged/still-passing).
- `npm run gate:render-sweep` — full run as tabulated above; exits 0
  (contrast/admin-mobile/font-floor remain advisory per their current
  BLOCKING constants, so the FAIL on `/admin/submissions/forms` contrast
  does not fail the gate's exit code).
