# task-w12-c — WCAG AA contrast render-sweep pass (DEC-426) @ 0022580

New `scripts/render-sweep-contrast.ts` (pure, unit-tested in
`test/render-sweep-contrast.test.ts`) plus a small `scripts/render-sweep.ts`
addition per DEC-426: an import block, a `measureContrast(page)` helper
placed next to the existing DEC-421 `measureFontFloor`, a call inside
`visitRoute` (desktop pass) after the DEC-411
`PAGE_EVALUATE_KEEPNAMES_SHIM` addInitScript, and a fourth results table
printed in `main()` after the font-floor table.

Advisory, own module: `CONTRAST_BLOCKING = false` (DEC-387 flip rule — this
is the pass's first reading). Never contributes to the render-sweep exit
code while `CONTRAST_BLOCKING` is false, and is not being flipped true by
this task.

Desktop-pass only (`ROUTE_MANIFEST` visits inside `visitRoute`), same
convention as DEC-421's type-floor pass reusing existing page visits rather
than adding a new route list or extra page visits.

## `npm run gate:render-sweep` run

Ran in the worktree (`git -C .../chautauqua-wt/task-w12-c`), fresh chromium
already cached under `~/Library/Caches/ms-playwright`. Full desktop route
pass (31/31) and public/portal mobile pass (14/20, pre-existing
`/admin/review/.../results` overflow FAIL unrelated to this task — owned by
the concurrent `visitMobileRoute` lane) both ran as before; admin-mobile and
type-floor passes stayed advisory and unaffected. Final line:

```
gate:render-sweep OK
```

(exit code 0 — the two blocking passes, desktop route sweep and
public/portal mobile sweep, both passed; the contrast pass below is
advisory and did not flip the exit code even with 7 FAILs.)

## Contrast pass table (transcribed verbatim from the run)

```
render-sweep: contrast pass (WCAG AA, advisory)...

path                                                                            role       minRatio  status
/admin/overview                                                                 organizer      6.28  PASS
/admin/submissions                                                              organizer      6.28  PASS
/admin/submissions/forms                                                        organizer      1.80  FAIL  (contrast below WCAG AA threshold — worst: td.chq-forms-field-drag ratio=1.80 fg=rgb(186,182,166) bg=rgb(244,241,232) | td.chq-forms-field-drag ratio=1.80 fg=rgb(186,182,166) bg=rgb(244,241,232) | td.chq-forms-field-drag ratio=1.80 fg=rgb(186,182,166) bg=rgb(244,241,232))
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
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer      6.28  PASS
/admin/review                                                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer       6.28  PASS
/portal                                                                         speaker        6.28  PASS
/portal/submissions/seed_submission_0001                                        speaker        6.28  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker        6.28  PASS
/portal/profile                                                                 speaker        6.28  PASS
/portal/tasks                                                                   speaker        6.28  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker        6.28  PASS
/e/devflow-conf-2027/sessions                                                   public         3.00  FAIL  (contrast below WCAG AA threshold — worst: span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6))
/e/devflow-conf-2027/speakers                                                   public         6.28  PASS
/e/devflow-conf-2027/gallery                                                    public         6.28  PASS
/e/devflow-conf-2027/agenda                                                     public         3.00  FAIL  (contrast below WCAG AA threshold — worst: span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74) | span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74))
/e/devflow-conf-2027/schedule                                                   public         3.00  FAIL  (contrast below WCAG AA threshold — worst: span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74) | span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74))
/submit/devflow-conf-2027                                                       public         6.68  PASS
/account/password                                                               organizer      6.28  PASS
/account/password                                                               reviewer       6.28  PASS
/account/password                                                               speaker        6.28  PASS
/admin/*                                                                        organizer      6.28  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public         3.10  FAIL  (contrast below WCAG AA threshold — worst: span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74))
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public         6.28  PASS
/embed/devflow-conf-2027/sessions                                               public         3.00  FAIL  (contrast below WCAG AA threshold — worst: span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6))
/embed/devflow-conf-2027/agenda                                                 public         3.00  FAIL  (contrast below WCAG AA threshold — worst: span.chq-pub-track-chip ratio=3.00 fg=rgb(247,249,240) bg=rgb(217,119,6) | span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74) | span.chq-pub-track-chip ratio=3.10 fg=rgb(247,249,240) bg=rgb(22,163,74))
/embed/devflow-conf-2027/speakers                                               public         6.28  PASS
/login                                                                          public         6.28  PASS
/docs/api                                                                       public         6.28  PASS
/dev/mailbox                                                                    public         6.28  PASS

35/42 contrast checks passed
gate:render-sweep OK
```

## Reading

- 35/42 desktop routes PASS at WCAG AA (>=4.5:1 normal text, >=3:1 large
  text >=24px or >=18.66px @ weight>=700).
- The 7 FAILs cluster into two distinct offenders, both advisory findings
  for a future decision/task to fix (out of scope here per DEC-426 —
  landing the instrument, not the fix):
  1. `td.chq-forms-field-drag` on `/admin/submissions/forms` — muted text
     (`rgb(186,182,166)`, the `border` token `#BAB6A6`) on `paper`
     (`rgb(244,241,232)`, `#F4F1E8`) measures 1.80:1, well under 4.5:1. This
     looks like a drag-handle affordance rendered in the border/hairline
     token rather than `muted`/`ink`.
  2. `span.chq-pub-track-chip` on 6 public/embed session-list-adjacent
     routes — light text (`rgb(247,249,240)`) on amber (`rgb(217,119,6)`,
     3.00:1) and green (`rgb(22,163,74)`, 3.10:1) track-chip backgrounds,
     both under the 4.5:1 normal-text threshold (chip text is well under
     24px/18.66px-bold, so the large-text 3:1 threshold does not apply).
- `npm run build` and `npm test --silent` both green (2219/2219 tests,
  including the 12 new `test/render-sweep-contrast.test.ts` cases and the
  updated DEC-411 file-structure invariant test in
  `test/render-sweep-lib.test.ts` that now also accounts for the new
  `measureContrast` helper's own `page.evaluate` call site).

See `docs/verification-log.md` section `## 2026-08-12 task-w12-c — WCAG AA
contrast pass (DEC-426) @ 0022580` for the summary entry.
